"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import { notificarConfirmacaoAereo } from "@/lib/notificacoes";
import { unidadesParaCliente, type UnidadesParaCliente } from "@/lib/gollog/unidades";
import {
  ehEnvioAereoPendente,
  garantirTokenConfirmacao,
  linkConfirmacao,
  pedirConfirmacaoEnvioAereo,
} from "@/lib/gollog/confirmacao";
import { confirmacaoAereoSchema } from "@/lib/validations/envio-aereo";
import { cpfValido } from "@/lib/whatsapp-cliente";
import type { Prisma } from "@/lib/generated/prisma/client";

type Resultado =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// ── Público: página do link ─────────────────────────────────

/** Unidades ordenadas pela distância do endereço digitado (a página chama quando o CEP muda). */
export async function unidadesParaEndereco(
  cep: string,
  cidade: string,
  uf: string,
): Promise<UnidadesParaCliente | null> {
  const h = await headers();
  if (!rateLimit(`bases-aereo:${clientIp(h)}`, 20, 60_000).ok) return null;
  return unidadesParaCliente({
    cep: String(cep ?? "").slice(0, 9),
    cidade: String(cidade ?? "").slice(0, 80),
    uf: String(uf ?? "").slice(0, 2),
  });
}

/** Unidade ativa e ainda na lista da Gollog. */
async function unidadeValida(id: string) {
  if (!id) return null;
  return prisma.unidadeGollog.findFirst({
    where: { id, ativa: true, naListaGollog: true },
    select: { id: true, codigo: true, titulo: true, cidade: true, uf: true },
  });
}

/**
 * O cliente confirma endereço, unidade da Gollog e quem retira.
 *
 * O link é o segredo (token longo, único por pedido). Enquanto a caixa não
 * saiu, dá para confirmar de novo e corrigir. O endereço confirmado vira o do
 * pedido e o do cadastro: quem acabou de digitar é quem sabe onde mora.
 */
export async function confirmarEnvioAereo(token: string, input: unknown): Promise<Resultado> {
  const h = await headers();
  if (!rateLimit(`confirmar-aereo:${clientIp(h)}`, 8, 10 * 60_000).ok) {
    return { ok: false, error: "Muitas tentativas seguidas. Aguarde alguns minutos." };
  }

  const pedido = token
    ? await prisma.order.findUnique({
        where: { confirmacaoEnvioToken: String(token) },
        select: {
          id: true,
          numero: true,
          status: true,
          transportadora: true,
          modalidadeFrete: true,
          tipoEntrega: true,
          clienteId: true,
        },
      })
    : null;
  if (!pedido) return { ok: false, error: "Link inválido. Peça um novo pelo WhatsApp." };
  if (!ehEnvioAereoPendente(pedido)) {
    return {
      ok: false,
      error: "Esta caixa já foi despachada ou o pedido mudou. Fale comigo pelo WhatsApp.",
    };
  }

  const parsed = confirmacaoAereoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os campos marcados em vermelho.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const d = parsed.data;
  if (d.site) return { ok: true }; // isca de robô

  const base = await unidadeValida(d.unidadeId);
  if (!base) {
    return { ok: false, error: "Escolha onde vai retirar.", fieldErrors: { unidadeId: ["Escolha uma unidade da lista"] } };
  }

  const endereco = {
    nome: d.nome,
    cpfCnpj: d.cpfCnpj,
    telefone: d.telefone,
    email: d.email || null,
    cep: d.cep,
    logradouro: d.logradouro,
    numero: d.numero,
    complemento: d.complemento || null,
    bairro: d.bairro,
    cidade: d.cidade,
    uf: d.uf,
  };

  try {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: pedido.id },
        data: {
          enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
          aeroportoDestino: base.codigo,
          unidadeGollogId: base.id,
          recebedorNome: d.outraPessoaRetira ? d.recebedorNome : null,
          recebedorCpf: d.outraPessoaRetira ? d.recebedorCpf : null,
          recebedorTelefone: d.outraPessoaRetira ? d.recebedorTelefone : null,
          confirmacaoEnvioEm: new Date(),
        },
      }),
      prisma.cliente.update({
        where: { id: pedido.clienteId },
        data: { ...endereco, email: d.email || undefined },
      }),
    ]);
  } catch (e) {
    console.error("[envio-aereo] confirmar", e);
    return { ok: false, error: "Não consegui salvar agora. Tente de novo em instantes." };
  }

  await notificarConfirmacaoAereo({
    orderId: pedido.id,
    numero: pedido.numero,
    nome: d.nome,
    aeroporto: base.titulo,
    recebedor: d.outraPessoaRetira ? d.recebedorNome : null,
  });

  return { ok: true };
}

// ── Painel ──────────────────────────────────────────────────

export async function pedirConfirmacaoAereo(
  orderId: string,
): Promise<{ ok: true; para: string } | { ok: false; error: string; link?: string }> {
  const membro = await assertPermissao("pedidos.envio");
  const r = await pedirConfirmacaoEnvioAereo(orderId, { forcar: true });
  if (!r.ok) return { ok: false, error: r.motivo, link: r.link };
  await auditar(membro, {
    acao: "pedido.aereo.pedir-confirmacao",
    entidade: "Order",
    entidadeId: orderId,
    descricao: `Pediu a confirmação do envio aéreo para ${r.para}`,
  });
  revalidatePath(`/admin/pedidos/${orderId}`);
  return { ok: true, para: r.para };
}

/** Link para mandar pelo WhatsApp (e-mail cai no spam). */
export async function linkConfirmacaoAereo(
  orderId: string,
): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  await assertPermissao("pedidos.envio");
  const token = await garantirTokenConfirmacao(orderId);
  if (!token) return { ok: false, error: "Pedido não encontrado." };
  return { ok: true, link: linkConfirmacao(token) };
}

/** O dono define a unidade e quem retira, quando o cliente combinou na conversa. */
export async function definirEnvioAereo(
  orderId: string,
  input: { unidadeId: string; recebedorNome?: string; recebedorCpf?: string; recebedorTelefone?: string },
): Promise<Resultado> {
  const membro = await assertPermissao("pedidos.envio");

  const unidadeId = String(input.unidadeId ?? "").trim();
  const unidade = unidadeId ? await unidadeValida(unidadeId) : null;
  if (unidadeId && !unidade) return { ok: false, error: "Unidade desligada ou fora da lista da Gollog." };

  const nome = String(input.recebedorNome ?? "").trim();
  const cpf = String(input.recebedorCpf ?? "").replace(/\D/g, "");
  const tel = String(input.recebedorTelefone ?? "").replace(/\D/g, "");
  if (nome && cpf && !cpfValido(cpf)) return { ok: false, error: "CPF de quem retira não confere." };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      aeroportoDestino: unidade?.codigo ?? null,
      unidadeGollogId: unidade?.id ?? null,
      recebedorNome: nome || null,
      recebedorCpf: nome ? cpf || null : null,
      recebedorTelefone: nome ? tel || null : null,
    },
  });

  await auditar(membro, {
    acao: "pedido.aereo.definir",
    entidade: "Order",
    entidadeId: orderId,
    descricao: `Definiu a retirada aérea em ${unidade?.titulo ?? "(sem unidade)"}${nome ? ` por ${nome}` : ""}`,
  });
  revalidatePath(`/admin/pedidos/${orderId}`);
  return { ok: true, message: "Envio aéreo atualizado." };
}
