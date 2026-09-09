import "server-only";
import { prisma } from "@/lib/prisma";
import { chamarShopee, type ShopeeResult } from "./cliente";
import { transicionarParaPago } from "@/lib/pedido-baixa";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Traz para o painel os pedidos que foram pagos na Shopee.
 *
 * O que a Shopee faz e a gente NÃO refaz: cobrar, emitir etiqueta e falar com o
 * comprador. O pedido entra aqui para três coisas — dar baixa no estoque (senão
 * a mesma criadeira é vendida de novo no site), aparecer no caixa e ficar no
 * histórico junto com o resto.
 *
 * O pedido importado é confirmado na hora, pelo mesmo caminho do webhook do
 * Mercado Pago (transicionarParaPago): quando a Shopee nos conta dele, o
 * dinheiro já entrou lá.
 */

/** Situações da Shopee que valem como venda firme. */
const STATUS_VENDIDO = new Set([
  "READY_TO_SHIP",
  "PROCESSED",
  "SHIPPED",
  "TO_CONFIRM_RECEIVE",
  "COMPLETED",
  "RETRY_SHIP",
]);
/** Situações em que a venda deixou de existir. */
const STATUS_MORTO = new Set(["CANCELLED", "UNPAID", "INVOICE_PENDING"]);

/** Janela máxima que a Shopee aceita numa consulta de pedidos: 15 dias. */
const JANELA_MAX_DIAS = 15;
const PAGINA = 50;

type ItemShopee = {
  item_id?: number;
  model_id?: number;
  item_name?: string;
  item_sku?: string;
  model_quantity_purchased?: number;
  model_discounted_price?: number;
  model_original_price?: number;
};

type PedidoShopee = {
  order_sn?: string;
  order_status?: string;
  create_time?: number;
  total_amount?: number;
  buyer_username?: string;
  estimated_shipping_fee?: number;
  recipient_address?: {
    name?: string;
    phone?: string;
    full_address?: string;
    district?: string;
    city?: string;
    state?: string;
    zipcode?: string;
  };
  item_list?: ItemShopee[];
};

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * A Shopee entrega o endereço quase todo numa string só (`full_address`), e os
 * campos separados que ela manda (bairro, cidade, UF, CEP) são os confiáveis.
 * Então o resto vira logradouro e o número sai dele quando dá.
 *
 * Não force a barra aqui: pedido da Shopee é despachado com a etiqueta DELA, com
 * o endereço que ela imprime. Este snapshot é para conferência e histórico, não
 * para gerar etiqueta — errar a separação aqui não perde caixa nenhuma.
 */
export function lerEnderecoShopee(e: PedidoShopee["recipient_address"]) {
  const bairro = (e?.district ?? "").trim();
  const cidade = (e?.city ?? "").trim();
  const uf = (e?.state ?? "").trim();
  const cep = digitos(e?.zipcode);

  // Quebra por vírgula e joga fora o que já temos em campo próprio. Comparar
  // pedaço a pedaço, e não apagar do texto inteiro, é o que faz "SP" sumir sem
  // levar junto o "SP" que estivesse dentro de um nome de rua.
  const partes = (e?.full_address ?? "")
    .split(/\s*[,;]\s*/)
    .map((t) => t.trim())
    .filter(Boolean);

  const repetido = (parte: string) => {
    const p = achatar(parte);
    if (!p) return true;
    // CEP em qualquer grafia: 13863-048, 13863048, 13.863-048.
    if (cep && digitos(parte) === cep) return true;
    return [bairro, cidade, uf].some((v) => v && achatar(v) === p);
  };

  const restantes = partes.filter((parte) => !repetido(parte));

  // O logradouro é o primeiro pedaço que sobrou.
  let logradouro = restantes[0] ?? "";
  const sobra = restantes.slice(1);
  let numero = "";

  // A Shopee às vezes manda o número como pedaço próprio ("Rua X, 458, ...") e
  // às vezes colado na rua ("Rua X 458"). Os dois formatos chegam de verdade.
  const iNumero = sobra.findIndex((t) => /^\d{1,6}\s*[a-zA-Z]?$/.test(t));
  if (iNumero >= 0) {
    numero = sobra[iNumero].replace(/\s+/g, "").toUpperCase();
    sobra.splice(iNumero, 1);
  } else {
    const m = logradouro.match(/[\s,]+(\d{1,6}\s*[a-zA-Z]?)$/);
    if (m && m.index !== undefined) {
      numero = m[1].replace(/\s+/g, "").toUpperCase();
      logradouro = logradouro.slice(0, m.index).replace(/[\s,-]+$/, "").trim();
    }
  }

  // O que ainda sobrou é complemento ("apto 31", "fundos", referência).
  const complemento = sobra.join(", ") || null;

  return {
    nome: (e?.name ?? "").trim() || "Comprador da Shopee",
    cpfCnpj: null,
    telefone: digitos(e?.phone) || null,
    email: null,
    cep: cep || null,
    logradouro: logradouro || null,
    numero: numero || null,
    complemento,
    bairro: bairro || null,
    cidade: cidade || null,
    uf: uf.slice(0, 2).toUpperCase() || null,
  };
}

