"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { SemPermissaoError } from "@/lib/permissoes";
import { auditar } from "@/lib/auditoria";
import { chamarMl } from "@/lib/mercadolivre/cliente";
import { sincronizarEstoqueMl, disponivelNoAnuncio } from "@/lib/mercadolivre/estoque";
import {
  montarAnuncio,
  conferirTitulo,
  conferirDescricao,
  LISTING_TYPE,
  TIPOS_ANUNCIO,
  ehTipoAnuncio,
  type AnuncioMontado,
} from "@/lib/mercadolivre/publicar";
import {
  detalharAnuncio,
  editarAnuncio,
  mudarStatusAnuncio,
  salvarDescricaoAnuncio,
  type DetalheAnuncio,
} from "@/lib/mercadolivre/anuncio";
import { COMPOSICAO_LABEL, ORDEM_COMPOSICAO, conjuntosDoPool } from "@/lib/composicoes";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";
import { proximoEnvioPeixe, rotuloSegunda } from "@/lib/envio-peixe";
import { prazoMl } from "@/lib/mercadolivre/prazo";

/**
 * Ações da aba "Mercado Livre" do produto.
 *
 * Mesma régua da tela de integração (`config.editar`): mexer em anúncio é mexer
 * em preço de vitrine e em estoque de outro canal.
 */

export type Resultado = { ok: true; mensagem?: string } | { ok: false; erro: string };

function caminhoProduto(productId: string) {
  return `/admin/produtos/${productId}/editar`;
}

async function anuncioDoBanco(anuncioId: string) {
  return prisma.mercadoLivreAnuncio.findUnique({
    where: { id: anuncioId },
    select: {
      id: true,
      itemId: true,
      productId: true,
      composicao: true,
      tipoAnuncio: true,
      titulo: true,
    },
  });
}

// ── Leitura ──────────────────────────────────────────────────────────────────

export type ComposicaoPainel = {
  composicao: TipoComposicao;
  rotulo: string;
  precoSite: number;
  disponivel: number;
  /** Anúncio que já vende esta composição, se houver. */
  anuncioId: string | null;
};

export type AnuncioPainel = {
  id: string;
  itemId: string;
  composicao: TipoComposicao | null;
  tipoAnuncio: string | null;
  /** Quanto o site manda para este anúncio (conjuntos do pool, no peixe). */
  estoqueSite: number;
  estoqueEnviado: number | null;
  sincronizadoEm: Date | null;
  ultimoErro: string | null;
  detalhe: DetalheAnuncio | null;
  erroDetalhe: string | null;
};

export type PainelMl = {
  conectado: boolean;
  integracaoLigada: boolean;
  temLicencaIbama: boolean;
  produto: {
    id: string;
    nome: string;
    ehPeixe: boolean;
    fotos: number;
    composicoes: ComposicaoPainel[];
  };
  anuncios: AnuncioPainel[];
  /** Próxima segunda de envio e o prazo que vai no anúncio. */
  envio: { rotulo: string; dias: number; prazoMl: number; puladas: string[] };
};

