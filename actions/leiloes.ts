"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import { chaveTelefone } from "@/lib/sorteios/telefone";
import { acharOuCriarArrematante } from "@/lib/leiloes/arrematante";
import { lerListaDeLotes } from "@/lib/leiloes/lista";
import {
  meioDiaBRT,
  rotuloLote,
  situacaoDoArremate,
} from "@/lib/leiloes/situacao";
import { leilaoSchema, loteSchema, PEIXES_POR_LOTE } from "@/lib/validations/leilao";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import { transicionarParaPago } from "@/lib/pedido-baixa";
import { pedirConfirmacaoEnvioAereo } from "@/lib/gollog/confirmacao";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { ActionResult } from "@/lib/utils/action-result";

/**
 * Leilões — escrita (painel).
 *
 * Fluxo: cria o leilão → lança os lotes (um a um ou colando a lista) → "Cobrar"
 * junta os lotes ainda sem cobrança de cada arrematante num pedido de origem
 * LEILAO, com link próprio. Lote cobrado em pedido ainda não pago pode ser
 * corrigido: o pedido é refeito na hora e o cliente escolhe o frete de novo.
 * Lote de pedido pago não muda mais — dinheiro que entrou se desfaz por estorno.
 */

type Tx = Prisma.TransactionClient;

const round2 = (n: number) => Math.round(n * 100) / 100;
const nullify = (s: string | null | undefined) => {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
};
const PAGO = ["PAGO", "ENVIADO", "ENTREGUE"];

function revalidar(leilaoId: string) {
  revalidatePath("/admin/leiloes");
  revalidatePath(`/admin/leiloes/${leilaoId}`);
  revalidatePath("/admin/pedidos");
}