/** Minúsculas, sem acento e sem pontuação — só para COMPARAR dois pedaços. */
const achatar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");


/** Centavos? Não: a Shopee do Brasil manda o valor já em reais. */
const dinheiro = (v: number | undefined) => Math.max(0, Number(v ?? 0));

type ListaPedidos = {
  order_list?: { order_sn?: string }[];
  more?: boolean;
  next_cursor?: string;
};

type DetalhePedidos = { order_list?: PedidoShopee[] };

/**
 * Lê os pedidos criados na janela pedida. A Shopee separa em duas chamadas:
 * a lista devolve só os números, e o detalhe traz o conteúdo (até 50 por vez).
 */
async function buscarPedidos(
  de: Date,
  ate: Date,
): Promise<ShopeeResult<PedidoShopee[]>> {
  const numeros: string[] = [];
  let cursor = "";

  // Paginação por cursor. O teto de voltas existe para um `more: true` que nunca
  // vira false não prender o cron: 40 páginas são 2000 pedidos, muito além do
  // que esta loja faz em 15 dias.
  for (let volta = 0; volta < 40; volta++) {
    const r = await chamarShopee<ListaPedidos>("/api/v2/order/get_order_list", {
      query: {
        time_range_field: "create_time",
        time_from: Math.floor(de.getTime() / 1000),
        time_to: Math.floor(ate.getTime() / 1000),
        page_size: PAGINA,
        cursor: cursor || undefined,
        response_optional_fields: "order_status",
      },
    });
    if (!r.ok) return r;

    for (const o of r.dados.order_list ?? []) {
      if (o.order_sn) numeros.push(o.order_sn);
    }
    if (!r.dados.more || !r.dados.next_cursor) break;
    cursor = r.dados.next_cursor;
  }

  if (numeros.length === 0) return { ok: true, dados: [] };

  const detalhados: PedidoShopee[] = [];
  for (let i = 0; i < numeros.length; i += PAGINA) {
    const lote = numeros.slice(i, i + PAGINA);
    const r = await chamarShopee<DetalhePedidos>("/api/v2/order/get_order_detail", {
      query: {
        order_sn_list: lote.join(","),
        response_optional_fields: [
          "recipient_address",
          "item_list",
          "total_amount",
          "buyer_username",
          "estimated_shipping_fee",
        ].join(","),
      },
    });
    if (!r.ok) return r;
    detalhados.push(...(r.dados.order_list ?? []));
  }
  return { ok: true, dados: detalhados };
}

/**
 * Acha (ou cria) o cliente do pedido da Shopee.
 *
 * A Shopee não entrega e-mail nem CPF do comprador — proteção de dados dela. O
 * que sobra para casar é o telefone. Quando nem isso vem, cria um cadastro novo:
 * duplicar cliente é chato, misturar dois clientes é pior.
 */
async function acharCliente(
  tx: Prisma.TransactionClient,
  endereco: ReturnType<typeof lerEnderecoShopee>,
  apelidoShopee: string,
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
      cep: endereco.cep,
      logradouro: endereco.logradouro,
      numero: endereco.numero,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      uf: endereco.uf,
      observacoes: `Comprou pela Shopee (${apelidoShopee || "sem apelido"}).`,
      // Sem opt-in: quem comprou no marketplace não deu e-mail para a nossa
      // lista, e mandar promoção para essa pessoa seria spam.
      aceitaEmails: false,
    },
    select: { id: true },
  });
  return novo.id;
}

