# FASE 4a — Home pública lendo do banco (fim do mock-data)

A home hoje renderiza de `lib/mock-data.ts` (produtos fake). Esta fase troca a fonte
de dados para o **banco real**, sem mudar o visual (a home já está pronta visualmente).
Produtos cadastrados no admin passam a aparecer no site.

Escopo: **só a home**. A página de produto (`/loja/[slug]`) é a 4b; a `/loja` com
filtros é a 4c. NÃO construir carrinho/checkout/pagamento (fases futuras).

═══════ CONTEXTO ═══════

- Os dados reais já existem: produtos cadastrados via admin (Fases 6/7), com vídeos,
  descrição (IA), preço, desconto Pix, estoque, categoria, destaque.
- A home já tem o layout pronto (hero, categorias, seções de produto, etc.) — só está
  lendo do mock. Trocar a fonte, preservar o visual.

═══════ 1. QUERIES (lib/queries/products.ts) ═══════

Reusar/estender o `lib/queries/products.ts` que já existe (das fases admin). Criar
as queries públicas (só produtos `ativo: true`):

- **Mais Procurados** → `where: { ativo: true, destaque: true }`, limit 4.
  (Decisão: enquanto não há vendas registradas, "mais procurados" = destaque manual
  marcado no admin. Trocar por ordenação real de vendas quando a fase de pedidos
  existir.)
- **Últimos Adicionados** → `where: { ativo: true }`, `orderBy: { criadoEm: desc }`,
  limit 4.
- **Casais** → `where: { ativo: true, category: { slug: "casais" } }`, limit 4.
- **Categorias** → query nas categorias existentes (já pode haver query; reusar).

Cada produto retornado precisa do necessário pro card: id, nome, slug, preço,
descontoPix (ou preço Pix calculado), estoque, e o **vídeo principal** (o marcado
`principal: true`) com sua thumbnail/capa para o card.

**Decimal:** converter `preco`/`descontoPix` para `number` antes de passar a Client
Components (lição da 6a — Decimal não serializa).

═══════ 2. CARD DE PRODUTO PÚBLICO ═══════

Se já existe um ProductCard (do mock), adaptá-lo para os dados reais. Requisitos do
card (conforme mockup aprovado):

- Vídeo principal em destaque (vertical 9:16, thumbnail/capa + play; badge da
  plataforma). Facade: thumb no card, sem carregar iframe na listagem.
- **Preço com Pix em destaque:**
  - Preço Pix (cheio − descontoPix) = número **grande, verde** (cor de sucesso).
    Selo "à vista no Pix".
  - Preço cheio = menor, **riscado** (line-through), "no cartão".
  - Ex: **R$ 342** (verde) / ~~R$ 380~~ no cartão.
- Badge "Sem estoque" quando `estoque === 0`.
- Card inteiro é link para `/loja/[slug]` (a página vem na 4b; por ora o link pode
  apontar para lá mesmo que a página ainda não exista — ou desabilitar o clique até
  a 4b. Preferir: link já aponta para `/loja/[slug]`).

═══════ 3. SUBSTITUIR O MOCK ═══════

- As seções da home passam a usar as queries do item 1 (Server Components,
  `Promise.all` para buscar em paralelo, como no dashboard admin).
- **Renderização condicional:** se uma seção não tiver produtos suficientes (ex:
  nenhum produto em "Casais", ou nenhum destaque), a seção **não quebra** — ou some
  graciosamente, ou mostra estado vazio discreto. Não renderizar card quebrado.
- Depreciar `lib/mock-data.ts`: renomear para `.deprecated.ts` ou remover as
  referências. Garantir que nada na home ainda importe o mock.

═══════ 4. REVALIDAÇÃO ═══════

A home deve refletir mudanças do admin. Como o admin já faz
`revalidatePath("/admin/produtos", "layout")` ao salvar, adicionar revalidação das
rotas públicas afetadas quando um produto muda — ex: `revalidatePath("/")` (home) nas
actions de produto (create/update/delete), ou usar ISR (`export const revalidate =
60`) nas páginas públicas. Escolher e documentar. Objetivo: cadastrou/editou no
admin → aparece na home (sem precisar redeploy).

═══════ CRITÉRIOS DE ACEITAÇÃO ═══════

1. A home mostra **produtos reais do banco**, não o mock.
2. "Mais Procurados" = produtos com `destaque: true`.
3. "Últimos Adicionados" = mais recentes.
4. "Casais" = categoria casais (ou some se vazia).
5. Preço com Pix em destaque (verde) + cheio riscado.
6. "Sem estoque" aparece quando estoque 0.
7. Seções sem produtos não quebram o layout.
8. `mock-data.ts` não é mais usado pela home.
9. Editar produto no admin reflete na home (revalidação/ISR).
10. Build limpo. Decimais convertidos (sem erro de serialização).

═══════ ENTREGA ═══════

Commits sugeridos:
1. `feat(loja): queries públicas de produtos (home)`
2. `feat(loja): home lendo do banco + card com Pix em destaque`
3. `chore(loja): deprecia mock-data`

NÃO construir página de produto (4b), /loja (4c), carrinho ou pagamento.
O botão/link do card aponta para /loja/[slug] (a página em si vem na 4b).
