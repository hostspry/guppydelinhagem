import "server-only";
import { prisma } from "@/lib/prisma";
import { chamarMl } from "./cliente";
import { proximoEnvioPeixe } from "@/lib/envio-peixe";

/**
 * Prazo de envio do peixe no anúncio do ML.
 *
 * O peixe sai só na segunda (lib/envio-peixe). O ML tem um campo para isso, a
 * "Disponibilidade de estoque" (MANUFACTURING_TIME, em dias): o comprador vê
 * antes de comprar em quantos dias o pedido sai. Com ele preenchido, esperar a
 * segunda deixa de ser atraso e passa a ser o prazo que o anúncio prometeu.
 *
 * O número muda todo dia (compra na terça espera 6 dias, no sábado espera 2),
 * então o cron reescreve. Só manda quando mudou, para não gastar cota.
 */

/** O ML aceita até 45 dias nesse campo. */
const MAX_DIAS = 45;

export function prazoMl(agora = new Date()): number {
  return Math.min(MAX_DIAS, Math.max(1, proximoEnvioPeixe(agora).dias));
}

export function saleTermPrazo(dias: number) {
  return { id: "MANUFACTURING_TIME", value_name: `${dias} dias` };
}

export type ResumoPrazo = { atualizados: number; semMudanca: number; erros: string[] };

export async function sincronizarPrazoEnvioMl(agora = new Date()): Promise<ResumoPrazo> {
  const resumo: ResumoPrazo = { atualizados: 0, semMudanca: 0, erros: [] };
  const dias = prazoMl(agora);

  const anuncios = await prisma.mercadoLivreAnuncio.findMany({
    where: { product: { tipo: "PEIXE" } },
    select: { id: true, itemId: true, prazoEnvioDias: true },
  });

  for (const a of anuncios) {
    if (a.prazoEnvioDias === dias) {
      resumo.semMudanca += 1;
      continue;
    }
    const r = await chamarMl(`/items/${a.itemId}`, {
      method: "PUT",
      body: { sale_terms: [saleTermPrazo(dias)] },
    });
    if (!r.ok) {
      const erro = `${a.itemId}: prazo de envio: ${r.erro}`;
      resumo.erros.push(erro);
      await prisma.mercadoLivreAnuncio
        .update({ where: { id: a.id }, data: { ultimoErro: erro.slice(0, 300) } })
        .catch(() => {});
      continue;
    }
    await prisma.mercadoLivreAnuncio.update({
      where: { id: a.id },
      data: { prazoEnvioDias: dias },
    });
    resumo.atualizados += 1;
  }
  return resumo;
}
