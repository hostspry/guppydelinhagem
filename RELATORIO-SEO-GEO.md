# Relatório — Engenharia SEO/GEO — guppydelinhagem.com.br

Data: 2026-07-07. Host canônico: `https://www.guppydelinhagem.com.br` (com www).
Escopo: os 4 blocos do prompt-mestre (Fase 1 + Fase 2 + reescrita de texto +
auditoria). **Sem push** — as mudanças estão commitadas localmente para o dono
revisar e subir.

Estado inicial relevante: uma sessão anterior já havia adiantado parte da Fase 1
(helper `pageMeta` em `lib/seo.ts`, canonical/OG em várias páginas, JSON-LD de
Organization na home e `AboutPage` em /sobre-nos). O reconhecimento leu o código
real antes de mudar; o que já existia foi reaproveitado, não recriado.

---

## Bloco 1 — Fundação técnica

| Entrega | Status | Onde |
|---|---|---|
| `app/sitemap.ts` (dinâmico, revalidate 1h) | Criado | rotas estáticas + todos os produtos ativos, todas com host www |
| `app/robots.ts` | Criado | `*` allow + Disallow /admin /api; allow explícito p/ 11 crawlers de IA; Host + Sitemap |
| Fix de `<h1>` (PageBanner) | Feito | prop `as?: "h1"\|"h2"` (default h2); `/conheca-os-guppy` e `/contatos` agora com `as="h1"` |
| Metadata em /conheca e /contatos | Já existia + refinado | title/description/canonical/OG via `pageMeta` (reescritos no Bloco 3) |
| Canonical + OG em todas as indexáveis | Completo | home, sobre-nos, conheca, contatos, frete — todas com canonical www + OG |
| `public/llms.txt` | Criado | resumo GEO do site, fatos verificáveis, canais reais |

Detalhes:
- **Sitemap**: query enxuta nova `getActiveProductsForSitemap()` em
  `lib/queries/products.ts` (só `slug` + `atualizadoEm`), centralizando o acesso
  ao Prisma no padrão do projeto. `lastModified` = `atualizadoEm` do produto.
  Não inclui checkout/carrinho/feed/pedido/login/cadastro/minha-conta/admin.
- **Robots**: crawlers de IA (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot,
  Claude-User, Claude-SearchBot, PerplexityBot, Google-Extended,
  Applebot-Extended, Bingbot, CCBot) com `Allow: /` explícito — GEO é prioridade.
  Sem Disallow em /checkout, /feed, /pedido (usam `noindex` na metadata e o
  Google precisa rastrear para ver o noindex).
- `SITE_URL` já existia em `lib/seo.ts` (não em `lib/constants.ts`) — centralizei
  nele em vez de duplicar.

## Bloco 2 — Dados estruturados (JSON-LD)

Builders puros novos em `lib/seo/jsonld.ts` + componente `components/seo/JsonLd.tsx`
que renderiza em server component **escapando `<` → `<`** (anti-XSS via
`</script>` na descrição vinda do banco).

| Schema | Onde | Observação |
|---|---|---|
| `Product` + `Offer`/`AggregateOffer` | /loja/[slug] | preço do schema = preço em destaque na página |
| `BreadcrumbList` | /loja/[slug] | Início → Categoria (`/?categoria=slug`, 200 real) → Produto |
| `FAQPage` | /conheca-os-guppy | as 6 perguntas visíveis do acordeão |
| `OnlineStore` (com `award`) | home | mesma entidade de /sobre-nos |
| `AboutPage` → `Organization` | /sobre-nos | refatorado p/ a mesma entidade |

Decisões de preço (críticas para não gerar ação manual do Google):
- O preço do schema é calculado **no servidor**, por variante, com a MESMA
  função da página (`calcularPrecos` + `precoComCampanha`): reproduz o número em
  destaque (Pix efetivo, ou promocional de campanha) que o `ProductDetail` exibe.
- Uma variante / preço único → `Offer`. Múltiplas com preços diferentes →
  `AggregateOffer` com `lowPrice`/`highPrice`/`offerCount`.
- Disponibilidade via `estaEsgotado(pool)`: esgotado emite `OutOfStock` (não some).

Consistência de entidade (crítica para GEO):
- Home (`OnlineStore`) e /sobre-nos (`Organization` dentro de `AboutPage`)
  compartilham o MESMO `@id` (`.../#organization`), `name`, `sameAs` e `award`,
  montados a partir de `lib/sobre-content` (ORG, REDES, conquistas). O Google
  unifica a entidade pelo `@id`.
