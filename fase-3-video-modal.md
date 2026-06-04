# FASE 3 — VideoModal (vídeo + painel de compra)

## Contexto

Quando o usuário clica no play do `ProductCardVideo`, abre um modal grande mostrando o vídeo em formato 9:16 e os botões de compra ao lado (desktop) ou abaixo (mobile, bottom sheet expansível).

O comportamento difere drasticamente entre desktop e mobile, e isso é proposital:

- **Desktop**: vídeo à esquerda em 9:16 ocupando ~360-420px de largura, painel branco de compra à direita
- **Mobile**: vídeo ocupa ~70-80% da altura, painel desliza por baixo como bottom sheet com handle, pode ser expandido pra cima

## Tarefas

### 1. Criar `components/product/VideoEmbed.tsx`

Componente puro de player. Recebe URL e plataforma, retorna iframe correto.

```ts
interface VideoEmbedProps {
  url: string;
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK';
  autoplay?: boolean;
}
```

**Comportamento:**

- **YouTube**: iframe direto, `https://www.youtube.com/embed/{id}?autoplay=1&mute=0&playsinline=1&rel=0`
- **Instagram**: usar `<blockquote class="instagram-media">` com o embed.js do Instagram (`https://www.instagram.com/embed.js`). Carregar o script só uma vez, idempotente
- **TikTok**: usar `<blockquote class="tiktok-embed">` com `https://www.tiktok.com/embed.js`. Mesmo padrão

Pra Instagram e TikTok, o player vai vir pré-formatado pela plataforma — não tente customizar muito. Apenas garanta:
- Aspect ratio respeitado (9:16)
- Sem overflow no container
- Loading state enquanto o embed inicializa

Usar `useEffect` pra injetar/limpar os scripts de embed.

### 2. Criar `components/product/VideoModal.tsx`

Client component. Usa `useEffect` pra capturar ESC, body scroll lock, click outside.

```ts
interface VideoModalProps {
  product: Product;
  onClose: () => void;
}
```

**Estrutura DESKTOP (≥768px):**

Fixed inset-0, `bg-[#070f1e]/96 backdrop-blur-sm`, z-index 50.

Botão close no canto superior direito: 40px círculo, `bg-white/10 border border-white/20 backdrop-blur`, ícone X branco. aria-label "Fechar".

Container central: `grid grid-cols-[auto_380px] gap-8 max-w-5xl items-center`.

**Coluna esquerda - vídeo:**
- Container 360px de largura, aspect-[9/16]
- `rounded-2xl overflow-hidden bg-gradient navy fallback`
- `box-shadow: 0 20px 60px rgba(0,0,0,0.5)`
- Dentro, o `<VideoEmbed>` autoplay=true
- Badge no top-left: pílula escura com ícone+nome da plataforma (ex: "YouTube Shorts")

**Coluna direita - painel:**
- `bg-white rounded-2xl p-8 shadow-2xl`
- Conteúdo:
  1. Eyebrow: "{Categoria} · {Tipo}" (uppercase tracking, 11px cinza)
  2. H2: nome do produto, font Signika 800, 28px, navy, line-height 1.1
  3. Descrição curta: 14px cinza-escuro, line-height 1.6 (2-3 linhas máx)
  4. Bloco de preço dentro de card cinza-claro (`bg-[#f7f5f4] rounded-xl p-5`):
     - Preço grande (32px peso 700 navy, letter-spacing -1px)
     - Parcelas (13px cinza)
     - Chip Pix maior que no card: padding 7px 12px, com texto "economize R$ XX" calculado
  5. **Trust bar verde**: `bg-[#eaf3de] text-[#3b6d11] rounded-lg p-3.5` com ícone Truck e texto "**Frete grátis** em pedidos acima de R$ 500"
  6. Botões:
     - "Comprar agora" primário rosa, **maior** que no card (padding 16px, 15px font-size, sombra rosa)
     - "Quero comprar mais" outline navy
  7. Link sutil: "Ver página completa do produto" com ícone ExternalLink (vai pra `/loja/{slug}`)

**Estrutura MOBILE (< 768px):**

Fixed inset-0, fundo escuro.

