# FASE — Caixa por WhatsApp (grupo + Evolution API)

Projeto Guppy de Linhagem (Next.js 16 App Router, TypeScript, Prisma 7, pnpm).

Objetivo: o dono e o Lucas encaminham comprovante de Pix (print, PDF ou texto)
para um **grupo de WhatsApp**, e o sistema transforma aquilo em **sugestão de
lançamento** no caixa, pronta pra confirmar. Entrada e saída.

O motor já existe. Esta fase constrói **só a boca de entrada** e conserta um
problema que o novo fluxo expõe.

## Estado atual (verificado)

Já pronto e reaproveitado sem alteração:

- `lib/ai/comprovante.ts` — `lerComprovante()`, Gemini Flash multimodal, aceita
  `{ texto }` ou `{ base64, mimeType, nomeArquivo }`, devolve `ComprovanteLido`
  com `tipo`/`valor`/`data`/`descricao`/`contraparte`/`categoriaSlug`/`confianca`/`aviso`.
  Já valida com Zod e descarta slug de categoria inventado pelo modelo.
- `lib/s3.ts` — `uploadComprovante()` grava em `financeiro/comprovantes/<uuid>.<ext>`.
- Schema: `OrigemLancamento.COMPROVANTE`, `CanalVenda.WHATSAPP`,
  `StatusLancamento.PENDENTE`/`DESCARTADO`, `Lancamento.comprovanteUrl` — tudo
  já existe, nada disso precisa de migration.
- `actions/financeiro.ts` — `descartarSugestao(id)` é genérico (serve a qualquer
  lançamento PENDENTE, não só venda do site).
- `lib/telegram.ts` / `lib/notificacoes.ts` — transporte fire-and-forget que
  nunca lança. Usar pro alerta de instância caída.
- Padrão de webhook em `app/api/webhooks/{mercadopago,pagbank,melhorenvio}/route.ts`:
  `runtime = "nodejs"`, `dynamic = "force-dynamic"`, valida autenticidade antes
  de qualquer efeito, responde 200 rápido, tudo idempotente.

**Problema encontrado na leitura do código** (precisa ser resolvido nesta fase):
`listarContasEmAberto()` em `lib/queries/financeiro.ts:181` filtra
`status: PENDENTE, origem: { not: "PEDIDO" }`. Uma sugestão vinda de comprovante
é `PENDENTE` + `COMPROVANTE`, então ela **cairia na lista de contas a pagar**,
ordenada por vencimento (que ela não tem) e com o botão "Dar baixa" no lugar de
confirmar/descartar. Gaveta errada. Ver Fase E.

## Decisões travadas (não reabrir)

- **Grupo dedicado, chip dedicado.** O Evolution roda numa conta de WhatsApp
  própria (chip pré-pago em celular velho), que só participa do grupo do caixa.
  O número de atendimento da loja (`WHATSAPP_PHONE` em `lib/constants.ts`) **não
  é tocado** e não recebe sessão de Evolution. Motivo: banimento do chip do robô
  custa um chip; banimento do número de vendas custa o canal.
- **Nada entra no caixa sozinho.** Todo comprovante vira `PENDENTE`. Confirmação
  é humana, no painel. Errar valor de dinheiro é caro, e comprovante é documento
  cheio de número parecido (valor, tarifa, saldo, documento, agência).
- **Allowlist dupla**: só processa mensagem que veio do grupo configurado E de
  remetente na lista. Webhook que cria linha financeira a partir de qualquer um
  é convite pra poluir o caixa.
- **O robô só fala dentro do grupo.** Nunca manda mensagem pra cliente, nunca
  inicia conversa. É o que mantém o perfil de uso longe do que faz banir.
- **v1 é só dinheiro.** Não cria `Order`, não dá baixa em estoque, não mexe em
  pedido. Venda pelo WhatsApp com estoque é fase futura.
- Idempotência por `waMessageId` (reenvio do webhook) **e** por hash do arquivo
  (reenvio manual, ou cliente que manda print e PDF do mesmo Pix).

