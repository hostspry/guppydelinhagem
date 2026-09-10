import "server-only";
import { prisma } from "@/lib/prisma";
import {
  notificarFalhaCartao,
  notificarPagamentoRecusado,
} from "@/lib/notificacoes";
import type {
  EtapaCartao,
  ProviderPagamento,
} from "@/lib/generated/prisma/enums";

/**
 * Rastro das tentativas de cartão que NÃO viraram pagamento.
 *
 * Um cliente disse que o cartão foi recusado e pagou no Pix. Ao investigar não
 * havia nada: nenhum pagamento no Mercado Pago, nenhuma linha em Pagamento e
 * nenhum log. A tentativa morreu no navegador, e o site não guardava isso —
 * então não dava para dizer se foi o cartão dele ou defeito nosso.
 *
 * Aqui todo desfecho ruim vira linha no banco e, quando é sinal de problema,
 * aviso no Telegram na hora. NUNCA guarda dado de cartão: só motivo e contexto.
 */

export type FalhaCartao = {
  etapa: EtapaCartao;
  provider?: ProviderPagamento | null;
  /** Motivo técnico (gateway ou navegador). Sem número de cartão, CVV ou token. */
  mensagem: string;
  statusDetail?: string | null;
  valor?: number | null;
  parcelas?: number | null;
  deviceOk?: boolean;
  orderId?: string | null;
  numero?: string | null;
  email?: string | null;
  telefone?: string | null;
  userAgent?: string | null;
};

// Recusa e falha de cobrança são raras e cada uma é uma venda escapando: avisam
// sempre. SDK e formulário podem repetir (cliente digitando errado), então
// avisam no máximo uma vez por janela — o resto fica só no banco.
const AVISA_SEMPRE: EtapaCartao[] = ["RECUSA", "COBRANCA"];
const JANELA_AVISO_MS = 30 * 60 * 1000;

const corta = (s: string | null | undefined, max: number): string | null =>
  s == null || s.trim() === "" ? null : s.trim().slice(0, max);

/**
 * Grava a tentativa e avisa o dono quando for o caso. NUNCA lança: um erro aqui
 * não pode derrubar um checkout que já está dando errado para o cliente.
 */
export async function registrarFalhaCartao(f: FalhaCartao): Promise<void> {
  const mensagem = corta(f.mensagem, 500) ?? "(sem mensagem)";
  try {
    await prisma.tentativaCartao.create({
      data: {
        etapa: f.etapa,
        provider: f.provider ?? null,
        mensagem,
        statusDetail: corta(f.statusDetail, 120),
        valor: f.valor ?? null,
        parcelas: f.parcelas ?? null,
        deviceOk: f.deviceOk ?? false,
        orderId: f.orderId ?? null,
        numero: corta(f.numero, 40),
        email: corta(f.email, 200),
        telefone: corta(f.telefone, 40),
        userAgent: corta(f.userAgent, 300),
      },
    });
  } catch (e) {
    // Banco fora do ar não pode calar o aviso: segue para o Telegram mesmo assim.
    console.error("[tentativa-cartao] gravar", e);
  }

  try {
    if (!AVISA_SEMPRE.includes(f.etapa)) {
      const recente = await prisma.tentativaCartao.count({
        where: {
          etapa: f.etapa,
          criadoEm: { gte: new Date(Date.now() - JANELA_AVISO_MS) },
        },
      });
      // A própria linha recém-gravada conta como 1; a partir da segunda, cala.
      if (recente > 1) return;
    }
    // Havendo pedido, o aviso rico (itens, total, link do WhatsApp) diz muito
    // mais do que o genérico. Ele existia mas nunca disparava numa recusa
    // síncrona: o webhook só notifica na TRANSIÇÃO de status, e a linha de
    // Pagamento já nascia RECUSADA aqui — a transição nunca acontecia.
    if (f.orderId) {
      await notificarPagamentoRecusado(
        f.orderId,
        f.statusDetail ? `${mensagem} (${f.statusDetail})` : mensagem,
      );
      return;
    }
    await notificarFalhaCartao({
      etapa: f.etapa,
      mensagem,
      statusDetail: f.statusDetail ?? null,
      valor: f.valor ?? null,
      numero: f.numero ?? null,
      email: f.email ?? null,
      telefone: f.telefone ?? null,
      deviceOk: f.deviceOk ?? false,
    });
  } catch (e) {
    console.error("[tentativa-cartao] avisar", e);
  }
}
