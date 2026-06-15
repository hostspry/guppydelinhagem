import { prisma } from "../prisma";
import type { Prisma } from "../generated/prisma/client";

/**
 * Lista clientes ordenados por nome. Com `search`, filtra por nome (parcial,
 * case-insensitive) OU telefone (pelos dígitos do termo — o telefone é gravado
 * só com dígitos).
 */
export function listClientes(search?: string) {
  const q = search?.trim();
  let where: Prisma.ClienteWhereInput | undefined;
  if (q) {
    const digitos = q.replace(/\D/g, "");
    const or: Prisma.ClienteWhereInput[] = [
      { nome: { contains: q, mode: "insensitive" } },
    ];
    if (digitos) or.push({ telefone: { contains: digitos } });
    where = { OR: or };
  }
  return prisma.cliente.findMany({ where, orderBy: { nome: "asc" } });
}

/** Busca um cliente para a tela de edição. */
export function getClienteById(id: string) {
  return prisma.cliente.findUnique({ where: { id } });
}
