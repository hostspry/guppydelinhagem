"use server";

import { uploadImage, deleteImage } from "@/lib/s3";
import { assertPermissao } from "@/lib/permissoes-server";
import { otimizarImagemProduto } from "@/lib/imagem";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
// Foto de celular direto da galeria passa fácil de 5 MB. Como a otimização
// reduz no servidor, o limite de entrada acompanha o do Server Action (10 MB).
const MAX_BYTES = 9 * 1024 * 1024;

type UploadResult =
  | {
      ok: true;
      /** Versão do site (até 100 KB). */
      url: string;
      /** Versão em alta para o Mercado Livre. Nula se a otimização falhou. */
      urlAlta: string | null;
      /** O que a otimização fez, para a tela contar ao dono. */
      info: {
        kbAntes: number;
        kbSite: number;
        largura: number;
        altura: number;
        qualidade: number | null;
        avisos: string[];
      };
    }
  | { ok: false; error: string };

/**
 * Recebe um arquivo de imagem do form, valida tipo/tamanho NO SERVIDOR (não
 * confia no client), otimiza em duas versões (lib/imagem: site até 100 KB e
 * alta para o ML) e envia as duas ao Garage.
 */
export async function uploadProductImage(
  formData: FormData,
): Promise<UploadResult> {
  await assertPermissao("catalogo.editar");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Nenhum arquivo enviado." };
  }
  const ext = EXT[file.type];
  if (!ext) {
    return { ok: false, error: "Formato inválido. Use JPG, PNG ou WebP." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Imagem muito grande (máx 9 MB)." };
  }

  const original = Buffer.from(await file.arrayBuffer());

  let otimizada: Awaited<ReturnType<typeof otimizarImagemProduto>> | null = null;
  try {
    otimizada = await otimizarImagemProduto(original);
  } catch (e) {
    // Otimizar é melhoria, não requisito: se o sharp falhar (binário ausente no
    // container, formato estranho), a foto sobe como veio, igual era antes.
    console.error("[upload] otimização falhou, subindo a original", e);
  }

  try {
    let url: string;
    let urlAlta: string | null = null;
    if (otimizada) {
      [url, urlAlta] = await Promise.all([
        uploadImage(otimizada.site.buffer, otimizada.contentType, otimizada.ext),
        uploadImage(otimizada.alta.buffer, otimizada.contentType, otimizada.ext),
      ]);
    } else {
      url = await uploadImage(original, file.type, ext);
    }

    // Substituição: remove a thumbnail anterior do Garage (best-effort).
    // deleteImage ignora URLs externas (ex: frame do YouTube colado).
    const oldUrl = formData.get("oldUrl");
    if (typeof oldUrl === "string" && oldUrl) {
      await deleteImage(oldUrl).catch(() => {});
    }

    return {
      ok: true,
      url,
      urlAlta,
      info: otimizada
        ? {
            kbAntes: Math.round(otimizada.bytesAntes / 1024),
            kbSite: Math.round(otimizada.site.bytes / 1024),
            largura: otimizada.site.largura,
            altura: otimizada.site.altura,
            qualidade: otimizada.site.qualidade,
            avisos: otimizada.avisos,
          }
        : {
            kbAntes: Math.round(original.length / 1024),
            kbSite: Math.round(original.length / 1024),
            largura: 0,
            altura: 0,
            qualidade: null,
            avisos: ["não foi otimizada (subiu como veio)"],
          },
    };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Falha no upload. Tente novamente." };
  }
}
