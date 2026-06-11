import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { listCategories } from "@/lib/queries/categories";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteCategoryButton } from "@/components/admin/DeleteCategoryButton";

export default async function CategoriasPage() {
  const categorias = await listCategories();

  return (
    <div>
      <PageHeader
        title="Categorias"
        description="Organize seus produtos em categorias visíveis no site."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Categorias" },
        ]}
        action={
          <Link
            href="/admin/categorias/novo"
            className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Nova categoria
          </Link>
        }
      />

      {categorias.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">
            Nenhuma categoria cadastrada ainda.
          </p>
          <Link
            href="/admin/categorias/novo"
            className="text-sm text-[#FF035C] hover:underline font-medium"
          >
            Criar primeira categoria →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3 text-center">Ordem</th>
                <th className="px-4 py-3 text-center">Produtos</th>
                <th className="px-4 py-3 text-right w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categorias.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-[#07366A]">
                    {cat.nome}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {cat.slug}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {cat.ordem}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {cat._count.produtos}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/admin/categorias/${cat.id}/editar`}
                        className="text-gray-400 hover:text-[#07366A] p-1"
                        aria-label={`Editar ${cat.nome}`}
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </Link>
                      <DeleteCategoryButton
                        id={cat.id}
                        nome={cat.nome}
                        qtdProdutos={cat._count.produtos}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