export type ResumoImportacao = {
  novos: number;
  atualizados: number;
  ignorados: number;
  erros: string[];
};

/**
 * Grava um pedido da Shopee. Idempotente pela unique (origem, origemPedidoId):
 * webhook e varredura podem chegar juntos, e o segundo só atualiza o status.
 */
async function gravarPedido(
  p: PedidoShopee,
  resumo: ResumoImportacao,
): Promise<void> {
  const orderSn = p.order_sn;
  if (!orderSn) return;

  const status = (p.order_status ?? "").toUpperCase();
  const vendido = STATUS_VENDIDO.has(status);
  const morto = STATUS_MORTO.has(status);
  if (!vendido && !morto) {
    resumo.ignorados++; // ainda em pagamento: não é venda firme
    return;
  }

  const existente = await prisma.order.findFirst({
    where: { origem: "SHOPEE", origemPedidoId: orderSn },
    select: { id: true, status: true, estoqueBaixado: true },
  });

  // Cancelado lá depois de importado: cancela aqui e devolve o estoque. Sem isso
  // o número do site ficaria menor que a prateleira de verdade.
  if (morto) {
    if (!existente || existente.status === "CANCELADO") {
      resumo.ignorados++;
      return;
    }
    const { cancelarPedidoImportado } = await import("./cancelar");
    await cancelarPedidoImportado(existente.id);
    resumo.atualizados++;
    return;
  }

  if (existente) {
    resumo.ignorados++;
    return;
  }

  const endereco = lerEnderecoShopee(p.recipient_address);
  const itens = p.item_list ?? [];
  const frete = dinheiro(p.estimated_shipping_fee);
  const total = dinheiro(p.total_amount);

  // Casa cada item pelo anúncio ligado no painel. Sem ligação, o item entra como
  // avulso: o pedido continua certo no caixa, só não baixa estoque — e o painel
  // mostra o que falta ligar.
  const chaves = itens.map((i) => ({
    itemId: String(i.item_id ?? ""),
    modelId: i.model_id ? String(i.model_id) : null,
  }));
  const anuncios = await prisma.shopeeAnuncio.findMany({
    where: { itemId: { in: chaves.map((c) => c.itemId).filter(Boolean) } },
    select: { itemId: true, modelId: true, productId: true },
  });
  const acharProduto = (itemId: string, modelId: string | null) =>
    anuncios.find((a) => a.itemId === itemId && a.modelId === modelId)?.productId ??
    // Anúncio ligado sem variação serve para qualquer variação dele: é o caso do
    // produto que só tem um modelo e ganhou variação depois.
    anuncios.find((a) => a.itemId === itemId && a.modelId === null)?.productId ??
    null;

  const itensData = itens.map((i) => {
    const itemId = String(i.item_id ?? "");
    const modelId = i.model_id ? String(i.model_id) : null;
    const qtd = Math.max(1, i.model_quantity_purchased ?? 1);
    const preco = dinheiro(i.model_discounted_price ?? i.model_original_price);
    return {
      productId: acharProduto(itemId, modelId),
      nomeProduto: (i.item_name ?? "Item da Shopee").slice(0, 160),
      precoUnitario: preco,
      quantidade: qtd,
      // Sem composição: marketplace não vende peixe (a Shopee proíbe bicho vivo),
      // então nunca há receita de macho/fêmea aqui.
      composicao: null,
      qtdMachos: null,
      qtdFemeas: null,
    };
  });

  const subtotal = itensData.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);

  try {
    await prisma.$transaction(async (tx) => {
      const clienteId = await acharCliente(tx, endereco, p.buyer_username ?? "");

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
          origem: "SHOPEE",
          origemPedidoId: orderSn,
          // Nasce aguardando e vira PAGO logo abaixo, em vez de já nascer PAGO.
          // É esse caminho que baixa estoque, conta cupom e lança a venda no
          // caixa — criar direto como PAGO pularia os três em silêncio.
          status: "AGUARDANDO_PAGAMENTO",
          formaPagamento: "OUTRO",
          transportadora: "OUTRO",
          observacoes: `Pedido da Shopee ${orderSn}. Etiqueta e entrega são pela Shopee.`,
          enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
          subtotal,
          frete,
          desconto: 0,
          total: total || subtotal + frete,
          criadoEm: p.create_time ? new Date(p.create_time * 1000) : undefined,
          items: { create: itensData },
        },
        select: { id: true },
      });

      // Mesma função que o webhook do Mercado Pago usa. Quando a Shopee nos
      // conta do pedido, o dinheiro já entrou lá — então a venda é firme desde
      // o primeiro instante.
      await transicionarParaPago(tx, criado.id);

      // Status de envio da Shopee já despachado: registra aqui também, senão o
      // pedido apareceria como "a despachar" numa caixa que já saiu.
      if (status === "SHIPPED" || status === "TO_CONFIRM_RECEIVE") {
        await tx.order.update({
          where: { id: criado.id },
          data: { status: "ENVIADO", enviadoEm: new Date() },
        });
      } else if (status === "COMPLETED") {
        await tx.order.update({
          where: { id: criado.id },
          data: { status: "ENTREGUE", enviadoEm: new Date() },
        });
      }
    });
    resumo.novos++;
  } catch (e) {
    // Corrida com o webhook: os dois viram o mesmo pedido novo e o segundo bate
    // na unique. Não é erro — é a trava funcionando.
    if (
      e instanceof Error &&
      /unique|duplicate/i.test(e.message) &&
      /origemPedidoId|origem/i.test(e.message)
    ) {
      resumo.ignorados++;
      return;
    }
    console.error(`[shopee] gravar pedido ${orderSn}`, e);
    resumo.erros.push(`${orderSn}: não consegui gravar.`);
  }
}

