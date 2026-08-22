import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { PedidoForm } from "@/components/admin/PedidoForm";
import { chaveSemana } from "@/lib/semana-envio";
import { getPedidoById, getPedidoFormData } from "@/lib/queries/pedidos";
import { podeEditarItens } from "@/lib/pedido-status";

type Props = { params: Promise<{ id: string }> };

export default async function EditarPedidoPage({ params }: Props) {
  const { id } = await params;
  const [pedido, formData] = await Promise.all([
    getPedidoById(id),
    getPedidoFormData(),
  ]);
  if (!pedido) notFound();

  return (
    <div>
      <PageHeader
        title={`Editar pedido ${pedido.numero}`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Pedidos", href: "/admin/pedidos" },
          { label: pedido.numero, href: `/admin/pedidos/${pedido.id}` },
          { label: "Editar" },
        ]}
      />

      {podeEditarItens(pedido.status) ? (
        <PedidoForm
          clientes={formData.clientes}
          produtos={formData.produtos}
          initialData={{
            id: pedido.id,
            clienteId: pedido.clienteId,
            itens: pedido.itens.map((it) => ({
              produtoId: it.produtoId,
              nomeProduto: it.nomeProduto,
              precoUnitario: it.precoUnitario,
              quantidade: it.quantidade,
              composicao: it.composicao,
              qtdMachos: null, // re-derivado na action ao salvar
              qtdFemeas: null,
            })),
            frete: pedido.frete,
            desconto: pedido.desconto,
            formaPagamento: pedido.formaPagamento ?? "",
            transportadora: pedido.transportadora ?? "",
            observacoes: pedido.observacoes ?? "",
          semanaEnvio: pedido.semanaEnvio ? chaveSemana(pedido.semanaEnvio) : "",
          }}
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">
            Este pedido está <strong>pago/enviado</strong> e não pode mais ter os
            itens editados. Use o controle de status no detalhe.
          </p>
          <Link
            href={`/admin/pedidos/${pedido.id}`}
            className="text-sm text-[#FF035C] hover:underline font-medium"
          >
            ← Voltar ao pedido
          </Link>
        </div>
      )}
    </div>
  );
}
