// Confere a regra de envio do peixe: só segunda, pulando semana com feriado.
// Uso: pnpm exec tsx scripts/teste-envio-peixe.mts
import { proximoEnvioPeixe, rotuloSegunda } from "../lib/envio-peixe";

// [momento da compra (UTC), segunda esperada, motivo]
const casos: [string, string, string][] = [
  ["2026-09-14T15:00:00Z", "2026-09-21", "segunda comprando: vai na próxima"],
  ["2026-09-19T15:00:00Z", "2026-09-21", "sábado ainda dá tempo"],
  ["2026-09-20T15:00:00Z", "2026-09-28", "domingo não dá tempo de preparar"],
  ["2026-09-21T02:30:00Z", "2026-09-28", "domingo 23h30 em SP, apesar de já ser segunda em UTC"],
  ["2026-10-06T15:00:00Z", "2026-10-19", "semana de 12/10 é pulada"],
  ["2026-11-10T15:00:00Z", "2026-11-23", "semana de 15/11 (domingo) não pula; a de 20/11 pula"],
  ["2026-12-15T15:00:00Z", "2027-01-04", "semana do Natal pula; 04/01 não tem feriado"],
  ["2027-02-01T15:00:00Z", "2027-02-15", "08/02 é Carnaval, pula"],
];

let falhas = 0;
for (const [quando, esperado, motivo] of casos) {
  const r = proximoEnvioPeixe(new Date(quando));
  const obtido = r.data.toISOString().slice(0, 10);
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(
    `${ok ? "ok " : "ERRO"} ${quando} -> ${rotuloSegunda(r.data)} (${r.dias} dias)` +
      `${ok ? "" : ` esperado ${esperado}`}  · ${motivo}` +
      (r.puladas.length ? `  [pulou: ${r.puladas.map((p) => p.feriado).join(", ")}]` : ""),
  );
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OK");
process.exit(falhas ? 1 : 0);
