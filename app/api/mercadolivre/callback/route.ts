import { NextResponse } from "next/server";
import { trocarCodePorToken } from "@/lib/mercadolivre/cliente";

/**
 * Endereço público do site.
 *
 * NÃO dá para tirar isso de `request.url`: atrás do proxy do Coolify o Next
 * enxerga o host interno (0.0.0.0:3000), e foi o que quebrou a primeira
 * autorização. O `redirect_uri` mandado na troca do code tem que ser IDÊNTICO
 * ao cadastrado na aplicação — divergiu, o ML responde `invalid_grant` — e o
 * destino final precisa ser um endereço que exista para o navegador.
 */
function base(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://guppydelinhagem.com.br"
  );
}

// Volta da tela de autorização do Mercado Livre.
//
// O ML manda o dono para cá com ?code=... e o code vale UMA vez, por poucos
// minutos. Por isso a troca acontece agora, e não numa tela depois: um
// recarregamento e o code já não serve.
//
// O endereço precisa estar cadastrado IGUAL na aplicação (redirect URI). O ML
// compara caractere a caractere e recusa por uma barra sobrando.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const erroMl = url.searchParams.get("error");
  const destino = "/admin/configuracoes/mercado-livre";

  const publico = base();

  if (erroMl) {
    const desc = url.searchParams.get("error_description") ?? erroMl;
    return NextResponse.redirect(
      new URL(`${destino}?erro=${encodeURIComponent(desc)}`, publico),
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL(
        `${destino}?erro=${encodeURIComponent("O Mercado Livre não devolveu o código de autorização.")}`,
        publico,
      ),
    );
  }

  // Mesma string usada para montar o link de autorização e cadastrada na
  // aplicação. Qualquer diferença aqui vira invalid_grant.
  const r = await trocarCodePorToken(code, `${publico}/api/mercadolivre/callback`);

  return NextResponse.redirect(
    new URL(
      `${destino}?${r.ok ? "ok=1" : `erro=${encodeURIComponent(r.erro)}`}`,
      publico,
    ),
  );
}
