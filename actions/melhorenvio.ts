"use server";

import { revalidatePath } from "next/cache";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import {
  consultarSaldo,
  inserirSaldo,
  type MeSaldo,
  type MeRecarga,
} from "@/lib/melhorenvio";

/**
 * Carteira do Melhor Envio no painel.
 *
 * Ver o saldo é de quem despacha (`pedidos.envio`) — é ele que descobre a
 * carteira vazia no pior momento, com o pedido separado esperando etiqueta.
 * Gerar recarga é dinheiro saindo, então exige `financeiro.gerenciar`.
 */

const CAMINHO = "/admin/configuracoes/entrega";

export type SaldoResult =
  | { ok: true; saldo: MeSaldo }
  | { ok: false; erro: string };

export async function verSaldoMelhorEnvio(): Promise<SaldoResult> {
  await assertPermissao("pedidos.envio");
  const r = await consultarSaldo();
  if (!r.ok) return { ok: false, erro: r.error };
  return { ok: true, saldo: r.data };
}

export type RecargaResult =
  | { ok: true; recarga: MeRecarga }
  | { ok: false; erro: string };

/** Valores de guarda: erro de digitação aqui vira cobrança de verdade. */
const VALOR_MIN = 5;
const VALOR_MAX = 2000;

export async function gerarRecargaMelhorEnvio(dados: {
  valor: number;
  metodo: "pix" | "boleto";
}): Promise<RecargaResult> {
  const membro = await assertPermissao("financeiro.gerenciar");

  const valor = Math.round(Number(dados.valor) * 100) / 100;
  if (!Number.isFinite(valor) || valor < VALOR_MIN) {
    return { ok: false, erro: `O valor mínimo da recarga é R$ ${VALOR_MIN},00.` };
  }
  if (valor > VALOR_MAX) {
    return {
      ok: false,
      erro: `Acima de R$ ${VALOR_MAX},00 é melhor recarregar direto no site do Melhor Envio.`,
    };
  }
  const metodo = dados.metodo === "boleto" ? "boleto" : "pix";

  const r = await inserirSaldo({ valor, metodo });
  if (!r.ok) return { ok: false, erro: r.error };

  // Fica no histórico da equipe: quem mandou gerar, de quanto e por qual meio.
  // A cobrança nasce em aberto; quem confirma o crédito é o Melhor Envio.
  await auditar(membro, {
    acao: "config.melhorenvio.recarga",
    entidade: "MelhorEnvio",
    descricao: `Gerou recarga de R$ ${valor.toFixed(2).replace(".", ",")} no Melhor Envio via ${metodo}`,
    depois: { valor, metodo, protocolo: r.data.protocolo },
  });

  revalidatePath(CAMINHO);
  return { ok: true, recarga: r.data };
}