---

## Fase A — Infra (fora do código)

1. Chip pré-pago ativado no celular velho, WhatsApp instalado, nome "Caixa Guppy".
2. Grupo criado com: chip do robô, Manassés, Lucas. Os dois humanos administradores.
3. Recarga recorrente cadastrada em `RecorrenciaFinanceira` — pré-pago sem uso é
   bloqueado e o número volta pro estoque da operadora. Se isso acontecer, o robô
   para e um estranho fica com um número que estava no grupo.
4. Celular do chip **ligado e conectado**. Com multi-aparelhos o Evolution roda
   sem o celular online, mas o aparelho que ativou a conta precisa se conectar a
   cada ~14 dias, senão o WhatsApp desconecta os vinculados.
5. Container do Evolution API no Coolify, com **volume persistente** pra sessão
   (perder o volume = escanear QR de novo). Webhook apontando pra
   `https://guppydelinhagem.com.br/api/webhooks/whatsapp`, evento de mensagem
   recebida apenas.
6. Anotar o **JID do grupo** (formato `<numeros>@g.us`) — vai em env.

## Fase B — `lib/whatsapp/evolution.ts` (cliente)

Cliente HTTP fino, mesmo padrão de `lib/telegram.ts`: fetch puro, sem SDK, lê env
em runtime (nunca no topo do módulo, pra não exigir env em build).

- `baixarMidia(messageId): Promise<{ buffer: Buffer; mimeType: string } | null>`
  — o Evolution não entrega URL pública; a mídia vem em base64 no evento ou por
  endpoint próprio. Conferir a doc da versão instalada e isolar essa diferença
  **aqui**, não no webhook.
- `enviarNoGrupo(texto): Promise<void>` — fire-and-forget seguro, nunca lança.
  Só envia pro `WHATSAPP_GRUPO_ID`; ignorar qualquer outro destino é trava de
  código, não de configuração.
- `instanciaConectada(): Promise<boolean>` — pro monitor da Fase G.

## Fase C — Schema: log de ingestão

Migration nova. Não mexe em `Lancamento`.

```prisma
enum StatusIngestaoWa {
  IGNORADA      // sem anexo, ou grupo/remetente fora da allowlist
  LIDA          // IA leu, sugestão criada
  FALHA_LEITURA // IA não conseguiu; arquivo guardado assim mesmo
  DUPLICADA     // mesmo arquivo já virou lançamento
}

model MensagemWhatsapp {
  id             String           @id @default(cuid())
  waMessageId    String           @unique // trava contra reenvio do webhook
  grupoId        String
  remetente      String           // só dígitos
  arquivoHash    String?          // sha256 do binário, trava contra reenvio manual
  status         StatusIngestaoWa
  comprovanteUrl String?
  lancamentoId   String?
  erro           String?
  criadoEm       DateTime         @default(now())

  @@index([arquivoHash])
  @@index([criadoEm])
}
```

Por que um modelo e não um campo em `Lancamento`: precisa registrar também o que
foi **ignorado e o que falhou**, senão a pergunta "por que esse comprovante não
lançou?" não tem resposta. Também é o que impede o webhook de reprocessar em
loop uma mensagem cuja leitura falhou.

Nada de corpo de mensagem aqui. Só metadado.

## Fase D — `app/api/webhooks/whatsapp/route.ts`

`runtime = "nodejs"`, `dynamic = "force-dynamic"`. Ordem obrigatória:

1. **Autenticidade.** O Evolution não assina como o Mercado Pago. Validar header
   com `WHATSAPP_WEBHOOK_TOKEN` usando `timingSafeEqual` (mesmo cuidado do
   `assinaturaValida` do MP). Inválido → 401, sem efeito nenhum.
2. **Allowlist.** `grupoId === WHATSAPP_GRUPO_ID` e remetente (só dígitos, via
   `normalizeWhatsappBR` de `lib/utils/whatsapp.ts`) dentro de
   `WHATSAPP_REMETENTES`. Fora disso → grava `IGNORADA` e responde 200.