- Adicionado `alternateName: "Guppy de Linhagem"` (marca) sobre o nome canônico
  `Marchezi Guppy Farm`.

## Bloco 3 — Reescrita da camada de texto

- **Titles/descriptions reescritos** (únicos, ~55 e 140–160 chars, com o sinônimo
  `lebiste` e um fato concreto — tricampeão mundial, Guarapari/ES, envio vivo):
  home, /sobre-nos, /conheca-os-guppy, /contatos, /frete.
  - Padrão de title `<Específico> | Guppy de Linhagem`. Home:
    `Guppy de Linhagem (Lebiste) — Criação Tricampeã Mundial`.
- **Produto (`generateMetadata`)**: title com travessão (`— Guppy de Linhagem`)
  no lugar do `·`; description com fallback que sempre traz linhagem, casal/trio
  (quando há variante) e envio vivo, quando o produto não tem meta própria.
- **Auditoria de alt text**: percorridos todos os `next/image` do site público —
  já estavam bons (nome do produto, descrições específicas em /sobre-nos, logos
  nomeadas; decorativos com `alt=""` + `aria-hidden`). Nenhum alt fraco tipo
  "peixe"/"imagem". Sem correções necessárias.
- **Heading audit**: cada página indexável tem exatamente um `<h1>` (validado por
  curl, ver auditoria). Corrigido salto h3→h2 em /contatos ("Dúvidas?").
- **Internal linking**: home→produtos (cards `<Link>`), produto→guia (footer em
  toda página), guia→loja (CTA + `/loja` 301→`/`), sobre-nos→home. Reforçado com
  links contextuais na nova seção de texto da home.
- **Texto da home (SEO/GEO)**: nova `<section>` discreta acima do footer, com
  `<h2>` e dois parágrafos na voz do criador contendo guppy/lebiste, tricampeão
  mundial, Guarapari/ES e envio para todo o Brasil — com links internos para as
  linhagens (filtro da vitrine), o guia e a história. Usa os tokens de design
  existentes (bg-bg-alt, text-primary/secondary/text, container-site).

## Correções além do escopo (encontradas e resolvidas)

1. **Links sociais do Footer apontavam para contas inexistentes**
   (`instagram.com/guppydelinhagem`, `facebook.com/…`, `youtube.com/@guppy…`,
   `linkedin.com/…`) — provavelmente 404 e **contradiziam o `sameAs`** do JSON-LD.
   Trocados pelos canais reais e ativos de `REDES` (Instagram `marchezi_guppy`,
   YouTube `@marcheziguppy`). Facebook e LinkedIn removidos: não há conta
   confirmada e inventar link é proibido neste projeto.
2. **Home com múltiplos `<h1>` no modo carrossel**: `HeroSlider` renderiza um
   `HeroStatic` (com h1) por slide. Adicionada prop `titleAs` — só o primeiro
   slide é `h1`, os demais viram `div` (visual idêntico). Garante um único h1.
3. **Sitemap resiliente**: se o banco estiver indisponível na geração, o
   `/sitemap.xml` ainda entrega as rotas estáticas (try/catch) em vez de 500.
4. **Código morto removido**: `organizationJsonLd` em `lib/sobre-content.ts`
   (superseduto pela fonte única em `lib/seo/jsonld.ts`).

## Pendências (documentadas, com razão)

1. **FAQPage na página de produto — não emitido de propósito.** O `ProductFaq`
   usa uma FAQ **genérica e idêntica** em todo produto (de `lib/product-content`),
   não pares pergunta/resposta do banco. Emitir o mesmo `FAQPage` em toda URL de
   produto seria markup duplicado no site inteiro (risco de qualidade). Só
   /conheca-os-guppy emite `FAQPage`. Se um dia os produtos tiverem FAQ próprio no
   banco, o builder `faqPageJsonLd` já está pronto para reusar.
2. **Guia tem 6 perguntas, não 8** (a doc dizia 8). Emitidas as 6 realmente
   visíveis no acordeão (o schema só pode conter o que está na página).
3. **OG image dedicada 1200×630** ainda não existe para home/guia (pendência
   pré-existente, aguardando a foto nova da estufa). Fallbacks atuais: home usa a
   webp do hero; guia herda o selo institucional. Aceitável até a foto chegar.
4. **Redirect non-www → www** é configuração de infra (Coolify/proxy), fora do
   código — está no checklist do dono abaixo.
5. **Build local exige o banco acessível** no prerender (o layout público lê
   `ConfiguracaoLoja` via `TarjaPromocional`). No Coolify o build roda dentro da
   rede e resolve o host interno normalmente; localmente precisa do túnel SSH.
   Não é problema de código — registrado para o dono saber.

