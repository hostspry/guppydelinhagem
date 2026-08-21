import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { getPedidoById } from "@/lib/queries/pedidos";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusPedidoControl } from "@/components/admin/StatusPedidoControl";
import { EnvioCard } from "@/components/admin/EnvioCard";
import { AcessoCliente } from "@/components/admin/AcessoCliente";
import { EstornarButton } from "@/components/admin/EstornarButton";
import { podeEditarItens } from "@/lib/pedido-status";
import {
  formatBRL,
  formatTelefone,
  formatCpfCnpj,
} from "@/lib/utils/format";

type Props = { params: Promise<{ id: string }> };

export default async function PedidoDetalhePage({ params }: Props) {
  const { id } = await params;
  const pedido = await getPedidoById(id);
  if (!pedido) notFound();

  const e = pedido.enderecoEntrega;
  const editavel = podeEditarItens(pedido.status);
  const linhaEndereco = [e.logradouro, e.numero, e.complemento, e.bairro]
    .filter(Boolean)
    .join(", ");
  const linhaCidade = [e.cidade, e.uf].filter(Boolean).join(" / ");

  // Estorno: pagamento já estornado (estado final) e pagamento PAGO ainda
  // reembolsável (mostra aviso + botão). O valor vem do banco, nunca do client.
  const estornoInfo = pedido.pagamentos.find((p) => p.estornadoEm != null) ?? null;
  const pagoReembolsavel =
    pedido.pagamentos.find((p) => p.status === "PAGO" && p.externalId) ?? null;
  // Rótulo do gateway p/ os textos de estorno (MP ou PagBank).
  const gatewayLabel =
    pagoReembolsavel?.provider === "PAGBANK" ? "PagBank" : "Mercado Pago";

  return (
    <div>
      <PageHeader
        title={`Pedido ${pedido.numero}`}
        description={`Criado em ${pedido.criadoEm.toLocaleDateString("pt-BR")}`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Pedidos", href: "/admin/pedidos" },
          { label: pedido.numero },
        ]}
        action={
          editavel ? (
            <Link
              href={`/admin/pedidos/${pedido.id}/editar`}
              className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-[#07366A] transition-all"
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
              Editar
            </Link>
          ) : undefined
        }
      />

      {/* Status + transições */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <StatusPedidoControl id={pedido.id} status={pedido.status} />
        {!editavel && (
          <p className="text-xs text-gray-400 mt-2">
            Pedido pago/enviado: itens travados (só status/rastreio mudam).
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Itens + totais */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Preço</th>
                  <th className="px-4 py-3 text-center">Qtd</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pedido.itens.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-3 text-[#07366A]">
                      {it.nomeProduto}
                      {!it.produtoId && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">
                          avulso
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatBRL(it.precoUnitario)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {it.quantidade}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#07366A]">
                      {formatBRL(it.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-100 p-4 text-sm space-y-1 max-w-xs ml-auto">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{formatBRL(pedido.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Frete</span>
                <span>{formatBRL(pedido.frete)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Desconto</span>
                <span>− {formatBRL(pedido.desconto)}</span>
              </div>
              <div className="flex justify-between font-semibold text-[#07366A] text-base">
                <span>Total</span>
                <span>{formatBRL(pedido.total)}</span>
              </div>
            </div>
          </div>

          {pedido.observacoes && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-1">
                Observações
              </h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {pedido.observacoes}
              </p>
            </div>
          )}
        </div>

        {/* Destinatário (snapshot) + envio/pagamento */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-2">
              Destinatário
            </h2>
            <div className="text-sm text-gray-600 space-y-0.5">
              <p className="font-medium text-[#07366A]">{e.nome}</p>
              {e.cpfCnpj && <p>{formatCpfCnpj(e.cpfCnpj)}</p>}
              {e.telefone && <p>{formatTelefone(e.telefone)}</p>}
              {e.email && <p>{e.email}</p>}
              {linhaEndereco && <p className="pt-1">{linhaEndereco}</p>}
              {linhaCidade && <p>{linhaCidade}</p>}
              {e.cep && <p>CEP {e.cep}</p>}
            </div>
          </div>

          {/* Envio & rastreio — registro manual + WhatsApp + link de rastreio.
              Na retirada não há envio a rastrear. */}
          {pedido.tipoEntrega !== "RETIRADA" && (
            <EnvioCard
              id={pedido.id}
              numero={pedido.numero}
              status={pedido.status}
              transportadora={pedido.transportadora}
              codigoRastreio={pedido.codigoRastreio}
              selfTracking={pedido.selfTracking}
              etiquetaUrl={pedido.etiquetaUrl}
              clienteNome={e.nome}
              clienteTelefone={e.telefone}
            />
          )}

          {/* Venda direta: o cliente não passou pelo cadastro do site, então não
              tem como acompanhar sozinho. Aqui a loja cria o acesso dele. */}
          <AcessoCliente
            clienteId={pedido.clienteId}
            clienteNome={pedido.clienteNome}
            clienteEmail={pedido.clienteEmail}
            clienteTelefone={pedido.clienteTelefone ?? e.telefone}
            jaTemAcesso={pedido.clienteTemAcesso}
          />

          <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm space-y-1">
            <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-2">
              Entrega &amp; pagamento
            </h2>
            <p className="text-gray-600">
              Entrega:{" "}
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  pedido.tipoEntrega === "RETIRADA"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {pedido.tipoEntrega === "RETIRADA"
                  ? "Retirada na loja"
                  : "Envio"}
              </span>
            </p>
            <p className="text-gray-600">
              Forma de pagamento:{" "}
              <span className="text-[#07366A]">
                {pedido.formaPagamento ?? "—"}
              </span>
            </p>
          </div>

          {/* ── Reembolso / estorno ── */}
          {estornoInfo ? (
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm space-y-1">
              <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-2">
                Reembolso
              </h2>
              <p className="font-medium text-emerald-700">
                Reembolsado em{" "}
                {estornoInfo.estornadoEm?.toLocaleString("pt-BR")}
              </p>
              {estornoInfo.refundId && (
                <p className="text-gray-500">
                  Refund:{" "}
                  <span className="font-mono text-[#07366A]">
                    {estornoInfo.refundId}
                  </span>
                </p>
              )}
              <p className="text-xs text-gray-400 pt-1">
                O valor volta ao meio de pagamento do cliente; no cartão, aparece
                na fatura.
              </p>
            </div>
          ) : pagoReembolsavel ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm space-y-3">
              <h2 className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
                Reembolso
              </h2>
              <p className="text-amber-800">
                {pedido.status === "CANCELADO" ? (
                  <>
                    Este pedido foi pago (
                    <strong>{formatBRL(pagoReembolsavel.valor)}</strong>) e está
                    cancelado, mas o valor <strong>ainda não foi devolvido</strong>{" "}
                    ao cliente. Para reembolsar, estorne no {gatewayLabel}.
                  </>
                ) : (
                  <>
                    Pedido pago (
                    <strong>{formatBRL(pagoReembolsavel.valor)}</strong>). Para
                    devolver o dinheiro ao cliente, estorne no {gatewayLabel}.
                  </>
                )}
              </p>
              {pagoReembolsavel.externalId && (
                <p className="text-xs text-amber-700">
                  Transação {gatewayLabel}:{" "}
                  <span className="font-mono">
                    {pagoReembolsavel.externalId}
                  </span>
                </p>
              )}
              <EstornarButton
                orderId={pedido.id}
                valor={pagoReembolsavel.valor}
                gatewayLabel={gatewayLabel}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
