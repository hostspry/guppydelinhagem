"use server";

import { assertAuthorized } from "@/lib/utils/action-result";
import {
  generateProductContent,
  type GeneratedProductContent,
} from "@/lib/ai/gemini";

export type GenerateContentResult =
  | { ok: true; data: GeneratedProductContent }
  | { ok: false; error: string };

/**
 * Gera (sem persistir) o rascunho de conteúdo do produto a partir do vídeo
 * primário + briefing. Erros (chave, quota, timeout, parse) viram mensagem
 * amigável — o form nunca quebra; o operador sempre pode preencher à mão.
 */
export async function generateContent(input: {
  videoTitle: string;
  videoHashtags?: string;
  briefing: string;
  categoria?: string;
  pesquisar?: boolean;
}): Promise<GenerateContentResult> {
  try {
    await assertAuthorized();
    const data = await generateProductContent({
      videoTitle: input.videoTitle ?? "",
      videoHashtags: input.videoHashtags,
      briefing: input.briefing ?? "",
      categoria: input.categoria,
      pesquisar: input.pesquisar === true,
    });
    return { ok: true, data };
  } catch (e) {
    console.error("generateContent:", e);
    return {
      ok: false,
      error:
        "Não foi possível gerar agora. Tente novamente ou preencha manualmente.",
    };
  }
}
