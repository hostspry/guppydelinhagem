"use server";

import { assertAuthorized } from "@/lib/utils/action-result";
import { uploadImage } from "@/lib/s3";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Recebe um arquivo de imagem do form, valida tipo/tamanho NO SERVIDOR (não
 * confia no client) e envia ao Garage. Retorna a URL pública.
 */
export async function uploadProductImage(
  formData: FormData,
): Promise<UploadResult> {
  await assertAuthorized();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Nenhum arquivo enviado." };
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return { ok: false, error: "Formato inválido. Use JPG, PNG ou WebP." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Imagem muito grande (máx 5 MB)." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadImage(buffer, file.type, ext);
    return { ok: true, url };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Falha no upload. Tente novamente." };
  }
}
