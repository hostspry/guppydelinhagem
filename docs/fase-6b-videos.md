# FASE 6b — EXECUÇÃO: Vídeos do produto + campos SEO (admin)

Implemente a vinculação de **múltiplos vídeos por produto** (vídeo é o produto) e
os **campos de SEO** no cadastro. Espelhe o molde já consolidado de Categorias/6a.
As decisões abaixo JÁ ESTÃO APROVADAS — não reabra, só execute. Onde o molde não
encaixar, anote e me reporte no fim (não improvise silenciosamente).

> Contexto de ambiente: o banco é o do Coolify, acessado via **túnel SSH**
> (`localhost:5432`). Migrations versionadas no git; o Coolify aplica via
> `migrate deploy` no deploy. Com o túnel aberto, pode rodar `prisma migrate dev`
> localmente para GERAR as migrations (o banco é dev, sem dados reais — reset é barato).

═══════ DECISÕES APROVADAS (embutidas) ═══════

1. **Plataforma primária = YouTube Shorts.** Thumbnail e título vêm automáticos
   (oEmbed / URL de frame público). Instagram e TikTok são **adicionais**, com
   título e thumbnail **manuais** (ver decisão 6).
2. **Um produto tem N vídeos.** Exatamente **um** é o `principal` (capa: usado na
   vitrine/listagem/card). Os demais são adicionais (ângulos extras p/ identificação).
3. **6b NÃO toca storage de imagem.** YouTube não precisa de storage (thumbnail é
   URL pública). Para IG/TikTok, nesta fase, o campo de thumbnail é uma **URL colada
   manualmente** (`thumbnailUrl` string) — **upload de imagem fica para a 6c**, que
   usará **storage próprio S3-compatible (Garage, app no Coolify)** — NÃO Cloudinary.
   Não adicione nenhuma dependência de storage/SDK de imagem nesta fase.
4. **IA NÃO entra aqui.** 6b é cadastro manual de vídeo. O campo de briefing em
   texto e a geração por IA (nome/descrição/meta otimizados p/ CTR+SEO) são a
   **Fase 7**. Mas os campos que a IA vai PREENCHER já são criados agora (decisão 5).
5. **Campos de SEO no Product (migration):** `metaTitle` e `metaDescription`,
   ambos `String?` (nullable/opcionais). São conceitualmente distintos de
   `descricaoCurta` (que é card da loja): `metaTitle` = `<title>` da página,
   `metaDescription` = `<meta description>` (trecho no Google). Ficam num grupo
   "SEO" do form, opcionais.
6. **Facade pattern:** thumbnail na listagem/seção; o `<iframe>` do vídeo só
   carrega sob demanda (clique no "ver"). Nunca renderizar N iframes de uma vez.

═══════ PRÉ-PASSO 1 — Migration: campos SEO no Product ═══════

Adicione ao model `Product` no `prisma/schema.prisma`:
```
metaTitle        String?
metaDescription  String?
```
Gere a migration (nome sugerido: `add_product_seo_fields`). COMMIT isolado.

═══════ PRÉ-PASSO 2 — Migration: modelo ProductVideo + enum ═══════

PRIMEIRO **leia o model `ProductVideo` atual** (já existe, com `onDelete: Cascade`).
Reconcilie com os campos abaixo — adicione só o que faltar, não recrie o que já está.

Enum novo:
```
enum VideoPlatform {
  YOUTUBE
  INSTAGRAM
  TIKTOK
}
```

Campos que o `ProductVideo` precisa ter (ajuste nomes à convenção do model atual):
```
url           String                       // URL original colada
platform      VideoPlatform
videoId       String?                      // ID extraído (YouTube); null p/ IG/TikTok
titulo        String?                      // do oEmbed (YouTube) ou manual (IG/TikTok)
thumbnailUrl  String?                      // auto (YouTube) ou URL manual (IG/TikTok)
principal     Boolean        @default(false)
ordem         Int            @default(0)   // ordenação dos adicionais
// productId + relation com onDelete: Cascade (já existe — manter)
// criadoEm DateTime @default(now())
```
Gere a migration (nome sugerido: `extend_product_video`). COMMIT isolado.

═══════ PRÉ-PASSO 3 — Util de URL de vídeo (sem dependência externa) ═══════

`lib/utils/video.ts`:
- `parseVideoUrl(url: string): { platform: VideoPlatform; videoId: string | null } | null`
  - YouTube Shorts: `youtube.com/shorts/{id}` · `youtu.be/{id}` · `youtube.com/watch?v={id}` → `{ YOUTUBE, id }`
  - Instagram: `instagram.com/reel/{id}` · `/p/{id}` → `{ INSTAGRAM, null }`
  - TikTok: `tiktok.com/@user/video/{id}` → `{ TIKTOK, null }`
  - URL não reconhecida → `null`
- `youtubeThumbnailUrl(videoId): string` → `https://img.youtube.com/vi/{id}/hqdefault.jpg`
  (Shorts são vídeos normais; o frame `hqdefault` existe. Considerar fallback
  `maxresdefault` → `hqdefault` se quiser, mas `hqdefault` é o seguro.)
- `youtubeEmbedUrl(videoId): string` → `https://www.youtube.com/embed/{id}`

═══════ 6b — Vínculo de vídeo no produto ═══════

**Metadados do YouTube (server-side):** ao adicionar uma URL de YouTube, buscar
título e thumbnail via **oEmbed**: `https://www.youtube.com/oembed?url={url}&format=json`
→ retorna `title` e `thumbnail_url`. Fazer isso **no servidor** (Server Action ou
helper de query), nunca no client (CORS/limpeza). Se o oEmbed falhar, cair no
fallback: `videoId` extraído pela util + `youtubeThumbnailUrl(videoId)`, e `titulo`
fica null (editável). Para IG/TikTok: sem fetch — `titulo`/`thumbnailUrl` manuais.

