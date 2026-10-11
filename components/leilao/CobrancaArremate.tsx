import { CheckCircle2, Gavel, Hourglass, XCircle } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import PagamentoArremate from "@/components/leilao/PagamentoArremate";
import { whatsappLink, WHATSAPP_DISPLAY } from "@/lib/constants";
import { formatBRL } from "@/lib/utils/format";
import { arremateAberto, dataLeilaoBR } from "@/lib/leiloes/situacao";
import type { ArrematePublico } from "@/lib/queries/leiloes";

/**
 * Cartão da cobrança do arremate: leilão, lotes, situação e (se aberta) a
 * entrega + pagamento. Server Component compartilhado pelo link público e pela
 * área do cliente, para as duas telas nunca divergirem.
 */
export default function CobrancaArremate({
  token,
  a,
  mostrarSaudacao = true,
}: {
  token: string;
  a: ArrematePublico;
  mostrarSaudacao?: boolean;
}) {
  const primeiroNome = a.pagador.nome.trim().split(/\s+/)[0] ?? "";
  const aberta = arremateAberto(a.situacao);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-7 shadow-sm space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-400 mb-1">
          <Gavel className="w-3.5 h-3.5" aria-hidden="true" />
          {a.leilao ? `${a.leilao.nome} · ${dataLeilaoBR(a.leilao.dataLeilao)}` : "Leilão"}
        </p>
        {mostrarSaudacao && (
          <h1 className="text-xl font-bold text-[#07366A]">
            {a.situacao === "PAGA"
              ? `Tudo certo, ${primeiroNome}!`
              : `${primeiroNome ? `${primeiroNome}, p` : "P"}arabéns ${
                  a.lotes.length === 1 ? "pelo arremate" : "pelos arremates"
                }!`}
          </h1>
        )}
        <p className="text-xs text-gray-400 mt-0.5">Pedido {a.numero}</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-[#07366A] mb-2">
          {a.lotes.length === 1 ? "Seu lote" : `Seus ${a.lotes.length} lotes`}
        </h2>
        <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {a.lotes.map((l, i) => (
            <li key={i} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
              <span className="text-gray-700">{l.nome}</span>
              <span className="text-gray-800 whitespace-nowrap">{formatBRL(l.valor)}</span>
            </li>
          ))}
        </ul>
      </div>

      {a.situacao === "PAGA" ? (
        <div className="text-center rounded-lg bg-green-50 border border-green-200 p-5">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" aria-hidden="true" />
          <p className="font-semibold text-green-800">Pagamento confirmado</p>
          <p className="text-sm text-green-900/80 mt-1">
            Recebi {formatBRL(a.total)}. Agora é comigo: separo os peixes e aviso por e-mail
            quando a caixa sair.
          </p>
        </div>
      ) : a.emAnalise && aberta ? (
        <div className="text-center rounded-lg bg-blue-50 border border-blue-200 p-5">
          <Hourglass className="w-9 h-9 text-blue-600 mx-auto mb-2" aria-hidden="true" />
          <p className="font-semibold text-blue-800">Pagamento em análise</p>
          <p className="text-sm text-blue-900/80 mt-1">
            O Mercado Pago está analisando o cartão. Costuma sair em minutos e eu aviso por
            e-mail. Não precisa pagar de novo.
          </p>
        </div>
      ) : aberta ? (
        <>
          <p className="text-sm text-gray-600">
            Pix cai na hora; no cartão dá para parcelar em até {a.maxParcelas}x.
          </p>
          <PagamentoArremate
            token={token}
            mpPublicKey={process.env.MP_PUBLIC_KEY || process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || null}
            dados={{
              numero: a.numero,
              subtotal: a.subtotal,
              frete: a.frete,
              total: a.total,
              maxParcelas: a.maxParcelas,
              qtdPeixes: a.qtdPeixes,
              maxPeixesPorCaixa: a.maxPeixesPorCaixa,
              entrega: a.entrega,
              pagador: a.pagador,
              retirada: a.retirada,
              pixPendente: a.pixPendente,
            }}
          />
        </>
      ) : (
        <div className="text-center rounded-lg bg-gray-50 border border-gray-200 p-5">
          <XCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" aria-hidden="true" />
          <p className="font-semibold text-[#07366A]">
            {a.situacao === "VENCIDA" ? "O prazo para pagar venceu" : "Esta cobrança foi cancelada"}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Me chame no WhatsApp que a gente resolve.
          </p>
        </div>
      )}

      <div className="pt-4 border-t border-gray-100 text-center">
        <a
          href={whatsappLink(`Oi! Estou falando sobre o pedido ${a.numero} do leilão.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-[#07366A] hover:underline"
        >
          <WhatsAppIcon className="w-4 h-4" />
          Dúvidas? Fale comigo no WhatsApp ({WHATSAPP_DISPLAY})
        </a>
      </div>
    </div>
  );
}
