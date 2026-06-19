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
};

/**
 * Configurações globais da loja (singleton). Se a linha ainda não existe, devolve
 * os defaults (sem desconto global, sem frete grátis). Leitura leve — usada pelo
 * checkout e admin. Decimal→number (não serializa pra Client Component).
 */
export async function getConfiguracaoLoja(): Promise<ConfiguracaoLojaData> {
  const c = await prisma.configuracaoLoja.findUnique({
    where: { id: DEFAULT_ID },
    select: {
      descontoPixGlobalPercent: true,
      freteGratisAtivo: true,
      freteGratisAcimaDe: true,
    },
  });
  return {
    descontoPixGlobalPercent: c?.descontoPixGlobalPercent ?? 0,
    freteGratisAtivo: c?.freteGratisAtivo ?? false,
    freteGratisAcimaDe:
      c?.freteGratisAcimaDe == null ? null : Number(c.freteGratisAcimaDe),
  };
}

/**
 * Só a regra de frete grátis (toggle + valor). Usada na faixa do topo (Navbar),
 * no checkout (exibição) e no servidor (zerar o frete). Frete grátis só "vale"
 * se ativo E com um valor definido.
 */
export async function getFreteGratisConfig(): Promise<FreteGratisConfig> {
  const c = await prisma.configuracaoLoja.findUnique({
    where: { id: DEFAULT_ID },
    select: { freteGratisAtivo: true, freteGratisAcimaDe: true },
  });
  const acimaDe =
    c?.freteGratisAcimaDe == null ? null : Number(c.freteGratisAcimaDe);
  return { ativo: (c?.freteGratisAtivo ?? false) && acimaDe != null, acimaDe };
}

/** Atalho tipado p/ o helper de preço (lib/precos). */
export async function getConfigPreco(): Promise<ConfigPreco> {
  const { descontoPixGlobalPercent } = await getConfiguracaoLoja();
  return { descontoPixGlobalPercent };
}
