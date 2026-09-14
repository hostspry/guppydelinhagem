import "server-only";
import { chamarMl, type MlResult } from "./cliente";

/**
 * Preço do anúncio que não come a margem.
 *
 * O Mercado Livre desconta a comissão do valor da venda, então anunciar pelo
 * preço do site significa receber menos do que o site receberia. O que a gente
 * quer é o contrário: fixar o LÍQUIDO (o preço do site) e subir o anunciado até
 * que, tirada a comissão, sobre exatamente aquilo.
 *
 *   anunciado − (anunciado × percentual + fixo) = líquido
 *   anunciado = (líquido + fixo) / (1 − percentual)
 *
 * A tarifa vem da API do ML por categoria e tipo de anúncio, nunca de número
 * decorado: ela muda por categoria (peixe é 12,5% no Clássico e 17,5% no
 * Premium, medido em 2026-09-14) e o ML mexe nisso quando quer.
 */

export type Tarifa = {
  /** Fração, não porcentagem: 0.125 para 12,5%. */
  percentual: number;
  fixo: number;
  /** Rótulo do tipo de anúncio ("Clássico", "Premium"), para a tela explicar. */
  tipoNome: string;
};

type RespostaPreco = {
  listing_type_id?: string;
  listing_type_name?: string;
  sale_fee_amount?: number;
  sale_fee_details?: { percentage_fee?: number; fixed_fee?: number };
};

/**
 * Tarifa de venda da categoria. Consulta com um preço de referência porque o ML
 * tem faixas — passamos o preço que se pretende anunciar para cair na faixa certa.
 */
export async function tarifaMl(params: {
  categoriaId: string;
  listingTypeId: string;
  precoReferencia: number;
}): Promise<MlResult<Tarifa>> {
  const preco = Math.max(1, Number(params.precoReferencia) || 1);
  const r = await chamarMl<RespostaPreco[]>(
    `/sites/MLB/listing_prices?price=${preco.toFixed(2)}&category_id=${encodeURIComponent(params.categoriaId)}`,
  );
  if (!r.ok) return r;

  const linha = (r.dados ?? []).find(
    (x) => x.listing_type_id === params.listingTypeId,
  );
  if (!linha) {
    return { ok: false, erro: `O ML não devolveu tarifa para ${params.listingTypeId}.` };
  }

  const d = linha.sale_fee_details ?? {};
  // `percentage_fee` vem como 12.5 (porcento), não 0.125.
  const percentual = Number(d.percentage_fee ?? 0) / 100;
  const fixo = Number(d.fixed_fee ?? 0);

  if (!(percentual >= 0 && percentual < 0.9)) {
    return { ok: false, erro: "Tarifa do ML veio num formato que não reconheço." };
  }

  return {
    ok: true,
    dados: {
      percentual,
      fixo,
      tipoNome: linha.listing_type_name ?? params.listingTypeId,
    },
  };
}

/** Sobe o preço até que o líquido depois da comissão seja o valor desejado. */
export function precoParaLiquido(liquido: number, tarifa: Tarifa): number {
  const bruto = (liquido + tarifa.fixo) / (1 - tarifa.percentual);
  // Arredonda para CIMA no centavo: para baixo devolveria um líquido um tico
  // menor que o pedido, que é exatamente o que se quer evitar.
  return Math.ceil(bruto * 100) / 100;
}

/** Quanto sobra de um preço anunciado, depois da comissão. */
export function liquidoDoPreco(bruto: number, tarifa: Tarifa): number {
  const comissao = bruto * tarifa.percentual + tarifa.fixo;
  return Math.round((bruto - comissao) * 100) / 100;
}

export type SugestaoPreco = {
  /** O que o site cobra — é o líquido que se quer preservar. */
  precoSite: number;
  /** O que anunciar no ML para receber o preço do site. */
  precoSugerido: number;
  comissao: number;
  percentual: number;
  fixo: number;
  tipoNome: string;
};

export async function sugerirPreco(params: {
  categoriaId: string;
  listingTypeId: string;
  precoSite: number;
}): Promise<MlResult<SugestaoPreco>> {
  // Duas passadas: a primeira estima a faixa, a segunda confirma a tarifa no
  // preço que vai mesmo ser anunciado (faixa de tarifa muda com o valor).
  const primeira = await tarifaMl({
    categoriaId: params.categoriaId,
    listingTypeId: params.listingTypeId,
    precoReferencia: params.precoSite,
  });
  if (!primeira.ok) return primeira;

  const estimado = precoParaLiquido(params.precoSite, primeira.dados);

  const segunda = await tarifaMl({
    categoriaId: params.categoriaId,
    listingTypeId: params.listingTypeId,
    precoReferencia: estimado,
  });
  const tarifa = segunda.ok ? segunda.dados : primeira.dados;
  const precoSugerido = precoParaLiquido(params.precoSite, tarifa);

  return {
    ok: true,
    dados: {
      precoSite: params.precoSite,
      precoSugerido,
      comissao: Math.round((precoSugerido * tarifa.percentual + tarifa.fixo) * 100) / 100,
      percentual: tarifa.percentual,
      fixo: tarifa.fixo,
      tipoNome: tarifa.tipoNome,
    },
  };
}
