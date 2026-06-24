import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { estaEsgotado } from "@/lib/estoque";
import {
  precoComCampanha,
  type CampanhaInfo,
  type CampanhaProduto,
} from "@/lib/campanha-core";

// Camada de CAMPANHA (cupom que auto-aplica e aparece na vitrine). Envolve por fora
// de lib/precos (puro). Reusa estaEsgotado (pool) e a fórmula pura de campanha-core.

// Cupom CAMPANHA vigente com escopo + estoque do escopo carregados.
type CampanhaVigente = {
  id: string;
  codigo: string;
  tipoValor: "PERCENTUAL" | "VALOR_FIXO";
  valor: number;
  escopo: "TODOS" | "CATEGORIAS" | "PRODUTOS";
  precoUnico: boolean;
  encerraAoEsgotarEstoque: boolean;
  categoriaIds: string[];
  produtoIds: string[];
  estoqueEscopo: { estoqueMachos: number; estoqueFemeas: number }[];
};

// Produto candidato a receber campanha (preço cheio + Pix já resolvidos).
export type ProdutoParaCampanha = {
  id: string;
  categoryId: string;
  precoCheio: number;
  descontoPixPercent: number;
  estoqueMachos: number;
  estoqueFemeas: number;
};

/**
 * Campanhas vigentes (tipo CAMPANHA, ativo, dentro da janela de datas e do limite
 * de usos). Cacheado por request — resolve 1× e reusa em home/loja/produto.
 */
export const getCampanhasVigentes = cache(
  async (): Promise<CampanhaVigente[]> => {
    const agora = new Date();
    const rows = await prisma.cupomDesconto.findMany({
      where: {
        tipoCupom: "CAMPANHA",
        ativo: true,
        AND: [
          { OR: [{ validoDe: null }, { validoDe: { lte: agora } }] },
          { OR: [{ validoAte: null }, { validoAte: { gte: agora } }] },
        ],
      },
      select: {
        id: true,
        codigo: true,
        tipoValor: true,
        valor: true,
        escopo: true,
        precoUnicoNaCampanha: true,
        encerraAoEsgotarEstoque: true,
        limiteUsos: true,
        usosRealizados: true,
        categorias: {
          select: {
            id: true,
            produtos: { select: { estoqueMachos: true, estoqueFemeas: true } },
          },
        },
        produtos: {
          select: { id: true, estoqueMachos: true, estoqueFemeas: true },
        },
      },
    });

    return rows
      .filter((c) => c.limiteUsos == null || c.usosRealizados < c.limiteUsos)
      .map((c) => ({
        id: c.id,
        codigo: c.codigo,
        tipoValor: c.tipoValor,
        valor: Number(c.valor),
        escopo: c.escopo,
        precoUnico: c.precoUnicoNaCampanha,
        encerraAoEsgotarEstoque: c.encerraAoEsgotarEstoque,
        categoriaIds: c.categorias.map((x) => x.id),
        produtoIds: c.produtos.map((x) => x.id),
        estoqueEscopo:
          c.escopo === "PRODUTOS"
            ? c.produtos.map((p) => ({
                estoqueMachos: p.estoqueMachos,
                estoqueFemeas: p.estoqueFemeas,
              }))
            : c.escopo === "CATEGORIAS"
              ? c.categorias.flatMap((cat) => cat.produtos)
              : [],
      }));
  },
);

function cobreProduto(
  c: CampanhaVigente,
  p: { id: string; categoryId: string },
): boolean {
  if (c.escopo === "TODOS") return true;
  if (c.escopo === "CATEGORIAS") return c.categoriaIds.includes(p.categoryId);
  return c.produtoIds.includes(p.id);
}

// Campanha "encerra ao esgotar estoque" só vale se algum produto do escopo ainda
// tem estoque (pool machos+fêmeas). Sem essa flag, sempre vale.
function temEstoque(c: CampanhaVigente): boolean {
  if (!c.encerraAoEsgotarEstoque) return true;
  return c.estoqueEscopo.some((p) => !estaEsgotado(p));
}

// Entre as campanhas aplicáveis a um produto, a de MAIOR desconto no preço cheio.
function melhorCampanha(
  campanhas: CampanhaVigente[],
  p: ProdutoParaCampanha,
): CampanhaVigente | null {
  let melhor: CampanhaVigente | null = null;
  let melhorAbatimento = 0;
  for (const c of campanhas) {
    if (!cobreProduto(c, p) || !temEstoque(c)) continue;
    const { precoPromoCheio } = precoComCampanha(p.precoCheio, p.descontoPixPercent, {
      tipoValor: c.tipoValor,
      valor: c.valor,
      precoUnico: c.precoUnico,
    });
    const abatimento = p.precoCheio - precoPromoCheio;
    if (abatimento > melhorAbatimento) {
      melhorAbatimento = abatimento;
      melhor = c;
    }
  }
  return melhorAbatimento > 0 ? melhor : null;
}

/** Descritor (CampanhaInfo) da campanha vencedora de um produto, ou null. */
export async function resolverCampanhaInfo(
  p: ProdutoParaCampanha,
): Promise<CampanhaInfo | null> {
  const campanhas = await getCampanhasVigentes();
  const c = melhorCampanha(campanhas, p);
  if (!c) return null;
  return {
    cupomId: c.id,
    codigo: c.codigo,
    tipoValor: c.tipoValor,
    valor: c.valor,
    precoUnico: c.precoUnico,
  };
}

/**
 * Resolve a campanha vencedora de cada produto e já calcula o preço promocional.
 * Retorna um Map id→CampanhaProduto (só pros produtos com campanha). Decimais já
 * convertidos. Usado pelas queries de card (home/loja).
 */
export async function resolverCampanhas(
  itens: ProdutoParaCampanha[],
): Promise<Map<string, CampanhaProduto>> {
  const map = new Map<string, CampanhaProduto>();
  if (itens.length === 0) return map;
  const campanhas = await getCampanhasVigentes();
  if (campanhas.length === 0) return map;

  for (const p of itens) {
    const c = melhorCampanha(campanhas, p);
    if (!c) continue;
    const promo = precoComCampanha(p.precoCheio, p.descontoPixPercent, {
      tipoValor: c.tipoValor,
      valor: c.valor,
      precoUnico: c.precoUnico,
    });
    map.set(p.id, {
      cupomId: c.id,
      codigo: c.codigo,
      tipoValor: c.tipoValor,
      valor: c.valor,
      precoUnico: c.precoUnico,
      ...promo,
    });
  }
  return map;
}