// ── Leilão ───────────────────────────────────────────────────────────────────
export async function salvarLeilao(
  id: string | null,
  formData: FormData,
): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");
  const parsed = leilaoSchema.safeParse({
    nome: formData.get("nome"),
    dataLeilao: formData.get("dataLeilao"),
    maxParcelas: formData.get("maxParcelas") ?? "",
    observacoes: formData.get("observacoes") ?? "",
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;
  const data = {
    nome: d.nome,
    dataLeilao: meioDiaBRT(d.dataLeilao),
    maxParcelas: d.maxParcelas,
    observacoes: nullify(d.observacoes),
  };

  if (id) {
    const antes = await prisma.leilao.findUnique({ where: { id } });
    if (!antes) return { success: false, error: "Leilão não encontrado." };
    await prisma.leilao.update({ where: { id }, data });
    await auditar(membro, {
      acao: "leilao.editar",
      entidade: "Leilao",
      entidadeId: id,
      descricao: `Editou o leilão ${d.nome}`,
      antes: {
        nome: antes.nome,
        dataLeilao: antes.dataLeilao,
        maxParcelas: antes.maxParcelas,
      },
      depois: data,
    });
    revalidar(id);
    return { success: true, message: "Leilão salvo." };
  }

  const novo = await prisma.leilao.create({ data, select: { id: true } });
  await auditar(membro, {
    acao: "leilao.criar",
    entidade: "Leilao",
    entidadeId: novo.id,
    descricao: `Criou o leilão ${d.nome}`,
    depois: data,
  });
  revalidatePath("/admin/leiloes");
  redirect(`/admin/leiloes/${novo.id}`);
}

export async function excluirLeilao(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");
  const l = await prisma.leilao.findUnique({
    where: { id },
    select: { nome: true, _count: { select: { pedidos: true, lotes: true } } },
  });
  if (!l) return { success: false, error: "Leilão não encontrado." };
  if (l._count.pedidos > 0) {
    return {
      success: false,
      error: "Este leilão já tem cobranças. Cancele as cobranças em aberto em vez de excluir o leilão.",
    };
  }
  await prisma.leilao.delete({ where: { id } });
  await auditar(membro, {
    acao: "leilao.excluir",
    entidade: "Leilao",
    entidadeId: id,
    descricao: `Excluiu o leilão ${l.nome} (${l._count.lotes} lote(s), sem cobranças)`,
  });
  revalidatePath("/admin/leiloes");
  redirect("/admin/leiloes");
}

// ── Arrematante ──────────────────────────────────────────────────────────────

/** Busca para o campo "quem arrematou" (nome ou pedaço do número). */
export async function buscarArrematantes(
  termo: string,
): Promise<{ id: string; nome: string; telefone: string | null }[]> {
  await assertPermissao("pedidos.editar");
  const q = (termo ?? "").trim();
  if (q.length < 2) return [];
  const digitos = q.replace(/\D/g, "");
  return prisma.cliente.findMany({
    where: {
      OR: [
        { nome: { contains: q, mode: "insensitive" } },
        ...(digitos.length >= 4 ? [{ telefone: { contains: digitos } }] : []),
      ],
    },
    orderBy: { nome: "asc" },
    take: 8,
    select: { id: true, nome: true, telefone: true },
  });
}

// ── Pedido da cobrança ───────────────────────────────────────────────────────

/**
 * Refaz os itens e o total do pedido a partir dos lotes ligados a ele. Como o
 * frete depende dos lotes (seguro por peixe, limite por caixa), a escolha de
 * entrega volta a ficar em aberto: o cliente confirma o frete de novo. Pedido
 * que ficou sem lote nenhum é cancelado.
 */
async function refazerCobranca(tx: Tx, orderId: string): Promise<void> {
  const o = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      lotesLeilao: {
        orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
        select: { numero: true, nome: true, valor: true },
      },
    },
  });
  if (!o || PAGO.includes(o.status) || o.status === "CANCELADO") return;

  if (o.lotesLeilao.length === 0) {
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELADO" } });
    return;
  }
  const subtotal = round2(o.lotesLeilao.reduce((a, l) => a + Number(l.valor), 0));
  await tx.order.update({
    where: { id: orderId },
    data: {
      subtotal,
      frete: 0,
      total: subtotal,
      entregaEscolhidaEm: null,
      expiraEm: null, // cobrança antiga com validade volta a aceitar pagamento
      tipoEntrega: "ENVIO",
      transportadora: null,
      modalidadeFrete: null,
      items: {
        deleteMany: {},
        create: o.lotesLeilao.map((l) => ({
          productId: null,
          nomeProduto: rotuloLote(l),
          quantidade: 1,
          precoUnitario: l.valor,
        })),
      },
    },
  });
  // Pix emitido com o valor antigo não vale mais para esta cobrança.
  await tx.pagamento.updateMany({
    where: { orderId, metodo: "PIX", status: "PENDENTE" },
    data: { status: "EXPIRADO" },
  });
}

/** O lote está numa cobrança já paga? Aí não se mexe mais nele. */
async function lotePago(orderId: string | null): Promise<boolean> {
  if (!orderId) return false;
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  return !!o && PAGO.includes(o.status);
}

