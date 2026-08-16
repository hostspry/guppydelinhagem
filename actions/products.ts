"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  productSchema,
  videosSchema,
  type VideoDraft,
  type VariantInput,
  type ProductInput,
} from "@/lib/validations/product";
import {
  parseVideoUrl,
  youtubeThumbnailUrl,
  type DetectedPlatform,
} from "@/lib/utils/video";
import { deleteImage } from "@/lib/s3";
import { type ActionResult, isPrismaError } from "@/lib/utils/action-result";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar, diff } from "@/lib/auditoria";

/** Campo JSON (array serializado pelo form). Falha → []. */
function parseJsonArrayField(raw: FormDataEntryValue | null): unknown[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const json = JSON.parse(raw);
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

function parseForm(formData: FormData) {
  return productSchema.safeParse({
    nome: formData.get("nome"),
    slug: formData.get("slug"),
    descricao: formData.get("descricao"),
    descricaoCurta: formData.get("descricaoCurta") || undefined,
    preco: formData.get("preco"),
    descontoPix: formData.get("descontoPix") || undefined,
    usarDescontoPixGlobal: formData.get("usarDescontoPixGlobal"),
    parcelasMax: formData.get("parcelasMax"),
    tipo: formData.get("tipo"),
    estoque: formData.get("estoque"),
    estoqueMachos: formData.get("estoqueMachos"),
    estoqueFemeas: formData.get("estoqueFemeas"),
    categoryId: formData.get("categoryId"),
    ativo: formData.get("ativo"),
    destaque: formData.get("destaque"),
    linhagemCampea: formData.get("linhagemCampea"),
    metaTitle: formData.get("metaTitle") || undefined,
    metaDescription: formData.get("metaDescription") || undefined,
    keywords: parseJsonArrayField(formData.get("keywords")),
    variantes: parseJsonArrayField(formData.get("variantes")),
    padraoCor: formData.get("padraoCor") || undefined,
    cauda: formData.get("cauda") || undefined,
    caracteristica: formData.get("caracteristica") || undefined,
    origem: formData.get("origem") || undefined,
    temperatura: formData.get("temperatura") || undefined,
    ph: formData.get("ph") || undefined,
    alimentacao: formData.get("alimentacao") || undefined,
    expectativaVida: formData.get("expectativaVida") || undefined,
  });
}

/** "" → null para colunas opcionais de texto. */
function orNull(v: string | undefined | null): string | null {
  return v ? v : null;
}

/**
 * Campos escalares do Product. Em PEIXE, `preco`/`estoque` ESPELHAM a variante
 * padrão (trio) — a coluna `preco` é NOT NULL e os cards leem dela. Em não-peixe,
 * usa os campos do próprio produto.
 */
function scalarData(input: ProductInput) {
  const isPeixe = input.tipo === "PEIXE";
  const ativas = input.variantes.filter((v) => v.ativo);
  const padrao = ativas.find((v) => v.padrao) ?? ativas[0];
  const preco = isPeixe ? (padrao?.preco ?? 0) : (input.preco ?? 0);
  // Pool real (PEIXE); espelho `estoque` = machos + fêmeas.
  const machos = isPeixe ? (input.estoqueMachos ?? 0) : 0;
  const femeas = isPeixe ? (input.estoqueFemeas ?? 0) : 0;
  const estoque = isPeixe ? machos + femeas : (input.estoque ?? 0);

  return {
    nome: input.nome,
    slug: input.slug,
    descricao: input.descricao,
    descricaoCurta: input.descricaoCurta ? input.descricaoCurta : null,
    preco,
    descontoPix: input.descontoPix ?? null,
    usarDescontoPixGlobal: input.usarDescontoPixGlobal,
    parcelasMax: input.parcelasMax,
    tipo: input.tipo,
    estoque,
    estoqueMachos: machos,
    estoqueFemeas: femeas,
    categoryId: input.categoryId,
    ativo: input.ativo,
    destaque: input.destaque,
    linhagemCampea: input.linhagemCampea,
    metaTitle: input.metaTitle ? input.metaTitle : null,
    metaDescription: input.metaDescription ? input.metaDescription : null,
    keywords: input.keywords,
    padraoCor: orNull(input.padraoCor),
    cauda: orNull(input.cauda),
    caracteristica: orNull(input.caracteristica),
    origem: orNull(input.origem),
    temperatura: orNull(input.temperatura),
    ph: orNull(input.ph),
    alimentacao: orNull(input.alimentacao),
    expectativaVida: orNull(input.expectativaVida),
  };
}

/** Variantes → input de create aninhado (ordem pela posição). */
function buildVariantCreates(variantes: VariantInput[]) {
  return variantes.map((v, i) => ({
    composicao: v.composicao,
    preco: v.preco,
    qtdMachos: v.qtdMachos,
    qtdFemeas: v.qtdFemeas,
    rotulo: v.rotulo ? v.rotulo : null,
    padrao: v.padrao,
    ativo: v.ativo,
    ordem: i,
  }));
}

/** Lê e valida o array de vídeos serializado (JSON) pelo ProductForm. */
function parseVideos(
  formData: FormData,
): { ok: true; videos: VideoDraft[] } | { ok: false } {
  const raw = formData.get("videos");
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: true, videos: [] };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  const parsed = videosSchema.safeParse(json);
  if (!parsed.success) return { ok: false };
  return { ok: true, videos: parsed.data };
}

