import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Recebe os erros que estouram NO NAVEGADOR.
 *
 * Erro de servidor já cai no log com a pilha inteira. O que não deixava rastro
 * nenhum era o erro do lado do cliente: um arquivo de JavaScript que sumiu
 * depois do deploy, uma action que o servidor novo não reconhece. A pessoa via
 * "This page couldn't load" e a gente não ficava sabendo de nada.
 *
 * Só registra no log (com prefixo próprio). Nada de Telegram: robô também
 * dispara erro, e um aviso por erro viraria barulho.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`erro-cliente:${clientIp(req.headers)}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

  let body: {
    nome?: string;
    mensagem?: string;
    digest?: string;
    url?: string;
    versaoVelha?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const corta = (v: unknown, max: number) =>
    typeof v === "string" ? v.slice(0, max) : "";

  console.error(
    "[erro-cliente]",
    JSON.stringify({
      url: corta(body.url, 200),
      nome: corta(body.nome, 80),
      mensagem: corta(body.mensagem, 300),
      digest: corta(body.digest, 40),
      // Quando é true, a causa é deploy no meio da sessão de alguém — a página
      // se recarrega sozinha e não há defeito a caçar.
      versaoVelha: body.versaoVelha === true,
      ua: corta(req.headers.get("user-agent"), 200),
    }),
  );

  return NextResponse.json({ ok: true });
}
