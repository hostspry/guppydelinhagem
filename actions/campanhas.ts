"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import { contaAtiva, enviarComConta } from "@/lib/email";
import { layoutEmail, h1 } from "@/lib/emails/layout";
import { corpoParaHtml, aplicarVariaveisTexto } from "@/lib/emails/render";
import {
  destinatarios,
  montarCampanha,
  processarLote,
  variaveisCampanha,
} from "@/lib/campanhas";
import type { ActionResult } from "@/lib/utils/action-result";

/**
 * Campanhas de e-mail.
 *
 * O disparo CONGELA a lista: cria uma linha por destinatário e manda a partir
 * dela. Assim reenviar não duplica, quem entrar depois não recebe campanha
 * velha, e dá para ver exatamente quem recebeu e quem falhou.
 */

const campanhaSchema = z.object({
  nome: z.string().trim().min(2, "Dê um nome para achar depois").max(80),
  assunto: z.string().trim().min(3, "Escreva o assunto").max(200),
  titulo: z.string().trim().min(2, "Escreva o título").max(120),
  corpo: z.string().trim().min(10, "Escreva a mensagem").max(8000),
  publico: z.enum(["TODOS", "COMPRADORES", "SEM_COMPRA", "LEADS"]),
  // "AAAA-MM-DDTHH:mm" do input datetime-local; vazio = envio manual.
  agendadaPara: z.string().trim().optional().or(z.literal("")),
});

/** datetime-local (horário de Brasília) → Date. */
function paraData(v: string | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const [, a, mes, d, h, min] = m;
  // O servidor roda em UTC e o dono pensa em horário de Brasília (-03).
  return new Date(
    Date.UTC(+a, +mes - 1, +d, +h + 3, +min, 0),
  );
}

export async function salvarCampanha(
  id: string | null,
  input: unknown,
): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");

  const parsed = campanhaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;
  const quando = paraData(d.agendadaPara);

  if (quando && quando.getTime() < Date.now() - 60_000) {
    return {
      success: false,
      error: "A data do agendamento já passou. Escolha um horário à frente.",
    };
  }

  let novoId = id ?? "";
  try {
    if (id) {
      const atual = await prisma.campanhaEmail.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!atual) return { success: false, error: "Campanha não encontrada." };
      // Campanha que já saiu (ou está saindo) não se reescreve: o que foi
      // enviado foi enviado, e editar aqui só criaria confusão no histórico.
      if (atual.status === "ENVIADA" || atual.status === "ENVIANDO") {
        return {
          success: false,
          error: "Esta campanha já foi disparada. Crie uma nova para mudar o texto.",
        };
      }
      await prisma.campanhaEmail.update({
        where: { id },
        data: {
          ...d,
          agendadaPara: quando,
          status: quando ? "AGENDADA" : "RASCUNHO",
        },
      });
    } else {
      const nova = await prisma.campanhaEmail.create({
        data: {
          ...d,
          agendadaPara: quando,
          status: quando ? "AGENDADA" : "RASCUNHO",
        },
        select: { id: true },
      });
      novoId = nova.id;
    }
  } catch (e) {
    console.error("[campanha] salvar", e);
    return { success: false, error: "Não foi possível salvar a campanha." };
  }

  await auditar(membro, {
    acao: id ? "campanha.editar" : "campanha.criar",
    entidade: "CampanhaEmail",
    entidadeId: novoId,
    descricao: `${id ? "Editou" : "Criou"} a campanha "${d.nome}"`,
    depois: { publico: d.publico, agendadaPara: d.agendadaPara || null },
  });

  revalidatePath("/admin/campanhas");
  redirect(`/admin/campanhas/${novoId}`);
}

/** Quantas pessoas o público escolhido alcança agora. */
export async function contarPublico(
  publico: "TODOS" | "COMPRADORES" | "SEM_COMPRA" | "LEADS",
): Promise<number> {
  await assertPermissao("catalogo.editar");
  return (await destinatarios(publico)).length;
}

/** Manda a campanha para um endereço só, para conferir antes de disparar. */
export async function enviarTesteCampanha(
  id: string,
  para: string,
): Promise<{ ok: boolean; mensagem: string }> {
  await assertPermissao("catalogo.editar");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para.trim())) {
    return { ok: false, mensagem: "Informe um e-mail válido." };
  }
  const campanha = await prisma.campanhaEmail.findUnique({ where: { id } });
  if (!campanha) return { ok: false, mensagem: "Campanha não encontrada." };

  const conta = await contaAtiva();
  if (!conta) {
    return {
      ok: false,
      mensagem: "Nenhuma conta de e-mail ativa. Configure em Configurações → E-mail.",
    };
  }

  const msg = montarCampanha(campanha, { email: para.trim(), nome: "Teste" });
  const r = await enviarComConta(conta, {
    para: para.trim(),
    assunto: `[TESTE] ${msg.assunto}`,
    html: msg.html,
  });
  return r.ok
    ? { ok: true, mensagem: `Teste enviado para ${para.trim()}.` }
    : { ok: false, mensagem: r.erro };
}

