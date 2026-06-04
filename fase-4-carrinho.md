# FASE 4 — Carrinho com Zustand + localStorage

## Contexto

Os botões "Comprar agora" e "Quero comprar mais" precisam funcionar de verdade. Como ainda não temos Prisma ligado nem auth nem checkout, o carrinho fica **100% client-side em localStorage**, gerenciado por Zustand.

Quando o Prisma e auth entrarem (próximas fases do projeto), migramos pra carrinho persistido no banco vinculado ao usuário. Por agora, localStorage é mais que suficiente pra desenvolvimento e testes.

## Tarefas

### 1. Instalar Zustand

```bash
npm install zustand
```

### 2. Criar `lib/cart.ts` — store do carrinho

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartItem {
  productId: string
  name: string
  price: number          // preço unitário aplicado
  thumbnailUrl: string
  quantity: number
  slug: string           // pra link na PDP do carrinho
}

interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, qty: number) => void
  clear: () => void
  // Selectors (mas como zustand store, viram getters via getState)
  getTotalItems: () => number
  getTotalPrice: () => number
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item, qty = 1) => set(state => {
        const existing = state.items.find(i => i.productId === item.productId)
        if (existing) {
          return {
            items: state.items.map(i =>
              i.productId === item.productId
                ? { ...i, quantity: i.quantity + qty }
                : i
            )
          }
        }
        return { items: [...state.items, { ...item, quantity: qty }] }
      }),
      removeItem: (productId) => set(state => ({
        items: state.items.filter(i => i.productId !== productId)
      })),
      updateQuantity: (productId, qty) => set(state => {
        if (qty <= 0) return { items: state.items.filter(i => i.productId !== productId) }
        return {
          items: state.items.map(i =>
            i.productId === productId ? { ...i, quantity: qty } : i
          )
        }
      }),
      clear: () => set({ items: [] }),
      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      getTotalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: 'guppy-cart',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

### 3. Componente de Toast

Se não existe lib de toast instalada, criar `components/ui/toast.tsx`:

```tsx
'use client'
import { create } from 'zustand'
import { Check, X } from 'lucide-react'
import { useEffect } from 'react'

interface ToastState {
  message: string | null
  show: (msg: string, durationMs?: number) => void
  hide: () => void
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (msg, ms = 2500) => {
    set({ message: msg })
    setTimeout(() => set({ message: null }), ms)
  },
  hide: () => set({ message: null }),
}))

export function ToastContainer() {
  const { message, hide } = useToast()
  if (!message) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-primary text-white px-5 py-3 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-bottom-4">
      <Check className="w-4 h-4 text-accent" />
      {message}
      <button onClick={hide} aria-label="Fechar notificação" className="ml-2 opacity-70 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
```

Adicionar `<ToastContainer />` no layout root ou no (public) layout.

### 4. Conectar "Quero comprar mais" do `ProductCardVideo`

Substituir o `console.log` da Fase 2 por:

```tsx
const addItem = useCart(s => s.addItem)
const showToast = useToast(s => s.show)

const handleAddToCart = () => {
  addItem({
    productId: product.id,
    name: product.name,
    price: product.price,
    thumbnailUrl: product.videoThumbnailUrl,
    slug: product.slug,
  })
  showToast(`${product.name} adicionado ao carrinho`)
}
```

### 5. Conectar "Quero comprar mais" do `VideoModal`

Mesmo handler, mas além de adicionar e mostrar toast, **fechar o modal** após adicionar (chamando `onClose()`).

### 6. Conectar "Comprar agora"

Comportamento:
- Adicionar o item ao carrinho (mesmo `addItem`)
- Navegar pra `/checkout` (que ainda não existe — vai dar 404, ok por agora)
- Mostrar toast "Indo pro checkout..."

Use `useRouter` do `next/navigation`:

```tsx
const router = useRouter()
const handleBuyNow = () => {
  addItem({ ...item, productId: product.id, name: product.name, /* ... */ })
  showToast('Indo pro checkout...')
  router.push('/checkout')
}
```

### 7. Atualizar contador do carrinho na Navbar

Onde a Navbar mostra o badge "0" ao lado do ícone do carrinho, conectar com:

```tsx
'use client'
const totalItems = useCart(s => s.items.reduce((sum, i) => sum + i.quantity, 0))
// ... renderiza o badge com {totalItems}
```

**Cuidado de hydration**: como o estado vem do localStorage e o server-render não tem acesso a ele, pode dar mismatch. Solução: usar `useEffect` pra montar o contador só após mount, ou usar a técnica do `_hasHydrated` do zustand persist:

```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => { setMounted(true) }, [])
const items = useCart(s => s.items)
const total = mounted ? items.reduce((sum, i) => sum + i.quantity, 0) : 0
```

### 8. Criar página rascunho `/carrinho`

`app/(public)/carrinho/page.tsx` simples mas funcional, mostra os itens do carrinho:

- Lista de itens com thumb, nome, preço unitário, quantidade (com botões -/+), preço total da linha, botão remover
- Subtotal no rodapé
- Botão "Finalizar compra" que leva pra `/checkout` (ainda não existe)
- Botão "Continuar comprando" que leva pra `/loja`
- Estado vazio: mensagem amigável com botão pra catálogo

Mobile-first, simples mas elegante. Não é a prioridade visual do projeto, mas precisa funcionar.

## Critérios de aceitação

1. Clicar "Quero comprar mais" no card adiciona item, mostra toast, contador da Navbar incrementa
2. Recarregar a página mantém os itens (localStorage funcionando)
3. Clicar "Comprar agora" adiciona + redireciona pra /checkout (que dá 404, mas o redirect acontece)
4. Página /carrinho lista itens corretamente, permite alterar quantidade e remover
5. Sem hydration mismatch no contador da navbar
6. Toast aparece e some sozinho
7. Mobile: tudo funciona, botões tocáveis

## Notas

- Não complicar com edge cases (ex: estoque máximo, validação de quantidade). Pra esses casos, deixe TODO comentado.
- Não fazer ainda: cálculo de frete (precisa Melhor Envio), aplicação de cupom, login obrigatório, etc.

## Antes de começar

Confirme comigo:
1. Já existe `lib/format.ts` ou similar pra formatar moeda? Se não, ok criar inline mesmo (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`)

Depois disso, plano de execução, aguarde minha aprovação.
