/**
 * Semana pedida para o envio.
 *
 * Guardamos a SEGUNDA-FEIRA da semana escolhida, ao meio-dia UTC — mesma
 * convenção das datas do caixa: com 12h de folga para cada lado, o dia não muda
 * de semana por causa de fuso.
 *
 * Semana e não dia porque é isso que o negócio consegue prometer: peixe vivo sai
 * quando está pronto e quando o clima do trajeto ajuda. Pedir um dia exato criaria
 * uma promessa que a loja não controla.
 *
 * Client-safe: usado no checkout e no admin.
 */

const DIA = 24 * 60 * 60 * 1000;

/** Segunda-feira (12:00 UTC) da semana que contém a data. */
export function segundaDaSemana(d: Date): Date {
  const base = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0),
  );
  const diaSemana = (base.getUTCDay() + 6) % 7; // 0 = segunda
  return new Date(base.getTime() - diaSemana * DIA);
}

/** ISO "AAAA-MM-DD" da segunda-feira — é o que trafega em formulário. */
export function chaveSemana(d: Date): string {
  return segundaDaSemana(d).toISOString().slice(0, 10);
}

/** "AAAA-MM-DD" (segunda) → Date ao meio-dia UTC. Inválido → null. */
export function semanaDaChave(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  if (Number.isNaN(d.getTime())) return null;
  return segundaDaSemana(d);
}

const MES_CURTO = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "13 a 19 de out" — o intervalo, que é o que a pessoa entende. */
export function rotuloSemana(segunda: Date): string {
  const fim = new Date(segunda.getTime() + 6 * DIA);
  const d1 = segunda.getUTCDate();
  const d2 = fim.getUTCDate();
  const m1 = MES_CURTO[segunda.getUTCMonth()];
  const m2 = MES_CURTO[fim.getUTCMonth()];
  return m1 === m2 ? `${d1} a ${d2} de ${m1}` : `${d1} de ${m1} a ${d2} de ${m2}`;
}

export type OpcaoSemana = { chave: string; rotulo: string };

/**
 * Semanas que o cliente pode escolher.
 *
 * Começa na PRÓXIMA semana: peixe pedido hoje ainda passa por quarentena e
 * preparo, então oferecer "esta semana" seria vender um prazo que não se cumpre.
 * Vai até ~2 meses à frente, que é o limite do que dá para planejar.
 */
export function semanasDisponiveis(
  hoje = new Date(),
  quantas = 8,
): OpcaoSemana[] {
  const primeira = segundaDaSemana(new Date(hoje.getTime() + 7 * DIA));
  return Array.from({ length: quantas }, (_, i) => {
    const s = new Date(primeira.getTime() + i * 7 * DIA);
    return { chave: chaveSemana(s), rotulo: rotuloSemana(s) };
  });
}

/** A semana escolhida já passou (ou é a corrente)? Serve para o alerta do painel. */
export function semanaVencida(semana: Date, hoje = new Date()): boolean {
  return segundaDaSemana(semana).getTime() <= segundaDaSemana(hoje).getTime();
}
