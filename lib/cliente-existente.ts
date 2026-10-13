import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { variantesTelefone } from "@/lib/leiloes/telefone";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Cadastro que já existe para estes dados, antes de criar outro: CPF, depois
 * e-mail (sem diferenciar maiúscula), depois telefone (com ou sem 55, com ou
 * sem o 9). O mais antigo vence, porque é ele que carrega o histórico.
 *
 * Toda tela que cria cliente passa por aqui. Em 12/10 o Olympio estava no 4º
 * cadastro igual (três cobranças digitadas no admin, cada uma criou um) e o
 * Mercado Pago recebeu "conta criada há 6 minutos" e recusou o cartão.
 */
export async function acharClienteExistente(
  d: { cpf?: string | null; email?: string | null; telefone?: string | null },
  db: Db = prisma,
): Promise<{ id: string; nome: string; userId: string | null } | null> {
  const select = { id: true, nome: true, userId: true } as const;
  const orderBy = { criadoEm: "asc" } as const;

  const cpf = (d.cpf ?? "").replace(/\D/g, "");
  if (cpf) {
    const c = await db.cliente.findFirst({ where: { cpfCnpj: cpf }, orderBy, select });
    if (c) return c;
  }

  const email = (d.email ?? "").trim();
  if (email) {
    const c = await db.cliente.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      orderBy,
      select,
    });
    if (c) return c;
  }

  const tel = (d.telefone ?? "").replace(/\D/g, "");
  if (tel.length >= 10) {
    // O cadastro guarda o Brasil sem o 55; outros canais às vezes gravaram com.
    const chave = tel.length <= 11 ? `55${tel}` : tel;
    const c = await db.cliente.findFirst({
      where: { telefone: { in: variantesTelefone(chave) } },
      orderBy,
      select,
    });
    if (c) return c;
  }

  return null;
}
