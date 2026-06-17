import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getProductBySlug,
  getRelacionados,
  getUltimosAdicionados,
} from "@/lib/queries/products";
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
  let produto = await getProductBySlug(slug);

  // Pré-visualização de inativo: só quando o ativo não existe E há sessão de
  // admin (não-CUSTOMER). O auth() só roda nesse ramo raro — produtos ativos
  // continuam renderizáveis sem tocar cookies (mantém o cache ISR). Visitante
  // comum recebe 404 normal.
  let preview = false;
  if (!produto) {
    const session = await auth();
    const role = session?.user?.role;
    if (role && role !== "CUSTOMER") {
      produto = await getProductBySlug(slug, true);
      preview = produto != null;
    }
  }
  if (!produto) notFound();
  const prod = produto;

  // Mesma categoria; se a categoria só tem este produto, cai para recentes (sem
  // o atual) — evita o carrossel vazio.
  let relacionados = await getRelacionados(prod.categoryId, prod.id);
  if (relacionados.length === 0) {
    relacionados = (await getUltimosAdicionados()).filter((p) => p.id !== prod.id);
  }

  return (
    <>
      {preview && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm text-center py-2 px-4">
          Pré-visualização — produto <strong>inativo</strong> (não visível na
          loja).
        </div>
      )}
      <ProductDetail product={prod} relacionados={relacionados} />
    </>
  );
}
