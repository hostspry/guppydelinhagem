import "server-only";
import { prisma } from "@/lib/prisma";
import { montarAnuncio, conferirDescricao, LISTING_TYPE, ehTipoAnuncio } from "./publicar";
import { salvarDescricaoAnuncio } from "./anuncio";

/**
 * Grava no ML a descrição que o site monta hoje para o anúncio: apresentação
 * da loja, texto do produto, envio, licença, regra da segunda e garantia.
 *
 * Fica em lib, e não no arquivo de actions: exportado de um "use server", viraria
 * uma action chamável pelo navegador sem checagem de permissão. Quem chama
 * (as actions) confere a permissão antes.
 */
export async function aplicarDescricaoDoSite(
  anuncioId: string,
): Promise<{ ok: true; itemId: string } | { ok: false; erro: string }> {
  const a = await prisma.mercadoLivreAnuncio.findUnique({
    where: { id: anuncioId },
    select: { itemId: true, productId: true, composicao: true, tipoAnuncio: true },
  });
  if (!a) return { ok: false, erro: "Anúncio não encontrado." };

  const montado = await montarAnuncio({
    productId: a.productId,
    composicao: a.composicao,
    tipoAnuncio: a.tipoAnuncio && ehTipoAnuncio(a.tipoAnuncio) ? a.tipoAnuncio : LISTING_TYPE,
  });
  if (!montado.ok) return { ok: false, erro: `${a.itemId}: ${montado.erro}` };

  const cfg = await prisma.integracaoMercadoLivre.findUnique({
    where: { id: "default" },
    select: { licencaIbama: true },
  });
  const erro = conferirDescricao(
    montado.dados.descricao,
    montado.dados.ehPeixe ? (cfg?.licencaIbama ?? null) : null,
  );
  if (erro) return { ok: false, erro: `${a.itemId}: ${erro}` };

  const r = await salvarDescricaoAnuncio(a.itemId, montado.dados.descricao);
  if (!r.ok) return { ok: false, erro: `${a.itemId}: ${r.erro}` };
  return { ok: true, itemId: a.itemId };
}
