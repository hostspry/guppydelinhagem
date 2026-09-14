import "server-only";
import { prisma } from "@/lib/prisma";
import { chamarMl } from "./cliente";
import { estaEsgotado } from "@/lib/estoque";

/**
 * Manda para o Mercado Livre o estoque que o site tem.
 *
 * Direção única, igual à Shopee: a verdade do estoque é o site, porque é lá que
 * o dono cadastra o que entrou e é lá que os dois canais dão baixa. Sincronizar
 * nos dois sentidos abriria a porta para o marketplace sobrescrever um número
 * recém-corrigido no painel.
 *
 * O que segura venda dupla é a rapidez: vendeu no site, o estoque do anúncio cai
 * junto. A janela de risco é o intervalo entre a venda e esta chamada.
 */

export type ResumoEstoqueMl = {
  enviados: number;
  semMudanca: number;
  erros: string[];
};

/** O ML recusa estoque negativo. Pool negativo no site vira zero lá. */
const paraMl = (estoque: number) => Math.max(0, Math.trunc(estoque));

/**
 * Quanto este produto tem para vender no marketplace.
 *
 * Peixe é contado pelo POOL (machos + fêmeas), não pelo campo `estoque`, que no
 * peixe é só espelho. Sem isso, anúncio de guppy ficaria sempre zerado no ML.
 */
function disponivel(p: {
  tipo: string;
  estoque: number;
  estoqueMachos: number;
  estoqueFemeas: number;
}): number {
  if (p.tipo === "PEIXE") return p.estoqueMachos + p.estoqueFemeas;
  return p.estoque;
}

/**
 * Escreve o estoque de um anúncio.
 *
 * Anúncio com variação exige mandar TODAS as variações na mesma chamada: o que
 * não vier na lista o ML entende como zero, e um anúncio inteiro iria a zero por
 * causa de uma variação omitida. Por isso só mexemos na variação ligada quando
 * conseguimos ler a lista completa do anúncio antes.
 */
async function enviarUm(anuncio: {
  id: string;
  itemId: string;
  variationId: string | null;
  estoque: number;
}): Promise<string | null> {
  const quantidade = paraMl(anuncio.estoque);

  let corpo: Record<string, unknown>;
  if (anuncio.variationId) {
    const atual = await chamarMl<{
      variations?: { id: number | string; available_quantity?: number }[];
    }>(`/items/${anuncio.itemId}?attributes=variations`);
    if (!atual.ok) return `${anuncio.itemId}: ${atual.erro}`;

    const variacoes = atual.dados?.variations ?? [];
    if (variacoes.length === 0) {
      return `${anuncio.itemId}: o anúncio não tem mais variações. Refaça a ligação.`;
    }
    corpo = {
      variations: variacoes.map((v) => ({
        id: v.id,
        available_quantity:
          String(v.id) === anuncio.variationId
            ? quantidade
            : (v.available_quantity ?? 0),
      })),
    };
  } else {
    corpo = { available_quantity: quantidade };
  }

  const r = await chamarMl(`/items/${anuncio.itemId}`, {
    method: "PUT",
    body: corpo,
  });
  if (!r.ok) return `${anuncio.itemId}: ${r.erro}`;

  await prisma.mercadoLivreAnuncio.update({
    where: { id: anuncio.id },
    data: {
      estoqueEnviado: quantidade,
      sincronizadoEm: new Date(),
      ultimoErro: null,
    },
  });
  return null;
}

/**
 * Empurra o estoque dos anúncios ligados. Sem `productIds`, varre todos.
 * Pula quem já está com o número certo lá — chamada à toa gasta cota da API.
 */
export async function sincronizarEstoqueMl(
  productIds?: string[],
): Promise<ResumoEstoqueMl> {
  const resumo: ResumoEstoqueMl = { enviados: 0, semMudanca: 0, erros: [] };

  const cfg = await prisma.integracaoMercadoLivre.findUnique({
    where: { id: "default" },
    select: { ativo: true, sellerId: true },
  });
  if (!cfg?.ativo || !cfg.sellerId) return resumo;

  const anuncios = await prisma.mercadoLivreAnuncio.findMany({
    where: productIds?.length ? { productId: { in: productIds } } : {},
    select: {
      id: true,
      itemId: true,
      variationId: true,
      estoqueEnviado: true,
      product: {
        select: {
          tipo: true,
          estoque: true,
          estoqueMachos: true,
          estoqueFemeas: true,
        },
      },
    },
  });

  for (const a of anuncios) {
    const estoque = disponivel(a.product);
    if (a.estoqueEnviado === paraMl(estoque)) {
      resumo.semMudanca += 1;
      continue;
    }
    const erro = await enviarUm({
      id: a.id,
      itemId: a.itemId,
      variationId: a.variationId,
      estoque,
    });
    if (erro) {
      resumo.erros.push(erro);
      await prisma.mercadoLivreAnuncio
        .update({ where: { id: a.id }, data: { ultimoErro: erro.slice(0, 300) } })
        .catch(() => {});
    } else {
      resumo.enviados += 1;
    }
  }

  return resumo;
}

/**
 * Empurra o estoque dos produtos de um pedido que acabou de ser pago.
 *
 * Nunca lança: é chamado de webhook de pagamento, e marketplace fora do ar não
 * pode derrubar a confirmação de uma venda que já entrou.
 */
export async function empurrarEstoqueMlDoPedido(orderId: string): Promise<void> {
  try {
    const itens = await prisma.orderItem.findMany({
      where: { orderId, productId: { not: null } },
      select: { productId: true },
    });
    const ids = [
      ...new Set(itens.map((i) => i.productId).filter((i): i is string => !!i)),
    ];
    if (ids.length === 0) return;

    const ligados = await prisma.mercadoLivreAnuncio.count({
      where: { productId: { in: ids } },
    });
    if (ligados === 0) return; // nada deste pedido está no ML

    await sincronizarEstoqueMl(ids);
  } catch (e) {
    console.error("[ml] empurrar estoque do pedido", e);
  }
}

/** Reexporta para quem só quer saber se o produto acabou (mesma regra do site). */
export { estaEsgotado };
