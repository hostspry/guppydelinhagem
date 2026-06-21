import { NextResponse } from "next/server";
import { FRETE_CONFIG, calcularPesoECaixa, cotarFrete } from "@/lib/shipping";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Endpoint caro (chama Melhor Envio): 20 req/min por IP.
  const rl = rateLimit(`frete:${clientIp(req.headers)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas requisições. Aguarde um instante e tente de novo." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { cepDestino?: string; qtd?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // Com `qtd` (página de produto) → peso/caixa pela tabela. Sem `qtd` (/frete,
  // calculadora genérica) → pacote padrão legado, sem mudar o comportamento.
  const qtd = Number(body.qtd);
  const { pesoGramas, caixa } =
    Number.isFinite(qtd) && qtd >= 1
      ? calcularPesoECaixa(qtd)
      : {
          pesoGramas: FRETE_CONFIG.pacotePadrao.weight * 1000,
          caixa: {
            comprimento: FRETE_CONFIG.pacotePadrao.length,
            largura: FRETE_CONFIG.pacotePadrao.width,
            altura: FRETE_CONFIG.pacotePadrao.height,
          },
        };

  const result = await cotarFrete({
    cepDestino: String(body.cepDestino ?? ""),
    pesoGramas,
    caixa,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
