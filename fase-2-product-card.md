# FASE 2 — ProductCard vertical 9:16 (vídeo-first)

## Contexto

A loja é majoritariamente vídeo. O produto (peixes vivos) só vende mostrando movimento, cores reagindo à luz, nadadeiras. Os vídeos vêm de YouTube Shorts (principal), Reels e TikTok.

Vamos substituir o `ProductCard.tsx` atual por uma versão vertical 9:16 estilo Reels, com play central, info de plataforma e duração na thumb.

A foto estática continua existindo no schema (pra galeria da PDP, OG image, fallback), mas o card mostra a **thumbnail do vídeo** com play visível.

## Tarefas

### 1. Estender `lib/mock-data.ts`

Adicionar campos a cada produto do `PRODUCTS_MOCK`:

```ts
videoUrl: string;              // URL do Shorts/Reels/TikTok
videoPlatform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK';
videoDurationSeconds: number;  // ex: 34
videoThumbnailUrl: string;     // URL da thumb (pode ser derivada ou customizada)
productType: 'MACHO' | 'FEMEA' | 'CASAL';
isNew?: boolean;
discountPercent?: number;      // se tiver promoção
originalPrice?: number;        // preço cheio antes do desconto
inStock: boolean;
```

Preencha os 4 produtos existentes (Yellow Tiger, Dragon Blue, Full Black, Red Dragon) com dados plausíveis. Pode usar vídeos reais do canal do Manassés se conhecer, senão use URLs de exemplo (placeholders válidos):

- YouTube Shorts: `https://www.youtube.com/shorts/dQw4w9WgXcQ`
- Reels: `https://www.instagram.com/reel/ABC123/`
- TikTok: `https://www.tiktok.com/@user/video/1234567890`

Pra `videoThumbnailUrl`:
- YouTube: `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`
- Instagram/TikTok: use por enquanto as fotos locais que já existem em `/assets/home/`

Garanta que pelo menos 1 produto tenha `inStock: false` (pra testar estado esgotado), 1 tenha `discountPercent: 15` (estado promoção), 1 tenha `isNew: true` (badge NOVO).

### 2. Criar `lib/video.ts`

Helpers puros (sem React):

```ts
export type VideoPlatform = 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK';

export function detectPlatform(url: string): VideoPlatform | null
export function extractVideoId(url: string, platform: VideoPlatform): string | null
export function getYouTubeThumbnails(videoId: string): { default, medium, high, maxres, frame1, frame2, frame3 }
export function getEmbedUrl(url: string, platform: VideoPlatform, autoplay?: boolean): string
export function formatDuration(seconds: number): string  // 34 → "0:34", 90 → "1:30"
```

Cobertura mínima:
- YouTube: aceita `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`
- Instagram: aceita `instagram.com/reel/` e `instagram.com/p/`
- TikTok: aceita `tiktok.com/@user/video/` e `vm.tiktok.com/`

Pra YouTube, retorne URLs no formato `https://img.youtube.com/vi/{id}/hqdefault.jpg`, `maxresdefault.jpg`, `1.jpg`, `2.jpg`, `3.jpg`.

### 3. Criar `components/product/ProductCardVideo.tsx`

Client component (usa state pra abrir modal).

**Props:**
```ts
interface ProductCardVideoProps {
  product: Product;  // o tipo expandido do mock-data
  onPlayClick: (product: Product) => void;  // callback que abre modal
}
```

**Estrutura visual:**

Container: `bg-white rounded-2xl overflow-hidden border border-[#ece7e8] shadow-sm hover:shadow-md transition-all`.

**Bloco da thumb (parte superior):**

Wrapper relative com `aspect-[9/16]` overflow-hidden. Background gradient navy fallback caso a imagem não carregue.

`<Image>` do next/image cobrindo o bloco (fill, object-cover) com `src={product.videoThumbnailUrl}`, alt descritivo.

**Camadas sobre a thumb (z-index incremental):**

