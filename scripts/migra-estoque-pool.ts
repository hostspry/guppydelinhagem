/**
 * Passo de dados (one-off) — migra para o modelo de pool de estoque (machos/fêmeas).
 * Rodar UMA vez, ENTRE a Migration 1 (aditiva) e a Migration 2 (limpeza), túnel ativo.
 * Idempotente: o pool é semeado a partir do ESTOQUE DA VARIANTE (que este script
 * NÃO altera) → reexecutar dá o mesmo resultado.
 *
 *   pnpm tsx scripts/migra-estoque-pool.ts
 *
 * Lê estoque/qtdPeixes/rotulo via SQL cru (desacoplado) p/ continuar compilando
 * depois que a Migration 2 dropar essas colunas da variante.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const N = (s: string | null, re: RegExp): number | null => {
  const m = s?.match(re);
  return m ? parseInt(m[1], 10) : null;
};

// Receita do LOTE: extrai do rótulo ("8 machos e 2 fêmeas" → 8/2); fallback p/
// qtdPeixes (tudo em machos) ou 1/0.
function receitaLote(rotulo: string | null, qtdPeixes: number) {
  const m = N(rotulo, /(\d+)\s*machos?/i);
  const f = N(rotulo, /(\d+)\s*f[êe]meas?/i);
  if (m != null || f != null) return { m: m ?? 0, f: f ?? 0 };
  return qtdPeixes > 0 ? { m: qtdPeixes, f: 0 } : { m: 1, f: 0 };
}

function receita(composicao: string, rotulo: string | null, qtdPeixes: number) {
  switch (composicao) {
    case "TRIO":
      return { m: 1, f: 2 };
    case "CASAL":
      return { m: 1, f: 1 };
    case "MACHO":
      return { m: 1, f: 0 };
    case "FEMEA":
      return { m: 0, f: 1 };
    case "LOTE":
      return receitaLote(rotulo, qtdPeixes);
    default:
      return { m: 1, f: 0 };
  }
}

type VarRow = {
  id: string;
  productId: string;
  composicao: string;
  estoque: number;
  qtdPeixes: number;
  rotulo: string | null;
  padrao: boolean;
};
type ProdRow = { id: string; nome: string; tipo: string };

async function main() {
  const variantes = await prisma.$queryRaw<VarRow[]>`
    SELECT v.id, v."productId", v.composicao::text AS composicao, v.estoque,
           v."qtdPeixes", v.rotulo, v.padrao
    FROM "ProductVariant" v`;
  const produtos = await prisma.$queryRaw<ProdRow[]>`
    SELECT id, nome, tipo::text AS tipo FROM "Product" ORDER BY nome`;

  // 1) Receitas das variantes (qtdMachos/qtdFemeas).
  let varAtualizadas = 0;
  for (const v of variantes) {
    const r = receita(v.composicao, v.rotulo, v.qtdPeixes);
    await prisma.productVariant.update({
      where: { id: v.id },
      data: { qtdMachos: r.m, qtdFemeas: r.f },
    });
    varAtualizadas++;
  }

  // 2) Pool dos produtos PEIXE.
  let poolsSemeados = 0;
  for (const p of produtos) {
    if (p.tipo !== "PEIXE") continue;
    const vs = variantes.filter((v) => v.productId === p.id);
    const padrao = vs.find((v) => v.padrao);
    let machos = 0;
    let femeas = 0;

    if (padrao?.composicao === "LOTE") {
      // 1 lote disponível = a própria receita do lote.
      const r = receitaLote(padrao.rotulo, padrao.qtdPeixes);
      machos = r.m;
      femeas = r.f;
    } else {
      // Estoque do TRIO = nº de trios (decisão): machos = N, fêmeas = 2N.
      const trio = vs.find((v) => v.composicao === "TRIO") ?? padrao;
      const n = trio?.estoque ?? 0;
      if (trio?.composicao === "TRIO") {
        machos = n;
        femeas = n * 2;
      } else {
        machos = n; // fallback improvável (sem trio e não-lote)
        femeas = 0;
      }
    }

    await prisma.product.update({
      where: { id: p.id },
      data: {
        estoqueMachos: machos,
        estoqueFemeas: femeas,
        estoque: machos + femeas, // sincroniza o espelho
      },
    });
    poolsSemeados++;
    console.log(
      `✓ ${p.nome.slice(0, 38)} → pool ♂${machos} ♀${femeas} (total ${machos + femeas})`,
    );
  }

  console.log(
    `\nResumo: ${variantes.length} variantes (receitas), ${poolsSemeados} produtos PEIXE com pool semeado.`,
  );
}

main()
  .catch((e) => {
    console.error("ERRO:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
