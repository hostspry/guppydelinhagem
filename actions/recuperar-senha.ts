"use server";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { enviarEmail } from "@/lib/email";
import { botao } from "@/lib/emails/layout";
import { montarEmail } from "@/lib/emails/render";

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

  // Sem conta: responde igual e não faz nada. Nenhuma pista para quem sonda.
  if (!user) return { ok: true, mensagem: RESPOSTA_PADRAO };

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
    return { ok: false, mensagem: "Não foi possível agora. Tente de novo." };
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

  return { ok: true, mensagem: RESPOSTA_PADRAO };
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
