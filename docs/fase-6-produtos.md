# FASE 6 — CRUD de Produtos (admin)

## Contexto

Produtos é a entidade central da loja e a mais complexa do admin até agora.
Hoje as rotas existem apenas como stubs "Em construção":

- `app/admin/(painel)/produtos/page.tsx`
- `app/admin/(painel)/produtos/novo/page.tsx`
- `app/admin/(painel)/produtos/[id]/page.tsx`

O **CRUD de Categorias** recém-commitado é o **molde arquitetural** a propagar.
Não reinventar nenhum desses padrões:

- `actions/categories.ts` — server actions com `"use server"`, `assertAuthorized()`,
  `safeParse` → `fieldErrors`, `revalidatePath` + `redirect`, tratamento de
  `P2002`/`P2025`.
- `components/admin/CategoryForm.tsx` — `react-hook-form` + `zodResolver`,
  `useTransition`, `FormData` montado no client, `toast` (sonner) só no caminho
  de erro (sucesso faz `redirect` na action).
- `lib/validations/category.ts` — schema Zod + `z.infer`.
- `lib/queries/categories.ts` — funções de leitura usadas pelos Server Components.
- Componentes reutilizáveis **já existentes**: `PageHeader`, `FormField`,
  `DeleteCategoryButton` (AlertDialog), padrão de tabela da listagem.

**Padrão canônico:** Server Component lista → form client → Server Action →
`revalidatePath` → `redirect` (em sucesso) / `toast.error` (em falha).

### Divergências schema × brief (LER ANTES)

Ao planejar, encontrei duas divergências entre o pedido e o `prisma/schema.prisma`
real. Estão registradas como decisões em **"Antes de começar"** — não assumi nada:

1. **Não existe `ProductType.CASAL`.** O enum atual é `ProductType { FISICO, DIGITAL }`.
   O conceito "casal" só existia no `mock-data.ts` da home. A sub-fase 6d depende
   de decidir como modelar isso.
2. **Não existe campo `destaque`.** O `Product` tem `ativo Boolean @default(true)`,
   que é "publicado/visível" — conceito diferente de "destacado na home".

### Model `Product` atual (referência)

```prisma
model Product {
  id             String      @id @default(cuid())
  slug           String      @unique
  nome           String
  descricao      String
  descricaoCurta String?
  preco          Decimal     @db.Decimal(10, 2)
  descontoPix    Decimal?    @db.Decimal(5, 2)   // % de desconto no Pix
  parcelasMax    Int         @default(3)
  tipo           ProductType @default(FISICO)
  estoque        Int         @default(0)
  peso           Decimal?    @db.Decimal(8, 3)   // kg — frete
  comprimento    Decimal?    @db.Decimal(8, 2)   // cm — frete
  largura        Decimal?    @db.Decimal(8, 2)   // cm — frete
  altura         Decimal?    @db.Decimal(8, 2)   // cm — frete
  ativo          Boolean     @default(true)
  categoryId     String
  criadoEm       DateTime    @default(now())
  atualizadoEm   DateTime    @updatedAt

  category   Category        @relation(fields: [categoryId], references: [id])
  imagens    ProductImage[]
  videos     ProductVideo[]
  waitlist   WaitlistEntry[]
  orderItems OrderItem[]
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  url       String
  alt       String?
  ordem     Int     @default(0)
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model ProductVideo {
  id           String        @id @default(cuid())
  productId    String
  platform     VideoPlatform // INSTAGRAM | TIKTOK | YOUTUBE
  videoId      String
  originalUrl  String
  thumbnailUrl String?
  ordem        Int           @default(0)
  product      Product @relation(fields: [productId], references: [id], onDelete: Cascade)
}
```

Constante relevante já existente: `FRETE_CONFIG.maxPeixesPorCaixa = 10` em
`lib/shipping.ts` (limite por caixa — relevante para estoque/carrinho futuros,
**não** para o CRUD em si nesta fase).

---

## Estratégia: 4 sub-fases incrementais

Cada sub-fase é um PR fechado e revisável. **Não** entregar tudo num PR gigante.