/**
 * Aplica a regra do principal (exatamente um) e mapeia para o input de create
 * aninhado do Prisma, atribuindo `ordem` pela posição. Se nenhum vier marcado e
 * houver vídeos, o primeiro vira principal.
 */
function buildVideoCreates(videos: VideoDraft[]) {
  if (videos.length === 0) return [];
  let principalIdx = videos.findIndex((v) => v.principal);
  if (principalIdx === -1) principalIdx = 0;

  return videos.map((v, i) => ({
    platform: v.platform,
    videoId: v.videoId ?? null,
    originalUrl: v.originalUrl,
    titulo: v.titulo ? v.titulo : null,
    thumbnailUrl: v.thumbnailUrl ? v.thumbnailUrl : null,
    principal: i === principalIdx,
    ativo: v.ativo ?? true, // default ativo; admin pode ocultar
    ordem: i,
  }));
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const videos = parseVideos(formData);
  if (!videos.ok) {
    return { success: false, error: "Dados de vídeo inválidos." };
  }

  let criadoId = "";
  try {
    // Nested create: produto + vídeos + variantes numa única transação implícita.
    const criado = await prisma.product.create({
      data: {
        ...scalarData(parsed.data),
        videos: { create: buildVideoCreates(videos.videos) },
        variantes: { create: buildVariantCreates(parsed.data.variantes) },
      },
      select: { id: true },
    });
    criadoId = criado.id;
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return { success: false, error: "Slug já existe. Escolha outro." };
    }
    console.error(e);
    return { success: false, error: "Erro ao salvar. Tente novamente." };
  }

  await auditar(membro, {
    acao: "produto.criar",
    entidade: "Product",
    entidadeId: criadoId,
    descricao: `Criou o produto ${parsed.data.nome}`,
    depois: {
      nome: parsed.data.nome,
      preco: scalarData(parsed.data).preco,
      estoque: scalarData(parsed.data).estoque,
      ativo: parsed.data.ativo,
    },
  });

  // 'layout' invalida a subárvore inteira de /admin/produtos (listagem +
  // detalhe + edição), não só a rota da listagem — assim a tela de edição não
  // serve RSC em cache stale ao voltar para o produto.
  revalidatePath("/admin/produtos", "layout");
  revalidatePath("/loja/[slug]", "page"); // página de produto
  revalidatePath("/"); // home pública reflete o novo produto
  redirect("/admin/produtos");
}