// ── Lotes ────────────────────────────────────────────────────────────────────
export async function salvarLote(
  leilaoId: string,
  loteId: string | null,
  formData: FormData,
): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");
  const parsed = loteSchema.safeParse({
    numero: formData.get("numero") ?? "",
    nome: formData.get("nome"),
    qtdPeixes: formData.get("qtdPeixes") ?? "",
    valor: formData.get("valor"),
    clienteId: formData.get("clienteId") ?? "",
    clienteNome: formData.get("clienteNome") ?? "",
    clienteTelefone: formData.get("clienteTelefone") ?? "",
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  const leilao = await prisma.leilao.findUnique({ where: { id: leilaoId }, select: { id: true } });
  if (!leilao) return { success: false, error: "Leilão não encontrado." };

  // Arrematante: escolhido na busca, ou achado/criado pelo WhatsApp.
  let clienteId = nullify(d.clienteId);
  if (clienteId) {
    const existe = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
    if (!existe) return { success: false, error: "Cliente não encontrado." };
  } else {
    const telBruto = nullify(d.clienteTelefone);
    const telefone = telBruto ? chaveTelefone(telBruto) : null;
    if (telBruto && !telefone) {
      return {
        success: false,
        error: "WhatsApp inválido",
        fieldErrors: { clienteTelefone: ["Confira o número (com DDD)."] },
      };
    }
    clienteId = await acharOuCriarArrematante((d.clienteNome ?? "").trim(), telefone);
  }

  const dados = {
    numero: nullify(d.numero),
    nome: d.nome,
    qtdPeixes: d.qtdPeixes,
    valor: round2(d.valor),
    clienteId,
  };

  if (loteId) {
    const antes = await prisma.loteLeilao.findFirst({
      where: { id: loteId, leilaoId },
    });
    if (!antes) return { success: false, error: "Lote não encontrado." };
    if (await lotePago(antes.orderId)) {
      return {
        success: false,
        error: "Este lote já foi pago. Para mudar algo, estorne o pedido antes.",
      };
    }
    const trocouArrematante = antes.clienteId !== clienteId;
    await prisma.$transaction(async (tx) => {
      await tx.loteLeilao.update({
        where: { id: loteId },
        // Trocou quem arrematou: sai da cobrança do anterior e espera a próxima
        // rodada de "Cobrar", que junta com os lotes do novo arrematante.
        data: { ...dados, ...(trocouArrematante ? { orderId: null } : {}) },
      });
      if (antes.orderId) await refazerCobranca(tx, antes.orderId);
    });
    await auditar(membro, {
      acao: "leilao.lote.editar",
      entidade: "LoteLeilao",
      entidadeId: loteId,
      descricao: `Editou o ${rotuloLote(dados)} (R$ ${dados.valor.toFixed(2)})`,
      antes: {
        numero: antes.numero,
        nome: antes.nome,
        valor: Number(antes.valor),
        clienteId: antes.clienteId,
        qtdPeixes: antes.qtdPeixes,
      },
      depois: dados,
    });
    revalidar(leilaoId);
    return {
      success: true,
      message: antes.orderId
        ? trocouArrematante
          ? "Lote salvo. Ele saiu da cobrança anterior: clique em Cobrar para cobrar o novo arrematante."
          : "Lote salvo. A cobrança foi atualizada e o cliente escolhe o frete de novo."
        : "Lote salvo.",
    };
  }

  const ultimo = await prisma.loteLeilao.findFirst({
    where: { leilaoId },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });
  const criado = await prisma.loteLeilao.create({
    data: { ...dados, leilaoId, ordem: (ultimo?.ordem ?? 0) + 1 },
    select: { id: true },
  });
  await auditar(membro, {
    acao: "leilao.lote.criar",
    entidade: "LoteLeilao",
    entidadeId: criado.id,
    descricao: `Lançou o ${rotuloLote(dados)} (R$ ${dados.valor.toFixed(2)})`,
    depois: dados,
  });
  revalidar(leilaoId);
  return { success: true, message: "Lote lançado." };
}

export async function excluirLote(loteId: string): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");
  const lote = await prisma.loteLeilao.findUnique({ where: { id: loteId } });
  if (!lote) return { success: false, error: "Lote não encontrado." };
  if (await lotePago(lote.orderId)) {
    return { success: false, error: "Este lote já foi pago. Estorne o pedido antes de tirar o lote." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.loteLeilao.delete({ where: { id: loteId } });
    if (lote.orderId) await refazerCobranca(tx, lote.orderId);
  });
  await auditar(membro, {
    acao: "leilao.lote.excluir",
    entidade: "LoteLeilao",
    entidadeId: loteId,
    descricao: `Excluiu o ${rotuloLote(lote)} (R$ ${Number(lote.valor).toFixed(2)})`,
    antes: { nome: lote.nome, valor: Number(lote.valor), clienteId: lote.clienteId, orderId: lote.orderId },
  });
  revalidar(lote.leilaoId);
  return { success: true, message: "Lote excluído." };
}

/**
 * Lança vários lotes de uma vez a partir da lista colada. Tudo ou nada: se uma
 * linha tiver problema, nada entra e a tela mostra o que corrigir.
 */
