import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { chamarMl, credenciais } from "./cliente";
import { transicionarParaPago } from "@/lib/pedido-baixa";
import { notificarPedidoPago } from "@/lib/notificacoes";

/**
 * Importa os pedidos do Mercado Livre para o painel.
 *
 * O pedido entra como venda de verdade: baixa estoque, lança no caixa e dispara
 * as notificações — a mesma rotina do pedido do site (`transicionarParaPago`).
 * Não é cópia de regra, é reuso: se a baixa mudar um dia, muda para os dois.
 *
 * Idempotente pela unique (origem, origemPedidoId): o aviso do webhook e a
 * varredura do cron podem ver o mesmo pedido ao mesmo tempo, e o segundo a
 * chegar não cria nada.
 */

/** Status do ML em que a venda é firme. */
const STATUS_VENDIDO = new Set(["paid"]);
/** Status em que o pedido morreu e, se já existia aqui, precisa ser cancelado. */
const STATUS_MORTO = new Set(["cancelled", "invalid"]);

const JANELA_MAX_DIAS = 15;

export type ResumoImportacaoMl = {
  novos: number;
  atualizados: number;
  ignorados: number;
  erros: string[];
};

type ItemMl = {
  item?: { id?: string; title?: string; variation_id?: number | string | null };
  quantity?: number;
  unit_price?: number;
};

type PedidoMl = {
  id?: number | string;
  status?: string;
  date_created?: string;
  total_amount?: number;
  paid_amount?: number;
  order_items?: ItemMl[];
  buyer?: {
    nickname?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: { area_code?: string; number?: string };
  };
  payments?: { shipping_cost?: number; status?: string }[];
  shipping?: { id?: number | string };
};

