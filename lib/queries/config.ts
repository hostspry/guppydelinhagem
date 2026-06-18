import { prisma } from "../prisma";
import type { ConfigPreco } from "../precos";

const DEFAULT_ID = "default";

export type ConfiguracaoLojaData = {
  descontoPixGlobalPercent: number;
};

/**
 * Configurações globais da loja (singleton). Se a linha ainda não existe, devolve
 * os defaults (sem desconto global). Leitura leve — usada pelo checkout e admin.
 */
export async function getConfiguracaoLoja(): Promise<ConfiguracaoLojaData> {
  const c = await prisma.configuracaoLoja.findUnique({
    where: { id: DEFAULT_ID },
    select: { descontoPixGlobalPercent: true },
  });
  return { descontoPixGlobalPercent: c?.descontoPixGlobalPercent ?? 0 };
}

/** Atalho tipado p/ o helper de preço (lib/precos). */
export async function getConfigPreco(): Promise<ConfigPreco> {
  const { descontoPixGlobalPercent } = await getConfiguracaoLoja();
  return { descontoPixGlobalPercent };
}
