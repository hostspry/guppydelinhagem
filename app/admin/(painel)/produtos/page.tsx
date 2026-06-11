import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil } from "lucide-react";
import { listProducts } from "@/lib/queries/products";
import { formatBRL } from "@/lib/utils/format";
import { isConfiguredImageHost } from "@/lib/utils/image";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";

export default async function ProdutosPage() {
  const produtos = await listProducts();

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Cadastro de peixes e itens da loja."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Produtos" }]}
        action={
          <Link
            href="/admin/produtos/novo"
            className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Novo produto
          </Link>
        }
      />

      {produtos.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">
            Nenhum produto cadastrado ainda.
          </p>
          <Link
            href="/admin/produtos/novo"
            className="text-sm text-[#FF035C] hover:underline font-medium"
          >
            Cadastrar primeiro produto →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-12"></th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-right">Preço</th>
                <th className="px-4 py-3 text-center">Estoque</th>
                <th className="px-4 py-3 text-center">Ativo</th>
                <th className="px-4 py-3 text-center">Destaque</th>
                <th className="px-4 py-3 text-right w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {produtos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="relative w-9 aspect-[9/16] rounded bg-gray-100 overflow-hidden">
                      {p.videos[0]?.thumbnailUrl ? (
                        <Image
                          src={p.videos[0].thumbnailUrl}
                          alt=""
                          fill
                          sizes="36px"
                          className="object-cover"
                          unoptimized={!isConfiguredImageHost(p.videos[0].thumbnailUrl)}
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-[#07366A]">{p.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{p.category.nome}</td>
                  <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                    {formatBRL(Number(p.preco))}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 tabular-nums">
                    {p.estoque}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge on={p.ativo} labelOn="Sim" labelOff="Não" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge on={p.destaque} labelOn="Sim" labelOff="—" muteOff />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/admin/produtos/${p.id}/editar`}
                        className="text-gray-400 hover:text-[#07366A] p-1"
                        aria-label={`Editar ${p.nome}`}
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </Link>
                      <DeleteProductButton
                        id={p.id}
                        nome={p.nome}
                        qtdPedidos={p._count.orderItems}
                        qtdImagens={p._count.imagens}
                        qtdVideos={p._count.videos}
                        qtdWaitlist={p._count.waitlist}
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

function Badge({
  on,
  labelOn,
  labelOff,
  muteOff,
}: {
  on: boolean;
  labelOn: string;
  labelOff: string;
  muteOff?: boolean;
}) {
  if (!on && muteOff) {
    return <span className="text-gray-300">{labelOff}</span>;
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        on ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {on ? labelOn : labelOff}
    </span>
  );
}
