"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import { criptografar } from "@/lib/cripto";
import { credenciais, chamarShopee, renovarToken } from "@/lib/shopee/cliente";
import { urlAutorizacao } from "@/lib/shopee/assinatura";
import { importarPedidosShopee } from "@/lib/shopee/pedidos";
import { sincronizarEstoqueShopee } from "@/lib/shopee/estoque";

/**
 * Ações da tela de integração com a Shopee.
 *
 * Tudo aqui exige `config.editar`: quem liga um marketplace pode mexer no preço
 * e no estoque que o público vê.
 */

export type ShopeeActionResult =
  | { ok: true; mensagem?: string; url?: string }
  | { ok: false; erro: string };

const CAMINHO = "/admin/configuracoes/shopee";

/** Endereço público do site, base do redirect e do webhook. */
function base(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://guppydelinhagem.com.br"
  );
}

export const urlCallback = async (): Promise<string> =>
  `${base()}/api/shopee/callback`;
export const urlWebhook = async (): Promise<string> =>
  `${base()}/api/shopee/webhook`;

/** Salva partner ID, chave e ambiente. A chave só é regravada quando vem nova. */
export async function salvarCredenciaisShopee(dados: {
  ambiente: "SANDBOX" | "PRODUCAO";
  partnerId: string;
  partnerKey: string;
  ativo: boolean;
}): Promise<ShopeeActionResult> {
  const membro = await assertPermissao("config.editar");

  const partnerId = dados.partnerId.trim();
  if (!/^\d+$/.test(partnerId)) {
    return { ok: false, erro: "O partner ID é só números, como aparece na Open Platform." };
  }
  const chave = dados.partnerKey.trim();

  const atual = await prisma.integracaoShopee.findUnique({
    where: { id: "default" },
    select: { partnerKeyCriptografada: true, ambiente: true, partnerId: true },
  });
  if (!chave && !atual?.partnerKeyCriptografada) {
    return { ok: false, erro: "Cole a partner key — ela não fica visível depois de salva." };
  }

  // Trocar de ambiente ou de partner ID invalida a autorização: as chaves de
  // sandbox e produção são de mundos diferentes, e o token velho não vale no
  // outro. Limpar aqui evita o erro mudo de "assinatura recusada" depois.
  const mudouIdentidade =
    (atual?.ambiente && atual.ambiente !== dados.ambiente) ||
    (atual?.partnerId && atual.partnerId !== partnerId);

  await prisma.integracaoShopee.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ambiente: dados.ambiente,
      partnerId,
      partnerKeyCriptografada: chave ? criptografar(chave) : null,
      ativo: dados.ativo,
    },
    update: {
      ambiente: dados.ambiente,
      partnerId,
      ativo: dados.ativo,
      ...(chave ? { partnerKeyCriptografada: criptografar(chave) } : {}),
      ...(mudouIdentidade
        ? {
            shopId: null,
            accessTokenCriptografado: null,
            refreshTokenCriptografado: null,
            tokenExpiraEm: null,
            refreshEmitidoEm: null,
            ultimoErro: null,
          }
        : {}),
    },
  });

  await auditar(membro, {
    acao: "config.editar",
    entidade: "IntegracaoShopee",
    entidadeId: "default",
    descricao: `Salvou as credenciais da Shopee (${dados.ambiente})`,
    depois: { ambiente: dados.ambiente, partnerId, ativo: dados.ativo },
  });

  revalidatePath(CAMINHO);
  return {
    ok: true,
    mensagem: mudouIdentidade
      ? "Salvo. Como o ambiente ou o partner ID mudou, autorize a loja de novo."
      : "Credenciais salvas.",
  };
}

/** Monta o link da tela de autorização da Shopee. */
export async function linkAutorizacaoShopee(): Promise<ShopeeActionResult> {
  await assertPermissao("config.editar");

  const c = await credenciais();
  if (!c) return { ok: false, erro: "Salve o partner ID e a partner key antes." };

  return {
    ok: true,
    url: urlAutorizacao({
      ambiente: c.ambiente,
      partnerId: c.partnerId,
      partnerKey: c.partnerKey,
      redirect: await urlCallback(),
    }),
  };
}

