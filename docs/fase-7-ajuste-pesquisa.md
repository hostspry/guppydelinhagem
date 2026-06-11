# FASE 7 — AJUSTE: pesquisa sob demanda + templates de briefing

A Fase 7 base já está feita (Gemini gera os 5 campos, chips de keywords, fluxo de
revisão). Este é um **ajuste sobre o que já existe** — NÃO refazer a fase. Muda a
chamada da IA (ganha pesquisa web) e a UI do briefing (ganha template clicável) +
inclui Nome/slug na geração. O resto (campos, chips, "Gerar novamente", fluxo de
revisão sem salvar) permanece igual.

═══════ CONTEXTO DO PORQUÊ ═══════

Os peixes da loja são linhagens asiáticas (Tailândia, Japão, etc.) cujo bom material
existe em inglês/asiático, não em português. O operador (criador campeão) quer que a
IA pesquise essas fontes e traga em português, e ele revisa. Decisão do dono, ciente
de que a web pode ter imprecisão — por isso o fluxo de revisão obrigatório já existe
e permanece.

═══════ 1. PESQUISA SOB DEMANDA (Gemini grounding) ═══════

Hoje `lib/ai/gemini.ts` faz geração simples (sem web). Adicionar **Google Search
grounding** como ferramenta na chamada do Gemini, ativada **sob demanda**:

- A pesquisa liga quando o briefing contém o **gatilho de pesquisa**. Implementação
  simples e robusta: a função recebe um flag `pesquisar: boolean` (não dependa de
  detectar palavra no texto). A UI manda `pesquisar: true` quando o operador usou o
  template "Pesquisar linhagem" (ver item 2). Sem o flag, geração simples como hoje.
- Quando `pesquisar: true`, incluir a tool de Google Search/grounding na requisição
  REST do Gemini (config `tools: [{ google_search: {} }]` ou equivalente atual da
  API — **confirmar o formato exato na doc do Gemini no momento da implementação**,
  pois o nome da tool de grounding muda entre versões da API).
- Conta paga (o operador tem Gemini pago) — grounding disponível. Custo por chamada
  é maior com pesquisa; por isso é sob demanda.