export async function importarLotes(
  leilaoId: string,
  texto: string,
): Promise<ActionResult & { erros?: string[] }> {
  const membro = await assertPermissao("pedidos.editar");
  const leilao = await prisma.leilao.findUnique({ where: { id: leilaoId }, select: { nome: true } });
  if (!leilao) return { success: false, error: "Leilão não encontrado." };

  const { lotes, erros } = lerListaDeLotes(texto ?? "");
  if (erros.length) {
    return { success: false, error: "Corrija a lista antes de lançar.", erros };
  }
  if (lotes.length === 0) {
    return { success: false, error: "Nenhum lote na lista." };
  }

  // Um arrematante por número: dois lotes do mesmo WhatsApp viram o mesmo cliente.
  const porTelefone = new Map<string, string>();
  const clientes: string[] = [];
  for (const l of lotes) {
    const chave = l.telefone ?? `nome:${l.arrematante.toLowerCase()}`;
    let id = porTelefone.get(chave);
    if (!id) {
      id = await acharOuCriarArrematante(l.arrematante, l.telefone);
      porTelefone.set(chave, id);
    }
    clientes.push(id);
  }

  const ultimo = await prisma.loteLeilao.findFirst({
    where: { leilaoId },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });
  const base = ultimo?.ordem ?? 0;
  await prisma.loteLeilao.createMany({
    data: lotes.map((l, i) => ({
      leilaoId,
      numero: l.numero,
      nome: l.nome,
      qtdPeixes: l.qtdPeixes ?? PEIXES_POR_LOTE,
      valor: l.valor,
      clienteId: clientes[i],
      ordem: base + i + 1,
    })),
  });

  await auditar(membro, {
    acao: "leilao.lote.importar",
    entidade: "Leilao",
    entidadeId: leilaoId,
    descricao: `Lançou ${lotes.length} lote(s) colando a lista no leilão ${leilao.nome}`,
    depois: { lotes: lotes.length, arrematantes: porTelefone.size },
  });
  revalidar(leilaoId);
  return {
    success: true,
    message: `${lotes.length} lote(s) lançado(s) para ${porTelefone.size} arrematante(s).`,
  };
}

// ── Cobrar ───────────────────────────────────────────────────────────────────

type LeilaoParaCobrar = { id: string; nome: string; maxParcelas: number };

/**
 * Cobra os lotes de UM arrematante: entram na cobrança dele que ainda está em
 * aberto neste leilão, ou nasce uma cobrança nova. Usado pelo "Cobrar todos"
 * e pela baixa manual (que precisa do pedido para registrar o pagamento).
 */
async function cobrarGrupo(
  leilao: LeilaoParaCobrar,
  clienteId: string,
  loteIds: string[],
): Promise<"criada" | "somada"> {
  const leilaoId = leilao.id;
  return prisma.$transaction(async (tx) => {
    const aberta = await tx.order.findFirst({
      where: {
        leilaoId,
        clienteId,
        origem: "LEILAO",
        status: "AGUARDANDO_PAGAMENTO",
        pagamentos: { none: { status: { in: ["PAGO", "EM_ANALISE"] } } },
      },
      orderBy: { criadoEm: "desc" },
      select: { id: true },
    });
    if (aberta) {
      await tx.loteLeilao.updateMany({
        where: { id: { in: loteIds } },
        data: { orderId: aberta.id },
      });
      await refazerCobranca(tx, aberta.id);
      return "somada" as const;
    }

    const cliente = await tx.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    const lotes = await tx.loteLeilao.findMany({
      where: { id: { in: loteIds } },
      orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
      select: { numero: true, nome: true, valor: true },
    });
    const subtotal = round2(lotes.reduce((a, l) => a + Number(l.valor), 0));
    // Snapshot do cadastro como ponto de partida; o cliente completa e
    // confirma tudo na página antes de pagar.
    const endereco: EnderecoEntrega = {
      nome: cliente.nome,
      cpfCnpj: cliente.cpfCnpj,
      telefone: cliente.telefone,
      email: cliente.email,
      cep: cliente.cep,
      logradouro: cliente.logradouro,
      numero: cliente.numero,
      complemento: cliente.complemento,
      bairro: cliente.bairro,
      cidade: cliente.cidade,
      uf: cliente.uf,
    };

    const ano = new Date().getFullYear();
    const ultimo = await tx.order.findFirst({
      where: { ano },
      orderBy: { sequencia: "desc" },
      select: { sequencia: true },
    });
    const sequencia = (ultimo?.sequencia ?? 0) + 1;
    const pedido = await tx.order.create({
      data: {
        numero: `#${ano}-${String(sequencia).padStart(4, "0")}`,
        ano,
        sequencia,
        tipo: "PEDIDO",
        origem: "LEILAO",
        status: "AGUARDANDO_PAGAMENTO",
        tipoEntrega: "ENVIO",
        clienteId,
        userId: cliente.userId,
        leilaoId,
        enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
        subtotal,
        frete: 0,
        desconto: 0,
        total: subtotal,
        // 128 bits: o número do pedido é sequencial, o link não pode ser.
        publicToken: randomBytes(16).toString("hex"),
        // Sem validade: o link do leilão não vence (decisão do dono). O
        // combinado de pagar em 48h é conversa, não trava.
        maxParcelas: leilao.maxParcelas,
        observacoes: `Arremate: ${leilao.nome}`,
        items: {
          create: lotes.map((l) => ({
            productId: null,
            nomeProduto: rotuloLote(l),
            quantidade: 1,
            precoUnitario: l.valor,
          })),
        },
      },
      select: { id: true },
    });
    await tx.loteLeilao.updateMany({
      where: { id: { in: loteIds } },
      data: { orderId: pedido.id },
    });
    return "criada" as const;
  });
}

