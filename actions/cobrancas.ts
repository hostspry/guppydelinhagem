"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { cobrancaSchema } from "@/lib/validations/cobranca";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import { getPaymentProvider } from "@/lib/payments/registry";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { situacaoDaCobranca } from "@/lib/queries/cobrancas";
import { ProviderPagamento } from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";
import { type ActionResult } from "@/lib/utils/action-result";

/**
 * Cobrança avulsa — escrita.
 *
 * A cobrança é um Order `tipo = COBRANCA` com UM item avulso (productId null),
 * sem frete e sem envio. O cliente recebe `/cobrar/<publicToken>` e, ao clicar
 * em pagar, vai para o Checkout Pro do Mercado Pago — que oferece Pix e cartão
 * na mesma tela. Quem confirma é o WEBHOOK (external_reference = orderId), igual
 * ao checkout da loja: nada aqui marca pagamento por conta própria.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const soDigitos = (s: string | null | undefined) =>
  (s ?? "").replace(/\D/g, "") || null;
const nullify = (s: string | null | undefined) => {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
};

/** Token do link: 32 hex (128 bits). Não é adivinhável e cabe numa URL curta. */
function novoToken(): string {
  return randomBytes(16).toString("hex");
}

// ── Criar ────────────────────────────────────────────────────────────────────
export async function criarCobranca(formData: FormData): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");

  const parsed = cobrancaSchema.safeParse({
    clienteId: formData.get("clienteId"),
    clienteNome: formData.get("clienteNome"),
    clienteEmail: formData.get("clienteEmail"),
    clienteTelefone: formData.get("clienteTelefone"),
    descricao: formData.get("descricao"),
    valor: formData.get("valor"),
    validadeDias: formData.get("validadeDias"),
    maxParcelas: formData.get("maxParcelas"),
    observacoes: formData.get("observacoes"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;
  const valor = round2(data.valor);

  // Cliente: o escolhido na lista ou um novo criado na hora.
  let clienteId = nullify(data.clienteId);
  if (!clienteId) {
    const novo = await prisma.cliente.create({
      data: {
        nome: (data.clienteNome ?? "").trim(),
        email: nullify(data.clienteEmail),
        telefone: soDigitos(data.clienteTelefone),
      },
      select: { id: true },
    });
    clienteId = novo.id;
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return { success: false, error: "Cliente não encontrado." };

  // Snapshot do pagador (mesmo formato do pedido). Cobrança não tem entrega, mas
  // o campo é a fonte de nome/e-mail/telefone usada depois pelo gateway.
  const endereco: EnderecoEntrega = {
    nome: cliente.nome,
    cpfCnpj: cliente.cpfCnpj,
    telefone: cliente.telefone,
    email: cliente.email,
    cep: null,
    logradouro: null,
    numero: null,
    complemento: null,
    bairro: null,
    cidade: null,
    uf: null,
  };

  const expiraEm = new Date(
    Date.now() + data.validadeDias * 24 * 60 * 60 * 1000,
  );
  const token = novoToken();

  let novoId = "";
  try {
    const criada = await prisma.$transaction(async (tx) => {
      // Mesma numeração dos pedidos: a cobrança também é um documento da loja e
      // precisa de um número que o cliente possa citar no WhatsApp.
      const ano = new Date().getFullYear();
      const ultimo = await tx.order.findFirst({
        where: { ano },
        orderBy: { sequencia: "desc" },
        select: { sequencia: true },
      });
      const sequencia = (ultimo?.sequencia ?? 0) + 1;
      const numero = `#${ano}-${String(sequencia).padStart(4, "0")}`;

      return tx.order.create({
        data: {
          numero,
          ano,
          sequencia,
          tipo: "COBRANCA",
          status: "AGUARDANDO_PAGAMENTO",
          tipoEntrega: "RETIRADA", // cobrança não despacha nada
          clienteId: clienteId as string,
          enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
          observacoes: nullify(data.observacoes),
          subtotal: valor,
          frete: 0,
          desconto: 0,
          total: valor,
          publicToken: token,
          expiraEm,
          maxParcelas: data.maxParcelas,
          items: {
            create: {
              productId: null, // item avulso: a descrição é o "produto"
              nomeProduto: data.descricao,
              quantidade: 1,
              precoUnitario: valor,
            },
          },
        },
        select: { id: true, numero: true },
      });
    });
    novoId = criada.id;

    await auditar(membro, {
      acao: "cobranca.criar",
      entidade: "Order",
      entidadeId: criada.id,
      descricao: `Criou a cobrança ${criada.numero} de ${valor.toFixed(2)} para ${cliente.nome}`,
      depois: {
        descricao: data.descricao,
        valor,
        validadeDias: data.validadeDias,
        maxParcelas: data.maxParcelas,
      },
    });
  } catch (e) {
    console.error("[cobranca] criar", e);
    return { success: false, error: "Erro ao criar a cobrança." };
  }

  revalidatePath("/admin/cobrancas");
  redirect(`/admin/cobrancas/${novoId}`);
}

// ── Cancelar ─────────────────────────────────────────────────────────────────
export async function cancelarCobranca(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");

  const cob = await prisma.order.findFirst({
    where: { id, tipo: "COBRANCA" },
    select: { id: true, numero: true, status: true, expiraEm: true, total: true },
  });
  if (!cob) return { success: false, error: "Cobrança não encontrada." };

  const situacao = situacaoDaCobranca(cob);
  if (situacao === "PAGA") {
    // Cobrança paga não se cancela por aqui: o dinheiro já entrou. O caminho é o
    // estorno na tela do pedido, que devolve ao cliente e ajusta o caixa.
    return {
      success: false,
      error: "Cobrança já paga. Para devolver o dinheiro, use o estorno.",
    };
  }
  if (situacao === "CANCELADA") return { success: true, message: "Já cancelada." };

  await prisma.order.update({
    where: { id },
    data: { status: "CANCELADO" },
  });

  await auditar(membro, {
    acao: "cobranca.cancelar",
    entidade: "Order",
    entidadeId: id,
    descricao: `Cancelou a cobrança ${cob.numero} de ${Number(cob.total).toFixed(2)}`,
    antes: { status: cob.status },
    depois: { status: "CANCELADO" },
  });

  revalidatePath("/admin/cobrancas");
  revalidatePath(`/admin/cobrancas/${id}`);
  return { success: true, message: "Cobrança cancelada. O link parou de funcionar." };
}

// ── Reabrir (renova a validade) ──────────────────────────────────────────────
export async function reabrirCobranca(
  id: string,
  dias = 7,
): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");

  const cob = await prisma.order.findFirst({
    where: { id, tipo: "COBRANCA" },
    select: { id: true, numero: true, status: true, expiraEm: true },
  });
  if (!cob) return { success: false, error: "Cobrança não encontrada." };
  if (situacaoDaCobranca(cob) === "PAGA") {
    return { success: false, error: "Esta cobrança já foi paga." };
  }

  const validade = Math.min(Math.max(Math.round(dias), 1), 90);
  const expiraEm = new Date(Date.now() + validade * 24 * 60 * 60 * 1000);
  await prisma.order.update({
    where: { id },
    data: { status: "AGUARDANDO_PAGAMENTO", expiraEm },
  });

  await auditar(membro, {
    acao: "cobranca.reabrir",
    entidade: "Order",
    entidadeId: id,
    descricao: `Reabriu a cobrança ${cob.numero} por mais ${validade} dia(s)`,
    antes: { status: cob.status, expiraEm: cob.expiraEm },
    depois: { status: "AGUARDANDO_PAGAMENTO", expiraEm },
  });

  revalidatePath("/admin/cobrancas");
  revalidatePath(`/admin/cobrancas/${id}`);
  return { success: true, message: "Cobrança reaberta." };
}

// ── Pagar (público, chamado da página do link) ───────────────────────────────
export type PagarCobrancaResult =
  | { ok: true; initPoint: string }
  | { ok: false; error: string };

/**
 * Cria a preference no Mercado Pago para esta cobrança e devolve o init_point.
 * Chamado pelo botão da página pública. Não confia em nada do cliente além do
 * token: valor, descrição e teto de parcelas vêm do banco. A preference NÃO é
 * reaproveitada — o MP dedupe por idempotência própria e um link antigo pode ter
 * expirado; criar de novo é barato e sempre válido.
 */
export async function pagarCobranca(
  token: string,
): Promise<PagarCobrancaResult> {
  // Trava simples de abuso: o link é público e criar preference custa chamada ao MP.
  const ip = clientIp(await headers());
  const limite = rateLimit(`cobranca:${ip}`, 10, 60_000);
  if (!limite.ok) {
    return {
      ok: false,
      error: `Muitas tentativas. Tente de novo em ${limite.retryAfter}s.`,
    };
  }

  const cob = await prisma.order.findFirst({
    where: { tipo: "COBRANCA", publicToken: token },
    select: {
      id: true,
      numero: true,
      status: true,
      total: true,
      expiraEm: true,
      maxParcelas: true,
      enderecoEntrega: true,
      items: { select: { nomeProduto: true }, take: 1 },
    },
  });
  if (!cob) return { ok: false, error: "Cobrança não encontrada." };

  const situacao = situacaoDaCobranca(cob);
  if (situacao === "PAGA") return { ok: false, error: "Esta cobrança já foi paga." };
  if (situacao === "CANCELADA") return { ok: false, error: "Esta cobrança foi cancelada." };
  if (situacao === "EXPIRADA") {
    return { ok: false, error: "Este link de pagamento venceu. Peça um novo à loja." };
  }

  const end = cob.enderecoEntrega as unknown as EnderecoEntrega;
  const partes = (end.nome ?? "").trim().split(/\s+/);
  const descricao = cob.items[0]?.nomeProduto ?? `Cobrança ${cob.numero}`;
  const valor = round2(Number(cob.total));

  try {
    const provider = getPaymentProvider(ProviderPagamento.MERCADO_PAGO);
    const pref = await provider.criarPreferencia({
      orderId: cob.id, // external_reference — é por aqui que o webhook acha
      itens: [{ id: cob.id, title: descricao, quantity: 1, unitPrice: valor }],
      pagador: {
        nome: partes[0] || null,
        sobrenome: partes.slice(1).join(" ") || null,
        // O MP exige e-mail do pagador; sem cadastro, ele pede na própria tela.
        email: end.email ?? "",
        cpfCnpj: end.cpfCnpj,
      },
      backUrls: {
        success: `${SITE_URL}/cobrar/${token}`,
        pending: `${SITE_URL}/cobrar/${token}`,
        failure: `${SITE_URL}/cobrar/${token}`,
      },
      installmentsLimit: cob.maxParcelas ?? undefined,
      expiraEm: cob.expiraEm,
    });
    if (!pref.initPoint) {
      return { ok: false, error: "Não foi possível abrir o pagamento agora." };
    }

    await prisma.order
      .update({
        where: { id: cob.id },
        data: { mpPreferenceId: pref.preferenceId },
      })
      .catch(() => {}); // rastro útil, mas não vale travar o pagamento

    return { ok: true, initPoint: pref.initPoint };
  } catch (e) {
    console.error("[cobranca] preference", e);
    return {
      ok: false,
      error: "Não foi possível abrir o pagamento agora. Tente novamente.",
    };
  }
}

/**
 * Status da cobrança lido do BANCO (o webhook é quem confirma). Público e leve —
 * usado pelo poll da página do link, quando o cliente volta do gateway antes da
 * notificação chegar. Não chama o gateway.
 */
export async function statusDaCobranca(token: string): Promise<boolean> {
  const cob = await prisma.order.findFirst({
    where: { tipo: "COBRANCA", publicToken: token },
    select: { status: true },
  });
  return (
    cob?.status === "PAGO" ||
    cob?.status === "ENVIADO" ||
    cob?.status === "ENTREGUE"
  );
}
