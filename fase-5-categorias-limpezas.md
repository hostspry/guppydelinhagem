# FASE 5 — Categorias padronizadas + limpezas críticas

## Contexto

Pequenas correções visuais críticas que estavam fazendo a home parecer "em construção":

1. Padronizar os 3 cards de categoria
2. Esconder seções com dados insuficientes ("Últimos Adicionados", "Casais de Guppy")
3. Remover o "N" preto lateral (já investigado na Fase 0)

## Tarefas

### 1. Refatorar `components/home/CategoryCard.tsx`

**Mudanças visuais:**

- **Aspect ratio**: forçar `aspect-[4/5]` (retrato) em todos os cards. Isso uniformiza altura visual independentemente da foto que entrar
- **Background**: deixar de mostrar a foto "crua". Aplicar gradient vertical de baixo pra cima por cima da foto:
  ```css
  background: linear-gradient(to top, rgba({base},0.95) 0%, rgba({base},0.55) 45%, transparent 70%)
  ```
  Onde `{base}` é a cor temática do card:
  - Linhagens Exclusivas: navy (`7,54,106`)
  - Sem Linhagem: cinza-grafite (`40,40,40`)
  - Casais de Guppy: rosa-magenta-escuro (`107,22,56`)

**Props expandidas:**

```ts
interface CategoryCardProps {
  title: string;           // "Linhagens Exclusivas"
  description: string;     // "Peixes selecionados e premiados..."
  imageUrl: string;
  href: string;            // "/loja?categoria=linhagens-exclusivas"
  themeColor: 'navy' | 'graphite' | 'rose';  // determina cor do gradient e badge
  badge?: {
    label: string;         // "Premium" | "Variedade" | "Reprodução"
    icon: 'crown' | 'fish' | 'heart';  // ícone lucide-react
  };
}
```

**Layout interno (de cima pra baixo, sobre a foto+overlay):**

Padding 28px 24px 24px no rodapé do card (texto ancorado embaixo).

1. **Badge contextual** (se houver): pílula no topo do bloco de texto, ~10px uppercase tracking, com ícone 12px
   - Pra `themeColor: 'navy'` e `'rose'`: badge âmbar (`bg-[rgba(250,184,42,0.95)] text-[#4a2e00]`)
   - Pra `themeColor: 'graphite'`: badge translúcido branco (`bg-white/20 backdrop-blur text-white`)
2. **Título grande**: Signika 800, 26px, branco, line-height 1, letter-spacing -0.5px. Forçar quebra de linha em 2 com `<br/>` (ex: "Linhagens<br/>Exclusivas")
3. **Descrição**: 13px branco 85% opacidade, line-height 1.5
4. **Link "Ver categoria →"**: 13px peso 600 branco, com border-bottom branco 50% opacidade, padding-bottom 3px, ícone arrow-right 14px

**Hover (desktop):**
- Scale 1.02 no card todo
- Foto interna scale 1.05
- Overlay levemente mais claro (mais foto visível)
- Transition 400ms

**Mobile (< 768px):**
- Em vez de grid 3 colunas, vai pra grid 1 coluna OU manter 3 colunas pequenas dependendo de qual fica melhor visualmente
- Recomendo: `grid-cols-1 md:grid-cols-3 gap-4`
- Cada card mantém aspect-[4/5]

### 2. Atualizar `app/(public)/page.tsx` — seção de categorias

Onde renderiza as 3 categorias, passar os novos props:

```tsx
<CategoryCard
  title="Linhagens Exclusivas"
  description="Peixes selecionados e premiados, ideais para criadores exigentes."
  imageUrl="/assets/home/category-exclusivas.jpg"
  href="/loja?categoria=linhagens-exclusivas"
  themeColor="navy"
  badge={{ label: "Premium", icon: "crown" }}
/>

<CategoryCard
  title="Sem Linhagem"
  description="Guppys comuns, cheios de cores e personalidades únicas."
  imageUrl="/assets/home/category-sem-linhagem.jpg"
  href="/loja?categoria=sem-linhagem"
  themeColor="graphite"
  badge={{ label: "Variedade", icon: "fish" }}
/>

<CategoryCard
  title="Casais de Guppy"
  description="Casais ideais para iniciar ou reforçar sua criação em harmonia."
  imageUrl="/assets/home/category-casais.jpg"
  href="/loja?categoria=casais"
  themeColor="rose"
  badge={{ label: "Reprodução", icon: "heart" }}
/>
```

