"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { ActionResult } from "@/lib/utils/action-result";
import { auditar } from "@/lib/auditoria";
import { ehPapelEquipe } from "@/lib/permissoes";

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
  // Cliente também troca a própria senha: a conta criada pela loja na venda
  // direta nasce com senha temporária e precisa virar senha dele no 1º login.
  // Conta só de login social não tem hash — aí não há o que trocar.
  if (!user?.senhaHash) {
    return {
      success: false,
      error: "Esta conta entra pelo Google ou Facebook e não usa senha.",
    };
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

  if (ehPapelEquipe(user.role)) {
    await auditar(
      {
        id: session.user.id,
        nome: session.user.name ?? "—",
        email: session.user.email ?? "—",
        role: user.role,
      },
      {
        acao: "conta.trocar-senha",
        entidade: "User",
        entidadeId: session.user.id,
        descricao: "Trocou a própria senha do painel",
      },
    );
  }

  return { success: true, message: "Senha alterada." };
}
