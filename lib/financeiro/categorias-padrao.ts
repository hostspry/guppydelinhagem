import type { PrismaClient } from "../generated/prisma/client";

/**
 * Categorias iniciais do caixa, pensadas para um criadouro.
 *
 * As marcadas com `sistema` são procuradas pelo SLUG no código (venda do site,
 * taxa do gateway, postagem), então podem ser renomeadas no admin mas não
 * apagadas — apagar quebraria o vínculo automático.
 *
 * Vive fora do seed porque o seed também reseta a senha do admin: semear as
 * categorias precisa ser possível sem esse efeito colateral.
 */
export const SLUG_VENDAS_SITE = "vendas-site";
export const SLUG_TAXA_PAGAMENTO = "taxa-pagamento";
export const SLUG_FRETE_POSTAGEM = "frete-postagem";

export type CategoriaPadrao = {
  slug: string;
  nome: string;
  tipo: "ENTRADA" | "SAIDA";
  sistema?: boolean;
};

export const CATEGORIAS_PADRAO: CategoriaPadrao[] = [
  { slug: SLUG_VENDAS_SITE, nome: "Vendas do site", tipo: "ENTRADA", sistema: true },
  { slug: "vendas-presenciais", nome: "Vendas presenciais e feiras", tipo: "ENTRADA" },
  { slug: "outras-entradas", nome: "Outras entradas", tipo: "ENTRADA" },

  { slug: SLUG_TAXA_PAGAMENTO, nome: "Taxas de pagamento", tipo: "SAIDA", sistema: true },
  { slug: SLUG_FRETE_POSTAGEM, nome: "Frete e postagem", tipo: "SAIDA", sistema: true },
  { slug: "racao", nome: "Ração e alimentação", tipo: "SAIDA" },
  { slug: "medicamentos", nome: "Medicamentos e tratamento", tipo: "SAIDA" },
  { slug: "matrizes", nome: "Matrizes e reprodutores", tipo: "SAIDA" },
  { slug: "embalagens", nome: "Embalagens e caixas", tipo: "SAIDA" },
  { slug: "energia", nome: "Energia elétrica", tipo: "SAIDA" },
  { slug: "agua", nome: "Água", tipo: "SAIDA" },
  { slug: "internet", nome: "Internet e telefone", tipo: "SAIDA" },
  { slug: "equipamentos", nome: "Equipamentos e manutenção", tipo: "SAIDA" },
  { slug: "marketing", nome: "Marketing e anúncios", tipo: "SAIDA" },
  { slug: "impostos", nome: "Impostos e taxas", tipo: "SAIDA" },
  { slug: "retirada-dono", nome: "Retirada do dono", tipo: "SAIDA" },
  { slug: "outras-saidas", nome: "Outras saídas", tipo: "SAIDA" },
];

/**
 * Upsert idempotente — não desfaz renomeações feitas no admin.
 *
 * Recebe o client por parâmetro (caminho relativo no import, sem o alias `@/`)
 * porque quem chama é tanto o app quanto o seed rodando por tsx.
 */
export async function semearCategoriasFinanceiras(
  prisma: Pick<PrismaClient, "categoriaFinanceira">,
): Promise<number> {
  for (const [i, c] of CATEGORIAS_PADRAO.entries()) {
    await prisma.categoriaFinanceira.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        nome: c.nome,
        tipo: c.tipo,
        sistema: c.sistema ?? false,
        ordem: i,
      },
      update: { ordem: i, sistema: c.sistema ?? false },
    });
  }
  return CATEGORIAS_PADRAO.length;
}
