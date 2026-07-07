"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkoutSchema,
  checkoutBaseSchema,
  type CheckoutInput,
  type CheckoutFormInput,
} from "@/lib/validations/checkout";
import { calcularPesoECaixa, cotarFrete } from "@/lib/shipping";
import { getPaymentProvider } from "@/lib/payments/registry";
import { mensagemRecusa } from "@/lib/payments/mercadopago";
import { transicionarParaPago } from "@/lib/pedido-baixa";
import {
  notificarTentativaCompra,
  notificarPedidoPago,
} from "@/lib/notificacoes";
import { calcularPrecos } from "@/lib/precos";
import {
  normalizarCodigo,
  cupomVigente,
  calcularDescontoCupom,
  itemElegivel,
  type CupomCalculo,
  type ItemPrecificadoCupom,
} from "@/lib/cupom";
import { resolverCampanhaInfo } from "@/lib/campanha";
import { precoComCampanha, type CampanhaInfo } from "@/lib/campanha-core";
import { getCupomByCodigo } from "@/lib/queries/cupons";
import {
  getConfigPreco,
  getFreteGratisConfig,
  getConfiguracaoLoja,
  getMaxPeixesFreteAuto,
} from "@/lib/queries/config";
import { COMPOSICAO_LABEL } from "@/lib/composicoes";
import { freteGollog, LOJA_ENDERECO } from "@/lib/constants";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import {
  ProviderPagamento,
  MetodoPagamento,
  StatusPagamento,
  FormaPagamento,
  Transportadora,
} from "@/lib/generated/prisma/enums";
import type { Prisma, OrderStatus } from "@/lib/generated/prisma/client";

const TETO_PARCELAS = 12;

// Base do site p/ as back_urls do Checkout Pro (retorno do ambiente do MP).
const SITE_URL = "https://www.guppydelinhagem.com.br";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type CheckoutPixData = {
  numero: string;
  valor: number;
  qrCodeBase64: string | null; // MP: PNG embutido em base64
  qrPngUrl: string | null; // PagBank: link do PNG do QR (renderiza direto)
  copiaECola: string | null;
  ticketUrl: string | null;
  expiraEm: string | null; // ISO
};

export type CheckoutResult =
  | { ok: true; data: CheckoutPixData }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Emite a cobrança Pix no MP e grava a linha Pagamento + amarra o id no pedido.
 * Reusado por criarPedidoCheckout e gerarNovoPix. Lança se o MP falhar (o
 * chamador decide o que fazer com o pedido); falha ao gravar a linha Pagamento é
 * só logada (o Pix já existe no MP, não dá pra perder o QR pro cliente).
 */
async function emitirPix(args: {
  orderId: string;
  numero: string;
  valor: number;
  pagador: {
    nome?: string | null;
    sobrenome?: string | null;
    email: string;
    cpfCnpj?: string | null;
  };
}): Promise<CheckoutPixData> {
  const provider = getPaymentProvider(ProviderPagamento.MERCADO_PAGO);
  const pix = await provider.criarPagamentoPix({
    orderId: args.orderId,
    valor: args.valor,
    descricao: `Pedido ${args.numero} — Guppy de Linhagem`,
    pagador: args.pagador,
  });

  try {
    await prisma.pagamento.create({
      data: {
        orderId: args.orderId,
        provider: ProviderPagamento.MERCADO_PAGO,
        metodo: MetodoPagamento.PIX,
        status:
          pix.status === StatusPagamento.PAGO
            ? StatusPagamento.PAGO
            : StatusPagamento.PENDENTE,
        valor: args.valor,
        externalId: pix.externalId,
        qrCode: pix.qrCode, // copia-e-cola (EMV)
        linkPagamento: pix.ticketUrl,
        payloadRaw: {
          qrCodeBase64: pix.qrCodeBase64,
          ticketUrl: pix.ticketUrl,
          expiraEm: pix.expiraEm ? pix.expiraEm.toISOString() : null,
        } as Prisma.InputJsonValue,
      },
    });
    await prisma.order.update({
      where: { id: args.orderId },
      data: { mpPaymentId: pix.externalId },
    });
  } catch (e) {
    console.error("[checkout] gravar Pagamento", e);
  }

  return {
    numero: args.numero,
    valor: args.valor,
    qrCodeBase64: pix.qrCodeBase64,
    qrPngUrl: null,
    copiaECola: pix.copiaECola ?? pix.qrCode,
    ticketUrl: pix.ticketUrl,
    expiraEm: pix.expiraEm ? pix.expiraEm.toISOString() : null,
  };
}

export type PagadorCheckout = {
  nome: string;
  sobrenome: string | null;
  email: string;
  cpfCnpj: string;
};

// Item já precificado p/ o additional_info.items do cartão (antifraude MP).
export type ItemCartaoMp = {
  id: string;
  title: string;
  categoryId: string;
  quantity: number;
  unitPrice: number; // preço efetivo no cartão (com campanha/cupom)
};

export type OrderCriado = {
  orderId: string;
  numero: string;
  valorPix: number; // total a cobrar no Pix (com desconto) — recalculado no servidor
  valorCartao: number; // total a cobrar no cartão (cheio) — recalculado no servidor
  pagador: PagadorCheckout;
  reused: boolean; // true = reaproveitou um AGUARDANDO existente (não deletar em erro)
  tipoEntrega: "ENVIO" | "RETIRADA"; // RETIRADA → cartão usa endereço da loja no shipments
  // Dados (normalizados no servidor) p/ o additional_info do cartão — antifraude MP.
  telefone: string; // só dígitos
  endereco: {
    cep: string; // só dígitos
    uf: string;
    cidade: string;
    logradouro: string;
    numero: string;
  };
  itens: ItemCartaoMp[];
};

// Item precificado no servidor (fonte da verdade). precoCheio = cartão à vista;
// precoPix = com desconto efetivo. Reusado por criarOrderDoCheckout (cobrança) e
// precificarCheckout (exibição).
type ItemPrecificado = {
  productId: string;
  categoryId: string;
  nomeProduto: string;
  precoCheio: number;
  precoPix: number;
  descontoPixPercent: number;
  quantidade: number;
  imagemSnapshot: string | null;
  composicao: CheckoutInput["itens"][number]["composicao"];
  qtdMachos: number | null;
  qtdFemeas: number | null;
  qtdPeixes: number;
};

type PrecificacaoResult =
  | {
      ok: true;
      itens: ItemPrecificado[];
      totalPeixes: number;
      subtotalCheio: number;
      subtotalPix: number;
    }
  | { ok: false; error: string };

/**
 * Recalcula preço de cada item DO BANCO (cheio + Pix com desconto efetivo via
 * lib/precos + ConfiguracaoLoja). Fonte única da verdade — nunca confia no client.
 */