/** Bate na Shopee para ver se a ligação está de pé de verdade. */
export async function testarConexaoShopee(): Promise<ShopeeActionResult> {
  await assertPermissao("config.editar");

  const r = await chamarShopee<{ shop_name?: string; shop_id?: number }>(
    "/api/v2/shop/get_shop_info",
  );
  if (!r.ok) return { ok: false, erro: r.erro };

  revalidatePath(CAMINHO);
  return {
    ok: true,
    mensagem: `Conectado${r.dados.shop_name ? ` na loja ${r.dados.shop_name}` : ""}.`,
  };
}

/** Renova o token na mão, para o dono destravar sem esperar o cron. */
export async function renovarTokenShopee(): Promise<ShopeeActionResult> {
  await assertPermissao("config.editar");
  const r = await renovarToken();
  if (!r.ok) return { ok: false, erro: r.erro };
  revalidatePath(CAMINHO);
  return { ok: true, mensagem: "Token renovado. Vale por mais 4 horas." };
}

/** Puxa os pedidos agora, sem esperar a rodada do cron. */
export async function importarAgoraShopee(): Promise<ShopeeActionResult> {
  await assertPermissao("config.editar");

  const r = await importarPedidosShopee();
  revalidatePath(CAMINHO);
  revalidatePath("/admin/pedidos");

  if (r.erros.length > 0) return { ok: false, erro: r.erros[0] };
  return {
    ok: true,
    mensagem:
      r.novos > 0
        ? `${r.novos} pedido(s) importado(s).`
        : "Nenhum pedido novo na janela.",
  };
}

/** Empurra o estoque de tudo que está ligado. */
export async function sincronizarEstoqueAgora(): Promise<ShopeeActionResult> {
  await assertPermissao("config.editar");

  const r = await sincronizarEstoqueShopee();
  revalidatePath(CAMINHO);

  if (r.erros.length > 0) return { ok: false, erro: r.erros[0] };
  return {
    ok: true,
    mensagem: `${r.enviados} anúncio(s) atualizado(s); ${r.semMudanca} já estavam certos.`,
  };
}

// ── Ligação produto ↔ anúncio ────────────────────────────────────────────────

export type AnuncioShopee = {
  itemId: string;
  modelId: string | null;
  titulo: string;
  estoque: number | null;
  jaLigado: boolean;
};

type ItemBase = { item_id?: number; item_name?: string; item_status?: string };
type ModeloItem = { model_id?: number; model_name?: string; stock_info_v2?: unknown };

/**
 * Lista os anúncios da loja para o dono escolher com qual produto cada um casa.
 *
 * A ligação é manual de propósito: título de marketplace é escrito para busca
 * ("Criadeira Berçário Peixe Aquário 6L"), e casar por semelhança de nome
 * acabaria sincronizando o estoque do produto errado.
 */
export async function listarAnunciosShopee(): Promise<
  { ok: true; anuncios: AnuncioShopee[] } | { ok: false; erro: string }
