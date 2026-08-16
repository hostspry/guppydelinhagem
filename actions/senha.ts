"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { ActionResult } from "@/lib/utils/action-result";

const trocaSchema = z
  .object({
    atual: z.string().min(1, "Digite a senha atual."),
    nova: z.string().min(8, "A nova senha precisa de pelo menos 8 caracteres."),
    confirmacao: z.string(),
  })
  .refine((d) => d.nova === d.confirmacao, {
    path: ["confirmacao"],
    message: "As duas senhas não são iguais.",
  })
  .refine((d) => d.nova !== d.atual, {
    path: ["nova"],
    message: "A nova senha precisa ser diferente da atual.",
  });

/**
 * Troca a senha de quem está logado. Pede a senha atual mesmo no caso da senha
 * temporária: a pessoa acabou de digitá-la no login, e isso impede que um painel
 * deixado aberto vire uma troca de senha por outra pessoa.
 */
export async function trocarMinhaSenha(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado." };

  const parsed = trocaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { senhaHash: true, role: true },
  });
  if (!user?.senhaHash || user.role === "CUSTOMER") {
    return { success: false, error: "Conta sem acesso ao painel." };
  }

  if (!(await bcrypt.compare(parsed.data.atual, user.senhaHash))) {
    return {
      success: false,
      error: "Senha atual incorreta.",
      fieldErrors: { atual: ["Senha atual incorreta."] },
    };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      senhaHash: await bcrypt.hash(parsed.data.nova, 10),
      senhaPrecisaTroca: false,
    },
  });

  return { success: true, message: "Senha alterada." };
}