## Auditoria final (Bloco 4) — resultados

- **`pnpm build`: passou, zero erros.** TypeScript compilou limpo. (Rodado com o
  túnel SSH do banco levantado + `DATABASE_URL` via `127.0.0.1:5432`.)
- **`pnpm lint`: 9 problemas — os MESMOS 9 do baseline** (comparado via
  `git stash`). Zero problemas novos; todos pré-existentes (setState-in-effect em
  carrinho/CartIcon/ProductDetail, `getIcon` dinâmico no HeroStatic, aria-meter,
  compilation-skipped) — nenhum nos arquivos criados/editados do SEO/GEO.
- **curl (servidor de produção local, `next start`)**:
  - `/robots.txt`: regra geral + 11 crawlers de IA + Host + Sitemap. OK.
  - `/sitemap.xml`: XML válido, 5 rotas estáticas + 13 produtos, todas com host www. OK.
  - `/llms.txt`: markdown servido. OK.
  - Todas as páginas indexáveis: title único, description única, canonical com host
    www, tags og:*, **exatamente um `<h1>`**. OK.
  - JSON-LD parseável em todas: home `OnlineStore` (com `@id` + 3 awards),
    /conheca `FAQPage` (6 perguntas), /sobre-nos `AboutPage`, produto
    `Product` + `BreadcrumbList`.
  - **Product**: campos obrigatórios do rich result presentes (name, image,
    offers.price/priceCurrency/availability). Varredura nos 13 produtos:
    5 emitiram `AggregateOffer` (ex.: `low=199.00 high=490.00 count=4`), 8
    emitiram `Offer`; esgotados emitiram `OutOfStock` corretamente.
  - **Preço schema = preço exibido**: confirmado (ex.: kit com `Offer 252.00`
    batendo o preço Pix em destaque na página).

## Arquivos criados

- `app/sitemap.ts`
- `app/robots.ts`
- `public/llms.txt`
- `lib/seo/jsonld.ts`
- `components/seo/JsonLd.tsx`
- `RELATORIO-SEO-GEO.md` (este arquivo)

## Arquivos modificados

- `lib/queries/products.ts` (query do sitemap + `categoriaSlug` no produto)
- `lib/seo.ts` (sem mudança de assinatura — já tinha `pageMeta`/`SITE_URL`)
- `lib/sobre-content.ts` (removido builder morto)
- `components/site/PageBanner.tsx` (prop `as`)
- `components/site/HeroStatic.tsx` + `HeroSlider.tsx` (h1 único no carrossel)
- `components/site/Footer.tsx` (links sociais reais)
- `app/(public)/page.tsx` (OnlineStore + título/descrição + seção de texto)
- `app/(public)/loja/[slug]/page.tsx` (Product + Breadcrumb + title travessão)
- `app/(public)/conheca-os-guppy/page.tsx` (h1 + FAQPage + título/descrição)
- `app/(public)/contatos/page.tsx` (h1 + h2 + título/descrição)
- `app/(public)/sobre-nos/page.tsx` (entidade unificada + título/descrição)
- `app/(public)/frete/page.tsx` (título/descrição)

---

## Checklist pós-deploy (para o dono)

Depois de subir (`git push`) e o Coolify concluir o build:

1. **Redirect non-www → www no Coolify**: garantir 301 de
   `guppydelinhagem.com.br` → `https://www.guppydelinhagem.com.br` (o host
   canônico de todo o SEO desta entrega). Sem isso, o Google pode ver duas
   versões do site.
2. **Google Search Console**:
   - Submeter o sitemap: `https://www.guppydelinhagem.com.br/sitemap.xml`.
   - Inspecionar URL → **Solicitar indexação** para: a home (`/`), `/sobre-nos` e
     `/conheca-os-guppy` (o Google ainda mostra cache do WordPress antigo —
     forçar o re-rastreamento acelera a troca).
3. **Teste de rich results**: abrir
   `https://search.google.com/test/rich-results`, colar a URL de um produto e
   confirmar `Product` + `Breadcrumb` sem erros. Conferir também um produto
   esgotado (deve aparecer `OutOfStock`).
4. **Conferir `llms.txt` em produção**:
   `https://www.guppydelinhagem.com.br/llms.txt` deve abrir o markdown.
5. **(Opcional, quando a foto nova da estufa estiver pronta)**: gerar uma imagem
   OG dedicada 1200×630 e apontar home/guia para ela (hoje usam fallback).
6. **Acompanhar**: em Search Console, ver `/sitemap.xml` processado e as páginas
   passando de "descoberta" para "indexada" nas semanas seguintes.
