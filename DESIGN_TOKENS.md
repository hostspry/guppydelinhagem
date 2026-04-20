# Design Tokens — Guppy de Linhagem

Extraído de `guppydelinhagem.com.br` em 2026-04-19.
Fonte primária: Elementor Global Kit CSS (`/wp-content/uploads/elementor/css/post-70.css`).

---

## 1. Paleta de Cores

| Token            | Variável Elementor              | HEX       | Uso                                              |
|------------------|---------------------------------|-----------|--------------------------------------------------|
| `primary`        | `--e-global-color-primary`      | `#07366A` | Fundo do topo/rodapé, botões padrão, links hover |
| `secondary`      | `--e-global-color-secondary`    | `#FF035C` | Headings (h1–h6), links, botões CTA, badges      |
| `accent`         | `--e-global-color-accent`       | `#FAB82A` | Hover de botões, bordas decorativas, ícones hover |
| `text`           | `--e-global-color-text`         | `#302F2F` | Texto corrido do corpo                           |
| `white`          | `--e-global-color-ad74965`      | `#FFFFFF` | Texto sobre fundos escuros, fundo de cards        |
| `background`     | `--e-global-color-37ee5e3`      | `#ECE7E8` | Fundo da barra central do header, inputs         |
| `overlay-dark`   | —                               | `#302F2F` | Sobreposições escuras                            |
| `footer-bg`      | —                               | `#07366A` | Fundo completo do rodapé (= primary)             |
| `progress-bar`   | —                               | `#FF035C` | Barra de progresso de leitura                    |
| `btn-gradient`   | —                               | `linear-gradient(180deg, #FF035C 0%, #87002F 100%)` | Botão CTA do rodapé |

### Resumo rápido
```
Navy (primário):   #07366A
Rosa/Pink (CTA):   #FF035C
Âmbar (hover):     #FAB82A
Texto:             #302F2F
Fundo claro:       #ECE7E8
Branco:            #FFFFFF
Bordô (gradient):  #87002F
```

---

## 2. Tipografia

### Família de Fontes
| Papel    | Família  | Fallback   |
|----------|----------|------------|
| Headings | Signika  | Sans-serif |
| Corpo    | Signika  | Sans-serif |
| UI/Botão | Signika  | Sans-serif |

> **Origem:** Google Fonts, carregada via cache local do Elementor.  
> Pesos disponíveis: 300, 400, 500, 600, 700.

### Escala Tipográfica (Desktop)

| Elemento | Tamanho   | Peso | Line-height | Cor           |
|----------|-----------|------|-------------|---------------|
| H1       | 4.8rem    | 600  | 1em         | `#FF035C`     |
| H2       | 2.8rem    | 600  | 1em         | `#FF035C`     |
| H3       | 2rem      | 500  | 1.2em       | `#FF035C`     |
| H4       | 1.4rem    | 500  | 1.2em       | `#FF035C`     |
| H5       | 1.2rem    | 500  | —           | `#FF035C`     |
| H6       | 1rem      | 500  | —           | `#FF035C`     |
| Body     | 1rem      | 300  | 1.5em       | `#302F2F`     |
| Small    | 0.8rem    | 300  | —           | `#302F2F`     |
| Label/Tag| 0.8rem    | 400  | — (uppercase, letter-spacing: 1px) | `#302F2F` |
| Nav link | 1.1rem    | 400  | —           | `#FF035C`     |
| Caption  | 0.9rem    | 700  | — (uppercase) | herdada    |

### Escala Tipográfica (Mobile ≤ 767px)

| Elemento | Tamanho   | Line-height |
|----------|-----------|-------------|
| H1       | 2.6rem    | 2.8rem      |
| H2       | 2rem      | 2.2rem      |
| Body     | 1rem      | 1.5rem      |

---

## 3. Botões

### Botão Padrão (primário)
```css
background-color: #07366A;
color: #FFFFFF;
font-family: "Signika", sans-serif;
font-size: 1rem;
font-weight: 400;
border: none;
border-radius: 25px;        /* pill */
padding: 15px 35px;
```

### Botão Hover
```css
background-color: #FAB82A;
color: #FFFFFF;
```

### Botão CTA (rodapé / destaque)
```css
background-image: linear-gradient(180deg, #FF035C 0%, #87002F 100%);
border: 1px solid #FF035C;
border-radius: 25px;
color: #FFFFFF;
```

---

## 4. Inputs / Campos de Formulário

```css
background-color: #ECE7E8;
color: #302F2F;
border: none;
border-radius: 20px;
padding: 14px 15px;
font-family: "Signika", sans-serif;
font-size: 1rem;
font-weight: 300;

/* Focus */
border: 1px solid #07366A;
border-radius: 20px;
background-color: #ECE7E8;
```

---

## 5. Cards de Produto

Extraído do tema WooCommerce + Elementor. Padrão observado:

```css
background-color: #FFFFFF;
border-radius: 8px;          /* estimado — não explícito no CSS */
box-shadow: 0 2px 8px rgba(0,0,0,0.08);  /* estimado */
padding: 16px;

/* Título do produto */
color: #302F2F;
font-family: "Signika", sans-serif;
font-size: 1.2rem;
font-weight: 500;

/* Preço */
color: #FF035C;
font-weight: 600;

/* Botão "Adicionar ao carrinho" */
/* herda estilo do botão padrão acima */
```

---

## 6. Espaçamentos e Container

| Propriedade         | Valor          |
|---------------------|----------------|
| Max-width container | `1280px`       |
| Max-width tablet    | `1024px`       |
| Max-width mobile    | `767px`        |
| Block gap padrão    | `24px`         |
| Widget spacing      | `20px`         |
| Breakpoint mobile   | `≤ 767px`      |
| Breakpoint tablet   | `≤ 1024px`     |
| Mobile nav collapse | `≤ 900px`      |

---

## 7. Navbar (Header)

O header tem **3 camadas**:

### Barra superior (top bar)
```
fundo:     #07366A (gradiente sólido navy)
texto:     #FFFFFF
conteúdo:  contato (telefone/email/WhatsApp) + redes sociais rápidas
padding:   10px vertical
```

### Barra central (middle bar — logo + busca)
```
fundo:     #ECE7E8
conteúdo:  logo (60% de largura no desktop) + barra de busca WooCommerce + carrinho
padding:   20px vertical
```

### Barra de navegação (nav bar)
```
fundo:     #FFFFFF
links:     cor #FF035C, font "Signika" 1.1rem weight 400
hover:     cor #FAB82A
active:    cor #FAB82A
padding link: 5px 15px
border-radius link: 3px
```

### Menu principal
Itens: **Loja · Sobre Nós · Conheça o Guppy · Blog · Contatos**

### Mobile (≤ 900px)
```
hamburguer: ícone de 3 linhas, cor #FAB82A
menu dropdown: fundo #07366A, links #FFFFFF
active mobile: #FF5A6E
```

---

## 8. Footer (Rodapé)

```
fundo:             #07366A (navy)
padding top/bot:   150px / 120px (desktop), 90px / 120px (mobile)
texto:             #FFFFFF
```

### Estrutura de colunas (desktop: 4 colunas)
1. **Logo + descrição** — 30% largura
2. **Links úteis** — 20% largura (bordas `#FAB82A` à esquerda)
3. **Contato/Informações** — 20% largura (bordas `#FAB82A` à esquerda)
4. **Redes sociais + Selos** — 30% largura (bordas `#FAB82A` à esquerda)

### Ícones/Lista do rodapé
```
ícone cor:       #FFFFFF
ícone hover:     #FAB82A
texto cor:       #FFFFFF
texto hover:     #FAB82A
font-size:       14px, weight 300
```

### Redes sociais (ícones)
```
background:      #FFFFFF
ícone cor:       #FF035C
hover bg:        #FAB82A
hover ícone:     #FFFFFF
```

### Copyright
```
cor:       #FFFFFF
weight:    300
texto:     "Copyright © 2025 - Guppy de Linhagem. Todos os Direitos Reservados."
```

---

## 9. Sombras e Bordas Decorativas

| Elemento              | Estilo                                         |
|-----------------------|------------------------------------------------|
| Divisores de seção    | border-left: 1px solid `#FAB82A`              |
| Sombra natural (WP)   | `6px 6px 9px rgba(0,0,0,0.2)`                 |
| Sombra carrinho       | `0px 0px 15px 2px rgba(0,0,0,0.1)`            |

---

## 10. Logo

- **Arquivo:** `public/logo.png`
- **Dimensões originais:** 832 × 428 px (PNG colormap 8-bit)
- **URL original:** `https://www.guppydelinhagem.com.br/wp-content/uploads/2025/04/logoguppydelinhagem01.png`
- Uso no header: 60% largura (desktop), 85% (tablet), 60% (mobile)

---

## 11. Variáveis CSS Recomendadas para o Novo Projeto

```css
:root {
  /* Cores */
  --color-primary:    #07366A;
  --color-secondary:  #FF035C;
  --color-accent:     #FAB82A;
  --color-text:       #302F2F;
  --color-bg:         #ECE7E8;
  --color-white:      #FFFFFF;
  --color-bordeaux:   #87002F;

  /* Tipografia */
  --font-family:      "Signika", sans-serif;
  --font-size-base:   1rem;
  --font-weight-light:  300;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semi:   600;
  --font-weight-bold:   700;
  --line-height-base:   1.5em;

  /* Container */
  --container-max:    1280px;

  /* Border-radius */
  --radius-btn:       25px;
  --radius-input:     20px;
  --radius-card:      8px;
}
```
