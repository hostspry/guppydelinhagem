import { cache } from "react";
import { prisma } from "../prisma";
import type { ConfigPreco } from "../precos";

const DEFAULT_ID = "default";

export type FreteGratisConfig = {
  ativo: boolean;
  acimaDe: number | null; // R$ — subtotal mínimo (preço cheio) p/ frete grátis
};

export type ConfiguracaoLojaData = {
  descontoPixGlobalPercent: number;
  freteGratisAtivo: boolean;
  freteGratisAcimaDe: number | null;
  maxPeixesFreteAuto: number;
  tarjaAtiva: boolean;
  tarjaTexto: string | null;
};

/**
 * Configurações globais da loja (singleton). Se a linha ainda não existe, devolve
 * os defaults (sem desconto global, sem frete grátis). Leitura leve — usada pelo
 * checkout e admin. Decimal→number (não serializa pra Client Component).
 */
// cache() dedup por request: Navbar (layout) + checkout/cards leem config no mesmo
// request sem repetir a consulta. NÃO persiste entre requests, então a revalidação
// via admin (revalidatePath já existente) continua válida.
export const getConfiguracaoLoja = cache(
  async (): Promise<ConfiguracaoLojaData> => {
    const c = await prisma.configuracaoLoja.findUnique({
      where: { id: DEFAULT_ID },
      select: {
        descontoPixGlobalPercent: true,
        freteGratisAtivo: true,
        freteGratisAcimaDe: true,
        maxPeixesFreteAuto: true,
        tarjaAtiva: true,
        tarjaTexto: true,
      },
    });
    return {
      descontoPixGlobalPercent: c?.descontoPixGlobalPercent ?? 0,
      freteGratisAtivo: c?.freteGratisAtivo ?? false,
      freteGratisAcimaDe:
        c?.freteGratisAcimaDe == null ? null : Number(c.freteGratisAcimaDe),
      maxPeixesFreteAuto: c?.maxPeixesFreteAuto ?? 10,
      tarjaAtiva: c?.tarjaAtiva ?? false,
      tarjaTexto: c?.tarjaTexto ?? null,
    };
  },
);

/**
 * Só a regra de frete grátis (toggle + valor). Usada na faixa do topo (Navbar),
 * no checkout (exibição) e no servidor (zerar o frete). Frete grátis só "vale"
 * se ativo E com um valor definido.
 */
export async function getFreteGratisConfig(): Promise<FreteGratisConfig> {
  // Reusa a leitura cacheada (mesma consulta da Navbar/checkout no request).
  const c = await getConfiguracaoLoja();
  return {
    ativo: c.freteGratisAtivo && c.freteGratisAcimaDe != null,
    acimaDe: c.freteGratisAcimaDe,
  };
}

/** Limite de peixes para cotação automática de frete (acima → WhatsApp). */
export async function getMaxPeixesFreteAuto(): Promise<number> {
  const c = await getConfiguracaoLoja();
  return c.maxPeixesFreteAuto;
}

/** Atalho tipado p/ o helper de preço (lib/precos). */
export async function getConfigPreco(): Promise<ConfigPreco> {
  const { descontoPixGlobalPercent } = await getConfiguracaoLoja();
  return { descontoPixGlobalPercent };
}
