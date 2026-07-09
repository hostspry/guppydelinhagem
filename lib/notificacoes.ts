import "server-only";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/utils/format";
import { enviarTelegram, escapeHtml } from "@/lib/telegram";
import {
  listPedidosAguardandoEnvio,
  type PedidoEnvio,
} from "@/lib/queries/pedidos";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import type {
  MetodoPagamento,
  ProviderPagamento,
} from "@/lib/generated/prisma/enums";

// Camada de eventos semânticos do ciclo do pedido. Os pontos de disparo (checkout,
// webhooks, actions) chamam estes eventos — não montam texto. Um lugar só para
// mudar as mensagens. Todas as funções retornam Promise<void> e NUNCA lançam
// (o transporte já é seguro; ainda assim envolvemos tudo em try/catch).

const LINK_ADMIN = "https://guppydelinhagem.com.br/admin/pedidos";

// ── Rótulos amigáveis para provider/método ────────────────────────────────────
function rotuloProvider(p?: ProviderPagamento | null): string | null {
  if (p === "MERCADO_PAGO") return "Mercado Pago";
  if (p === "PAGBANK") return "PagBank";
  return null;
}
function rotuloMetodo(m?: MetodoPagamento | null): string | null {
  if (m === "PIX") return "Pix";
  if (m === "CARTAO") return "Cartão";
  if (m === "CARTEIRA") return "Carteira";
  if (m === "BOLETO") return "Boleto";
  return null;
}

// ── Carregamento do pedido (fonte única dos dados das mensagens) ───────────────
type PedidoNotif = {
  numero: string;
  clienteNome: string;
  total: number;
  transportadora: string | null;
  codigoRastreio: string | null;
  endereco: Partial<EnderecoEntrega>;
  itens: { nome: string; qtd: number }[];
};

async function carregar(orderId: string): Promise<PedidoNotif | null> {
  try {
    const o = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        numero: true,
        total: true,
        transportadora: true,
        codigoRastreio: true,
        enderecoEntrega: true,
        cliente: { select: { nome: true } },
        items: { select: { nomeProduto: true, quantidade: true } },
      },
    });
    if (!o) {
      console.warn(`[notificacoes] pedido ${orderId} não encontrado`);
      return null;
    }
    return {
      numero: o.numero,
      clienteNome: o.cliente.nome,
      total: Number(o.total),
      transportadora: o.transportadora,
      codigoRastreio: o.codigoRastreio,
      endereco: (o.enderecoEntrega ?? {}) as Partial<EnderecoEntrega>,
      itens: o.items.map((i) => ({ nome: i.nomeProduto, qtd: i.quantidade })),
    };
  } catch (e) {
    console.error("[notificacoes] carregar pedido", e);
    return null;
  }
}

// ── Helpers de formatação (tudo escapado — nomes vêm do cliente) ──────────────
function linhasItens(itens: { nome: string; qtd: number }[]): string {
  return itens.map((i) => `• ${escapeHtml(i.nome)} (x${i.qtd})`).join("\n");
}

function destino(e: Partial<EnderecoEntrega>): string {
  const partes = [e.cidade, e.uf].filter(Boolean).map((s) => escapeHtml(String(s)));
  return partes.length ? partes.join("/") : "destino não informado";
}

// Telefone → linha com link wa.me (DDI 55). null se não houver telefone.
function linhaWhatsapp(
  telefone: string | null | undefined,
  cta: string,
): string {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (!digitos) return "📱 (sem telefone no pedido)";
  const comDdi = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `📱 ${escapeHtml(String(telefone))} — <a href="https://wa.me/${comDdi}">${cta}</a>`;
}

async function enviarSeguro(construir: () => string): Promise<void> {
  try {
    await enviarTelegram(construir());
  } catch (e) {
    console.error("[notificacoes] falha ao montar/enviar", e);
  }
}

// ── 3.1 Tentativa de compra (🛒 recuperação de venda) ─────────────────────────
export async function notificarTentativaCompra(
  orderId: string,
  metodo: string,
): Promise<void> {
  const p = await carregar(orderId);
  if (!p) return;
  await enviarSeguro(
    () =>
      `🛒 <b>Tentativa de compra</b>\n\n` +
      `<b>${escapeHtml(p.numero)}</b> — ${escapeHtml(p.clienteNome)}\n` +
      `${linhasItens(p.itens)}\n` +
      `Total: <b>${formatBRL(p.total)}</b> · ${escapeHtml(metodo)}\n\n` +
      `${linhaWhatsapp(p.endereco.telefone, "chamar no WhatsApp")}\n` +
      `⏳ Aguardando pagamento. Se não pagar, vale um toque.`,
  );
}