async function precificarItens(
  itens: CheckoutInput["itens"],
): Promise<PrecificacaoResult> {
  const produtoIds = [...new Set(itens.map((i) => i.produtoId))];
  const [produtos, config] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: produtoIds }, ativo: true },
      select: {
        id: true,
        categoryId: true,
        nome: true,
        preco: true,
        descontoPix: true,
        usarDescontoPixGlobal: true,
        videos: {
          where: { principal: true },
          take: 1,
          select: { thumbnailUrl: true },
        },
        variantes: {
          where: { ativo: true },
          select: {
            composicao: true,
            preco: true,
            qtdMachos: true,
            qtdFemeas: true,
          },
        },
      },
    }),
    getConfigPreco(),
  ]);
  const pmap = new Map(produtos.map((p) => [p.id, p]));

  const out: ItemPrecificado[] = [];
  let totalPeixes = 0;
  let subtotalCheio = 0;
  let subtotalPix = 0;

  for (const item of itens) {
    const prod = pmap.get(item.produtoId);
    if (!prod) {
      return { ok: false, error: "Um dos produtos não está mais disponível." };
    }
    const descontoProprio =
      prod.descontoPix == null ? null : Number(prod.descontoPix);

    if (item.composicao) {
      const variante = prod.variantes.find(
        (v) => v.composicao === item.composicao,
      );
      if (!variante) {
        return {
          ok: false,
          error: `A composição escolhida de "${prod.nome}" não está mais disponível.`,
        };
      }
      const calc = calcularPrecos(
        {
          precoBase: Number(variante.preco),
          descontoPixProprio: descontoProprio,
          usarDescontoPixGlobal: prod.usarDescontoPixGlobal,
        },
        config,
      );
      const qtdPeixes = variante.qtdMachos + variante.qtdFemeas;
      totalPeixes += qtdPeixes * item.quantidade;
      subtotalCheio += calc.precoCartao * item.quantidade;
      subtotalPix += calc.precoPix * item.quantidade;
      out.push({
        productId: prod.id,
        categoryId: prod.categoryId,
        nomeProduto: `${prod.nome} — ${COMPOSICAO_LABEL[item.composicao]}`,
        precoCheio: calc.precoCartao,
        precoPix: calc.precoPix,
        descontoPixPercent: calc.descontoPixPercent,
        quantidade: item.quantidade,
        imagemSnapshot: prod.videos[0]?.thumbnailUrl ?? null,
        composicao: item.composicao,
        qtdMachos: variante.qtdMachos,
        qtdFemeas: variante.qtdFemeas,
        qtdPeixes,
      });
    } else {
      const calc = calcularPrecos(
        {
          precoBase: Number(prod.preco),
          descontoPixProprio: descontoProprio,
          usarDescontoPixGlobal: prod.usarDescontoPixGlobal,
        },
        config,
      );
      subtotalCheio += calc.precoCartao * item.quantidade;
      subtotalPix += calc.precoPix * item.quantidade;
      out.push({
        productId: prod.id,
        categoryId: prod.categoryId,
        nomeProduto: prod.nome,
        precoCheio: calc.precoCartao,
        precoPix: calc.precoPix,
        descontoPixPercent: calc.descontoPixPercent,
        quantidade: item.quantidade,
        imagemSnapshot: prod.videos[0]?.thumbnailUrl ?? null,
        composicao: null,
        qtdMachos: null,
        qtdFemeas: null,
        qtdPeixes: 0,
      });
    }
  }

  return {
    ok: true,
    itens: out,
    totalPeixes,
    subtotalCheio: round2(subtotalCheio),
    subtotalPix: round2(subtotalPix),
  };
}

// ── Cupom de desconto (revalidado e recalculado SEMPRE no servidor) ───────────

type CupomResolvido = {
  cupomId: string;
  codigo: string;
  modoAplicacao: CupomCalculo["modoAplicacao"];
  descontoPix: number;
  descontoCartao: number;
};

type ResolverCupomResult =
  | { status: "nenhum" } // sem código informado
  | { status: "invalido"; motivo: string }
  | { status: "ok"; data: CupomResolvido };

/**
 * Resolve um código de cupom contra os itens JÁ precificados pelo servidor: busca,
 * checa vigência (datas/limite/estoque do escopo) e calcula o desconto nos dois
 * métodos (Pix e cartão). Fonte única usada pela validação no carrinho e pelo
 * recálculo antifraude no checkout.
 */
async function resolverCupom(
  codigo: string | null | undefined,
  itens: ItemPrecificadoCupom[],
): Promise<ResolverCupomResult> {
  if (!codigo || !codigo.trim()) return { status: "nenhum" };

  const cupom = await getCupomByCodigo(normalizarCodigo(codigo));
  if (!cupom) return { status: "invalido", motivo: "Cupom não encontrado." };
  // Cupom de CAMPANHA não é digitável — ele já se aplica sozinho na vitrine. Mas só
  // afirmar "já aplicado" se a campanha realmente cobre algum item do carrinho;
  // senão, não prometer um desconto que não está lá.
  if (cupom.tipoCupom !== "SECRETO") {
    const catIds = cupom.categorias.map((c) => c.id);
    const prodIds = cupom.produtos.map((p) => p.id);
    const cobre =
      cupom.escopo === "TODOS" ||
      itens.some((i) =>
        cupom.escopo === "CATEGORIAS"
          ? catIds.includes(i.categoryId)
          : prodIds.includes(i.productId),
      );
    return {
      status: "invalido",
      motivo: cobre
        ? "Este cupom já é aplicado automaticamente nos produtos."
        : "Este código é de uma promoção automática e não vale para os itens do seu carrinho.",
    };
  }

  const calc: CupomCalculo = {
    tipoValor: cupom.tipoValor,
    valor: Number(cupom.valor),
    escopo: cupom.escopo,
    modoAplicacao: cupom.modoAplicacao,
    pedidoMinimo: cupom.pedidoMinimo == null ? null : Number(cupom.pedidoMinimo),
    categoriaIds: cupom.categorias.map((c) => c.id),
    produtoIds: cupom.produtos.map((p) => p.id),
  };

  // Produtos do escopo (estoque) p/ a regra "encerra ao esgotar estoque".
  const produtosEscopo =
    cupom.escopo === "PRODUTOS"
      ? cupom.produtos.map((p) => ({
          estoqueMachos: p.estoqueMachos,
          estoqueFemeas: p.estoqueFemeas,
        }))
      : cupom.escopo === "CATEGORIAS"
        ? cupom.categorias.flatMap((c) => c.produtos)
        : [];

  const vig = cupomVigente(
    {
      ativo: cupom.ativo,
      validoDe: cupom.validoDe,
      validoAte: cupom.validoAte,
      limiteUsos: cupom.limiteUsos,
      usosRealizados: cupom.usosRealizados,
      encerraAoEsgotarEstoque: cupom.encerraAoEsgotarEstoque,
    },
    produtosEscopo,
  );
  if (!vig.ok) {
    return { status: "invalido", motivo: vig.motivo ?? "Cupom indisponível." };
  }

  const pix = calcularDescontoCupom({ cupom: calc, itens, metodo: "PIX" });
  const cartao = calcularDescontoCupom({ cupom: calc, itens, metodo: "CARTAO" });
  if (!pix.aplicavel && !cartao.aplicavel) {
    return {
      status: "invalido",
      motivo: pix.motivo ?? cartao.motivo ?? "Cupom não aplicável a este carrinho.",
    };
  }

  return {
    status: "ok",
    data: {
      cupomId: cupom.id,
      codigo: cupom.codigo,
      modoAplicacao: cupom.modoAplicacao,
      descontoPix: pix.desconto,
      descontoCartao: cartao.desconto,
    },
  };
}

/** Itens precificados → forma que o cálculo de cupom consome (com categoryId). */
function itensParaCupom(itens: ItemPrecificado[]): ItemPrecificadoCupom[] {
  return itens.map((it) => ({
    productId: it.productId,
    categoryId: it.categoryId,
    precoCheio: it.precoCheio,
    precoPix: it.precoPix,
    quantidade: it.quantidade,
  }));
}

export type ValidarCupomResult =
  | {
      ok: true;
      codigo: string;
      modo: CupomCalculo["modoAplicacao"];
      descontoPix: number;
      descontoCartao: number;
    }
  | { ok: false; motivo: string };

