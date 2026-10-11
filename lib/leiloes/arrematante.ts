import "server-only";
import { prisma } from "@/lib/prisma";
import { telefoneDoCadastro, variantesTelefone } from "@/lib/leiloes/telefone";

/**
 * Acha o cliente do arrematante pelo WhatsApp ou cria um novo. O número é a
 * identidade do leilão: é por ele que o lote aparece na conta do cliente.
 *
 * Ordem da busca:
 *  1. cadastro com o número, em qualquer grafia (com/sem 55, com/sem o 9);
 *  2. conta que VERIFICOU o número (TelefoneVerificado) → o cliente dela. Cobre
 *     cadastro com o telefone digitado errado ou faltando, que no leilão de
 *     09/10 deixou um arrematante sem ser achado pelo número;
 *  3. cliente novo, só com nome e número.
 */
export async function acharOuCriarArrematante(
  nome: string,
  telefone: string | null,
): Promise<string> {
  if (telefone) {
    const existente = await prisma.cliente.findFirst({
      where: { telefone: { in: variantesTelefone(telefone) } },
      orderBy: { criadoEm: "asc" },
      select: { id: true },
    });
    if (existente) return existente.id;

    const verificado = await prisma.telefoneVerificado.findUnique({
      where: { telefone },
      select: { user: { select: { cliente: { select: { id: true } } } } },
    });
    if (verificado?.user.cliente) return verificado.user.cliente.id;
  }
  const novo = await prisma.cliente.create({
    data: {
      nome,
      telefone: telefone ? telefoneDoCadastro(telefone) : null,
    },
    select: { id: true },
  });
  return novo.id;
}
