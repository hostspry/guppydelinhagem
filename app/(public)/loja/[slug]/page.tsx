import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getProductBySlug,
  getRelacionados,
  getUltimosAdicionados,
  getCoVistos,
  COVISTO_MIN_ITENS,
} from "@/lib/queries/products";
import { getConfigPreco, getFreteGratisConfig } from "@/lib/queries/config";
import { calcularPrecos } from "@/lib/precos";
import { precoComCampanha } from "@/lib/campanha-core";
import { resolverCampanhaInfo } from "@/lib/campanha";
import { estaEsgotado } from "@/lib/estoque";
import { stripMarcheziSignature } from "@/lib/constants";
import { truncateAtWord } from "@/lib/utils/text";
import { descricaoEmTextoSimples } from "@/lib/markdown";
import { vozDoProduto } from "@/lib/product-content";
import { SITE_URL } from "@/lib/seo";
import { productJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
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

  // Title: respeita o metaTitle do admin quando existe. Sem ele, o fallback
  // garante em todo produto os termos que trazem busca — a grafia "lebiste"
  // (que quase ninguém otimiza) e "de linhagem" — via o sufixo da marca. A
  // linhagem específica já vem no próprio nome do produto; não repetimos para
  // não virar keyword stuffing.
  // Não-peixe não é lebiste: chamar uma criadeira de "Guppy de Linhagem
  // (Lebiste)" no título do Google engana quem clica e desperdiça o clique.
  const ehPeixe = vozDoProduto(produto.tipo) === "peixe";
  const titulo =
    produto.metaTitle ||
    (ehPeixe
      ? `${produto.nome} | Guppy de Linhagem (Lebiste)`
      : `${produto.nome} | Guppy de Linhagem`);
  // Descrição da prévia SEM preço (preço muda; link velho não pode mostrar errado).
  // Sem meta/descrição curta própria, cai num fallback que sempre traz linhagem,
  // casal/trio (quando há) e envio vivo — os elementos que o Google e o cliente
  // que pesquisa querem ver. Único por produto (nome + padrão/cor).
  const comps = new Set(produto.variantes.map((v) => v.composicao));
  const temCasalTrio = comps.has("CASAL") || comps.has("TRIO");
  const linhagem = produto.padraoCor?.trim();
  const fallbackDesc = ehPeixe
    ? `${produto.nome}: guppy (lebiste) de linhagem` +
      (linhagem ? ` ${linhagem}` : "") +
      ` da Marchezi Guppy Farm, criação tricampeã mundial.` +
      (temCasalTrio ? " Casal e trio disponíveis." : "") +
      " Envio de peixe vivo para todo o Brasil."
    : `${produto.nome}: item para aquarismo na loja da Marchezi Guppy Farm, criação de guppy de linhagem. Envio para todo o Brasil.`;
  // Sem meta própria nem descrição curta, o começo da descrição diz mais do que
  // um texto genérico — mas precisa sair sem a marcação (###, **) do editor.
  const descricao =
    produto.metaDescription ||
    produto.descricaoCurta ||
    (ehPeixe
      ? fallbackDesc
      : truncateAtWord(
          descricaoEmTextoSimples(stripMarcheziSignature(produto.descricao)),
          155,
        ) || fallbackDesc);
  // Imagem da prévia = thumb do vídeo principal (videos já vêm principal-primeiro,
  // só ativos). YouTube/upload já são URLs absolutas; fallback no selo da marca.
  // Prévia do link: vídeo primeiro, depois a foto do produto. Sem os dois, o
  // selo da marca — mas um produto com foto nunca deve cair no genérico.
  const imagem =
    produto.videos[0]?.thumbnailUrl ||
    produto.fotos?.[0]?.url ||
    "/images/selo.webp";
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

  // Primeiro o que foi medido: peixes que as mesmas pessoas também abriram.
  // Só vale como "quem viu também viu" se der lista suficiente — abaixo disso
  // seria coincidência de dois ou três cliques virando recomendação.
  let relacionados = await getCoVistos(prod.id);
  const medido = relacionados.length >= COVISTO_MIN_ITENS;

  if (!medido) {
    // Sem medição: mesma categoria e, se ela só tiver este produto, os recentes.
    relacionados = await getRelacionados(prod.categoryId, prod.id);
    if (relacionados.length === 0) {
      relacionados = (await getUltimosAdicionados()).filter((p) => p.id !== prod.id);
    }
  }

  // Desconto Pix global (lib/precos é a fonte única; o ProductDetail calcula o
  // preço efetivo com isso, igual ao checkout).
  const { descontoPixGlobalPercent } = await getConfigPreco();
  const freteGratis = await getFreteGratisConfig();

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

  // JSON-LD Product (rich result): o preço do schema DEVE bater com o número em
  // destaque na página. O ProductDetail exibe, por variante, o preço Pix efetivo
  // (ou o promocional da campanha). Reproduzimos a MESMA conta aqui, por variante
  // (produto sem variantes usa o preço base), e viram Offer (preço único) ou
  // AggregateOffer (faixa low/high).
  const basesPreco =
    prod.variantes.length > 0
      ? prod.variantes.map((v) => v.preco)
      : [prod.preco];
  const precosEfetivos = basesPreco.map((base) => {
    const pc = calcularPrecos(
      {
        precoBase: base,
        descontoPixProprio: prod.descontoPix,
        usarDescontoPixGlobal: prod.usarDescontoPixGlobal,
      },
      { descontoPixGlobalPercent },
    );
    return campanha
      ? precoComCampanha(pc.precoCartao, pc.descontoPixPercent, campanha).precoPromoPix
      : pc.precoPix;
  });

  const imagemRaw =
    prod.videos[0]?.thumbnailUrl || prod.fotos?.[0]?.url || "/images/selo.webp";
  // Sai sem HTML e sem a marcação do editor (###, **, listas): o Google mostra
  // esse texto no rich result, e "### Criadeira" apareceria do jeito que está.
  const descricaoSchema =
    truncateAtWord(
      descricaoEmTextoSimples(
        stripMarcheziSignature(prod.descricao).replace(/<[^>]*>/g, " "),
      ),
      500,
    ) || undefined;

  const produtoLd = productJsonLd({
    name: prod.nome,
    description: descricaoSchema,
    image: imagemRaw.startsWith("http") ? imagemRaw : `${SITE_URL}${imagemRaw}`,
    sku: prod.slug,
    url: `${SITE_URL}/loja/${prod.slug}`,
    // `tipo` e `estoque` são obrigatórios aqui: sem eles, uma criadeira (que
    // nasce com pool 0/0 de machos e fêmeas) ia para o schema como esgotada
    // mesmo com estoque, e o Google mostrava "fora de estoque" na busca.
    inStock: !estaEsgotado({
      tipo: prod.tipo,
      estoque: prod.estoque,
      estoqueMachos: prod.estoqueMachos,
      estoqueFemeas: prod.estoqueFemeas,
    }),
    precos: precosEfetivos,
  });

  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Início", url: `${SITE_URL}/` },
    { name: prod.categoria, url: `${SITE_URL}/?categoria=${prod.categoriaSlug}` },
    { name: prod.nome },
  ]);

  return (
    <>
      <JsonLd data={produtoLd} />
      <JsonLd data={breadcrumbLd} />
      {/* Mobile: deep link abre o feed neste produto (desktop ignora). */}
      <FeedAutoOpen slug={prod.slug} temVideo={prod.videos.length > 0} />
      {preview && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm text-center py-2 px-4">
          Pré-visualização: produto <strong>inativo</strong> (não visível na
          loja).
        </div>
      )}
      <ProductDetail
        product={prod}
        relacionados={relacionados}
        relacionadosMedidos={medido}
        descontoPixGlobalPercent={descontoPixGlobalPercent}
        campanha={campanha}
        freteGratis={freteGratis}
      />
    </>
  );
}