/**
 * Valida e precifica um cupom para o carrinho (action PÚBLICA — sem auth). Recalcula
 * os preços do banco e devolve só o desconto por método + o código normalizado (não
 * vaza o cupom inteiro). O checkout REvalida depois — isto é só o preview.
 */
export async function validarCupom(
  codigo: string,
  itens: CheckoutFormInput["itens"],
): Promise<ValidarCupomResult> {
  // "Vazio" é só quando NÃO há itens. Shape inválido (carrinho antigo) é outro
  // caso — não dá pra mascarar de "carrinho vazio", senão o cupom fica travado.
  if (!Array.isArray(itens) || itens.length === 0) {
    return { ok: false, motivo: "Seu carrinho está vazio." };
  }
  const parsed = checkoutBaseSchema.shape.itens.safeParse(itens);
  if (!parsed.success) {
    return {
      ok: false,
      motivo: "Não foi possível ler os itens do carrinho. Atualize a página e tente de novo.",
    };
  }

  const prec = await precificarItens(parsed.data);
  if (!prec.ok) {
    return { ok: false, motivo: "Alguns itens não estão mais disponíveis." };
  }

  const r = await resolverCupom(codigo, itensParaCupom(prec.itens));
  if (r.status === "nenhum") {
    return { ok: false, motivo: "Informe um código de cupom." };
  }
  if (r.status === "invalido") return { ok: false, motivo: r.motivo };

  return {
    ok: true,
    codigo: r.data.codigo,
    modo: r.data.modoAplicacao,
    descontoPix: r.data.descontoPix,
    descontoCartao: r.data.descontoCartao,
  };
}

// ── Desconto POR ITEM: melhor entre a campanha automática e o código secreto ──

export type DescontoItem = {
  descontoCartaoUnit: number;
  descontoPixUnit: number;
  cupomId: string | null; // cupom vencedor (snapshot do OrderItem; base cartão)
  cupomCodigo: string | null;
  tipoVencedor: "CAMPANHA" | "SECRETO" | null;
};

/**
 * Para cada item, resolve o MAIOR desconto entre a campanha automática do produto
 * e o código secreto digitado (não acumulam). Campanha é exata por item; o código
 * secreto é calculado no carrinho inteiro (respeita pedido mínimo, modo e valor
 * fixo "uma vez") e distribuído por item proporcionalmente. Tudo por método.
 */
async function resolverDescontosPorItem(
  itens: ItemPrecificado[],
  codigoSecreto: string | null | undefined,
): Promise<DescontoItem[]> {
  // 1) Campanha por produto (distinct; getCampanhasVigentes é cacheado no request).
  const campanhaCache = new Map<string, CampanhaInfo | null>();
  for (const it of itens) {
    if (!campanhaCache.has(it.productId)) {
      campanhaCache.set(
        it.productId,
        await resolverCampanhaInfo({
          id: it.productId,
          categoryId: it.categoryId,
          precoCheio: it.precoCheio,
          descontoPixPercent: it.descontoPixPercent,
          estoqueMachos: 0,
          estoqueFemeas: 0,
        }),
      );
    }
  }

  // 2) Código secreto: total no carrinho + distribuição proporcional por item.
  let secreto: {
    cupomId: string;
    codigo: string;
    cobre: (i: ItemPrecificadoCupom) => boolean;
    cartaoTotal: number;
    pixTotal: number;
    subCheio: number;
    subPix: number;
  } | null = null;

  if (codigoSecreto && codigoSecreto.trim()) {
    const cupom = await getCupomByCodigo(normalizarCodigo(codigoSecreto));
    if (cupom && cupom.tipoCupom === "SECRETO") {
      const calc: CupomCalculo = {
        tipoValor: cupom.tipoValor,
        valor: Number(cupom.valor),
        escopo: cupom.escopo,
        modoAplicacao: cupom.modoAplicacao,
        pedidoMinimo:
          cupom.pedidoMinimo == null ? null : Number(cupom.pedidoMinimo),
        categoriaIds: cupom.categorias.map((c) => c.id),
        produtoIds: cupom.produtos.map((p) => p.id),
      };
      const produtosEscopo =
        cupom.escopo === "PRODUTOS"
          ? cupom.produtos.map((p) => ({
              estoqueMachos: p.estoqueMachos,
              estoqueFemeas: p.estoqueFemeas,
            }))
          : cupom.escopo === "CATEGORIAS"
            ? cupom.categorias.flatMap((c) => c.produtos)
            : [];
      const vig = cupomVigente(
        {
          ativo: cupom.ativo,
          validoDe: cupom.validoDe,
          validoAte: cupom.validoAte,
          limiteUsos: cupom.limiteUsos,
          usosRealizados: cupom.usosRealizados,
          encerraAoEsgotarEstoque: cupom.encerraAoEsgotarEstoque,
        },
        produtosEscopo,
      );
      if (vig.ok) {
        const itensCupom = itensParaCupom(itens);
        const cartaoTotal = calcularDescontoCupom({
          cupom: calc,
          itens: itensCupom,
          metodo: "CARTAO",
        }).desconto;
        const pixTotal = calcularDescontoCupom({
          cupom: calc,
          itens: itensCupom,
          metodo: "PIX",
        }).desconto;
        const elegiveis = itensCupom.filter((i) => itemElegivel(calc, i));
        secreto = {
          cupomId: cupom.id,
          codigo: cupom.codigo,
          cobre: (i) => itemElegivel(calc, i),
          cartaoTotal,
          pixTotal,
          subCheio: elegiveis.reduce(
            (a, i) => a + i.precoCheio * i.quantidade,
            0,
          ),
          subPix: elegiveis.reduce((a, i) => a + i.precoPix * i.quantidade, 0),
        };
      }
    }
  }

  // 3) Por item: campanha (exata) vs cota do secreto. Vence o maior, por método.
  return itens.map((it) => {
    const camp = campanhaCache.get(it.productId) ?? null;
    let campCartaoUnit = 0;
    let campPixUnit = 0;
    if (camp) {
      const promo = precoComCampanha(it.precoCheio, it.descontoPixPercent, camp);
      campCartaoUnit = Math.max(0, round2(it.precoCheio - promo.precoPromoCheio));
      campPixUnit = Math.max(0, round2(it.precoPix - promo.precoPromoPix));
    }

    let secCartaoUnit = 0;
    let secPixUnit = 0;
    if (
      secreto &&
      secreto.cobre({
        productId: it.productId,
        categoryId: it.categoryId,
        precoCheio: it.precoCheio,
        precoPix: it.precoPix,
        quantidade: it.quantidade,
      })
    ) {
      const linhaCheio = it.precoCheio * it.quantidade;
      const linhaPix = it.precoPix * it.quantidade;
      const cotaCartao =
        secreto.subCheio > 0
          ? (secreto.cartaoTotal * linhaCheio) / secreto.subCheio
          : 0;
      const cotaPix =
        secreto.subPix > 0 ? (secreto.pixTotal * linhaPix) / secreto.subPix : 0;
      secCartaoUnit = it.quantidade > 0 ? round2(cotaCartao / it.quantidade) : 0;
      secPixUnit = it.quantidade > 0 ? round2(cotaPix / it.quantidade) : 0;
    }

    const descontoCartaoUnit = Math.max(campCartaoUnit, secCartaoUnit);
    const descontoPixUnit = Math.max(campPixUnit, secPixUnit);

    // Cupom vencedor para o snapshot (base cartão; se cartão não desconta, usa Pix).
    let cupomId: string | null = null;
    let cupomCodigo: string | null = null;
    let tipoVencedor: "CAMPANHA" | "SECRETO" | null = null;
    const escolher = (campVal: number, secVal: number) => {
      if (campVal <= 0 && secVal <= 0) return;
      if (campVal >= secVal && camp) {
        cupomId = camp.cupomId;
        cupomCodigo = camp.codigo;
        tipoVencedor = "CAMPANHA";
      } else if (secreto) {
        cupomId = secreto.cupomId;
        cupomCodigo = secreto.codigo;
        tipoVencedor = "SECRETO";
      }
    };
    if (descontoCartaoUnit > 0) escolher(campCartaoUnit, secCartaoUnit);
    else if (descontoPixUnit > 0) escolher(campPixUnit, secPixUnit);

    return { descontoCartaoUnit, descontoPixUnit, cupomId, cupomCodigo, tipoVencedor };
  });
}

