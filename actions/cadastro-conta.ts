"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { cadastroContaSchema } from "@/lib/validations/cadastro-conta";
import { chaveTelefone } from "@/lib/sorteios/telefone";

export type CadastroContaResult =
  | { ok: true; email: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; jaTemConta?: boolean };

/**
 * Cria a conta do cliente pelo formulário /cadastro.
 *
 * O que fica de propósito SEM poder nenhum até ser provado:
 *  - o e-mail: a conta nasce com `cadastroSiteEm` e sem `emailVerified`, então
 *    não herda pedidos nem cadastros antigos que tenham o mesmo e-mail
 *    (lib/queries/minha-conta.ts → emailConfiavel);
 *  - o telefone: não liga chances de sorteio. Para isso o cliente confirma o
 *    número mandando o código pelo WhatsApp.
 *
 * O cadastro da loja (Cliente) é sempre um registro NOVO, marcado como
 * preenchido pelo próprio cliente. Nunca reaproveita uma ficha existente pelo
 * telefone ou CPF: seria o mesmo buraco do formulário público.
 */
export async function criarConta(input: unknown): Promise<CadastroContaResult> {
  const h = await headers();

  if (
    typeof input === "object" &&
    input !== null &&
    typeof (input as { site?: unknown }).site === "string" &&
    (input as { site: string }).site.length > 0
  ) {
    return { ok: false, error: "Não foi possível criar a conta agora." };
  }

  if (!rateLimit(`cadastro-conta:${clientIp(h)}`, 5, 15 * 60 * 1000).ok) {
    return { ok: false, error: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo." };
  }

  const parsed = cadastroContaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os campos marcados em vermelho.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const d = parsed.data;

  const existente = await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } });
  if (existente) {
    return {
      ok: false,
      jaTemConta: true,
      error: "Já existe uma conta com este e-mail. Entre com ele, ou use \"Esqueci a senha\".",
      fieldErrors: { email: ["Este e-mail já tem conta"] },
    };
  }

  // O WhatsApp vira login: não pode estar em duas contas.
  const chave = chaveTelefone(d.telefone);
  if (chave) {
    const mesmos = await prisma.user.findMany({
      where: { telefone: { endsWith: chave.slice(-8) } },
      select: { telefone: true },
      take: 20,
    });
    if (mesmos.some((u) => u.telefone && chaveTelefone(u.telefone) === chave)) {
      return {
        ok: false,
        jaTemConta: true,
        error: "Este WhatsApp já tem conta. Entre com ele e sua senha, ou fale com a gente no WhatsApp.",
        fieldErrors: { telefone: ["Este WhatsApp já tem conta"] },
      };
    }
  }

  try {
    const senhaHash = await bcrypt.hash(d.senha, 10);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: d.email,
          nome: d.nome,
          name: d.nome,
          telefone: d.telefone,
          senhaHash,
          role: "CUSTOMER",
          cadastroSiteEm: new Date(),
        },
        select: { id: true },
      });
      await tx.cliente.create({
        data: {
          nome: d.nome,
          cpfCnpj: d.cpfCnpj,
          telefone: d.telefone,
          email: d.email,
          cep: d.cep,
          logradouro: d.logradouro,
          numero: d.numero,
          complemento: d.complemento || null,
          bairro: d.bairro,
          cidade: d.cidade,
          uf: d.uf,
          cadastroProprioEm: new Date(),
          userId: user.id,
        },
      });
      await tx.address.create({
        data: {
          userId: user.id,
          cep: d.cep,
          rua: d.logradouro,
          numero: d.numero,
          complemento: d.complemento || null,
          bairro: d.bairro,
          cidade: d.cidade,
          estado: d.uf,
          principal: true,
        },
      });
    });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      return { ok: false, jaTemConta: true, error: "Já existe uma conta com este e-mail." };
    }
    console.error("[cadastro-conta]", e);
    return { ok: false, error: "Não consegui criar sua conta agora. Tente de novo em instantes." };
  }

  return { ok: true, email: d.email };
}
