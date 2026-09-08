import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  carrinhoTemCargaViva,
  cotarFreteSeco,
  volumesDoCarrinhoSeco,
} from "@/lib/shipping";
import { getTaxaEmbalagemSeco } from "@/lib/queries/config";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type ItemBody = { produtoId?: unknown; quantidade?: unknown };

/**
 * Cotação de frete do carrinho SECO (sem carga viva) para o checkout.
 *
 * O client manda só id + quantidade: peso, dimensões e tipo saem do banco, então
 * não dá para forjar um pacote leve e pagar frete de graça. Se algum item for
 * carga viva a rota recusa — esse carrinho vai pelo caminho do peixe (isopor,
 * Jadlog/aéreo), que continua em /api/frete.
 */
export async function POST(req: Request) {
  // Endpoint caro (chama Melhor Envio): 20 req/min por IP, igual /api/frete.
  const rl = rateLimit(`frete-seco:${clientIp(req.headers)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas requisições. Aguarde um instante e tente de novo." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { cepDestino?: unknown; itens?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const brutos = Array.isArray(body.itens) ? (body.itens as ItemBody[]) : [];
  const pedidos = brutos
    .map((it) => ({
      produtoId: typeof it.produtoId === "string" ? it.produtoId : "",
      quantidade: Math.max(1, Math.min(99, Math.round(Number(it.quantidade)) || 1)),
    }))
    .filter((it) => it.produtoId);

  if (pedidos.length === 0) {
    return NextResponse.json({ error: "Carrinho vazio." }, { status: 400 });
  }

  const produtos = await prisma.product.findMany({
    where: { id: { in: [...new Set(pedidos.map((p) => p.produtoId))] }, ativo: true },
    select: {
      id: true,
      tipo: true,
      preco: true,
      peso: true,
      comprimento: true,
      largura: true,
      altura: true,
    },
  });
  const pmap = new Map(produtos.map((p) => [p.id, p]));

  // Mesma linha comprada duas vezes (composições diferentes) soma quantidade:
  // o que importa aqui é quantas unidades físicas vão na caixa.
  const itens = pedidos.flatMap((it) => {
    const prod = pmap.get(it.produtoId);
    if (!prod) return [];
    return [
      {
        tipo: prod.tipo,
        quantidade: it.quantidade,
        pesoGramas: prod.peso == null ? null : Math.round(Number(prod.peso) * 1000),
        comprimento: prod.comprimento == null ? null : Number(prod.comprimento),
        largura: prod.largura == null ? null : Number(prod.largura),
        altura: prod.altura == null ? null : Number(prod.altura),
        valor: Number(prod.preco) * it.quantidade,
      },
    ];
  });

  if (itens.length === 0) {
    return NextResponse.json(
      { error: "Nenhum produto do carrinho está disponível." },
      { status: 400 },
    );
  }
  if (carrinhoTemCargaViva(itens)) {
    return NextResponse.json(
      { error: "Carrinho com carga viva: use a cotação de peixe." },
      { status: 400 },
    );
  }

  const [taxaEmbalagem, volumes] = [
    await getTaxaEmbalagemSeco(),
    volumesDoCarrinhoSeco(itens),
  ];
  const valorSegurado = itens.reduce((a, it) => a + it.valor, 0);

  const result = await cotarFreteSeco({
    cepDestino: String(body.cepDestino ?? ""),
    volumes,
    valorSegurado,
    taxaEmbalagem,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
