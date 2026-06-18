import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Rota de DIAGNÓSTICO do Mercado Pago (temporária; remover após resolver).
// Admin-only. NÃO expõe segredos — só prefixo (APP_USR/TEST/UNDEFINED) + o HTTP
// do GET /v1/payment_methods (200 = token de produção válido; 401 = inválido/
// ambiente errado). Não cria pagamento, não cobra nada.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function prefixo(v: string | undefined): string {
  if (!v) return "UNDEFINED";
  return `${v.split("-")[0]}- (len ${v.length})`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role === "CUSTOMER") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.MP_ACCESS_TOKEN;

  // GET sem cobrança: valida o token de produção contra a API do MP.
  let paymentMethodsStatus: number | string = "no-token";
  if (token) {
    try {
      const resp = await fetch(
        "https://api.mercadopago.com/v1/payment_methods",
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      paymentMethodsStatus = resp.status;
    } catch {
      paymentMethodsStatus = "fetch-error";
    }
  }

  const result = {
    accessTokenPrefix: prefixo(token), // server
    // OBS: este é o valor de RUNTIME no server; o que chega ao CLIENT é o
    // inlinado em BUILD-TIME — confira no console do navegador no /checkout
    // ("[mp] NEXT_PUBLIC_MP_PUBLIC_KEY: …").
    publicKeyPrefixRuntime: prefixo(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY),
    paymentMethodsStatus, // 200 = token de produção válido
  };
  console.log("[diag] mercadopago", result);
  return NextResponse.json(result);
}
