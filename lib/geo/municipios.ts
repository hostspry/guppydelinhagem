import "server-only";
import { MUNICIPIOS } from "./municipios-dados";

export type Coordenada = { lat: number; lon: number };

/** Sem acento, sem caixa, sem pontuação: "São João d'Aliança" = "sao joao dalianca". */
export const normalizarCidade = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

let indice: Map<string, Coordenada> | null = null;

function carregar(): Map<string, Coordenada> {
  if (indice) return indice;
  indice = new Map();
  for (const linha of MUNICIPIOS.split("|")) {
    const [uf, nome, lat, lon] = linha.split(";");
    indice.set(`${uf}:${normalizarCidade(nome)}`, { lat: Number(lat), lon: Number(lon) });
  }
  return indice;
}

/** Centro do município. null quando a cidade não bate com o IBGE (grafia muito diferente). */
export function coordenadaDaCidade(
  cidade: string | null | undefined,
  uf: string | null | undefined,
): Coordenada | null {
  if (!cidade || !uf) return null;
  return carregar().get(`${uf.trim().toUpperCase()}:${normalizarCidade(cidade)}`) ?? null;
}

/** Distância em linha reta (km). Serve para ordenar bases, não para prometer trajeto. */
export function distanciaKm(a: Coordenada, b: Coordenada): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