/**
 * Importa um pedido específico. É o que o webhook chama — a Shopee avisa o
 * número, e a gente vai buscar o conteúdo (o aviso dela não traz os dados).
 */
export async function importarPedidoShopee(
  orderSn: string,
): Promise<ResumoImportacao> {
  const resumo: ResumoImportacao = { novos: 0, atualizados: 0, ignorados: 0, erros: [] };
  const r = await chamarShopee<DetalhePedidos>("/api/v2/order/get_order_detail", {
    query: {
      order_sn_list: orderSn,
      response_optional_fields: [
        "recipient_address",
        "item_list",
        "total_amount",
        "buyer_username",
        "estimated_shipping_fee",
      ].join(","),
    },
  });
  if (!r.ok) {
    resumo.erros.push(r.erro);
    return resumo;
  }
  for (const p of r.dados.order_list ?? []) await gravarPedido(p, resumo);
  return resumo;
}

/**
 * Varre a janela desde a última importação que deu certo.
 *
 * A varredura existe mesmo com webhook: aviso se perde (deploy no ar, Shopee
 * instável, nosso erro), e uma venda que não entra é estoque errado nos dois
 * lados. Sobrepõe uma hora de propósito, porque o mesmo pedido entrando duas
 * vezes é impossível (a unique segura) e um pedido perdido é caro.
 */
export async function importarPedidosShopee(): Promise<ResumoImportacao> {
  const resumo: ResumoImportacao = { novos: 0, atualizados: 0, ignorados: 0, erros: [] };

  const cfg = await prisma.integracaoShopee.findUnique({
    where: { id: "default" },
    select: { ativo: true, ultimaSincronizacaoEm: true },
  });
  if (!cfg?.ativo) return resumo;

  const ate = new Date();
  const limite = new Date(ate.getTime() - JANELA_MAX_DIAS * 24 * 60 * 60 * 1000);
  const desde = cfg.ultimaSincronizacaoEm
    ? new Date(cfg.ultimaSincronizacaoEm.getTime() - 60 * 60 * 1000)
    : limite;
  const de = desde < limite ? limite : desde;

  const r = await buscarPedidos(de, ate);
  if (!r.ok) {
    resumo.erros.push(r.erro);
    return resumo;
  }

  for (const p of r.dados) await gravarPedido(p, resumo);

  // Só anda o marcador quando não houve erro: com erro, a próxima rodada relê a
  // mesma janela em vez de pular por cima do que falhou.
  if (resumo.erros.length === 0) {
    await prisma.integracaoShopee.update({
      where: { id: "default" },
      data: { ultimaSincronizacaoEm: ate, ultimoErro: null },
    });
  }
  return resumo;
}
