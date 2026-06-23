import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import {
  listCupons,
  CUPOM_STATUS_LABEL,
  type CupomListItem,
  type CupomStatus,
} from "@/lib/queries/cupons";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteCupomButton } from "@/components/admin/DeleteCupomButton";

const STATUS_CLASSES: Record<CupomStatus, string> = {
  vigente: "bg-green-100 text-green-700",
  agendado: "bg-blue-100 text-blue-700",
  expirado: "bg-gray-100 text-gray-600",
  esgotado: "bg-amber-100 text-amber-700",
  inativo: "bg-gray-100 text-gray-500",
};

const MODO_LABEL: Record<CupomListItem["modoAplicacao"], string> = {
  AMBOS_VENCE_MAIOR: "Pix e cartão (maior)",
  AMBOS_ACUMULA: "Pix e cartão (soma)",
  SO_PIX: "Só Pix",
  SO_CARTAO: "Só cartão",
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dataBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatarValor(c: CupomListItem): string {
  if (c.tipoValor === "PERCENTUAL") {
    return `${c.valor}%`;
  }
  return moeda.format(c.valor);
}

function formatarEscopo(c: CupomListItem): string {
  if (c.escopo === "CATEGORIAS") {
    return `${c.qtdCategorias} categoria(s)`;
  }
  if (c.escopo === "PRODUTOS") {
    return `${c.qtdProdutos} produto(s)`;
  }
  return "Todos";
}

function formatarUsos(c: CupomListItem): string {
  const limite = c.limiteUsos == null ? "∞" : String(c.limiteUsos);
  return `${c.usosRealizados}/${limite}`;
}

function formatarValidade(c: CupomListItem): string {
  const de = c.validoDe ? dataBR.format(c.validoDe) : null;
  const ate = c.validoAte ? dataBR.format(c.validoAte) : null;
  if (!de && !ate) return "—";
  if (de && ate) return `${de} a ${ate}`;
  if (de) return `a partir de ${de}`;
  return `até ${ate}`;
}

export default async function CuponsPage() {
  const cupons = await listCupons();

  return (
    <div>
      <PageHeader
        title="Cupons de desconto"
        description="Crie e gerencie cupons que os clientes aplicam no carrinho."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Cupons" }]}
        action={
          <Link
            href="/admin/cupons/novo"
            className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Novo cupom
          </Link>
        }
      />

      {cupons.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">
            Nenhum cupom cadastrado ainda.
          </p>
          <Link
            href="/admin/cupons/novo"
            className="text-sm text-[#FF035C] hover:underline font-medium"
          >
            Criar primeiro cupom →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Escopo</th>
                <th className="px-4 py-3">Modo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Usos</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3 text-right w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cupons.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-[#07366A]">
                    {c.codigo}
                    {c.descricao && (
                      <span className="block font-sans font-normal text-xs text-gray-400">
                        {c.descricao}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatarValor(c)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatarEscopo(c)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {MODO_LABEL[c.modoAplicacao]}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[c.status]}`}
                    >
                      {CUPOM_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {formatarUsos(c)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatarValidade(c)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/admin/cupons/${c.id}/editar`}
                        className="text-gray-400 hover:text-[#07366A] p-1"
                        aria-label={`Editar ${c.codigo}`}
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </Link>
                      <DeleteCupomButton
                        id={c.id}
                        codigo={c.codigo}
                        qtdPedidos={c.qtdPedidos}
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
