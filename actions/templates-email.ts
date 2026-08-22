"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import { templateEmailSchema } from "@/lib/validations/template-email";
import { templateDef } from "@/lib/emails/catalogo";
import { carregarTemplate, corpoParaHtml, aplicarVariaveisTexto } from "@/lib/emails/render";
import { botao, destaque, layoutEmail, listaItens, moeda, h1 } from "@/lib/emails/layout";
import { contaAtiva, enviarComConta } from "@/lib/email";
import type { ActionResult } from "@/lib/utils/action-result";

/**
 * Textos dos e-mails automáticos.
 *
 * O banco guarda só o que foi editado; sem linha, vale o padrão do catálogo. Por
 * isso "voltar ao texto padrão" é apagar a linha, não copiar o padrão para
 * dentro dela — assim uma melhoria futura no padrão chega a quem nunca editou.
 */

/** Exemplo de conteúdo para a prévia — não toca em pedido de verdade. */
function variaveisDeExemplo(chave: string): Record<string, string> {
  const comuns = {
    nome: "Fernando",
    numero: "#2026-0041",
    total: moeda(840),
    itens: listaItens([
      { nome: "Guppy Koi Tuxedo — Trio Linhagem Premium", qtd: 1 },
      { nome: "Guppy Japan Blue Blue Tail — Casal", qtd: 2 },
    ]),
    botao_acompanhar: botao(
      "Acompanhar meu pedido",
      "https://www.guppydelinhagem.com.br/minha-conta/pedidos",
    ),
  };
  if (chave === "pedido-enviado") {
    return {
      ...comuns,
      transportadora: "pela Jadlog",
      rastreio: "AA123456789BR",
      caixa_rastreio: destaque("Código de rastreio", "AA123456789BR"),
      botao_rastrear: botao(
        "Rastrear entrega",
        "https://www.melhorrastreio.com.br/rastreio/AA123456789BR",
      ),
    };
  }
  return comuns;
}

export async function salvarTemplateEmail(input: unknown): Promise<ActionResult> {
  const membro = await assertPermissao("config.editar");

  const parsed = templateEmailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  const def = templateDef(d.chave);
  if (!def) return { success: false, error: "Mensagem desconhecida." };

  // Variável inventada não quebra o envio (fica visível como {{x}}), mas o dono
  // merece saber na hora que escreveu, não quando o cliente receber.
  const permitidas = new Set(def.variaveis.map((v) => v.nome));
  const usadas = [
    ...`${d.assunto} ${d.titulo} ${d.corpo}`.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi),
  ].map((m) => m[1].toLowerCase());
  const invalidas = [...new Set(usadas.filter((u) => !permitidas.has(u)))];
  if (invalidas.length) {
    return {
      success: false,
      error: `Esta mensagem não conhece ${invalidas.map((i) => `{{${i}}}`).join(", ")}. Use as etiquetas listadas ao lado.`,
    };
  }

  try {
    await prisma.templateEmail.upsert({
      where: { chave: d.chave },
      create: {
        chave: d.chave,
        assunto: d.assunto,
        titulo: d.titulo,
        corpo: d.corpo,
        ativo: d.ativo,
      },
      update: {
        assunto: d.assunto,
        titulo: d.titulo,
        corpo: d.corpo,
        ativo: d.ativo,
      },
    });
  } catch (e) {
    console.error("[template-email] salvar", e);
    return { success: false, error: "Não foi possível salvar o texto." };
  }

  await auditar(membro, {
    acao: "config.email-texto",
    entidade: "TemplateEmail",
    entidadeId: d.chave,
    descricao: `Editou o texto do e-mail "${def.rotulo}"`,
    depois: { assunto: d.assunto, ativo: d.ativo },
  });

  revalidatePath("/admin/configuracoes/mensagens");
  return { success: true, message: "Texto salvo." };
}

export async function restaurarTemplateEmail(
  chave: string,
): Promise<ActionResult> {
  const membro = await assertPermissao("config.editar");
  const def = templateDef(chave);
  if (!def) return { success: false, error: "Mensagem desconhecida." };

  try {
    // Apagar = voltar ao padrão (que vive no código).
    await prisma.templateEmail.deleteMany({ where: { chave } });
  } catch (e) {
    console.error("[template-email] restaurar", e);
    return { success: false, error: "Não foi possível restaurar o texto." };
  }

  await auditar(membro, {
    acao: "config.email-texto-restaurar",
    entidade: "TemplateEmail",
    entidadeId: chave,
    descricao: `Voltou o e-mail "${def.rotulo}" para o texto padrão`,
  });

  revalidatePath("/admin/configuracoes/mensagens");
  return { success: true, message: "Texto padrão restaurado." };
}

/** HTML da prévia, com dados de exemplo. Não envia nada. */
export async function previewTemplateEmail(input: {
  chave: string;
  titulo: string;
  corpo: string;
}): Promise<{ ok: true; html: string } | { ok: false; erro: string }> {
  await assertPermissao("config.editar");
  const def = templateDef(input.chave);
  if (!def) return { ok: false, erro: "Mensagem desconhecida." };

  const vars = variaveisDeExemplo(input.chave);
  const titulo = aplicarVariaveisTexto(input.titulo || def.padrao.titulo, vars);
  return {
    ok: true,
    html: layoutEmail({
      titulo,
      preheader: "",
      conteudo: h1(titulo) + corpoParaHtml(input.corpo || def.padrao.corpo, vars),
    }),
  };
}

/** Manda a mensagem (com dados de exemplo) para um endereço, do jeito que está salva. */
export async function enviarTesteTemplate(
  chave: string,
  para: string,
): Promise<{ ok: boolean; mensagem: string }> {
  await assertPermissao("config.editar");

  const def = templateDef(chave);
  if (!def) return { ok: false, mensagem: "Mensagem desconhecida." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para.trim())) {
    return { ok: false, mensagem: "Informe um e-mail válido." };
  }

  const conta = await contaAtiva();
  if (!conta) {
    return {
      ok: false,
      mensagem: "Nenhuma conta de e-mail ativa. Configure em Configurações → E-mail.",
    };
  }

  const t = await carregarTemplate(chave);
  if (!t) return { ok: false, mensagem: "Mensagem desconhecida." };

  const vars = variaveisDeExemplo(chave);
  const titulo = aplicarVariaveisTexto(t.titulo, vars);
  const r = await enviarComConta(conta, {
    para: para.trim(),
    assunto: `[TESTE] ${aplicarVariaveisTexto(t.assunto, vars)}`,
    html: layoutEmail({
      titulo,
      preheader: "Teste de mensagem do painel",
      conteudo: h1(titulo) + corpoParaHtml(t.corpo, vars),
    }),
  });

  return r.ok
    ? { ok: true, mensagem: `Enviado para ${para.trim()} com dados de exemplo.` }
    : { ok: false, mensagem: r.erro };
}