> {
  await assertPermissao("config.editar");

  const lista = await chamarShopee<{ item?: { item_id?: number }[] }>(
    "/api/v2/product/get_item_list",
    { query: { offset: 0, page_size: 100, item_status: "NORMAL" } },
  );
  if (!lista.ok) return { ok: false, erro: lista.erro };

  const ids = (lista.dados.item ?? [])
    .map((i) => i.item_id)
    .filter((i): i is number => typeof i === "number");
  if (ids.length === 0) return { ok: true, anuncios: [] };

  const detalhe = await chamarShopee<{ item_list?: ItemBase[] }>(
    "/api/v2/product/get_item_base_info",
    { query: { item_id_list: ids.join(",") } },
  );
  if (!detalhe.ok) return { ok: false, erro: detalhe.erro };

  const ligados = await prisma.shopeeAnuncio.findMany({
    select: { itemId: true, modelId: true },
  });
  const estaLigado = (itemId: string, modelId: string | null) =>
    ligados.some((l) => l.itemId === itemId && l.modelId === modelId);

  const anuncios: AnuncioShopee[] = [];
  for (const item of detalhe.dados.item_list ?? []) {
    const itemId = String(item.item_id ?? "");
    if (!itemId) continue;

    // Anúncio com variação precisa de uma linha por variação: o estoque é por
    // modelo, e ligar só o item deixaria as outras variações sem controle.
    const modelos = await chamarShopee<{ model?: ModeloItem[] }>(
      "/api/v2/product/get_model_list",
      { query: { item_id: itemId } },
    );
    const lista = modelos.ok ? (modelos.dados.model ?? []) : [];

    if (lista.length === 0) {
      anuncios.push({
        itemId,
        modelId: null,
        titulo: item.item_name ?? `Anúncio ${itemId}`,
        estoque: null,
        jaLigado: estaLigado(itemId, null),
      });
      continue;
    }
    for (const m of lista) {
      const modelId = m.model_id ? String(m.model_id) : null;
      anuncios.push({
        itemId,
        modelId,
        titulo: `${item.item_name ?? itemId}${m.model_name ? ` — ${m.model_name}` : ""}`,
        estoque: null,
        jaLigado: estaLigado(itemId, modelId),
      });
    }
  }

  return { ok: true, anuncios };
}

/** Liga um anúncio a um produto do site. */
export async function ligarAnuncio(dados: {
  productId: string;
  itemId: string;
  modelId: string | null;
  titulo: string;
}): Promise<ShopeeActionResult> {
  const membro = await assertPermissao("config.editar");

  const produto = await prisma.product.findUnique({
    where: { id: dados.productId },
    select: { nome: true, tipo: true },
  });
  if (!produto) return { ok: false, erro: "Produto não encontrado." };
  if (produto.tipo === "PEIXE") {
    return {
      ok: false,
      erro: "A Shopee não permite bicho vivo, e o estoque de peixe é por macho e fêmea. Ligue só produto seco.",
    };
  }

  // findFirst + create/update em vez de upsert: a chave única tem modelId, e
  // anúncio sem variação tem modelId nulo — nulo não casa em unique, então o
  // upsert nunca encontraria a linha existente e tentaria criar de novo.
  const existente = await prisma.shopeeAnuncio.findFirst({
    where: { itemId: dados.itemId, modelId: dados.modelId },
    select: { id: true },
  });

  const titulo = dados.titulo.slice(0, 200);
  if (existente) {
    await prisma.shopeeAnuncio.update({
      where: { id: existente.id },
      data: {
        productId: dados.productId,
        titulo,
        // Zera o espelho: trocou de produto, o que está escrito lá não vale mais.
        estoqueEnviado: null,
        ultimoErro: null,
      },
    });
  } else {
    await prisma.shopeeAnuncio.create({
      data: {
        productId: dados.productId,
        itemId: dados.itemId,
        modelId: dados.modelId,
        titulo,
      },
    });
  }

  await auditar(membro, {
    acao: "config.editar",
    entidade: "ShopeeAnuncio",
    entidadeId: dados.itemId,
    descricao: `Ligou o anúncio ${dados.itemId} ao produto ${produto.nome}`,
  });

  revalidatePath(CAMINHO);
  return { ok: true, mensagem: `Ligado a ${produto.nome}.` };
}

/** Desfaz a ligação. O anúncio para de receber estoque nosso. */
export async function desligarAnuncio(id: string): Promise<ShopeeActionResult> {
  const membro = await assertPermissao("config.editar");

  const alvo = await prisma.shopeeAnuncio.findUnique({
    where: { id },
    select: { itemId: true, product: { select: { nome: true } } },
  });
  if (!alvo) return { ok: false, erro: "Ligação não encontrada." };

  await prisma.shopeeAnuncio.delete({ where: { id } });

  await auditar(membro, {
    acao: "config.editar",
    entidade: "ShopeeAnuncio",
    entidadeId: alvo.itemId,
    descricao: `Desligou o anúncio ${alvo.itemId} de ${alvo.product.nome}`,
  });

  revalidatePath(CAMINHO);
  return { ok: true, mensagem: "Ligação desfeita." };
}