1. **Top-left**: badges contextuais empilhados
   - Se `isNew`: badge rosa "NOVO" (10px, peso 700, tracking 1.5px, padding 5px 10px, border-radius 4px)
   - Se `discountPercent`: badge âmbar "-XX%" (mesmo estilo, cor #4a2e00 no texto)

2. **Top-right**: dois ícones em pílulas escuras translúcidas (32px círculo, `bg-black/50 backdrop-blur-sm`):
   - Ícone da plataforma (Youtube vermelho / Instagram branco / Tiktok branco) — usar lucide-react: `Youtube`, `Instagram`, `Music` (TikTok não tem ícone direto, use `Music` ou `Music2`)
   - Coração de favoritar (`Heart` em branco). Botão com aria-label "Favoritar". Por enquanto sem funcionalidade, só visual

3. **Centro**: botão play
   - 68px círculo branco semi-opaco (95%)
   - Sombra forte preta difusa
   - Ícone `Play` lucide-react 32px, navy, com margin-left 4px pra centralizar visualmente
   - `onClick={() => onPlayClick(product)}`
   - aria-label "Assistir vídeo de {product.name}"
   - **Em mobile, área tocável mínima 60×60px** (o botão já tem 68px, ok)

4. **Bottom-left**: pílula com duração
   - `bg-black/70 backdrop-blur-sm text-white px-2.5 py-1 rounded text-xs font-semibold`
   - Ícone `Clock` 12px + formatDuration(videoDurationSeconds)

5. **Bottom-right**: pílula com tipo (`MACHO` / `FEMEA` / `CASAL`)
   - Mesmo estilo da duração mas com texto puro, sem ícone, 10px

**Se `!inStock` (esgotado):**
- Aplicar `filter: grayscale(50%)` na thumb
- Overlay diagonal navy 20%
- **NÃO renderizar o botão de play** (não há call to action de vídeo pra produto indisponível — a melhor decisão UX é remover o convite)
- Selo "ESGOTADO" diagonal centralizado: rotate(-6deg), `bg-primary/95 text-white px-7 py-2.5 text-sm tracking-widest border-2 border-white font-bold`
- Manter ícone da plataforma e duração (info contextual)

**Bloco de info (parte inferior do card):**

Padding 16px 18px 18px. Conteúdo:

1. Eyebrow categoria: 10px uppercase tracking-widest cinza, ex: "LINHAGEM EXCLUSIVA"
2. Nome do produto: h3, 16px peso 600 navy, line-height 1.3
3. Preço:
   - Se tem `originalPrice`: preço atual grande (24px peso 700 navy) + preço riscado pequeno (14px cinza line-through)
   - Senão: só preço atual
   - Se esgotado: preço com opacity 0.6
4. Parcelas: "ou 3x de R$ XXX,XX sem juros" — 12px cinza
5. Chip Pix (só se em estoque):
   - `inline-flex items-center gap-1.5 bg-[#eaf3de] text-[#3b6d11] px-2.5 py-1 rounded-md text-xs font-semibold`
   - Pílula "PIX" interna verde escura (`bg-[#639922] text-white px-1.5 py-0.5 rounded text-[10px]`)
   - Valor com Pix (90% do preço cheio)
   - "−10%" opacidade 0.7
6. Texto "temporariamente indisponível" (só se esgotado, no lugar do chip Pix)

**Botões (sempre full-width):**

Se em estoque:
- **Primário "Comprar agora"** + ícone arrow-right. `bg-secondary text-white py-3 rounded-full text-sm font-semibold`, box-shadow rosa sutil
- Gap 8px
- **Secundário "Quero comprar mais"** + ícone ShoppingBagPlus (use `ShoppingBag` se o Plus não existir). `bg-transparent border border-primary text-primary py-2.5 rounded-full text-xs font-semibold`

Se esgotado:
- Só "Avisar quando chegar" outline navy mais grosso (border-2), com ícone `Bell`

### 4. Atualizar `components/home/ProductGrid.tsx`

Passar a usar `ProductCardVideo` em vez do antigo `ProductCard`. Grid mobile-first:
- Mobile (default): `grid-cols-2 gap-3`
- Tablet (md): `grid-cols-3 gap-4`
- Desktop (lg): `grid-cols-3 gap-5`

(Sim, 3 colunas no desktop também — cards verticais 9:16 ficam grandes demais em 4 colunas e perdem presença.)

O `ProductGrid` precisa receber e propagar o callback `onPlayClick` pros cards. Como ele provavelmente é server component, transforme em client OU crie um wrapper client que gerencia o state do modal:

```tsx
// components/home/ProductGridClient.tsx (NEW)
'use client'
import { useState } from 'react'
import { VideoModal } from '@/components/product/VideoModal'  // criamos na próxima fase
import { ProductCardVideo } from '@/components/product/ProductCardVideo'

export function ProductGridClient({ products }: { products: Product[] }) {
  const [activeProduct, setActiveProduct] = useState<Product | null>(null)
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
        {products.map(p => (
          <ProductCardVideo key={p.id} product={p} onPlayClick={setActiveProduct} />
        ))}
      </div>
      {activeProduct && (
        <VideoModal product={activeProduct} onClose={() => setActiveProduct(null)} />
      )}
    </>
  )
}
```

(O `VideoModal` ainda não existe — vou criá-lo na Fase 3. Por enquanto, deixe um placeholder simples ou um TODO comentado.)

### 5. Atualizar `app/(public)/page.tsx`

Onde hoje tem o `ProductGrid` original, trocar pelo `ProductGridClient`.

## Critérios de aceitação

1. Mobile 375px: 2 cards por linha, todos os elementos visíveis e legíveis, botões com altura ≥44px
2. Desktop 1440px: 3 cards por linha, espaçamento confortável
3. Estado esgotado: visualmente diferente, sem play, com botão "Avisar quando chegar"
4. Estado promoção: badge âmbar, preço riscado
5. Estado novo: badge rosa
6. Clicar no play console.loga o produto (já que o modal não está pronto). Console.log temporário tipo `console.log('TODO: abrir modal para', product.name)`
7. Coração de favoritar visível mas sem ação (preparado pra fase futura)
8. Sem warnings de Next/Image (todas imagens com width/height ou fill+sizes)
9. Sem hydration mismatch

## Antes de começar

Confirme comigo:
1. Os PRODUCTS_MOCK atuais têm fotos locais já em `/public/assets/home/`? Quais?
2. Existe Product type centralizado (ex: `lib/types.ts`)? Ou inferimos do array do mock?

Depois disso, plano de execução, e aguarde minha aprovação.
