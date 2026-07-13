# Guppy de Linhagem — Estado & Infraestrutura

> Documento de referência operacional. Última atualização: **11/06/2026**.
> Reflete o estado após o deploy da **Fase 6b** (vídeos + SEO) e a configuração do
> **Garage** (storage S3 próprio). A Fase 6c (upload de imagem) está em execução.
>
> ⚠️ **Este arquivo NÃO contém segredos em texto puro.** Senhas, tokens e chaves
> ficam apenas no `.env` local e nas Environment Variables do Coolify. Aqui só
> documentamos *onde* cada segredo vive e *como* acessar. Não cole valores
> secretos neste arquivo — se ele for pro git, vira vazamento permanente.

---

## 1. Visão geral

E-commerce de guppies pedigree (Marchezi Guppy Farm — Guarapari/ES). Substitui o
site antigo WordPress/Elementor por stack moderna, com apresentação video-first,
cálculo de frete, pedidos e gestão de clientes. Build faseado.

- **Domínio de produção:** `https://guppydelinhagem.com.br`
- **Versão atual no ar:** `v0.1.0 · Marchezi` (commit `dda911d`, Fase 6b)

### Visão de produto — "o vídeo é o produto"
O cadastro nasce de **vídeos** (YouTube Shorts primário; Reels/TikTok como adicionais
para melhorar a identificação do peixe). A Fase 7 (IA) lerá o contexto textual dos
vídeos + um briefing manual e pré-preencherá nome/descrição/SEO — o operador revisa
e aprova. A IA **não** analisa os frames do vídeo (caro/impreciso); lê título, legenda
e hashtags.

---

## 2. Stack

| Camada        | Tecnologia                                              |
|---------------|---------------------------------------------------------|
| Framework     | Next.js 16 + Turbopack + React 19 + TypeScript          |
| Pacote        | `guppy-tmp` (dev em `localhost:3000`)                   |
| ORM / Banco   | Prisma 7 + PostgreSQL 18                                 |
| UI            | Tailwind v4 (`@theme` no CSS, sem `tailwind.config.ts`) + shadcn/ui |
| Auth          | NextAuth v5 (split: `auth.config.ts` edge + `lib/auth.ts` node) |
| Storage       | **Garage** (S3-compatible, self-hosted no Coolify)      |
| Gerenciador   | pnpm                                                     |
| Prisma output | `./lib/generated/prisma` (gitignored)                   |

### Design tokens (não derivar)
- Navy `#07366A` · Rosa `#FF035C` · Âmbar `#FAB82A` · Bege `#ECE7E8`
- Fonte **Nunito** (via `next/font/google`, variável `--font-sans`)
- WhatsApp `27 99602-4171` (centralizado em `lib/constants.ts`)

---

## 3. Repositório & ambiente local

- **Repo:** `github.com/hostspry/guppydelinhagem`
- **Branch ativa:** `initial-setup`
- **Path local:** `C:\Users\Manassés\guppydelinhagem` (Windows / PowerShell)
- **Workflow:** este chat = arquiteto/consultor · Claude Code local = executor

### Regra das janelas (não confundir terminais)
- `hostspry@...` → **servidor remoto** (não rode comandos do projeto)
- `PS C:\...` → **sua máquina** (é aqui que roda `pnpm`, `git`, `prisma`)
- `docker exec garage-... /garage ...` → comandos do **Garage** (rodados de fora do
  container, pois a imagem é distroless — sem shell `/bin/sh`)

---

## 4. Servidores

### Coolify — produção (ATIVO)
- **IP:** `15.235.60.77` · **Painel:** `15.235.60.77:8000`
- **SSH:** `ssh hostspry@15.235.60.77` (depois `sudo su` se precisar de Docker)
- **OS:** Ubuntu 24.04 · **Coolify:** v4.1.2
- **Projeto:** `guppy-loja` › ambiente `production`
- **GitHub App:** `coolify-guppy` (App Id `3974066`, Installation Id `138273347`)
- **Auto-deploy:** LIGADO — `git push origin initial-setup` dispara build via webhook
- **Resources no projeto:** app Next (`guppydelinhagem`), `guppy-db` (Postgres),
  `guppy-media` (Garage)

