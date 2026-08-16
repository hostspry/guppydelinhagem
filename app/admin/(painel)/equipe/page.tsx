import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { listMembros, type MembroListItem } from "@/lib/queries/equipe";
import { membroAtual } from "@/lib/permissoes-server";
import { PAPEL_LABEL, type PapelEquipe } from "@/lib/permissoes";
import { PageHeader } from "@/components/admin/PageHeader";
import { MembroAcoes } from "@/components/admin/MembroAcoes";

const PAPEL_CLASSES: Record<PapelEquipe, string> = {
  EDITOR: "bg-blue-100 text-blue-700",
  ADMIN: "bg-violet-100 text-violet-700",
  SUPER_ADMIN: "bg-amber-100 text-amber-800",
};

const dataBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Resumo dos limites em uma frase curta — a tabela não comporta 4 colunas disso. */
function resumoLimites(m: MembroListItem): string {
  if (m.role === "SUPER_ADMIN") return "Sem limites";

  const partes: string[] = [];
  partes.push(
    m.limiteDescontoPercent == null
      ? "desconto livre"
      : `desconto até ${m.limiteDescontoPercent}%`,
  );

  if (m.role === "ADMIN") {
    const financeiro: string[] = [];
    if (m.podeCancelarPedido) financeiro.push("cancela");
    if (m.podeEstornar) financeiro.push("estorna");
    if (financeiro.length === 0) {
      partes.push("não cancela nem estorna");
    } else {
      const teto =
        m.limiteValorFinanceiro == null
          ? ""
          : ` até ${moeda.format(m.limiteValorFinanceiro)}`;
      partes.push(`${financeiro.join(" e ")}${teto}`);
    }
  }

  return partes.join(" · ");
}

function statusSenha(m: MembroListItem): string {
  if (!m.temSenha) return "Sem senha";
  if (m.senhaPrecisaTroca) return "Senha temporária";
  return m.ultimoLogin ? `Entrou ${dataBR.format(m.ultimoLogin)}` : "Nunca entrou";
}

export default async function EquipePage() {
  const [membros, eu] = await Promise.all([listMembros(), membroAtual()]);

  return (
    <div>
      <PageHeader
        title="Equipe"
        description="Quem entra no painel, o que cada um mexe e até onde pode ir."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Equipe" }]}
        action={
          <Link
            href="/admin/equipe/novo"
            className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Novo membro
          </Link>
        }
      />

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Limites</th>
              <th className="px-4 py-3">Acesso</th>
              <th className="px-4 py-3 text-right w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {membros.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-[#07366A]">{m.nome}</span>
                  {m.id === eu.id && (
                    <span className="ml-1.5 text-xs text-gray-400">(você)</span>
                  )}
                  <span className="block text-xs text-gray-400 break-all">
                    {m.email}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PAPEL_CLASSES[m.role]}`}
                  >
                    {PAPEL_LABEL[m.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{resumoLimites(m)}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {statusSenha(m)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-1">
                    <Link
                      href={`/admin/equipe/${m.id}/editar`}
                      className="text-gray-400 hover:text-[#07366A] p-1"
                      aria-label={`Editar ${m.nome}`}
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </Link>
                    <MembroAcoes
                      id={m.id}
                      nome={m.nome}
                      email={m.email}
                      souEu={m.id === eu.id}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3 max-w-2xl">
        A senha aparece uma única vez, quando é gerada — o banco guarda só o hash.
        Se alguém perder a dela, use a chave na linha da pessoa para gerar outra.
      </p>
    </div>
  );
}
