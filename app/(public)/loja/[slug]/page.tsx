import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getProductBySlug,
  getRelacionados,
  getUltimosAdicionados,
} from "@/lib/queries/products";
import { getConfigPreco } from "@/lib/queries/config";
import { calcularPrecos } from "@/lib/precos";
import { resolverCampanhaInfo } from "@/lib/campanha";
import { stripMarcheziSignature } from "@/lib/constants";
import ProductDetail from "@/components/product/ProductDetail";
import FeedAutoOpen from "@/components/feed/FeedAutoOpen";

// ISR: a página revalida a cada 60s, refletindo edições do admin sem redeploy.
// (As actions de produto não revalidam /loja/[slug] individualmente; 60s é o
// trade-off escolhido para frescor vs. carga.)
export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const produto = await getProductBySlug(slug); // cache() dedup com o render
  if (!produto) return { title: "Produto não encontrado" };

  const titulo = produto.metaTitle || `${produto.nome} · Guppy de Linhagem`;
  // Descrição da prévia SEM preço (preço muda; link velho não pode mostrar errado).
  const descricao =
    produto.metaDescription ||
    produto.descricaoCurta ||
    stripMarcheziSignature(produto.descricao).slice(0, 155).trim() ||
    undefined;
  // Imagem da prévia = thumb do vídeo principal (videos já vêm principal-primeiro,
  // só ativos). YouTube/upload já são URLs absolutas; fallback no selo da marca.
  const imagem = produto.videos[0]?.thumbnailUrl || "/images/selo.webp";
  const url = `/loja/${slug}`;

  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "Guppy de Linhagem",
      title: produto.nome,
      description: descricao,
      images: [{ url: imagem, alt: produto.nome }],
    },
    twitter: {
      card: "summary_large_image",
      title: produto.nome,
      description: descricao,
      images: [imagem],
    },
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

  // Desconto Pix global (lib/precos é a fonte única; o ProductDetail calcula o
  // preço efetivo com isso, igual ao checkout).
  const { descontoPixGlobalPercent } = await getConfigPreco();

  // Campanha automática vigente para este produto (preço base = produto, sem
  // variante). O componente recalcula o promo por variante com a mesma fórmula.
  const precosBase = calcularPrecos(
    {
      precoBase: prod.preco,
      descontoPixProprio: prod.descontoPix,
      usarDescontoPixGlobal: prod.usarDescontoPixGlobal,
    },
    { descontoPixGlobalPercent },
  );
  const campanha = await resolverCampanhaInfo({
    id: prod.id,
    categoryId: prod.categoryId,
    precoCheio: precosBase.precoCartao,
    descontoPixPercent: precosBase.descontoPixPercent,
    estoqueMachos: prod.estoqueMachos,
    estoqueFemeas: prod.estoqueFemeas,
  });

  return (
    <>
      {/* Mobile: deep link abre o feed neste produto (desktop ignora). */}
      <FeedAutoOpen slug={prod.slug} />
      {preview && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm text-center py-2 px-4">
          Pré-visualização: produto <strong>inativo</strong> (não visível na
          loja).
        </div>
      )}
      <ProductDetail
        product={prod}
        relacionados={relacionados}
        descontoPixGlobalPercent={descontoPixGlobalPercent}
        campanha={campanha}
      />
    </>
  );
}
