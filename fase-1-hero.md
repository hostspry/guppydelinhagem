# FASE 1 — Hero novo

## Contexto

Você é o desenvolvedor do projeto guppydelinhagem.com.br (Next.js 16 + React 19 + Tailwind v4). Vamos substituir o hero atual da home por uma versão mais elegante.

Use os tokens já existentes em `app/globals.css`:
- `--color-primary: #07366a` (navy)
- `--color-secondary: #ff035c` (rosa)
- `--color-accent: #fab82a` (âmbar)
- `--color-bg-alt: #ece7e8` (cinza claro)
- Font Signika via `--font-signika` (já carregada no layout)

## Tarefa

Criar dois componentes novos e substituir a seção hero atual em `app/(public)/page.tsx`.

### Arquivo 1: `components/site/HeroHome.tsx`

Hero principal da home. Server component (sem `"use client"`, salvo necessário).

**Estrutura visual (desktop, ≥1024px):**

Grid 2 colunas (texto 55% / imagem 45%), padding vertical generoso (96px top, 80px bottom), max-width 1180px centralizado.

**Coluna esquerda (texto):**
1. Eyebrow: linha horizontal âmbar de 32px de largura + texto "NOVOS GUPPIES DISPONÍVEIS" em uppercase, tracking aumentado (~3px), 12px, peso 500, cor accent
2. H1: "Guppys de" (em primary/navy) + quebra de linha + "Linhagem" (em secondary/rosa). Font Signika peso 800, ~76px no desktop, line-height 0.95, letter-spacing -2px
3. Parágrafo: "Peixes selecionados, saudáveis e com genética apurada para aquaristas exigentes. Envio seguro para todo o Brasil." — 17px, cinza #555, line-height 1.6, max-width 480px
4. Dois CTAs lado a lado:
   - **Primário rosa:** "Ver catálogo" + ícone arrow-right (lucide-react). `bg-secondary text-white`, padding 16px 28px, border-radius 25px (pill), box-shadow sutil rosa
   - **Secundário outline:** "Falar no WhatsApp" + ícone do lucide-react. `bg-transparent border-2 border-primary text-primary`, padding 14px 24px, border-radius 25px. WhatsApp link: `https://wa.me/5527997594173`
5. Prova social (separada por border-top cinza):
   - 5 estrelas âmbar (ícone Star do lucide-react, fill âmbar)
   - "Marchezi Guppy Farm · 10 anos de criação" em 13px cinza

**Coluna direita (imagem):**

Container relative com min-height 480px. Dentro:
1. Forma orgânica de fundo: div absoluta que simula "aquário". Use `radial-gradient(circle, #07366a 0%, #051f3e 100%)`, com `border-radius: 50% 45% 50% 45%`, sombra grande navy difusa, posicionada à direita
2. Bolhinhas brancas semi-transparentes (4-5 divs pequenas, opacidades 0.2-0.5, tamanhos 6-12px, posições aleatórias)
3. Imagem do peixe: use `<Image>` do `next/image`. Por enquanto use `/assets/home/hero-fish.png` como placeholder (peça pro usuário trocar depois). Width 380, height 280, object-contain, z-index 2, centralizada no aquário
4. **Selo flutuante** no canto inferior esquerdo da imagem:
   - Caixa branca com sombra, padding 10px 16px, border-radius 12px
   - Círculo âmbar 36px com ícone Trophy do lucide-react em branco
   - Texto: "LINHAGEM CAMPEÃ" (11px, uppercase, tracking, cinza) + "Dragon Blue · 2024" (14px peso 600, navy)

**Fundo do hero:**

`background: linear-gradient(135deg, #fafafa 0%, #f4f1f0 55%, #e8e1e1 100%)`. Sem cinza chapado.

Decoração sutil no canto superior direito do hero: SVG com 3 círculos (navy, rosa, âmbar) com opacity 0.08, pointer-events none. Decorativo apenas.

**Mobile (< 768px):**
- Layout em coluna única: imagem em cima, texto embaixo
- Imagem ocupa ~340px de altura
- H1 reduz pra ~48px
- Botões CTA empilham verticalmente (full-width)
- Prova social mantém

**Tablet (768-1023px):**
- Lado a lado mas com h1 ~60px

### Arquivo 2: `components/site/HeroFeatures.tsx`

Faixa horizontal com 4 diferenciais, fica logo abaixo do hero (mas dentro da mesma seção visual com mesmo fundo).

Grid 4 colunas no desktop, 2x2 no tablet, 1 coluna no mobile. Gap 32px. Border-top cinza-quente separando do hero.

Cada item:
- Ícone do lucide-react âmbar 28px à esquerda
- Texto à direita: título 14px peso 600 navy + subtítulo 12px cinza

Os 4 itens:
1. Truck (lucide: `Truck`) — "Envio nacional" / "Para todo o Brasil"
2. Award — "Linhagem pura" / "Peixes premiados"
3. ShieldCheck — "Envio seguro" / "Embalagem com oxigênio"
4. HeartHandshake — "Suporte direto" / "Via WhatsApp"

### Arquivo 3: modificar `app/(public)/page.tsx`

Substituir a seção hero atual pelos novos componentes. Importar e renderizar:

```tsx
<HeroHome />
<HeroFeatures />
```

Ambos dentro da mesma seção (mesmo `<section>` wrapper) pra compartilhar o fundo gradiente.

### Cuidados

- **Mobile-first**: escreva o CSS pensando primeiro no mobile, depois adicione breakpoints `md:` e `lg:`
- **Acessibilidade**: alt nas imagens, aria-label nos botões de ícone, contraste mínimo AA
- **next/image**: use sempre, com `priority` no hero
- **Não use** `<form>` em lugar nenhum
- **Não introduza** novas dependências (apenas lucide-react e next/image, que já existem)
- Mantenha os componentes ENXUTOS — preze legibilidade, mas sem código morto

### Critério de aceitação

Quando eu rodar `npm run dev`, abrir `localhost:3000` no Chrome e redimensionar:
1. Desktop 1440px: hero ocupa primeiro viewport, 4 diferenciais aparecem antes do fold ou logo após
2. Mobile 375px (iPhone SE): hero compacto mas legível, CTAs grandes e tocáveis
3. Sem console errors
4. Sem warnings de hydration mismatch
5. Sem broken images (use placeholder se a foto real não existir ainda)

## Antes de começar

Confirme comigo:
1. O caminho `/assets/home/hero-fish.png` existe? Se não, qual foto devo usar como placeholder?
2. Existe alguma constante centralizada pro número do WhatsApp ou está hardcoded?
3. O componente Navbar atual está em qual layout (root ou (public))? Quero saber pra não duplicar.

Depois disso, me mostre o plano de execução e aguarde minha aprovação antes de criar/editar arquivos.