| Sub-fase | Escopo | Toca o schema? |
|----------|--------|----------------|
| **6a** | CRUD base: escalares + relação `Category` + `tipo`. Sem imagens/vídeos. | Possivelmente (`destaque`) |
| **6b** | Upload e gestão de `ProductImage[]` via Cloudinary | Não |
| **6c** | Gestão de `ProductVideo[]` (YouTube Shorts, thumbnail/facade) | Não |
| **6d** | Tratamento especial de "casal" | Sim (modelagem) |

Cada sub-fase termina com: build de produção limpo, listagem funcionando, e o
fluxo criar/editar/excluir testável manualmente.

---

## 6a — CRUD base (escalares + categoria + tipo)

Espelha Categorias quase 1:1, com mais campos. **Sem** imagens nem vídeos ainda
(o produto é criado "pelado"; mídia entra em 6b/6c via tela de edição).

### Arquivos a criar/editar

**Criar:**
- `lib/validations/product.ts` — schema Zod + `z.infer`.
- `actions/products.ts` — `createProduct`, `updateProduct`, `deleteProduct`,
  `toggleAtivo` (opcional).
- `lib/queries/products.ts` — `listProducts`, `getProductById`, `getProductFormData`.
- `components/admin/ProductForm.tsx` — form client (molde do `CategoryForm`).
- `components/admin/DeleteProductButton.tsx` — molde do `DeleteCategoryButton`.

**Editar (substituir stubs):**
- `app/admin/(painel)/produtos/page.tsx` — listagem (tabela, molde da de categorias).
- `app/admin/(painel)/produtos/novo/page.tsx` — Server Component que carrega
  categorias e renderiza `<ProductForm>`.
- `app/admin/(painel)/produtos/[id]/page.tsx` — hoje é o detalhe; criar também
  `app/admin/(painel)/produtos/[id]/editar/page.tsx` para manter a convenção de
  Categorias (`/[id]/editar`). **Decisão de rota — ver "Antes de começar".**

### Schema Zod (`lib/validations/product.ts`)

```ts
export const productSchema = z.object({
  nome:           z.string().min(2, "Mínimo 2 caracteres").max(120),
  slug:           z.string().min(2).regex(/^[a-z0-9-]+$/, "Apenas minúsculas, números e hífen"),
  descricao:      z.string().min(10, "Descrição muito curta"),
  descricaoCurta: z.string().max(160).optional().or(z.literal("")),
  preco:          z.coerce.number().positive("Preço deve ser maior que zero"),
  descontoPix:    z.coerce.number().min(0).max(100).optional(),      // %
  parcelasMax:    z.coerce.number().int().min(1).max(12).default(3),
  tipo:           z.enum(["FISICO", "DIGITAL"]),                     // ver 6d p/ CASAL
  estoque:        z.coerce.number().int().min(0, "Não pode ser negativo"),
  categoryId:     z.string().min(1, "Selecione uma categoria"),
  ativo:          z.coerce.boolean().default(true),
  // Frete (opcionais nesta fase — ver decisão D3):
  peso:           z.coerce.number().positive().optional(),
  comprimento:    z.coerce.number().positive().optional(),
  largura:        z.coerce.number().positive().optional(),
  altura:         z.coerce.number().positive().optional(),
});
export type ProductInput = z.infer<typeof productSchema>;
```

Notas de validação:
- `preco`/`descontoPix`/`peso`/dimensões são `Decimal` no Prisma → enviar como
  `string`/`number` e deixar o Prisma converter. Zod valida o range, o Prisma o tipo.
- `slug` único → tratar `P2002` na action (igual Categorias).

### Server actions (`actions/products.ts`)

Mesma espinha de `actions/categories.ts` (`assertAuthorized`, `safeParse`,
`isPrismaError`, `revalidatePath("/admin/produtos")` + `redirect`).

```ts
createProduct(formData: FormData): Promise<ActionResult>
// valida → prisma.product.create({ data }) → revalidate → redirect("/admin/produtos")

updateProduct(id: string, formData: FormData): Promise<ActionResult>
// valida → prisma.product.update({ where:{id}, data }) → trata P2002/P2025 → redirect

deleteProduct(id: string): Promise<ActionResult>
// checa vínculos que IMPEDEM exclusão: orderItems > 0 → bloqueia (histórico de venda).
// imagens/vídeos têm onDelete: Cascade — somem junto, ok.
// waitlist: decidir (provavelmente bloquear ou avisar). → ver decisão.
```

