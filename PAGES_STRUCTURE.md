# Estrutura das Páginas — guppydelinhagem.com.br

Extraído do HTML em 2026-04-19. Todas as 5 páginas mapeadas em ordem top → bottom, ignorando header e footer globais (documentados separadamente em DESIGN_TOKENS.md).

---

## PÁGINA 1 — Home (`/`)

### Seção 1 — Barra Informativa Superior

| Campo | Valor |
|-------|-------|
| **Tipo** | Barra de avisos + ícones sociais (icon-list horizontal) |
| **Itens** | 3 |
| **Fundo** | `#07366A` (navy) |

**Conteúdo:**
1. "Siga-nos :" + ícones Instagram e Facebook
2. "Frete Grátis Para Pedidos Acima de R$ 500!" (ícone caminhão)
3. "Rastreamento de Pedidos" (ícone localização)

**CTA:** nenhum botão — apenas links de ícone social

---

### Seção 2 — Hero Principal

| Campo | Valor |
|-------|-------|
| **Tipo** | Hero com imagem de fundo + campo de busca + CTA |
| **Itens** | 1 bloco de texto + 1 buscador + 1 botão |
| **Fundo** | `#ECE7E8` com imagem `banner01-principal.png` |

**Conteúdo:**
- **H3:** "Seu Guppy **Novo Aqui!**" (destaque em `#FAB82A`)
- **H1:** "Guppys de **Linhagem**"
- **Subtexto:** "Peixes selecionados, saudáveis e com genética apurada para aquaristas exigentes. **Transforme seu aquário com beleza, qualidade e vitalidade.** Envio seguro para todo o Brasil!"
- **Buscador WooCommerce:** placeholder "Estou Procurando Por..."
- **Logo** (imagem, 60% de largura)

**Ícones de atalho abaixo do logo:**
- "Linhagem Premium" → `/loja/?product_cat=peixes-de-linhagem`
- "27 99759-4173" → `https://wa.me/27997594173`

**CTA:** Botão **"Ver Loja"** → `/loja/`

---

### Seção 3 — Grade de Categorias Principais

| Campo | Valor |
|-------|-------|
| **Tipo** | Grid de cards de categoria (3 colunas + "Mais") |
| **Itens** | 4 |

**Headline:**
- **H2:** "Principais **Categorias**"
- **Subtítulo:** "Guppys exclusivos, exóticos e raros! Só na **Guppy de Linhagem!**"

**Itens:**
| # | Título | Descrição | CTA |
|---|--------|-----------|-----|
| 1 | Linhagens Exclusivas | "Navegue e filtre por todas as linhagens selecionadas e premium que trabalhamos." | "Ver Categoria" → `/loja/?product_cat=peixes-de-linhagem` |
| 2 | Sem Linhagem | "Explore e descubra nossos guppys comuns, cheios de cores e personalidades únicas." | "Ver Categoria" → `/loja/?product_cat=peixes-sem-linhagem` |
| 3 | Casais | "Encontre casais de guppys ideais para iniciar ou reforçar sua criação com harmonia e beleza." | "Ver Categoria" → `/loja/?product_cat=casais` |
| 4 | Mais | (aponta para mais categorias) | — |

---

### Seção 4 — Mais Procurados

| Campo | Valor |
|-------|-------|
| **Tipo** | Grid de produtos WooCommerce (4 colunas) |
| **Itens** | 4 produtos |

**Headline:** **H2:** "Mais **Procurados**"
**CTA de seção:** Botão **"Ver Tudo"** → `/loja/?product_cat=peixes-de-linhagem`

**Produtos:**
| Produto | Preço | Status |
|---------|-------|--------|
| Casal Yellow Tiger | R$ 375,00 | Sem estoque |
| Guppy Dragon Blue | R$ 380,00 | Em estoque |
| Guppy Full Black | R$ 250,00 | Em estoque |
| Guppy Red Dragon | R$ 312,50 | Em estoque |

---

### Seção 5 — Últimos Adicionados

| Campo | Valor |
|-------|-------|
| **Tipo** | Grid de produtos WooCommerce (4 colunas) |
| **Itens** | 4 produtos |

**Headline:** **H2:** "Últimos **Adicionados**"
**CTA de seção:** Botão **"Ver Tudo"** → `/loja/`

**Produtos:** Dragon Blue (R$380), Yellow Tiger (R$375), Full Black (R$250), Red Dragon (R$312,50)

