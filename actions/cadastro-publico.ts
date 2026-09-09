"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { notificarCadastroCliente } from "@/lib/notificacoes";
import {
  cadastroPublicoSchema,
  type CadastroPublicoInput,
} from "@/lib/validations/cadastro-publico";
import type { Prisma } from "@/lib/generated/prisma/client";

export type CadastroResult =
  | { ok: true; nome: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Cadastro que o próprio cliente preenche, pelo link /meus-dados que mandamos
 * no WhatsApp depois de fechar a venda.
 *
 * Por que existe: ditar rua, número e CEP pela conversa dá erro de digitação, e
 * erro de endereço em caixa com peixe vivo custa a caixa inteira. Quem sabe o
 * endereço é o cliente; a tela dele valida CPF e busca o CEP na hora.
 *
 * Sem login de propósito. Quem acabou de pagar não vai criar conta para dizer
 * onde mora. O que segura abuso é o limite por IP e o campo isca.
 */
export async function enviarCadastroPublico(
  input: unknown,
): Promise<CadastroResult> {
  const h = await headers();

  // Robô preenche todo campo que encontra, inclusive o escondido. Devolvemos
  // sucesso para ele não ficar tentando variações.
  if (
    typeof input === "object" &&
    input !== null &&
    typeof (input as { site?: unknown }).site === "string" &&
    (input as { site: string }).site.length > 0
  ) {
    return { ok: true, nome: "" };
  }

  const limite = rateLimit(`cadastro:${clientIp(h)}`, 5, 10 * 60 * 1000);
  if (!limite.ok) {
    return {
      ok: false,
      error: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
    };
  }

  const parsed = cadastroPublicoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os campos marcados em vermelho.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const d: CadastroPublicoInput = parsed.data;

  // Achar o cadastro que já existe, na mesma ordem de confiança da venda pelo
  // WhatsApp: CPF é único de verdade, e-mail depois, telefone por último.
  const ors: Prisma.ClienteWhereInput[] = [{ cpfCnpj: d.cpfCnpj }];
  if (d.email) ors.push({ email: { equals: d.email, mode: "insensitive" } });
  ors.push({ telefone: d.telefone });

  const dados = {
    nome: d.nome,
    cpfCnpj: d.cpfCnpj,
    telefone: d.telefone,
    email: d.email || null,
    cep: d.cep,
    logradouro: d.logradouro,
    numero: d.numero,
    complemento: d.complemento || null,
    bairro: d.bairro,
    cidade: d.cidade,
    uf: d.uf,
    cadastroProprioEm: new Date(),
  };

  let novo = false;
  try {
    const existente = await prisma.cliente.findFirst({
      where: { OR: ors },
      select: { id: true },
      orderBy: { criadoEm: "asc" },
    });

    if (existente) {
      // Sobrescreve mesmo. Cliente que mudou de casa depende disso — e ele
      // acabou de digitar o endereço, é o dado mais novo que temos.
      await prisma.cliente.update({ where: { id: existente.id }, data: dados });
    } else {
      await prisma.cliente.create({ data: dados });
      novo = true;
    }
  } catch (e) {
    console.error("[cadastro-publico] salvar", e);
    return {
      ok: false,
      error:
        "Não consegui salvar agora. Tente de novo em instantes ou mande os dados pelo WhatsApp.",
    };
  }

  // Aviso é conveniência: se o Telegram cair, o cadastro já está salvo.
  await notificarCadastroCliente({
    nome: d.nome,
    cidade: d.cidade,
    uf: d.uf,
    telefone: d.telefone,
    novo,
  });

  return { ok: true, nome: d.nome.split(/\s+/)[0] };
}
