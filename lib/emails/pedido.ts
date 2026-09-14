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
import { ehCargaViva } from "@/lib/frete-tipos";
import { botao, destaque, listaItens, moeda } from "./layout";
import { montarEmail } from "./render";
import { FUSO } from "@/lib/rastreio/periodo";

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
  /** Tem peixe, planta ou coral na caixa? Decide qual texto o cliente recebe. */
  temBichoVivo: boolean;
  itens: { nome: string; qtd: number }[];
  endereco: Partial<EnderecoEntrega>;
  tipoEntrega: string;
  transportadora: Transportadora | null;
  servicoEnvioNome: string | null;
  codigoRastreio: string | null;
  selfTracking: string | null;
  enviadoEm: Date | null;
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
        enviadoEm: true,
        enderecoEntrega: true,
        cliente: { select: { nome: true, email: true } },
        items: {
          select: {
            nomeProduto: true,
            quantidade: true,
            qtdMachos: true,
            qtdFemeas: true,
            product: { select: { tipo: true } },
          },
        },
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
      // Item avulso (sem produto no catálogo) com receita de peixe conta como
      // vivo; sem receita, como acessório. Mesmo palpite que a etiqueta usa.
      temBichoVivo: o.items.some((i) =>
        i.product?.tipo
          ? ehCargaViva(i.product.tipo)
          : (i.qtdMachos ?? 0) + (i.qtdFemeas ?? 0) > 0,
      ),
      itens: o.items.map((i) => ({ nome: i.nomeProduto, qtd: i.quantidade })),
      endereco: end,
      tipoEntrega: o.tipoEntrega,
      transportadora: o.transportadora,
      servicoEnvioNome: o.servicoEnvioNome,
      codigoRastreio: o.codigoRastreio,
      selfTracking: o.selfTracking,
      enviadoEm: o.enviadoEm,
    };
  } catch (e) {
    console.error("[email-pedido] carregar", e);
    return null;
  }
}

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] || n.trim();

/** Dia do calendário em São Paulo, "AAAA-MM-DD". O servidor roda em UTC. */
const diaSp = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(d);

/**
 * "hoje", "ontem" ou "no dia 12/09". Sem data de envio (status mudado à mão,
 * sem passar pelo registro de envio) conta como agora, que é quando o dono
 * disse que saiu.
 */
function quandoPostou(enviadoEm: Date | null, agora = new Date()): string {
  const quando = enviadoEm ?? agora;
  const dia = diaSp(quando);
  if (dia === diaSp(agora)) return "hoje";
  if (dia === diaSp(new Date(agora.getTime() - 24 * 60 * 60 * 1000))) return "ontem";
  const [, mes, d] = dia.split("-");
  return `no dia ${d}/${mes}`;
}

/** Pagamento confirmado. Um só por pedido — quem chama já tem a trava. */
export async function emailPedidoPago(orderId: string): Promise<boolean> {
  const d = await carregar(orderId);
  if (!d?.email) return false;

  // Retirada primeiro: quem busca em casa não precisa de texto de envio, tendo
  // bicho vivo ou não. Depois separa vivo de seco.
  const chave = d.ehCobranca
    ? "cobranca-paga"
    : d.tipoEntrega === "RETIRADA"
      ? "pedido-pago-retirada"
      : d.temBichoVivo
        ? "pedido-pago"
        : "pedido-pago-seco";

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

/**
 * Encomenda postada, com o código de rastreio quando existe.
 *
 * Sai na postagem de verdade (o cron vê o ME marcar "posted"), no registro
 * manual de envio e quando entra um código de rastreio. NÃO sai na compra da
 * etiqueta: ali a caixa ainda está em casa, e o texto diz que foi postada.
 */
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

  // Criadeira não boia em saquinho: pedido sem bicho vivo recebe o texto seco.
  const email = await montarEmail(
    d.temBichoVivo ? "pedido-enviado" : "pedido-enviado-seco",
    {
      nome: primeiroNome(d.nome),
      numero: d.numero,
      quando_postou: quandoPostou(d.enviadoEm),
      // Sai por extenso na frase; vazio quando não há transportadora definida.
      transportadora: transp ? `pela ${transp}` : "",
      rastreio: codigo ?? "",
      caixa_rastreio: codigo ? destaque("Código de rastreio", codigo) : "",
      botao_rastrear: url ? botao("Rastrear entrega", url) : "",
    },
    codigo ? `Código de rastreio: ${codigo}` : `Pedido ${d.numero} postado.`,
  );
  if (!email) return false;

  // O código no assunto ajuda quem procura o e-mail depois.
  const assunto = codigo ? `${email.assunto} (rastreio ${codigo})` : email.assunto;
  return enviarEmail({ para: d.email, assunto, html: email.html });
}