3. **Dedup por mensagem.** `waMessageId` já em `MensagemWhatsapp` → 200 e sai.
4. **Triagem barata, antes de gastar IA.** Só segue se for anexo de MIME aceito
   (`MIMES_COMPROVANTE`) dentro de `MAX_BYTES_COMPROVANTE`, ou texto com cara de
   comprovante. Resto → `IGNORADA`.
5. **Dedup por conteúdo.** sha256 do buffer; hash já registrado com status `LIDA`
   → `DUPLICADA`, avisa no grupo ("esse comprovante já está no caixa") e sai.
6. **Sobe o arquivo antes de ler** (`uploadComprovante`). Se a IA falhar depois,
   o anexo já está guardado e dá pra lançar à mão. Mesma ordem que
   `actions/comprovante.ts` já usa.
7. `lerComprovante()` com as categorias ativas, igual `actions/comprovante.ts:47`.
8. Cria o `Lancamento`:
   - `status: PENDENTE`, `origem: COMPROVANTE`, `canal: WHATSAPP`
   - `valor`, `data`, `descricao`, `categoriaId` do que a IA leu
   - `comprovanteUrl` preenchido
   - `observacoes` com contraparte, aviso da IA e confiança
   - `criadoPorId: null` (não foi pessoa do painel)
   - `data` ausente na leitura → usa a data da mensagem, e diz isso no aviso
9. Responde no grupo com o resumo e o link pra `/admin/financeiro/pendencias`.
10. **Falha da IA** → `FALHA_LEITURA` e mensagem no grupo com o link do arquivo
    guardado, pedindo lançamento manual. Nunca ficar em silêncio: comprovante
    que some sem aviso é pior que erro de leitura.
11. Sempre 200, salvo o 401 do passo 1. Erro interno vira log + aviso no grupo,
    nunca 500 (o Evolution reenvia e vira loop).

## Fase E — Painel: gaveta própria pras sugestões de comprovante

Sem isso a sugestão cai na lista de contas a pagar (ver "Estado atual").

- `lib/queries/financeiro.ts`:
  - nova `listarSugestoesDeComprovante()` → `status: PENDENTE, origem: "COMPROVANTE"`,
    ordenada por `data` desc.
  - `listarContasEmAberto()` passa a excluir também `COMPROVANTE`:
    `origem: { notIn: ["PEDIDO", "COMPROVANTE"] }`.
  - `contadoresPendencia()` ganha `sugestoesComprovante` e aplica o mesmo
    `notIn` nas três contagens de conta aberta (`contasAbertas`, `vencidas`,
    `venceEm7Dias`), senão o selo da navegação conta comprovante como conta vencida.
- `app/admin/(painel)/financeiro/pendencias/page.tsx`: bloco novo "Comprovantes
  do WhatsApp", acima das contas. Cada linha mostra valor, descrição, contraparte,
  confiança da IA, o aviso quando houver, e miniatura/link do comprovante.
- Ações: **Confirmar** (revisando valor e data antes de salvar, porque a IA erra)
  e **Descartar** (reusa `descartarSugestao`, que já é genérico).
  `confirmarVenda` **não** serve aqui: ela mexe em taxa de gateway e frete de
  pedido do site. Criar `confirmarComprovante(id, { valor, data, tipo, categoriaId })`
  em `actions/financeiro.ts`, com `assertPermissao("financeiro.gerenciar")` e
  `auditar` no mesmo padrão das outras.
- Confiança `BAIXA` destacada em vermelho. É o caso em que o dono precisa abrir
  o comprovante antes de confirmar.

## Fase F — O sinal vai inverter (a parte mais importante)

Hoje a regra 2 do prompt em `lib/ai/comprovante.ts` diz que `SAIDA` é
"Pix enviado, transferência para terceiros". Só que o comprovante que o **cliente**
manda está na perspectiva **dele**: "Pix enviado", "você transferiu". A IA vai ler
o recebimento de uma venda e lançar como **saída**, invertendo o sinal do caixa.

