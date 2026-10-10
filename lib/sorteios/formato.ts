/** Formatação dos sorteios para tela. PURO (cliente e servidor usam). */

const FUSO = "America/Sao_Paulo";

export function dataBR(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}

export function dataHoraBR(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

/** Valor para <input type="date"> / "datetime-local" no horário de Brasília. */
export function paraInput(d: Date | null | undefined, comHora: boolean): string {
  if (!d) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: FUSO,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const dia = `${p.year}-${p.month}-${p.day}`;
  return comHora ? `${dia}T${p.hour}:${p.minute}` : dia;
}

export const STATUS_BADGE: Record<string, string> = {
  CONFERENCIA: "bg-amber-100 text-amber-800",
  HOMOLOGADO: "bg-blue-100 text-blue-800",
  REALIZADO: "bg-green-100 text-green-800",
  CANCELADO: "bg-gray-100 text-gray-500",
};

/** Rótulo para o cliente: fala de "apuração", não de status interno. */
export const STATUS_CLIENTE: Record<string, string> = {
  CONFERENCIA: "Apuração em conferência",
  HOMOLOGADO: "Aguardando sorteio",
  REALIZADO: "Sorteio realizado",
  CANCELADO: "Cancelado",
};