**Atenção ao JSON:** a versão atual força JSON via `responseSchema`. Verificar se
grounding + `responseSchema`/`responseMimeType: application/json` coexistem na API do
Gemini — em algumas versões, ativar tools desabilita o response schema estruturado.
Se houver conflito: manter o grounding e instruir o JSON via prompt forte ("responda
só com JSON válido, sem texto fora, sem ```"), parseando defensivamente. Documentar
qual caminho funcionou. **Este é o ponto técnico mais incerto da fase — validar no
gate antes de tudo.**

═══════ 2. TEMPLATE DE BRIEFING CLICÁVEL ═══════

Acima do textarea de briefing, um chip/botão clicável:

**"Pesquisar linhagem"** — ao clicar, preenche o textarea com:
```
Pesquise a origem, características genéticas, padrão de cor, manejo (parâmetros de
água, temperatura, alimentação, cuidados) e como criar esta linhagem. Priorize
fontes especializadas em inglês e da Ásia (Tailândia, Japão, China, Taiwan),
incluindo criadores e lojas de referência. Traga a informação técnica e confiável em
português, sem inventar — se não encontrar dado sobre algum ponto, omita em vez de
supor.
```
- Clicar preenche o textarea (substitui o conteúdo, ou anexa se já houver texto —
  preferir **substituir**, com o operador editando depois).
- Usar este template **liga o flag `pesquisar: true`** na geração. (Pode ser por um
  estado: "template de pesquisa ativo" — clicou no chip, fica ativo; se o operador
  apagar tudo e escrever do zero, pode resetar para false, ou manter um indicador
  visual de que a pesquisa está ligada.)
- **Indicador visual** de que a pesquisa está ativa (ex: o chip fica "selecionado",
  ou um pequeno texto "🔍 pesquisa web ativada"). Assim o operador sabe que aquela
  geração vai pesquisar (e custar/demorar mais).

Só **um** template por enquanto. Estruturar o código para adicionar outros depois
(array de templates `{ label, texto, pesquisar }`), mas só o de cima existe agora.

═══════ 3. PRIORIDADE DO BRIEFING SOBRE O VÍDEO ═══════

Bug observado: título do vídeo ("guppy koi tuxedo") + briefing divergente ("japan
blue") → IA fundiu os dois ("Koi Tuxedo Japan Blue"). Corrigir no **prompt**:

- Instruir explicitamente: "O BRIEFING do operador descreve o peixe deste produto e
  tem PRIORIDADE. O título do vídeo é contexto auxiliar; se conflitar com o briefing,
  ignore o título do vídeo. Nunca combine características contraditórias das duas
  fontes."
- Quando não houver briefing, o título do vídeo é a fonte (como hoje).

═══════ 4. NOME E SLUG NA GERAÇÃO ═══════

A IA passa a sugerir o **Nome** do produto também:

- Adicionar `nome` ao retorno de `generateProductContent` (e ao schema/parse).
- No prompt: gerar um nome de produto claro e comercial a partir do briefing/pesquisa
  (ex: "Guppy Koi Tuxedo — Trio Linhagem Importada"). Conciso, sem exageros.
- Na UI: preencher o campo Nome via `setValue`. O **slug** deriva do nome pelo
  mecanismo que JÁ existe (geração automática do slug a partir do nome) — não
  reimplementar; apenas garantir que, ao setar o nome, o slug recalcule (ou deixar o
  operador disparar o recalculo como já funciona no form).
- Nome também é **editável/revisável** — a IA sugere, o operador confirma.

═══════ GATE (rodar ANTES de mexer na UI) ═══════

Como nas fases anteriores. Script descartável que:
1. Chama `generateProductContent` com `pesquisar: true` e um briefing real de
   linhagem (ex: o template acima aplicado a "Koi Tuxedo" ou "Full Red").
2. Confirma que: a chave paga funciona, o **grounding realmente pesquisou** (o
   retorno deve trazer informação específica, não genérica — e se a API expõe as
   fontes/citations do grounding, logar quais foram), e o **JSON saiu parseável**
   (este é o ponto de risco do item 1).
3. Imprime o texto gerado completo.

**Se grounding + JSON estruturado conflitarem, é aqui que aparece — resolver antes da
UI.** Se o grounding não pesquisar de fato (retorno genérico igual sem web), PARAR e
avisar — não adianta UI sobre pesquisa que não pesquisa.

Reportar ao Manassés: o **texto real gerado com pesquisa** (ele vai avaliar a
qualidade como especialista), e se o JSON+grounding coexistiram ou exigiram
contorno.

═══════ ENV / INFRA ═══════

- Mesma `GEMINI_API_KEY` (já no .env/Coolify). Conta paga, grounding habilitado.
- `server-only` permanece no módulo de IA.

═══════ CRITÉRIOS DE ACEITAÇÃO ═══════

1. Chip "Pesquisar linhagem" preenche o briefing e ativa a pesquisa (com indicador
   visual).
2. Geração com pesquisa traz informação específica da linhagem (origem, genética,
   cor, manejo, criação), não copy genérica.
3. Geração sem o template = simples (sem web), como antes.
4. Briefing tem prioridade sobre o título do vídeo (sem fusão de fontes
   contraditórias).
5. IA sugere Nome; slug deriva; ambos editáveis.
6. JSON parseável (mesmo com grounding) — geração nunca quebra por parse.
7. Erro de IA/pesquisa → mensagem amigável, form intacto.
8. Build limpo.

═══════ ENTREGA ═══════

Commits sugeridos:
1. `feat(ai): pesquisa web sob demanda via Gemini grounding`
2. `feat(admin): template de briefing "Pesquisar linhagem" + indicador de pesquisa`
3. `feat(ai): prioridade do briefing sobre vídeo + geração de nome/slug`

NÃO refazer a fase. NÃO multi-provedor. NÃO tela de Settings. NÃO salvar direto.
Pesquisa é SOB DEMANDA (sem template = sem custo de pesquisa).
