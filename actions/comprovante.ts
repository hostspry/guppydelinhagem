"use server";

import { assertPermissao } from "@/lib/permissoes-server";
import { prisma } from "@/lib/prisma";
import { uploadComprovante } from "@/lib/s3";
import {
  lerComprovante,
  MAX_BYTES_COMPROVANTE,
  MIMES_COMPROVANTE,
  type ComprovanteLido,
} from "@/lib/ai/comprovante";

export type LeituraResult =
  | {
      ok: true;
      dados: ComprovanteLido;
      comprovanteUrl: string | null;
      categoriaId: string | null;
    }
  | { ok: false; error: string; comprovanteUrl?: string | null };

const EXT_POR_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function mimeAceito(m: string): boolean {
  return (MIMES_COMPROVANTE as readonly string[]).includes(m);
}

/**
 * Lê um comprovante (arquivo ou texto colado) e devolve um RASCUNHO para o
 * formulário. Não grava lançamento nenhum: quem salva é o dono, depois de
 * conferir. O arquivo, quando existe, sobe antes da leitura — se a IA falhar, o
 * anexo já está guardado e dá para lançar à mão sem perder o comprovante.
 */
export async function lerComprovanteEnviado(
  formData: FormData,
): Promise<LeituraResult> {
  await assertPermissao("financeiro.gerenciar");

  const arquivo = formData.get("arquivo");
  const texto = String(formData.get("texto") ?? "").trim();

  const categorias = await prisma.categoriaFinanceira.findMany({
    where: { ativa: true },
    select: { id: true, slug: true, nome: true, tipo: true },
    orderBy: { ordem: "asc" },
  });
  const disponiveis = categorias.map((c) => ({
    slug: c.slug,
    nome: c.nome,
    tipo: c.tipo as "ENTRADA" | "SAIDA" | null,
  }));

  let comprovanteUrl: string | null = null;
  let entrada: Parameters<typeof lerComprovante>[0];

  if (arquivo instanceof File && arquivo.size > 0) {
    if (!mimeAceito(arquivo.type)) {
      return {
        ok: false,
        error: "Envie um PDF ou uma imagem (JPG, PNG, WEBP) do comprovante.",
      };
    }
    if (arquivo.size > MAX_BYTES_COMPROVANTE) {
      return { ok: false, error: "Arquivo muito grande. O limite é 10 MB." };
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const ext = EXT_POR_MIME[arquivo.type] ?? "bin";

    try {
      comprovanteUrl = await uploadComprovante(buffer, arquivo.type, ext);
    } catch (e) {
      console.error("[comprovante] upload", e);
      return { ok: false, error: "Não foi possível guardar o arquivo." };
    }

    entrada = {
      base64: buffer.toString("base64"),
      mimeType: arquivo.type,
      nomeArquivo: arquivo.name,
    };
  } else if (texto.length >= 10) {
    entrada = { texto };
  } else {
    return {
      ok: false,
      error: "Cole o texto do comprovante ou escolha um arquivo.",
    };
  }

  try {
    const dados = await lerComprovante(entrada, disponiveis);
    const categoriaId = dados.categoriaSlug
      ? (categorias.find((c) => c.slug === dados.categoriaSlug)?.id ?? null)
      : null;
    return { ok: true, dados, comprovanteUrl, categoriaId };
  } catch (e) {
    console.error("[comprovante] leitura", e);
    const msg =
      e instanceof Error && /GEMINI_API_KEY/.test(e.message)
        ? "A leitura por IA não está configurada (falta a chave do Gemini)."
        : "Não consegui ler este comprovante. Preencha os campos à mão.";
    return { ok: false, error: msg, comprovanteUrl };
  }
}
