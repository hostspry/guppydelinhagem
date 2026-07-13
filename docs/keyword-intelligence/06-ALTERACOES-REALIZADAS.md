# 06 — Alterações realizadas (SEO / keyword-intelligence)

> Execução da missão em `PROMPT-CLAUDE-CODE.md`. Branch: `feat/seo-keyword-intelligence`
> (criada a partir de `initial-setup`). **Nenhum deploy, nenhuma alteração em
> banco/DNS/pagamentos.** Escopo desta rodada: **completo** (toda a arquitetura da
> tabela da missão, respeitando as regras de não-canibalização e não-invenção).

Data: 13/07/2026.

---

## 1. Auditoria (estado inicial encontrado)

Stack: Next.js 16 (App Router) + React 19 + TS + Prisma 7/Postgres + Tailwind v4.
Build via webpack (`next build --webpack`).

**Fundação técnica de SEO/GEO já existia e está forte** (fases `fase-seo-geo-*`):
sitemap dinâmico, robots liberando crawlers de IA (GEO), `lib/seo.ts` com
`pageMeta()`, builders de JSON-LD (`lib/seo/jsonld.ts`), home já otimizada para
"guppy de linhagem (lebiste)", e `/conheca-os-guppy` já cobrindo o pilar de guia
(o que é / como cuidar / reprodução) com FAQPage + Breadcrumb.

**Buraco real:** a camada de **arquitetura/conteúdo** da tabela da missão não
existia (nenhuma rota `/linhagens`, `/atacado`, `/envio`, `/guia/*`).

---

## 2. O que foi feito

### Páginas novas

| Rota | Tipo | Cluster / keyword atendida |
|---|---|---|
| `/linhagens` | Catálogo comercial (grid ao vivo) | **guppy de linhagem** (100–1K), **tipos de guppy** (100–1K), comprar guppy de linhagem, lebiste de linhagem |
| `/linhagens/endler` | Página própria (grid filtrado) | **guppy endler** (1K–10K, maior volume de topo), peixe endler, guppy endler preço/comprar |
| `/atacado` | Conversão B2B | **criador de guppy**, comprar guppy no atacado, fornecedor para revenda |
| `/envio` | Confiança/conteúdo | transporte de peixes vivos, envio para todo o Brasil, como o peixe chega vivo |
| `/guia/reproducao-de-guppy` | Conteúdo (Article) | **reprodução de guppy**, **guppy grávida** (100–1K), guppy prenha, guppy come os filhotes, reprodução de lebiste |
| `/guia/macho-e-femea` | Conteúdo (Article) | guppy macho e fêmea, guppy fêmea, guppy macho, lebiste macho e fêmea |
| `/guia/filhotes-de-guppy` | Conteúdo (Article) | filhote de guppy, alevino de guppy, como cuidar de alevinos, ração para alevinos |

### Arquivos de apoio / edições

| Arquivo | Ação |
|---|---|
| `lib/linhagens-content.ts` | **novo** — tipos, respostas rápidas e FAQs de /linhagens e /linhagens/endler |
| `lib/guias-content.ts` | **novo** — blocos e FAQs dos 3 guias |
| `lib/atacado-content.ts` | **novo** — motivos e FAQ de atacado |
| `lib/envio-content.ts` | **novo** — passos e FAQ de envio |
| `lib/seo/jsonld.ts` | editado — novos builders `collectionPageJsonLd()` e `articleJsonLd()` (autor/publisher no mesmo `@id` da organização) |
| `app/sitemap.ts` | editado — +7 rotas novas com prioridade/frequência |
| `components/site/NavBar3.tsx` | editado — links "Linhagens" e "Atacado" no menu (desktop + drawer); CTA "Peixes de Linhagem" repontado de filtro morto (`/loja?product_cat=…`) para `/linhagens` |
| `components/site/Footer.tsx` | editado — Linhagens/Atacado no institucional; Envio/Frete nos links úteis |
| `app/(public)/page.tsx` | editado — link interno "linhagens" no texto da home |
| `app/(public)/conheca-os-guppy/page.tsx` | editado — links do pilar para os 3 guias novos (cluster interligado) |

### JSON-LD por página (structured data compatível com o conteúdo visível)

- `/linhagens`, `/linhagens/endler`: CollectionPage + BreadcrumbList + FAQPage.
- `/atacado`: BreadcrumbList + FAQPage.
- `/envio` e os 3 guias: Article + BreadcrumbList + FAQPage.
- Todos os builders amarram a página ao **mesmo `@id`** da organização (consistência
  de entidade para GEO).

