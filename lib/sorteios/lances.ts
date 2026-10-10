/**
 * Motor de regras dos lances do leilão.
 *
 * Módulo PURO. Recebe os lances de UM lote, na ordem em que chegaram, e diz
 * quais valem. Regras do leilão:
 *
 *  - Lance inicial: R$ 60,00.
 *  - Cada lance precisa superar o maior lance válido anterior em pelo menos
 *    R$ 5,00, e o incremento é múltiplo de R$ 5,00.
 *  - Lance igual, menor ou depois do encerramento não vale. Em lances iguais,
 *    vale o primeiro.
 *  - Todo lance válido vira uma chance, ganhando o lote ou não.
 *
 * O que o motor NÃO decide (vai para REVISAR, sem palpite):
 *  - Xeque-Mate e Mestre Criador: têm regra própria e podem ser uma compra à
 *    parte no mesmo lote. A conferência decide cada um.
 *  - Lance sem valor legível, sem horário quando o lote tem encerramento, ou em
 *    que a planilha discorda do motor.
 */

export const LANCE_INICIAL = 60;
export const INCREMENTO = 5;

export type Classificacao = "VALIDO" | "INVALIDO" | "REVISAR";
export type Tipo = "NORMAL" | "XEQUE_MATE" | "MESTRE_CRIADOR";

export type LanceEntrada = {
  sequencia: number;
  valor: number | null;
  tipo: Tipo;
  horario: Date | null;
  encerramento: Date | null;
  /** Como a planilha classificou, quando classificou. */
  planilha?: Classificacao | null;
};

export type LanceAvaliado = {
  sequencia: number;
  motor: Classificacao;
  classificacao: Classificacao;
  motivo: string;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Centavos inteiros, para o múltiplo de 5 não sofrer com ponto flutuante. */
const cents = (n: number) => Math.round(n * 100);

export function avaliarLote(lances: LanceEntrada[]): LanceAvaliado[] {
  const ordenados = [...lances].sort((a, b) => a.sequencia - b.sequencia);
  let maiorValido: number | null = null;
  const saida: LanceAvaliado[] = [];

  for (const l of ordenados) {
    const r = avaliarUm(l, maiorValido);
    if (r.motor === "VALIDO" && l.valor != null) maiorValido = l.valor;

    let classificacao = r.motor;
    let motivo = r.motivo;
    if (l.planilha && l.planilha !== r.motor && r.motor !== "REVISAR") {
      classificacao = "REVISAR";
      motivo = `Divergência: a planilha diz ${l.planilha}, o motor diz ${r.motor} (${r.motivo}).`;
    }
    saida.push({ sequencia: l.sequencia, motor: r.motor, classificacao, motivo });
  }
  return saida;
}

function avaliarUm(
  l: LanceEntrada,
  maiorValido: number | null,
): { motor: Classificacao; motivo: string } {
  if (l.tipo !== "NORMAL") {
    const nome = l.tipo === "XEQUE_MATE" ? "Xeque-Mate" : "Mestre Criador";
    return { motor: "REVISAR", motivo: `${nome}: regra própria, decidir na conferência.` };
  }
  if (l.valor == null || !Number.isFinite(l.valor) || l.valor <= 0) {
    return { motor: "REVISAR", motivo: "Valor do lance não identificado." };
  }
  if (l.encerramento) {
    if (!l.horario) {
      return { motor: "REVISAR", motivo: "Lote tem encerramento, mas o lance está sem horário." };
    }
    if (l.horario.getTime() > l.encerramento.getTime()) {
      return { motor: "INVALIDO", motivo: "Lance depois do encerramento do lote." };
    }
  }

  const v = cents(l.valor);
  if (maiorValido == null) {
    if (v < cents(LANCE_INICIAL)) {
      return { motor: "INVALIDO", motivo: `Abaixo do lance inicial de ${brl(LANCE_INICIAL)}.` };
    }
    if ((v - cents(LANCE_INICIAL)) % cents(INCREMENTO) !== 0) {
      return { motor: "INVALIDO", motivo: `Fora dos incrementos de ${brl(INCREMENTO)}.` };
    }
    return { motor: "VALIDO", motivo: "Primeiro lance válido do lote." };
  }

  const anterior = cents(maiorValido);
  if (v === anterior) {
    return { motor: "INVALIDO", motivo: `Igual ao lance de ${brl(maiorValido)}; vale o primeiro.` };
  }
  if (v < anterior) {
    return { motor: "INVALIDO", motivo: `Menor que o maior lance válido (${brl(maiorValido)}).` };
  }
  if (v - anterior < cents(INCREMENTO)) {
    return { motor: "INVALIDO", motivo: `Incremento menor que ${brl(INCREMENTO)}.` };
  }
  if ((v - anterior) % cents(INCREMENTO) !== 0) {
    return { motor: "INVALIDO", motivo: `Incremento fora dos múltiplos de ${brl(INCREMENTO)}.` };
  }
  return { motor: "VALIDO", motivo: `Supera ${brl(maiorValido)}.` };
}

/** "VÁLIDO", "valido", "sim", "inválido"… → classificação. */
export function lerClassificacao(s: string | undefined | null): Classificacao | null {
  const t = (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
  if (!t) return null;
  if (["valido", "sim", "v", "ok", "1", "true"].includes(t)) return "VALIDO";
  if (["invalido", "nao", "n", "i", "0", "false"].includes(t)) return "INVALIDO";
  if (t.startsWith("revis") || t.startsWith("confer") || t.startsWith("duvid")) return "REVISAR";
  return null;
}

/** "Xeque-Mate", "XM", "mestre criador"… → tipo. */
export function lerTipo(s: string | undefined | null): Tipo {
  const t = (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (t === "xm" || t.startsWith("xeque")) return "XEQUE_MATE";
  if (t === "mc" || t.startsWith("mestre")) return "MESTRE_CRIADOR";
  return "NORMAL";
}

/** "R$ 65,00", "65", "65.5" → número. */
export function lerValor(s: string | undefined | null): number | null {
  if (!s) return null;
  let t = s.replace(/[^\d,.-]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
