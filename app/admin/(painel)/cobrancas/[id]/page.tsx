import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { CobrancaLink } from "@/components/admin/CobrancaLink";
import { CobrancaAcoes } from "@/components/admin/CobrancaAcoes";
import {
  getCobrancaById,
  linkDaCobranca,
  type SituacaoCobranca,
} from "@/lib/queries/cobrancas";

export const dynamic = "force-dynamic";

const BADGE: Record<SituacaoCobranca, { label: string; classe: string }> = {
  ABERTA: { label: "Aguardando pagamento", classe: "bg-blue-100 text-blue-700" },
  PAGA: { label: "Paga", classe: "bg-green-100 text-green-700" },
  EXPIRADA: { label: "Vencida", classe: "bg-gray-100 text-gray-600" },
  CANCELADA: { label: "Cancelada", classe: "bg-gray-100 text-gray-500" },
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dataHoraBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUS_PAGAMENTO: Record<string, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  EM_ANALISE: "Em análise",
  RECUSADO: "Recusado",
  ESTORNADO: "Estornado",
  EXPIRADO: "Expirado",
};

const METODO: Record<string, string> = {
  PIX: "Pix",
  CARTAO: "Cartão",
  BOLETO: "Boleto",
  CARTEIRA: "Carteira",
  GOOGLE_PAY: "Google Pay",
};

export default async function CobrancaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCobrancaById(id);
  if (!c) notFound();

  const badge = BADGE[c.situacao];

  // O que falta no cadastro para o pagador chegar completo no gateway.
  const faltando = [
    !c.cliente.cpfCnpj && "CPF",
    !c.cliente.cep && "endereço",
  ].filter((v): v is string => typeof v === "string");

  return (
    <div>
      <PageHeader
        title={`Cobrança ${c.numero}`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Cobranças", href: "/admin/cobrancas" },
          { label: c.numero },
        ]}
        action={
          <Link
            href="/admin/cobrancas"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Voltar
          </Link>
        }
      />

      {/* Cadastro incompleto = pagador magro no gateway = cartão recusado por
          risco. O link continua o mesmo: completar o cadastro já vale para ele. */}
      {faltando.length > 0 && c.situacao === "ABERTA" && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">
            O cadastro de {c.cliente.nome} está sem {faltando.join(" e ")}.
          </p>
          <p className="mt-1 text-amber-800">
            O Mercado Pago analisa quem está pagando. Com o cadastro incompleto,
            ele costuma recusar o cartão mesmo quando o cartão está bom.{" "}
            <Link
              href={`/admin/clientes/${c.cliente.id}/editar`}
              className="font-medium underline"
            >
              Completar o cadastro
            </Link>{" "}
            já vale para este link — não precisa gerar outro.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {c.publicToken && (
            <CobrancaLink
              link={linkDaCobranca(c.publicToken)}
              clienteNome={c.cliente.nome}
              clienteTelefone={c.cliente.telefone}
              descricao={c.descricao}
              valor={c.total}
              expiraEm={c.expiraEm}
              ativo={c.situacao === "ABERTA"}
            />
          )}

          {/* Tentativas de pagamento (o webhook é quem escreve aqui) */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-[#07366A] mb-3">
              Pagamentos
            </h2>
            {c.pagamentos.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhuma tentativa ainda. Assim que o cliente pagar, aparece aqui
                sozinho.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200">
                    <th className="py-2">Quando</th>
                    <th className="py-2">Método</th>
                    <th className="py-2">Situação</th>
                    <th className="py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {c.pagamentos.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 text-gray-500">
                        {dataHoraBR.format(p.criadoEm)}
                      </td>
                      <td className="py-2 text-gray-700">
                        {METODO[p.metodo] ?? p.metodo}
                        {p.parcelas && p.parcelas > 1 ? ` ${p.parcelas}x` : ""}
                      </td>
                      <td className="py-2 text-gray-700">
                        {STATUS_PAGAMENTO[p.status] ?? p.status}
                        {p.estornadoEm ? " (estornado)" : ""}
                      </td>
                      <td className="py-2 text-right font-medium text-gray-800">
                        {moeda.format(p.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {c.situacao === "PAGA" && (
              <p className="text-xs text-gray-500 mt-3">
                Para devolver o dinheiro, use o estorno na{" "}
                <Link
                  href={`/admin/pedidos/${c.id}`}
                  className="text-[#FF035C] hover:underline"
                >
                  tela do pedido
                </Link>
                .
              </p>
            )}
          </div>
        </div>

        {/* Resumo */}
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <span
              className={`inline-block text-xs px-2 py-0.5 rounded-full mb-4 ${badge.classe}`}
            >
              {badge.label}
            </span>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Valor</dt>
                <dd className="text-lg font-semibold text-[#07366A]">
                  {moeda.format(c.total)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Descrição</dt>
                <dd className="text-gray-700">{c.descricao}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Cliente</dt>
                <dd className="text-gray-700">
                  <Link
                    href={`/admin/clientes/${c.cliente.id}/editar`}
                    className="hover:underline"
                  >
                    {c.cliente.nome}
                  </Link>
                  {c.cliente.email && (
                    <span className="block text-xs text-gray-500">
                      {c.cliente.email}
                    </span>
                  )}
                  {c.cliente.telefone && (
                    <span className="block text-xs text-gray-500">
                      {c.cliente.telefone}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Parcelamento</dt>
                <dd className="text-gray-700">
                  até {c.maxParcelas ?? 12}x no cartão
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Criada</dt>
                <dd className="text-gray-700">{dataHoraBR.format(c.criadoEm)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Link vence</dt>
                <dd className="text-gray-700">
                  {c.expiraEm ? dataHoraBR.format(c.expiraEm) : "sem prazo"}
                </dd>
              </div>
              {c.observacoes && (
                <div>
                  <dt className="text-xs text-gray-500">Observações</dt>
                  <dd className="text-gray-700 whitespace-pre-line">
                    {c.observacoes}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <CobrancaAcoes id={c.id} situacao={c.situacao} />
        </div>
      </div>
    </div>
  );
}
