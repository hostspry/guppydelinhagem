# FASE 7 — Geração de conteúdo com IA (Gemini)

Botão "Gerar com IA" no formulário de produto. A partir do vídeo primário (título/
legenda) + um briefing manual do operador, a IA gera de uma vez: descrição,
descrição curta, meta título, meta descrição e palavras-chave. A IA **rascunha**;
o operador **revisa e edita** antes de salvar. Nada é persistido até o save normal
do produto.

Provedor: **Gemini** (Google AI Studio). Integração escrita para permitir trocar de
provedor depois, mas **um só** agora. Chave no `.env`/Coolify, **não** no banco.

═══════ DECISÕES JÁ TOMADAS (não reabrir) ═══════

1. **Palavras-chave = um único campo** (`keywords`). Não separar "tags de loja" vs
   "keywords de SEO" agora — isso só vale quando a loja pública (Fase 4+) tiver
   filtro por tag. Um campo, reaproveitável depois.
2. **Chave da IA no `.env`/Coolify** (`GEMINI_API_KEY`), nunca no banco. Sem tela de
   Settings nesta fase.
3. **Um provedor (Gemini)**, integração desacoplada para plugar outros no futuro
   (uma função `generateProductContent` que hoje chama Gemini; trocar de provedor =
   trocar a implementação dela, não o resto).
4. **A IA nunca salva direto.** Preenche os campos do form (editáveis); o operador
   revisa e dispara o save normal do produto.

═══════ 1. SCHEMA (migration) ═══════

O Product já tem `metaTitle` e `metaDescription` (Fase 6b). Falta:

- **`keywords`** — adicionar ao model `Product`. Tipo: `String[]` (array de texto no
  Postgres) OU `String?` com keywords separadas por vírgula — **escolha String[]**
  (mais limpo para exibir como chips e para filtro futuro). Default `[]`.

Migration: `pnpm prisma migrate dev --name add_product_keywords`.
Atualizar o schema Zod (`lib/validations/product.ts`) e o form para incluir keywords.

Os outros campos que a IA preenche (descrição, descrição curta, metaTitle,
metaDescription) **já existem** — confirmar nomes exatos no schema antes de codar.

═══════ 2. INTEGRAÇÃO COM A IA (server-side) ═══════

Criar `lib/ai/gemini.ts` (ou `lib/ai/provider.ts` com Gemini dentro):

- Lê `process.env.GEMINI_API_KEY`. Padrão lazy (igual lib/s3, lib/prisma) — não
  exigir a env no build.
- Usa a **API REST do Gemini** (`generativelanguage.googleapis.com`) ou o SDK
  `@google/generative-ai`. Escolha o que for mais estável; documente a escolha.
- Modelo: **Gemini Flash** (o budget — barato e rápido, ideal para isto). Nome exato
  do modelo: confirmar na doc do Gemini no momento da implementação (os nomes mudam;
  ex. `gemini-2.5-flash` ou similar).
- **`server-only`** no topo do módulo (proteção de bundle — a chave nunca vai ao
  client).

**Função principal:**
```
generateProductContent(input: {
  videoTitle: string;        // título/legenda do vídeo primário
  videoHashtags?: string;    // se separável
  briefing: string;          // texto livre do operador (pode ser vazio)
  categoria?: string;        // nome da categoria, dá contexto
}): Promise<{
  descricao: string;
  descricaoCurta: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}>
```

**Prompt (system + user):** instruir a IA a:
- Escrever em **português brasileiro**, tom de loja de aquarismo premium/pedigree.
- Gerar os 5 campos de uma vez.
- **NÃO inventar** características que não estejam no título/briefing (cor, sexo,
  linhagem, tamanho). Se não souber, manter genérico — nunca afirmar um traço
  específico sem base. (Crítico: guppy pedigree — afirmar "cauda véu" quando é
  "leque" é erro grave.)
- Meta título ≤ 60 caracteres; meta descrição ≤ 155 caracteres (limites de SEO).
- Descrição curta: 1–2 frases. Descrição: 2–4 parágrafos curtos.
- Keywords: 5–8 termos que as pessoas buscariam (ex: "comprar guppy koi",
  "guppy cauda véu", "guppy importado").