// ── Resolução ÚNICA do carrinho (preço efetivo no servidor) ───────────────────
// Reusada pelo carrinho e pelo resumo do checkout. O preço NUNCA vem do client: a
// campanha automática + o código secreto são recalculados do banco aqui.

export type LinhaCarrinhoResolvida = {
  produtoId: string;
  composicao: CheckoutInput["itens"][number]["composicao"];
  quantidade: number;
  precoCheioBase: number; // sem campanha (para o "de/por")
  precoPixBase: number;
  precoCheioEfetivo: number; // com campanha/cupom (cartão)
  precoPixEfetivo: number; // com campanha/cupom (Pix; = cheio no preço único)
  descontoPercent: number; // p/ badge "-X% OFF"
  cupomCodigo: string | null;
  tipoCupomVencedor: "CAMPANHA" | "SECRETO" | null;
};

export type CarrinhoResolvido = {
  linhas: LinhaCarrinhoResolvida[];
  subtotalCheioBase: number;
  subtotalPixBase: number;
  subtotalCheioEfetivo: number;
  subtotalPixEfetivo: number;
  // Config da loja que o carrinho/checkout precisam (descem do servidor).
  maxPeixesFreteAuto: number;
  freteGratis: { ativo: boolean; acimaDe: number | null };
};

/**
 * Resolve, no servidor, o preço efetivo de cada item (campanha automática + código
 * secreto, vence o maior por item) + os subtotais. Linhas na MESMA ordem do input
 * (o client casa por índice). Retorna null se algum item sumiu do catálogo.
 */
export async function resolverItensCarrinho(
  itens: CheckoutFormInput["itens"],
  codigoSecreto?: string | null,
): Promise<CarrinhoResolvido | null> {
  const parsed = checkoutBaseSchema.shape.itens.safeParse(itens);
  if (!parsed.success) return null;
  const prec = await precificarItens(parsed.data);
  if (!prec.ok) return null;

  const desc = await resolverDescontosPorItem(prec.itens, codigoSecreto);
  const linhas: LinhaCarrinhoResolvida[] = prec.itens.map((it, i) => {
    const d = desc[i];
    const precoCheioEfetivo = round2(Math.max(0, it.precoCheio - d.descontoCartaoUnit));
    const precoPixEfetivo = round2(Math.max(0, it.precoPix - d.descontoPixUnit));
    const descontoPercent =
      it.precoCheio > 0
        ? Math.round(((it.precoCheio - precoCheioEfetivo) / it.precoCheio) * 100)
        : 0;
    return {
      produtoId: it.productId,
      composicao: it.composicao,
      quantidade: it.quantidade,
      precoCheioBase: it.precoCheio,
      precoPixBase: it.precoPix,
      precoCheioEfetivo,
      precoPixEfetivo,
      descontoPercent,
      cupomCodigo: d.cupomCodigo,
      tipoCupomVencedor: d.tipoVencedor,
    };
  });
  const soma = (f: (l: LinhaCarrinhoResolvida) => number) =>
    round2(linhas.reduce((a, l) => a + f(l) * l.quantidade, 0));
  const cfg = await getConfiguracaoLoja();
  return {
    linhas,
    subtotalCheioBase: soma((l) => l.precoCheioBase),
    subtotalPixBase: soma((l) => l.precoPixBase),
    subtotalCheioEfetivo: soma((l) => l.precoCheioEfetivo),
    subtotalPixEfetivo: soma((l) => l.precoPixEfetivo),
    maxPeixesFreteAuto: cfg.maxPeixesFreteAuto,
    freteGratis: {
      ativo: cfg.freteGratisAtivo && cfg.freteGratisAcimaDe != null,
      acimaDe: cfg.freteGratisAcimaDe,
    },
  };
}

type OrderResult =
  | { ok: true; data: OrderCriado }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Cria o Order do checkout público (guest) — COMPARTILHADO entre Pix e Cartão.
 *
 * Anti-fraude: o PREÇO de cada item e o FRETE são recalculados NO SERVIDOR a
 * partir do banco e da cotadora — nunca confia no que o client mandou. Cria/reusa
 * Cliente, cria Order AGUARDANDO_PAGAMENTO (sem baixar estoque — só no PAGO).
 * NÃO gera pagamento: devolve { orderId, numero, valor, pagador } pro chamador
 * (Pix ou Cartão) emitir a cobrança. Se a emissão falhar, o chamador remove o
 * pedido órfão.
 */
