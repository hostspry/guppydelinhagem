import "server-only";
import { estaEsgotado } from "@/lib/estoque";

// ─────────────────────────────────────────────────────────────
// Lógica central do cupom de desconto. PURA (sem I/O) — o caller (validarCupom no
// carrinho / checkout) resolve elegibilidade, preço por item (via lib/precos →
// calcularPrecos) e estoque, e passa tudo pronto pra cá. Reusa estaEsgotado de
// lib/estoque (NÃO duplica a regra do pool). O servidor é a fonte da verdade:
// nenhum valor de desconto vem do client.
// ─────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

export type MetodoCupom = "PIX" | "CARTAO";

/** Trim + UPPERCASE — forma canônica do código (igual à coluna única do banco). */
export function normalizarCodigo(codigo: string): string {
  return (codigo ?? "").trim().toUpperCase();
}

// Dados do cupom necessários para o cálculo (Decimais já convertidos p/ number).
export type CupomCalculo = {
  tipoValor: "PERCENTUAL" | "VALOR_FIXO";
  valor: number;
  escopo: "TODOS" | "CATEGORIAS" | "PRODUTOS";
  modoAplicacao:
    | "AMBOS_VENCE_MAIOR"
    | "AMBOS_ACUMULA"
    | "SO_PIX"
    | "SO_CARTAO";
  pedidoMinimo: number | null;
  categoriaIds: string[];
  produtoIds: string[];
};

// Item do carrinho JÁ precificado pelo servidor (cheio = cartão à vista; pix = com
// desconto efetivo). categoryId entra para o escopo CATEGORIAS.
export type ItemPrecificadoCupom = {
  productId: string;
  categoryId: string;
  precoCheio: number;
  precoPix: number;
  quantidade: number;
};

// Campos do cupom usados na checagem de vigência.
export type CupomVigencia = {
  ativo: boolean;
  validoDe: Date | null;
  validoAte: Date | null;
  limiteUsos: number | null;
  usosRealizados: number;
  encerraAoEsgotarEstoque: boolean;
};

/** Um item é elegível conforme o escopo do cupom. */
export function itemElegivel(
  cupom: Pick<CupomCalculo, "escopo" | "categoriaIds" | "produtoIds">,
  item: Pick<ItemPrecificadoCupom, "productId" | "categoryId">,
): boolean {
  switch (cupom.escopo) {
    case "TODOS":
      return true;
    case "CATEGORIAS":
      return cupom.categoriaIds.includes(item.categoryId);
    case "PRODUTOS":
      return cupom.produtoIds.includes(item.productId);
    default:
      return false;
  }
}

/**
 * Checa a vigência pela regra "primeiro gatilho": basta um gatilho disparar para o
 * cupom não valer. `produtosElegiveis` só é usado quando encerraAoEsgotarEstoque.
 * Retorna o primeiro motivo que falhar (mensagem amigável p/ o cliente).
 */
export function cupomVigente(
  cupom: CupomVigencia,
  produtosElegiveis: { estoqueMachos: number; estoqueFemeas: number }[],
  agora: Date = new Date(),
): { ok: boolean; motivo?: string } {
  if (!cupom.ativo) return { ok: false, motivo: "Cupom indisponível." };
  if (cupom.validoDe && agora < cupom.validoDe) {
    return { ok: false, motivo: "Este cupom ainda não está disponível." };
  }
  if (cupom.validoAte && agora > cupom.validoAte) {
    return { ok: false, motivo: "Este cupom expirou." };
  }
  if (cupom.limiteUsos != null && cupom.usosRealizados >= cupom.limiteUsos) {
    return { ok: false, motivo: "Este cupom atingiu o limite de usos." };
  }
  if (cupom.encerraAoEsgotarEstoque) {
    const algumDisponivel = produtosElegiveis.some((p) => !estaEsgotado(p));
    if (!algumDisponivel) {
      return { ok: false, motivo: "Os produtos deste cupom estão esgotados." };
    }
  }
  return { ok: true };
}

