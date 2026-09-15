"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";

/**
 * Configurações da IA: o saldo de créditos que o dono informa.
 *
 * O Google não deixa ler o saldo com a chave da API. Então o dono informa o
 * saldo do AI Studio (ao comprar crédito, por exemplo) e o site desconta o que
 * gastou desde então. É estimativa: o número exato é o do AI Studio.
 */

export type ResultadoIa = { ok: true; mensagem: string } | { ok: false; erro: string };

const valor = (v: string) => Number(String(v).replace(/\./g, "").replace(",", "."));

export async function salvarSaldoIa(dados: {
  saldoUsd: string;
  alertaUsd: string;
}): Promise<ResultadoIa> {
  const membro = await assertPermissao("config.editar");

  const saldo = dados.saldoUsd.trim() === "" ? null : valor(dados.saldoUsd);
  const alerta = dados.alertaUsd.trim() === "" ? null : valor(dados.alertaUsd);
  if (saldo !== null && (!Number.isFinite(saldo) || saldo < 0 || saldo > 5000)) {
    return { ok: false, erro: "Saldo inválido. O AI Studio aceita de US$ 0 a US$ 5.000." };
  }
  if (alerta !== null && (!Number.isFinite(alerta) || alerta < 0)) {
    return { ok: false, erro: "Valor do alerta inválido." };
  }

  const atual = await prisma.configuracaoIa.findUnique({ where: { id: "default" } });
  const mudouSaldo = saldo !== (atual?.saldoUsd != null ? Number(atual.saldoUsd) : null);

  await prisma.configuracaoIa.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      saldoUsd: saldo,
      saldoInformadoEm: saldo !== null ? new Date() : null,
      alertaUsd: alerta,
    },
    update: {
      // Só reinicia a contagem quando o saldo muda: salvar só o alerta não
      // pode zerar o gasto descontado desde a última informação.
      ...(mudouSaldo
        ? { saldoUsd: saldo, saldoInformadoEm: saldo !== null ? new Date() : null, semCreditoEm: null }
        : {}),
      alertaUsd: alerta,
    },
  });

  await auditar(membro, {
    acao: "config.ia.saldo",
    entidade: "ConfiguracaoIa",
    descricao: `Informou o saldo da IA${saldo !== null ? `: US$ ${saldo.toFixed(2)}` : " (limpou)"}`,
    depois: { saldo, alerta },
  });

  revalidatePath("/admin/configuracoes/ia");
  return { ok: true, mensagem: mudouSaldo ? "Saldo salvo. O gasto passa a ser descontado a partir de agora." : "Alerta salvo." };
}