export type DisparoResult = {
  ok: boolean;
  mensagem: string;
  enviados?: number;
  restantes?: number;
};

/**
 * Dispara a campanha: congela a lista e manda o primeiro lote na hora. O resto
 * fica para o cron — assim o painel responde rápido e o servidor de e-mail não
 * leva uma rajada de uma vez.
 */
export async function dispararCampanha(id: string): Promise<DisparoResult> {
  const membro = await assertPermissao("catalogo.editar");

  const campanha = await prisma.campanhaEmail.findUnique({ where: { id } });
  if (!campanha) return { ok: false, mensagem: "Campanha não encontrada." };
  if (campanha.status === "ENVIADA") {
    return { ok: false, mensagem: "Esta campanha já foi enviada." };
  }

  const lista = await destinatarios(campanha.publico);
  if (lista.length === 0) {
    return {
      ok: false,
      mensagem: "Ninguém no público escolhido — nada a enviar.",
    };
  }

  try {
    // skipDuplicates: reenviar uma campanha parada no meio não recria quem já
    // está na fila (o par campanha+e-mail é único).
    await prisma.envioCampanha.createMany({
      data: lista.map((d) => ({ campanhaId: id, email: d.email, nome: d.nome })),
      skipDuplicates: true,
    });
    await prisma.campanhaEmail.update({
      where: { id },
      data: { status: "ENVIANDO", iniciadaEm: campanha.iniciadaEm ?? new Date() },
    });
  } catch (e) {
    console.error("[campanha] disparar", e);
    return { ok: false, mensagem: "Não foi possível preparar o envio." };
  }

  await auditar(membro, {
    acao: "campanha.disparar",
    entidade: "CampanhaEmail",
    entidadeId: id,
    descricao: `Disparou a campanha "${campanha.nome}" para ${lista.length} contato(s)`,
  });

  const r = await processarLote(id);
  revalidatePath("/admin/campanhas");
  revalidatePath(`/admin/campanhas/${id}`);

  return {
    ok: true,
    mensagem:
      r.restantes > 0
        ? `${r.enviados} enviados agora. Os outros ${r.restantes} saem em seguida, sozinhos.`
        : `Campanha enviada para ${r.enviados} contato(s).`,
    enviados: r.enviados,
    restantes: r.restantes,
  };
}

/** Empurra mais um lote sem esperar o cron. */
export async function continuarEnvio(id: string): Promise<DisparoResult> {
  await assertPermissao("catalogo.editar");
  const r = await processarLote(id);
  revalidatePath(`/admin/campanhas/${id}`);
  return {
    ok: true,
    mensagem:
      r.restantes > 0
        ? `${r.enviados} enviados. Faltam ${r.restantes}.`
        : `Pronto: ${r.enviados} enviados, campanha concluída.`,
    enviados: r.enviados,
    restantes: r.restantes,
  };
}

export async function cancelarCampanha(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");
  const c = await prisma.campanhaEmail.findUnique({
    where: { id },
    select: { nome: true, status: true },
  });
  if (!c) return { success: false, error: "Campanha não encontrada." };
  if (c.status === "ENVIADA") {
    return { success: false, error: "Esta campanha já foi enviada." };
  }

  await prisma.campanhaEmail.update({
    where: { id },
    data: { status: "CANCELADA" },
  });
  await auditar(membro, {
    acao: "campanha.cancelar",
    entidade: "CampanhaEmail",
    entidadeId: id,
    descricao: `Cancelou a campanha "${c.nome}"`,
  });
  revalidatePath("/admin/campanhas");
  return { success: true, message: "Campanha cancelada." };
}

export async function excluirCampanha(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");
  const c = await prisma.campanhaEmail.findUnique({
    where: { id },
    select: { nome: true, status: true },
  });
  if (!c) return { success: false, error: "Campanha não encontrada." };
  if (c.status === "ENVIADA" || c.status === "ENVIANDO") {
    return {
      success: false,
      error: "Campanha enviada fica no histórico. Dá para cancelar, não apagar.",
    };
  }
  await prisma.campanhaEmail.delete({ where: { id } });
  await auditar(membro, {
    acao: "campanha.excluir",
    entidade: "CampanhaEmail",
    entidadeId: id,
    descricao: `Apagou a campanha "${c.nome}"`,
  });
  revalidatePath("/admin/campanhas");
  return { success: true, message: "Campanha apagada." };
}

/** Prévia renderizada no servidor, com dados de exemplo. */
export async function previewCampanha(input: {
  titulo: string;
  corpo: string;
}): Promise<string> {
  await assertPermissao("catalogo.editar");
  const vars = variaveisCampanha("Fernando Costa");
  const titulo = aplicarVariaveisTexto(input.titulo, vars);
  return layoutEmail({
    titulo,
    preheader: "",
    conteudo: h1(titulo) + corpoParaHtml(input.corpo, vars),
  });
}
