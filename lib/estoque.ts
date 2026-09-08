import type { ProductType } from "@/lib/generated/prisma/enums";

// ─────────────────────────────────────────────────────────────
// Disponibilidade para ORDENAÇÃO de vitrine — fonte única.
//
// "Esgotado" aqui, para PEIXE, = pool TOTALMENTE zerado: nenhum macho E nenhuma
// fêmea. (Se houver qualquer macho OU fêmea, é disponível.) Para produto que não
// é peixe vale o estoque real da linha do produto. Esse critério é usado
// igual em /loja, na home e no feed para mandar esgotados para o fim — sem
// ocultar. NÃO confundir com a regra de disponibilidade por composição usada
// no resto do site (lá vale o pool por variante).
// ─────────────────────────────────────────────────────────────

// `tipo`/`estoque` são opcionais para não quebrar quem só tem o pool em mãos,
// mas TODO chamador que lida com catálogo misto precisa passar os dois: sem
// `tipo`, uma ração (que nasce com pool 0/0) seria lida como esgotada.
export function estaEsgotado(p: {
  tipo?: ProductType;
  estoque?: number;
  estoqueMachos: number;
  estoqueFemeas: number;
}): boolean {
  // Peixe vive do pool macho/fêmea. Todo o resto (ração, criadeira, filtro)
  // tem estoque real na própria linha do produto.
  if (p.tipo != null && p.tipo !== "PEIXE") return (p.estoque ?? 0) <= 0;
  return p.estoqueMachos === 0 && p.estoqueFemeas === 0;
}

// Ordena para a vitrine seguindo a regra fechada com o dono:
//   1) disponíveis em destaque  2) disponíveis  3) esgotados (por último)
// — disponibilidade tem precedência sobre destaque (destaque esgotado vai pro
// fim). Dentro de cada grupo preserva a ordem recebida (sort estável via índice
// decorado), que já vem ordenada do banco (recentes/preço/destaque-recentes).
// O destaque só desempata ENTRE disponíveis; entre esgotados não conta.
export function ordenarVitrine<
  T extends {
    tipo?: ProductType;
    estoque?: number;
    estoqueMachos: number;
    estoqueFemeas: number;
    destaque: boolean;
  },
>(itens: T[]): T[] {
  return itens
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const ea = estaEsgotado(a.item) ? 1 : 0;
      const eb = estaEsgotado(b.item) ? 1 : 0;
      if (ea !== eb) return ea - eb; // disponível (0) antes de esgotado (1)
      // Mesmo grupo de disponibilidade. Destaque só desempata entre disponíveis.
      if (ea === 0) {
        const da = a.item.destaque ? 0 : 1;
        const db = b.item.destaque ? 0 : 1;
        if (da !== db) return da - db; // destaque antes
      }
      return a.idx - b.idx; // estável: preserva a ordem de entrada
    })
    .map((x) => x.item);
}
