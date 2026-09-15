"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import { sincronizarUnidadesGollog } from "@/lib/gollog/unidades";

export async function atualizarUnidadesGollog(): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  await assertPermissao("config.editar");
  const r = await sincronizarUnidadesGollog();
  if (!r.ok) return r;
  revalidatePath("/admin/configuracoes/gollog");
  const partes = [`${r.total} unidades na Gollog`];
  if (r.novas) partes.push(`${r.novas} nova(s)`);
  if (r.removidas) partes.push(`${r.removidas} fora da lista`);
  return { ok: true, message: `Lista atualizada: ${partes.join(", ")}.` };
}

/** Liga ou desliga uma unidade para os clientes (ex.: Belém, para onde não enviamos). */
export async function alternarUnidadeGollog(
  id: string,
  ativa: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const membro = await assertPermissao("config.editar");
  const u = await prisma.unidadeGollog
    .update({ where: { id }, data: { ativa }, select: { titulo: true } })
    .catch(() => null);
  if (!u) return { ok: false, error: "Unidade não encontrada." };
  await auditar(membro, {
    acao: "config.gollog.unidade",
    entidade: "UnidadeGollog",
    entidadeId: id,
    descricao: `${ativa ? "Ligou" : "Desligou"} a unidade Gollog ${u.titulo}`,
  });
  revalidatePath("/admin/configuracoes/gollog");
  return { ok: true };
}
