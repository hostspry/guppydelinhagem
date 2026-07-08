import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getFreteGratisConfig,
  getConfiguracaoLoja,
} from "@/lib/queries/config";
import { pagbankConfigurado } from "@/lib/payments/pagbank/config";
import CheckoutClient, {
  type CheckoutPrefill,
} from "@/components/checkout/CheckoutClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finalizar pedido · Guppy de Linhagem",
  robots: { index: false, follow: false }, // checkout não indexa
};

const VAZIO: CheckoutPrefill = {
  nome: "",
  telefone: "",
  email: "",
  cpfCnpj: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

export default async function CheckoutPage() {
  // Guest por padrão; se houver sessão, pré-preenche pelo Cliente vinculado.
  const session = await auth();
  let prefill = VAZIO;

  if (session?.user?.email) {
    const cliente = await prisma.cliente.findFirst({
      where: {
        OR: [
          ...(session.user.id ? [{ userId: session.user.id }] : []),
          { email: session.user.email },
        ],
      },
    });
    prefill = {
      nome: cliente?.nome ?? "",
      telefone: cliente?.telefone ?? "",
      email: cliente?.email ?? session.user.email ?? "",
      cpfCnpj: cliente?.cpfCnpj ?? "",
      cep: cliente?.cep ?? "",
      logradouro: cliente?.logradouro ?? "",
      numero: cliente?.numero ?? "",
      complemento: cliente?.complemento ?? "",
      bairro: cliente?.bairro ?? "",
      cidade: cliente?.cidade ?? "",
      uf: cliente?.uf ?? "",
    };

    // Endereço PADRÃO do painel (Address.principal) tem precedência sobre o
    // último endereço do Cliente — é prefill, o cliente ainda pode editar tudo.
    if (session.user.id) {
      const padrao = await prisma.address.findFirst({
        where: { userId: session.user.id, principal: true },
      });
      if (padrao) {
        prefill = {
          ...prefill,
          cep: padrao.cep,
          logradouro: padrao.rua,
          numero: padrao.numero,
          complemento: padrao.complemento ?? "",
          bairro: padrao.bairro,
          cidade: padrao.cidade,
          uf: padrao.estado,
        };
      }
    }
  }

  // Public key do MP lida em RUNTIME no servidor e injetada por prop. Preferimos
  // MP_PUBLIC_KEY (sem prefixo → NÃO é inlinada no build, vem do runtime do
  // Coolish) e caímos em NEXT_PUBLIC_MP_PUBLIC_KEY (dev local / legado). Public
  // key não é segredo — vai ao client de qualquer forma. Isso evita a fragilidade
  // do inlining em build-time (key velha grudada / key ausente no build).
  const mpPublicKey =
    process.env.MP_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ||
    null;

  // Regra de frete grátis (toggle + valor) p/ o resumo zerar o frete na exibição.
  // O servidor (criarOrderDoCheckout) reaplica a mesma regra — fonte da verdade.
  // getConfiguracaoLoja é cacheada no request (React.cache), então não dobra a query.
  const [freteGratis, config] = await Promise.all([
    getFreteGratisConfig(),
    getConfiguracaoLoja(),
  ]);

  // PagBank (checkout hospedado): só oferece se o toggle do admin estiver ligado E
  // o token estiver configurado no servidor. O cliente é redirecionado à página do
  // PagBank — não precisa de chave pública nem SDK no nosso front.
  const pagbank = {
    ativo: config.pagbankAtivo && pagbankConfigurado(),
  };

  return (
    <CheckoutClient
      prefill={prefill}
      mpPublicKey={mpPublicKey}
      pagbank={pagbank}
      freteGratis={freteGratis}
      retirada={{
        ativo: config.retiradaLocalAtiva,
        instrucoes: config.retiradaInstrucoes,
      }}
    />
  );
}