/**
 * Gera as cobranças dos lotes ainda não cobrados: uma por arrematante, com
 * todos os lotes dele. Se o arrematante já tem cobrança em aberto neste leilão
 * (ex.: um lote lançado depois), o lote entra nela em vez de abrir outra.
 */
export async function cobrarArrematantes(leilaoId: string): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");
  const leilao = await prisma.leilao.findUnique({
    where: { id: leilaoId },
    select: { id: true, nome: true, maxParcelas: true },
  });
  if (!leilao) return { success: false, error: "Leilão não encontrado." };

  const pendentes = await prisma.loteLeilao.findMany({
    where: { leilaoId, orderId: null },
    select: { id: true, clienteId: true },
  });
  if (pendentes.length === 0) {
    return { success: false, error: "Todos os lotes já estão cobrados." };
  }

  const grupos = new Map<string, string[]>();
  for (const l of pendentes) {
    grupos.set(l.clienteId, [...(grupos.get(l.clienteId) ?? []), l.id]);
  }

  let criadas = 0;
  let somadas = 0;
  const falhas: string[] = [];

  for (const [clienteId, loteIds] of grupos) {
    try {
      const r = await cobrarGrupo(leilao, clienteId, loteIds);
      if (r === "criada") criadas++;
      else somadas++;
    } catch (e) {
      console.error("[leilao] cobrar", clienteId, e);
      falhas.push(clienteId);
    }
  }

  await auditar(membro, {
    acao: "leilao.cobrar",
    entidade: "Leilao",
    entidadeId: leilaoId,
    descricao: `Gerou ${criadas} cobrança(s) do leilão ${leilao.nome}${somadas ? ` e somou lotes em ${somadas}` : ""}`,
    depois: { criadas, somadas, lotes: pendentes.length, falhas: falhas.length },
  });
  revalidar(leilaoId);

  const partes = [
    criadas ? `${criadas} cobrança(s) gerada(s)` : null,
    somadas ? `${somadas} cobrança(s) em aberto receberam lotes novos` : null,
  ].filter(Boolean);
  if (falhas.length) {
    return {
      success: false,
      error: `${partes.join(" e ") || "Nada foi gerado"}. ${falhas.length} arrematante(s) falharam; tente de novo.`,
    };
  }
  return { success: true, message: `${partes.join(" e ")}.` };
}

async function cobrancaDoLeilao(orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, origem: "LEILAO" },
    select: {
      id: true,
      numero: true,
      status: true,
      expiraEm: true,
      entregaEscolhidaEm: true,
      leilaoId: true,
      total: true,
    },
  });
}

