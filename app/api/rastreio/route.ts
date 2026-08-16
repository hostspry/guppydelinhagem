import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { TIPOS_VALIDOS } from "@/lib/rastreio/eventos";
import {
  COOKIE_VISITANTE,
  VALIDADE_COOKIE_S,
  registrarEvento,
} from "@/lib/rastreio/servidor";

// Coleta dos eventos do site. Chamado pelo navegador (sendBeacon/fetch), então
// é público — daí o rate limit por IP e a validação estrita do corpo.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  tipo: z.string().refine((t) => TIPOS_VALIDOS.includes(t), "tipo desconhecido"),
  consentimento: z.boolean().default(false),
  url: z.string().max(500).optional(),
  titulo: z.string().max(200).optional(),
  referrer: z.string().max(500).optional(),
  produtoId: z.string().max(40).optional(),
  produtoNome: z.string().max(200).optional(),
  variantId: z.string().max(40).optional(),
  composicao: z.string().max(20).optional(),
  quantidade: z.number().int().min(0).max(9999).optional(),
  valor: z.number().min(0).max(9_999_999).optional(),
  busca: z.string().max(200).optional(),
  utm: z
    .object({
      source: z.string().max(100).optional(),
      medium: z.string().max(100).optional(),
      campaign: z.string().max(100).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const h = await headers();

  // 120 eventos/min por IP: folgado para navegação real, apertado para flood.
  if (!rateLimit(`rastreio:${clientIp(h)}`, 120, 60_000).ok) {
    return new NextResponse(null, { status: 429 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const parsed = schema.safeParse(corpo);
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const d = parsed.data;

  const jar = await cookies();
  const visitanteId = jar.get(COOKIE_VISITANTE)?.value ?? null;

  // A sessão do cliente logado liga a visita à conta dele.
  const session = await auth().catch(() => null);

  const r = await registrarEvento(
    {
      visitanteId,
      consentimento: d.consentimento,
      headers: h,
      userId: session?.user?.id ?? null,
      referrer: d.referrer ?? null,
      url: d.url ?? null,
      utm: d.utm,
    },
    {
      tipo: d.tipo,
      url: d.url,
      titulo: d.titulo,
      produtoId: d.produtoId,
      produtoNome: d.produtoNome,
      variantId: d.variantId,
      composicao: d.composicao,
      quantidade: d.quantidade,
      valor: d.valor,
      busca: d.busca,
    },
  );

  // 204 sempre que o pedido era válido: o navegador não tem o que fazer com um
  // erro de rastreio, e não queremos ruído no console do cliente.
  const res = new NextResponse(null, { status: 204 });
  if (r && r.visitanteId !== visitanteId) {
    res.cookies.set(COOKIE_VISITANTE, r.visitanteId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: VALIDADE_COOKIE_S,
      path: "/",
    });
  }
  return res;
}
