# Shopee — pedidos e estoque (fase 1)

O que esta fase entrega: pedido pago na Shopee entra sozinho no painel e baixa o
estoque; venda no site derruba o estoque na Shopee. Os anúncios continuam sendo
criados e editados no painel da Shopee.

## O que você precisa fazer (fora do código)

Nada disso dá para eu fazer por você — exige a conta da loja.

1. **Abrir a loja na Shopee**, se ainda não tiver. Vendedor comum, em
   `seller.shopee.com.br`.
2. **Criar o app na Open Platform**: `open.shopee.com` → entrar com a conta da
   loja → *My Apps* → criar app. Sai um **partner ID** (números) e uma
   **partner key** (texto longo). A key aparece uma vez — guarde.
3. **Cadastrar os dois endereços no app**, exatamente como a tela de
   Configurações → Shopee mostra (tem botão de copiar):
   - Redirect / callback: `https://guppydelinhagem.com.br/api/shopee/callback`
   - Push / webhook: `https://guppydelinhagem.com.br/api/shopee/webhook`

   A Shopee compara caractere a caractere. Uma barra a mais no fim e ela recusa
   sem dizer o motivo.
4. **Marcar as APIs que o app usa**: Shop, Product e Order. App sem a API
   marcada recebe "no permission" em cima de uma chave que está certa.
5. **Agendar o cron no Coolify**: `/api/cron/shopee`, a cada 15 minutos, com o
   header `Authorization: Bearer $CRON_SECRET`.

O ambiente **Sandbox** tem partner ID e key próprios, diferentes dos de
produção. Dá para construir e testar tudo nele antes de ligar a loja de verdade.

## Ligar

Configurações → Shopee: cole partner ID e key, escolha o ambiente, salve, clique
em **Autorizar a loja**. Você vai para a Shopee, autoriza, e volta já conectado.
Depois **Testar conexão** confirma que está de pé.

Por fim, **Buscar anúncios da Shopee** e ligar cada anúncio ao produto do site.
Sem essa ligação o pedido ainda entra (o caixa fica certo), mas o estoque não
mexe.

## Como funciona

**Pedido.** A Shopee avisa por webhook, e o cron varre a cada 15 minutos como
rede de segurança — aviso se perde (deploy no ar, instabilidade), e uma venda
que não entra é estoque errado nos dois lados. O pedido nasce e é confirmado
pelo mesmo caminho do webhook do Mercado Pago, então baixa estoque, conta cupom
e entra no caixa igual a qualquer venda. Entrar duas vezes é impossível: a
unique `(origem, origemPedidoId)` segura.

**Estoque.** Direção única: o site manda, a Shopee recebe. A verdade é o site,
porque é lá que você cadastra o que entrou e é lá que os dois canais dão baixa.
Vendeu no site, o estoque da Shopee cai em seguida (na hora, fora da transação);
se a Shopee estiver fora do ar, o cron corrige na rodada seguinte.

**Envio.** Quem despacha é a Shopee, com a etiqueta dela. O painel esconde a
compra de etiqueta e o registro manual de envio nesses pedidos — comprar frete
no Melhor Envio para um pedido da Shopee seria pagar duas vezes.

## O que fica de fora, e por quê

- **Peixe não vai para a Shopee.** A política dela proíbe animais vivos. Só
  produto seco (criadeira, ração, acessório) entra — a tela de ligação nem
  oferece produto do tipo PEIXE.
- **Publicar anúncio pelo site** ficou para depois. A Shopee exige categoria,
  atributos obrigatórios e marca por categoria, e cada anúncio passa por revisão
  dela; é uma fase inteira sozinha.
- **CPF e e-mail do comprador** a Shopee não entrega (proteção de dados). O
  cliente é casado pelo telefone; sem telefone, entra cadastro novo. Ele nasce
  com `aceitaEmails: false` — quem comprou no marketplace não entrou na nossa
  lista.

## A janela de risco que sobra

Entre a venda em um canal e a atualização no outro existe um intervalo. No
caminho site → Shopee ele é de segundos. No caminho Shopee → site, depende do
webhook chegar; se ele falhar, é de até 15 minutos, o intervalo do cron.

Com uma peça só em estoque, dá para vender nos dois lugares dentro dessa janela.
Não existe jeito de fechar isso por completo sem a Shopee reservar estoque para
nós, o que ela não faz. O que reduz: manter uma folga no estoque anunciado lá
quando a peça for única.

## Prazo de validade da autorização

O access_token dura 4 horas e o refresh_token morre com **30 dias sem uso**. O
cron renova sozinho a cada 15 minutos, então na prática isso nunca acontece —
mas se o cron ficar parado um mês, a autorização cai e você precisa clicar em
"Autorizar a loja" de novo. A tela avisa quando faltam 5 dias ou menos.

## Testar sem credencial

```
npx tsx scripts/teste-assinatura-shopee.mts   # a assinatura HMAC, com valores fixos
npx tsx scripts/teste-endereco-shopee.mts     # a leitura do endereço do pedido
```

O primeiro existe porque "wrong sign" é o erro mais comum e mais mudo da Open
Platform: ela recusa sem dizer qual pedaço está errado.

## Arquivos

| Arquivo | O quê |
| --- | --- |
| `lib/shopee/assinatura.ts` | HMAC, URL e link de autorização. Módulo puro. |
| `lib/shopee/cliente.ts` | Credenciais, token (renova sozinho) e chamada assinada. |
| `lib/shopee/pedidos.ts` | Importa e grava o pedido; lê o endereço. |
| `lib/shopee/estoque.ts` | Empurra o estoque do site para os anúncios. |
| `lib/shopee/cancelar.ts` | Cancelamento lá devolve o estoque aqui. |
| `app/api/shopee/callback` | Volta da autorização; troca o code pelo token. |
| `app/api/shopee/webhook` | Aviso de pedido, com assinatura conferida. |
| `app/api/cron/shopee` | Renova token, importa pedidos, sincroniza estoque. |
| `actions/shopee.ts` | Ações da tela (salvar, testar, ligar anúncio). |