export async function criarOrderDoCheckout(
  input: CheckoutFormInput,
): Promise<OrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os dados do formulário.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  // ── 1. Recalcular preços DO BANCO (cheio + Pix) — ignora o preço do client ──
  const prec = await precificarItens(data.itens);
  if (!prec.ok) return { ok: false, error: prec.error };
  const { totalPeixes, subtotalCheio, subtotalPix } = prec;

  // Desconto por item (campanha automática × código secreto, vence o maior) —
  // recalculado no servidor. Base do snapshot/Order = cartão (cheio canônico).
  const descItens = await resolverDescontosPorItem(prec.itens, data.cupomCodigo);

  // Snapshots a persistir: precoUnitario = CHEIO (canônico). O valor efetivamente
  // cobrado por forma (Pix com desconto vs cartão cheio) vai na linha Pagamento.
  const itensData = prec.itens.map((it, i) => ({
    productId: it.productId,
    nomeProduto: it.nomeProduto,
    precoUnitario: it.precoCheio,
    quantidade: it.quantidade,
    imagemSnapshot: it.imagemSnapshot,
    composicao: it.composicao,
    qtdMachos: it.qtdMachos,
    qtdFemeas: it.qtdFemeas,
    descontoUnitario:
      descItens[i].descontoCartaoUnit > 0 ? descItens[i].descontoCartaoUnit : null,
    cupomId: descItens[i].cupomId,
    cupomCodigo: descItens[i].cupomCodigo,
  }));

  // Desconto do pedido (por item, base cartão e Pix) — calculado já aqui pois o
  // frete grátis incide sobre o subtotal EFETIVO do cartão.
  const descontoCartao = round2(
    prec.itens.reduce(
      (a, it, i) => a + descItens[i].descontoCartaoUnit * it.quantidade,
      0,
    ),
  );
  const descontoPix = round2(
    prec.itens.reduce(
      (a, it, i) => a + descItens[i].descontoPixUnit * it.quantidade,
      0,
    ),
  );

  // ── 2. Entrega: RETIRADA (frete 0, sem transportadora) | ENVIO (cota frete) ──
  // Anti-tamper: o tipo de entrega manda. Na RETIRADA o servidor FORÇA frete 0 e
  // ignora CEP/modalidade/limite de peixes — o cliente busca presencialmente.
  const isRetirada = data.tipoEntrega === "RETIRADA";
  let frete = 0;
  let transportadora: Transportadora | null = null;
  let modalidade: "TERRESTRE" | "AEREO" | null = null;

  if (!isRetirada) {
    // Acima do limite de peixes (config) → frete combinado por WhatsApp.
    const maxPeixes = await getMaxPeixesFreteAuto();
    if (totalPeixes > maxPeixes) {
      return {
        ok: false,
        error: `Pedidos acima de ${maxPeixes} peixes têm o frete calculado manualmente. Finalize no WhatsApp.`,
      };
    }

    // Frete no servidor conforme a MODALIDADE escolhida (anti-tamper).
    modalidade = data.modalidadeFrete ?? "TERRESTRE";
    if (modalidade === "AEREO") {
      // Gollog: tabela fixa por região (UF). Até 10 peixes (o >10 já barrou acima).
      const g = freteGollog(data.uf);
      if (!g) {
        return {
          ok: false,
          error:
            "Frete aéreo indisponível para essa UF. Finalize no WhatsApp para combinarmos o envio.",
        };
      }
      frete = round2(g.preco);
      transportadora = Transportadora.GOLLOG;
    } else {
      // Terrestre: re-cota Jadlog via Melhor Envio pra esse CEP + peso/caixa.
      const { pesoGramas, caixa } = calcularPesoECaixa(Math.max(1, totalPeixes));
      const cot = await cotarFrete({ cepDestino: data.cep, pesoGramas, caixa });
      if (!cot.ok) {
        return { ok: false, error: cot.error };
      }
      const jad = cot.data.jadlog.find((j) => j.id === 4) ?? cot.data.jadlog[0];
      if (!jad) {
        return {
          ok: false,
          error:
            "Não há frete terrestre automático para esse CEP. Escolha o aéreo ou finalize no WhatsApp.",
        };
      }
      if (jad.requerAvaliacao) {
        return {
          ok: false,
          error:
            "O prazo de entrega terrestre para esse CEP exige avaliação — escolha o aéreo ou finalize no WhatsApp.",
        };
      }
      frete = round2(jad.price);
      transportadora = Transportadora.JADLOG;
    }

    // ── 2b. Frete grátis (config da loja, anti-tamper) ───────────────────────
    // Base = subtotal EFETIVO do cartão (preço cheio já com campanha/cupom) — o
    // que o cliente realmente paga. Mesma base da vitrine/carrinho/checkout.
    const subtotalCheioEfetivo = round2(subtotalCheio - descontoCartao);
    const freteGratis = await getFreteGratisConfig();
    if (
      freteGratis.ativo &&
      subtotalCheioEfetivo >= (freteGratis.acimaDe ?? Infinity)
    ) {
      frete = 0;
    }
  }

  // No Order guardamos a soma do desconto (calculada acima) e, informativo, o
  // código secreto digitado (cupomId null — a fonte de verdade é por item).
  const cupomId: string | null = null;
  const cupomCodigo: string | null = data.cupomCodigo?.trim()
    ? normalizarCodigo(data.cupomCodigo)
    : null;

  const totalCheio = round2(subtotalCheio + frete - descontoCartao);
  const totalPix = round2(subtotalPix + frete - descontoPix);

  // ── 3. Cliente (guest): cria/reusa por CPF, depois email, depois telefone ──
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const cpf = data.cpfCnpj;
  const tel = data.telefone;

  // Snapshot do destinatário. Na RETIRADA não há endereço — só o cadastro mínimo
  // (nome/CPF/telefone/email); os campos de endereço ficam null.
  const endereco: EnderecoEntrega = isRetirada
    ? {
        nome: data.nome,
        cpfCnpj: cpf,
        telefone: tel,
        email: data.email,
        cep: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        uf: null,
      }
    : {
        nome: data.nome,
        cpfCnpj: cpf,
        telefone: tel,
        email: data.email,
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento || null,
        bairro: data.bairro,
        cidade: data.cidade,
        uf: data.uf.toUpperCase(),
      };

  let orderId = "";
  let numero = "";
  let reused = false;
  try {
    const created = await prisma.$transaction(async (tx) => {
      // Reuso de cliente por identidade forte → fraca.
      const existente =
        (cpf && (await tx.cliente.findFirst({ where: { cpfCnpj: cpf } }))) ||
        (await tx.cliente.findFirst({ where: { email: data.email } })) ||
        (tel ? await tx.cliente.findFirst({ where: { telefone: tel } }) : null);

      // Na RETIRADA não atualiza o endereço do cliente (o form não o coleta —
      // evita apagar um endereço já salvo de um cliente recorrente).
      const dadosCliente = {
        nome: data.nome,
        telefone: tel,
        email: data.email,
        cpfCnpj: cpf,
        ...(isRetirada
          ? {}
          : {
              cep: data.cep,
              logradouro: data.logradouro,
              numero: data.numero,
              complemento: data.complemento || null,
              bairro: data.bairro,
              cidade: data.cidade,
              uf: data.uf.toUpperCase(),
            }),
      };

      const cliente = existente
        ? await tx.cliente.update({
            where: { id: existente.id },
            data: {
              ...dadosCliente,
              // só vincula user se ainda não tiver
              ...(userId && !existente.userId ? { userId } : {}),
            },
            select: { id: true },
          })
        : await tx.cliente.create({
            data: { ...dadosCliente, ...(userId ? { userId } : {}) },
            select: { id: true },
          });

      // ── Reuso do MESMO checkout (Opção A via hash de itens + comprador) ──
      // Em vez de criar um Order novo a cada tentativa/recusa, reusa um pedido
      // AGUARDANDO_PAGAMENTO recente (≤2h) do mesmo cliente com os MESMOS itens.
      // Assim, recusar e tentar de novo gera UM pedido com várias linhas
      // Pagamento — não vários pedidos órfãos. Nunca toca PAGO/ENVIADO/etc.
      const assinatura = (
        its: {
          productId: string | null;
          composicao: string | null;
          quantidade: number;
        }[],
      ) =>
        its
          .map((i) => `${i.productId ?? ""}|${i.composicao ?? ""}|${i.quantidade}`)
          .sort()
          .join(";");
      const assinaturaAtual = assinatura(itensData);

      const limite2h = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const candidatos = await tx.order.findMany({
        where: {
          clienteId: cliente.id,
          status: "AGUARDANDO_PAGAMENTO",
          criadoEm: { gte: limite2h },
        },
        orderBy: { criadoEm: "desc" },
        select: {
          id: true,
          numero: true,
          items: {
            select: { productId: true, composicao: true, quantidade: true },
          },
        },
      });
      const reusar = candidatos.find(
        (c) => assinatura(c.items) === assinaturaAtual,
      );

      if (reusar) {
        // Mesmo checkout: atualiza endereço/frete/total (anti-fraude recalculado);
        // mantém numero e os itens (snapshots iguais). A nova tentativa de
        // Pagamento é anexada depois pelo chamador (Pix/Cartão).
        const upd = await tx.order.update({
          where: { id: reusar.id },
          data: {
            enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
            tipoEntrega: data.tipoEntrega,
            transportadora,
            modalidadeFrete: modalidade,
            subtotal: subtotalCheio,
            frete,
            desconto: descontoCartao,
            cupomId,
            cupomCodigo,
            total: totalCheio,
            // Recria os itens para refletir os descontos por item recalculados.
            items: { deleteMany: {}, create: itensData },
          },
          select: { id: true, numero: true },
        });
        return { ...upd, reused: true };
      }

      // Número sequencial por ano (igual ao pedido manual).
      const ano = new Date().getFullYear();
      const ultimo = await tx.order.findFirst({
        where: { ano },
        orderBy: { sequencia: "desc" },
        select: { sequencia: true },
      });
      const sequencia = (ultimo?.sequencia ?? 0) + 1;
      const num = `#${ano}-${String(sequencia).padStart(4, "0")}`;

      const novo = await tx.order.create({
        data: {
          numero: num,
          ano,
          sequencia,
          clienteId: cliente.id,
          userId: userId ?? undefined,
          status: "AGUARDANDO_PAGAMENTO", // sem baixar estoque (só no PAGO)
          formaPagamento: FormaPagamento.PIX,
          tipoEntrega: data.tipoEntrega,
          transportadora,
          modalidadeFrete: modalidade,
          enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
          subtotal: subtotalCheio,
          frete,
          desconto: descontoCartao,
          cupomId,
          cupomCodigo,
          total: totalCheio,
          items: { create: itensData },
        },
        select: { id: true, numero: true },
      });
      return { ...novo, reused: false };
    });
    orderId = created.id;
    numero = created.numero;
    reused = created.reused;
  } catch (e) {
    console.error("[checkout] criar pedido", e);
    return { ok: false, error: "Não foi possível criar o pedido. Tente novamente." };
  }

  const partesNome = data.nome.trim().split(/\s+/);
  // Itens com o preço EFETIVO do cartão (cheio − desconto por item) p/ o
  // additional_info.items do MP. Mesma fonte do que o cartão realmente cobra.
  const itensCartao: ItemCartaoMp[] = prec.itens.map((it, i) => ({
    id: it.productId,
    title: it.nomeProduto,
    categoryId: it.categoryId,
    quantity: it.quantidade,
    unitPrice: round2(Math.max(0, it.precoCheio - descItens[i].descontoCartaoUnit)),
  }));
  return {
    ok: true,
    data: {
      orderId,
      numero,
      valorPix: totalPix,
      valorCartao: totalCheio,
      reused,
      tipoEntrega: data.tipoEntrega,
      pagador: {
        nome: partesNome[0],
        sobrenome: partesNome.slice(1).join(" ") || null,
        email: data.email,
        cpfCnpj: cpf,
      },
      telefone: data.telefone,
      endereco: {
        cep: data.cep,
        uf: data.uf.toUpperCase(),
        cidade: data.cidade,
        logradouro: data.logradouro,
        numero: data.numero,
      },
      itens: itensCartao,
    },
  };
}