Se as fotos `/assets/home/category-*.jpg` não existem, use as fotos existentes mais próximas em `/assets/home/` como placeholder e me avise quais nomes você usou pra eu pedir as substituições corretas depois.

### 3. Render condicional das seções de produtos

Em `app/(public)/page.tsx`, modificar a lógica das três seções de produtos:

**Mais Procurados:**
- Sempre renderiza
- Mostra até 4 produtos mais populares (por enquanto, ordenação fake — pegue os 4 primeiros do mock que tenham `inStock` variado)

**Últimos Adicionados:**
- Só renderiza SE `lastAdded.length >= 4` E SE os IDs forem diferentes dos "Mais Procurados"
- Por enquanto no mock: ordene PRODUCTS_MOCK por `createdAt` desc (adicione campo `createdAt` se não existir) e pegue os 4 mais recentes. Se forem os mesmos do "Mais Procurados", **não renderize a seção**.

Implementação prática: como o mock tem só 4 produtos no momento, **a seção "Últimos Adicionados" não vai aparecer** até que tenhamos mais produtos. Isso é desejado.

```tsx
const ultimosAdicionados = produtosOrdenadosPorData.slice(0, 4)
const idsMaisProcurados = new Set(maisProcurados.map(p => p.id))
const ultimosUnicos = ultimosAdicionados.filter(p => !idsMaisProcurados.has(p.id))

{ultimosUnicos.length >= 4 && (
  <section>
    <SectionHeader title="Últimos Adicionados" />
    <ProductGridClient products={ultimosUnicos} />
  </section>
)}
```

**Casais de Guppy:**
- Só renderiza SE houver `≥ 3` produtos na categoria "casais"
- Por enquanto no mock: contar produtos onde `productType === 'CASAL'` ou `category === 'casais'`. Se < 3, **não renderize**.

```tsx
const casais = PRODUCTS_MOCK.filter(p => p.productType === 'CASAL')

{casais.length >= 3 && (
  <section>
    <SectionHeader title="Casais de Guppy" />
    <ProductGridClient products={casais} />
  </section>
)}
```

### 4. Remover o "N" preto lateral

Baseado na investigação da Fase 0, aplicar a correção.

**Se for o Next.js dev indicator:**
- Não é "remover" — só aparece em modo dev, em produção desaparece automaticamente
- Se quiser desabilitar mesmo em dev: adicionar em `next.config.ts`:
  ```ts
  devIndicators: { buildActivity: false }
  ```
  Ou na config nova do Next 16: verifique a sintaxe atual

**Se for componente próprio (ex: botão de newsletter, scroll-to-top):**
- Remover do JSX onde está renderizado
- Se for útil mas mal posicionado, reposicionar (ex: scroll-to-top vai no canto inferior direito, com ícone seta-pra-cima, e só aparece após scroll de 300px)

Me confirme o que achou antes de remover, pra eu validar.

### 5. Limpeza do `next.config.ts`

Remover de `remotePatterns` qualquer entrada relacionada a `guppydelinhagem.com.br` (WordPress antigo). As imagens locais não precisam estar nessa lista.

## Critérios de aceitação

1. Três categorias com mesma altura visual, mesmo tratamento de overlay, badges diferenciados
2. Categoria "Sem Linhagem" agora visível (não some no fundo escuro)
3. "Últimos Adicionados" não aparece com mock atual (4 produtos)
4. "Casais de Guppy" não aparece com mock atual (< 3 casais)
5. Quando eu adicionar mais produtos ao mock, as seções aparecem automaticamente
6. "N" preto sumiu ou está justificadamente lá (caso seja dev indicator do Next)
7. Sem erros no build de produção

## Antes de começar

Confirme comigo:
1. Lista de fotos disponíveis em `/public/assets/home/` (quero saber quais usar como placeholder de categoria)
2. O que era o "N" preto (resultado da Fase 0)

Depois disso, plano de execução, aguarde minha aprovação.