---

### Seção 6 — História de Vitórias (Texto + Imagem)

| Campo | Valor |
|-------|-------|
| **Tipo** | Bloco texto + imagem (2 colunas) |
| **Itens** | 1 imagem + 1 bloco de texto |

**Headline:** **H2:** "História de **Vitórias** e **Guppys Campeões**"

**Subtexto:** "Nossa trajetória é marcada por **dedicação, excelência em genética e conquistas em competições**. Conheça a história por trás da criação que transforma paixão em guppys premiados."

**CTA:** Botão **"Saiba Mais"** → `/sobre-nos/`

---

### Seção 7 — CTA Conheça os Guppy

| Campo | Valor |
|-------|-------|
| **Tipo** | CTA isolado com título e botão (banner de chamada) |
| **Itens** | 1 |

**Headline:** **H3:** "Aprenda Sobre, Como Criar e Mais!"

**CTA:** Botão **"Conhecer"** → `/conheca-os-guppy/`

---

### Seção 8 — Casais de Guppy

| Campo | Valor |
|-------|-------|
| **Tipo** | Grid de produtos WooCommerce (4 colunas) |
| **Itens** | 4 produtos (categoria Casais) |

**Headline:** **H2:** "Casais de **Guppy**"
**CTA de seção:** Botão **"Ver Tudo"** → `/loja/?product_cat=casais`

---

### Seção 9 — Avaliações de Clientes

| Campo | Valor |
|-------|-------|
| **Tipo** | Grid de depoimentos (foto + nome + cidade + texto, 3 colunas) |
| **Itens** | 3 depoimentos |

**Headline:** **H2:** "Avaliações de Clientes"

| # | Nome | Cidade | Texto |
|---|------|--------|-------|
| 1 | Juliana T. | Curitiba-PR | "Nunca vi guppys tão bonitos! Atendimento excelente e entrega super rápida. A loja tem uma variedade incrível, os peixes são realmente como nas fotos e com genética de alto nível!" |
| 2 | Carlos M. | Campinas-SP | "Comprei um casal e fiquei impressionado com a qualidade! Cores vivas, ativos e muito saudáveis. Dá pra ver que são peixes bem cuidados, vieram muito bem embalados e adaptaram super rápido ao aquário." |
| 3 | André S. | Salvador-BA | "Os peixes chegaram perfeitos e lindos! Dá pra ver o cuidado com cada detalhe. A equipe foi super atenciosa no atendimento e os guppys vieram cheios de energia. Estou muito satisfeito!" |

---

### Seção 10 — Diferenciais (Icon-Box)

| Campo | Valor |
|-------|-------|
| **Tipo** | Grid de 4 cards com ícone + título + descrição (4 colunas) |
| **Itens** | 4 |

| Ícone | Título | Descrição |
|-------|--------|-----------|
| Caminhão | Envio Nacional | Envio para todo o Brasil |
| Troféu | Linhagem Pura | Peixes Premiados |
| Caixa | Envio Seguro | Pensado na Saúde do Animal |
| Mãos | Suporte e Direcionamento | Suporte via Whats com Profissional |

**CTA:** nenhum

---

### Seção 11 — CTA WhatsApp

| Campo | Valor |
|-------|-------|
| **Tipo** | CTA isolado com texto + ícone + botão |
| **Itens** | 1 |

**Texto:** "Criação especializada de guppies selecionados, com foco em saúde, padrão e genética. Aqui, cada peixe conta uma história."

**Ícone:** WhatsApp "27 99759-4173"

**CTA:** Botão **"Entrar em Contato"** → `https://wa.me/27997594173`

---

### Resumo — Home

| # | Seção | Tipo | Itens | CTA Principal |
|---|-------|------|-------|---------------|
| 1 | Barra informativa | Aviso + sociais | 3 | — |
| 2 | Hero Principal | Hero + buscador | 1 bloco + busca | "Ver Loja" → /loja/ |
| 3 | Categorias Principais | Grid categorias | 4 | "Ver Categoria" × 3 |
| 4 | Mais Procurados | Grid produtos | 4 | "Ver Tudo" → /loja/?cat=linhagem |
| 5 | Últimos Adicionados | Grid produtos | 4 | "Ver Tudo" → /loja/ |
| 6 | História de Vitórias | Texto + imagem | 1 | "Saiba Mais" → /sobre-nos/ |
| 7 | CTA Conheça os Guppy | CTA isolado | 1 | "Conhecer" → /conheca-os-guppy/ |
| 8 | Casais de Guppy | Grid produtos | 4 | "Ver Tudo" → /loja/?cat=casais |
| 9 | Avaliações | Depoimentos 3col | 3 | — |
| 10 | Diferenciais | Icon-box 4col | 4 | — |
| 11 | CTA WhatsApp | CTA isolado | 1 | "Entrar em Contato" → wa.me |

