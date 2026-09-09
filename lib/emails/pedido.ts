import "server-only";
import { prisma } from "@/lib/prisma";
import { enviarEmail } from "@/lib/email";
import {
  buildTrackingUrl,
  codigoRastreavel,
  transportadoraLabel,
} from "@/lib/tracking";
import type { Transportadora } from "@/lib/generated/prisma/enums";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import { botao, destaque, listaItens, moeda } from "./layout";
import { montarEmail } from "./render";

/**
 * E-mails do ciclo do pedido para o CLIENTE.
 *
 * Complemento das notificações do Telegram (aquelas avisam a loja; estas avisam
 * quem comprou). O TEXTO vem do painel (Configurações → Mensagens); aqui ficam
 * só os dados e os blocos visuais que o texto pode encaixar.
 *
 * Nada aqui derruba o fluxo: sem conta de e-mail, sem e-mail no cliente ou com a
 * mensagem desligada no painel, a função devolve false e a vida segue.
 */

const SITE = "https://www.guppydelinhagem.com.br";

type DadosPedido = {
  numero: string;
  nome: string;
  email: string | null;
  total: number;
  ehCobranca: boolean;
  itens: { nome: string; qtd: number }[];
  endereco: Partial<EnderecoEntrega>;
  tipoEntrega: string;
  transportadora: Transportadora | null;
  servicoEnvioNome: string | null;
  codigoRastreio: string | null;
  selfTracking: string | null;
};

async function carregar(orderId: string): Promise<DadosPedido | null> {
  try {
    const o = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        numero: true,
        tipo: true,
        total: true,
        tipoEntrega: true,
        transportadora: true,
        servicoEnvioNome: true,
        codigoRastreio: true,
        selfTracking: true,
        enderecoEntrega: true,
        cliente: { select: { nome: true, email: true } },
        items: { select: { nomeProduto: true, quantidade: true } },
      },
    });
    if (!o) return null;
    const end = (o.enderecoEntrega ?? {}) as Partial<EnderecoEntrega>;
    return {
      numero: o.numero,
      nome: o.cliente.nome,
      // O e-mail do cadastro é a fonte; o snapshot do pedido cobre o caso de o
      // cadastro ter sido esvaziado depois.
      email: o.cliente.email ?? end.email ?? null,
      total: Number(o.total),
      ehCobranca: o.tipo === "COBRANCA",
      itens: o.items.map((i) => ({ nome: i.nomeProduto, qtd: i.quantidade })),
      endereco: end,
      tipoEntrega: o.tipoEntrega,
      transportadora: o.transportadora,
      servicoEnvioNome: o.servicoEnvioNome,
      codigoRastreio: o.codigoRastreio,
      selfTracking: o.selfTracking,
    };
  } catch (e) {
    console.error("[email-pedido] carregar", e);
    return null;
  }
}

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] || n.trim();

/** Pagamento confirmado. Um só por pedido — quem chama já tem a trava. */
export async function emailPedidoPago(orderId: string): Promise<boolean> {
  const d = await carregar(orderId);
  if (!d?.email) return false;

  const chave = d.ehCobranca
    ? "cobranca-paga"
    : d.tipoEntrega === "RETIRADA"
      ? "pedido-pago-retirada"
      : "pedido-pago";

  const email = await montarEmail(
    chave,
    {
      nome: primeiroNome(d.nome),
      numero: d.numero,
      total: moeda(d.total),
      itens: listaItens(d.itens),
      botao_acompanhar: botao("Acompanhar meu pedido", `${SITE}/minha-conta/pedidos`),
    },
    d.ehCobranca
      ? `Recebi seu pagamento de ${moeda(d.total)}.`
      : `Pedido ${d.numero} pago. Já vou separar.`,
  );
  if (!email) return false;

  return enviarEmail({ para: d.email, assunto: email.assunto, html: email.html });
}

/** Pedido despachado, com o código de rastreio quando existe. */
export async function emailPedidoEnviado(orderId: string): Promise<boolean> {
  const d = await carregar(orderId);
  if (!d?.email || d.ehCobranca) return false;

  // O ME…BR na frente, que é o que o Melhor Rastreio entende melhor. A guarda
  // pula o id interno do Melhor Envio, que já foi gravado aqui por engano: sem
  // ela, um reenvio repetiria o código que ninguém consegue rastrear.
  const codigo = [d.selfTracking, d.codigoRastreio].find(codigoRastreavel) ?? null;
  const url = buildTrackingUrl(d.selfTracking, d.codigoRastreio);
  // "pela Jadlog", "pela Loggi Express". Transportadora fora do enum tem o nome
  // real em servicoEnvioNome; sem nenhum dos dois a frase omite o trecho, em vez
  // de dizer "despachado pela transportadora".
  const transp =
    d.transportadora && d.transportadora !== "OUTRO"
      ? transportadoraLabel(d.transportadora)
      : (d.servicoEnvioNome ?? null);

  const email = await montarEmail(
    "pedido-enviado",
    {
      nome: primeiroNome(d.nome),
      numero: d.numero,
      // Sai por extenso na frase; vazio quando não há transportadora definida.
      transportadora: transp ? `pela ${transp}` : "",
      rastreio: codigo ?? "",
      caixa_rastreio: codigo ? destaque("Código de rastreio", codigo) : "",
      botao_rastrear: url ? botao("Rastrear entrega", url) : "",
    },
    codigo ? `Código de rastreio: ${codigo}` : `Pedido ${d.numero} despachado.`,
  );
  if (!email) return false;

  // O código no assunto ajuda quem procura o e-mail depois.
  const assunto = codigo ? `${email.assunto} — rastreio ${codigo}` : email.assunto;
  return enviarEmail({ para: d.email, assunto, html: email.html });
}