export async function updateProduct(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");

  // Foto do estado atual ANTES de salvar — é a única chance de saber de onde o
  // preço e o estoque vieram.
  const anterior = await prisma.product.findUnique({
    where: { id },
    select: {
      nome: true,
      preco: true,
      estoque: true,
      estoqueMachos: true,
      estoqueFemeas: true,
      ativo: true,
      destaque: true,
      categoryId: true,
    },
  });

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const videos = parseVideos(formData);
  if (!videos.ok) {
    return { success: false, error: "Dados de vídeo inválidos." };
  }

  // Variantes: reconcilia por COMPOSIÇÃO (upsert) — NÃO recria IDs (mantém o
  // variantId estável p/ carrinhos salvos no localStorage). Composições ausentes
  // viram ativo:false (soft-delete), não delete. Vídeos seguem por substituição.
  const enviadas = parsed.data.variantes.map((v) => v.composicao);
  try {
    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: {
          ...scalarData(parsed.data),
          videos: {
            deleteMany: {},
            create: buildVideoCreates(videos.videos),
          },
        },
      }),
      ...parsed.data.variantes.map((v, i) =>
        prisma.productVariant.upsert({
          where: { productId_composicao: { productId: id, composicao: v.composicao } },
          create: {
            productId: id,
            composicao: v.composicao,
            preco: v.preco,
            qtdMachos: v.qtdMachos,
            qtdFemeas: v.qtdFemeas,
            rotulo: v.rotulo ? v.rotulo : null,
            padrao: v.padrao,
            ativo: v.ativo,
            ordem: i,
          },
          update: {
            preco: v.preco,
            qtdMachos: v.qtdMachos,
            qtdFemeas: v.qtdFemeas,
            rotulo: v.rotulo ? v.rotulo : null,
            padrao: v.padrao,
            ativo: v.ativo,
            ordem: i,
          },
        }),
      ),
      // Composições não enviadas → soft-delete (não-peixe: zera todas).
      prisma.productVariant.updateMany({
        where: {
          productId: id,
          ...(enviadas.length ? { composicao: { notIn: enviadas } } : {}),
        },
        data: { ativo: false },
      }),
    ]);
  } catch (e) {
    if (isPrismaError(e)) {
      if (e.code === "P2002") {
        return { success: false, error: "Slug já existe. Escolha outro." };
      }
      if (e.code === "P2025") {
        return { success: false, error: "Produto não encontrado." };
      }
    }
    console.error(e);
    return { success: false, error: "Erro ao salvar." };
  }

  if (anterior) {
    const d = parsed.data;
    const mudancas = diff(
      { ...anterior },
      {
        nome: d.nome,
        preco: scalarData(d).preco,
        estoque: scalarData(d).estoque,
        estoqueMachos: scalarData(d).estoqueMachos,
        estoqueFemeas: scalarData(d).estoqueFemeas,
        ativo: d.ativo,
        destaque: d.destaque,
        categoryId: d.categoryId,
      },
    );
    if (mudancas.mudou) {
      await auditar(membro, {
        acao: "produto.atualizar",
        entidade: "Product",
        entidadeId: id,
        descricao: `Editou o produto ${d.nome}`,
        antes: mudancas.antes,
        depois: mudancas.depois,
      });
    }
  }

  revalidatePath("/admin/produtos", "layout");
  revalidatePath("/loja/[slug]", "page"); // página de produto
  revalidatePath("/"); // home pública reflete a edição
  redirect("/admin/produtos");
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.excluir");

  const prod = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: { select: { orderItems: true } },
      videos: { select: { thumbnailUrl: true } },
    },
  });

  if (!prod) return { success: false, error: "Produto não encontrado." };

  // Pedidos vinculados impedem exclusão (histórico de venda; relação sem cascade).
  if (prod._count.orderItems > 0) {
    return {
      success: false,
      error: `Não é possível excluir: ${prod._count.orderItems} pedido(s) vinculado(s).`,
    };
  }

  try {
    // Imagens, vídeos e waitlist somem por onDelete: Cascade.
    await prisma.product.delete({ where: { id } });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2003") {
      return {
        success: false,
        error: "Não é possível excluir: há registros vinculados a este produto.",
      };
    }
    console.error(e);
    return { success: false, error: "Erro ao excluir." };
  }

  // Best-effort: remove do Garage as thumbnails que nós enviamos.
  // deleteImage ignora URLs que não são do nosso domínio público (YouTube etc.).
  await Promise.all(
    prod.videos
      .map((v) => v.thumbnailUrl)
      .filter((u): u is string => !!u)
      .map((u) => deleteImage(u).catch(() => {})),
  );

  await auditar(membro, {
    acao: "produto.excluir",
    entidade: "Product",
    entidadeId: id,
    descricao: `Excluiu o produto ${prod.nome}`,
    antes: { nome: prod.nome, preco: prod.preco, estoque: prod.estoque },
  });

  revalidatePath("/admin/produtos", "layout");
  revalidatePath("/"); // home pública deixa de mostrar o produto excluído
  return { success: true, message: "Produto excluído." };
}