/**
 * Pix: cria o Order (helper compartilhado) e gera a cobrança Pix. Se o MP falhar,
 * remove o pedido órfão. Devolve o QR/copia-e-cola pra tela do Pix.
 */
export async function criarPedidoCheckout(
  input: CheckoutFormInput,
): Promise<CheckoutResult> {
  const order = await criarOrderDoCheckout(input);
  if (!order.ok) return order;

  try {
    const pixData = await emitirPix({
      orderId: order.data.orderId,
      numero: order.data.numero,
      valor: order.data.valorPix, // Pix cobra o total COM desconto
      pagador: order.data.pagador,
    });
    // 🛒 recuperação de venda — só na criação (não em regeneração de Pix).
    if (!order.data.reused) {
      await notificarTentativaCompra(order.data.orderId, "Pix");
    }
    return { ok: true, data: pixData };
  } catch (e) {
    console.error("[checkout] criar Pix", e);
    // Pedido recém-criado sem pagamento → remove pra não poluir o admin. Pedido
    // REUSADO não se apaga (tem tentativas anteriores); a varredura limpa depois.
    if (!order.data.reused) {
      await prisma.order
        .delete({ where: { id: order.data.orderId } })
        .catch(() => {});
    }
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Não foi possível gerar o Pix agora.",
    };
  }
}

