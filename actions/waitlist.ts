"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { normalizeWhatsappBR } from "@/lib/utils/whatsapp";

export type WaitlistResult = { ok: true } | { ok: false; error: string };

/**
 * Cadastra um WhatsApp na lista de espera de um produto (sem estoque). Idempotente
 * por (produto, whatsapp) — recadastrar o mesmo número é no-op de sucesso. Não
 * exige login. Os leads ficam salvos para o dono avisar quando houver ninhada.
 */
export async function entrarNaListaDeEspera(
  productId: string,
  whatsappRaw: string,
): Promise<WaitlistResult> {
  if (!productId) {
    return { ok: false, error: "Produto inválido." };
  }
  const whatsapp = normalizeWhatsappBR(whatsappRaw);
  if (!whatsapp) {
    return { ok: false, error: "WhatsApp inválido. Informe DDD + número." };
  }

  // Se houver sessão, liga a espera à conta (fecha o ciclo com o painel).
  const session = await auth();
  const userId = session?.user?.id;

  try {
    // upsert na unique (productId, whatsapp) — evita duplicar o mesmo número.
    await prisma.waitlistEntry.upsert({
      where: { productId_whatsapp: { productId, whatsapp } },
      create: { productId, whatsapp, ...(userId ? { userId } : {}) },
      update: userId ? { userId } : {},
    });
    return { ok: true };
  } catch (e) {
    // FK inválida (produto inexistente) cai aqui — mensagem amigável.
    console.error("entrarNaListaDeEspera:", e);
    return {
      ok: false,
      error: "Não foi possível cadastrar agora. Tente novamente.",
    };
  }
}