---

---

## PÁGINA 2 — Sobre Nós (`/sobre-nos`)

### Seção 1 — Hero / Banner de Página

| Campo | Valor |
|-------|-------|
| **Tipo** | Hero de página com título centralizado |
| **Fundo** | Imagem com overlay `#FF035C` |

**Conteúdo:**
- **H2:** "Sobre Nós"
- **H2:** "Onde a Linhagem de Guppys Se **Torna Arte e Tradição**" (destaque em `#FAB82A`)

**CTA:** nenhum

---

### Seção 2 — História da Empresa

| Campo | Valor |
|-------|-------|
| **Tipo** | Bloco de texto narrativo (institucional) |
| **Itens** | 1 bloco de texto |

**Texto:**
> "A Marchezi Guppy Farm nasceu em 2019 de uma paixão familiar que ultrapassa gerações. Fundada por Manassés Marchezi e seu pai Vanderli Marchezi, nossa criação começou de forma simples, com poucos aquários e um sonho claro: desenvolver linhagens nobres de guppies com qualidade genética, saúde e padrão internacional.
>
> A história de amor pelos peixes começou ainda na infância de Manassés, durante as pescarias com o pai em brejos, rios, lagoas e praias. 'Lembro como se fosse hoje do primeiro aquário que meu pai me deu, quando eu tinha por volta de 9 anos. Foi ali que tudo começou. Desde então, nunca mais consegui parar.'
>
> Com o tempo, a paixão evoluiu para uma estufa moderna e estruturada, onde os guppies são criados com excelência, sob rigoroso controle de qualidade da água, nutrição balanceada e seleção genética criteriosa."

**CTA:** nenhum

---

### Seção 3 — Conquistas e Títulos

| Campo | Valor |
|-------|-------|
| **Tipo** | Bloco de texto com marcos históricos e conquistas |
| **Itens** | 1 bloco de texto |

**H5:** "Conquistando Espaço"

**Texto:**
> "Em janeiro de 2022, fomos destaque no jornal A Tribuna, o maior do Espírito Santo, com uma matéria especial que apresentou nossa história, os valores familiares e o envolvimento da filha de Manassés, Sarah Marchezi, na continuidade desse legado.
>
> No final de 2023, com a idade avançada dos pais, a criação foi transferida de Piúma para Guarapari, marcando uma nova fase com a chegada de Vinicius Pirovani à equipe.
>
> Esse ano também marcou nossa entrada no cenário mundial, com duas conquistas históricas no III WORLD GUPPY CONTEST VIRTUAL – 2023:
> 🥇 Guppy Full Black — campeão mundial na categoria Delta Tail – ¾ Black - Moscow Black.
> 🥇 Blue Dragon Halfmoon — campeão mundial na categoria Half Moon.
>
> Em 2024, a linhagem Full Black conquistou o bicampeonato no World Guppy Contest Virtual."

**CTA:** Botão **"Ver Loja"** → `/loja/`

---

### Seção 4 — Avaliações de Clientes

| Campo | Valor |
|-------|-------|
| **Tipo** | Grid de depoimentos (foto + nome + cidade + texto, 3 colunas) |
| **Itens** | 3 (idênticos aos da home) |

**Headline:** **H2:** "Avaliações de Clientes"

*(Mesmos 3 depoimentos da Home — Juliana T., Carlos M., André S.)*

**CTA:** Botão **"Entrar em Contato"** → `/contatos/` (ou WhatsApp)

---

### Resumo — Sobre Nós

| # | Seção | Tipo | Itens | CTA |
|---|-------|------|-------|-----|
| 1 | Hero | Banner com título | 1 | — |
| 2 | História da empresa | Texto narrativo | 1 | — |
| 3 | Conquistas e títulos | Texto com marcos | 1 | "Ver Loja" → /loja/ |
| 4 | Avaliações | Depoimentos 3col | 3 | "Entrar em Contato" |

