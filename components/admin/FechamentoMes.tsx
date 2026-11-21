import type { LucideIcon } from "lucide-react";
import { Receipt, ShoppingBag, UserRound, Wallet } from "lucide-react";
import { NavegacaoMes } from "@/components/admin/financeiro/NavegacaoMes";
import { PISO_MANASSES, type Fechamento } from "@/lib/financeiro/fechamento";
import { moedaBR } from "@/lib/financeiro/periodo";

type Linha = { rotulo: string; valor: number; destaque?: boolean };

const moeda = (v: number) => moedaBR.format(v);
const pisoRotulo = `Primeiros ${new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
}).format(PISO_MANASSES)}`;

function CardFechamento({
  icon: Icon,
  titulo,
  valor,
  linhas,
}: {
  icon: LucideIcon;
  titulo: string;
  valor: number;
  linhas: Linha[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[#FAB82A] shrink-0" aria-hidden="true" />
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {titulo}
        </h4>
      </div>
      <div
        className={`text-xl md:text-2xl font-semibold leading-none tabular-nums ${
          valor < 0 ? "text-red-600" : "text-[#07366A]"
        }`}
      >
        {moeda(valor)}
      </div>
      <dl className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-baseline justify-between gap-2 text-xs">
            <dt className={l.destaque ? "font-medium text-[#07366A]" : "text-gray-500"}>
              {l.rotulo}
            </dt>
            <dd
              className={`tabular-nums whitespace-nowrap ${
                l.valor < 0
                  ? "text-red-600"
                  : l.destaque
                    ? "text-[#07366A]"
                    : "text-gray-700"
              } ${l.destaque ? "font-medium" : ""}`}
            >
              {moeda(l.valor)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function FechamentoMes({ fechamento }: { fechamento: Fechamento }) {
  const { competencia, estufa, produtos } = fechamento;
  if (!estufa && !produtos) return null;
  const ambos = !!estufa && !!produtos;

  return (
    <section className="mb-6" aria-labelledby="fechamento-titulo">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 id="fechamento-titulo" className="text-base font-semibold text-[#07366A]">
          Fechamento do mês
        </h2>
        <NavegacaoMes competencia={competencia} base="/admin" />
      </div>

      <div className={`grid gap-4 ${ambos ? "2xl:grid-cols-5" : ""}`}>
        {estufa && (
          <div className={ambos ? "2xl:col-span-3 min-w-0" : "min-w-0"}>
            <h3 className="text-xs font-medium text-gray-500 mb-2">Estufa</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <CardFechamento
                icon={Receipt}
                titulo="Custos"
                valor={estufa.custos}
                linhas={[
                  { rotulo: "Entradas", valor: estufa.entradas },
                  { rotulo: "Resultado", valor: estufa.resultado, destaque: true },
                  ...(estufa.aConferir > 0
                    ? [{ rotulo: "Vendas a conferir", valor: estufa.aConferir }]
                    : []),
                ]}
              />
              <CardFechamento
                icon={UserRound}
                titulo="Saldo Manassés"
                valor={estufa.manasses.saldoMes}
                linhas={[
                  { rotulo: pisoRotulo, valor: estufa.primeiros },
                  { rotulo: "50% do restante", valor: estufa.manasses.metade },
                  { rotulo: "Retirado no mês", valor: estufa.manasses.retirado },
                  { rotulo: "Acumulado", valor: estufa.manasses.acumulado, destaque: true },
                ]}
              />
              <CardFechamento
                icon={UserRound}
                titulo="Saldo Lucas"
                valor={estufa.lucas.saldoMes}
                linhas={[
                  { rotulo: "50% do restante", valor: estufa.lucas.metade },
                  { rotulo: "Retirado no mês", valor: estufa.lucas.retirado },
                  { rotulo: "Acumulado", valor: estufa.lucas.acumulado, destaque: true },
                ]}
              />
            </div>
          </div>
        )}

        {produtos && (
          <div className={ambos ? "2xl:col-span-2 min-w-0" : "min-w-0"}>
            <h3 className="text-xs font-medium text-gray-500 mb-2">Produtos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CardFechamento
                icon={ShoppingBag}
                titulo="Custos Lívia"
                valor={produtos.custos}
                linhas={[
                  { rotulo: "Frete de produtos", valor: produtos.frete },
                  { rotulo: "Outros custos", valor: produtos.outrosCustos },
                ]}
              />
              <CardFechamento
                icon={Wallet}
                titulo="Saldo Lívia"
                valor={produtos.saldoMes}
                linhas={[
                  { rotulo: "Vendas de produtos", valor: produtos.entradas },
                  { rotulo: "Custos", valor: produtos.custos },
                  { rotulo: "Retirado no mês", valor: produtos.retirado },
                  { rotulo: "Acumulado", valor: produtos.acumulado, destaque: true },
                  ...(produtos.aConferir > 0
                    ? [{ rotulo: "Vendas a conferir", valor: produtos.aConferir }]
                    : []),
                ]}
              />
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Só conta o que está confirmado no caixa. Retirada não é custo: ela sai do
        saldo de quem recebeu.
      </p>
    </section>
  );
}