/** Tudo que a aba mostra. Lê o ML ao vivo para cada anúncio ligado. */
export async function painelMlDoProduto(
  productId: string,
): Promise<{ ok: true; dados: PainelMl } | { ok: false; erro: string }> {
  try {
    await assertPermissao("config.editar");
  } catch (e) {
    if (e instanceof SemPermissaoError) return { ok: false, erro: e.message };
    throw e;
  }

  const [cfg, p, ligacoes] = await Promise.all([
    prisma.integracaoMercadoLivre.findUnique({
      where: { id: "default" },
      select: { ativo: true, sellerId: true, licencaIbama: true },
    }),
    prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        nome: true,
        tipo: true,
        estoque: true,
        estoqueMachos: true,
        estoqueFemeas: true,
        _count: { select: { imagens: true } },
        variantes: {
          where: { ativo: true },
          select: {
            composicao: true,
            preco: true,
            qtdMachos: true,
            qtdFemeas: true,
            padrao: true,
          },
        },
      },
    }),
    prisma.mercadoLivreAnuncio.findMany({
      where: { productId },
      orderBy: { criadoEm: "asc" },
      select: {
        id: true,
        itemId: true,
        composicao: true,
        tipoAnuncio: true,
        estoqueEnviado: true,
        sincronizadoEm: true,
        ultimoErro: true,
      },
    }),
  ]);
  if (!p) return { ok: false, erro: "Produto não encontrado." };

  const ehPeixe = p.tipo === "PEIXE";
  const pool = { machos: p.estoqueMachos, femeas: p.estoqueFemeas };

  const composicoes: ComposicaoPainel[] = ehPeixe
    ? [...p.variantes]
        .sort(
          (a, b) =>
            ORDEM_COMPOSICAO.indexOf(a.composicao) - ORDEM_COMPOSICAO.indexOf(b.composicao),
        )
        .map((v) => ({
          composicao: v.composicao,
          rotulo: COMPOSICAO_LABEL[v.composicao],
          precoSite: Number(v.preco),
          disponivel: conjuntosDoPool(v, pool),
          anuncioId: ligacoes.find((l) => l.composicao === v.composicao)?.id ?? null,
        }))
    : [];

  const conectado = !!cfg?.sellerId;
  const envio = proximoEnvioPeixe();
  const anuncios: AnuncioPainel[] = [];
  for (const l of ligacoes) {
    const det = conectado ? await detalharAnuncio(l.itemId) : null;
    anuncios.push({
      ...l,
      estoqueSite: disponivelNoAnuncio(p, l.composicao),
      detalhe: det?.ok ? det.dados : null,
      erroDetalhe: det && !det.ok ? det.erro : null,
    });
  }

  return {
    ok: true,
    dados: {
      conectado,
      integracaoLigada: !!cfg?.ativo,
      temLicencaIbama: !!cfg?.licencaIbama,
      produto: {
        id: p.id,
        nome: p.nome,
        ehPeixe,
        fotos: p._count.imagens,
        composicoes,
      },
      anuncios,
      envio: {
        rotulo: rotuloSegunda(envio.data),
        dias: envio.dias,
        prazoMl: prazoMl(),
        puladas: envio.puladas.map((x) => `${rotuloSegunda(x.segunda)} (${x.feriado})`),
      },
    },
  };
}

/** O anúncio como sairia, sem publicar: título, ficha, descrição e quantidade. */
export async function previaPublicacaoMl(dados: {
  productId: string;
  composicao: TipoComposicao | null;
  tipoAnuncio: string;
}): Promise<{ ok: true; dados: AnuncioMontado } | { ok: false; erro: string }> {
  await assertPermissao("config.editar");
  const r = await montarAnuncio({
    productId: dados.productId,
    composicao: dados.composicao,
    tipoAnuncio: ehTipoAnuncio(dados.tipoAnuncio) ? dados.tipoAnuncio : LISTING_TYPE,
  });
  return r.ok ? { ok: true, dados: r.dados } : { ok: false, erro: r.erro };
}

// ── Edição ───────────────────────────────────────────────────────────────────

/** Título e/ou preço do anúncio. */
export async function salvarAnuncioMl(dados: {
  anuncioId: string;
  titulo?: string;
  preco?: number;
}): Promise<Resultado> {
  const membro = await assertPermissao("config.editar");
  const a = await anuncioDoBanco(dados.anuncioId);
  if (!a) return { ok: false, erro: "Anúncio não encontrado." };

  const mudancas: { titulo?: string; preco?: number } = {};
  if (dados.titulo !== undefined) {
    const t = dados.titulo.trim().replace(/\s+/g, " ");
    // Mesmas regras que filtram a IA: tamanho, composição, palavra proibida e
    // título repetido entre os anúncios do produto.
    const erro = await conferirTitulo(a.productId, a.composicao, t, a.id);
    if (erro) return { ok: false, erro };
    mudancas.titulo = t;
  }
  if (dados.preco !== undefined) {
    const preco = Math.round(Number(dados.preco) * 100) / 100;
    if (!Number.isFinite(preco) || preco <= 0) {
      return { ok: false, erro: "Preço inválido." };
    }
    mudancas.preco = preco;
  }

  const r = await editarAnuncio(a.itemId, mudancas);
  if (!r.ok) return { ok: false, erro: r.erro };

  if (mudancas.titulo) {
    await prisma.mercadoLivreAnuncio.update({
      where: { id: a.id },
      data: { titulo: mudancas.titulo },
    });
  }

  await auditar(membro, {
    acao: "config.mercadolivre.editar",
    entidade: "MercadoLivreAnuncio",
    entidadeId: a.itemId,
    descricao: `Editou o anúncio ${a.itemId} no Mercado Livre${
      mudancas.preco !== undefined
        ? ` (preço R$ ${mudancas.preco.toFixed(2).replace(".", ",")})`
        : ""
    }${mudancas.titulo ? ` (título "${mudancas.titulo}")` : ""}`,
    depois: mudancas,
  });

  revalidatePath(caminhoProduto(a.productId));
  return { ok: true, mensagem: "Anúncio atualizado no Mercado Livre." };
}