Reaproveitar o tipo `ActionResult` e `assertAuthorized` — considerar **extrair**
ambos para `lib/utils/action-result.ts` agora (DRY entre categories/products),
em vez de copiar. **Pequena refatoração — ver "Antes de começar" (D4).**

### Queries (`lib/queries/products.ts`)

```ts
listProducts()        // findMany com include category + _count imagens/videos, orderBy criadoEm desc
getProductById(id)    // findUnique p/ tela de edição (sem mídia em 6a, mas já incluir p/ 6b/6c)
getProductFormData()  // { categorias } p/ popular o <select> de categoria no form
```

### Componentes UI

- **Listagem** (`produtos/page.tsx`): tabela molde da de categorias. Colunas
  sugeridas: Nome, Categoria, Preço (formatado BRL), Estoque, Ativo (badge), Ações.
  Reusar `PageHeader` + botão "Novo produto". Estado vazio idêntico ao de categorias.
- **`ProductForm`**: reusar `FormField` para cada campo. Auto-slug a partir do nome
  (copiar `handleNomeChange`/`slugManuallyEdited` do `CategoryForm`). `<select>` de
  categoria populado por `getProductFormData()`. Agrupar visualmente: "Básico"
  (nome, slug, categoria, tipo), "Preço & estoque" (preco, descontoPix, parcelasMax,
  estoque), "Frete" (peso, dimensões — se D3 = incluir), "Publicação" (ativo).
- **`DeleteProductButton`**: molde do de categorias; mensagem do AlertDialog avisa
  se há `orderItems` (bloqueia) e que imagens/vídeos serão removidos junto.

### Pontos de decisão/risco — 6a

- **D1 (rota de edição):** seguir convenção `/[id]/editar` (igual Categorias) e
  deixar `/[id]` como detalhe? Ou usar `/[id]` direto como edição? Recomendo
  `/[id]/editar` para consistência.
- **D3 (campos de frete):** incluir `peso`/dimensões já no form de 6a, ou deixar
  para uma sub-fase posterior (mantendo 6a enxuto)? Ver "Antes de começar".
- **Risco:** `Decimal` do Prisma não serializa direto para Client Component
  (`getProductById` → form de edição). Converter para `number`/`string` na query
  antes de passar como prop. Tratar isso explicitamente no `getProductById`.

---

## 6b — Imagens (`ProductImage[]`) via Cloudinary

Cloud name: `dvqrxgkbg`. Assumir credenciais **já rotacionadas e em env vars**
(`CLOUDINARY_*`). Gestão de imagens acontece na **tela de edição** do produto
(o produto já existe; 6a o criou).

### Arquivos a criar/editar

**Criar:**
- `lib/cloudinary.ts` — config do SDK / helper de assinatura (depende de D-upload).
- `actions/product-images.ts` — `addProductImage`, `deleteProductImage`,
  `reorderProductImages`, `updateImageAlt`.
- `components/admin/ProductImageManager.tsx` — uploader + grid de imagens (client).
- (se signed) `app/api/cloudinary/sign/route.ts` — endpoint que assina o upload.

**Editar:**
- `app/admin/(painel)/produtos/[id]/editar/page.tsx` — montar `<ProductImageManager>`
  abaixo do form, recebendo `imagens` do produto.
- `lib/queries/products.ts` — `getProductById` passa a incluir `imagens` ordenadas.

### Schema Zod

```ts
export const productImageSchema = z.object({
  productId: z.string().min(1),
  url:       z.string().url(),          // URL retornada pelo Cloudinary
  alt:       z.string().max(120).optional(),
  ordem:     z.coerce.number().int().min(0).default(0),
});
```

Validação de upload (tamanho/tipo) é primariamente client-side + restrição no
upload preset do Cloudinary; a action só persiste a URL final.

### Server actions (`actions/product-images.ts`)

```ts
addProductImage(formData)            // persiste { productId, url, alt, ordem=próxima } → revalidate
deleteProductImage(imageId)          // apaga no banco; (opcional) apaga no Cloudinary via API
reorderProductImages(productId, ids) // recebe array ordenado de ids → atualiza `ordem` em lote
updateImageAlt(imageId, alt)         // edição de alt (acessibilidade/SEO)
```

