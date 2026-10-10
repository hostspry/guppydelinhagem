"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { ErroSorteio, marcarAvisoVisto, solicitarVerificacao } from "@/lib/sorteios/servico";

// Lado do cliente: pedir a verificação de um WhatsApp e dispensar o aviso de
// créditos novos. O userId vem SEMPRE da sessão, nunca do formulário.

export async function solicitarVerificacaoAction(
  telefone: string,
): Promise<{ ok: true; codigo: string; telefone: string } | { ok: false; erro: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, erro: "Entre na sua conta para continuar." };

  const ip = clientIp(await headers());
  if (!rateLimit(`verif-tel:${session.user.id}`, 5, 10 * 60_000).ok || !rateLimit(`verif-tel-ip:${ip}`, 15, 10 * 60_000).ok) {
    return { ok: false, erro: "Muitas tentativas. Espere alguns minutos." };
  }
  try {
    const r = await solicitarVerificacao(session.user.id, telefone);
    revalidatePath("/minha-conta/sorteios");
    return { ok: true, codigo: r.codigo, telefone: r.telefone };
  } catch (e) {
    if (e instanceof ErroSorteio) return { ok: false, erro: e.message };
    console.error("[sorteios] verificação", e);
    return { ok: false, erro: "Não foi possível gerar o código. Tente de novo." };
  }
}

export async function dispensarAvisoAction(participanteIds: string[]): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await marcarAvisoVisto(session.user.id, participanteIds.slice(0, 50));
}
