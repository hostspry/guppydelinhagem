import Link from "next/link";
import { Plus, Pencil, Search } from "lucide-react";
import { listClientes } from "@/lib/queries/clientes";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteClienteButton } from "@/components/admin/DeleteClienteButton";
import { formatTelefone } from "@/lib/utils/format";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function ClientesPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const busca = typeof q === "string" ? q : "";
  const clientes = await listClientes(busca);

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Cadastro de clientes e leads — base para pedidos e envios."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Clientes" }]}
        action={
          <Link
            href="/admin/clientes/novo"
            className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Novo cliente
          </Link>
        }
      />

      {/* Busca (GET — estado na querystring) */}
      <form method="get" className="mb-4 relative max-w-sm">
        <Search
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          name="q"
          defaultValue={busca}
          placeholder="Buscar por nome ou telefone"
          aria-label="Buscar clientes"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
        />
      </form>

      {clientes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          {busca ? (
            <p className="text-sm text-gray-500">
              Nenhum cliente encontrado para{" "}
              <strong className="text-[#07366A]">{busca}</strong>.{" "}
              <Link href="/admin/clientes" className="text-[#FF035C] hover:underline">
                Limpar busca
              </Link>
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Nenhum cliente cadastrado ainda.
              </p>
              <Link
                href="/admin/clientes/novo"
                className="text-sm text-[#FF035C] hover:underline font-medium"
              >
                Cadastrar primeiro cliente →
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Cidade/UF</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3 text-right w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientes.map((c) => {
                const local =
                  c.cidade && c.uf
                    ? `${c.cidade}/${c.uf}`
                    : c.cidade || c.uf || "—";
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-[#07366A]">
                      {c.nome}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatTelefone(c.telefone)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{local}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/admin/clientes/${c.id}/editar`}
                          className="text-gray-400 hover:text-[#07366A] p-1"
                          aria-label={`Editar ${c.nome}`}
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </Link>
                        <DeleteClienteButton id={c.id} nome={c.nome} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
