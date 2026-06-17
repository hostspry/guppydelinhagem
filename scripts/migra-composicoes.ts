/**
 * Passo de dados (one-off) — migra os produtos atuais para o modelo de variantes.
 * Rodar UMA vez, ENTRE a Migration 1 (aditiva) e a Migration 2 (limpeza), com o
 * túnel SSH ativo. Idempotente: reexecutar não duplica.
 *
 *   pnpm tsx scripts/migra-composicoes.ts
 *
 * Lê sexoComposicao via SQL cru (desacoplado do client) para continuar
 * compilando depois que a Migration 2 dropar a coluna.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import type { TipoComposicao } from "../lib/generated/prisma/enums";
import { QTD_PEIXES_PADRAO } from "../lib/composicoes";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const COMPOSICOES = new Set<TipoComposicao>([
  "TRIO",
  "CASAL",
  "MACHO",
  "FEMEA",
  "LOTE",
]);

// Remapeamento de categorias antigas → finais.
const REMAP: Record<string, string> = {
  "pet-premium": "sem-linhagem",
  "trios-guppys": "linhagens-exclusivas",
  machos: "linhagens-exclusivas",
};

async function main() {
  // 1) Upsert das categorias finais.
  const linhagens = await prisma.category.upsert({
    where: { slug: "linhagens-exclusivas" },
    create: { slug: "linhagens-exclusivas", nome: "Linhagens Exclusivas", ordem: 0 },
    update: { nome: "Linhagens Exclusivas", ordem: 0 },
  });
  const semLinhagem = await prisma.category.upsert({
    where: { slug: "sem-linhagem" },
    create: { slug: "sem-linhagem", nome: "Sem Linhagem", ordem: 1 },
    update: { nome: "Sem Linhagem", ordem: 1 },
  });
  const slugToId: Record<string, string> = {
    "linhagens-exclusivas": linhagens.id,
    "sem-linhagem": semLinhagem.id,
  };

  // 2) Lê os produtos (sexoComposicao via SQL cru — sobrevive à limpeza).
  const produtos = await prisma.$queryRaw<
    {
      id: string;
      nome: string;
      sexoComposicao: string | null;
      slug: string;
      preco: string;
      estoque: number;
    }[]
  >`SELECT p.id, p.nome, p."sexoComposicao", c.slug, p.preco::text AS preco, p.estoque
    FROM "Product" p JOIN "Category" c ON c.id = p."categoryId"`;

  let variantesCriadas = 0;
  let variantesExistentes = 0;
  let categoriasRemapeadas = 0;

  for (const p of produtos) {
    const composicao: TipoComposicao = COMPOSICOES.has(
      p.sexoComposicao as TipoComposicao,
    )
      ? (p.sexoComposicao as TipoComposicao)
      : "TRIO";

    // Categoria final: remapeia a antiga; se já é final, mantém.
    const novoSlug = REMAP[p.slug] ?? p.slug;
    const novaCategoriaId = slugToId[novoSlug];

    // Atualiza tipo + categoria (idempotente).
    await prisma.product.update({
      where: { id: p.id },
      data: {
        tipo: "PEIXE",
        ...(novaCategoriaId ? { categoryId: novaCategoriaId } : {}),
      },
    });
    if (REMAP[p.slug]) categoriasRemapeadas++;

    // Variante única correspondente à composição atual (upsert por chave única).
    const existente = await prisma.productVariant.findUnique({
      where: { productId_composicao: { productId: p.id, composicao } },
    });
    if (existente) {
      variantesExistentes++;
    } else {
      const rotulo =
        composicao === "LOTE"
          ? p.nome.split("—").pop()?.trim().toLowerCase() || null
          : null;
      await prisma.productVariant.create({
        data: {
          productId: p.id,
          composicao,
          preco: Number(p.preco),
          estoque: p.estoque,
          qtdPeixes: QTD_PEIXES_PADRAO[composicao],
          rotulo,
          padrao: true, // única variante → é o padrão
          ativo: true,
          ordem: 0,
        },
      });
      variantesCriadas++;
      console.log(
        `✓ ${p.nome} → ${composicao} (R$ ${p.preco}, qtd ${QTD_PEIXES_PADRAO[composicao]}${rotulo ? `, "${rotulo}"` : ""}) · categoria ${novoSlug}`,
      );
    }
  }

  console.log(
    `\nResumo: ${produtos.length} produtos · ${variantesCriadas} variante(s) criada(s), ${variantesExistentes} já existia(m) · ${categoriasRemapeadas} categoria(s) remapeada(s).`,
  );
}

main()
  .catch((e) => {
    console.error("ERRO:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