Container em **coluna**:
- Topo: vídeo full-width, aspect [9/16] mas com max-height 70vh
- Bottom sheet abaixo: branco, `rounded-t-3xl`, slide up animado, contém handle (barrinha cinza centralizada no topo, 36px largura, 4px altura)

**Bottom sheet em 2 modos:**

- **Modo compacto** (padrão ao abrir):
  - Mostra apenas: preço grande + chip Pix + botão "Comprar agora" full-width
  - Handle visível em cima sugerindo "puxe pra mais"
- **Modo expandido** (após puxar handle pra cima ou tocar nele):
  - Expande pra mostrar tudo: descrição, trust bar, "Quero comprar mais", link pra PDP
  - Handle vira "toque pra recolher"

Implementar com `useState` simples (`expanded: boolean`) e `transition-all duration-300`. **NÃO** implemente arrasto/gesture nesta fase — apenas toque no handle pra alternar. Gesture vai pra fase de polimento depois.

Botão close mobile: canto superior direito da tela, sobre o vídeo, mesmo estilo (40px círculo escuro).

### 3. Comportamentos compartilhados

- **ESC**: fecha modal (`useEffect` com keydown listener)
- **Click no fundo escuro**: fecha modal (apenas desktop — em mobile o fundo todo está ocupado)
- **Body scroll lock**: ao abrir modal, `document.body.style.overflow = 'hidden'`. Restaurar ao fechar.
- **Foco**: ao abrir, focar no botão close (acessibilidade). Trap de foco fica pra futuro
- **aria-modal**: `role="dialog" aria-modal="true" aria-labelledby="modal-title-{id}"`

### 4. Conectar com o `ProductGridClient`

No arquivo da fase anterior `components/home/ProductGridClient.tsx`, substituir o placeholder pelo VideoModal real:

```tsx
{activeProduct && (
  <VideoModal product={activeProduct} onClose={() => setActiveProduct(null)} />
)}
```

### 5. Botões "Comprar agora" e "Quero comprar mais"

Por enquanto, ambos os botões fazem ações mockadas:

- **Comprar agora**: `console.log('TODO: ir pro checkout direto com', product.id)` + toast "Indo pro checkout..." (use lib de toast simples, pode ser sonner se já estiver instalado, ou um componente <Toast/> próprio dummy)
- **Quero comprar mais**: `console.log('TODO: adicionar ao carrinho', product.id)` + toast "Adicionado ao carrinho!" + fechar modal

O carrinho real vai ser implementado na Fase 4. Por ora, deixe `TODO:` comentado no código.

## Critérios de aceitação

1. Desktop 1440px: modal centralizado, vídeo + painel lado a lado, ESC fecha
2. Mobile 375px: vídeo ocupa topo, bottom sheet compacto mostra preço+CTA, toque no handle expande
3. Vídeo YouTube Shorts toca automaticamente ao abrir modal
4. Vídeo Instagram Reels carrega via embed oficial
5. Vídeo TikTok carrega via embed oficial
6. Body não scrolla atrás do modal
7. Sem console errors
8. Performance: o modal NÃO deve recarregar a página inteira quando abre/fecha (state cliente apenas)
9. Acessibilidade: ESC funciona, role=dialog presente

## Notas técnicas

- Os embeds do Instagram e TikTok podem demorar 1-2s pra renderizar. Mostre um spinner discreto enquanto carregam. Use `setTimeout` ou `MutationObserver` se necessário pra detectar quando o iframe filho aparece
- Em mobile, o iframe do Instagram tende a ser mais alto que o vídeo em si (tem header e footer da plataforma). Considere isso no layout — pode ser que precise overflow-y-scroll no container do vídeo em mobile, ou um wrapper mais alto que 9:16
- O modal usa portal? Por enquanto NÃO use portal — renderize inline mesmo. Se houver conflito de z-index com a Navbar sticky, ajustamos depois

## Antes de começar

Confirme comigo:
1. Existe biblioteca de toast no projeto? (sonner, react-hot-toast?). Se não, ok criar um Toast bem simples próprio
2. A Navbar usa qual z-index? Quero garantir que o modal fica acima (vou usar z-50)

Depois disso, plano de execução, aguarde minha aprovação.
