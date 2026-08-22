import "server-only";

/**
 * Catálogo dos e-mails automáticos: ESTRUTURA, não texto.
 *
 * O conteúdo (assunto, título, corpo) mora no banco, tabela TemplateEmail — é o
 * dono da loja quem escreve, e mudar uma vírgula não pode exigir deploy. Aqui
 * ficam só as coisas que o CÓDIGO precisa garantir: que a mensagem existe, o que
 * a dispara e quais etiquetas ela sabe preencher.
 *
 * Mensagem nova: acrescente aqui e insira a linha no banco (migration com o texto
 * de fábrica, como em 20260822020000_seed_templates_email).
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
  },
  {
    chave: "cobranca-paga",
    rotulo: "Cobrança paga",
    quando: "Sai quando uma cobrança avulsa (link de pagamento) é paga.",
    variaveis: [VAR_NOME, { nome: "total", descricao: "Valor pago" }],
  },
];

export function templateDef(chave: string): TemplateDef | null {
  return TEMPLATES.find((t) => t.chave === chave) ?? null;
}