---

---

## PÁGINA 3 — Contatos (`/contatos`)

### Seção 1 — Hero / Banner de Página

| Campo | Valor |
|-------|-------|
| **Tipo** | Hero de página com título centralizado |
| **Fundo** | Imagem com overlay `#FF035C` |

**Conteúdo:**
- **H2:** "Contatos"

**CTA:** nenhum

---

### Seção 2 — Informações de Contato + Formulário

| Campo | Valor |
|-------|-------|
| **Tipo** | Layout 2 colunas: esquerda = dados, direita = formulário |

**Coluna Esquerda — Dados de Contato:**

**Ícone + H3:** "Dúvidas?" (ícone envelope)

**Subtexto:** "Precisa de ajuda ou está procurando seu primeiro Guppy para comprar? Entre em contato agora mesmo!"

| Ícone | Dado |
|-------|------|
| WhatsApp | (27) 99759-4173 → `https://wa.me/27997594173` |
| E-mail | info@seuemail.com *(placeholder)* |
| Localização | "Endereço da Loja, número, bairro, cidade e CEP" *(placeholder)* |

**Coluna Direita — Formulário de Contato:**

| Campo | Tipo | Placeholder | Obrigatório |
|-------|------|-------------|-------------|
| Nome | text | "Nome" | Sim |
| Telefone | text | "DDD + Número" | Não |
| Email | email | "Email" | Sim |
| Mensagem | textarea | "Escreva a sua dúvida aqui..." | Não |

**CTA:** Botão **"Envia Dúvida"** (submit, 30% largura desktop / 50% tablet)

---

### Seção 3 — Mapa Google Maps

| Campo | Valor |
|-------|-------|
| **Tipo** | Google Maps embed (iframe) |
| **Itens** | 1 |

**Embed atual:** London Eye, London, UK *(placeholder — deve ser substituído pelo endereço real em Guarapari-ES)*

**CTA:** nenhum

---

### Resumo — Contatos

| # | Seção | Tipo | Itens | CTA |
|---|-------|------|-------|-----|
| 1 | Hero | Banner com título | 1 | — |
| 2 | Dados + Formulário | 2 colunas (info + form) | 3 contatos + 4 campos | "Envia Dúvida" (submit) |
| 3 | Mapa | Google Maps embed | 1 (placeholder) | — |

---

---

## PÁGINA 4 — Conheça os Guppy (`/conheca-os-guppy`)

### Seção 1 — Hero / Banner de Página

| Campo | Valor |
|-------|-------|
| **Tipo** | Hero de página com título centralizado |
| **Fundo** | Imagem com overlay `#FF035C` |

**Conteúdo:**
- **H2:** "Sobre o Guppy"

**CTA:** nenhum

---

### Seção 2 — Introdução

| Campo | Valor |
|-------|-------|
| **Tipo** | Bloco de texto introdutório |
| **Itens** | 1 bloco |

**Headline:** **H2:** "Tudo o que Você Precisa Saber sobre o Guppy: Cuidados, Dados Técnicos e Muito Mais"

---

### Seção 3 — Características Técnicas do Guppy

| Campo | Valor |
|-------|-------|
| **Tipo** | Bloco de texto com especificações técnicas |
| **Itens** | 1 bloco (lista ou tabela de dados técnicos) |

**Headline:** **H2:** "Características Técnicas do Guppy"

**Conteúdo (dados técnicos):** espécie, tamanho, temperatura da água, pH, hardness, esperança de vida, comportamento, reprodução.

**CTA:** nenhum

---

### Seção 4 — Mini Formulário de Contato ("Dúvidas?")

| Campo | Valor |
|-------|-------|
| **Tipo** | CTA com mini formulário de contato embutido |
| **Itens** | 4 campos + 1 botão |

**Headline:** "Dúvidas?" (ícone envelope)

**Campos:** Nome (text), DDD+Número (text), Email (email), Mensagem (textarea)

**CTA:** Botão **"Enviar Mensagem"** (submit)

*(Mesmos campos do formulário em /contatos)*

---

### Seção 5 — Cuidados Essenciais

| Campo | Valor |
|-------|-------|
| **Tipo** | Bloco de texto com tópicos de cuidado |
| **Itens** | 1 bloco |

**Headline:** **H2:** "Cuidados Essenciais com Seu Guppy"

**CTA:** nenhum

---

