import {
  chaveTelefone,
  formatarTelefone,
  pareceTelefone,
} from "@/lib/sorteios/telefone";

/**
 * Lista de lotes colada no painel (da planilha ou do bloco de notas).
 *
 * Módulo PURO, para ser exercitado com texto real. Uma linha por lote, colunas
 * nesta ordem:
 *
 *   Lote ; Nome do lote ; Arrematante ; WhatsApp ; Valor ; Peixes (opcional)
 *
 * Aceita tabulação (colar direto do Google Planilhas/Excel), ponto e vírgula ou
 * barra vertical. A primeira linha pode ser o cabeçalho. Quem arrematou pode vir
 * só pelo número, como o WhatsApp mostra contato não salvo: aí o número é o
 * nome até o cliente preencher o cadastro.
 */

export type LinhaLote = {
  linha: number;
  numero: string | null;
  nome: string;
  arrematante: string;
  /** Canônico (DDI + número). Nulo = sem WhatsApp. */
  telefone: string | null;
  valor: number;
  qtdPeixes: number | null;
};

export type LeituraLista = { lotes: LinhaLote[]; erros: string[] };

/** "R$ 1.250,50" → 1250.5 · "150" → 150 · "150.00" → 150. Nulo se não for valor. */
export function lerValor(entrada: string): number | null {
  let t = entrada.replace(/r\$/i, "").replace(/\s/g, "");
  if (!t) return null;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100) / 100;
}

function separador(linha: string): string | null {
  if (linha.includes("\t")) return "\t";
  if (linha.includes(";")) return ";";
  if (linha.includes("|")) return "|";
  return null;
}

const CABECALHO = /\b(lote|valor|arrematante|whats|nome)\b/i;

export function lerListaDeLotes(texto: string): LeituraLista {
  const lotes: LinhaLote[] = [];
  const erros: string[] = [];

  texto.split(/\r?\n/).forEach((bruta, i) => {
    const n = i + 1;
    const linha = bruta.trim();
    if (!linha) return;

    const sep = separador(linha);
    if (!sep) {
      erros.push(
        `Linha ${n}: separe as colunas com ponto e vírgula (;) ou cole direto da planilha.`,
      );
      return;
    }
    const [numeroTxt = "", nomeTxt = "", arrematanteTxt = "", whatsTxt = "", valorTxt = "", peixesTxt = ""] =
      linha.split(sep).map((c) => c.trim());

    const valor = lerValor(valorTxt);
    if (valor == null) {
      // Cabeçalho da planilha: sem valor e com nome de coluna. Ignora calado.
      if (CABECALHO.test(linha)) return;
      erros.push(`Linha ${n}: valor "${valorTxt || "vazio"}" não é um valor em reais.`);
      return;
    }
    if (valor < 1) {
      erros.push(`Linha ${n}: o valor mínimo é R$ 1,00.`);
      return;
    }

    const nome = nomeTxt.replace(/\s+/g, " ");
    if (nome.length < 2) {
      erros.push(`Linha ${n}: falta o nome do lote.`);
      return;
    }

    // WhatsApp: na coluna própria ou, se ela veio vazia, no lugar do nome.
    let telefone: string | null = null;
    let arrematante = arrematanteTxt.replace(/\s+/g, " ");
    if (whatsTxt) {
      telefone = chaveTelefone(whatsTxt);
      if (!telefone) {
        erros.push(`Linha ${n}: WhatsApp "${whatsTxt}" não parece um número válido.`);
        return;
      }
    } else if (pareceTelefone(arrematante)) {
      telefone = chaveTelefone(arrematante);
    }
    if (!arrematante && telefone) arrematante = formatarTelefone(telefone);
    if (arrematante.length < 2) {
      erros.push(`Linha ${n}: falta quem arrematou (nome ou WhatsApp).`);
      return;
    }

    let qtdPeixes: number | null = null;
    if (peixesTxt) {
      const q = Number(peixesTxt.replace(/\D/g, ""));
      if (!Number.isInteger(q) || q < 1 || q > 50) {
        erros.push(`Linha ${n}: quantidade de peixes "${peixesTxt}" inválida (1 a 50).`);
        return;
      }
      qtdPeixes = q;
    }

    lotes.push({
      linha: n,
      numero: numeroTxt.replace(/^lote\s*/i, "").trim() || null,
      nome,
      arrematante,
      telefone,
      valor,
      qtdPeixes,
    });
  });

  return { lotes, erros };
}
