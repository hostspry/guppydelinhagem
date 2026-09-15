import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plane } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { unidadesParaCliente, unidadeDaCidade } from "@/lib/gollog/unidades";
import { ehEnvioAereoPendente } from "@/lib/gollog/confirmacao";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import { ConfirmacaoAereoForm } from "@/components/site/ConfirmacaoAereoForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirme onde retirar seus peixes | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

/**
 * Link do e-mail do envio aéreo. O cliente confirma endereço, CPF, a unidade
 * da Gollog onde vai buscar a caixa e quem retira. O token é o segredo: sem login, porque
 * quem compra pelo WhatsApp não tem conta.
 */
export default async function EnvioAereoPage({ params }: Props) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const pedido = await prisma.order.findUnique({
    where: { confirmacaoEnvioToken: token },
    select: {
      numero: true,
      status: true,
      transportadora: true,
      modalidadeFrete: true,
      tipoEntrega: true,
      enderecoEntrega: true,
      aeroportoDestino: true,
      unidadeGollogId: true,
      recebedorNome: true,
      recebedorCpf: true,
      recebedorTelefone: true,
      confirmacaoEnvioEm: true,
      items: { select: { nomeProduto: true, quantidade: true } },
    },
  });
  if (!pedido) notFound();

  const end = (pedido.enderecoEntrega ?? {}) as Partial<EnderecoEntrega>;
  const aberto = ehEnvioAereoPendente(pedido);
  const { unidades, fonteDistancia } = await unidadesParaCliente(end);
  // Já vem marcada só a escolhida ou a unidade da cidade do cliente. A mais
  // perto em outra cidade não: o cliente pode retirar em outro lugar, e marcar
  // por ele faz parecer que a loja já decidiu.
  const escolhida =
    unidades.find((u) => u.id === pedido.unidadeGollogId) ??
    (pedido.aeroportoDestino && !pedido.unidadeGollogId
      ? unidades.find((u) => u.codigo === pedido.aeroportoDestino)
      : undefined);
  const sugerido = (escolhida ?? unidadeDaCidade(unidades))?.id ?? "";

  return (
    <div className="bg-muted/30 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center mb-8">
          <Plane className="w-8 h-8 text-secondary mx-auto mb-2" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">
            Onde você vai retirar seus peixes
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
            Pedido <strong className="text-primary">{pedido.numero}</strong>. O envio
            aéreo não chega em casa: a caixa fica numa unidade da Gollog para
            retirada. Confirme seus dados, onde vai retirar e quem vai buscar.
          </p>
          <ul className="mt-3 text-xs text-muted-foreground">
            {pedido.items.map((it, i) => (
              <li key={i}>
                {it.quantidade}x {it.nomeProduto}
              </li>
            ))}
          </ul>
        </header>

        {aberto ? (
          <ConfirmacaoAereoForm
            token={token}
            jaConfirmado={!!pedido.confirmacaoEnvioEm}
            aeroportoEscolhido={!!escolhida}
            fonteDistancia={fonteDistancia}
            inicial={{
              nome: end.nome ?? "",
              cpfCnpj: end.cpfCnpj ?? "",
              telefone: end.telefone ?? "",
              email: end.email ?? "",
              cep: end.cep ?? "",
              logradouro: end.logradouro ?? "",
              numero: end.numero ?? "",
              complemento: end.complemento ?? "",
              bairro: end.bairro ?? "",
              cidade: end.cidade ?? "",
              uf: end.uf ?? "",
              unidadeId: sugerido,
              outraPessoaRetira: !!pedido.recebedorNome,
              recebedorNome: pedido.recebedorNome ?? "",
              recebedorCpf: pedido.recebedorCpf ?? "",
              recebedorTelefone: pedido.recebedorTelefone ?? "",
            }}
            unidades={unidades}
          />
        ) : (
          <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-muted-foreground">
            {pedido.status === "ENVIADO" || pedido.status === "ENTREGUE"
              ? "Sua caixa já foi despachada. Qualquer ajuste agora, fale comigo pelo WhatsApp."
              : "Este pedido não está mais aguardando envio aéreo. Fale comigo pelo WhatsApp."}
          </div>
        )}
      </div>
    </div>
  );
}