export type CheckoutProResult =
  | { ok: true; initPoint: string; numero: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Checkout Pro (Wallet): cria/reusa o Order (helper compartilhado) e cria uma
 * preference no MP com o valor DO BANCO (cartão cheio) + external_reference =
 * orderId. Devolve o init_point pro client redirecionar ao ambiente do MP. A
 * confirmação vem do WEBHOOK (nunca da back_url). Pedido fica AGUARDANDO até lá.
 */
export async function iniciarCheckoutPro(
  input: CheckoutFormInput,
): Promise<CheckoutProResult> {
  const order = await criarOrderDoCheckout(input);
  if (!order.ok) {
    return { ok: false, error: order.error, fieldErrors: order.fieldErrors };
  }

  const { orderId, numero, valorCartao, pagador, itens } = order.data;
  const numeroLimpo = numero.replace(/^#/, "");

  // Itens da preference = itens do pedido (preço efetivo do cartão) + frete como
  // linha separada, pra a soma bater exatamente com o total do banco (valorCartao).
  const somaItens = round2(
    itens.reduce((a, it) => a + it.unitPrice * it.quantity, 0),
  );
  const frete = round2(valorCartao - somaItens);
  const itensPref = [
    ...itens.map((it) => ({
      id: it.id,
      title: it.title,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    })),
    ...(frete > 0
      ? [{ id: "frete", title: "Frete", quantity: 1, unitPrice: frete }]
      : []),
  ];

  try {
    const provider = getPaymentProvider(ProviderPagamento.MERCADO_PAGO);
    const pref = await provider.criarPreferencia({
      orderId,
      itens: itensPref,
      pagador,
      backUrls: {
        success: `${SITE_URL}/pedido/${numeroLimpo}/analise`,
        pending: `${SITE_URL}/pedido/${numeroLimpo}/analise`,
        failure: `${SITE_URL}/pedido/${numeroLimpo}/falha`,
      },
    });
    if (!pref.initPoint) {
      // Sem init_point não há pra onde mandar o cliente → remove o órfão recém-criado.
      if (!order.data.reused) {
        await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
      }
      return {
        ok: false,
        error: "Não foi possível iniciar o pagamento no Mercado Pago.",
      };
    }
    if (!order.data.reused) {
      await notificarTentativaCompra(orderId, "Cartão (Mercado Pago)");
    }
    return { ok: true, initPoint: pref.initPoint, numero };
  } catch (e) {
    console.error("[checkout] checkout pro", e);
    if (!order.data.reused) {
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    }
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Não foi possível iniciar o pagamento no Mercado Pago.",
    };
  }
}

/**
 * Poll do status do pedido a partir do BANCO (o webhook é quem confirma o
 * pagamento e atualiza o status). NÃO chama o MP — público, leve, idempotente.
 * `pago` cobre PAGO e os status posteriores (ENVIADO/ENTREGUE).
 */
export async function consultarStatusPedido(
  numero: string,
): Promise<{ pago: boolean; status: OrderStatus } | null> {
  const order = await prisma.order.findUnique({
    where: { numero },
    select: { status: true },
  });
  if (!order) return null;
  const pago =
    order.status === "PAGO" ||
    order.status === "ENVIADO" ||
    order.status === "ENTREGUE";
  return { pago, status: order.status };
}

/**
 * Gera um novo Pix para um pedido que ainda aguarda pagamento (Pix anterior
 * expirou). Reusa o cliente/endereço/total do pedido — não recria o Order.
 */
export async function gerarNovoPix(numero: string): Promise<CheckoutResult> {
  const order = await prisma.order.findUnique({
    where: { numero },
    select: {
      id: true,
      numero: true,
      total: true,
      frete: true,
      status: true,
      cupomCodigo: true,
      enderecoEntrega: true,
      items: {
        select: { productId: true, composicao: true, quantidade: true },
      },
    },
  });
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  if (order.status !== "AGUARDANDO_PAGAMENTO") {
    return {
      ok: false,
      error: "Este pedido não está mais aguardando pagamento.",
    };
  }

  // Recalcula o total PIX (com desconto) dos itens do pedido + frete salvo. O
  // Order.total guarda o CHEIO (cartão); o Pix cobra o descontado. Reaplica o
  // cupom salvo (se ainda vigente) sobre o preço Pix.
  const prec = await precificarItens(
    order.items
      .filter((it) => it.productId)
      .map((it) => ({
        produtoId: it.productId as string,
        composicao: it.composicao,
        quantidade: it.quantidade,
      })),
  );
  let valorPix: number;
  if (prec.ok) {
    // Reaplica campanha (automática) + código secreto salvo, por item, no Pix.
    const descItens = await resolverDescontosPorItem(
      prec.itens,
      order.cupomCodigo,
    );
    const descontoPix = round2(
      prec.itens.reduce(
        (a, it, i) => a + descItens[i].descontoPixUnit * it.quantidade,
        0,
      ),
    );
    valorPix = round2(prec.subtotalPix + Number(order.frete) - descontoPix);
  } else {
    valorPix = Number(order.total);
  }

  const end = order.enderecoEntrega as unknown as EnderecoEntrega;
  const partes = (end.nome ?? "").trim().split(/\s+/);
  try {
    const pixData = await emitirPix({
      orderId: order.id,
      numero: order.numero,
      valor: valorPix,
      pagador: {
        nome: partes[0],
        sobrenome: partes.slice(1).join(" ") || null,
        email: end.email ?? "",
        cpfCnpj: end.cpfCnpj,
      },
    });
    return { ok: true, data: pixData };
  } catch (e) {
    console.error("[checkout] gerar novo Pix", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Não foi possível gerar o Pix.",
    };
  }
}

// ── Precificação do checkout (exibição: servidor é a fonte da verdade) ───────

export type CheckoutPrecoLinha = {
  produtoId: string;
  composicao: CheckoutInput["itens"][number]["composicao"];
  precoCheio: number;
  precoPix: number;
};

export type CheckoutPreco = {
  itens: CheckoutPrecoLinha[];
  subtotalCheio: number;
  subtotalPix: number;
  descontoPixPercentMax: number; // p/ o selo "no Pix • X% OFF"
};

/**
 * Preços autoritativos do carrinho (cheio + Pix), p/ o resumo do checkout mostrar
 * os DOIS totais corretos por aba. Não confia no client — recalcula do banco.
 * Devolve null se algum item sumiu (o cliente revê o carrinho).
 */
export async function precificarCheckout(
  itens: CheckoutFormInput["itens"],
): Promise<CheckoutPreco | null> {
  const parsed = checkoutBaseSchema.shape.itens.safeParse(itens);
  if (!parsed.success) return null;
  const prec = await precificarItens(parsed.data);
  if (!prec.ok) return null;
  return {
    itens: prec.itens.map((it) => ({
      produtoId: it.productId,
      composicao: it.composicao,
      precoCheio: it.precoCheio,
      precoPix: it.precoPix,
    })),
    subtotalCheio: prec.subtotalCheio,
    subtotalPix: prec.subtotalPix,
    descontoPixPercentMax: prec.itens.reduce(
      (m, it) => Math.max(m, it.descontoPixPercent),
      0,
    ),
  };
}

// ── Cartão de crédito ────────────────────────────────────────────────────────

export type CartaoInput = {
  token: string;
  paymentMethodId: string;
  issuerId: string | null;
  installments: number;
  // Device fingerprint do MP (window.MP_DEVICE_SESSION_ID), capturado no Brick.
  // Vai no header X-meli-session-id — sem ele o antifraude do MP recusa.
  deviceId?: string | null;
  // payer exatamente como o Brick devolveu (não reordenar/substituir): o
  // identification (CPF) é o que o cliente digitou no formulário seguro do MP.
  payer?: {
    email?: string | null;
    identification?: { type?: string | null; number?: string | null } | null;
  } | null;
};

export type CartaoDesfecho =
  | { resultado: "aprovado"; numero: string }
  | { resultado: "analise"; numero: string }
  | { resultado: "recusado"; mensagem: string }
  | {
      resultado: "erro";
      mensagem: string;
      fieldErrors?: Record<string, string[]>;
    };

/**
 * Teto de parcelas = min(12, menor parcelasMax entre os produtos do carrinho).
 * Calculado NO SERVIDOR — alimenta o Brick (maxInstallments) e valida a tentativa
 * (anti-tamper). Sem produtos → 1.
 */
export async function calcularTetoParcelas(
  produtoIds: string[],
): Promise<number> {
  const ids = [...new Set((produtoIds ?? []).filter(Boolean))];
  if (ids.length === 0) return 1;
  const prods = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { parcelasMax: true },
  });
  if (prods.length === 0) return 1;
  const menor = Math.min(...prods.map((p) => p.parcelasMax));
  return Math.max(1, Math.min(TETO_PARCELAS, menor));
}

/**
 * Cartão: cria o Order (helper compartilhado) e cobra no cartão com o TOKEN
 * (gerado no navegador pelo Brick — o servidor nunca vê PAN/CVV). Três desfechos
 * (status sempre da API do MP):
 *  - approved → grava Pagamento PAGO + transiciona o pedido (baixa com trava;
 *    o webhook depois não baixa de novo). Devolve "aprovado".
 *  - in_process → grava Pagamento EM_ANALISE, pedido segue AGUARDANDO (sem baixa);
 *    devolve "analise" (o webhook confirma depois).
 *  - rejected → grava Pagamento RECUSADO, pedido segue aguardando; devolve
 *    "recusado" + mensagem amigável (deixa tentar de novo).
 */
