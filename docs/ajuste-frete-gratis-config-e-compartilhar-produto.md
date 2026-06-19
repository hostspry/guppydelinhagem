# AJUSTE — Frete grátis configurável + Compartilhar na página do produto

Projeto **Guppy de Linhagem**. Dois ajustes independentes.

═══════════════════════════════════════════════════════════════════
## PARTE 1 — Frete grátis configurável (tirar do código)
═══════════════════════════════════════════════════════════════════
Hoje o "frete grátis acima de R$500" provavelmente está **hardcoded**. Mover para
`/admin/configuracoes` (a tela de configurações da loja que já existe, onde está o desconto Pix
global).

### Configuração (modelo `ConfiguracaoLoja` singleton, já existe)
Adicionar dois campos:
- `freteGratisAtivo Boolean @default(false)` — liga/desliga o frete grátis.
- `freteGratisAcimaDe Decimal? ` (ou Int em centavos/reais — seguir o padrão de valores monetários
  do projeto) — o valor mínimo do pedido para frete grátis (ex. 500).
- Migração aditiva (sem destrutivo).

### Admin (`/admin/configuracoes`)
- Toggle "Frete grátis acima de um valor" (liga/desliga).
- Campo de valor (R$) editável, só relevante quando o toggle está ligado.
- Salvar via Server Action + revalidate + toast (padrão do projeto).

### Aplicação no cálculo de frete
- Onde o frete é calculado/somado (checkout, e onde mais for exibido), aplicar a regra:
  **se `freteGratisAtivo` E o subtotal do pedido ≥ `freteGratisAcimaDe` → frete = R$ 0** (grátis).
- **Confirmar a base de comparação:** usar o **subtotal dos produtos** (sem o frete), no valor que
  faz sentido — atenção ao Pix×cartão: definir que a regra usa o **subtotal no cartão (preço
  cheio)** OU o subtotal da forma escolhida. Recomendado: comparar pelo **subtotal de produtos da
  forma de pagamento selecionada** (se o cliente está no Pix, usa o subtotal Pix; no cartão, o
  cheio). Implementar de forma consistente e documentar qual base usou.
- A faixa do topo do site que diz "Frete Grátis Para Pedidos Acima de R$ 500" deve refletir o
  valor configurado (ou ocultar se o frete grátis estiver desligado). Puxar do config, não fixo.
- Se `freteGratisAtivo` estiver desligado, nenhuma regra de frete grátis se aplica (e a faixa some
  ou não menciona valor).

═══════════════════════════════════════════════════════════════════
## PARTE 2 — Compartilhar na PÁGINA DO PRODUTO
═══════════════════════════════════════════════════════════════════
Adicionar compartilhamento na página de produto (`/loja/[slug]`). (O feed já tem o seu botão de
share; aqui é na página.)

### Comportamento por dispositivo
- **Mobile:** usar **share nativo** (`navigator.share`) — um botão "Compartilhar" que abre a folha
  do sistema (WhatsApp, Instagram, etc.). Envia só o **link do produto** (a própria URL da página).
- **Desktop:** mostrar **botões por rede** (já que `navigator.share` é irregular no desktop):
  - **WhatsApp** → `https://wa.me/?text=<texto+url>` (ou api.whatsapp.com)
  - **Facebook** → `https://www.facebook.com/sharer/sharer.php?u=<url>`
  - **X/Twitter** → `https://twitter.com/intent/tweet?url=<url>&text=<texto>`
  - **Copiar link** → `navigator.clipboard.writeText(url)` + toast "Link copiado".
- Detecção mobile consistente com a já usada no projeto (matchMedia / <1024px). Pode renderizar o
  nativo no mobile e os botões por rede no desktop (ou mostrar ambos, mas o nativo só aparece se
  `navigator.share` existir).

### Conteúdo compartilhado
- **Só o link** do produto (a prévia rica vem das meta tags OG já implementadas na página).
- Texto curto opcional no WhatsApp/X (ex. o nome do produto), **sem preço** (consistente com a
  decisão do feed — preço muda).
- A prévia (thumb/nome/descrição) já é tratada pelas meta tags OG da página (feitas antes) — não
  duplicar.

### UI
- Botões/ícones discretos, alinhados à identidade (navy/rosa). Ícones de redes via lucide-react se
  houver, ou ícones próprios. Posição: perto do título/preço do produto, ou numa barrinha
  "Compartilhar:". Alvos ≥44px.

═══════════════════════════════════════════════════════════════════
## NÃO FAZER
═══════════════════════════════════════════════════════════════════
- NÃO incluir preço no texto compartilhado nem mudar as meta tags OG (já feitas).
- NÃO mudar lógica de pagamento; a Parte 1 só afeta o cálculo do frete (zerar quando aplicável).
- Compartilhar só na página de produto (não nos cards da loja nesta tarefa).

═══════════════════════════════════════════════════════════════════
## CRITÉRIOS DE ACEITAÇÃO
═══════════════════════════════════════════════════════════════════
1. `/admin/configuracoes` tem toggle de frete grátis + valor editável; salva e persiste.
2. Com frete grátis ligado e subtotal ≥ valor, o frete fica R$ 0 no checkout; abaixo, cobra normal.
3. Com frete grátis desligado, nunca há frete grátis; a faixa do topo reflete o config (valor certo
   ou some).
4. Nenhum "500" hardcoded para frete grátis.
5. Página de produto: mobile usa share nativo; desktop mostra WhatsApp/Facebook/X/copiar link.
6. Compartilha só o link (sem preço); prévia rica vem das OG existentes.
7. Migração aditiva; build --webpack verde.

═══════════════════════════════════════════════════════════════════
## LEMBRETES
═══════════════════════════════════════════════════════════════════
- `Decimal`→`number` antes de Client Component; valores monetários no padrão do projeto.
- `navigator.share`/`clipboard` exigem HTTPS — ok em produção.
- **Ao terminar, `git push`** e confirmar que subiu.
- Reportar: a base de comparação usada no frete grátis (subtotal Pix/cartão) e como ficou o
  compartilhar por dispositivo.