`revalidatePath('/admin/produtos/[id]/editar', 'page')`.

### Componentes UI

- **`ProductImageManager`**: grid das imagens existentes (thumb, alt, drag-handle,
  botão excluir) + dropzone de upload. Upload mostra progresso; ao concluir chama
  `addProductImage`. Reordenação via drag-and-drop chamando `reorderProductImages`.
- Primeira imagem (`ordem = 0`) = capa do produto na loja (documentar a convenção).

### Pontos de decisão/risco — 6b

- **D-upload (CRÍTICO):** **unsigned** (upload preset público, client envia direto
  ao Cloudinary — mais simples, sem secret no fluxo) **vs. signed** (server action /
  route gera assinatura com o API secret — mais seguro/controlado). Recomendo
  **signed** dado que o admin é autenticado e queremos controle. Precisa aprovação.
- **Delete no Cloudinary:** ao excluir a imagem, apagamos só o registro no banco ou
  também o asset no Cloudinary (precisa API secret + `public_id`)? Se sim, guardar
  `public_id` além da `url` (campo extra ou derivar da url).
- **Risco:** `ProductImage` não tem `public_id`. Se formos deletar/transformar
  assets, convém **adicionar `publicId String?`** ao schema. Decidir em 6b.

---

## 6c — Vídeos (`ProductVideo[]`)

Foco em **YouTube Shorts** como primário; Instagram/TikTok como secundários.
Estratégia de **facade**: na listagem/PDP mostra-se a **thumbnail**; o `<iframe>`
só carrega sob demanda (clique). O model `ProductVideo` já existe e suporta isso
(`platform`, `videoId`, `originalUrl`, `thumbnailUrl`, `ordem`).

### Arquivos a criar/editar

**Criar:**
- `lib/utils/video.ts` — `parseVideoUrl(url)` → `{ platform, videoId }`;
  `youtubeThumbnail(videoId)` → `https://img.youtube.com/vi/{id}/maxresdefault.jpg`.
- `actions/product-videos.ts` — `addProductVideo`, `deleteProductVideo`,
  `reorderProductVideos`, `updateVideoThumbnail`.
- `components/admin/ProductVideoManager.tsx` — input de URL + lista de vídeos (client).

**Editar:**
- `app/admin/(painel)/produtos/[id]/editar/page.tsx` — montar `<ProductVideoManager>`.
- `lib/queries/products.ts` — `getProductById` inclui `videos` ordenados.

### Schema Zod

```ts
export const productVideoSchema = z.object({
  productId:    z.string().min(1),
  originalUrl:  z.string().url("URL inválida"),
  // platform + videoId DERIVADOS de originalUrl no server (parseVideoUrl).
  thumbnailUrl: z.string().url().optional(),   // override manual; senão auto p/ YouTube
  ordem:        z.coerce.number().int().min(0).default(0),
});
```

### Server actions (`actions/product-videos.ts`)

```ts
addProductVideo(formData)
// parseVideoUrl(originalUrl) → { platform, videoId }; se YouTube e sem thumbnail
// manual → thumbnailUrl = youtubeThumbnail(videoId). Persiste e revalida.

updateVideoThumbnail(videoId, thumbnailUrl)  // override manual (ex: Shorts sem maxres)
deleteProductVideo(videoId)
reorderProductVideos(productId, ids)
```

### Componentes UI

- **`ProductVideoManager`**: campo "cole a URL do vídeo" → preview da thumbnail
  derivada + badge da plataforma. Lista com reordenação. Campo opcional de override
  de thumbnail (URL manual ou — futuro — upload). Sem player no admin; só thumbnail.
- Documentar a convenção de **facade** para reuso na PDP pública (fora desta fase).

### Pontos de decisão/risco — 6c

- **Thumbnail de Shorts:** `maxresdefault.jpg` às vezes não existe para Shorts;
  fallback para `hqdefault.jpg`. Definir cadeia de fallback no helper.
- **Instagram/TikTok:** não expõem thumbnail por URL pública estável → exigem
  **override manual** obrigatório. Confirmar que está ok no escopo desta fase
  (provavelmente: YouTube auto, IG/TikTok manual).
- **Risco baixo:** nenhuma mudança de schema esperada (`thumbnailUrl` já é nullable).