// ── 3.2 Pagamento recusado (❌ recuperação urgente) ───────────────────────────
export async function notificarPagamentoRecusado(
  orderId: string,
  motivo?: string | null,
): Promise<void> {
  const p = await carregar(orderId);
  if (!p) return;
  await enviarSeguro(
    () =>
      `❌ <b>Cartão recusado</b>\n\n` +
      `<b>${escapeHtml(p.numero)}</b> — ${escapeHtml(p.clienteNome)}\n` +
      `Total: <b>${formatBRL(p.total)}</b>\n` +
      (motivo ? `Motivo: ${escapeHtml(motivo)}\n` : "") +
      `\n${linhaWhatsapp(p.endereco.telefone, "chamar AGORA no WhatsApp")}\n` +
      `💡 Sugerir Pix (tem desconto) ou outro cartão.`,
  );
}

// ── 3.3 Pedido pago (💰 venda + separar para envio) ───────────────────────────
export async function notificarPedidoPago(
  orderId: string,
  opts?: { provider?: ProviderPagamento | null; metodo?: MetodoPagamento | null },
): Promise<void> {
  const p = await carregar(orderId);
  if (!p) return;
  const met = rotuloMetodo(opts?.metodo);
  const prov = rotuloProvider(opts?.provider);
  const linhaPag =
    met && prov ? ` · ${met} via ${prov}` : met ? ` · ${met}` : prov ? ` · ${prov}` : "";
  await enviarSeguro(
    () =>
      `💰 <b>PEDIDO PAGO!</b>\n\n` +
      `<b>${escapeHtml(p.numero)}</b> — ${escapeHtml(p.clienteNome)}\n` +
      `${linhasItens(p.itens)}\n` +
      `Total: <b>${formatBRL(p.total)}</b>${linhaPag}\n\n` +
      `📦 <b>Separar para envio:</b> ${destino(p.endereco)}\n` +
      `Ver no admin: ${LINK_ADMIN}`,
  );
}

// ── 3.4 Pedido enviado (🚚) ───────────────────────────────────────────────────
export async function notificarPedidoEnviado(orderId: string): Promise<void> {
  const p = await carregar(orderId);
  if (!p) return;
  const transp = p.transportadora ? escapeHtml(p.transportadora) : "";
  const rastreio = p.codigoRastreio
    ? `${transp ? " " : ""}· Rastreio: <code>${escapeHtml(p.codigoRastreio)}</code>`
    : "";
  const linhaTransp = transp || rastreio ? `\n${transp}${rastreio}` : "";
  await enviarSeguro(
    () =>
      `🚚 <b>Pedido enviado</b>\n\n` +
      `<b>${escapeHtml(p.numero)}</b> — ${escapeHtml(p.clienteNome)} · ${destino(p.endereco)}` +
      linhaTransp,
  );
}

// ── Lote enviado (🚚) — UMA mensagem agregada (evita 10 notificações) ─────────
export async function notificarLoteEnviado(
  pedidos: {
    numero: string;
    cliente: string;
    cidade: string | null;
    uf: string | null;
    rastreio: string | null;
  }[],
): Promise<void> {
  if (pedidos.length === 0) return;
  const linhas = pedidos
    .map((p) => {
      const dest =
        [p.cidade, p.uf].filter(Boolean).map((s) => escapeHtml(String(s))).join("/") ||
        "destino não informado";
      const cod = p.rastreio ? escapeHtml(p.rastreio) : "sem rastreio";
      return `• <b>${escapeHtml(p.numero)}</b> — ${escapeHtml(p.cliente)} · ${dest} · ${cod}`;
    })
    .join("\n");
  await enviarSeguro(
    () => `🚚 <b>Lote enviado (${pedidos.length} pedidos)</b>\n\n${linhas}`,
  );
}

// ── 3.5 Pedido entregue (✅) ──────────────────────────────────────────────────
export async function notificarPedidoEntregue(orderId: string): Promise<void> {
  const p = await carregar(orderId);
  if (!p) return;
  await enviarSeguro(
    () =>
      `✅ <b>Pedido entregue</b>\n\n` +
      `<b>${escapeHtml(p.numero)}</b> — ${escapeHtml(p.clienteNome)}\n` +
      `💬 Bom momento para pedir feedback/foto dos peixes.`,
  );
}

// ── 3.6 Estorno (↩️) ──────────────────────────────────────────────────────────
export async function notificarEstorno(
  orderId: string,
  valor: number,
): Promise<void> {
  const p = await carregar(orderId);
  if (!p) return;
  await enviarSeguro(
    () =>
      `↩️ <b>Estorno realizado</b>\n\n` +
      `<b>${escapeHtml(p.numero)}</b> — ${escapeHtml(p.clienteNome)}\n` +
      `Valor estornado: <b>${formatBRL(valor)}</b>\n` +
      `Estoque revertido.`,
  );
}

