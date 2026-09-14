"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import { criptografar } from "@/lib/cripto";
import {
  credenciais,
  chamarMl,
  renovarToken,
  urlAutorizacao,
} from "@/lib/mercadolivre/cliente";
import { sincronizarEstoqueMl } from "@/lib/mercadolivre/estoque";
import {
  publicarNoMl,
  CATEGORIA_PEIXE,
  LISTING_TYPE,
  TIPOS_ANUNCIO,
  ehTipoAnuncio,
  type TipoAnuncio,
} from "@/lib/mercadolivre/publicar";
import { sugerirPreco } from "@/lib/mercadolivre/precos";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";

/**
 * Ações da tela de integração com o Mercado Livre.
 *
 * Tudo aqui exige `config.editar`: quem liga um marketplace mexe em estoque e em
 * preço de vitrine. Mesma régua da Shopee.
 */

const CAMINHO = "/admin/configuracoes/mercado-livre";

export type MlActionResult =
  | { ok: true; mensagem?: string; url?: string }
  | { ok: false; erro: string };

/** Endereço público do site, base do redirect do OAuth e das notificações. */
function base(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://guppydelinhagem.com.br"
  );
}

export const urlRedirect = async (): Promise<string> =>
  `${base()}/api/mercadolivre/callback`;
export const urlNotificacoes = async (): Promise<string> =>
  `${base()}/api/mercadolivre/webhook`;

/** Salva App ID e Secret. O Secret só é regravado quando vem preenchido. */
export async function salvarCredenciaisMl(dados: {
  clientId: string;
  clientSecret: string;
  ativo: boolean;
}): Promise<MlActionResult> {
  const membro = await assertPermissao("config.editar");

  const clientId = dados.clientId.trim();
  if (!/^\d{6,}$/.test(clientId)) {
    return { ok: false, erro: "O App ID do Mercado Livre é só números." };
  }

  const atual = await prisma.integracaoMercadoLivre.findUnique({
    where: { id: "default" },
    select: { clientId: true, clientSecretCriptografado: true },
  });
  const segredo = dados.clientSecret.trim();
  if (!segredo && !atual?.clientSecretCriptografado) {
    return { ok: false, erro: "Informe o Secret da aplicação." };
  }

  // Trocar de aplicação invalida a autorização: os tokens são daquele app.
  const mudouApp = !!atual?.clientId && atual.clientId !== clientId;

  await prisma.integracaoMercadoLivre.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      clientId,
      clientSecretCriptografado: criptografar(segredo),
      ativo: dados.ativo,
    },
    update: {
      clientId,
      ...(segredo ? { clientSecretCriptografado: criptografar(segredo) } : {}),
      ativo: dados.ativo,
      ...(mudouApp
        ? {
            sellerId: null,
            apelido: null,
            accessTokenCriptografado: null,
            refreshTokenCriptografado: null,
            tokenExpiraEm: null,
            refreshEmitidoEm: null,
          }
        : {}),
      ultimoErro: null,
    },
  });

  await auditar(membro, {
    acao: "config.mercadolivre.credenciais",
    entidade: "MercadoLivre",
    descricao: `Salvou as credenciais do Mercado Livre (app ${clientId})`,
    depois: { clientId, ativo: dados.ativo },
  });

  revalidatePath(CAMINHO);
  return {
    ok: true,
    mensagem: mudouApp
      ? "Salvo. Como a aplicação mudou, autorize a conta de novo."
      : "Credenciais salvas.",
  };
}

/** Monta o link da tela de autorização do Mercado Livre. */
export async function linkAutorizacaoMl(): Promise<MlActionResult> {
  await assertPermissao("config.editar");

  const c = await credenciais();
  if (!c) return { ok: false, erro: "Salve o App ID e o Secret antes." };

  return {
    ok: true,
    url: urlAutorizacao({ clientId: c.clientId, redirect: await urlRedirect() }),
  };
}

/** Bate no ML para ver se a ligação está de pé de verdade. */
export async function testarConexaoMl(): Promise<MlActionResult> {
  await assertPermissao("config.editar");

  const r = await chamarMl<{ nickname?: string; id?: number }>("/users/me");
  if (!r.ok) return { ok: false, erro: r.erro };

  revalidatePath(CAMINHO);
  return {
    ok: true,
    mensagem: `Conectado como ${r.dados?.nickname ?? "conta do ML"}.`,
  };
}