---

## 3. Decisões de arquitetura (contra canibalização e invenção)

- **`/linhagens` é comercial, não guia.** O guia (`/conheca-os-guppy`) cobre
  cuidado/reprodução; `/linhagens` foca em tipos, disponibilidade e preço, e linka
  para o guia. Evita duplicar conteúdo.
- **`/guia/como-cuidar-de-guppy` NÃO foi criada** de propósito: `/conheca-os-guppy`
  já é a página pilar de "como cuidar" (título e H1 já usam o termo). Criar uma
  concorrente canibalizaria. Os 3 guias novos tratam **subtemas** com volume próprio
  e baixa sobreposição (reprodução aprofundada, sexagem, filhotes), cada um linkando
  de volta ao pilar.
- **Uma URL por assunto, as duas grafias no conteúdo** (regra de ouro): "guppy" e
  "lebiste" juntos no texto; nada de `/guppys` vs `/lebistes`.
- **Grids ao vivo** (`/linhagens`, `/linhagens/endler`) leem o catálogo em
  request-time (`force-dynamic`): nunca listam peixe inexistente; vazio cai em CTA.
  **Zero invenção de estoque.**
- **`/atacado` sem inventar condição comercial**: não há quantidade mínima, preço
  ou desconto publicados (dependem da linhagem/ninhada). Tudo que é negociação vira
  "fale comigo no WhatsApp". O que se afirma é só o real (estufa, títulos, envio).
- **`/envio` sem prazo fixo nem garantia inventada**: descreve o processo de
  embalagem e a aclimatação (orientação segura) e manda calcular o valor em `/frete`.
- **Guias sem dose de medicamento** e sem diagnóstico definitivo (regra de saúde).
- **`/linhagens/[slug]` por linhagem NÃO criada**: doorway page é proibido. Cada
  linhagem é um chip → busca da loja. Só ganha URL própria com volume + estoque real.
- **`guppy carioca`** continua sem página (loja concorrente do RJ, já negativada).

---

## 4. Testes / validação

- `pnpm prisma generate` — OK (client 7.7.0).
- `npx tsc --noEmit` — **0 erros**.
- `npx eslint` nos 17 arquivos alterados — **0 erros / 0 warnings**.
- `next build` completo **não** foi rodado: neste ambiente ele pré-renderiza páginas
  com `revalidate` que leem o banco (ex.: `/conheca-os-guppy` via
  `getLinhagensParaGuia`, `/sobre-nos`) e o túnel SSH do Postgres estava fechado.
  As páginas novas de conteúdo (`/atacado`, `/envio`, guias) são estáticas puras
  (sem I/O) e as de catálogo são `force-dynamic`; nenhuma depende de DB no build.
- Confirmado: `initial-setup` intacta, **nenhum push/deploy**.

**Validação recomendada após o push** (o usuário fará): abrir cada rota nova,
conferir render e os blocos de JSON-LD no Rich Results Test, e testar os grids ao
vivo de `/linhagens` e `/linhagens/endler` com o catálogo real.

---

## 5. Deliberadamente NÃO feito (e por quê)

- **`/guia/como-cuidar-de-guppy`**: já servido por `/conheca-os-guppy` (não duplicar).
- **`/linhagens/[slug]` individual por linhagem**: sem doorway pages; só com volume +
  estoque recorrente. Hoje resolvido por chips → busca.
- **Títulos de produto (`/loja/[slug]`)**: não revisados nesta rodada (ver backlog).

---

## 6. Backlog priorizado (próximas rodadas)

1. **Otimizar `metaTitle`/H1 de cada produto** (`/loja/[slug]`): garantir
   "guppy"/"lebiste" + a linhagem no título (cluster de linhagem específica).
2. **`/linhagens/[slug]`** só para linhagem com volume nos dados **e** estoque real
   recorrente, com conteúdo próprio (não doorway).
3. **Imagens/alt text**: catálogo se apoia em thumbnail de vídeo; avaliar imagens
   estáticas com alt descritivo por linhagem.
4. **Revisar se `/conheca-os-guppy` deve virar hub `/guia`** com os satélites, se o
   volume justificar, sempre com canonical/redirect para não perder ranking.
5. **Medir canibalização real** após indexação (Search Console): home × /linhagens
   × guias; ajustar canonicals se necessário.