// ── Toggles rápidos na lista (ativo / destaque) ────────────────────────────
export async function toggleProductAtivo(
  id: string,
  value: boolean,
): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");
  const alvo = await prisma.product.findUnique({
    where: { id },
    select: { nome: true, ativo: true },
  });
  try {
    await prisma.product.update({ where: { id }, data: { ativo: value } });
    await auditar(membro, {
      acao: "produto.ativo",
      entidade: "Product",
      entidadeId: id,
      descricao: `${value ? "Marcou" : "Desmarcou"} ${alvo?.nome ?? "produto"} como publicado`,
      antes: { ativo: alvo?.ativo },
      depois: { ativo: value },
    });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2025") {
      return { success: false, error: "Produto não encontrado." };
    }
    console.error(e);
    return { success: false, error: "Erro ao atualizar." };
  }
  revalidatePath("/admin/produtos", "layout");
  revalidatePath("/"); // visibilidade na vitrine
  revalidatePath("/loja/[slug]", "page");
  return { success: true };
}

export async function toggleProductDestaque(
  id: string,
  value: boolean,
): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");
  const alvo = await prisma.product.findUnique({
    where: { id },
    select: { nome: true, destaque: true },
  });
  try {
    await prisma.product.update({ where: { id }, data: { destaque: value } });
    await auditar(membro, {
      acao: "produto.destaque",
      entidade: "Product",
      entidadeId: id,
      descricao: `${value ? "Marcou" : "Desmarcou"} ${alvo?.nome ?? "produto"} como em destaque`,
      antes: { destaque: alvo?.destaque },
      depois: { destaque: value },
    });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2025") {
      return { success: false, error: "Produto não encontrado." };
    }
    console.error(e);
    return { success: false, error: "Erro ao atualizar." };
  }
  revalidatePath("/admin/produtos", "layout");
  revalidatePath("/"); // vitrine de destaque na home
  return { success: true };
}

// ── Metadados de vídeo (botão "Adicionar" no form) ─────────────────────────
export type VideoMetadata = {
  platform: DetectedPlatform;
  videoId: string | null;
  titulo: string;
  thumbnailUrl: string;
};

/**
 * Resolve plataforma/título/thumbnail de uma URL de vídeo SEM persistir.
 * YouTube: busca via oEmbed (server-side); fallback para thumbnail de frame
 * público se o oEmbed falhar. IG/TikTok: título/thumbnail ficam manuais.
 */
export async function fetchVideoMetadata(
  url: string,
): Promise<{ ok: true; data: VideoMetadata } | { ok: false; error: string }> {
  await assertPermissao("catalogo.editar");

  const parsed = parseVideoUrl(url);
  if (!parsed) {
    return {
      ok: false,
      error: "URL não reconhecida. Use YouTube, Instagram ou TikTok.",
    };
  }

  const { platform, videoId } = parsed;

  if (platform === "YOUTUBE" && videoId) {
    let titulo = "";
    let thumbnailUrl = youtubeThumbnailUrl(videoId);
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          title?: string;
          thumbnail_url?: string;
        };
        if (data.title) titulo = data.title;
        if (data.thumbnail_url) thumbnailUrl = data.thumbnail_url;
      }
    } catch {
      // mantém o fallback (videoId + frame público)
    }
    return { ok: true, data: { platform, videoId, titulo, thumbnailUrl } };
  }

  // TikTok com URL curta (vt.tiktok.com): resolve o redirect p/ a URL canônica
  // e extrai o id numérico. Se falhar, cai no fallback (videoId null → nova aba).
  if (platform === "TIKTOK" && !videoId) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      const m = res.url.match(/\/video\/(\d+)/);
      return {
        ok: true,
        data: {
          platform,
          videoId: m ? m[1] : null,
          titulo: "",
          thumbnailUrl: "",
        },
      };
    } catch {
      return {
        ok: true,
        data: { platform, videoId: null, titulo: "", thumbnailUrl: "" },
      };
    }
  }

  // Instagram (shortcode) ou TikTok já canônico: usa o videoId do parse.
  return {
    ok: true,
    data: { platform, videoId, titulo: "", thumbnailUrl: "" },
  };
}