---

## 6d — Tratamento de "casal"

**Bloqueado pela decisão D2 (modelagem).** O enum atual é `FISICO`/`DIGITAL`; não
há `CASAL`. Casal é, na prática, um produto que combina macho+fêmea — pode ser
modelado de 3 formas (ver "Antes de começar"). Esta sub-fase só será detalhada
**após** essa decisão; o esqueleto provável:

### Esboço (depende de D2)

- **Se enum estendido (`+ CASAL`):** migration no `prisma/schema.prisma`; adicionar
  `"CASAL"` ao `z.enum` em `product.ts`; lógica condicional no `ProductForm`
  (ex: campos de macho/fêmea, ou apenas rótulo/badge diferente).
- **Se categoria dedicada ("casais"):** sem mudança de enum; "casal" vira uma
  `Category`; lógica fica em queries/UI por `categoryId`.
- **Se relação de pareamento:** model novo ligando dois `Product` (mais complexo;
  provavelmente exagero para agora).

Documentar regras específicas (estoque do casal vs. estoque individual; frete —
um casal conta como 2 peixes para `maxPeixesPorCaixa`?) **depois** de D2.

### Pontos de decisão/risco — 6d

- **D2 é o gargalo.** Sem ela, 6d não começa. As demais sub-fases (6a/6b/6c) **não**
  dependem de D2 e podem rodar antes.

---

## Critérios de aceitação (por sub-fase)

**6a**
1. Listagem mostra produtos com categoria, preço BRL, estoque e status ativo.
2. Criar produto válido persiste e redireciona para a listagem.
3. Slug duplicado mostra erro amigável (toast), sem quebrar.
4. Editar carrega valores atuais (incl. `Decimal` convertido) e salva.
5. Excluir produto sem vendas funciona; produto com `orderItems` é bloqueado.
6. Build de produção limpo.

**6b**
1. Upload adiciona imagem ao produto e ela aparece no grid sem reload manual.
2. Reordenar persiste a `ordem`; primeira imagem = capa.
3. Excluir imagem remove do banco (e do Cloudinary, se D-delete = sim).

**6c**
1. Colar URL de YouTube Short gera thumbnail automática e salva `platform/videoId`.
2. Override manual de thumbnail funciona.
3. IG/TikTok aceitos com thumbnail manual.
4. Reordenar e excluir funcionam.

**6d**
1. Conforme D2 (definir após a decisão).

---

## Antes de começar — decisões que preciso que você aprove

Estas 4 destravam a 6a (e a 6d). Aguardo sua resposta antes de codar:

1. **D2 — Como modelar "casal"?** (gargalo da 6d, mas decide já o `z.enum` da 6a)
   - (a) Estender `enum ProductType` com `CASAL` (migration);
   - (b) Tratar casal como uma **Category** "casais" (sem mexer no enum) — **recomendo**;
   - (c) Model de pareamento ligando dois produtos (mais complexo).

2. **D-destaque — Criar campo `destaque Boolean` no `Product`?** Hoje só existe
   `ativo` (= publicado/visível). "Destacado na home" é outro conceito. Opções:
   (a) adicionar `destaque Boolean @default(false)` via migration (recomendo, é o
   que a home pede); (b) reaproveitar `ativo`; (c) deixar destaque por outra via
   (ex: seção curada). Afeta o `ProductForm` da 6a.

3. **D3 — Campos de frete (`peso`/`comprimento`/`largura`/`altura`) entram já na 6a?**
   (a) Incluir no form agora (úteis para Melhor Envio depois); (b) deixar fora da 6a
   para manter o form enxuto e adicionar numa sub-fase de "frete/dimensões". Recomendo
   (a), todos opcionais.

4. **D-upload — Estratégia Cloudinary (6b):** **signed** (server assina, mais seguro
   — recomendo) **vs. unsigned** (upload preset público, mais simples). Decide se
   criamos `app/api/cloudinary/sign/route.ts` e se guardamos `publicId` no schema.

**Bônus (baixo impacto):** D4 — extrair `ActionResult` + `assertAuthorized` para
`lib/utils/` e reusar entre `categories`/`products` (DRY), em vez de copiar? Recomendo sim.

Depois das aprovações: plano de execução da **6a** e aguardo seu OK.