/**
 * Ativar, pausar ou finalizar. Finalizar é sem volta no ML, então a ligação sai
 * junto: anúncio encerrado não recebe estoque, e deixar ligado só geraria erro
 * na sincronização.
 */
export async function statusAnuncioMl(dados: {
  anuncioId: string;
  status: "active" | "paused" | "closed";
}): Promise<Resultado> {
  const membro = await assertPermissao("config.editar");
  if (!["active", "paused", "closed"].includes(dados.status)) {
    return { ok: false, erro: "Status inválido." };
  }
  const a = await anuncioDoBanco(dados.anuncioId);
  if (!a) return { ok: false, erro: "Anúncio não encontrado." };

  const r = await mudarStatusAnuncio(a.itemId, dados.status);
  if (!r.ok) return { ok: false, erro: r.erro };

  if (dados.status === "closed") {
    await prisma.mercadoLivreAnuncio.delete({ where: { id: a.id } });
  }

  const nome = { active: "Ativou", paused: "Pausou", closed: "Finalizou" }[dados.status];
  await auditar(membro, {
    acao: `config.mercadolivre.${dados.status}`,
    entidade: "MercadoLivreAnuncio",
    entidadeId: a.itemId,
    descricao: `${nome} o anúncio ${a.itemId} no Mercado Livre`,
  });

  revalidatePath(caminhoProduto(a.productId));
  return {
    ok: true,
    mensagem: {
      active: "Anúncio ativo. Pode levar alguns minutos para aparecer na busca.",
      paused: "Anúncio pausado.",
      closed: "Anúncio finalizado e desligado do produto.",
    }[dados.status],
  };
}

/** Grava a descrição do anúncio. */
export async function descricaoAnuncioMl(dados: {
  anuncioId: string;
  texto: string;
}): Promise<Resultado> {
  const membro = await assertPermissao("config.editar");
  const texto = dados.texto.trim();

  const a = await anuncioDoBanco(dados.anuncioId);
  if (!a) return { ok: false, erro: "Anúncio não encontrado." };

  // HTML, link, telefone e contato por fora o ML pune; peixe sem a licença do
  // IBAMA ele cancela. Dizer antes poupa o erro genérico deles.
  const produto = await prisma.product.findUnique({
    where: { id: a.productId },
    select: { tipo: true },
  });
  const cfg = await prisma.integracaoMercadoLivre.findUnique({
    where: { id: "default" },
    select: { licencaIbama: true },
  });
  const erro = conferirDescricao(
    texto,
    produto?.tipo === "PEIXE" ? (cfg?.licencaIbama ?? null) : null,
  );
  if (erro) return { ok: false, erro };

  const r = await salvarDescricaoAnuncio(a.itemId, texto);
  if (!r.ok) return { ok: false, erro: r.erro };

  await auditar(membro, {
    acao: "config.mercadolivre.descricao",
    entidade: "MercadoLivreAnuncio",
    entidadeId: a.itemId,
    descricao: `Trocou a descrição do anúncio ${a.itemId} no Mercado Livre`,
  });
  return { ok: true, mensagem: "Descrição salva no Mercado Livre." };
}

/** Texto que o site montaria hoje para este anúncio (para restaurar/atualizar). */
export async function descricaoDoSiteMl(
  anuncioId: string,
): Promise<{ ok: true; texto: string } | { ok: false; erro: string }> {
  await assertPermissao("config.editar");
  const a = await anuncioDoBanco(anuncioId);
  if (!a) return { ok: false, erro: "Anúncio não encontrado." };
  const r = await montarAnuncio({
    productId: a.productId,
    composicao: a.composicao,
    tipoAnuncio: a.tipoAnuncio && ehTipoAnuncio(a.tipoAnuncio) ? a.tipoAnuncio : LISTING_TYPE,
  });
  if (!r.ok) return { ok: false, erro: r.erro };
  return { ok: true, texto: r.dados.descricao };
}

/**
 * Qual composição este anúncio vende. Ligação antiga (ou feita pelo número)
 * nasce sem, e aí o estoque e a baixa caem na composição padrão do produto.
 */
