/**
 * Leitura de CSV para as importações de sorteio. Módulo PURO.
 *
 * Aceita o que o Excel e o Google Planilhas exportam: separador ";" ou ",",
 * aspas com aspas dobradas dentro, BOM no começo e quebra de linha do Windows.
 * Os cabeçalhos viram chave sem acento e em minúsculas ("Nº" → "n",
 * "WhatsApp / Participante" → "whatsapp_participante").
 */

export type LinhaCsv = Record<string, string>;

export function normalizarCabecalho(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/º|°/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function detectarSeparador(primeiraLinha: string): string {
  const pv = (primeiraLinha.match(/;/g) ?? []).length;
  const vg = (primeiraLinha.match(/,/g) ?? []).length;
  const tab = (primeiraLinha.match(/\t/g) ?? []).length;
  if (tab > pv && tab > vg) return "\t";
  return pv >= vg ? ";" : ",";
}

export function lerCsv(texto: string): { cabecalhos: string[]; linhas: LinhaCsv[] } {
  const limpo = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const fimPrimeira = limpo.indexOf("\n");
  const sep = detectarSeparador(fimPrimeira === -1 ? limpo : limpo.slice(0, fimPrimeira));

  const registros: string[][] = [];
  let campo = "";
  let registro: string[] = [];
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        aspas = false;
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') aspas = true;
    else if (c === sep) {
      registro.push(campo);
      campo = "";
    } else if (c === "\n") {
      registro.push(campo);
      registros.push(registro);
      registro = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || registro.length > 0) {
    registro.push(campo);
    registros.push(registro);
  }

  const naoVazios = registros.filter((r) => r.some((c) => c.trim() !== ""));
  if (naoVazios.length === 0) return { cabecalhos: [], linhas: [] };
  const cabecalhos = naoVazios[0].map(normalizarCabecalho);
  const linhas = naoVazios.slice(1).map((r) => {
    const o: LinhaCsv = {};
    cabecalhos.forEach((h, i) => {
      if (h) o[h] = (r[i] ?? "").trim();
    });
    return o;
  });
  return { cabecalhos, linhas };
}

/** Primeiro campo presente entre os nomes aceitos. */
export function campo(l: LinhaCsv, ...nomes: string[]): string {
  for (const n of nomes) {
    const v = l[n];
    if (v != null && v !== "") return v;
  }
  return "";
}
