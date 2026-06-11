# FASE 6c — EXECUÇÃO: Upload de imagem (Garage/S3) + seletor de frames + embed IG/TikTok

Implemente a infra de upload de imagem usando o **Garage** (storage S3-compatible
próprio, no Coolify) e aplique-a à capa dos vídeos. Inclui também o seletor de
frames do YouTube e o embed de IG/TikTok no modal. Decisões abaixo JÁ APROVADAS —
não reabra, só execute. Onde algo não encaixar, reporte no fim.

> Ambiente: banco do Coolify via túnel SSH (`localhost:5432`). Garage já provisionado
> e configurado (bucket `guppy-media`, key com RW, leitura pública, alias do domínio).

═══════ DADOS DE CONEXÃO (Garage / S3) ═══════

| Item                      | Valor                                                          |
|---------------------------|----------------------------------------------------------------|
| Endpoint S3 (upload)      | `https://s3-c3ymhpteoyy8auhs3eqzrkxk.15.235.60.77.sslip.io`     |
| URL pública (leitura)     | `https://media.guppydelinhagem.com.br`                         |
| Bucket                    | `guppy-media`                                                  |
| Region (nominal)          | `garage`                                                       |
| Access Key ID             | `GKd4c443a561722adde51cc6bb`                                   |
| Secret Access Key         | (fornecida fora deste arquivo — vai no `.env`/Coolify)         |

═══════ DECISÕES APROVADAS (embutidas) ═══════

1. **Upload via Server Action (Opção A).** O arquivo vai do browser → Server Action
   (Next) → Garage via SDK S3. As credenciais S3 ficam **só no servidor** (`.env`),
   nunca no client. Sem presigned URL — não é necessário p/ thumbnails.
2. **Só thumbnails nesta fase.** Imagens pequenas (capas de vídeo IG/TikTok). Sem
   upload de vídeo. Validar no servidor: tipo `image/jpeg|png|webp`, máx **5 MB**.
3. **`thumbnailUrl` permanece String** — NÃO há migration nesta fase. A URL pública
   do arquivo enviado vai no mesmo campo `thumbnailUrl` já existente (6b).
4. **SDK:** `@aws-sdk/client-s3` (v3). Config crítica: `forcePathStyle: true`
   (Garage exige path-style, não virtual-hosted). Sem isso, o upload falha.

═══════ PRÉ-PASSO 0 — Variáveis de ambiente ═══════

Adicione ao `.env` local E às Environment Variables do Coolify (todas **server-side**,
nenhuma é `NEXT_PUBLIC`):
```
S3_ENDPOINT=https://s3-c3ymhpteoyy8auhs3eqzrkxk.15.235.60.77.sslip.io
S3_REGION=garage
S3_BUCKET=guppy-media
S3_ACCESS_KEY_ID=GKd4c443a561722adde51cc6bb
S3_SECRET_ACCESS_KEY=<SECRET>
S3_PUBLIC_URL=https://media.guppydelinhagem.com.br
```
Atualize também o `.env.example` com essas chaves (valores placeholder).
No Coolify: marcar Build + Runtime (não precisam ser Build Variable por não serem
`NEXT_PUBLIC`, mas Runtime é obrigatório). Mudança de env exige Redeploy.

═══════ PRÉ-PASSO 1 — next/image: liberar o domínio público ═══════

- `next.config.ts` → adicionar `media.guppydelinhagem.com.br` em `images.remotePatterns`
  (protocol https). Sem isso, `next/image` recusa as imagens do Garage.
- `lib/utils/image.ts` → adicionar `media.guppydelinhagem.com.br` ao set
  `CONFIGURED_IMAGE_HOSTS` (assim as imagens do Garage são otimizadas, não caem em
  `unoptimized`).

═══════ PRÉ-PASSO 2 — Client S3 + verificação de round-trip ═══════

`lib/s3.ts` (server-only):
- Client `@aws-sdk/client-s3` com: `endpoint=S3_ENDPOINT`, `region=S3_REGION`,
  `credentials={accessKeyId, secretAccessKey}`, **`forcePathStyle: true`**.
- `uploadImage(buffer: Buffer, contentType: string, ext: string): Promise<string>`
  → gera key única (ex: `produtos/thumbs/${crypto.randomUUID()}.${ext}`),
  `PutObjectCommand` (com `ContentType`), retorna a **URL pública**
  `${S3_PUBLIC_URL}/${key}`.
- `deleteImage(publicUrl: string): Promise<void>` → deriva a key removendo o prefixo
  `${S3_PUBLIC_URL}/`, `DeleteObjectCommand`. (Usado ao trocar/remover thumbnail.)

**VERIFICAÇÃO (faça ANTES de construir a UI):** escreva um script temporário
(`tsx`, descartável, NÃO commitar) que: (1) faz upload de um PNG pequeno de teste,
(2) faz `fetch` da URL pública retornada, (3) confirma HTTP 200 + bytes batem,
(4) deleta o objeto de teste. Rode e reporte.
> Se o fetch público der **404/NoSuchBucket**, o domínio não está mapeado ao bucket
> — me avise (é correção no Garage via CLI: alias global do bucket = domínio, feito
> fora daqui). NÃO prossiga p/ a UI até o round-trip passar (200).

═══════ 6c-A — Upload de capa (IG/TikTok) ═══════

**Server Action** (`actions/upload.ts` ou estender `actions/products.ts`):
- `uploadProductImage(formData): Promise<{ ok: true; url } | { ok: false; error }>`
  - `assertAuthorized()` (reusar o util compartilhado).
  - Ler o `File`; validar **no servidor**: content-type ∈ {jpeg,png,webp}, tamanho ≤ 5MB.
    Não confiar no client.
  - `arrayBuffer → Buffer`, chamar `uploadImage`, retornar a URL pública.

