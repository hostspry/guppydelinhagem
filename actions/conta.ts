"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularPrecos } from "@/lib/precos";
import { getConfigPreco } from "@/lib/queries/config";
import { COMPOSICAO_LABEL, qtdPeixesDe } from "@/lib/composicoes";
import { getPedidoDoUsuario, getDadosPerfil } from "@/lib/queries/minha-conta";
import type { CartItem } from "@/lib/stores/cart";

export type ContaResult = { ok: boolean; error?: string };

const primeiroErro = (e: z.ZodError): string =>
  e.issues[0]?.message ?? "Dados inválidos.";

export type CarrinhoItemInput = Omit<CartItem, "quantidade"> & {
  quantidade: number;
};

/**
 * "Comprar novamente": monta itens de carrinho a partir de um pedido do usuário,
 * usando o preço/estoque ATUAIS do catálogo (não o snapshot). Itens avulsos,
 * inativos ou esgotados são ignorados (contados em `ignorados`). Checa posse.
 */
export async function comprarNovamente(
  numero: string,
): Promise<{ ok: boolean; itens: CarrinhoItemInput[]; ignorados: number }> {
  const session = await auth();
  if (!session?.user) return { ok: false, itens: [], ignorados: 0 };

  const pedido = await getPedidoDoUsuario(
    numero,
    session.user.id,
    session.user.email,
  );
  if (!pedido) return { ok: false, itens: [], ignorados: 0 };

  const { descontoPixGlobalPercent } = await getConfigPreco();
  const itens: CarrinhoItemInput[] = [];
  let ignorados = 0;

  for (const it of pedido.itens) {
    if (!it.productId) {
      ignorados++;
      continue;
    }
    const prod = await prisma.product.findFirst({
      where: { id: it.productId, ativo: true },
      select: {
        id: true,
        nome: true,
        slug: true,
        preco: true,
        descontoPix: true,
        usarDescontoPixGlobal: true,
        estoque: true,
        estoqueMachos: true,
        estoqueFemeas: true,
        variantes: {
          where: { ativo: true },
          select: {
            id: true,
            composicao: true,
            preco: true,
            qtdMachos: true,
            qtdFemeas: true,
          },
        },
        videos: {
          where: { ativo: true },
          orderBy: [{ principal: "desc" }, { ordem: "asc" }],
          take: 1,
          select: { thumbnailUrl: true },
        },
      },
    });
    if (!prod) {
      ignorados++;
      continue;
    }

    const variante = it.composicao
      ? prod.variantes.find((v) => v.composicao === it.composicao)
      : null;
    const precoBase = variante ? Number(variante.preco) : Number(prod.preco);
    const precos = calcularPrecos(
      {
        precoBase,
        descontoPixProprio:
          prod.descontoPix == null ? null : Number(prod.descontoPix),
        usarDescontoPixGlobal: prod.usarDescontoPixGlobal,
      },
      { descontoPixGlobalPercent },
    );

    // Unidades que o pool sustenta para esta composição (mesma regra do produto).
    let estoqueUnid = prod.estoque;
    let qtdPeixes = 0;
    if (variante) {
      const byM =
        variante.qtdMachos > 0
          ? Math.floor(prod.estoqueMachos / variante.qtdMachos)
          : Infinity;
      const byF =
        variante.qtdFemeas > 0
          ? Math.floor(prod.estoqueFemeas / variante.qtdFemeas)
          : Infinity;
      const u = Math.min(byM, byF);
      estoqueUnid = Number.isFinite(u) ? Math.max(0, u) : 0;
      qtdPeixes = qtdPeixesDe(variante);
    }
    if (estoqueUnid <= 0) {
      ignorados++;
      continue;
    }

    itens.push({
      produtoId: prod.id,
      variantId: variante ? variante.id : prod.id,
      composicao: variante ? variante.composicao : null,
      composicaoLabel: variante ? COMPOSICAO_LABEL[variante.composicao] : null,
      nome: prod.nome,
      slug: prod.slug,
      precoPix: precos.precoPix,
      precoCheio: precos.precoCartao,
      qtdPeixes,
      thumbnail: prod.videos[0]?.thumbnailUrl ?? null,
      estoque: estoqueUnid,
      quantidade: Math.min(it.quantidade, estoqueUnid),
    });
  }

  return { ok: true, itens, ignorados };
}

// ── Lista de espera: sair ─────────────────────────────────────────────────────
export async function sairDaListaDeEspera(id: string): Promise<ContaResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Faça login." };

  // Posse: a espera precisa ser do usuário (por userId OU pelo whatsapp do perfil).
  const perfil = await getDadosPerfil(session.user.id, session.user.email);
  const wa = perfil.telefone.replace(/\D/g, "");
  try {
    const res = await prisma.waitlistEntry.deleteMany({
      where: {
        id,
        OR: [{ userId: session.user.id }, ...(wa ? [{ whatsapp: wa }] : [])],
      },
    });
    if (res.count === 0) return { ok: false, error: "Espera não encontrada." };
    revalidatePath("/minha-conta/espera");
    revalidatePath("/minha-conta");
    return { ok: true };
  } catch (e) {
    console.error("[conta] sairDaListaDeEspera", e);
    return { ok: false, error: "Não foi possível sair da lista." };
  }
}

