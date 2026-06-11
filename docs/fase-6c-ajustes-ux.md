# FASE 6c — AJUSTES DE UX (pós-teste no browser)

A 6c funciona (upload pro Garage validado: imagem sobe, salva, aparece). Estes são
**ajustes de UX**, não correção de infra. Faça em commits separados onde fizer sentido.
Não mexa na lógica de upload/S3 que já funciona.

═══════ 1. Revalidação de UI após salvar/upload (MAIS IMPORTANTE) ═══════

**Sintoma:** ao salvar uma edição de produto, a listagem e a tela de edição não
refletem a mudança até um **F5 manual** — o dado persiste no banco, mas a UI fica
stale. Relacionado: após o upload de capa, o botão fica travado em **"Enviando…"**
mesmo depois do upload ter completado (a imagem só aparece após F5).

**Investigar e corrigir:**
- O `revalidatePath` cobre a rota de **edição** (`/admin/produtos/[id]/editar`),
  não só `/admin/produtos`? Pode precisar revalidar ambas (ou usar
  `revalidatePath('/admin/produtos', 'layout')`).
- O estado de `useTransition`/loading do **upload** está sendo resetado quando a
  action retorna? O "Enviando…" travado sugere que o `onPatch` atualiza o estado mas
  o componente não re-renderiza com a thumb nova até um refresh.
- Falta um `router.refresh()` no client após a action de salvar, para forçar os
  Server Components a rebuscarem dados frescos?
- **Objetivo:** salvar e ver a mudança refletida **sem F5**; o "Enviando…" vira a
  imagem assim que o upload termina.

Reporte a causa raiz que encontrou — é o ajuste que mais importa.

═══════ 2. Card de vídeo: capa inline e visível (sem etapa extra) ═══════

Decisão aprovada: ao adicionar um vídeo, a escolha de capa fica **inline no card,
visível de imediato** — sem esconder atrás do botão "Trocar capa (frames)" e sem um
passo de preview antes de adicionar. "Adicionar" continua um clique; a escolha já
está na frente do operador no card.

**YouTube:**
- Os 4 frames aparecem **direto no card** (não atrás de um toggle), já em tamanho
  **clicável** (~96–120px de largura, proporção 16:9 — hoje estão ~48px, pequenos
  demais). Frame selecionado com borda destacada clara.
- **Remover** (ou tornar opcional) o toggle "Trocar capa (frames)" — os frames já
  ficam visíveis. Se o card ficar muito alto com tudo aberto, pode usar um layout
  compacto, mas os frames precisam estar visíveis e clicáveis sem passo extra.

**Todos (YouTube + IG + TikTok):**
- O botão **"Enviar imagem (capa)"** aparece em **todos** os cards, inclusive
  YouTube (hoje só IG/TikTok). Motivo: às vezes nenhum frame serve e o operador quer
  subir foto própria. No YouTube fica ao lado do seletor de frames.

═══════ 3. (cosmético) 404 de prefetch na sidebar ═══════

Os links da sidebar para rotas ainda não construídas (`/admin/hero-slides`,
`/admin/configuracoes`, `/admin/clientes`, e quaisquer outras inexistentes) fazem
prefetch e logam **404** no console. Desabilite o prefetch nesses links
(`prefetch={false}` no `<Link>`) OU oculte/desabilite os itens até as rotas
existirem. Não quebra nada — só limpa o console. Escolha o que for menos intrusivo
(provavelmente `prefetch={false}`, mantendo os links visíveis como navegação futura).

═══════ CRITÉRIOS DE ACEITAÇÃO ═══════

1. Salvar edição reflete na UI **sem F5** (listagem e edição).
2. Upload de capa: "Enviando…" vira a imagem assim que termina, sem F5.
3. Card de YouTube mostra os 4 frames inline, grandes e clicáveis, sem toggle.
4. Botão de upload de capa presente em todos os cards (incl. YouTube).
5. Console sem 404 de prefetch da sidebar.
6. Build limpo. A lógica de upload/S3 não foi alterada.

═══════ ENTREGA ═══════

Commits separados (sugestão):
1. `fix(admin): revalida UI após salvar produto e upload de capa`
2. `feat(admin): seletor de capa inline no card de vídeo (frames grandes + upload no YouTube)`
3. `chore(admin): desabilita prefetch de rotas admin inexistentes`

Ao terminar, reporte:
- a causa raiz da revalidação (item 1) e como resolveu;
- se o card ficou alto demais com tudo inline (e como tratou o layout).

NÃO altere a lógica de upload/S3 (`lib/s3.ts`, `actions/upload.ts` core) — já validada.
NÃO implemente IA — é Fase 7.