// ── 3.7 Pedido cancelado (🚫) ─────────────────────────────────────────────────
export async function notificarPedidoCancelado(orderId: string): Promise<void> {
  const p = await carregar(orderId);
  if (!p) return;
  await enviarSeguro(
    () =>
      `🚫 <b>Pedido cancelado</b>\n\n` +
      `<b>${escapeHtml(p.numero)}</b> — ${escapeHtml(p.clienteNome)} · Total: ${formatBRL(p.total)}`,
  );
}

// ── Resumo semanal de quarentena e envios (agendado via cron) ─────────────────
const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

function dataHojeBR(): string {
  return new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

function peixesDoPedido(p: PedidoEnvio): number {
  return p.itens.reduce((acc, i) => acc + i.qtd, 0);
}

function destinoDoPedido(p: PedidoEnvio): string {
  const partes = [p.cidade, p.uf].filter(Boolean).map((s) => escapeHtml(String(s)));
  return partes.length ? partes.join("/") : "destino não informado";
}

// Linha de pedido para as seções de despacho (com alerta de parado > 7 dias).
function linhaEnvio(p: PedidoEnvio, agora: number): string {
  const atrasado = agora - p.pagoEm.getTime() > UMA_SEMANA_MS ? " ⚠️" : "";
  return (
    `• <b>${escapeHtml(p.numero)}</b> — ${escapeHtml(p.clienteNome)} · ` +
    `${destinoDoPedido(p)} · ${peixesDoPedido(p)} peixes${atrasado}`
  );
}

/**
 * Resumo operacional (quarentena + despacho Jadlog/Gollog) dos pedidos PAGO ainda
 * não enviados. Chamado pela rota de cron. Retorna quantos pedidos entraram —
 * nunca lança. Seções vazias são omitidas.
 */
export async function notificarResumoEnvios(): Promise<{ pedidos: number }> {
  let pedidos: PedidoEnvio[] = [];
  try {
    pedidos = await listPedidosAguardandoEnvio();
  } catch (e) {
    console.error("[notificacoes] resumo: carregar pedidos", e);
  }
  const hoje = dataHojeBR();

  if (pedidos.length === 0) {
    await enviarSeguro(
      () =>
        `📋 <b>Planejamento de envios — ${hoje}</b>\n\n` +
        `✅ Nenhum pedido aguardando envio. Semana limpa!`,
    );
    return { pedidos: 0 };
  }

  const agora = Date.now();

  // Quarentena: soma de quantidade por produto em TODOS os pagos (ordem alfabética).
  const porProduto = new Map<string, number>();
  let totalPeixes = 0;
  for (const p of pedidos) {
    for (const it of p.itens) {
      porProduto.set(it.nome, (porProduto.get(it.nome) ?? 0) + it.qtd);
      totalPeixes += it.qtd;
    }
  }
  const linhasQuarentena = [...porProduto.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([nome, qtd]) => `• ${escapeHtml(nome)} — ${qtd} un`)
    .join("\n");

  // Seções de despacho: só ENVIO (retirada não despacha). Carrier efetivo.
  const enviaveis = pedidos.filter((p) => p.tipoEntrega === "ENVIO");
  const jadlog = enviaveis.filter((p) => p.transporte === "JADLOG");
  const gollog = enviaveis.filter((p) => p.transporte === "GOLLOG");
  const semTransp = enviaveis.filter((p) => p.transporte === null);

  const secoes: string[] = [
    `📋 <b>Planejamento de envios — ${hoje}</b>`,
    `🐟 <b>Separar para quarentena:</b>\n${linhasQuarentena}\n` +
      `Total: ${totalPeixes} peixes em ${pedidos.length} pedido${pedidos.length > 1 ? "s" : ""}`,
  ];
  if (jadlog.length) {
    secoes.push(
      `📦 <b>Jadlog — despacho SEGUNDA-FEIRA:</b>\n` +
        jadlog.map((p) => linhaEnvio(p, agora)).join("\n"),
    );
  }
  if (gollog.length) {
    secoes.push(
      `✈️ <b>Gollog — programar na semana:</b>\n` +
        gollog.map((p) => linhaEnvio(p, agora)).join("\n"),
    );
  }
  if (semTransp.length) {
    secoes.push(
      `❓ <b>Sem transportadora definida (resolver no admin):</b>\n` +
        semTransp
          .map(
            (p) =>
              `• <b>${escapeHtml(p.numero)}</b> — ${escapeHtml(p.clienteNome)} · ${destinoDoPedido(p)}`,
          )
          .join("\n"),
    );
  }
  secoes.push(`Ver pedidos: ${LINK_ADMIN}`);

  await enviarSeguro(() => secoes.join("\n\n"));
  return { pedidos: pedidos.length };
}
