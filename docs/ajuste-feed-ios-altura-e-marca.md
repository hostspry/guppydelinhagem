# AJUSTE — Feed no iOS (Safari iPhone): altura real + marca do YouTube

Projeto **Guppy de Linhagem**. No iPhone (Safari), o feed de vídeo tem 2 questões vistas em teste:
(1) o feed **não ocupa a tela toda** — a barra do Safari embaixo espreme a gaveta; (2) a marca
"Shorts/YouTube" aparece no topo do embed. Esta tarefa resolve a (1) e **mitiga** a (2). Não muda
preço/checkout/dados.

═══════════════════════════════════════════════════════════════════
## PROBLEMA 1 — Feed não ocupa a tela toda no iOS (PRIORITÁRIO, tem fix)
═══════════════════════════════════════════════════════════════════
No iOS Safari, `100vh` NÃO considera a barra de endereço dinâmica → o conteúdo fica maior/menor
que a viewport e a gaveta de compra é empurrada/cortada perto da barra do navegador.

**Correção:**
- Trocar a altura do container do feed de `100vh` para **`100dvh`** (dynamic viewport height), que
  o Safari iOS respeita conforme a barra aparece/some. Onde houver `h-screen`/`100vh` no feed,
  usar `100dvh` (em Tailwind: `h-[100dvh]` ou `min-h-[100dvh]`).
- Garantir `position: fixed; inset: 0;` no container raiz do feed para ele ocupar toda a viewport
  e ficar acima do resto (evita o "scroll" da página por trás).
- Considerar `overflow: hidden` no body enquanto o feed está aberto (trava o scroll da página de
  fundo, comportamento de tela cheia).
- Garantir que a **gaveta de compra** (nome/preço/composição/ações) fique sempre **visível e
  acima** da área inferior — usar `padding-bottom` seguro (safe-area) com
  `env(safe-area-inset-bottom)` para não ficar atrás da barra/gestos do iPhone.
- Testar especialmente no iPhone (Safari), com e sem a barra de endereço expandida.

═══════════════════════════════════════════════════════════════════
## PROBLEMA 2 — Marca "Shorts/YouTube" no topo (limitação do YouTube)
═══════════════════════════════════════════════════════════════════
Mesmo com `controls=0`/`modestbranding=1`, o YouTube no iOS força a marca "Shorts" + logo no topo
do embed. **Isso é limitação do embed do YouTube (não há parâmetro que remova no iOS).**

**Mitigação (não eliminação):**
- Avaliar cobrir a faixa superior do embed com um **overlay/degradê do app** (uma faixa escura
  translúcida no topo, parte da nossa UI) que reduz a visibilidade da marca sem esconder o peixe.
  O X (fechar) e o botão de som já ficam no topo — o degradê superior que já existe pode ser
  estendido/escurecido um pouco para disfarçar a marca.
- **NÃO** tentar remover a marca por meios que violem os termos do YouTube. É só disfarce visual
  com a nossa própria UI por cima.
- Se o overlay atrapalhar a visão do vídeo, priorizar ver o peixe — aceitar a marca pequena. Documentar
  a decisão.

═══════════════════════════════════════════════════════════════════
## PROBLEMA 3 — DOIS ícones de som no iOS (bug visível)
═══════════════════════════════════════════════════════════════════
No iPhone aparecem DOIS ícones de som no topo direito, grudados: o **nosso** botão de mute/unmute
E o do **YouTube** (que vaza no iOS apesar do controls=0). Fica confuso (parecem duplicados).

**Causa:** no Android o controls=0 esconde o som do YouTube; no iOS o YouTube força o ícone de som
dele. Nosso botão próprio + o vazado = dois.

**Correção:**
- **Manter o nosso botão de som** (é o que funciona consistente em iOS e Android — não dá pra
  depender do nativo, que só aparece no iOS).
- **Reposicionar o NOSSO botão de som** para NÃO ficar colado/empilhado com o que o YouTube vaza no
  iOS. Sugestão: mover o nosso botão de som para o **canto superior esquerdo** (junto do X) OU para
  a **coluna lateral de ações** (junto de setas/compartilhar/like), longe do canto onde o YouTube
  põe o ícone dele (topo direito do embed). Assim, mesmo que o do YouTube apareça no iOS, não fica
  grudado parecendo duplicado.
- Não tentar remover o ícone do YouTube por meios que violem os termos — é só reposicionar o nosso
  para evitar a aparência de duplicado.
- No Android (onde o do YouTube não aparece), o nosso continua sendo o único — ok.

═══════════════════════════════════════════════════════════════════
## CRITÉRIOS DE ACEITAÇÃO
═══════════════════════════════════════════════════════════════════
1. No iPhone (Safari), o feed ocupa a tela toda; a gaveta de compra fica visível e não é cortada
   pela barra do navegador (uso de 100dvh + safe-area).
2. O scroll da página de fundo não interfere enquanto o feed está aberto.
3. A faixa superior do feed disfarça (o quanto der) a marca do YouTube sem esconder o vídeo.
4. O nosso botão de som NÃO fica grudado/empilhado com o ícone de som que o YouTube vaza no iOS
   (reposicionado para outro canto). Android segue com um botão só.
5. Android continua funcionando como antes (não regredir).
6. build --webpack verde.

═══════════════════════════════════════════════════════════════════
## LEMBRETES
═══════════════════════════════════════════════════════════════════
- `100dvh` e `env(safe-area-inset-*)` são a chave do iOS. Conferir o `<meta name="viewport">` tem
  `viewport-fit=cover` (necessário para o safe-area funcionar) — adicionar se faltar.
- Não mexer em preço/checkout/dados.
- **Ao terminar, `git push`** e confirmar que subiu.
- Reportar: o que mudou de 100vh→100dvh, se ajustou o viewport meta, e como ficou a faixa superior.
