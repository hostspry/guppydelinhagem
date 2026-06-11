import { notFound } from "next/navigation";
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
          parcelasMax: produto.parcelasMax,
          tipo: produto.tipo,
          estoque: produto.estoque,
          categoryId: produto.categoryId,
          ativo: produto.ativo,
          destaque: produto.destaque,
          metaTitle: produto.metaTitle,
          metaDescription: produto.metaDescription,
          videos: produto.videos.map((v) => ({
            id: v.id,
            platform: v.platform,
            videoId: v.videoId,
            originalUrl: v.originalUrl,
            titulo: v.titulo ?? "",
            thumbnailUrl: v.thumbnailUrl ?? "",
            principal: v.principal,
          })),
        }}
      />
    </div>
  );
}
