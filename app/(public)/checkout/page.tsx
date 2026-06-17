import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CheckoutClient, {
  type CheckoutPrefill,
} from "@/components/checkout/CheckoutClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finalizar pedido — Guppy de Linhagem",
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
  }

  return <CheckoutClient prefill={prefill} />;
}
