"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  productSchema,
  videosSchema,
  type VideoDraft,
} from "@/lib/validations/product";
import {
  parseVideoUrl,
  youtubeThumbnailUrl,
  type DetectedPlatform,
} from "@/lib/utils/video";
import {
  type ActionResult,
  assertAuthorized,
  isPrismaError,
} from "@/lib/utils/action-result";

function parseForm(formData: FormData) {
  return productSchema.safeParse({
    nome: formData.get("nome"),
    slug: formData.get("slug"),
    descricao: formData.get("descricao"),
    descricaoCurta: formData.get("descricaoCurta") || undefined,
    preco: formData.get("preco"),
    descontoPix: formData.get("descontoPix") || undefined,
    parcelasMax: formData.get("parcelasMax"),
    tipo: formData.get("tipo"),
    estoque: formData.get("estoque"),
    categoryId: formData.get("categoryId"),
    ativo: formData.get("ativo"),
    destaque: formData.get("destaque"),
    metaTitle: formData.get("metaTitle") || undefined,
    metaDescription: formData.get("metaDescription") || undefined,
  });
}

/** Monta o objeto persistível (campos escalares) a partir dos dados validados. */
function toData(input: ReturnType<typeof productSchema.parse>) {
  return {
    nome: input.nome,
    slug: input.slug,
    descricao: input.descricao,
    descricaoCurta: input.descricaoCurta ? input.descricaoCurta : null,
    preco: input.preco,
    descontoPix: input.descontoPix ?? null,
    parcelasMax: input.parcelasMax,
    tipo: input.tipo,
    estoque: input.estoque,
    categoryId: input.categoryId,
    ativo: input.ativo,
    destaque: input.destaque,
    metaTitle: input.metaTitle ? input.metaTitle : null,
    metaDescription: input.metaDescription ? input.metaDescription : null,
  };
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
    ordem: i,
  }));
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  await assertAuthorized();

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

  try {
    // Nested create: produto + vídeos numa única transação implícita.
    await prisma.product.create({
      data: {
        ...toData(parsed.data),
        videos: { create: buildVideoCreates(videos.videos) },
      },
    });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return { success: false, error: "Slug já existe. Escolha outro." };
    }
    console.error(e);
    return { success: false, error: "Erro ao salvar. Tente novamente." };
  }

  revalidatePath("/admin/produtos");
  redirect("/admin/produtos");
}

export async function updateProduct(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await assertAuthorized();

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

  try {
    // Reconcilia por substituição total: remove os vídeos atuais e recria a
    // partir do array enviado (ProductVideo não tem referências externas).
    await prisma.product.update({
      where: { id },
      data: {
        ...toData(parsed.data),
        videos: {
          deleteMany: {},
          create: buildVideoCreates(videos.videos),
        },
      },
    });
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

  revalidatePath("/admin/produtos");
  redirect("/admin/produtos");
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await assertAuthorized();

  const prod = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { orderItems: true } } },
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

  revalidatePath("/admin/produtos");
  return { success: true, message: "Produto excluído." };
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
  await assertAuthorized();

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

  // Instagram / TikTok: sem fetch automático.
  return {
    ok: true,
    data: { platform, videoId: null, titulo: "", thumbnailUrl: "" },
  };
}
