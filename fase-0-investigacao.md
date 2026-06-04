# FASE 0 — Investigação e preparação

## Contexto

Estamos refatorando a home do projeto guppydelinhagem.com.br (Next.js 16 + React 19 + Tailwind v4) com foco em três mudanças visuais críticas:

1. **Hero novo** — mais elegante, com prova social, faixa de 4 diferenciais integrada
2. **ProductCard vertical 9:16** — vídeo como protagonista (YouTube Shorts/Reels/TikTok), foto vira secundária
3. **VideoModal** — clicar no play abre modal com vídeo grande + painel de compra

O projeto é majoritariamente mobile (>80% dos acessos provavelmente), então TODA implementação precisa ser mobile-first.

## Sua tarefa nesta fase

NÃO modifique nenhum arquivo. Apenas investigue e me reporte:

### 1. O "N" preto na lateral

Em todas as seções da home existe um círculo preto com a letra "N" no canto esquerdo da viewport. Pode ser:
- Algum widget de acessibilidade
- Botão de scroll-to-top
- Resíduo de dev tools (Next.js dev indicator?)
- Componente Newsletter ou Notification minimizado
- Algo do Tailwind v4 ou shadcn

Investigue:
- Procure por `useState`, `position: fixed`, `bottom-`, `left-` em `app/layout.tsx`, `app/(public)/layout.tsx`, e em todos os componentes em `components/site/`
- Procure por imports de bibliotecas que adicionam UI flutuante
- Veja se é o Next.js dev indicator (em desenvolvimento aparece um botão "N" no canto)

Me responda:
- O que é o "N"
- Onde está no código (arquivo:linha)
- Como remover (ou ele só aparece em dev e some em produção?)

### 2. Estrutura atual da home

Liste em formato de árvore tudo que `app/(public)/page.tsx` renderiza, na ordem em que aparece na tela. Por exemplo:

```
1. Hero (componente ou inline?)
2. Categorias (componente: CategoryCard × 3)
3. Mais Procurados (ProductGrid)
...
```

Pra cada seção, me diga:
- É componente reutilizável ou JSX inline na page?
- De onde vêm os dados (mock-data, hardcoded inline, Prisma)?

### 3. Estado do `components/product/ProductCard.tsx`

Me mostre o conteúdo completo do arquivo. Quero ver como o card atual está implementado pra saber o que vou substituir.

### 4. Estado do `lib/mock-data.ts`

Me mostre o conteúdo completo. Quero ver a estrutura atual dos PRODUCTS_MOCK pra planejar os novos campos (videoUrl, videoPlatform, videoDuration, productType).

### 5. Tailwind v4 — confirmação dos tokens

Confirme:
- Cores `primary`, `secondary`, `accent`, `bg-alt` estão acessíveis como classes Tailwind (ex: `bg-primary`, `text-secondary`)?
- A fonte Signika está disponível como classe (ex: `font-sans` ou tem que usar `font-[var(--font-signika)]`)?
- Existe alguma classe utilitária customizada já feita em `globals.css` (`.container-site`, `.btn-primary`, etc.)?

### 6. Dependências instaladas

Confirme se estes pacotes ESTÃO instalados ou não:
- `zustand`
- `@radix-ui/react-dialog` (pro VideoModal)
- `lucide-react` (já sei que sim, mas confirmar versão)

## Formato da resposta

Markdown estruturado, sem código verboso, focado no que eu preciso saber pra escrever os próximos prompts. Se algo for trivial ("Tailwind v4 funciona normalmente"), diga em uma linha só.