/** Renova o token na mão, para o dono destravar sem esperar o cron. */
export async function renovarTokenMl(): Promise<MlActionResult> {
  await assertPermissao("config.editar");
  const r = await renovarToken(true);
  if (!r.ok) return { ok: false, erro: r.erro };
  revalidatePath(CAMINHO);
  return { ok: true, mensagem: "Token renovado." };
}

/** Empurra o estoque de tudo que está ligado. */
export async function sincronizarEstoqueMlAgora(): Promise<MlActionResult> {
  await assertPermissao("config.editar");

  const r = await sincronizarEstoqueMl();
  revalidatePath(CAMINHO);
  if (r.erros.length > 0) {
    return { ok: false, erro: r.erros.slice(0, 3).join(" · ") };
  }
  return {
    ok: true,
    mensagem: `Estoque enviado em ${r.enviados} anúncio(s). ${r.semMudanca} já estava(m) certo(s).`,
  };
}

export type AnuncioMl = {
  itemId: string;
  variationId: string | null;
  titulo: string;
  estoque: number;
  status: string;
  jaLigado: boolean;
};

/**
 * Lista os anúncios da conta para o dono escolher com qual produto cada um casa.
 *
 * A ligação é manual de propósito: título de marketplace é escrito para busca
 * ("Peixe Guppy Macho Lebiste Aquário Água Doce Vivo"), e casar por semelhança
 * acabaria sincronizando o estoque do produto errado.
 */
export async function listarAnunciosMl(): Promise<
  { ok: true; anuncios: AnuncioMl[] } | { ok: false; erro: string }
> {
  await assertPermissao("config.editar");

  const c = await credenciais();
  if (!c?.sellerId) {
    return { ok: false, erro: "Autorize a conta do Mercado Livre primeiro." };
  }

  const busca = await chamarMl<{ results?: string[] }>(
    `/users/${c.sellerId}/items/search?status=active&limit=100`,
  );
  if (!busca.ok) return { ok: false, erro: busca.erro };

  const ids = busca.dados?.results ?? [];
  if (ids.length === 0) return { ok: true, anuncios: [] };

  // multiget aceita 20 por vez; mais que isso o ML recusa a chamada inteira.
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += 20) lotes.push(ids.slice(i, i + 20));

  type ItemMl = {
    id?: string;
    title?: string;
    status?: string;
    available_quantity?: number;
    variations?: { id: number | string; available_quantity?: number; attribute_combinations?: { value_name?: string }[] }[];
  };

  const itens: ItemMl[] = [];
  for (const lote of lotes) {
    const r = await chamarMl<{ code?: number; body?: ItemMl }[]>(
      `/items?ids=${lote.join(",")}&attributes=id,title,status,available_quantity,variations`,
    );
    if (!r.ok) return { ok: false, erro: r.erro };
    for (const linha of r.dados ?? []) {
      if (linha?.body) itens.push(linha.body);
    }
  }

  const ligados = await prisma.mercadoLivreAnuncio.findMany({
    select: { itemId: true, variationId: true },
  });
  const estaLigado = (itemId: string, variationId: string | null) =>
    ligados.some((l) => l.itemId === itemId && l.variationId === variationId);

  const anuncios: AnuncioMl[] = [];
  for (const it of itens) {
    const itemId = it.id ?? "";
    if (!itemId) continue;
    const variacoes = it.variations ?? [];
    if (variacoes.length === 0) {
      anuncios.push({
        itemId,
        variationId: null,
        titulo: it.title ?? itemId,
        estoque: it.available_quantity ?? 0,
        status: it.status ?? "",
        jaLigado: estaLigado(itemId, null),
      });
      continue;
    }
    for (const v of variacoes) {
      const vid = String(v.id);
      const rotulo = (v.attribute_combinations ?? [])
        .map((a) => a.value_name)
        .filter(Boolean)
        .join(" / ");
      anuncios.push({
        itemId,
        variationId: vid,
        titulo: `${it.title ?? itemId}${rotulo ? ` — ${rotulo}` : ""}`,
        estoque: v.available_quantity ?? 0,
        status: it.status ?? "",
        jaLigado: estaLigado(itemId, vid),
      });
    }
  }

  return { ok: true, anuncios };
}

