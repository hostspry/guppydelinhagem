import { NextResponse } from "next/server";
import { trocarCodePorToken } from "@/lib/mercadolivre/cliente";

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

  if (erroMl) {
    const desc = url.searchParams.get("error_description") ?? erroMl;
    return NextResponse.redirect(
      new URL(`${destino}?erro=${encodeURIComponent(desc)}`, url.origin),
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL(
        `${destino}?erro=${encodeURIComponent("O Mercado Livre não devolveu o código de autorização.")}`,
        url.origin,
      ),
    );
  }

  // O redirect_uri do token tem que ser IDÊNTICO ao usado na autorização.
  // Montar a partir da própria requisição evita divergir de www/sem-www.
  const redirect = `${url.origin}${url.pathname}`;
  const r = await trocarCodePorToken(code, redirect);

  return NextResponse.redirect(
    new URL(
      `${destino}?${r.ok ? "ok=1" : `erro=${encodeURIComponent(r.erro)}`}`,
      url.origin,
    ),
  );
}