/** Cancela a cobrança e devolve os lotes para "sem cobrança". */
export async function cancelarCobrancaLeilao(orderId: string): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");
  const o = await cobrancaDoLeilao(orderId);
  if (!o) return { success: false, error: "Cobrança não encontrada." };
  const situacao = situacaoDoArremate(o);
  if (situacao === "PAGA") {
    return { success: false, error: "Cobrança já paga. Para devolver o dinheiro, use o estorno no pedido." };
  }
  if (situacao === "CANCELADA") return { success: true, message: "Já estava cancelada." };

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELADO" } });
    await tx.loteLeilao.updateMany({ where: { orderId }, data: { orderId: null } });
    await tx.pagamento.updateMany({
      where: { orderId, metodo: "PIX", status: "PENDENTE" },
      data: { status: "EXPIRADO" },
    });
  });
  await auditar(membro, {
    acao: "leilao.cobranca.cancelar",
    entidade: "Order",
    entidadeId: orderId,
    descricao: `Cancelou a cobrança de leilão ${o.numero} (${Number(o.total).toFixed(2)})`,
    antes: { status: o.status },
    depois: { status: "CANCELADO" },
  });
  if (o.leilaoId) revalidar(o.leilaoId);
  return {
    success: true,
    message: "Cobrança cancelada. Os lotes voltaram para a lista sem cobrança.",
  };
}

// ── Pago por fora ────────────────────────────────────────────────────────────

const FORMAS_FORA = {
  PIX: { forma: "PIX", rotulo: "Pix direto" },
  PICPAY: { forma: "OUTRO", rotulo: "PicPay" },
  OUTRO: { forma: "OUTRO", rotulo: "outro meio" },
} as const;
export type FormaPagamentoFora = keyof typeof FORMAS_FORA;

/** Como sai o envio de quem pagou por fora (combinado no WhatsApp). */
export type EnvioFora = "TERRESTRE" | "AEREO" | "RETIRADA" | "COMBINAR";

/**
 * O leilão também aceita Pix direto e PicPay, fora do site. Quem pagou assim
 * não pode continuar com a cobrança em aberto (pagaria de novo pelo link):
 * aqui a cobrança vira PAGA pelo mesmo caminho do painel (baixa, caixa) e o
 * link passa a mostrar "pagamento confirmado".
 *
 * Frete e envio: se o cliente já escolheu no link, vale o que ele escolheu. Se
 * não, entram o frete e o envio informados aqui (o combinado no WhatsApp). O
 * endereço é o do cadastro; dá para ajustar na tela do pedido, como em qualquer
 * venda pelo WhatsApp.
 */