/** Desconto bruto sobre uma base: percentual ou valor fixo (sem ultrapassar a base). */
function descontoSobre(cupom: CupomCalculo, base: number): number {
  if (base <= 0) return 0;
  return cupom.tipoValor === "PERCENTUAL"
    ? base * (cupom.valor / 100)
    : Math.min(cupom.valor, base);
}

export type ResultadoDescontoCupom = {
  desconto: number;
  aplicavel: boolean;
  motivo?: string;
};

/**
 * Calcula o desconto do cupom para UM método (Pix ou cartão). Reusa os preços já
 * calculados pelo servidor (cheio/pix por item). Aplica escopo, pedido mínimo, os
 * 4 modos de aplicação e o clamp final (nunca derruba o total abaixo de zero, nem
 * passa do subtotal elegível do método).
 */
export function calcularDescontoCupom({
  cupom,
  itens,
  metodo,
}: {
  cupom: CupomCalculo;
  itens: ItemPrecificadoCupom[];
  metodo: MetodoCupom;
}): ResultadoDescontoCupom {
  // 1. Itens elegíveis pelo escopo.
  const elegiveis = itens.filter((it) => itemElegivel(cupom, it));
  if (elegiveis.length === 0) {
    return {
      desconto: 0,
      aplicavel: false,
      motivo: "Este cupom não vale para os itens do seu carrinho.",
    };
  }

  // 2. Pedido mínimo: compara contra o subtotal TOTAL (cheio) do carrinho inteiro.
  if (cupom.pedidoMinimo != null) {
    const subtotalTotalCheio = itens.reduce(
      (acc, it) => acc + it.precoCheio * it.quantidade,
      0,
    );
    if (subtotalTotalCheio < cupom.pedidoMinimo) {
      return {
        desconto: 0,
        aplicavel: false,
        motivo: `Este cupom vale a partir de R$ ${cupom.pedidoMinimo.toFixed(2).replace(".", ",")} em compras.`,
      };
    }
  }

  // 3. Subtotais dos elegíveis nos dois preços.
  const subElegivelCheio = elegiveis.reduce(
    (acc, it) => acc + it.precoCheio * it.quantidade,
    0,
  );
  const subElegivelPix = elegiveis.reduce(
    (acc, it) => acc + it.precoPix * it.quantidade,
    0,
  );

  // 4. Aplicação por modo × método.
  let desconto = 0;
  switch (cupom.modoAplicacao) {
    case "SO_CARTAO":
      if (metodo === "PIX") {
        return {
          desconto: 0,
          aplicavel: false,
          motivo: "Este cupom vale apenas no pagamento com cartão.",
        };
      }
      desconto = descontoSobre(cupom, subElegivelCheio);
      break;

    case "SO_PIX":
      if (metodo === "CARTAO") {
        return {
          desconto: 0,
          aplicavel: false,
          motivo: "Este cupom vale apenas no pagamento com Pix.",
        };
      }
      desconto = descontoSobre(cupom, subElegivelPix);
      break;

    case "AMBOS_ACUMULA":
      desconto =
        metodo === "CARTAO"
          ? descontoSobre(cupom, subElegivelCheio)
          : descontoSobre(cupom, subElegivelPix);
      break;

    case "AMBOS_VENCE_MAIOR":
      if (metodo === "CARTAO") {
        desconto = descontoSobre(cupom, subElegivelCheio);
      } else {
        // No Pix, o cliente leva o MAIOR entre o desconto Pix e o cupom (não soma):
        // compara o preço já com Pix vs o preço cheio menos o cupom, e fica com o
        // menor preço. O cupom só "vence" se for melhor que o desconto Pix.
        const finalPix = Math.min(
          subElegivelPix,
          subElegivelCheio - descontoSobre(cupom, subElegivelCheio),
        );
        desconto = subElegivelPix - finalPix;
      }
      break;
  }

  // 5. Clamp: nunca negativo nem maior que o subtotal elegível do método.
  const tetoMetodo = metodo === "PIX" ? subElegivelPix : subElegivelCheio;
  desconto = round2(Math.max(0, Math.min(desconto, tetoMetodo)));

  return { desconto, aplicavel: desconto > 0 };
}
