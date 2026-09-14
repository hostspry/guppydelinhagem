import { NextResponse } from "next/server";
import { trocarCodePorToken } from "@/lib/shopee/cliente";

/**
 * Endereço público do site. Atrás do proxy do Coolify, `request.url` traz o host
 * interno (0.0.0.0:3000) — mandar o navegador para lá dá ERR_ADDRESS_INVALID.
 */
function base(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://guppydelinhagem.com.br"
  );
}

// Volta da tela de autorização da Shopee.
//
// A Shopee manda o dono para cá com ?code=...&shop_id=..., e o code vale uma vez
// só, por poucos minutos. Por isso a troca acontece agora, e não numa tela
// depois: um recarregamento e o code já não serve.
//
// Este endereço precisa estar cadastrado IGUAL no app da Open Platform — a
// Shopee compara caractere a caractere e recusa por uma barra sobrando.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const shopId = url.searchParams.get("shop_id") ?? "";

  const destino = "/admin/configuracoes/shopee";

  if (!code || !shopId) {
    // Sem os dois, o dono chegou aqui por engano (ou a Shopee recusou antes).
    return NextResponse.redirect(
      new URL(`${destino}?erro=${encodeURIComponent("A Shopee não devolveu o código de autorização.")}`, base()),
    );
  }

  const r = await trocarCodePorToken(code, shopId);
  const query = r.ok
    ? "ok=1"
    : `erro=${encodeURIComponent(r.erro)}`;

  return NextResponse.redirect(new URL(`${destino}?${query}`, base()));
}

// A Shopee não usa POST aqui, mas mantém o mesmo tratamento caso mude.
export const POST = GET;