export async function registrarPagamentoForaLeilao(
  orderId: string,
  input: { forma: FormaPagamentoFora; frete: number; envio?: EnvioFora },
): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.status");
  const f = FORMAS_FORA[input.forma];
  if (!f) return { success: false, error: "Forma de pagamento inválida." };

  const o = await prisma.order.findFirst({
    where: { id: orderId, origem: "LEILAO" },
    select: {
      id: true,
      numero: true,
      status: true,
      expiraEm: true,
      entregaEscolhidaEm: true,
      subtotal: true,
      frete: true,
      modalidadeFrete: true,
      observacoes: true,
      leilaoId: true,
    },
  });
  if (!o) return { success: false, error: "Cobrança não encontrada." };
  const situacao = situacaoDoArremate(o);
  if (situacao === "PAGA") return { success: true, message: "Já estava paga." };
  if (situacao === "CANCELADA") {
    return { success: false, error: "Cobrança cancelada. Gere de novo pelos lotes antes de registrar o pagamento." };
  }

  const freteInformado = Number(input.frete);
  if (!o.entregaEscolhidaEm && (!Number.isFinite(freteInformado) || freteInformado < 0)) {
    return { success: false, error: "Frete inválido." };
  }
  const frete = o.entregaEscolhidaEm ? Number(o.frete) : round2(freteInformado);
  const total = round2(Number(o.subtotal) + frete);
  const nota = `Pago por fora (${f.rotulo}), registrado por ${membro.nome}.`;

  // Envio combinado por fora vira a entrega do pedido (é o que a tela de
  // pedido usa para oferecer minuta Gollog ou etiqueta). "Combinar" deixa em
  // aberto para resolver depois, na tela do pedido.
  const envio = !o.entregaEscolhidaEm && input.envio && input.envio !== "COMBINAR" ? input.envio : null;
  const entrega = envio
    ? {
        entregaEscolhidaEm: new Date(),
        tipoEntrega: envio === "RETIRADA" ? ("RETIRADA" as const) : ("ENVIO" as const),
        transportadora: envio === "AEREO" ? ("GOLLOG" as const) : envio === "TERRESTRE" ? ("JADLOG" as const) : null,
        modalidadeFrete: envio === "RETIRADA" ? null : envio,
      }
    : {};
  const aereo = envio ? envio === "AEREO" : o.modalidadeFrete === "AEREO";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: o.id },
        data: {
          formaPagamento: f.forma,
          frete,
          total,
          ...entrega,
          observacoes: [o.observacoes, nota].filter(Boolean).join("\n"),
        },
      });
      // Pix do link que ficou pendente não deve mais ser pago.
      await tx.pagamento.updateMany({
        where: { orderId: o.id, metodo: "PIX", status: "PENDENTE" },
        data: { status: "EXPIRADO" },
      });
      await transicionarParaPago(tx, o.id);
    });
  } catch (e) {
    console.error("[leilao] pago por fora", e);
    return { success: false, error: "Não consegui registrar o pagamento." };
  }

  if (aereo) void pedirConfirmacaoEnvioAereo(o.id);

  await auditar(membro, {
    acao: "leilao.cobranca.pago_fora",
    entidade: "Order",
    entidadeId: o.id,
    descricao: `Registrou a cobrança ${o.numero} como paga por fora (${f.rotulo}), R$ ${total.toFixed(2)}`,
    antes: { status: o.status, frete: Number(o.frete) },
    depois: { status: "PAGO", frete, total, forma: f.rotulo, envio: envio ?? "como estava" },
  });
  if (o.leilaoId) revalidar(o.leilaoId);
  revalidatePath(`/admin/pedidos/${o.id}`);
  return { success: true, message: `Cobrança ${o.numero} marcada como paga (${f.rotulo}).` };
}

/**
 * Baixa manual direto da lista de lotes: o arrematante pagou no Pix direto (ou
 * PicPay) e ainda nem tem cobrança. Os lotes dele entram numa cobrança (como no
 * "Cobrar todos", mas só dele) e ela já nasce paga, sem link nenhum sair.
 * Quita todos os lotes do arrematante neste leilão.
 */
export async function baixaManualArrematante(
  leilaoId: string,
  clienteId: string,
  input: { forma: FormaPagamentoFora; frete: number; envio: EnvioFora },
): Promise<ActionResult> {
  await assertPermissao("pedidos.editar");
  const leilao = await prisma.leilao.findUnique({
    where: { id: leilaoId },
    select: { id: true, nome: true, maxParcelas: true },
  });
  if (!leilao) return { success: false, error: "Leilão não encontrado." };

  const semCobranca = await prisma.loteLeilao.findMany({
    where: { leilaoId, clienteId, orderId: null },
    select: { id: true },
  });
  if (semCobranca.length) {
    try {
      await cobrarGrupo(leilao, clienteId, semCobranca.map((l) => l.id));
    } catch (e) {
      console.error("[leilao] baixa manual: cobrar", e);
      return { success: false, error: "Não consegui montar o pedido deste arrematante." };
    }
  }

  const aberta = await prisma.order.findFirst({
    where: { leilaoId, clienteId, origem: "LEILAO", status: "AGUARDANDO_PAGAMENTO" },
    orderBy: { criadoEm: "desc" },
    select: { id: true },
  });
  if (!aberta) {
    return { success: false, error: "Este arrematante não tem nada em aberto neste leilão." };
  }
  return registrarPagamentoForaLeilao(aberta.id, input);
}