type Endereco = {
  nome: string;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const dinheiro = (v: number | undefined) => Math.max(0, Number(v ?? 0));

/**
 * Endereço de entrega: vem do ENVIO, não do pedido.
 *
 * Pode não existir (categoria de frete combinado, como a de peixe vivo) e pode
 * vir mascarado — o ML esconde dado do comprador por privacidade. Em qualquer
 * um dos casos o pedido precisa entrar assim mesmo: venda registrada com
 * endereço incompleto é melhor do que venda que não entrou.
 */
async function lerEnderecoDoEnvio(
  shippingId: string | null,
  p: PedidoMl,
): Promise<Endereco> {
  const nomeComprador =
    [p.buyer?.first_name, p.buyer?.last_name].filter(Boolean).join(" ").trim() ||
    p.buyer?.nickname ||
    "Comprador do Mercado Livre";
  const telefoneComprador =
    digitos(`${p.buyer?.phone?.area_code ?? ""}${p.buyer?.phone?.number ?? ""}`) ||
    null;

  if (!shippingId) {
    return {
      nome: nomeComprador,
      telefone: telefoneComprador,
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
    };
  }

  const r = await chamarMl<{
    receiver_address?: {
      receiver_name?: string;
      receiver_phone?: string;
      zip_code?: string;
      street_name?: string;
      street_number?: string;
      comment?: string;
      neighborhood?: { name?: string };
      city?: { name?: string };
      state?: { id?: string; name?: string };
    };
  }>(`/shipments/${shippingId}`);

  const e = r.ok ? (r.dados?.receiver_address ?? {}) : {};
  // state.id vem como "BR-ES"; queremos a sigla.
  const uf = (e.state?.id ?? "").split("-").pop() || e.state?.name || null;

  return {
    nome: e.receiver_name?.trim() || nomeComprador,
    telefone: digitos(e.receiver_phone) || telefoneComprador,
    cep: digitos(e.zip_code) || null,
    logradouro: e.street_name?.trim() || null,
    numero: e.street_number?.trim() || null,
    complemento: e.comment?.trim() || null,
    bairro: e.neighborhood?.name?.trim() || null,
    cidade: e.city?.name?.trim() || null,
    uf: uf ? uf.toUpperCase().slice(0, 2) : null,
  };
}

/** Acha o cliente pelo telefone; sem telefone, cria um novo. */
async function acharCliente(
  tx: Prisma.TransactionClient,
  endereco: Endereco,
  apelido: string,
  email: string | null,
): Promise<string> {
  if (endereco.telefone) {
    const existente = await tx.cliente.findFirst({
      where: { telefone: endereco.telefone },
      select: { id: true },
      orderBy: { criadoEm: "asc" },
    });
    if (existente) return existente.id;
  }

  const novo = await tx.cliente.create({
    data: {
      nome: endereco.nome,
      telefone: endereco.telefone,
      email,
      cep: endereco.cep,
      logradouro: endereco.logradouro,
      numero: endereco.numero,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      uf: endereco.uf,
      observacoes: `Comprou pelo Mercado Livre (${apelido || "sem apelido"}).`,
      // Sem opt-in: quem comprou no marketplace não entrou na nossa lista.
      aceitaEmails: false,
    },
    select: { id: true },
  });
  return novo.id;
}

/** Grava o pedido. Idempotente pela unique (origem, origemPedidoId). */
async function gravarPedido(
  p: PedidoMl,
  resumo: ResumoImportacaoMl,
): Promise<void> {
  const orderId = String(p.id ?? "");
  if (!orderId) return;

  const status = (p.status ?? "").toLowerCase();
  const vendido = STATUS_VENDIDO.has(status);
  const morto = STATUS_MORTO.has(status);
  if (!vendido && !morto) {
    resumo.ignorados++; // ainda em pagamento: não é venda firme
    return;
  }

  const existente = await prisma.order.findFirst({
    where: { origem: "MERCADO_LIVRE", origemPedidoId: orderId },
    select: { id: true, status: true },
  });

  // Cancelado lá depois de importado: cancela aqui e devolve o estoque.
  if (morto) {
    if (!existente || existente.status === "CANCELADO") {
      resumo.ignorados++;
      return;
    }
    // Mora em lib/shopee por ter nascido lá, mas a rotina é de marketplace em
    // geral: devolve o estoque e cancela, sem nada específico da Shopee.
    const { cancelarPedidoImportado } = await import("@/lib/shopee/cancelar");
    await cancelarPedidoImportado(existente.id);
    resumo.atualizados++;
    return;
  }

  if (existente) {
    resumo.ignorados++;
    return;
  }

  const itens = p.order_items ?? [];
  if (itens.length === 0) {
    resumo.erros.push(`${orderId}: pedido sem itens.`);
    return;
  }

  const shippingId = p.shipping?.id != null ? String(p.shipping.id) : null;
  const endereco = await lerEnderecoDoEnvio(shippingId, p);
  const frete = dinheiro(
    (p.payments ?? []).reduce((s, x) => s + Number(x.shipping_cost ?? 0), 0),
  );
  const total = dinheiro(p.total_amount);

  // Casa cada item pelo anúncio ligado no painel. Sem ligação, o item entra como
  // avulso: o pedido continua certo no caixa, só não baixa estoque.
  const anuncios = await prisma.mercadoLivreAnuncio.findMany({
    where: {
      itemId: { in: itens.map((i) => String(i.item?.id ?? "")).filter(Boolean) },
    },
    select: {
      itemId: true,
      variationId: true,
      productId: true,
      product: {
        select: {
          tipo: true,
          variantes: {
            where: { ativo: true },
            select: { composicao: true, qtdMachos: true, qtdFemeas: true, padrao: true },
          },
        },
      },
    },
  });

  const acharAnuncio = (itemId: string, variationId: string | null) =>
    anuncios.find((a) => a.itemId === itemId && a.variationId === variationId) ??
    anuncios.find((a) => a.itemId === itemId && a.variationId === null) ??
    null;

  const itensData = itens.map((i) => {
    const itemId = String(i.item?.id ?? "");
    const variationId =
      i.item?.variation_id != null ? String(i.item.variation_id) : null;
    const anuncio = acharAnuncio(itemId, variationId);
    const qtd = Math.max(1, Number(i.quantity ?? 1));

    // Peixe precisa da RECEITA (machos/fêmeas) para baixar o pool. Sem ela, a
    // baixa não acontece e o estoque do site ficaria maior que a prateleira.
    // O anúncio é criado a partir de uma composição, então usamos a padrão do
    // produto quando não há como distinguir.
    const variante =
      anuncio?.product.tipo === "PEIXE"
        ? (anuncio.product.variantes.find((v) => v.padrao) ??
           anuncio.product.variantes[0] ??
           null)
        : null;

    return {
      productId: anuncio?.productId ?? null,
      nomeProduto: (i.item?.title ?? "Item do Mercado Livre").slice(0, 160),
      precoUnitario: dinheiro(i.unit_price),
      quantidade: qtd,
      composicao: variante?.composicao ?? null,
      qtdMachos: variante?.qtdMachos ?? null,
      qtdFemeas: variante?.qtdFemeas ?? null,
    };
  });

  const subtotal = itensData.reduce(
    (s, i) => s + i.precoUnitario * i.quantidade,
    0,
  );

  let criadoId: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const clienteId = await acharCliente(
        tx,
        endereco,
        p.buyer?.nickname ?? "",
        p.buyer?.email ?? null,
      );

      const ano = new Date().getFullYear();
      const ultimo = await tx.order.findFirst({
        where: { ano },
        orderBy: { sequencia: "desc" },
        select: { sequencia: true },
      });
      const sequencia = (ultimo?.sequencia ?? 0) + 1;

      const criado = await tx.order.create({
        data: {
          numero: `#${ano}-${String(sequencia).padStart(4, "0")}`,
          ano,
          sequencia,
          clienteId,
          origem: "MERCADO_LIVRE",
          origemPedidoId: orderId,
          // Nasce aguardando e vira PAGO logo abaixo: é esse caminho que baixa
          // estoque, conta cupom e lança a venda no caixa.
          status: "AGUARDANDO_PAGAMENTO",
          formaPagamento: "OUTRO",
          transportadora: "OUTRO",
          observacoes: `Pedido do Mercado Livre ${orderId}.${
            shippingId ? ` Envio ${shippingId} (etiqueta no painel do ML).` : " Frete combinado com o comprador."
          }`,
          enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
          subtotal,
          frete,
          desconto: 0,
          total: total || subtotal + frete,
          criadoEm: p.date_created ? new Date(p.date_created) : undefined,
          items: { create: itensData },
        },
        select: { id: true },
      });
      criadoId = criado.id;

      // Mesma função do site e da Shopee: quando o ML conta do pedido, o
      // dinheiro já entrou lá — a venda é firme desde o primeiro instante.
      await transicionarParaPago(tx, criado.id);
    });
    resumo.novos++;
  } catch (e) {
    // Corrida com o webhook: os dois viram o mesmo pedido e o segundo bate na
    // unique. Não é erro — é a trava funcionando.
    if (
      e instanceof Error &&
      /unique|duplicate/i.test(e.message) &&
      /origemPedidoId|origem/i.test(e.message)
    ) {
      resumo.ignorados++;
      return;
    }
    console.error(`[ml] gravar pedido ${orderId}`, e);
    resumo.erros.push(`${orderId}: não consegui gravar.`);
    return;
  }

  // Fora da transação: avisar no Telegram e mandar o e-mail não pode segurar a
  // gravação da venda, e helper de notificação nunca lança.
  if (criadoId) {
    await notificarPedidoPago(criadoId, { metodo: null, provider: null });
  }
}