### CapRover — legado (AINDA LIGADO, será descomissionado)
- **IP:** `15.235.28.94` · **SSH:** `ssh hostspry@15.235.28.94` (depois `sudo su`)
- **OS:** Ubuntu 22.04 · **Painel:** `captain.mysite.hostspry.com`
- **Status:** só seed reproduzível (sem dados reais). Fallback até a virada estar
  100% validada. Container Postgres antigo: `srv-captain--guppy-db.1.m73182mf9h1j3i97w100ypoho` (postgres:16)

### DNS / CDN (Cloudflare)
- `guppydelinhagem.com.br` → A → `15.235.60.77` (Coolify) · proxied
- `www` → CNAME → `guppydelinhagem.com.br`
- `media.guppydelinhagem.com.br` → A → `15.235.60.77` (Garage Web) · **proxied
  (nuvem laranja)** — CDN cacheia as imagens na borda

---

## 5. Banco de dados

### Produção (Coolify)
- **Resource:** `guppy-db` (PostgreSQL 18) · **User:** `guppyuser` · **DB:** `guppy`
- **SSL:** desabilitado (rede interna Docker) · **Bind:** `127.0.0.1:5432:5432`
  (só localhost do host — **não exposto à internet**)
- **Estado:** schema completo (6 migrations) + seed (3 categorias, 1 SUPER_ADMIN,
  HeroSlide "Blue Dragon"). Produtos de teste com vídeos já cadastrados.

### Duas DATABASE_URL distintas (NÃO confundir)
| Contexto                      | Host na URL      | Por quê                        |
|-------------------------------|------------------|--------------------------------|
| **Dev local** (`.env`)        | `localhost:5432` | Conecta via túnel SSH          |
| **Runtime Coolify** (env var) | `guppy-db:5432`  | Hostname interno do Docker     |

Formato (sem senha real): `postgresql://guppyuser:<SENHA>@<HOST>:5432/guppy?sslmode=disable`

### Histórico de migrations
```
0001_init
20260604201310_add_hero_slide_and_settings
20260605011610_extend_user_roles_and_password_flow
20260611000000_add_product_destaque        ← Fase 6a
20260611142155_add_product_seo_fields       ← Fase 6b (metaTitle, metaDescription)
20260611142324_extend_product_video         ← Fase 6b (platform, principal, etc.)
```

---

## 6. Acesso ao banco no desenvolvimento (túnel SSH)

1. Abrir o túnel (janela dedicada, deixar parada e viva):
   ```powershell
   ssh -L 5432:127.0.0.1:5432 hostspry@15.235.60.77
   ```
   Não precisa de `sudo` — port forwarding é client-side.
2. `.env` local usa `DATABASE_URL` com `localhost:5432`.
3. Comandos Prisma: `migrate deploy` (aplica existentes), `db seed`, `studio`
   (inspecionar — o Studio do Prisma 7 pode logar `ERR_STREAM_UNABLE_TO_PIPE`, é
   cosmético; ele sobe e funciona na porta indicada).
4. Mudança de schema no dev: `pnpm prisma migrate dev` (cria a migration); o Coolify
   aplica via `migrate deploy` no deploy.

> Fechar a janela do túnel = fechar o acesso. Bom para segurança.

---

## 7. Storage de mídia — Garage (S3-compatible)

Resource `guppy-media` no Coolify (imagem `dxflrs/garage:v2.1.0`).

