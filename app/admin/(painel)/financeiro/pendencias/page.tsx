import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { ConfirmarVenda } from "@/components/admin/financeiro/ConfirmarVenda";
import { DarBaixaButton } from "@/components/admin/financeiro/DarBaixaButton";
import { ExcluirLancamentoButton } from "@/components/admin/financeiro/ExcluirLancamentoButton";
import {
  listarContasEmAberto,
  listarSugestoesDeVenda,
} from "@/lib/queries/financeiro";
import { prisma } from "@/lib/prisma";
import { dataBR, moedaBR, paraInputDate } from "@/lib/financeiro/periodo";

/** Vencida, vence hoje, ou daqui a quantos dias. */
function situacaoDoVencimento(vencimento: Date | null): {
  texto: string;
  classe: string;
} {
  if (!vencimento) return { texto: "sem vencimento", classe: "text-gray-400" };

  const hoje = new Date();
  const hojeUTC = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  const vencUTC = Date.UTC(
    vencimento.getUTCFullYear(),
    vencimento.getUTCMonth(),
    vencimento.getUTCDate(),
  );
  const dias = Math.round((vencUTC - hojeUTC) / (24 * 60 * 60 * 1000));

  if (dias < 0) {
    return {
      texto: `venceu há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`,
      classe: "text-[#FF035C] font-medium",
    };
  }
  if (dias === 0) return { texto: "vence hoje", classe: "text-amber-700 font-medium" };
  if (dias <= 7) return { texto: `vence em ${dias} dia(s)`, classe: "text-amber-700" };
  return { texto: `vence em ${dias} dias`, classe: "text-gray-500" };
}

export default async function PendenciasPage() {
  const [sugestoes, contas] = await Promise.all([
    listarSugestoesDeVenda(),
    listarContasEmAberto(),
  ]);

  // Frete que o cliente pagou, só como referência na hora de informar o custo real.
  const orderIds = sugestoes
    .map((s) => s.orderId)
    .filter((id): id is string => id !== null);
  const pedidos = orderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, frete: true },
      })
    : [];
  const fretePorPedido = new Map(pedidos.map((p) => [p.id, Number(p.frete)]));

  const hoje = paraInputDate(new Date());

  return (
    <div>
      <PageHeader
        title="Pendências"
        description="Vendas esperando conferência e contas a pagar."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Financeiro", href: "/admin/financeiro" },
          { label: "Pendências" },
        ]}
      />

      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-2">
        Vendas do site a conferir
      </h2>
      {sugestoes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500 mb-8">
          Nenhuma venda esperando. Toda venda paga aparece aqui antes de entrar no
          caixa.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 mb-8">
          {sugestoes.map((s) => (
            <div
              key={s.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#07366A]">{s.descricao}</div>
                <div className="text-xs text-gray-400">
                  paga em {dataBR.format(s.data)}
                  {s.orderNumero && (
                    <>
                      {" · "}
                      <Link
                        href={`/admin/pedidos/${s.orderId}`}
                        className="hover:text-[#FF035C]"
                      >
                        ver pedido {s.orderNumero}
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <div className="text-sm font-medium text-green-700 whitespace-nowrap">
                + {moedaBR.format(s.valor)}
              </div>
              <div className="sm:w-auto w-full sm:min-w-[13rem]">
                <ConfirmarVenda
                  id={s.id}
                  descricao={s.descricao}
                  valor={s.valor}
                  freteCobrado={s.orderId ? (fretePorPedido.get(s.orderId) ?? null) : null}
                  hoje={hoje}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-2">
        Contas em aberto
      </h2>
      {contas.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
          Nada a pagar por enquanto.{" "}
          <Link href="/admin/financeiro/recorrentes" className="text-[#FF035C] hover:underline">
            Cadastrar contas fixas
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {contas.map((c) => {
            const sit = situacaoDoVencimento(c.vencimento);
            const entrada = c.tipo === "ENTRADA";
            return (
              <div
                key={c.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#07366A]">{c.descricao}</div>
                  <div className="text-xs">
                    <span className={sit.classe}>{sit.texto}</span>
                    {c.vencimento && (
                      <span className="text-gray-400">
                        {" "}
                        · {dataBR.format(c.vencimento)}
                      </span>
                    )}
                    {c.categoriaNome && (
                      <span className="text-gray-400"> · {c.categoriaNome}</span>
                    )}
                  </div>
                </div>
                <div
                  className={`text-sm font-medium whitespace-nowrap ${
                    entrada ? "text-green-700" : "text-[#FF035C]"
                  }`}
                >
                  {entrada ? "+" : "−"} {moedaBR.format(c.valor)}
                </div>
                <div className="flex items-center gap-1 sm:justify-end">
                  <DarBaixaButton
                    id={c.id}
                    hoje={hoje}
                    rotulo={entrada ? "Recebi" : "Paguei"}
                  />
                  <ExcluirLancamentoButton id={c.id} descricao={c.descricao} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
