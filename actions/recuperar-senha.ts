"use server";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { enviarEmail } from "@/lib/email";
import { botao } from "@/lib/emails/layout";
import { montarEmail } from "@/lib/emails/render";
import { chaveTelefone } from "@/lib/sorteios/telefone";

/**
 * "Esqueci minha senha" do cliente.
 *
 * Duas regras que valem mais que a conveniência:
 *
 * 1. A resposta é SEMPRE a mesma, exista ou não a conta. Uma tela que diz
 *    "e-mail não cadastrado" vira ferramenta para descobrir quem é cliente da
 *    loja.
 * 2. O banco guarda o HASH do token, nunca ele. Assim um vazamento não permite
 *    redefinir a senha de ninguém — quem tem o token é só quem abriu o e-mail.
 */

const VALIDADE_MIN = 60;
const SITE = "https://www.guppydelinhagem.com.br";

const hashDoToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Mesma frase em qualquer caso — não revela se o e-mail existe. */
const RESPOSTA_PADRAO =
  "Se existir uma conta com esse e-mail, o link para criar a nova senha chega em instantes.";

export async function pedirRecuperacaoSenha(
  email: string,
): Promise<{ ok: boolean; mensagem: string }> {
  const alvo = (email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alvo)) {
    return { ok: false, mensagem: "Informe um e-mail válido." };
  }

  // Trava por IP: o endpoint manda e-mail, então serve de arma se ficar aberto.
  const ip = clientIp(await headers());
  if (!rateLimit(`recuperar:${ip}`, 5, 10 * 60_000).ok) {
    return {
      ok: false,
      mensagem: "Muitas tentativas. Espere alguns minutos e tente de novo.",
    };
  }
  // E por e-mail: impede usar o formulário para encher a caixa de alguém.
  if (!rateLimit(`recuperar-email:${alvo}`, 3, 30 * 60_000).ok) {
    return { ok: true, mensagem: RESPOSTA_PADRAO };
  }

  const user = await prisma.user.findUnique({
    where: { email: alvo },
    select: { id: true, nome: true, email: true },
  });

  if (!user) {
    // Cliente da loja sem conta: o acesso nasce aqui, em cima da ficha dele.
    // Roda em segundo plano pelo mesmo motivo do envio lá embaixo: o tempo de
    // resposta não pode entregar quem é cliente.
    void criarAcessoDaFicha(alvo)
      .then((u) => u && enviarLink(u, alvo))
      .catch((e) => console.error("[recuperar-senha] acesso da ficha", e));
    return { ok: true, mensagem: RESPOSTA_PADRAO };
  }

  if (!(await enviarLink(user, alvo))) {
    return { ok: false, mensagem: "Não foi possível agora. Tente de novo." };
  }
  return { ok: true, mensagem: RESPOSTA_PADRAO };
}

/**
 * Conta para a ficha da loja (feita pela equipe) que tem este e-mail e ainda
 * não tem conta. Nasce SEM senha: só entra quem abrir o link do e-mail, o que
 * prova que o e-mail é dele. Por isso não leva `cadastroSiteEm` e herda os
 * pedidos da ficha.
 */
async function criarAcessoDaFicha(email: string) {
  const fichas = await prisma.cliente.findMany({
    where: { userId: null, email: { equals: email, mode: "insensitive" } },
    orderBy: { criadoEm: "desc" },
    select: { id: true, nome: true, telefone: true },
  });
  const ficha = fichas[0];
  if (!ficha) return null;

  // WhatsApp também é login: só vai para a conta se nenhuma outra o usa.
  const chave = ficha.telefone ? chaveTelefone(ficha.telefone) : null;
  let telefone: string | null = null;
  if (chave) {
    const mesmos = await prisma.user.findMany({
      where: { telefone: { endsWith: chave.slice(-8) } },
      select: { telefone: true },
      take: 20,
    });
    if (!mesmos.some((u) => u.telefone && chaveTelefone(u.telefone) === chave)) telefone = ficha.telefone;
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, nome: ficha.nome, name: ficha.nome, telefone, role: "CUSTOMER" },
      select: { id: true, nome: true, email: true },
    });
    await tx.cliente.update({ where: { id: ficha.id }, data: { userId: user.id } });
    return user;
  });
}

