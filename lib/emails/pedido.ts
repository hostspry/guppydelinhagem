import "server-only";
import { prisma } from "@/lib/prisma";
import { enviarEmail } from "@/lib/email";
import { buildTrackingUrl, transportadoraLabel } from "@/lib/tracking";
import type { Transportadora } from "@/lib/generated/prisma/enums";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import {
  botao,
  destaque,
  esc,
  h1,
  layoutEmail,
  listaItens,
  moeda,
  p,
} from "./layout";

/**
 * E-mails do ciclo do pedido para o CLIENTE.
 *
 * Complemento das notificações do Telegram (aquelas avisam a loja; estas avisam
 * quem comprou). Nada aqui pode derrubar o fluxo: sem conta de e-mail cadastrada
 * ou sem e-mail no cliente, a função simplesmente não faz nada e devolve false.
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

  const oi = esc(primeiroNome(d.nome));
  const conteudo = d.ehCobranca
    ? h1("Pagamento confirmado") +
      p(`Oi ${oi}, recebi seu pagamento de <strong>${moeda(d.total)}</strong>. Obrigado!`) +
      p(`Qualquer coisa, é só responder este e-mail.`)
    : h1("Pagamento confirmado!") +
      p(`Oi ${oi}, seu pagamento entrou e o pedido <strong>${esc(d.numero)}</strong> já está na fila de separação.`) +
      listaItens(d.itens) +
      p(`Total: <strong>${moeda(d.total)}</strong>`) +
      (d.tipoEntrega === "RETIRADA"
        ? p(
            `Como você escolheu retirar pessoalmente, é só combinar o horário comigo pelo WhatsApp.`,
          )
        : p(
            `Assim que eu despachar, te mando o código de rastreio por aqui. Peixe vivo eu separo com calma e embalo com oxigênio no mesmo dia do envio.`,
          )) +
      botao("Acompanhar meu pedido", `${SITE}/minha-conta/pedidos`);

  return enviarEmail({
    para: d.email,
    assunto: d.ehCobranca
      ? "Pagamento confirmado — Guppy de Linhagem"
      : `Pagamento confirmado — pedido ${d.numero}`,
    html: layoutEmail({
      titulo: "Pagamento confirmado",
      preheader: d.ehCobranca
        ? `Recebi seu pagamento de ${moeda(d.total)}.`
        : `Pedido ${d.numero} pago. Já vou separar.`,
      conteudo,
    }),
  });
}

/** Pedido despachado, com o código de rastreio quando existe. */
export async function emailPedidoEnviado(orderId: string): Promise<boolean> {
  const d = await carregar(orderId);
  if (!d?.email || d.ehCobranca) return false;

  const codigo = d.selfTracking || d.codigoRastreio;
  const url = buildTrackingUrl(d.selfTracking, d.codigoRastreio);
  const transp = d.transportadora ? transportadoraLabel(d.transportadora) : null;

  const conteudo =
    h1("Seu pedido saiu para entrega") +
    p(`Oi ${esc(primeiroNome(d.nome))}, o pedido <strong>${esc(d.numero)}</strong> foi despachado${transp ? ` pela ${esc(transp)}` : ""}.`) +
    (codigo ? destaque("Código de rastreio", codigo) : "") +
    (url ? botao("Rastrear entrega", url) : "") +
    p(
      `Peixe viaja embalado com oxigênio. Quando chegar, deixe o saquinho fechado boiando no aquário por uns 20 minutos antes de abrir, para a temperatura igualar.`,
    ) +
    p(`Qualquer coisa no caminho, me chama no WhatsApp.`);

  return enviarEmail({
    para: d.email,
    assunto: `Pedido ${d.numero} enviado${codigo ? ` — rastreio ${codigo}` : ""}`,
    html: layoutEmail({
      titulo: "Pedido enviado",
      preheader: codigo
        ? `Código de rastreio: ${codigo}`
        : `Pedido ${d.numero} despachado.`,
      conteudo,
    }),
  });
}
