import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { registrarFalhaCartao } from "@/lib/pagamento-tentativas";

export const dynamic = "force-dynamic";

/**
 * Recebe do navegador as falhas de cartão que NÃO chegam ao gateway: o SDK que
 * não carregou, o formulário que recusou os dados, a cobrança que nem saiu.
 *
 * É rota HTTP, e não Server Action, de propósito. Um dos jeitos de a compra
 * morrer é justamente a action não resolver (deploy no meio da sessão do
 * cliente, rede caindo) — se o aviso dependesse do mesmo caminho, ele falharia
 * exatamente quando mais importa. A URL é estável e aceita sendBeacon/keepalive.
 *
 * Nunca recebe dado de cartão: número e CVV ficam no iframe do gateway.
 */
export async function POST(req: Request) {
  // Público (o checkout é guest). Limite folgado para gente e apertado para
  // script: ninguém erra o cartão 15 vezes em um minuto.
  const rl = rateLimit(`falha-cartao:${clientIp(req.headers)}`, 15, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: {
    etapa?: string;
    mensagem?: string;
    valor?: number;
    deviceOk?: boolean;
    email?: string;
    telefone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // A etapa vem do cliente: normaliza para os valores possíveis em vez de
  // confiar no que chegou. COBRANCA aqui é a cobrança que nem chegou a rodar no
  // servidor (a chamada morreu antes de responder).
  const etapa =
    body.etapa === "SDK"
      ? "SDK"
      : body.etapa === "COBRANCA"
        ? "COBRANCA"
        : "FORMULARIO";
  const valor = Number(body.valor);

  await registrarFalhaCartao({
    etapa,
    provider: "MERCADO_PAGO",
    mensagem: String(body.mensagem ?? "(sem mensagem)"),
    valor: Number.isFinite(valor) && valor > 0 ? valor : null,
    deviceOk: body.deviceOk === true,
    email: typeof body.email === "string" ? body.email : null,
    telefone: typeof body.telefone === "string" ? body.telefone : null,
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