### Seção 6 — Alimentação

| Campo | Valor |
|-------|-------|
| **Tipo** | Bloco de texto |
| **Itens** | 1 bloco |

**Headline:** **H2:** "Alimentação: Como Nutrir Seu Guppy"

**CTA:** nenhum

---

### Seção 7 — Temperamento e Compatibilidade

| Campo | Valor |
|-------|-------|
| **Tipo** | Bloco de texto |
| **Itens** | 1 bloco |

**Headline:** **H2:** "Temperamento e Compatibilidade com Outros Peixes"

**CTA:** nenhum

---

### Seção 8 — Equipamento Necessário

| Campo | Valor |
|-------|-------|
| **Tipo** | Bloco de texto com lista de equipamentos |
| **Itens** | 1 bloco |

**Headline:** **H2:** "Equipamento Necessário para Cuidar do Seu Guppy"

**CTA:** nenhum

---

### Seção 9 — CTA "Garantir Meu Guppy"

| Campo | Valor |
|-------|-------|
| **Tipo** | CTA isolado |
| **Itens** | 1 |

**CTA:** Botão **"Garantir Meu Guppy"** → `/loja/` *(href="#" no HTML original — placeholder)*

---

### Seção 10 — FAQ Accordion

| Campo | Valor |
|-------|-------|
| **Tipo** | Accordion de perguntas frequentes |
| **Itens** | 6 perguntas |

**Perguntas:**
| # | Pergunta |
|---|----------|
| 1 | "Preciso ter experiência para comprar um guppy?" |
| 2 | "Qual a alimentação ideal para os guppys?" |
| 3 | "Com quais peixes os guppys se dão bem?" |
| 4 | "Como funciona o envio dos peixes?" |
| 5 | "E se o peixe chegar morto ou doente?" |
| 6 | "Posso devolver um peixe se não gostar?" |

**CTA:** nenhum nesta seção

---

### Seção 11 — CTA WhatsApp Final

| Campo | Valor |
|-------|-------|
| **Tipo** | CTA isolado |
| **Itens** | 1 |

**CTA:** Botão **"Entrar em Contato"** → `https://wa.me/27997594173`

---

### Resumo — Conheça os Guppy

| # | Seção | Tipo | Itens | CTA |
|---|-------|------|-------|-----|
| 1 | Hero | Banner | 1 | — |
| 2 | Introdução | Texto intro | 1 | — |
| 3 | Características Técnicas | Texto + specs | 1 | — |
| 4 | Mini formulário | Form embutido | 4 campos | "Enviar Mensagem" (submit) |
| 5 | Cuidados Essenciais | Texto | 1 | — |
| 6 | Alimentação | Texto | 1 | — |
| 7 | Temperamento e Compatibilidade | Texto | 1 | — |
| 8 | Equipamento Necessário | Texto + lista | 1 | — |
| 9 | CTA Garantir | CTA isolado | 1 | "Garantir Meu Guppy" → /loja/ |
| 10 | FAQ | Accordion | 6 itens | — |
| 11 | CTA WhatsApp | CTA isolado | 1 | "Entrar em Contato" → wa.me |

---

---

## PÁGINA 5 — Loja (`/loja`)

### Seção 1 — Hero / Banner de Página

| Campo | Valor |
|-------|-------|
| **Tipo** | Hero de página com título centralizado |
| **Fundo** | Imagem com overlay `#FF035C` |

**Conteúdo:**
- **H2:** "Loja" *(implícito na URL — título no corpo da loja)*

**CTA:** nenhum

---

### Seção 2 — Layout Principal: Sidebar + Grade de Produtos

| Campo | Valor |
|-------|-------|
| **Tipo** | Layout 2 colunas: sidebar esquerda (filtros) + grade de produtos direita |

**Sidebar Esquerda — Filtros (YITH WCAN):**

| Elemento | Detalhe |
|----------|---------|
| Título | "Filtrar" |
| Filtro | Checkboxes de categoria (renderizados via JS — não visíveis no HTML estático) |
| Categorias mapeadas via slugs de produto | `peixes-de-linhagem`, `peixes-sem-linhagem`, `casais`, `linhagem-1`, `macho`, `trio` |

**Grade de Produtos — Cabeçalho:**

| Elemento | Detalhe |
|----------|---------|
| **H2** | "Loja - Peixes Selecionados com Excelência" |
| Contagem | "Mostrando todos os 4 resultados" |
| Ordenação (dropdown) | 6 opções: padrão, popularidade, classificação média, mais recentes, preço (asc), preço (desc) |

