"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import {
  vendaWhatsappSchema,
  type VendaWhatsappInput,
} from "@/lib/validations/venda-whatsapp";
import type { Prisma } from "@/lib/generated/prisma/client";

export type VendaResult =
  | { success: true; orderId: string; numero: string; clienteNovo: boolean }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/** Cliente parecido, para a tela perguntar antes de duplicar cadastro. */
export type ClienteParecido = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpfCnpj: string | null;
  cidade: string | null;
  uf: string | null;
  /** Por que casou — a tela mostra para o operador julgar. */
  motivo: "cpf" | "email" | "telefone";
  pedidos: number;
};

const soDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * Procura o cliente pelos dados colados, na ordem de confiança.
 *
 * CPF primeiro porque é único de verdade; e-mail depois; telefone por último,
 * que é o mais frágil (casal que divide número, número reciclado pela operadora).
 * Devolve TODOS os candidatos em vez de decidir sozinho: juntar dois clientes
 * por engano é bem pior do que perguntar.
 */
export async function procurarCliente(dados: {
  cpfCnpj?: string;
  email?: string;
  telefone?: string;
}): Promise<ClienteParecido[]> {
  await assertPermissao("clientes.ver");

  const cpf = soDigitos(dados.cpfCnpj);
  const email = (dados.email ?? "").trim().toLowerCase();
  const tel = soDigitos(dados.telefone);

  const ors: Prisma.ClienteWhereInput[] = [];
  if (cpf) ors.push({ cpfCnpj: cpf });
  if (email) ors.push({ email: { equals: email, mode: "insensitive" } });
  if (tel) ors.push({ telefone: tel });
  if (ors.length === 0) return [];

  const achados = await prisma.cliente.findMany({
    where: { OR: ors },
    select: {
      id: true,
      nome: true,
      telefone: true,
      email: true,
      cpfCnpj: true,
      cidade: true,
      uf: true,
      _count: { select: { pedidos: true } },
    },
    take: 5,
  });

  return achados.map((c) => ({
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    email: c.email,
    cpfCnpj: c.cpfCnpj,
    cidade: c.cidade,
    uf: c.uf,
    motivo:
      cpf && c.cpfCnpj === cpf
        ? ("cpf" as const)
        : email && (c.email ?? "").toLowerCase() === email
          ? ("email" as const)
          : ("telefone" as const),
    pedidos: c._count.pedidos,
  }));
}

/** Preenche só o que está vazio: dado antigo do cadastro não é sobrescrito à toa. */
function completar<T extends Record<string, string | null>>(
  atual: T,
  novo: Record<string, string>,
): Partial<T> {
  const saida: Record<string, string> = {};
  for (const [k, v] of Object.entries(novo)) {
    if (!v) continue;
    if (!atual[k as keyof T]) saida[k] = v;
  }
  return saida as Partial<T>;
}

/**
 * Registra uma venda feita no WhatsApp.
 *
 * Cliente: usa o que o operador confirmou (clienteId) ou cria um novo. Quando
 * reusa, completa os campos que faltavam no cadastro sem apagar o que já havia
 * — endereço novo costuma ser mais atual, mas quem decide trocar é o operador,
 * na tela de clientes.
 *
 * Pago: nasce PAGO e a venda entra no caixa como sugestão pendente, igual à do
 * site. Não pago: AGUARDANDO_PAGAMENTO.
 */
