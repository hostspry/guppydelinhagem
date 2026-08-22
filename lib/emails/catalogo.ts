import "server-only";

/**
 * Catálogo dos e-mails automáticos.
 *
 * Cada mensagem tem um texto PADRÃO aqui e pode ser reescrita no painel. O banco
 * guarda só o que o dono mudou; o padrão continua sendo a referência (e o botão
 * "voltar ao texto padrão" traz de volta a partir daqui).
 *
 * O corpo é texto simples, não HTML: quem escreve é o dono da loja, não um
 * programador. A formatação disponível é o mínimo que dá conta —
 * `**negrito**`, linha em branco separando parágrafo e as variáveis abaixo.
 */

export type VariavelTemplate = {
  nome: string; // como se escreve: {{nome}}
  descricao: string;
  bloco?: boolean; // true = vira um pedaço visual (lista, botão, caixa)
};

export type TemplateDef = {
  chave: string;
  rotulo: string; // nome na lista do painel
  quando: string; // quando este e-mail sai
  variaveis: VariavelTemplate[];
  padrao: { assunto: string; titulo: string; corpo: string };
};

const VAR_NOME: VariavelTemplate = {
  nome: "nome",
  descricao: "Primeiro nome do cliente",
};
const VAR_NUMERO: VariavelTemplate = {
  nome: "numero",
  descricao: "Número do pedido (ex.: #2026-0041)",
};

export const TEMPLATES: TemplateDef[] = [
  {
    chave: "pedido-pago",
    rotulo: "Pagamento confirmado",
    quando: "Sai quando o pagamento do pedido é confirmado.",
    variaveis: [
      VAR_NOME,
      VAR_NUMERO,
      { nome: "total", descricao: "Valor total do pedido" },
      { nome: "itens", descricao: "Lista dos itens comprados", bloco: true },
      {
        nome: "botao_acompanhar",
        descricao: "Botão “Acompanhar meu pedido”",
        bloco: true,
      },
    ],
    padrao: {
      assunto: "Pagamento confirmado — pedido {{numero}}",
      titulo: "Pagamento confirmado!",
      corpo: `Oi {{nome}}, seu pagamento entrou e o pedido **{{numero}}** já está na fila de separação.

{{itens}}

Total: **{{total}}**

Assim que eu despachar, te mando o código de rastreio por aqui. Peixe vivo eu separo com calma e embalo com oxigênio no mesmo dia do envio.

{{botao_acompanhar}}`,
    },
  },
  {
    chave: "pedido-pago-retirada",
    rotulo: "Pagamento confirmado (retirada)",
    quando:
      "Mesma hora do anterior, mas quando o cliente escolheu retirar pessoalmente.",
    variaveis: [
      VAR_NOME,
      VAR_NUMERO,
      { nome: "total", descricao: "Valor total do pedido" },
      { nome: "itens", descricao: "Lista dos itens comprados", bloco: true },
      {
        nome: "botao_acompanhar",
        descricao: "Botão “Acompanhar meu pedido”",
        bloco: true,
      },
    ],
    padrao: {
      assunto: "Pagamento confirmado — pedido {{numero}}",
      titulo: "Pagamento confirmado!",
      corpo: `Oi {{nome}}, seu pagamento entrou e o pedido **{{numero}}** já está separado no seu nome.

{{itens}}

Total: **{{total}}**

Como você escolheu retirar pessoalmente, é só combinar o horário comigo pelo WhatsApp.

{{botao_acompanhar}}`,
    },
  },
  {
    chave: "pedido-enviado",
    rotulo: "Pedido enviado",
    quando: "Sai quando o pedido é marcado como enviado no painel.",
    variaveis: [
      VAR_NOME,
      VAR_NUMERO,
      {
        nome: "transportadora",
        descricao: "Nome da transportadora (vazio se não houver)",
      },
      { nome: "rastreio", descricao: "Código de rastreio (texto)" },
      {
        nome: "caixa_rastreio",
        descricao: "Caixa destacada com o código",
        bloco: true,
      },
      {
        nome: "botao_rastrear",
        descricao: "Botão “Rastrear entrega”",
        bloco: true,
      },
    ],
    padrao: {
      assunto: "Pedido {{numero}} enviado",
      titulo: "Seu pedido saiu para entrega",
      corpo: `Oi {{nome}}, o pedido **{{numero}}** foi despachado {{transportadora}}.

{{caixa_rastreio}}

{{botao_rastrear}}

Peixe viaja embalado com oxigênio. Quando chegar, deixe o saquinho fechado boiando no aquário por uns 20 minutos antes de abrir, para a temperatura igualar.

Qualquer coisa no caminho, me chama no WhatsApp.`,
    },
  },
  {
    chave: "cobranca-paga",
    rotulo: "Cobrança paga",
    quando: "Sai quando uma cobrança avulsa (link de pagamento) é paga.",
    variaveis: [VAR_NOME, { nome: "total", descricao: "Valor pago" }],
    padrao: {
      assunto: "Pagamento confirmado — Guppy de Linhagem",
      titulo: "Pagamento confirmado",
      corpo: `Oi {{nome}}, recebi seu pagamento de **{{total}}**. Obrigado!

Qualquer coisa, é só responder este e-mail.`,
    },
  },
];

export function templateDef(chave: string): TemplateDef | null {
  return TEMPLATES.find((t) => t.chave === chave) ?? null;
}