// ── Perfil ────────────────────────────────────────────────────────────────────
const perfilSchema = z.object({
  nome: z.string().trim().min(1, "Informe seu nome."),
  telefone: z.string().trim().optional().default(""),
  cpfCnpj: z.string().trim().optional().default(""),
});

export async function atualizarPerfil(input: unknown): Promise<ContaResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Faça login." };

  const parsed = perfilSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };
  const { nome } = parsed.data;
  const tel = parsed.data.telefone.replace(/\D/g, "") || null;
  const cpf = parsed.data.cpfCnpj.replace(/\D/g, "") || null;

  try {
    // User é a fonte do login; name/nome ficam em sincronia.
    await prisma.user.update({
      where: { id: session.user.id },
      data: { nome, name: nome, telefone: tel },
    });
    // Espelha nos Clientes vinculados (o que alimenta pedidos/minuta).
    await prisma.cliente.updateMany({
      where: { userId: session.user.id },
      data: { nome, telefone: tel, cpfCnpj: cpf },
    });
    revalidatePath("/minha-conta/perfil");
    revalidatePath("/minha-conta");
    return { ok: true };
  } catch (e) {
    console.error("[conta] atualizarPerfil", e);
    return { ok: false, error: "Não foi possível salvar o perfil." };
  }
}

// ── Endereços (CRUD do model Address) ─────────────────────────────────────────
const enderecoSchema = z.object({
  cep: z.string().trim().min(1, "Informe o CEP."),
  rua: z.string().trim().min(1, "Informe a rua."),
  numero: z.string().trim().min(1, "Informe o número."),
  complemento: z.string().trim().optional().default(""),
  bairro: z.string().trim().min(1, "Informe o bairro."),
  cidade: z.string().trim().min(1, "Informe a cidade."),
  estado: z.string().trim().length(2, "UF com 2 letras."),
  principal: z.boolean().optional().default(false),
});

function dadosEndereco(d: z.infer<typeof enderecoSchema>) {
  return {
    cep: d.cep.replace(/\D/g, ""),
    rua: d.rua,
    numero: d.numero,
    complemento: d.complemento || null,
    bairro: d.bairro,
    cidade: d.cidade,
    estado: d.estado.toUpperCase(),
    principal: d.principal,
  };
}

export async function criarEndereco(input: unknown): Promise<ContaResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Faça login." };
  const parsed = enderecoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };
  const dados = dadosEndereco(parsed.data);
  const userId = session.user.id;

  try {
    // Primeiro endereço vira padrão automaticamente.
    const total = await prisma.address.count({ where: { userId } });
    const principal = dados.principal || total === 0;
    await prisma.$transaction(async (tx) => {
      if (principal) {
        await tx.address.updateMany({ where: { userId }, data: { principal: false } });
      }
      await tx.address.create({ data: { ...dados, principal, userId } });
    });
    revalidatePath("/minha-conta/enderecos");
    return { ok: true };
  } catch (e) {
    console.error("[conta] criarEndereco", e);
    return { ok: false, error: "Não foi possível salvar o endereço." };
  }
}

export async function atualizarEndereco(
  id: string,
  input: unknown,
): Promise<ContaResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Faça login." };
  const parsed = enderecoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };
  const dados = dadosEndereco(parsed.data);
  const userId = session.user.id;

  try {
    // Posse: só atualiza se o endereço for do usuário.
    const dono = await prisma.address.findFirst({ where: { id, userId }, select: { id: true } });
    if (!dono) return { ok: false, error: "Endereço não encontrado." };
    await prisma.$transaction(async (tx) => {
      if (dados.principal) {
        await tx.address.updateMany({ where: { userId }, data: { principal: false } });
      }
      await tx.address.update({ where: { id }, data: dados });
    });
    revalidatePath("/minha-conta/enderecos");
    return { ok: true };
  } catch (e) {
    console.error("[conta] atualizarEndereco", e);
    return { ok: false, error: "Não foi possível atualizar o endereço." };
  }
}

export async function excluirEndereco(id: string): Promise<ContaResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Faça login." };
  try {
    const res = await prisma.address.deleteMany({ where: { id, userId: session.user.id } });
    if (res.count === 0) return { ok: false, error: "Endereço não encontrado." };
    revalidatePath("/minha-conta/enderecos");
    return { ok: true };
  } catch (e) {
    console.error("[conta] excluirEndereco", e);
    return { ok: false, error: "Não foi possível excluir." };
  }
}

export async function marcarEnderecoPadrao(id: string): Promise<ContaResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Faça login." };
  const userId = session.user.id;
  try {
    const dono = await prisma.address.findFirst({ where: { id, userId }, select: { id: true } });
    if (!dono) return { ok: false, error: "Endereço não encontrado." };
    await prisma.$transaction(async (tx) => {
      await tx.address.updateMany({ where: { userId }, data: { principal: false } });
      await tx.address.update({ where: { id }, data: { principal: true } });
    });
    revalidatePath("/minha-conta/enderecos");
    return { ok: true };
  } catch (e) {
    console.error("[conta] marcarEnderecoPadrao", e);
    return { ok: false, error: "Não foi possível marcar como padrão." };
  }
}