### Endpoints
| Item                  | Valor                                                      | Uso                |
|-----------------------|------------------------------------------------------------|--------------------|
| S3 API URL (upload)   | `https://s3-c3ymhpteoyy8auhs3eqzrkxk.15.235.60.77.sslip.io` | server-side (SDK)  |
| URL pública (leitura) | `https://media.guppydelinhagem.com.br`                     | servir imagem      |
| Admin URL             | `https://admin-c3ymhpteoyy8auhs3eqzrkxk.15.235.60.77.sslip.io` | admin (token)   |

### Bucket & key
- **Bucket:** `guppy-media` · website access `true`
- **Aliases globais:** `guppy-media` **e** `media.guppydelinhagem.com.br`
  (o 2º é obrigatório: o Garage casa o Host da requisição com o alias do bucket —
  sem ele, o domínio dá 404)
- **Key:** `guppy-app-key` (Access Key ID `GKd4c443a561722adde51cc6bb`) com permissão
  **RW** no bucket. Secret guardado fora deste arquivo.
- **Layout:** nó único, zona `dc1`, 10 GB, replicação 1×.

### Comandos de administração (rodar de fora do container)
Container: `garage-qrvs5c77efdehcayaprvv5rf` (confirmar com `docker ps | grep garage`).
```bash
docker exec garage-<id> /garage status
docker exec garage-<id> /garage bucket info guppy-media
docker exec garage-<id> /garage key create <nome>          # cospe o Secret UMA vez
docker exec garage-<id> /garage bucket allow <bucket> --read --write --key <key>
docker exec garage-<id> /garage bucket alias <bucket> <dominio>   # alias = Host público
```

### Padrão de servir imagem
Upload pelo S3 API (key tipo `produtos/thumbs/<uuid>.<ext>`); URL pública é
`https://media.guppydelinhagem.com.br/<key>`. SDK exige **`forcePathStyle: true`**
(Garage não usa virtual-hosted-style).

---

## 8. Variáveis de ambiente (Coolify)

Localização: **Configuration › Environment Variables** no resource do app.

| Variável                | Valor / observação                                  | Build | Runtime |
|-------------------------|-----------------------------------------------------|:-----:|:-------:|
| `DATABASE_URL`          | host interno `guppy-db`, sslmode=disable            |  ✅   |   ✅    |
| `AUTH_SECRET`           | chave (NextAuth v5)                                  |  ✅   |   ✅    |
| `AUTH_URL`              | `https://guppydelinhagem.com.br`                    |  ✅   |   ✅    |
| `AUTH_TRUST_HOST`       | `true` (obrigatório atrás do proxy Traefik)         |  ✅   |   ✅    |
| `MELHOR_ENVIO_TOKEN`    | `guppydelinhagem-novosite`                          |  ✅   |   ✅    |
| `CEP_ORIGEM`            | `29201010`                                          |  ✅   |   ✅    |
| `APP_VERSION`           | string de versão                                    |  ✅   |   ✅    |
| `S3_ENDPOINT`           | S3 API URL do Garage (`...sslip.io`)                |  —   |   ✅    |
| `S3_REGION`             | `garage`                                            |  —   |   ✅    |
| `S3_BUCKET`             | `guppy-media`                                       |  —   |   ✅    |
| `S3_ACCESS_KEY_ID`      | `GKd4c443a561722adde51cc6bb`                        |  —   |   ✅    |
| `S3_SECRET_ACCESS_KEY`  | (secret guardado)                                   |  —   |   ✅    |
| `S3_PUBLIC_URL`         | `https://media.guppydelinhagem.com.br`              |  —   |   ✅    |

> As `S3_*` são **server-side** (upload e montagem de URL acontecem no servidor),
> não são `NEXT_PUBLIC`. O domínio `media.guppydelinhagem.com.br` entra em
> `next.config.ts → images.remotePatterns` (build-time) e no set de hosts otimizados
> em `lib/utils/image.ts`.