/** Liga um anúncio a um produto do site. */
export async function ligarAnuncioMl(dados: {
  productId: string;
  itemId: string;
  variationId: string | null;
  titulo: string | null;
}): Promise<MlActionResult> {
  const membro = await assertPermissao("config.editar");

  const produto = await prisma.product.findUnique({
    where: { id: dados.productId },
    select: { id: true, nome: true },
  });
  if (!produto) return { ok: false, erro: "Produto não encontrado." };

  // findFirst + create/update em vez de upsert: a chave única tem variationId, e
  // anúncio sem variação tem variationId nulo — nulo não casa em unique, então o
  // upsert nunca encontraria a linha existente e tentaria criar de novo.
  const existente = await prisma.mercadoLivreAnuncio.findFirst({
    where: { itemId: dados.itemId, variationId: dados.variationId },
    select: { id: true },
  });
  const titulo = dados.titulo?.slice(0, 200) ?? null;

  if (existente) {
    await prisma.mercadoLivreAnuncio.update({
      where: { id: existente.id },
      data: {
        productId: produto.id,
        titulo,
        // Zera o espelho: trocou de produto, o que está escrito lá não vale mais.
        estoqueEnviado: null,
        ultimoErro: null,
      },
    });
  } else {
    await prisma.mercadoLivreAnuncio.create({
      data: {
        productId: produto.id,
        itemId: dados.itemId,
        variationId: dados.variationId,
        titulo,
      },
    });
  }

  await auditar(membro, {
    acao: "config.mercadolivre.ligar",
    entidade: "MercadoLivreAnuncio",
    entidadeId: dados.itemId,
    descricao: `Ligou o anúncio ${dados.itemId} do Mercado Livre ao produto ${produto.nome}`,
  });

  revalidatePath(CAMINHO);
  return { ok: true, mensagem: "Anúncio ligado. Sincronize o estoque para conferir." };
}

/** Desfaz a ligação (o anúncio para de receber estoque daqui). */
export async function desligarAnuncioMl(id: string): Promise<MlActionResult> {
  const membro = await assertPermissao("config.editar");

  const anuncio = await prisma.mercadoLivreAnuncio.findUnique({
    where: { id },
    select: { itemId: true },
  });
  if (!anuncio) return { ok: false, erro: "Ligação não encontrada." };

  await prisma.mercadoLivreAnuncio.delete({ where: { id } });
  await auditar(membro, {
    acao: "config.mercadolivre.desligar",
    entidade: "MercadoLivreAnuncio",
    entidadeId: anuncio.itemId,
    descricao: `Desfez a ligação do anúncio ${anuncio.itemId} do Mercado Livre`,
  });

  revalidatePath(CAMINHO);
  return { ok: true, mensagem: "Ligação desfeita." };
}

/** Salva o número da licença do IBAMA (vai na descrição de todo anúncio de peixe). */
export async function salvarLicencaIbama(licenca: string): Promise<MlActionResult> {
  const membro = await assertPermissao("config.editar");
  const valor = licenca.trim();
  if (valor.length < 3) return { ok: false, erro: "Informe o número da licença." };

  await prisma.integracaoMercadoLivre.upsert({
    where: { id: "default" },
    create: { id: "default", licencaIbama: valor },
    update: { licencaIbama: valor },
  });
  await auditar(membro, {
    acao: "config.mercadolivre.ibama",
    entidade: "MercadoLivre",
    descricao: "Atualizou o número da licença do IBAMA usado nos anúncios",
  });

  revalidatePath(CAMINHO);
  return { ok: true, mensagem: "Licença salva." };
}

/**
 * Cria o anúncio no ML a partir de um produto do site.
 *
 * O anúncio nasce PAUSADO: quem confere título, foto e preço e ativa é o dono,
 * no painel do ML. Uma composição por anúncio, porque anúncio do ML tem um
 * preço só.
 */