export async function composicaoAnuncioMl(dados: {
  anuncioId: string;
  composicao: TipoComposicao | null;
}): Promise<Resultado> {
  const membro = await assertPermissao("config.editar");
  const a = await anuncioDoBanco(dados.anuncioId);
  if (!a) return { ok: false, erro: "Anúncio não encontrado." };

  if (dados.composicao) {
    const outro = await prisma.mercadoLivreAnuncio.findFirst({
      where: { productId: a.productId, composicao: dados.composicao, NOT: { id: a.id } },
      select: { itemId: true },
    });
    if (outro) {
      return {
        ok: false,
        erro: `O anúncio ${outro.itemId} já vende ${COMPOSICAO_LABEL[dados.composicao]}.`,
      };
    }
  }

  await prisma.mercadoLivreAnuncio.update({
    where: { id: a.id },
    // Zera o espelho: com outra receita, o número que foi lá não vale mais.
    data: { composicao: dados.composicao, estoqueEnviado: null },
  });
  await auditar(membro, {
    acao: "config.mercadolivre.composicao",
    entidade: "MercadoLivreAnuncio",
    entidadeId: a.itemId,
    descricao: `Marcou o anúncio ${a.itemId} como ${
      dados.composicao ? COMPOSICAO_LABEL[dados.composicao] : "sem composição"
    }`,
  });

  // Estoque certo já, sem esperar a próxima venda.
  await sincronizarEstoqueMl([a.productId]);
  return { ok: true, mensagem: "Composição salva e estoque reenviado." };
}

/** Reenvia o estoque dos anúncios deste produto, mesmo que o espelho diga que está igual. */
export async function enviarEstoqueProdutoMl(productId: string): Promise<Resultado> {
  await assertPermissao("config.editar");
  // Zerar o espelho força o envio: alguém pode ter mexido no estoque lá no ML.
  await prisma.mercadoLivreAnuncio.updateMany({
    where: { productId },
    data: { estoqueEnviado: null },
  });
  const r = await sincronizarEstoqueMl([productId]);
  if (r.erros.length > 0) return { ok: false, erro: r.erros.slice(0, 2).join(" · ") };
  return { ok: true, mensagem: `Estoque enviado para ${r.enviados} anúncio(s).` };
}

/**
 * Liga a este produto um anúncio que já existe no ML (feito no painel de lá),
 * pelo número. Confere que o anúncio é da conta conectada antes.
 */
export async function ligarAnuncioPorNumeroMl(dados: {
  productId: string;
  itemId: string;
  composicao: TipoComposicao | null;
}): Promise<Resultado> {
  const membro = await assertPermissao("config.editar");

  const itemId = dados.itemId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^MLB\d{6,}$/.test(itemId)) {
    return { ok: false, erro: "Número de anúncio inválido. Ele começa com MLB, ex.: MLB7639105290." };
  }

  const cfg = await prisma.integracaoMercadoLivre.findUnique({
    where: { id: "default" },
    select: { sellerId: true },
  });
  if (!cfg?.sellerId) return { ok: false, erro: "Autorize a conta do Mercado Livre primeiro." };

  const item = await chamarMl<{ title?: string; seller_id?: number; listing_type_id?: string }>(
    `/items/${itemId}`,
  );
  if (!item.ok) return { ok: false, erro: item.erro };
  if (String(item.dados.seller_id ?? "") !== cfg.sellerId) {
    return { ok: false, erro: "Esse anúncio não é da conta conectada." };
  }

  const existente = await prisma.mercadoLivreAnuncio.findFirst({
    where: { itemId, variationId: null },
    select: { id: true, productId: true },
  });
  if (existente && existente.productId !== dados.productId) {
    return { ok: false, erro: "Esse anúncio já está ligado a outro produto. Desligue lá antes." };
  }
  if (existente) return { ok: false, erro: "Esse anúncio já está ligado a este produto." };

  if (dados.composicao) {
    const outro = await prisma.mercadoLivreAnuncio.findFirst({
      where: { productId: dados.productId, composicao: dados.composicao },
      select: { itemId: true },
    });
    if (outro) {
      return {
        ok: false,
        erro: `O anúncio ${outro.itemId} já vende ${COMPOSICAO_LABEL[dados.composicao]} deste produto.`,
      };
    }
  }

  const tipo = item.dados.listing_type_id ?? null;
  await prisma.mercadoLivreAnuncio.create({
    data: {
      productId: dados.productId,
      itemId,
      variationId: null,
      titulo: item.dados.title?.slice(0, 200) ?? null,
      tipoAnuncio: tipo && tipo in TIPOS_ANUNCIO ? tipo : null,
      composicao: dados.composicao,
    },
  });

  await auditar(membro, {
    acao: "config.mercadolivre.ligar",
    entidade: "MercadoLivreAnuncio",
    entidadeId: itemId,
    descricao: `Ligou o anúncio ${itemId} do Mercado Livre pelo número`,
  });

  await sincronizarEstoqueMl([dados.productId]);
  revalidatePath(caminhoProduto(dados.productId));
  return { ok: true, mensagem: "Anúncio ligado e estoque enviado." };
}
