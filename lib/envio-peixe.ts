/**
 * Quando o peixe sai: SÓ NA SEGUNDA-FEIRA, e nunca em semana com feriado.
 *
 * É o que mantém o peixe vivo. Saindo na segunda, a caixa chega antes do fim de
 * semana, sem ficar parada num centro de distribuição fechado. Feriado no meio
 * da semana faz a mesma coisa que o fim de semana: a transportadora para e o
 * peixe fica dias no saco. Então semana com feriado (de segunda a sexta) é
 * pulada inteira, e o envio vai para a segunda da semana seguinte sem feriado.
 *
 * Client-safe e sem dependência: usado no admin e no cron do Mercado Livre.
 * Todas as datas são dias de calendário em São Paulo, ao meio-dia UTC, mesma
 * convenção de lib/semana-envio.
 */

const DIA = 24 * 60 * 60 * 1000;

/**
 * Antecedência mínima entre a compra e a segunda do envio, em dias. Com 2, a
 * compra vai até sábado para sair na segunda seguinte; a de domingo cai na
 * outra semana, porque não dá tempo de separar e preparar o peixe.
 */
export const ANTECEDENCIA_MIN_DIAS = 2;

/** Meio-dia UTC do dia de calendário de São Paulo. */
function hojeSp(agora: Date): Date {
  const [a, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(agora)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12));
}

const chave = (d: Date) => d.toISOString().slice(0, 10);

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia, 12));
}

/**
 * Feriados nacionais que param transportadora, com o nome.
 *
 * Entram também Carnaval e Corpus Christi, que no papel são ponto facultativo:
 * na prática Correios e Jadlog operam em escala reduzida, e é exatamente isso
 * que deixa caixa parada.
 */
export function feriadosNacionais(ano: number): { data: string; nome: string }[] {
  const p = pascoa(ano).getTime();
  const movel = (dias: number, nome: string) => ({
    data: chave(new Date(p + dias * DIA)),
    nome,
  });
  const fixo = (mmdd: string, nome: string) => ({ data: `${ano}-${mmdd}`, nome });
  return [
    fixo("01-01", "Confraternização Universal"),
    movel(-48, "Carnaval"),
    movel(-47, "Carnaval"),
    movel(-2, "Sexta-feira Santa"),
    fixo("04-21", "Tiradentes"),
    fixo("05-01", "Dia do Trabalho"),
    movel(60, "Corpus Christi"),
    fixo("09-07", "Independência"),
    fixo("10-12", "Nossa Senhora Aparecida"),
    fixo("11-02", "Finados"),
    fixo("11-15", "Proclamação da República"),
    fixo("11-20", "Consciência Negra"),
    fixo("12-25", "Natal"),
  ];
}

/** Feriado de segunda a sexta na semana que começa nesta segunda, se houver. */
export function feriadoNaSemana(segunda: Date): string | null {
  for (let i = 0; i < 5; i++) {
    const d = new Date(segunda.getTime() + i * DIA);
    const achou = feriadosNacionais(d.getUTCFullYear()).find((f) => f.data === chave(d));
    if (achou) return achou.nome;
  }
  return null;
}

export type ProximoEnvio = {
  /** Segunda-feira do envio, meio-dia UTC. */
  data: Date;
  /** Dias de calendário entre hoje e a segunda do envio. */
  dias: number;
  /** Semanas puladas por feriado no caminho, para explicar a data. */
  puladas: { segunda: Date; feriado: string }[];
};

/** A próxima segunda em que um pedido feito agora pode sair. */
export function proximoEnvioPeixe(agora = new Date()): ProximoEnvio {
  const hoje = hojeSp(agora);
  const minimo = hoje.getTime() + ANTECEDENCIA_MIN_DIAS * DIA;
  // Primeira segunda-feira a partir do mínimo.
  const base = new Date(minimo);
  const ateSegunda = (8 - base.getUTCDay()) % 7; // getUTCDay: 1 = segunda
  let segunda = new Date(minimo + ateSegunda * DIA);

  const puladas: ProximoEnvio["puladas"] = [];
  // Teto de segurança: mais de 8 semanas seguidas com feriado não existe.
  for (let i = 0; i < 8; i++) {
    const feriado = feriadoNaSemana(segunda);
    if (!feriado) break;
    puladas.push({ segunda, feriado });
    segunda = new Date(segunda.getTime() + 7 * DIA);
  }

  return {
    data: segunda,
    dias: Math.round((segunda.getTime() - hoje.getTime()) / DIA),
    puladas,
  };
}

/** "segunda, 21/09" */
export function rotuloSegunda(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `segunda, ${dd}/${mm}`;
}

/** Parágrafo da descrição do anúncio que explica a regra ao comprador. */
export const TEXTO_ENVIO_SEGUNDA =
  "Envio somente às segundas-feiras. Assim o peixe viaja no começo da semana e chega antes do fim de semana, sem ficar parado em centro de distribuição fechado. Em semana com feriado nacional o envio passa para a segunda-feira da semana seguinte sem feriado, pelo mesmo motivo: feriado para a transportadora e o peixe não pode ficar dias na caixa. O prazo de entrega começa a contar a partir da segunda-feira do envio.";