**UI (`ProductVideosField.tsx`):** no card de IG/TikTok, **substituir** o input de
texto "URL da thumbnail (manual)" por um **botão de upload de arquivo**:
- Seleciona imagem → chama `uploadProductImage` → ao voltar, seta `thumbnailUrl` do
  vídeo com a URL pública e mostra o preview (a thumb "sem thumb" vira a imagem).
- Estado de carregando durante o upload; toast de erro se falhar.
- Manter a opção de colar URL como fallback secundário é opcional — seu critério;
  reporte o que fez. (O upload é o caminho principal agora.)

═══════ 6c-B — Seletor de frames do YouTube ═══════

`lib/utils/video.ts` → `youtubeFrameUrls(videoId): string[]` retorna os 4 frames
públicos: `https://img.youtube.com/vi/{id}/hqdefault.jpg` (padrão) + `/1.jpg`,
`/2.jpg`, `/3.jpg` (frames de ~início/meio/fim).

**UI:** no card de vídeo do YouTube, um controle (ex: ícone/expand) que mostra os 4
frames como miniaturas clicáveis. Clicar em uma seta o `thumbnailUrl` daquele vídeo
para o frame escolhido (default continua `hqdefault`). Isso resolve "a thumbnail
automática ficou ruim, quero outra cena". Apenas YouTube (IG/TikTok não têm frames
por URL).

═══════ 6c-C — Embed de IG/TikTok no modal (em vez de abrir o site) ═══════

Hoje o "ver" (olho) de IG/TikTok abre a URL original em nova aba. Trocar para abrir
**no mesmo modal** que o YouTube usa, com o embed da plataforma:
- **Instagram:** iframe `https://www.instagram.com/reel/{shortcode}/embed` — o
  shortcode está na URL (ex: `/reel/DWWOCJpDb3B/`). Extrair na `parseVideoUrl` (hoje
  retorna `videoId: null` p/ IG; passar a extrair o shortcode e guardar em `videoId`).
- **TikTok:** o embed é `https://www.tiktok.com/embed/v2/{id}`, mas as URLs coladas
  costumam ser curtas (`vt.tiktok.com/XXXX/`) que **não contêm** o id numérico —
  é preciso **resolver o redirect** server-side p/ obter a URL canônica
  (`tiktok.com/@user/video/{id}`) e extrair o id. Faça isso em `fetchVideoMetadata`
  (no add do vídeo): se for TikTok, seguir o redirect (fetch com `redirect: "follow"`,
  ler a URL final), extrair o id, guardar em `videoId`. Se a resolução falhar,
  guardar `videoId: null`.
- **Fallback honesto:** se não houver `videoId` (resolução falhou) ou o embed não
  carregar, o "ver" cai no comportamento atual (abrir URL em nova aba). Embeds de
  IG/TikTok são notoriamente instáveis (posts privados, bloqueios) — o fallback é
  esperado, não um bug.

> Atenção: IG/TikTok mudaram `videoId` de sempre-null (6b) para "shortcode/id quando
> resolvível". Isso é aditivo (campo já é `String?`), sem migration. Vídeos IG/TikTok
> já salvos (sem id) continuam caindo no fallback até serem re-adicionados.

═══════ LIMPEZA (não-bloqueante, mas implemente se simples) ═══════

- Ao **trocar** a thumbnail manual de um vídeo (upload novo sobre um antigo do
  Garage), chamar `deleteImage` na URL antiga se ela for do nosso domínio
  (`S3_PUBLIC_URL`). Não deletar URLs externas (YouTube/manual coladas).
- Ao **excluir produto** (`deleteProduct`), deletar do Garage as thumbnails enviadas
  por nós (as que começam com `S3_PUBLIC_URL`). Evita órfãos. Se ficar complexo,
  reporte e deixamos p/ depois (órfãos num bucket de 10GB não são urgentes).

═══════ CRITÉRIOS DE ACEITAÇÃO ═══════

1. Round-trip S3 verificado: upload via SDK + leitura pela URL pública = 200.
2. No card de IG/TikTok, botão de upload envia a imagem ao Garage e a thumb aparece.
3. Capa enviada persiste (salvar/recarregar mostra a imagem do Garage).
4. `next/image` otimiza imagens do `media.guppydelinhagem.com.br` (host configurado).
5. Seletor de frames do YouTube troca a capa entre os 4 frames.
6. "Ver" de Instagram abre embed no modal (com fallback p/ URL se falhar).
7. "Ver" de TikTok resolve o id e abre embed no modal (com fallback p/ URL).
8. Build de produção limpo.

═══════ ENTREGA ═══════

Commits separados, nesta ordem:
1. `feat(infra): client S3 (Garage) + upload/delete de imagem + env`
2. `feat(admin): upload de capa para vídeos IG/TikTok`
3. `feat(admin): seletor de frames do YouTube`
4. `feat(admin): embed de IG/TikTok no modal (resolve id + fallback)`

(Os pré-passos de env/next.config podem ir no commit 1.)

Ao terminar, me mostre:
- a config do client S3 (especialmente `forcePathStyle`) e a assinatura de
  `uploadImage`/`deleteImage`;
- a Server Action de upload (validação de tipo/tamanho);
- como resolveu o id do TikTok (resolução de redirect) e o que acontece no fallback;
- qualquer ponto onde a infra de S3/embed não encaixou no molde.

NÃO faça migration (não há mudança de schema). NÃO implemente IA — é Fase 7.
NÃO suba vídeo como arquivo (vídeo é sempre por URL).