export async function pagarComCartao(
  input: CheckoutFormInput,
  cartao: CartaoInput,
): Promise<CartaoDesfecho> {
  // Valida o parcelamento ANTES de criar o pedido (anti-tamper, evita órfão).
  const parcelas = Number(cartao.installments);
  const teto = await calcularTetoParcelas(
    (input.itens ?? []).map((i) => i.produtoId),
  );
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > teto) {
    return { resultado: "erro", mensagem: "Opção de parcelamento inválida." };
  }
  if (!cartao.token || !cartao.paymentMethodId) {
    return { resultado: "erro", mensagem: "Dados do cartão incompletos." };
  }

  const order = await criarOrderDoCheckout(input);
  if (!order.ok) {
    return {
      resultado: "erro",
      mensagem: order.error,
      fieldErrors: order.fieldErrors,
    };
  }
  const { orderId, numero, valorCartao: valor, pagador } = order.data; // cartão cobra o CHEIO

  // payer fiel ao Brick: usa o e-mail/CPF que vieram do formulário seguro do MP;
  // só cai no checkout se o Brick não devolver (ex.: campo oculto).
  const emailPagador = cartao.payer?.email || pagador.email;
  const cpfPagador =
    cartao.payer?.identification?.number || pagador.cpfCnpj;

  // Cobrança no cartão (fora de transação de DB, igual ao Pix). O token vai UMA
  // vez ao /v1/payments; numa nova tentativa o Brick gera token novo.
  let pago;
  try {
    const provider = getPaymentProvider(ProviderPagamento.MERCADO_PAGO);
    // TEMP (diagnóstico antifraude): registra se o Device ID chegou do Brick.
    // Sem dado sensível — só "ok"/"VAZIO". Remover após validar a captura.
    console.warn(
      `[cartao] deviceId ${cartao.deviceId ? "ok" : "VAZIO"} pedido=${numero}`,
    );
    pago = await provider.criarPagamentoCartao({
      orderId,
      valor,
      descricao: `Pedido ${numero} — Guppy de Linhagem`,
      token: cartao.token,
      paymentMethodId: cartao.paymentMethodId,
      issuerId: cartao.issuerId,
      installments: parcelas,
      // Device ID + dados completos do pagador/entrega/itens p/ o antifraude do MP.
      deviceId: cartao.deviceId ?? null,
      pagador: {
        email: emailPagador,
        cpfCnpj: cpfPagador,
        nome: pagador.nome,
        sobrenome: pagador.sobrenome,
        telefone: order.data.telefone,
      },
      // shipments.receiver_address = onde o cliente recebe. Na RETIRADA é a loja
      // (não manda shipments vazio); no ENVIO é o endereço do cliente. O endereço
      // do PAGADOR (payer.address) só existe no envio — na retirada fica omitido.
      endereco:
        order.data.tipoEntrega === "RETIRADA"
          ? LOJA_ENDERECO
          : order.data.endereco,
      payerAddress:
        order.data.tipoEntrega === "RETIRADA" ? null : order.data.endereco,
      itens: order.data.itens,
    });
  } catch (e) {
    console.error("[checkout] cobrar cartão", e);
    // Erro de comunicação → sem pagamento. Remove só se foi recém-criado; pedido
    // REUSADO (com tentativas anteriores) não se apaga — a varredura limpa depois.
    if (!order.data.reused) {
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    }
    return {
      resultado: "erro",
      mensagem:
        e instanceof Error ? e.message : "Não foi possível processar o cartão.",
    };
  }

  // Grava a linha Pagamento em TODOS os casos (PAGO/EM_ANALISE/RECUSADO).
  try {
    await prisma.pagamento.create({
      data: {
        orderId,
        provider: ProviderPagamento.MERCADO_PAGO,
        metodo: MetodoPagamento.CARTAO,
        status: pago.status,
        valor,
        externalId: pago.externalId,
        parcelas: pago.parcelas,
        bandeira: pago.bandeira,
        // Só motivo da recusa (não sensível). NUNCA token/PAN/CVV.
        // TEMP (diagnóstico): deviceId só como "ok"/"vazio" — nunca o valor.
        payloadRaw: {
          statusDetail: pago.statusDetail,
          deviceId: cartao.deviceId ? "ok" : "vazio",
        } as Prisma.InputJsonValue,
      },
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { mpPaymentId: pago.externalId, parcelas: pago.parcelas },
    });
  } catch (e) {
    console.error("[checkout] gravar Pagamento cartão", e);
  }

  // ── Desfechos ──
  if (pago.status === StatusPagamento.PAGO) {
    // approved já vem na hora → transiciona aqui (trava evita baixa dupla quando
    // o webhook chegar com a mesma aprovação).
    let baixou = false;
    try {
      const res = await prisma.$transaction((tx) =>
        transicionarParaPago(tx, orderId),
      );
      baixou = res.baixou;
      revalidatePath("/admin/produtos");
      revalidatePath("/admin/pedidos");
    } catch (e) {
      console.error("[checkout] transicionar cartão aprovado", e);
    }
    // 💰 só na PRIMEIRA confirmação (trava estoqueBaixado) — evita duplicar com
    // o webhook que chega depois com a mesma aprovação.
    if (baixou) {
      await notificarPedidoPago(orderId, {
        provider: ProviderPagamento.MERCADO_PAGO,
        metodo: MetodoPagamento.CARTAO,
      });
    }
    return { resultado: "aprovado", numero };
  }

  if (pago.status === StatusPagamento.EM_ANALISE) {
    // Cartão em processamento → mesmo gatilho de acompanhamento da tentativa.
    if (!order.data.reused) {
      await notificarTentativaCompra(orderId, "Cartão (em análise)");
    }
    return { resultado: "analise", numero };
  }

  // RECUSADO (ou qualquer não-pago): pedido segue aguardando; tenta de novo.
  return { resultado: "recusado", mensagem: mensagemRecusa(pago.statusDetail) };
}

// ─────────────────────────────────────────────────────────────────────────────
// PagBank — 2º adquirente, ESCOPO CARD-ONLY via CHECKOUT HOSPEDADO. Existe pra
// recuperar cartão recusado pela antifraude do MP. O cliente digita o cartão na
// PÁGINA do PagBank (que cuida de criptografia, 3DS e antifraude) e volta pra cá;
// a confirmação vem do WEBHOOK. Pix é sempre do MP e boleto foi descontinuado.
// Reusa o MESMO criarOrderDoCheckout (pedido/preço/frete recalculados no servidor).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checkout hospedado do PagBank (cartão): cria/reusa o Order e cria um checkout no
 * PagBank RESTRITO a cartão, com o valor DO BANCO (cartão cheio) + reference_id =
 * orderId. Devolve o link (initPoint) pro client redirecionar à página do PagBank.
 * A confirmação vem do WEBHOOK (nunca do retorno). Pedido fica AGUARDANDO até lá.
 */
export async function iniciarCheckoutPagbank(
  input: CheckoutFormInput,
): Promise<CheckoutProResult> {
  const order = await criarOrderDoCheckout(input);
  if (!order.ok) {
    return { ok: false, error: order.error, fieldErrors: order.fieldErrors };
  }

  const { orderId, numero, valorCartao, pagador, itens } = order.data;
  const numeroLimpo = numero.replace(/^#/, "");

  // Itens do checkout = itens do pedido (preço efetivo do cartão) + frete como
  // linha separada, pra a soma bater exatamente com o total do banco (valorCartao).
  const somaItens = round2(
    itens.reduce((a, it) => a + it.unitPrice * it.quantity, 0),
  );
  const frete = round2(valorCartao - somaItens);
  const itensPref = [
    ...itens.map((it) => ({
      id: it.id,
      title: it.title,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    })),
    ...(frete > 0
      ? [{ id: "frete", title: "Frete", quantity: 1, unitPrice: frete }]
      : []),
  ];

  // Teto de parcelas (min 12 × menor parcelasMax do carrinho) → payment_methods_configs.
  const teto = await calcularTetoParcelas(
    (input.itens ?? []).map((i) => i.produtoId),
  );

  try {
    const provider = getPaymentProvider(ProviderPagamento.PAGBANK);
    const pref = await provider.criarPreferencia({
      orderId,
      itens: itensPref,
      pagador,
      backUrls: {
        success: `${SITE_URL}/pedido/${numeroLimpo}/analise`,
        pending: `${SITE_URL}/pedido/${numeroLimpo}/analise`,
        failure: `${SITE_URL}/pedido/${numeroLimpo}/falha`,
      },
      installmentsLimit: teto,
    });
    if (!pref.initPoint) {
      // Sem link não há pra onde mandar o cliente → remove o órfão recém-criado.
      if (!order.data.reused) {
        await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
      }
      return {
        ok: false,
        error: "Não foi possível iniciar o pagamento no PagBank.",
      };
    }
    if (!order.data.reused) {
      await notificarTentativaCompra(orderId, "Cartão (PagBank)");
    }
    return { ok: true, initPoint: pref.initPoint, numero };
  } catch (e) {
    console.error("[checkout] checkout pagbank", e);
    if (!order.data.reused) {
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    }
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Não foi possível iniciar o pagamento no PagBank.",
    };
  }
}
