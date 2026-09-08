import Link from "next/link";
import { Pencil, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ExcluirCargoButton } from "@/components/admin/ExcluirCargoButton";
import { listarCargos } from "@/lib/queries/cargos";
import { PERMISSAO_LABEL, SEGMENTO_LABEL } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

export default async function CargosPage() {
  const cargos = await listarCargos();

  return (
    <div>
      <PageHeader
        title="Cargos"
        description="Cada cargo diz o que a pessoa pode fazer e qual caixa ela enxerga."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Cargos" }]}
        action={
          <Link
            href="/admin/cargos/novo"
            className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Novo cargo
          </Link>
        }
      />

      <div className="space-y-3">
        {cargos.map((c) => (
          <div
            key={c.id}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[#07366A] flex items-center gap-1.5">
                  {c.nome}
                  {c.protegido && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide bg-amber-100 text-amber-800 rounded-full px-2 py-0.5"
                      title="Tem todas as permissões, sempre. Não pode ser excluído."
                    >
                      <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                      fixo
                    </span>
                  )}
                </h2>
                {c.descricao && (
                  <p className="text-xs text-gray-500 mt-0.5">{c.descricao}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-500">
                  {c.pessoas === 0
                    ? "ninguém"
                    : c.pessoas === 1
                      ? "1 pessoa"
                      : `${c.pessoas} pessoas`}
                </span>
                <Link
                  href={`/admin/cargos/${c.id}/editar`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-md px-2.5 py-1.5 hover:border-[#07366A] transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  Editar
                </Link>
                {!c.protegido && (
                  <ExcluirCargoButton
                    id={c.id}
                    nome={c.nome}
                    pessoas={c.pessoas}
                  />
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {c.protegido ? (
                <span className="text-xs text-gray-500">
                  Todas as permissões e o caixa inteiro.
                </span>
              ) : (
                <>
                  {c.permissoes.length === 0 && (
                    <span className="text-xs text-gray-400">
                      Nenhuma permissão marcada — esta pessoa não veria nada.
                    </span>
                  )}
                  {c.permissoes.map((p) => (
                    <span
                      key={p}
                      className="text-[11px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5"
                    >
                      {PERMISSAO_LABEL[p]}
                    </span>
                  ))}
                </>
              )}
            </div>

            {!c.protegido && (
              <p className="text-xs text-gray-500 mt-2">
                Caixa:{" "}
                {c.segmentosFinanceiros.length === 0
                  ? "tudo"
                  : c.segmentosFinanceiros
                      .map((s) => SEGMENTO_LABEL[s])
                      .join(" e ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
