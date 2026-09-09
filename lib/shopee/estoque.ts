import "server-only";
import { prisma } from "@/lib/prisma";
import { chamarShopee } from "./cliente";

/**
 * Manda para a Shopee o estoque que o site tem.
 *
 * Direção única, e de propósito: a verdade do estoque é o site, porque é lá que
 * o dono cadastra o que entrou e é lá que os dois canais dão baixa (a venda da
 * Shopee entra como pedido e baixa igual). Sincronizar nos dois sentidos abriria
 * a porta para a Shopee sobrescrever um número recém-corrigido no painel.
 *
 * O que segura venda dupla é a rapidez: vendeu no site, o estoque da Shopee cai
 * junto. A janela de risco é o intervalo entre a venda e esta chamada.
 */

export type ResumoEstoque = {
  enviados: number;
  semMudanca: number;
  erros: string[];
};

/** A Shopee recusa estoque negativo. Site com pool negativo vira zero lá. */
const paraShopee = (estoque: number) => Math.max(0, Math.trunc(estoque));

type RespostaEstoque = {
  failure_list?: { model_id?: number; failed_reason?: string }[];
};

/**
 * Escreve o estoque de um anúncio.
 *
 * A Shopee separa estoque "de vitrine" (seller_stock) do reservado em campanha.
 * Escrevemos só o de vitrine — mexer no resto desfaria promoção que o dono
 * montou no painel dela.
 */
async function enviarUm(anuncio: {
  id: string;
  itemId: string;
  modelId: string | null;
  estoque: number;
}): Promise<string | null> {
  const stockList = [
    {
      ...(anuncio.modelId ? { model_id: Number(anuncio.modelId) } : {}),
      seller_stock: [{ stock: paraShopee(anuncio.estoque) }],
    },
  ];

  const r = await chamarShopee<RespostaEstoque>("/api/v2/product/update_stock", {
    corpo: { item_id: Number(anuncio.itemId), stock_list: stockList },
  });

  if (!r.ok) return r.erro;

  // A Shopee aceita a chamada (sem `error`) e recusa item a item dentro dela.
  // Sem olhar isso, um anúncio bloqueado apareceria como sincronizado para
  // sempre — e o dono confiaria num número que nunca foi escrito.
  const falha = r.dados.failure_list?.[0];
  if (falha) return falha.failed_reason ?? "A Shopee recusou este anúncio.";
  return null;
}

/**
 * Sincroniza os anúncios ligados.
 *
 * `apenasProdutos` limita a uma venda recém-feita — é o caminho chamado logo
 * depois do pagamento, para o estoque da Shopee cair em segundos e não na
 * próxima rodada do cron. Sem ele, varre todos.
 */
export async function sincronizarEstoqueShopee(
  apenasProdutos?: string[],
): Promise<ResumoEstoque> {
  const resumo: ResumoEstoque = { enviados: 0, semMudanca: 0, erros: [] };

  const cfg = await prisma.integracaoShopee.findUnique({
    where: { id: "default" },
    select: { ativo: true },
  });
  if (!cfg?.ativo) return resumo;

  const anuncios = await prisma.shopeeAnuncio.findMany({
    where: apenasProdutos?.length ? { productId: { in: apenasProdutos } } : {},
    select: {
      id: true,
      itemId: true,
      modelId: true,
      estoqueEnviado: true,
      product: { select: { estoque: true, nome: true } },
    },
  });

  for (const a of anuncios) {
    const alvo = paraShopee(a.product.estoque);
    // Já está escrito lá: não gasta chamada. A Shopee tem limite por minuto, e
    // varrer o catálogo inteiro à toa comeria a cota que a venda vai precisar.
    if (a.estoqueEnviado === alvo) {
      resumo.semMudanca++;
      continue;
    }

    const erro = await enviarUm({
      id: a.id,
      itemId: a.itemId,
      modelId: a.modelId,
      estoque: alvo,
    });

    await prisma.shopeeAnuncio.update({
      where: { id: a.id },
      data: erro
        ? { ultimoErro: erro }
        : { estoqueEnviado: alvo, sincronizadoEm: new Date(), ultimoErro: null },
    });

    if (erro) resumo.erros.push(`${a.product.nome}: ${erro}`);
    else resumo.enviados++;
  }

  return resumo;
}

/**
 * Empurra o estoque dos produtos de um pedido que acabou de ser pago no site.
 *
 * Não lança e não espera: é conveniência em cima de uma venda que já aconteceu.
 * Se a Shopee estiver fora do ar, o cron corrige na próxima rodada — o que não
 * pode é a confirmação do pagamento falhar porque um marketplace caiu.
 */
export async function empurrarEstoqueDoPedido(orderId: string): Promise<void> {
  try {
    const itens = await prisma.orderItem.findMany({
      where: { orderId, productId: { not: null } },
      select: { productId: true },
    });
    const ids = [...new Set(itens.map((i) => i.productId).filter((i): i is string => !!i))];
    if (ids.length === 0) return;

    const ligados = await prisma.shopeeAnuncio.count({
      where: { productId: { in: ids } },
    });
    if (ligados === 0) return; // nada deste pedido está na Shopee

    await sincronizarEstoqueShopee(ids);
  } catch (e) {
    console.error("[shopee] empurrar estoque do pedido", e);
  }
}
