# FASE 7 — CORREÇÃO FINAL

A geração com pesquisa (grounding) está validada e boa. Estas são correções finais.
NÃO mexer na lógica de grounding/pesquisa que já funciona.

═══════ 1. (BUG — urgente) Meta descrição estoura limite e trava o save ═══════

A IA gerou meta descrição acima do limite do form → Zod barra → produto não salva.
Alinhar tudo em padrão SEO e adicionar rede de segurança:

- **Prompt:** instruir meta descrição com **≤150 caracteres** (margem de segurança),
  meta título **≤58**.
- **Validação Zod (schema E form):** meta descrição até **160**, meta título até **60**.
- **REDE DE SEGURANÇA (essencial):** ao receber o resultado da IA, antes de preencher
  os campos, se algum campo passar do limite (meta descrição >160, meta título >60, e
  conferir descrição curta e qualquer outro com limite), **truncar na última palavra
  inteira antes do limite** (não cortar palavra no meio). O save NUNCA pode travar por
  tamanho, independente do que a IA gere. Esta é a correção raiz — a IA não conta
  caracteres com precisão e vai estourar de novo; o truncamento garante que nunca quebre.

═══════ 2. Assinatura fixa da Marchezi (bloco fixo, NÃO gerado pela IA) ═══════

A descrição final = [parte da linhagem, gerada pela IA com pesquisa] + [assinatura
institucional fixa da Marchezi, anexada ao final].

- A assinatura é **texto fixo**, NÃO gerado nem reescrito pela IA. Guardar como
  constante (`lib/constants.ts` ou config) e **concatenar** após a descrição gerada,
  sempre igual, com parágrafo separado (transição suave).
- A IA gera só a parte da linhagem; o sistema cola a assinatura depois.
- A descrição final (linhagem + assinatura) vem no campo, **editável** pelo operador
  antes de salvar.

**Texto da assinatura (literal, não alterar):**

Criados com excelência na Marchezi Guppy Farm, em Guarapari/ES, em uma estrutura
profissional projetada exclusivamente para a criação de guppies de linhagem. Nossos
peixes são resultado de anos de seleção genética rigorosa, manejo criterioso e
acompanhamento diário de cada geração.

Mantidos em ambiente controlado, com sistemas de filtragem, qualidade de água
monitorada e alimentação de alto padrão, os exemplares recebem cuidados constantes
desde o nascimento. Todo o processo é conduzido por criador premiado internacionalmente
no World Guppy Contest, garantindo genética, saúde, vigor e padrão estético superiores.

Mais do que criar guppies, preservamos e aprimoramos linhagens através de um trabalho
sério, dedicado e apaixonado, buscando oferecer peixes de qualidade excepcional para
aquaristas de todo o Brasil.

**Nota:** hoje todos os produtos são peixe; a assinatura se aplica a todos. Suporte a
outros tipos de produto (ração, plantas, equipamentos) é fase futura — NÃO construir
agora. A assinatura por enquanto é sempre anexada.

═══════ 3. Consistência dos limites ═══════

Conferir que os três batem: o que o **prompt** pede, o que o **Zod** valida, e o
**contador** exibido no form (ex: "~155 caracteres"). Hoje há descompasso. Alinhar nos
números do item 1 (meta descrição 160, meta título 60).

═══════ ENTREGA ═══════

Build limpo. Commit isolado:
`fix(ai): limites SEO + truncamento defensivo + assinatura Marchezi`

NÃO mexer na lógica de grounding/pesquisa. NÃO construir multi-tipo de produto.