- **Retornar JSON** estрито com as 5 chaves (parsear no servidor; tratar falha de
  parse com erro amigável). Instruir explicitamente "responda só com JSON, sem
  texto extra, sem ```".

**Tratamento de erro:** se a API falhar (chave inválida, quota, timeout, JSON
inválido), retornar `ActionResult` de erro com mensagem clara ("Não foi possível
gerar agora. Tente novamente ou preencha manualmente."). **Nunca** quebra o form —
o operador sempre pode preencher à mão.

═══════ 3. SERVER ACTION ═══════

`actions/products.ts` (ou `actions/ai.ts`):
```
generateContent(formData | input): Promise<ActionResult<GeneratedContent>>
  - assertAuthorized()
  - monta o input a partir do vídeo primário + briefing recebido
  - chama generateProductContent
  - retorna { ok, data } | { ok:false, error }
```
Reusar `ActionResult`/`assertAuthorized` de `lib/utils/action-result.ts`.

═══════ 4. UI NO FORM DE PRODUTO ═══════

Seção "Gerar conteúdo com IA" no `ProductForm`, **acima** dos campos de descrição/SEO:

- Mostra o que a IA vai ler: o **título do vídeo primário** (do array de vídeos; o
  marcado como principal). Se não houver vídeo, avisar "adicione um vídeo primeiro"
  e desabilitar o botão (ou permitir gerar só do briefing — decisão: **permitir só
  do briefing também**, mas avisar que fica mais genérico sem vídeo).
- **Campo de briefing** (textarea, opcional): placeholder com exemplo
  ("macho, cauda véu, linhagem importada, pais campeões, últimas unidades").
- Botão **"Gerar com IA"** (com ícone sparkles; estado de loading próprio —
  `useState`, **não** useTransition, pela lição da 6c do botão travado).
- Botão **"Gerar novamente"** após a primeira geração: regenera, sem apagar edições
  manuais já feitas em outros campos (regenera só os campos da IA; ou pergunta —
  decisão simples: regenera os 5 campos, com confirmação se já houver conteúdo).

**Ao receber o resultado:**
- Preenche os campos do form (`setValue` do react-hook-form) — descrição, descrição
  curta, metaTitle, metaDescription, keywords.
- **Não salva.** Os campos ficam editáveis. Mostra um aviso discreto:
  "Gerado pela IA — revise antes de salvar. Pode haver imprecisões."
- O save é o botão normal "Salvar produto" (fluxo existente).

**Keywords como chips:** exibir as keywords como etiquetas removíveis (x para
excluir) + input para adicionar manual. Componente novo simples (`KeywordsField`),
controlado pelo react-hook-form (array de strings).

═══════ 5. ENV VARS ═══════

`.env` local e Coolify (Runtime):
```
GEMINI_API_KEY="..."   # do Google AI Studio
```
`.env.example` documenta (sem valor).

═══════ CRITÉRIOS DE ACEITAÇÃO ═══════

1. Migration `keywords` aplicada; campo no schema, Zod e form.
2. Com um vídeo + briefing, "Gerar com IA" preenche os 5 campos.
3. Campos vêm editáveis; nada salvo até o save do produto.
4. Keywords editáveis como chips (add/remove).
5. "Gerar novamente" funciona.
6. Erro de IA (chave/quota/parse) → mensagem amigável, form não quebra.
7. Chave só server-side (`server-only`); nunca exposta ao client.
8. Build limpo. `GEMINI_API_KEY` em `.env.example`.

═══════ GATE ANTES DA UI ═══════

Como na 6c: **antes de construir a UI**, valide a integração com um script
descartável que chama `generateProductContent` com um input de exemplo e imprime o
JSON retornado. Confirma que a chave funciona, o modelo responde, e o parse do JSON
está OK. Se a chave/quota falhar, PARE e avise — não construa UI sobre integração
quebrada. (Lembre do `server-only`: o script espelha a config inline, como na 6c.)

═══════ ENTREGA ═══════

Commits sugeridos:
1. `feat(db): campo keywords no produto (migration)`
2. `feat(ai): integração Gemini para gerar conteúdo de produto`
3. `feat(admin): botão "Gerar com IA" + campo briefing + chips de keywords no form`

Reporte: resultado do gate (JSON real do Gemini), e qualquer ajuste de prompt que
precisou para o JSON sair limpo.

NÃO construa tela de Settings (fase futura). NÃO multi-provedor. NÃO salvar direto.