/** Importa um pedido específico. É o que o webhook chama. */
export async function importarPedidoMl(
  orderId: string,
): Promise<ResumoImportacaoMl> {
  const resumo: ResumoImportacaoMl = { novos: 0, atualizados: 0, ignorados: 0, erros: [] };
  const r = await chamarMl<PedidoMl>(`/orders/${orderId}`);
  if (!r.ok) {
    resumo.erros.push(r.erro);
    return resumo;
  }
  await gravarPedido(r.dados, resumo);
  return resumo;
}

/**
 * Varre a janela desde a última importação que deu certo.
 *
 * Existe mesmo com webhook: aviso se perde (deploy no ar, ML instável, erro
 * nosso), e venda que não entra é estoque errado nos dois lados. Sobrepõe uma
 * hora de propósito — pedido repetido é impossível (a unique segura) e pedido
 * perdido é caro.
 */
export async function importarPedidosMl(): Promise<ResumoImportacaoMl> {
  const resumo: ResumoImportacaoMl = { novos: 0, atualizados: 0, ignorados: 0, erros: [] };

  const cfg = await prisma.integracaoMercadoLivre.findUnique({
    where: { id: "default" },
    select: { ativo: true, ultimaSincronizacaoEm: true },
  });
  if (!cfg?.ativo) return resumo;

  const c = await credenciais();
  if (!c?.sellerId) return resumo;

  const ate = new Date();
  const limite = new Date(ate.getTime() - JANELA_MAX_DIAS * 24 * 60 * 60 * 1000);
  const desde = cfg.ultimaSincronizacaoEm
    ? new Date(cfg.ultimaSincronizacaoEm.getTime() - 60 * 60 * 1000)
    : limite;
  const de = desde < limite ? limite : desde;

  // Paginado: 50 por página, no máximo 10 páginas por rodada (o cron roda de
  // novo em minutos; varrer sem teto travaria a chamada em conta movimentada).
  for (let pagina = 0; pagina < 10; pagina++) {
    const q = new URLSearchParams({
      seller: c.sellerId,
      "order.date_created.from": de.toISOString(),
      "order.date_created.to": ate.toISOString(),
      sort: "date_asc",
      limit: "50",
      offset: String(pagina * 50),
    });
    const r = await chamarMl<{ results?: PedidoMl[]; paging?: { total?: number } }>(
      `/orders/search?${q.toString()}`,
    );
    if (!r.ok) {
      resumo.erros.push(r.erro);
      break;
    }
    const lote = r.dados?.results ?? [];
    for (const p of lote) await gravarPedido(p, resumo);
    if (lote.length < 50) break;
  }

  // Só anda o marcador quando não houve erro: com erro, a próxima rodada relê a
  // mesma janela em vez de pular por cima do que falhou.
  if (resumo.erros.length === 0) {
    await prisma.integracaoMercadoLivre.update({
      where: { id: "default" },
      data: { ultimaSincronizacaoEm: ate, ultimoErro: null },
    });
  }
  return resumo;
}