export async function criarVendaWhatsapp(input: unknown): Promise<VendaResult> {
  const membro = await assertPermissao("pedidos.editar");

  const parsed = vendaWhatsappSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const d: VendaWhatsappInput = parsed.data;

  // ── Itens: preço e nome do catálogo mandam; avulso usa o que foi digitado ──
  const idsCatalogo = d.itens
    .map((i) => i.produtoId)
    .filter((v): v is string => !!v);
  const produtos = idsCatalogo.length
    ? await prisma.product.findMany({
        where: { id: { in: idsCatalogo } },
        select: {
          id: true,
          nome: true,
          videos: { where: { principal: true }, take: 1, select: { thumbnailUrl: true } },
          imagens: { orderBy: { ordem: "asc" }, take: 1, select: { url: true } },
          variantes: {
            where: { ativo: true },
            select: { composicao: true, qtdMachos: true, qtdFemeas: true },
          },
        },
      })
    : [];
  const pmap = new Map(produtos.map((p) => [p.id, p]));

  const itensData = d.itens.map((it) => {
    const prod = it.produtoId ? pmap.get(it.produtoId) : null;
    const variante = prod?.variantes.find((v) => v.composicao === it.composicao);
    return {
      productId: prod?.id ?? null,
      nomeProduto: prod ? prod.nome : it.nomeProduto.trim(),
      precoUnitario: it.precoUnitario,
      quantidade: it.quantidade,
      imagemSnapshot:
        prod?.videos[0]?.thumbnailUrl ?? prod?.imagens[0]?.url ?? null,
      composicao: variante ? variante.composicao : null,
      qtdMachos: variante ? variante.qtdMachos : null,
      qtdFemeas: variante ? variante.qtdFemeas : null,
    };
  });

  const subtotal = itensData.reduce(
    (s, i) => s + i.precoUnitario * i.quantidade,
    0,
  );
  const total = Math.max(0, subtotal + d.frete - d.desconto);

  const dadosCliente = {
    nome: d.nome,
    cpfCnpj: d.cpfCnpj,
    email: d.email,
    telefone: d.telefone,
    cep: d.cep,
    logradouro: d.logradouro,
    numero: d.numero,
    complemento: d.complemento,
    bairro: d.bairro,
    cidade: d.cidade,
    uf: d.uf,
  };

  let clienteNovo = false;
  let orderId = "";
  let numero = "";

  try {
    const criado = await prisma.$transaction(async (tx) => {
      // ── Cliente ──
      let clienteId = d.clienteId ?? null;
      if (clienteId) {
        const atual = await tx.cliente.findUnique({
          where: { id: clienteId },
          select: {
            id: true, nome: true, cpfCnpj: true, email: true, telefone: true,
            cep: true, logradouro: true, numero: true, complemento: true,
            bairro: true, cidade: true, uf: true,
          },
        });
        if (!atual) throw new Error("Cliente selecionado não existe mais.");
        const faltando = completar(atual, dadosCliente);
        if (Object.keys(faltando).length > 0) {
          await tx.cliente.update({ where: { id: clienteId }, data: faltando });
        }
      } else {
        const novo = await tx.cliente.create({
          data: {
            ...dadosCliente,
            cpfCnpj: d.cpfCnpj || null,
            email: d.email || null,
            telefone: d.telefone || null,
          },
          select: { id: true },
        });
        clienteId = novo.id;
        clienteNovo = true;
      }

      // ── Endereço do pedido: snapshot do que foi combinado nesta venda ──
      const endereco = {
        nome: d.nome,
        cpfCnpj: d.cpfCnpj || null,
        telefone: d.telefone || null,
        email: d.email || null,
        cep: d.cep,
        logradouro: d.logradouro || null,
        numero: d.numero || null,
        complemento: d.complemento || null,
        bairro: d.bairro || null,
        cidade: d.cidade || null,
        uf: d.uf || null,
      };

      const ano = new Date().getFullYear();
      const ultimo = await tx.order.findFirst({
        where: { ano },
        orderBy: { sequencia: "desc" },
        select: { sequencia: true },
      });
      const sequencia = (ultimo?.sequencia ?? 0) + 1;
      const num = `#${ano}-${String(sequencia).padStart(4, "0")}`;

      return tx.order.create({
        data: {
          numero: num,
          ano,
          sequencia,
          clienteId,
          status: d.jaPago ? "PAGO" : "AGUARDANDO_PAGAMENTO",
          formaPagamento: d.formaPagamento ?? null,
          observacoes: d.observacoes || null,
          enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
          subtotal,
          frete: d.frete,
          desconto: d.desconto,
          total,
          items: { create: itensData },
        },
        select: { id: true, numero: true },
      });
    });
    orderId = criado.id;
    numero = criado.numero;
  } catch (e) {
    console.error("[venda-whatsapp] criar", e);
    return {
      success: false,
      error:
        e instanceof Error && e.message.includes("não existe")
          ? e.message
          : "Não foi possível registrar a venda.",
    };
  }

  await auditar(membro, {
    acao: "pedido.criar",
    entidade: "Order",
    entidadeId: orderId,
    descricao: `Registrou venda do WhatsApp ${numero} de ${total.toFixed(2)}${clienteNovo ? " (cliente novo)" : ""}`,
    depois: { total, itens: itensData.length, jaPago: d.jaPago },
  });

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/clientes");
  return { success: true, orderId, numero, clienteNovo };
}
