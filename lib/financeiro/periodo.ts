/**
 * Datas do caixa.
 *
 * O servidor roda em UTC e o dono lança em horário de Brasília (-03). Se
 * gravássemos a meia-noite, "05/03" viraria "04/03 21:00" e o lançamento pularia
 * para o mês anterior no dia 1º. Por isso toda data de lançamento é gravada ao
 * MEIO-DIA UTC do dia escolhido: sobra folga de 12h para cada lado, então o dia
 * (e o mês) é o mesmo em qualquer fuso do Brasil.
 *
 * Competência é a string "AAAA-MM" que a tela usa para navegar entre meses.
 */

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-08-15" → Date ao meio-dia UTC. Inválida → null. */
export function dataDoDia(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [, a, mes, d] = m;
  const ano = Number(a);
  const mesN = Number(mes);
  const diaN = Number(d);
  if (mesN < 1 || mesN > 12 || diaN < 1 || diaN > 31) return null;
  const date = new Date(Date.UTC(ano, mesN - 1, diaN, 12, 0, 0));
  // Rejeita 31/02 e afins, que o Date "conserta" sozinho virando março.
  if (date.getUTCMonth() !== mesN - 1 || date.getUTCDate() !== diaN) return null;
  return date;
}

/** Date → "2026-08-15" (para <input type="date">). */
export function paraInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ehCompetencia(v: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** Competência do mês corrente em Brasília. */
export function competenciaAtual(): string {
  const agora = new Date();
  const brasilia = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  return `${brasilia.getUTCFullYear()}-${String(brasilia.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function competenciaDe(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Intervalo [início, fim) da competência, para o `where` do Prisma. */
export function intervaloDaCompetencia(competencia: string): {
  inicio: Date;
  fim: Date;
} {
  const [ano, mes] = competencia.split("-").map(Number);
  return {
    inicio: new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0)),
    fim: new Date(Date.UTC(ano, mes, 1, 0, 0, 0)),
  };
}

export function competenciaAnterior(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return mes === 1
    ? `${ano - 1}-12`
    : `${ano}-${String(mes - 1).padStart(2, "0")}`;
}

export function competenciaSeguinte(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return mes === 12
    ? `${ano + 1}-01`
    : `${ano}-${String(mes + 1).padStart(2, "0")}`;
}

/** "2026-08" → "agosto de 2026". */
export function rotuloCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

/** Dia do mês (1–28) → data de vencimento na competência. */
export function vencimentoNaCompetencia(competencia: string, dia: number): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  const seguro = Math.min(Math.max(dia, 1), 28);
  return new Date(Date.UTC(ano, mes - 1, seguro, 12, 0, 0));
}

export const dataBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export const moedaBR = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
