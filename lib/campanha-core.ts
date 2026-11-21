// Regra PURA do preço promocional de campanha (sem I/O). Compartilhada entre a
// camada server (lib/campanha.ts) e o client (ProductDetail recalcula por variante)
// para NÃO duplicar a fórmula. A campanha entra POR FORA de lib/precos (que é puro
// e não conhece cupom).

const round2 = (n: number) => Math.round(n * 100) / 100;

// Descritor do cupom de campanha vencedor para um produto.
export type CampanhaInfo = {
  cupomId: string;
  codigo: string;
  tipoValor: "PERCENTUAL" | "VALOR_FIXO" | "PRECO_FIXO";
  valor: number;
  precoUnico: boolean; // precoUnicoNaCampanha: Pix = cartão durante a campanha
  soPix: boolean; // modoAplicacao SO_PIX: só o Pix baixa, o cartão fica no cheio
};

// Campanha já resolvida + preço promocional calculado (o que o card/preço exibe).
export type CampanhaProduto = CampanhaInfo & {
  precoPromoCheio: number;
  precoPromoPix: number;
  descontoPercent: number; // p/ o badge "-X% OFF"
};

/**
 * Aplica a campanha sobre um preço cheio (cartão à vista). Com `precoUnico`, o Pix
 * fica igual ao cartão (o desconto Pix do produto some). Sem ele, o Pix mantém a
 * vantagem por cima do preço promocional. Valor fixo: subtrai e faz clamp ≥ 0.
 * Preço fixo: o valor VIRA o preço, e nunca encarece um produto que já custava
 * menos que ele (é promoção, não tabela de preço).
 * Com `soPix`, o preço promocional vale só no Pix e o cartão segue no cheio.
 */
export function precoComCampanha(
  precoCheio: number,
  descontoPixPercentProduto: number,
  c: Pick<CampanhaInfo, "tipoValor" | "valor" | "precoUnico" | "soPix">,
): { precoPromoCheio: number; precoPromoPix: number; descontoPercent: number } {
  const promoCheio =
    c.tipoValor === "PERCENTUAL"
      ? precoCheio * (1 - c.valor / 100)
      : c.tipoValor === "PRECO_FIXO"
        ? Math.min(precoCheio, c.valor)
        : Math.max(0, precoCheio - c.valor);
  if (c.soPix) {
    const pixAtual = precoCheio * (1 - descontoPixPercentProduto / 100);
    const precoPromoPix = round2(Math.max(0, Math.min(pixAtual, promoCheio)));
    return {
      precoPromoCheio: round2(precoCheio),
      precoPromoPix,
      descontoPercent:
        precoCheio > 0
          ? Math.round(((precoCheio - precoPromoPix) / precoCheio) * 100)
          : 0,
    };
  }
  const promoPix = c.precoUnico
    ? promoCheio
    : promoCheio * (1 - descontoPixPercentProduto / 100);
  const precoPromoCheio = round2(Math.max(0, promoCheio));
  const precoPromoPix = round2(Math.max(0, promoPix));
  const descontoPercent =
    precoCheio > 0
      ? Math.round(((precoCheio - precoPromoCheio) / precoCheio) * 100)
      : 0;
  return { precoPromoCheio, precoPromoPix, descontoPercent };
}