export async function publicarProdutoNoMl(dados: {
  productId: string;
  composicao: TipoComposicao | null;
  preco: number;
  tipoAnuncio?: string;
}): Promise<MlActionResult> {
  const membro = await assertPermissao("config.editar");

  const preco = Math.round(Number(dados.preco) * 100) / 100;
  if (!Number.isFinite(preco) || preco <= 0) {
    return { ok: false, erro: "Informe o preço do anúncio." };
  }

  // Tipo vem do cliente: normaliza para os três que existem, em vez de confiar.
  const tipo: TipoAnuncio =
    dados.tipoAnuncio && ehTipoAnuncio(dados.tipoAnuncio)
      ? dados.tipoAnuncio
      : LISTING_TYPE;

  const r = await publicarNoMl({
    productId: dados.productId,
    composicao: dados.composicao,
    preco,
    tipoAnuncio: tipo,
  });
  if (!r.ok) return { ok: false, erro: r.erro };

  await auditar(membro, {
    acao: "config.mercadolivre.publicar",
    entidade: "MercadoLivreAnuncio",
    entidadeId: r.dados.itemId,
    descricao: `Publicou o anúncio ${r.dados.itemId} no Mercado Livre (${TIPOS_ANUNCIO[tipo].nome}, pausado) por R$ ${preco.toFixed(2).replace(".", ",")}`,
    depois: { itemId: r.dados.itemId, composicao: dados.composicao, preco, tipo },
  });

  revalidatePath(CAMINHO);
  // Sem `url` de propósito: quem recebe `url` na tela é o fluxo de autorização,
  // que redireciona o navegador. Publicar não pode arrastar o dono para fora do
  // painel no meio de uma sequência de cadastros.
  return {
    ok: true,
    mensagem: `Anúncio ${r.dados.itemId} criado e PAUSADO. Revise no ML e ative quando quiser.`,
  };
}

export type OpcaoTipoAnuncio = {
  tipoAnuncio: TipoAnuncio;
  tipoNome: string;
  percentual: number;
  precoSugerido: number;
  comissao: number;
  /** Teto de estoque do tipo (o Grátis só aceita 1 por anúncio). */
  estoqueMax: number;
};

export type PrecoSugerido = {
  precoSite: number;
  opcoes: OpcaoTipoAnuncio[];
};

/**
 * Preço a anunciar para o líquido continuar sendo o preço do site.
 *
 * A tarifa é perguntada ao ML na hora, por categoria e tipo de anúncio — não é
 * número decorado aqui, porque eles mexem nisso e a categoria muda a conta.
 */
export async function sugerirPrecoMl(dados: {
  productId: string;
  composicao: TipoComposicao | null;
}): Promise<{ ok: true; dados: PrecoSugerido } | { ok: false; erro: string }> {
  await assertPermissao("config.editar");

  const p = await prisma.product.findUnique({
    where: { id: dados.productId },
    select: {
      tipo: true,
      preco: true,
      variantes: {
        where: { ativo: true },
        select: { composicao: true, preco: true },
      },
    },
  });
  if (!p) return { ok: false, erro: "Produto não encontrado." };

  const variante = dados.composicao
    ? p.variantes.find((v) => v.composicao === dados.composicao)
    : null;
  const precoSite = Number(variante?.preco ?? p.preco);
  if (!(precoSite > 0)) return { ok: false, erro: "Produto sem preço no site." };

  // Produto seco ainda não tem categoria decidida aqui; a do peixe é fixa.
  if (p.tipo !== "PEIXE") {
    return {
      ok: false,
      erro: "Sugestão de preço disponível só para peixe por enquanto (a categoria do seco varia por produto).",
    };
  }

  // Os três de uma vez: a escolha do tipo é comercial, e comparar comissão com
  // o preço já ajustado ao lado é o que torna a decisão possível.
  const tipos = Object.keys(TIPOS_ANUNCIO) as TipoAnuncio[];
  const opcoes: OpcaoTipoAnuncio[] = [];
  for (const t of tipos) {
    const r = await sugerirPreco({
      categoriaId: CATEGORIA_PEIXE,
      listingTypeId: t,
      precoSite,
    });
    if (!r.ok) continue; // tipo indisponível na categoria: some da lista
    opcoes.push({
      tipoAnuncio: t,
      tipoNome: TIPOS_ANUNCIO[t].nome,
      percentual: r.dados.percentual,
      precoSugerido: r.dados.precoSugerido,
      comissao: r.dados.comissao,
      estoqueMax: TIPOS_ANUNCIO[t].estoqueMax,
    });
  }
  if (opcoes.length === 0) {
    return { ok: false, erro: "O ML não devolveu tarifa para nenhum tipo de anúncio." };
  }

  return { ok: true, dados: { precoSite, opcoes } };
}