### ⚠️ Lição cara — convenção de nomes NextAuth v4 vs v5
NextAuth **v5** lê `AUTH_*`, **não** `NEXTAUTH_*`. Login dava a volta pro `/login`
porque existia só `NEXTAUTH_URL` (v4) e faltava `AUTH_URL` (v5). Resolvido ao
adicionar `AUTH_URL`. As vars `NEXTAUTH_URL`/`NEXTAUTH_SECRET` são inertes p/ o v5.

### Regras
- `NEXT_PUBLIC_*` → marcar como **Build Variable**.
- Mudança de env var exige **Redeploy** para valer.

---

## 9. Deploy

1. **Código → GitHub:** `git push origin initial-setup` (o Claude Code commita local;
   o **push é manual** — não esquecer, senão o Coolify não vê o código novo).
2. **Auto-deploy:** o push dispara build no Coolify via webhook.
3. **Build:** Dockerfile build pack, porta 3000, ~1 min. Imagem ~700MB.
4. **Migrations:** `migrate deploy` no entrypoint aplica só o pendente.
5. **Pós-deploy:** recarregar com `Ctrl+Shift+R`.

### Checklist antes de cada deploy
- [ ] Fonte Nunito: import `next/font/google` + var `--font-sans` (já quebrou prod).
- [ ] Entrypoint com **LF** (não CRLF) — via `.gitattributes`.
- [ ] `NEXT_PUBLIC_*` marcadas como Build Variable.
- [ ] Env vars novas (ex: `S3_*`) adicionadas no Coolify **antes** do deploy que as usa.

---

## 10. Estado atual (o que está pronto)

### No ar (commit `dda911d`)
- **Fase 1:** Layout admin — sidebar navy, header com drawer mobile, dashboard com
  métricas live.
- **Fase 2:** CRUD de Categorias (molde canônico).
- **Fase 6a:** CRUD base de Produtos.
- **Fase 6b:** Vídeos do produto (N por produto, 1 principal) + campos SEO.
  - YouTube primário: thumbnail e título automáticos (oEmbed). IG/TikTok: manual.
  - Facade: thumbnail na listagem; iframe carrega só no clique (modal). YouTube no
    modal; IG/TikTok hoje abrem URL em nova aba (muda na 6c).
  - Validado em runtime (oEmbed real + round-trip no banco) e no browser.
- Hero redesign, calculadora de frete em `/frete` (Jadlog + Gollog).

### Em execução
- **Fase 6c:** upload de imagem via Garage (capa de IG/TikTok), seletor de frames do
  YouTube, embed de IG/TikTok no modal. Sem migration. `next/image` otimiza o
  domínio do Garage.

### Padrão arquitetural canônico (todas as fases admin)
```
Server Component (lista) → ProductForm (react-hook-form + zodResolver)
  → Server Action → revalidatePath → redirect (sucesso) / toast.error (falha)
```
Reusar componentes existentes — não reinventar.

### Estrutura relevante (6a + 6b)
- `lib/validations/product.ts` — schema Zod (+ `videoDraftSchema`/`videosSchema`)
- `actions/products.ts` — `createProduct`, `updateProduct`, `deleteProduct`,
  `fetchVideoMetadata` (oEmbed YouTube; IG/TikTok manual)
- `lib/queries/products.ts` — `listProducts`, `getProductById`, `getProductFormData`
- `lib/utils/` — `action-result.ts` (compartilhado), `format.ts`, `slug.ts`,
  `video.ts` (parse de URL, thumbnail/embed YouTube), `image.ts` (hosts otimizados)
- `components/admin/` — `ProductForm.tsx`, `ProductVideosField.tsx`,
  `DeleteProductButton.tsx`, + reusáveis (`PageHeader`, `FormField`)
- `app/admin/(painel)/produtos/` — `page.tsx`, `novo/`, `[id]/editar/`

### Decisões técnicas (gotchas acumulados)
- **Checkbox boolean:** `z.coerce.boolean()` trata `"false"` como `true`. Usar
  `z.preprocess` (`checkboxBool`).
