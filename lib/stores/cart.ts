import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";

export type CartItem = {
  produtoId: string;
  // Chave do item: variante (peixe) ou id do produto (não-peixe). Mesmo produto
  // em composições diferentes = linhas distintas.
  variantId: string;
  composicao: TipoComposicao | null;
  composicaoLabel: string | null;
  nome: string;
  slug: string;
  precoPix: number;
  precoCheio: number;
  qtdPeixes: number; // alimenta a regra dos >10; 0 em não-peixe
  thumbnail: string | null;
  estoque: number; // teto de quantidade (da variante)
  quantidade: number;
};

type CartState = {
  items: CartItem[];
  /** Código de cupom aplicado (normalizado). Só o código persiste; o desconto é
   * sempre recalculado no servidor (validarCupom no carrinho, checkout no fechamento). */
  cupom: string | null;
  /** Adiciona (ou soma) respeitando o estoque da variante. Chave = variantId. */
  addItem: (item: Omit<CartItem, "quantidade">, qtd: number) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, qtd: number) => void;
  setCupom: (codigo: string) => void;
  clearCupom: () => void;
  clear: () => void;
};

// Composições válidas (enum do banco) — usado pra normalizar itens antigos.
const COMPOSICOES_VALIDAS: TipoComposicao[] = [
  "TRIO",
  "CASAL",
  "MACHO",
  "FEMEA",
  "LOTE",
];

const numSeguro = (v: unknown, fallback: number) =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;

/**
 * Normaliza um item persistido (shape pode ser antigo/incompleto) para o CartItem
 * atual. Preenche campos faltantes com valores seguros (nunca NaN/undefined) e
 * devolve null se o item for irrecuperável (sem produtoId) — o migrate o descarta.
 */
function normalizarItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== "object") return null;
  const it = raw as Record<string, unknown>;
  const produtoId = typeof it.produtoId === "string" ? it.produtoId : null;
  if (!produtoId) return null; // sem id do produto não dá pra reidratar

  // variantId é a chave de identidade (remover/atualizar/React key). Itens antigos
  // podem não ter — cai no produtoId (1 linha por produto, suficiente p/ reparo).
  const variantId =
    typeof it.variantId === "string" && it.variantId ? it.variantId : produtoId;
  const composicao = COMPOSICOES_VALIDAS.includes(it.composicao as TipoComposicao)
    ? (it.composicao as TipoComposicao)
    : null;
  const quantidade = Math.max(1, Math.round(numSeguro(it.quantidade, 1)));

  return {
    produtoId,
    variantId,
    composicao,
    composicaoLabel:
      typeof it.composicaoLabel === "string" ? it.composicaoLabel : null,
    nome: typeof it.nome === "string" ? it.nome : "Produto",
    slug: typeof it.slug === "string" ? it.slug : "",
    precoPix: numSeguro(it.precoPix, 0),
    precoCheio: numSeguro(it.precoCheio, 0),
    // Sem peixes-por-unidade no item antigo: assume 1 (nunca NaN). Itens novos já
    // gravam o valor real da variante (ProductDetail/VideoFeed).
    qtdPeixes: numSeguro(it.qtdPeixes, 1),
    thumbnail: typeof it.thumbnail === "string" ? it.thumbnail : null,
    estoque: Math.max(quantidade, Math.round(numSeguro(it.estoque, quantidade))),
    quantidade,
  };
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      cupom: null,
      addItem: (item, qtd) =>
        set((s) => {
          const teto = Math.max(0, item.estoque);
          if (teto === 0 || qtd <= 0) return s;
          const existente = s.items.find((i) => i.variantId === item.variantId);
          if (existente) {
            const novaQtd = Math.min(existente.quantidade + qtd, teto);
            return {
              items: s.items.map((i) =>
                i.variantId === item.variantId
                  ? // Atualiza preço/thumb/estoque (podem ter mudado) + qtd.
                    { ...i, ...item, quantidade: novaQtd }
                  : i,
              ),
            };
          }
          return {
            items: [...s.items, { ...item, quantidade: Math.min(qtd, teto) }],
          };
        }),
      removeItem: (variantId) =>
        set((s) => ({
          items: s.items.filter((i) => i.variantId !== variantId),
        })),
      updateQty: (variantId, qtd) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.variantId === variantId
              ? { ...i, quantidade: Math.max(1, Math.min(qtd, i.estoque)) }
              : i,
          ),
        })),
      setCupom: (codigo) =>
        set({ cupom: (codigo ?? "").trim().toUpperCase() || null }),
      clearCupom: () => set({ cupom: null }),
      clear: () => set({ items: [], cupom: null }),
    }),
    {
      name: "guppy-cart",
      version: 1,
      // Repara carrinhos salvos com shape antigo (pré qtdPeixes/variantId/
      // composicao): normaliza cada item e descarta os irrecuperáveis, evitando
      // NaN/cupom travado/lixeira morta após o deploy. Sem versão anterior, o
      // estado vinha sem `version` (tratado como 0) e nunca era normalizado.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as { items?: unknown[]; cupom?: unknown };
        const items = Array.isArray(p.items)
          ? p.items
              .map(normalizarItem)
              .filter((x): x is CartItem => x !== null)
          : [];
        const cupom = typeof p.cupom === "string" ? p.cupom : null;
        return { items, cupom };
      },
    },
  ),
);

// ── Selectors derivados (null-safe: nunca propagam NaN de item com shape antigo)
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const selectTotalItens = (s: CartState) =>
  s.items.reduce((acc, i) => acc + n(i.quantidade), 0);

// Total de PEIXES (regra das 10) = Σ(qtdPeixes × quantidade). Sem qtdPeixes válido
// (item antigo), assume 1 por unidade — nunca NaN. Não-peixe (qtdPeixes 0) soma 0.
export const selectTotalPeixes = (s: CartState) =>
  s.items.reduce((acc, i) => {
    const porUnidade = Number.isFinite(Number(i.qtdPeixes))
      ? Number(i.qtdPeixes)
      : 1;
    return acc + porUnidade * n(i.quantidade);
  }, 0);

export const selectSubtotalPix = (s: CartState) =>
  s.items.reduce((acc, i) => acc + n(i.precoPix) * n(i.quantidade), 0);

export const selectSubtotalCheio = (s: CartState) =>
  s.items.reduce((acc, i) => acc + n(i.precoCheio) * n(i.quantidade), 0);
