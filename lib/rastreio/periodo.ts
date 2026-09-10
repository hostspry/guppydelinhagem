/**
 * A janela de tempo da tela de visitantes.
 *
 * Módulo PURO, sem Prisma e sem `server-only`, pelo mesmo motivo de
 * lib/rastreio/eventos.ts: o seletor de período é um Client Component e precisa
 * da lista de janelas. Se isto morasse junto das consultas, o import do lado do
 * navegador arrastaria o cliente do Prisma para o bundle — e arrasta mesmo: o
 * Turbopack quebra na hora, com um erro que não fala em Prisma nem em bundle.
 */

export const FUSO = "America/Sao_Paulo";

export type Periodo = "dia" | "semana" | "mes" | "ano";

export const PERIODOS: { valor: Periodo; rotulo: string; descricao: string }[] = [
  { valor: "dia", rotulo: "Hoje", descricao: "hora a hora" },
  { valor: "semana", rotulo: "7 dias", descricao: "dia a dia" },
  { valor: "mes", rotulo: "30 dias", descricao: "dia a dia" },
  { valor: "ano", rotulo: "12 meses", descricao: "mês a mês" },
];

export function ehPeriodo(v: string | undefined): v is Periodo {
  return v === "dia" || v === "semana" || v === "mes" || v === "ano";
}

/** Como cada período se agrupa no gráfico. */
export const BALDE: Record<Periodo, "hour" | "day" | "month"> = {
  dia: "hour",
  semana: "day",
  mes: "day",
  ano: "month",
};

/**
 * Quantos minutos São Paulo está atrás do UTC, perguntado ao próprio sistema.
 *
 * Não fixamos −3: o Brasil aboliu o horário de verão em 2019, mas já mudou de
 * ideia antes, e um número cravado no código passaria a errar em silêncio se
 * mudar de novo.
 */
export function deslocamentoSP(quando: Date): number {
  const parte = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    timeZoneName: "longOffset",
  })
    .formatToParts(quando)
    .find((x) => x.type === "timeZoneName")?.value;
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(parte ?? "");
  if (!m) return -180; // sem resposta do sistema, o de sempre
  const sinal = m[1] === "-" ? -1 : 1;
  return sinal * (Number(m[2]) * 60 + Number(m[3]));
}

/** Começo da janela, no fuso de São Paulo. */
export function inicioDoPeriodo(p: Periodo): Date {
  const agora = new Date();

  if (p === "dia") {
    // "Hoje" é o dia corrente daqui, não as últimas 24 horas: às 9h da manhã o
    // dono quer o movimento desde a meia-noite, não desde as 9h de ontem.
    const hojeSP = new Intl.DateTimeFormat("en-CA", {
      timeZone: FUSO,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(agora); // "2026-09-10"
    const meiaNoiteUtc = new Date(`${hojeSP}T00:00:00Z`).getTime();
    return new Date(meiaNoiteUtc - deslocamentoSP(agora) * 60_000);
  }

  const dias = { semana: 7, mes: 30, ano: 365 }[p];
  return new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);
}

/**
 * Como escrever o instante de cada balde na tela.
 *
 * O instante que volta do banco já é horário de São Paulo (o SQL converteu com
 * AT TIME ZONE), mas o driver o entrega como se fosse UTC. Por isso a
 * formatação aqui usa timeZone UTC de propósito: reaplicar o fuso deslocaria
 * tudo em três horas e o gráfico mostraria a madrugada como fim de tarde.
 */
export function rotularInstante(
  d: Date,
  p: Periodo,
): { curto: string; completo: string } {
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-BR", { ...o, timeZone: "UTC" }).format(d);

  if (p === "dia") {
    const h = fmt({ hour: "2-digit" });
    return { curto: `${h}h`, completo: `${h}h` };
  }
  if (p === "ano") {
    return {
      curto: fmt({ month: "short" }).replace(".", ""),
      completo: fmt({ month: "long", year: "numeric" }),
    };
  }
  return {
    curto: fmt({ day: "2-digit", month: "2-digit" }),
    completo: fmt({ weekday: "short", day: "2-digit", month: "2-digit" }),
  };
}
