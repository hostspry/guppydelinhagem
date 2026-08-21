"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import { criptografar } from "@/lib/cripto";
import {
  contaEmailSchema,
  emailTesteSchema,
} from "@/lib/validations/email";
import {
  contaAtiva,
  enviarComConta,
  verificarConta,
  type ContaSmtp,
} from "@/lib/email";
import { descriptografar } from "@/lib/cripto";
import type { ActionResult } from "@/lib/utils/action-result";

const ID = "default";

/**
 * Salva a conta de e-mail que o site usa para enviar.
 *
 * A senha nunca volta para a tela: chega aqui, é cifrada e some. Campo de senha
 * vazio numa conta que já existe = "mantém a que está lá" — é como o dono ajusta
 * porta ou remetente sem redigitar a senha.
 */
export async function salvarContaEmail(input: unknown): Promise<ActionResult> {
  const membro = await assertPermissao("config.editar");

  const parsed = contaEmailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  const atual = await prisma.configuracaoEmail.findUnique({
    where: { id: ID },
    select: { senhaCriptografada: true },
  });

  const senhaNova = (d.senha ?? "").trim();
  if (!senhaNova && !atual) {
    return {
      success: false,
      error: "Informe a senha da caixa de e-mail.",
      fieldErrors: { senha: ["Informe a senha da caixa de e-mail."] },
    };
  }

  let senhaCriptografada: string;
  try {
    senhaCriptografada = senhaNova
      ? criptografar(senhaNova)
      : (atual as { senhaCriptografada: string }).senhaCriptografada;
  } catch (e) {
    console.error("[email] criptografar senha", e);
    return {
      success: false,
      error:
        "Não foi possível guardar a senha com segurança (AUTH_SECRET ausente no servidor).",
    };
  }

  const dados = {
    ativo: d.ativo,
    host: d.host,
    porta: d.porta,
    seguranca: d.seguranca,
    usuario: d.usuario,
    senhaCriptografada,
    remetenteNome: d.remetenteNome,
    remetenteEmail: d.remetenteEmail,
    responderPara: d.responderPara,
  };

  try {
    await prisma.configuracaoEmail.upsert({
      where: { id: ID },
      create: { id: ID, ...dados },
      update: dados,
    });
  } catch (e) {
    console.error("[email] salvar conta", e);
    return { success: false, error: "Não foi possível salvar a conta." };
  }

  await auditar(membro, {
    acao: "config.email-salvar",
    entidade: "ConfiguracaoEmail",
    entidadeId: ID,
    descricao: `Salvou a conta de e-mail ${d.usuario} (${d.host}:${d.porta})`,
    // Sem senha, nem cifrada: auditoria é histórico, não cofre.
    depois: {
      ativo: d.ativo,
      host: d.host,
      porta: d.porta,
      seguranca: d.seguranca,
      remetenteEmail: d.remetenteEmail,
      senhaTrocada: !!senhaNova,
    },
  });

  revalidatePath("/admin/configuracoes/email");
  return { success: true, message: "Conta de e-mail salva." };
}

export type TesteResult = { ok: boolean; mensagem: string };

/**
 * Testa a conta SALVA: primeiro conexão + autenticação, depois um e-mail de
 * verdade para o endereço informado. Guarda o desfecho na própria linha, para a
 * tela mostrar se a conta está funcionando sem precisar testar de novo.
 */
export async function testarContaEmail(input: unknown): Promise<TesteResult> {
  await assertPermissao("config.editar");

  const parsed = emailTesteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, mensagem: "Informe um e-mail válido para o teste." };
  }

  const salva = await prisma.configuracaoEmail.findUnique({ where: { id: ID } });
  if (!salva) {
    return { ok: false, mensagem: "Salve a conta antes de testar." };
  }

  let conta: ContaSmtp;
  try {
    conta = {
      host: salva.host,
      porta: salva.porta,
      seguranca: salva.seguranca,
      usuario: salva.usuario,
      senha: descriptografar(salva.senhaCriptografada),
      remetenteNome: salva.remetenteNome,
      remetenteEmail: salva.remetenteEmail,
      responderPara: salva.responderPara,
    };
  } catch {
    return {
      ok: false,
      mensagem: "A senha guardada não pôde ser lida. Digite a senha de novo e salve.",
    };
  }

  const conexao = await verificarConta(conta);
  if (!conexao.ok) {
    await registrarTeste(false, conexao.erro);
    return { ok: false, mensagem: conexao.erro };
  }

  const envio = await enviarComConta(conta, {
    para: parsed.data.para,
    assunto: "Teste de envio — Guppy de Linhagem",
    html:
      `<p>Deu certo!</p>` +
      `<p>Este e-mail saiu do site pela conta <strong>${escapar(salva.usuario)}</strong>, ` +
      `usando ${escapar(salva.host)} na porta ${salva.porta}.</p>` +
      `<p>Se você está lendo isto, o site já consegue mandar e-mail para os clientes.</p>`,
    texto:
      "Deu certo! Este e-mail saiu do site pela conta cadastrada em Configurações → E-mail.",
  });

  await registrarTeste(envio.ok, envio.ok ? null : envio.erro);
  revalidatePath("/admin/configuracoes/email");

  return envio.ok
    ? {
        ok: true,
        mensagem: `E-mail enviado para ${parsed.data.para}. Confira a caixa de entrada (e o spam).`,
      }
    : { ok: false, mensagem: envio.erro };
}

/** Escapa o que vai para dentro do HTML do e-mail de teste. */
function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function registrarTeste(ok: boolean, erro: string | null): Promise<void> {
  await prisma.configuracaoEmail
    .update({
      where: { id: ID },
      data: {
        ultimoTesteEm: new Date(),
        ultimoTesteOk: ok,
        ultimoTesteErro: erro?.slice(0, 300) ?? null,
      },
    })
    .catch(() => {});
}

/** Só para a tela dizer se o envio está de pé. Nunca devolve a senha. */
export async function statusEmail(): Promise<{ ativo: boolean }> {
  await assertPermissao("config.editar");
  return { ativo: (await contaAtiva()) != null };
}
