import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  produtoId: string;
  nome: string;
  slug: string;
  precoPix: number;
  precoCheio: number;
  thumbnail: string | null;
  estoque: number; // teto de quantidade
  quantidade: number;
};

type CartState = {
  items: CartItem[];
  /** Adiciona (ou soma) respeitando o estoque do produto. */
  addItem: (item: Omit<CartItem, "quantidade">, qtd: number) => void;
  removeItem: (produtoId: string) => void;
  updateQty: (produtoId: string, qtd: number) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item, qtd) =>
        set((s) => {
          const teto = Math.max(0, item.estoque);
          if (teto === 0 || qtd <= 0) return s;
          const existente = s.items.find((i) => i.produtoId === item.produtoId);
          if (existente) {
            const novaQtd = Math.min(existente.quantidade + qtd, teto);
            return {
              items: s.items.map((i) =>
                i.produtoId === item.produtoId
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
      removeItem: (produtoId) =>
        set((s) => ({
          items: s.items.filter((i) => i.produtoId !== produtoId),
        })),
      updateQty: (produtoId, qtd) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.produtoId === produtoId
              ? { ...i, quantidade: Math.max(1, Math.min(qtd, i.estoque)) }
              : i,
          ),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "guppy-cart" },
  ),
);

// ── Selectors derivados ──────────────────────────────────────
// Total de itens = soma das quantidades. Hoje "peixe" == unidade, então o total
// de peixes (regra das 10) usa a mesma soma; separamos por clareza semântica.
export const selectTotalItens = (s: CartState) =>
  s.items.reduce((acc, i) => acc + i.quantidade, 0);

export const selectTotalPeixes = selectTotalItens;

export const selectSubtotalPix = (s: CartState) =>
  s.items.reduce((acc, i) => acc + i.precoPix * i.quantidade, 0);

export const selectSubtotalCheio = (s: CartState) =>
  s.items.reduce((acc, i) => acc + i.precoCheio * i.quantidade, 0);
