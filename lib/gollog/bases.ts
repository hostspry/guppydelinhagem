import "server-only";
import { BASES_GOLLOG_DADOS } from "./bases-dados";
import { coordenadaDaCidade, distanciaKm, normalizarCidade } from "@/lib/geo/municipios";

export type BaseGollog = (typeof BASES_GOLLOG_DADOS)[number];

/** O que a página e o painel recebem: sem coordenada, com a distância pronta. */
export type BaseComDistancia = {
  iata: string;
  cidade: string;
  uf: string;
  aeroporto: string;
  endereco: string;
  horario: string;
  telefone: string;
  noAeroporto: boolean;
  /** Distância em linha reta da cidade do cliente. null = cidade não localizada. */
  km: number | null;
  /** A base fica na cidade do cliente (ou numa das cidades que o aeroporto serve). */
  naCidade: boolean;
};

export function baseGollog(iata: string | null | undefined): BaseGollog | null {
  const alvo = (iata ?? "").trim().toUpperCase();
  return BASES_GOLLOG_DADOS.find((b) => b.iata === alvo) ?? null;
}

const atende = (b: BaseGollog, cidade: string, uf: string) =>
  b.uf === uf && b.cidades.some((c) => normalizarCidade(c) === cidade);

/**
 * Todas as bases, da mais perto para a mais longe da cidade do cliente. Sem
 * cidade reconhecida, sai em ordem de estado e cidade.
 */
export function basesPorDistancia(
  cidade: string | null | undefined,
  uf: string | null | undefined,
): BaseComDistancia[] {
  const origem = coordenadaDaCidade(cidade, uf);
  const cid = normalizarCidade(cidade ?? "");
  const u = (uf ?? "").trim().toUpperCase();

  const lista = BASES_GOLLOG_DADOS.map((b) => ({
    iata: b.iata,
    cidade: b.cidade,
    uf: b.uf,
    aeroporto: b.aeroporto,
    endereco: b.endereco,
    horario: b.horario,
    telefone: b.telefone,
    noAeroporto: b.noAeroporto,
    km: origem ? Math.round(distanciaKm(origem, { lat: b.lat, lon: b.lon })) : null,
    naCidade: !!cid && atende(b, cid, u),
  }));

  // Cidade não reconhecida (grafia diferente do IBGE): as bases do estado do
  // cliente vêm primeiro, que já é quase sempre a resposta.
  const doEstado = (x: BaseComDistancia) => (x.uf === u ? 0 : 1);
  return lista.sort((a, b) =>
    a.km != null && b.km != null
      ? a.km - b.km
      : doEstado(a) - doEstado(b) || a.uf.localeCompare(b.uf) || a.cidade.localeCompare(b.cidade),
  );
}

/**
 * Unidade da cidade do cliente, quando existe. Cidade grande tem várias (São
 * Paulo tem uma dúzia de lojas): a do aeroporto vem primeiro, porque a caixa
 * chega nela direto do avião; depois a mais perto.
 */
export function baseNaCidade(lista: BaseComDistancia[]): BaseComDistancia | null {
  return lista.find((b) => b.naCidade && b.noAeroporto) ?? lista.find((b) => b.naCidade) ?? null;
}

/**
 * Base que vai na minuta.
 *
 * A escolhida pelo cliente (ou pelo dono) manda. Sem escolha, só entra a
 * unidade da cidade do cliente. Cidade sem Gollog fica em branco: chutar uma
 * base a 400 km é mandar a caixa para onde o cliente talvez não vá.
 */
export function aeroportoDaMinuta(
  escolhido: string | null | undefined,
  cidade: string | null | undefined,
  uf: string | null | undefined,
): string | null {
  const base = baseGollog(escolhido);
  if (base) return base.iata;
  return baseNaCidade(basesPorDistancia(cidade, uf))?.iata ?? null;
}
