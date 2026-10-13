import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Hourglass, XCircle } from "lucide-react";
import { getCobrancaPorToken } from "@/lib/queries/cobrancas";
import { whatsappLink, WHATSAPP_DISPLAY } from "@/lib/constants";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import CobrancaPagamento from "@/components/cobranca/CobrancaPagamento";
import CobrancaStatusPoll from "@/components/cobranca/CobrancaStatusPoll";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagamento · Guppy de Linhagem",
  robots: { index: false, follow: false }, // link privado, não indexa
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

export default async function CobrarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const c = await getCobrancaPorToken(token);
  if (!c) notFound();

  const primeiroNome = c.clienteNome.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm">
        {c.situacao === "PAGA" ? (
          <div className="text-center">
            <CheckCircle2
              className="w-12 h-12 text-green-600 mx-auto mb-3"
              aria-hidden="true"
            />
            <h1 className="text-xl font-bold text-[#07366A] mb-1">
              Pagamento confirmado
            </h1>
            <p className="text-sm text-gray-600">
              Recebi {moeda.format(c.total)} referente a {c.descricao}. Obrigado,{" "}
              {primeiroNome}!
            </p>
          </div>
        ) : c.situacao === "ABERTA" ? (
          <>
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
              Cobrança {c.numero}
            </p>
            <h1 className="text-xl font-bold text-[#07366A] mb-6">
              Oi {primeiroNome}, seu pagamento está aqui
            </h1>

            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-6">
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <span className="text-sm text-gray-600">{c.descricao}</span>
                <span className="text-sm text-gray-800 whitespace-nowrap">
                  {moeda.format(c.total)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-gray-700">Total</span>
                <span className="text-lg font-bold text-[#07366A]">
                  {moeda.format(c.total)}
                </span>
              </div>
            </div>

            <ul className="text-sm text-gray-600 space-y-1.5 mb-6">
              <li>Pix cai na hora.</li>
              <li>
                No cartão dá para parcelar em até {c.maxParcelas ?? 12}x.
              </li>
              {c.expiraEm && (
                <li className="flex items-center gap-1.5 text-gray-500">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  Este link vale até {dataBR.format(c.expiraEm)}.
                </li>
              )}
            </ul>

            {c.cartao?.status === "EM_ANALISE" ? (
              // Sem formulário enquanto o MP decide: um segundo pagamento agora
              // pode virar cobrança em dobro se o primeiro for aprovado.
              <div className="text-center rounded-lg bg-blue-50 border border-blue-200 p-5">
                <Hourglass
                  className="w-9 h-9 text-blue-600 mx-auto mb-2"
                  aria-hidden="true"
                />
                <p className="font-semibold text-blue-800">
                  Pagamento em análise
                </p>
                <p className="text-sm text-blue-900/80 mt-1">
                  O Mercado Pago está analisando o cartão. Costuma levar poucos
                  segundos e esta página atualiza sozinha. Não precisa pagar de
                  novo.
                </p>
              </div>
            ) : (
              <CobrancaPagamento
                token={token}
                total={c.total}
                maxParcelas={c.maxParcelas ?? 12}
                mpPublicKey={
                  process.env.MP_PUBLIC_KEY ||
                  process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ||
                  null
                }
                clienteEmail={c.clienteEmail}
                recusaAnterior={
                  c.cartao?.status === "RECUSADO" ? c.cartao.mensagem : null
                }
              />
            )}
            <CobrancaStatusPoll token={token} cartao={c.cartao?.status ?? null} />
          </>
        ) : (
          <div className="text-center">
            <XCircle
              className="w-12 h-12 text-gray-400 mx-auto mb-3"
              aria-hidden="true"
            />
            <h1 className="text-xl font-bold text-[#07366A] mb-1">
              {c.situacao === "EXPIRADA"
                ? "Este link venceu"
                : "Esta cobrança foi cancelada"}
            </h1>
            <p className="text-sm text-gray-600">
              Me chame no WhatsApp que eu gero um link novo para você em um
              minuto.
            </p>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-gray-100 text-center">
          <a
            href={whatsappLink(
              `Oi! Estou falando sobre a cobrança ${c.numero}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[#07366A] hover:underline"
          >
            <WhatsAppIcon className="w-4 h-4" />
            Falar comigo no WhatsApp ({WHATSAPP_DISPLAY})
          </a>
        </div>
      </div>
    </div>
  );
}
