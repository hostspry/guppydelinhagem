import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProductForm } from "@/components/admin/ProductForm";
import { getProductById, getProductFormData } from "@/lib/queries/products";

type Props = { params: Promise<{ id: string }> };

export default async function EditarProdutoPage({ params }: Props) {
  const { id } = await params;
  const [produto, { categorias }] = await Promise.all([
    getProductById(id),
    getProductFormData(),
  ]);

  if (!produto) notFound();

  return (
    <div>
      <PageHeader
        title="Editar produto"
        description={produto.nome}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Produtos", href: "/admin/produtos" },
          { label: produto.nome },
        ]}
        action={
          <a
            href={`/loja/${produto.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-[#07366A] transition-all"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            Ver na loja
          </a>
        }
      />
      <ProductForm
        categorias={categorias}
        initialData={{
          id: produto.id,
          nome: produto.nome,
          slug: produto.slug,
          descricao: produto.descricao,
          descricaoCurta: produto.descricaoCurta,
          preco: produto.preco,
          descontoPix: produto.descontoPix,
          usarDescontoPixGlobal: produto.usarDescontoPixGlobal,
          parcelasMax: produto.parcelasMax,
          tipo: produto.tipo,
          estoque: produto.estoque,
          estoqueMachos: produto.estoqueMachos,
          estoqueFemeas: produto.estoqueFemeas,
          categoryId: produto.categoryId,
          ativo: produto.ativo,
          destaque: produto.destaque,
          metaTitle: produto.metaTitle,
          metaDescription: produto.metaDescription,
          keywords: produto.keywords,
          padraoCor: produto.padraoCor,
          cauda: produto.cauda,
          caracteristica: produto.caracteristica,
          origem: produto.origem,
          temperatura: produto.temperatura,
          ph: produto.ph,
          alimentacao: produto.alimentacao,
          expectativaVida: produto.expectativaVida,
          videos: produto.videos.map((v) => ({
            id: v.id,
            platform: v.platform,
            videoId: v.videoId,
            originalUrl: v.originalUrl,
            titulo: v.titulo ?? "",
            thumbnailUrl: v.thumbnailUrl ?? "",
            principal: v.principal,
            ativo: v.ativo,
          })),
          variantes: produto.variantes,
        }}
      />
    </div>
  );
}
