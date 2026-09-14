import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Aviso do Mercado Livre (notificação) — pedido novo, mudança de anúncio, envio.
//
// O ML manda só o PONTEIRO do recurso (`/orders/123`), nunca o conteúdo: quem
// busca os dados somos nós. E ele desativa endpoint que falha ou demora, então a
// regra aqui é responder 200 rápido e sempre, mesmo no que a gente ainda não
// trata — 404 repetido derrubaria a assinatura de notificações da aplicação.
//
// A importação de pedidos ainda não está escrita. Até lá, o aviso é registrado
// no log com o recurso, que é o que vai permitir escrever a importação contra
// um pedido de verdade em vez de contra a documentação.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AvisoMl = {
  resource?: string;
  user_id?: number | string;
  topic?: string;
  application_id?: number | string;
  attempts?: number;
  sent?: string;
};

export async function POST(request: Request): Promise<Response> {
  let aviso: AvisoMl;
  try {
    aviso = (await request.json()) as AvisoMl;
  } catch {
    // Corpo ilegível não é motivo para o ML marcar o endereço como quebrado.
    return NextResponse.json({ ok: true });
  }

  const cfg = await prisma.integracaoMercadoLivre
    .findUnique({
      where: { id: "default" },
      select: { ativo: true, sellerId: true },
    })
    .catch(() => null);

  // Aviso de outra conta (ou com a integração desligada): ignora em silêncio.
  if (!cfg?.ativo || !cfg.sellerId) return NextResponse.json({ ok: true });
  if (String(aviso.user_id ?? "") !== cfg.sellerId) {
    return NextResponse.json({ ok: true });
  }

  console.warn(
    "[ml-webhook]",
    JSON.stringify({
      topic: aviso.topic ?? "",
      resource: aviso.resource ?? "",
      tentativa: aviso.attempts ?? 0,
    }),
  );

  return NextResponse.json({ ok: true });
}

// O ML faz uma verificação por GET em alguns momentos; responder 200 evita que
// ele considere o endereço inválido no cadastro.
export async function GET(): Promise<Response> {
  return NextResponse.json({ ok: true });
}
