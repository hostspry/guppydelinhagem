// Confere o título do ML contra os nomes reais do catálogo. Roda sem banco e
// sem rede: `npx tsx scripts/teste-titulo-ml.mts`.
import { tituloPeixeMl, corPrincipalMl, TITULO_MAX_ML } from "../lib/mercadolivre/seo";

const nomes = [
  "Guppy Albino Platinum White — Linhagem Premium",
  "Guppy Albino Red Silverado (Linhagem Selecionada)",
  "Guppy Blue Dragon Half Moon (Linhagem Selecionada)",
  "Guppy Full Red Big Dorsal (Linhagem Selecionada)",
  "Guppy Japan Blue Blue Tail - Linhagem Pura",
  "Guppy Koi Tuxedo — Trio Linhagem Premium",
  "Guppy Red Spanish Big Ear — Nadadeiras Azuis Claras",
  "Kit Guppy Pet Premium — 8 Machos e 2 Fêmeas",
];

let falhas = 0;
for (const nome of nomes) {
  for (const comp of ["Trio", "Casal", "Macho"]) {
    const t = tituloPeixeMl({ nome, composicao: comp });
    const ok = t.length <= TITULO_MAX_ML && !/\s{2,}/.test(t) && !/[—–]/.test(t);
    // palavra repetida?
    const palavras = t.toLowerCase().split(" ");
    const repetida = palavras.length !== new Set(palavras).size;
    if (!ok || repetida) falhas++;
    console.log(
      `${ok && !repetida ? "ok " : "RUIM"} [${String(t.length).padStart(2)}] ${t}${repetida ? "   <- palavra repetida" : ""}`,
    );
  }
  console.log(`      cor deduzida: ${corPrincipalMl(nome) ?? "(nenhuma)"}\n`);
}
console.log(falhas === 0 ? "TODOS OK" : `${falhas} TÍTULO(S) COM PROBLEMA`);