**Regra do principal (camada de action):** exatamente um `principal` por produto.
- Se o produto fica sem nenhum vídeo principal e há ≥1 vídeo, o primeiro vira principal.
- Ao marcar um como principal, **desmarcar os outros** do mesmo produto (transação).
- Se um vídeo principal é removido e sobram outros, promover o de menor `ordem`.

**Integração no form (DECISÃO DE DESIGN — principal ponto de atenção):**
A seção de vídeos fica **no mesmo `ProductForm`** (entre "Básico" e "Preço & estoque"
ou em grupo próprio "Vídeos"). Como no fluxo de **criar** o produto ainda não existe,
gerencie os vídeos como **lista em estado do client** (array no form) e persista
junto no `createProduct` via **nested `create`** do Prisma (produto + vídeos numa
transação). No **editar**, carregar os vídeos existentes e reconciliar (add/remove/
set-principal) no `updateProduct`. **Este é o ponto que mais foge do molde de 6a**
(que não tinha relação filha gerenciada no form) — se o RHF + array aninhado ficar
problemático, me reporte a fricção em vez de forçar.

**UI da seção de vídeos** (referência aprovada — mockup já validado):
- Campo de URL no topo + botão "Adicionar". Reconhece plataforma pela URL.
- Bloco "PRIMÁRIO" destacado (borda `2px` info): thumbnail vertical 9:16, badge da
  plataforma, título, URL truncada, botões ver (`eye`) e remover (`trash`).
- Bloco "ADICIONAIS": cards menores, cada um com badge de plataforma, botão estrela
  (`star`) para promover a principal, e remover.
- IG/TikTok: badge da plataforma + aviso "thumb manual"; campos de `titulo` e
  `thumbnailUrl` editáveis (URL colada, SEM upload nesta fase).
- Facade: o `eye` abre o embed (modal ou inline) — iframe carrega só no clique.

**Grupo SEO no form:** novo `<fieldset>` "SEO" com `metaTitle` (hint: ~60 chars,
título da página) e `metaDescription` (hint: ~155 chars, trecho no Google). Ambos
opcionais. Reusar `FormField`. NÃO confundir com `descricaoCurta`.

**Validação Zod (`lib/validations/product.ts`):** estender o schema com
`metaTitle: z.string().max(70).optional().or(z.literal(""))` e
`metaDescription: z.string().max(170).optional().or(z.literal(""))`. Os vídeos,
por serem array aninhado, podem ter um sub-schema (`videoSchema[]`) ou serem
validados na action — sua escolha, reporte qual usou.

═══════ QUERIES / ACTIONS ═══════

- `lib/queries/products.ts`:
  - `getProductById` — incluir `videos` (ordenados: principal primeiro, depois `ordem`).
    Lembrar de converter Decimal (já feito p/ preço) — vídeos não têm Decimal.
  - `listProducts` — já inclui `_count.videos`; garantir que a thumbnail do principal
    fique acessível p/ a listagem (incluir o vídeo principal, ou um campo derivado).
- `actions/products.ts`:
  - `createProduct` — criar produto + vídeos (nested create) numa transação; aplicar
    regra do principal. Manter `redirect()` FORA do try/catch (gotcha conhecido).
  - `updateProduct` — reconciliar vídeos (add/remove/reorder/set-principal).
  - Opcional: `fetchVideoMetadata(url)` como action utilitária p/ o botão "Adicionar"
    (retorna `{ platform, videoId, titulo, thumbnailUrl }` sem persistir, no fluxo criar).

═══════ CRITÉRIOS DE ACEITAÇÃO ═══════

1. Migrations aplicadas: `metaTitle`/`metaDescription` no Product; `ProductVideo`
   com `platform/videoId/titulo/thumbnailUrl/principal/ordem`; enum `VideoPlatform`.
2. Adicionar URL de YouTube Short → plataforma reconhecida, título e thumbnail
   puxados automaticamente.
3. Adicionar URL de IG/TikTok → plataforma reconhecida, título/thumbnail manuais
   (sem upload, URL colada).
4. Exatamente 1 vídeo principal por produto; promover/remover ajusta corretamente.
5. Criar produto COM vídeos persiste tudo numa transação e redireciona.
6. Editar produto carrega vídeos e salva alterações (add/remove/set-principal).
7. Listagem/card usa a thumbnail do vídeo principal.
8. Facade: iframe só carrega no clique do "ver".
9. Campos SEO salvam e recarregam no editar.
10. Build de produção limpo.

═══════ ENTREGA ═══════

Commits separados, nesta ordem:
1. `feat(prisma): campos SEO no Product (metaTitle, metaDescription)`
2. `feat(prisma): estende ProductVideo (plataforma, principal, thumbnail) + enum VideoPlatform`
3. `feat(admin): vínculo de vídeos no produto (YouTube auto + IG/TikTok manual) e grupo SEO`

Ao terminar, me mostre:
- o diff do `ProductVideo` final (e do enum);
- a assinatura das actions alteradas (`createProduct`/`updateProduct`) e de qualquer
  action nova de vídeo;
- **como você resolveu o array de vídeos aninhado no form** (RHF field array? estado
  manual? validação na action?) — é o ponto que mais foge do molde, quero revisar;
- qualquer outro ponto onde o molde de 6a não encaixou direto.

NÃO implemente upload de imagem (storage Garage/S3) — é 6c. NÃO implemente IA — é Fase 7.