/** Grava o token e manda o e-mail com o link. False se nem o token gravou. */
async function enviarLink(
  user: { id: string; nome: string; email: string },
  alvo: string,
): Promise<boolean> {
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + VALIDADE_MIN * 60_000);

  try {
    // Pedido novo invalida os anteriores: só o último link funciona.
    await prisma.tokenSenha.updateMany({
      where: { userId: user.id, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    await prisma.tokenSenha.create({
      data: { tokenHash: hashDoToken(token), userId: user.id, expiraEm },
    });
  } catch (e) {
    console.error("[recuperar-senha] gravar token", e);
    return false;
  }

  const link = `${SITE}/redefinir-senha?token=${token}`;

  // Dispara e NÃO espera. Dois motivos, e o segundo é o que importa:
  //  - a tela não fica 10s parada esperando o servidor de e-mail;
  //  - o TEMPO de resposta deixaria de ser igual nos dois casos. Com conta, a
  //    resposta demoraria o envio; sem conta, voltaria na hora — e aí o relógio
  //    entregaria quem é cliente, mesmo com a frase sendo a mesma.
  void (async () => {
    const msg = await montarEmail(
      "recuperar-senha",
      {
        nome: user.nome.trim().split(/\s+/)[0] || user.nome,
        validade: "1 hora",
        link,
        botao_redefinir: botao("Criar nova senha", link),
      },
      "Link para criar sua nova senha.",
    );
    if (!msg) return;
    const enviou = await enviarEmail({
      para: user.email,
      assunto: msg.assunto,
      html: msg.html,
    });
    if (!enviou) console.error("[recuperar-senha] e-mail não saiu para", alvo);
  })().catch((e) => console.error("[recuperar-senha] envio", e));

  return true;
}

export type ChecagemToken = { valido: boolean; nome?: string };

/** Diz se o link ainda serve — usado ao abrir a tela, antes de pedir a senha. */
export async function verificarTokenSenha(
  token: string,
): Promise<ChecagemToken> {
  const t = (token ?? "").trim();
  if (!t) return { valido: false };
  try {
    const registro = await prisma.tokenSenha.findUnique({
      where: { tokenHash: hashDoToken(t) },
      select: { expiraEm: true, usadoEm: true, user: { select: { nome: true } } },
    });
    if (!registro || registro.usadoEm || registro.expiraEm < new Date()) {
      return { valido: false };
    }
    return { valido: true, nome: registro.user.nome };
  } catch (e) {
    console.error("[recuperar-senha] verificar", e);
    return { valido: false };
  }
}

export async function redefinirSenha(
  token: string,
  senha: string,
  confirmacao: string,
): Promise<{ ok: boolean; mensagem: string }> {
  const t = (token ?? "").trim();
  if (senha.length < 8) {
    return { ok: false, mensagem: "A senha precisa de pelo menos 8 caracteres." };
  }
  // Comparação em tempo constante por hábito: as duas vêm do mesmo formulário,
  // mas não custa manter o padrão em código que lida com credencial.
  const a = Buffer.from(senha);
  const b = Buffer.from(confirmacao ?? "");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, mensagem: "As duas senhas não são iguais." };
  }

  const ip = clientIp(await headers());
  if (!rateLimit(`redefinir:${ip}`, 10, 10 * 60_000).ok) {
    return { ok: false, mensagem: "Muitas tentativas. Espere alguns minutos." };
  }

  try {
    const registro = await prisma.tokenSenha.findUnique({
      where: { tokenHash: hashDoToken(t) },
      select: { id: true, userId: true, expiraEm: true, usadoEm: true },
    });
    if (!registro || registro.usadoEm || registro.expiraEm < new Date()) {
      return {
        ok: false,
        mensagem: "Este link não vale mais. Peça um novo na tela de login.",
      };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: registro.userId },
        data: {
          senhaHash: await bcrypt.hash(senha, 10),
          // A senha agora é dele: nada de continuar mandando trocar no login.
          senhaPrecisaTroca: false,
        },
      }),
      prisma.tokenSenha.update({
        where: { id: registro.id },
        data: { usadoEm: new Date() },
      }),
    ]);
  } catch (e) {
    console.error("[recuperar-senha] redefinir", e);
    return { ok: false, mensagem: "Não foi possível trocar a senha agora." };
  }

  return { ok: true, mensagem: "Senha criada! Agora é só entrar." };
}