- **Decimal não serializa** p/ Client Component: converter em `getProductById`.
- **`redirect()` fora do try/catch** (lança `NEXT_REDIRECT`; no catch vira erro mudo).
- **zodResolver + coerce:** `useForm<z.input<typeof schema>, unknown, Output>`.
- **Vídeos no form:** array em estado do client, serializado como **JSON** num campo
  `videos` do FormData; a action faz `JSON.parse` + valida com `videosSchema`. O
  `updateProduct` reconcilia por **substituição total** (`deleteMany`+`create`) —
  simples porque `ProductVideo` não tem referência externa, mas **recria IDs a cada
  save** (dívida: se a Fase 7 precisar de ID estável de vídeo, trocar p/ upsert).
- **Regra do principal:** exatamente 1 por produto (se nenhum marcado, o 1º vira).
- **Garage/S3:** `forcePathStyle: true` é obrigatório; alias do bucket = domínio público.
- **`ativo`** = publicado/visível · **`destaque`** = vitrine da home.

---


### Futuro: múltiplos tipos de produto (NÃO construir até existir demanda real)

A loja hoje vende **apenas peixe** (guppy de linhagem). Toda a Fase 7 (IA de
geração) e a assinatura institucional da Marchezi foram desenhadas para peixe:
pesquisa de linhagem (origem, genética, manejo) + assinatura de criação.

**Quando a loja passar a vender ração, plantas, equipamentos ou medicamentos**,
esses produtos exigem tratamento diferente:
- A pesquisa de "linhagem" não se aplica (ração não tem genética).
- O prompt de "guppy pedigree" não serve.
- A assinatura "criados com seleção genética" é absurda numa ração.

**Decisão registrada:** NÃO construir o multi-tipo agora (YAGNI — não temos esses
produtos ainda; construir no escuro = refazer depois). Quando a demanda for real:
- Distinguir o comportamento da IA por **categoria/tipo de produto** (a estrutura
  de Categoria já existe e é o gancho natural).
- Assinatura institucional vira **condicional**: peixe tem a da fazenda; outros
  tipos têm outra (ou nenhuma).
- Provável trava intermediária: restringir o botão "Gerar com IA" de linhagem +
  assinatura às categorias de peixe, para não gerar bobagem em produtos não-peixe.

Isso é certo que virá — só não agora.

## 11. Próximos passos

- **Fase 7 — IA (a essência):** campo de briefing em texto livre + a IA lê o contexto
  textual dos vídeos → pré-preenche nome/descrição/descrição-curta e **metaTitle/
  metaDescription** otimizados p/ CTR e SEO → operador revisa e aprova. Server-side
  (Server Action), modelo provável Claude Haiku. Entrega o conteúdo otimizado; o
  rankeamento depende do site público (Fase 4+).
- **Galeria de fotos estáticas** (`ProductImage`, model já existe) reutilizando a
  infra de upload S3 da 6c.
- **Fase 4+:** site público lendo do banco, pedidos, clientes, configurações.
- Subdomínio para o painel Coolify (ex. `coolify.guppydelinhagem.com.br`).
- Automatizar seleção de "produtos em destaque" (hoje boolean manual `destaque`).
- Lógica de carrinho usando `maxPeixesPorCaixa: 10` (em `lib/shipping.ts`).

---

## 12. Pendências de segurança (resolver ANTES do go-live)

> "Go-live" = quando o site receber clientes/dados reais. Hoje é tudo dev.

- [ ] **Rotacionar senha do `guppy-db`** (Coolify) — circulou em texto puro.
- [ ] **Rotacionar a key do Garage** (`guppy-app-key` / `GKd4c443...`) — Key ID
      circulou; recriar key + atualizar `S3_*` antes do go-live.
