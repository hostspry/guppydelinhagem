import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelacionados } from "@/lib/queries/products";
import ProductDetail from "@/components/product/ProductDetail";

// ISR: a página revalida a cada 60s, refletindo edições do admin sem redeploy.
// (As actions de produto não revalidam /loja/[slug] individualmente; 60s é o
// trade-off escolhido para frescor vs. carga.)
export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const produto = await getProductBySlug(slug); // cache() dedup com o render
  if (!produto) return { title: "Produto não encontrado" };
  return {
    title: produto.metaTitle || `${produto.nome} — Guppy de Linhagem`,
    description:
      produto.metaDescription || produto.descricaoCurta || undefined,
  };
}

export default async function ProdutoPage({ params }: Props) {
  const { slug } = await params;
  const produto = await getProductBySlug(slug);
  if (!produto) notFound();

  const relacionados = await getRelacionados(produto.categoryId, produto.id);

  return <ProductDetail product={produto} relacionados={relacionados} />;
}