**Grade de Produtos (4 itens):**

| Produto | Preço | Status | Slug |
|---------|-------|--------|------|
| Casal Yellow Tiger | R$ 375,00 | Sem estoque | `/product/casal-yellow-tiger/` |
| Guppy Dragon Blue | R$ 380,00 | Em estoque | `/product/guppy-dragon-blue/` |
| Guppy Full Black | R$ 250,00 | Em estoque | `/product/guppy-full-black/` |
| Guppy Red Dragon | R$ 312,50 | Em estoque | `/product/guppy-red-dragon/` |

**Categorias por produto (via classes CSS do WooCommerce):**
- Dragon Blue: `peixes-de-linhagem`, `linhagem-1`
- Full Black: `peixes-de-linhagem`, `linhagem-1`
- Red Dragon: `peixes-de-linhagem`, `linhagem-1`
- Casal Yellow Tiger: `casais`, `peixes-de-linhagem`

---

### Seção 3 — Avaliações de Clientes

*(Idêntica à Home — mesmos 3 depoimentos)*

**Headline:** **H2:** "Avaliações de Clientes"

**CTA:** nenhum direto nesta seção

---

### Seção 4 — Diferenciais (Icon-Box)

*(Idêntica à Home — mesmos 4 icon-boxes)*

**CTA:** nenhum

---

### Seção 5 — CTA WhatsApp

*(Idêntica à Home)*

**CTA:** Botão **"Entrar em Contato"** → `https://wa.me/27997594173`

---

### Resumo — Loja

| # | Seção | Tipo | Itens | CTA |
|---|-------|------|-------|-----|
| 1 | Hero | Banner | 1 | — |
| 2 | Sidebar + Grade de produtos | 2 colunas (filtro + grid) | 4 produtos + filtros | "Adicionar ao carrinho" / "Leia mais" |
| 3 | Avaliações | Depoimentos 3col | 3 | — |
| 4 | Diferenciais | Icon-box 4col | 4 | — |
| 5 | CTA WhatsApp | CTA isolado | 1 | "Entrar em Contato" → wa.me |

---

---

## RESUMO GERAL — Todas as Páginas

| Página | Seções | Produto/Forms | CTAs Principais |
|--------|--------|---------------|-----------------|
| `/` (Home) | 11 | 3 grids de produtos | "Ver Loja", "Saiba Mais", "Conhecer", WhatsApp |
| `/sobre-nos` | 4 | — | "Ver Loja", "Entrar em Contato" |
| `/contatos` | 3 | Formulário 4 campos | "Envia Dúvida" (submit), WhatsApp |
| `/conheca-os-guppy` | 11 | Mini form 4 campos + FAQ 6 itens | "Garantir Meu Guppy", WhatsApp |
| `/loja` | 5 | Grid 4 produtos + filtros sidebar | "Adicionar ao carrinho", WhatsApp |

### Componentes Reutilizáveis (aparecem em múltiplas páginas)

| Componente | Páginas |
|------------|---------|
| Seção de Avaliações (3 depoimentos) | Home, Sobre Nós, Loja |
| Seção Diferenciais (4 icon-boxes) | Home, Loja |
| CTA WhatsApp | Home, Loja, Conheça os Guppy |
| Formulário de Contato (4 campos) | Contatos, Conheça os Guppy |
| Hero de Página (banner com overlay pink) | Sobre Nós, Contatos, Conheça os Guppy, Loja |

### Slugs de Categorias Confirmados

| Slug | Nome exibido |
|------|-------------|
| `peixes-de-linhagem` | Linhagens Exclusivas |
| `peixes-sem-linhagem` | Sem Linhagem |
| `casais` | Casais |
| `linhagem-1` | sub-categoria (linhagem específica) |
| `macho` | sub-categoria |
| `trio` | sub-categoria |

### Contatos e Links Reais Identificados

| Tipo | Valor |
|------|-------|
| WhatsApp | (27) 99759-4173 → `https://wa.me/27997594173` |
| E-mail | info@seuemail.com *(placeholder — substituir)* |
| Endereço | *(placeholder — Guarapari-ES)* |
| Instagram | *(link presente no header, URL não extraída)* |
| Facebook | *(link presente no header, URL não extraída)* |