- [ ] **Gerar `AUTH_SECRET` definitivo** (`openssl rand -base64 33`).
- [ ] **Trocar senha temporária do admin** (`Mana123502`) — depende da UI de Settings.
- [ ] **Revogar PAT antigo do CapRover** — só DEPOIS de confirmar o Coolify definitivo.
- [ ] Manter porta 5432 **fechada** à internet (acesso externo só via túnel SSH).
- [ ] **Fechar acesso externo ao Admin/S3 API do Garage** — hoje os endpoints
      `sslip.io` resolvem pro IP público. O Admin é protegido por token, mas o ideal
      é restringir. O **Web** (imagens públicas) permanece aberto, é o esperado.

---

## 13. Dívida técnica conhecida (não bloqueante)

- `components/site/HeroStatic.tsx` — 2 erros de lint (`react-hooks/static-components`).
  Não quebra build. Corrigir em commit isolado.
- Aviso Next 16: arquivo `middleware` será renomeado para `proxy` em versão futura.
- `updateProduct` recria IDs dos vídeos a cada save (ver gotcha em §10).

---

## 14. Referências rápidas (frete)

- Origem CEP `29201010` · caixa 30×30×30cm, 2kg
- Jadlog service ID `4` (via Melhor Envio)
- Fórmula de preço: `(preço API × 1.5) + R$20`
- Entrega ≥13 dias → dispara aviso de idade do peixe
- ViaCEP para lookup de endereço (público, sem token)

## 15. SEO + GEO (otimização — passo planejado, pós-vitrine)

> **GEO é prioridade FORTE neste projeto** (mais que SEO tradicional). Nicho de guppy
> pedigree + diferencial de criador campeão World Guppy Contest = potencial de ser
> A REFERÊNCIA que as IAs (ChatGPT, Gemini, Perplexity, Claude) citam quando alguém
> pergunta onde comprar/sobre guppy de linhagem no Brasil. Vale mais que disputar
> keyword genérica no Google.

### Já temos (base boa, sem ter planejado)
- `generateMetadata` por produto (meta título/descrição únicos, gerados pela IA Fase 7)
- SSR (Next) — conteúdo legível por buscadores e IAs
- URLs limpas com slug (`/loja/guppy-koi-tuxedo`)
- Conteúdo factual e estruturado (descrição IA, ficha técnica, FAQ) — formato que IA
  generativa gosta de extrair/citar

### Técnico — fase de código (fazer pós-vitrine)
- [ ] **Schema.org / JSON-LD** (MAIOR impacto): Product (preço, disponibilidade,
      imagem), Organization, FAQPage. Habilita rich results no Google E ajuda IA a
      entender a página. **Vale já encaixar na página de produto (está fresca).**
- [ ] sitemap.xml + robots.txt
- [ ] `llms.txt` (arquivo experimental que "explica" o site às IAs)
- [ ] Open Graph completo (preview ao compartilhar no WhatsApp/Instagram)
- [ ] alt text nas imagens
- [ ] Performance / Core Web Vitals (Google ranqueia por velocidade)
- [ ] Deixar EXPLÍCITO em todo lugar (home, sobre, Schema): "criação de guppy pedigree
      do campeão World Guppy Contest" — autoridade citável.

### Estratégico — contínuo, NÃO é código (o que mais move o GEO)
- **Autoridade/menções externas:** IAs citam quem aparece em vários lugares confiáveis
  (fóruns de aquarismo, grupos, vídeos, artigos). O título de campeão mundial é o
  maior ativo — explorar.
- **Blog com conteúdo educativo:** responder dúvidas reais de aquarista (como cuidar de
  guppy koi, diferença halfmoon × delta, como o peixe é enviado vivo). IA cita quem
  responde a pergunta. (O menu já tem "Blog" — verificar se está vazio; se sim, é arma
  subutilizada.)
- **Presença:** YouTube (já é o vídeo primário dos produtos), comunidades, redes.

### Decisão registrada
GEO é foco forte. Fazer a fase técnica depois de fechar a vitrine (página de produto +
/loja), mas adiantar o Schema.org na página de produto enquanto ela está fresca.