No painel isso não morde, porque o dono sobe o arquivo e vê o rascunho antes de
salvar. No volume do WhatsApp vira a principal fonte de erro.

Correção: **decidir pelo destinatário, não pelo verbo.**

- Passar pra `lerComprovante()` a identidade do criadouro (nome, razão social,
  CNPJ, chaves Pix) via env `CAIXA_TITULARES`, lista separada por `;`.
- Reescrever a regra 2: se o **recebedor/destino** do documento é um dos
  titulares, é `ENTRADA`, mesmo que o texto diga "enviado" ou "transferiu". Se o
  **pagador/origem** é um titular, é `SAIDA`. Só cair no verbo quando nenhum dos
  dois lados casar, e nesse caso marcar `confianca: BAIXA` e explicar no `aviso`.
- Assinatura nova: `lerComprovante(entrada, categorias, titulares)`. Atualizar a
  chamada existente em `actions/comprovante.ts` junto — o painel ganha a mesma
  correção de graça.
- Sem `CAIXA_TITULARES` configurado, mantém o comportamento de hoje.

## Fase G — Monitor de instância caída

Modo de falha silencioso: a sessão do Evolution cai, o webhook para de chegar, e
o dono segue encaminhando comprovante achando que está lançando.

- Cron `app/api/cron/whatsapp-vivo/route.ts`, Bearer `CRON_SECRET`, mesmo padrão
  de `/api/cron/resumo-envios`. Agendar no Coolify a cada 15 min.
- Chama `instanciaConectada()`. Desconectado → Telegram avisando pra reescanear
  o QR. Avisar **uma vez** por queda, não a cada 15 min.
- Complemento: se passou mais de 48h sem nenhuma `MensagemWhatsapp`, avisa também.
  Cobre o caso de a instância se dizer conectada mas o webhook estar quebrado.

---

## Variáveis de ambiente

```
EVOLUTION_API_URL=            # http://evolution:8080 (rede interna do Coolify)
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=           # nome da instância criada
WHATSAPP_WEBHOOK_TOKEN=       # segredo do header, gerado aqui
WHATSAPP_GRUPO_ID=            # <numeros>@g.us
WHATSAPP_REMETENTES=          # só dígitos, separados por vírgula
CAIXA_TITULARES=              # Nome;Razão Social;CNPJ;chave-pix
```

Todas lidas em runtime. Nenhuma exposta no client.

## Critérios de aceite

1. Print de Pix recebido, encaminhado no grupo, vira sugestão de **ENTRADA** com
   valor certo, e aparece em `/admin/financeiro/pendencias`.
2. Print de Pix **feito pelo cliente** (perspectiva dele, texto "enviado") também
   vira **ENTRADA**. Esse é o teste que valida a Fase F.
3. Comprovante de conta paga vira sugestão de **SAIDA**.
4. Mesmo comprovante encaminhado duas vezes gera **um** lançamento; a segunda vez
   recebe aviso de duplicado.
5. Mensagem de fora do grupo, ou de remetente fora da lista, não gera nada.
6. Foto sem cara de comprovante não chama a IA e não gera sugestão.
7. Com o Gemini fora do ar, o arquivo está no S3 e o grupo recebe o aviso de
   lançar à mão.
8. Nenhum lançamento entra como `CONFIRMADO` sem alguém clicar.
9. Sugestão de comprovante **não** aparece na lista de contas a pagar nem conta
   como vencida no selo da navegação.
10. Derrubar a instância do Evolution dispara alerta no Telegram em até 15 min.

## Fora de escopo (fases futuras)

- Confirmar respondendo no próprio grupo ("1" confirma). v1 confirma no painel.
- Criar `Order` e dar baixa em estoque a partir da venda do WhatsApp.
- Atendimento automatizado de cliente. Decisão separada, risco diferente.
- Mover `financeiro/comprovantes/` do bucket público pra acesso assinado. Hoje a
  chave é UUID (difícil de adivinhar), mas o objeto é público. O volume que esta
  fase traz aumenta a exposição e cobra essa dívida.
