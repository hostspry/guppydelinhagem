"use server";

import {
  listProductsLoja,
  type LojaFilters,
  type PublicProductCard,
} from "@/lib/queries/products";

/**
 * "Carregar mais" da vitrine: busca o próximo lote a partir de `skip`, com os
 * mesmos filtros da URL. O primeiro lote é SSR (indexável); este só serve os
 * adicionais que o cliente vai anexando.
 */
export async function loadMoreLojaProducts(
  filters: LojaFilters,
  skip: number,
): Promise<PublicProductCard[]> {
  const { items } = await listProductsLoja({ ...filters, skip });
  return items;
}
