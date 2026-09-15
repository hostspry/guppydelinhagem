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
const VAR_QUANDO_POSTOU: VariavelTemplate = {
  nome: "quando_postou",
  descricao: "Dia da postagem: “hoje”, “ontem” ou “no dia 12/09”",
};

export const TEMPLATES: TemplateDef[] = [
  {
    chave: "pedido-pago",
    rotulo: "Pagamento confirmado (bicho vivo)",
    quando:
      "Sai quando o pagamento é confirmado e o pedido tem peixe, planta ou coral.",
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
    chave: "pedido-pago-seco",
    rotulo: "Pagamento confirmado (sem bicho vivo)",
    quando:
      "Mesma hora do “Pagamento confirmado”, quando o pedido não tem peixe, planta nem coral — só criadeira, ração, acessório.",
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
    rotulo: "Encomenda postada (bicho vivo)",
    quando:
      "Sai quando a transportadora registra a postagem do pedido com bicho vivo, quando o envio é registrado à mão ou quando um código de rastreio é adicionado. Contém a instrução de aclimatar o saquinho.",
    variaveis: [
      VAR_NOME,
      VAR_NUMERO,
      VAR_QUANDO_POSTOU,
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
    chave: "pedido-enviado-seco",
    rotulo: "Encomenda postada (sem bicho vivo)",
    quando:
      "Mesma hora da “Encomenda postada”, quando não vai bicho vivo na caixa — sem a instrução de aclimatar o saquinho.",
    variaveis: [
      VAR_NOME,
      VAR_NUMERO,
      VAR_QUANDO_POSTOU,
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
    chave: "envio-aereo-confirmar",
    rotulo: "Confirmar aeroporto (envio aéreo)",
    quando:
      "Sai quando um pedido com envio aéreo (Gollog) é pago, ou quando você pede a confirmação na página do pedido. O cliente confirma endereço, aeroporto de retirada e quem vai buscar.",
    variaveis: [
      VAR_NOME,
      VAR_NUMERO,
      {
        nome: "botao_confirmar",
        descricao: "Botão “Confirmar aeroporto e endereço”",
        bloco: true,
      },
      { nome: "link", descricao: "Endereço do link, em texto" },
    ],
  },
  {
    chave: "acesso-cliente",
    rotulo: "Acesso do cliente",
    quando:
      "Sai quando você cria (ou renova) o acesso de um cliente na página do pedido.",
    variaveis: [
      VAR_NOME,
      { nome: "email_login", descricao: "E-mail que ele usa para entrar" },
      { nome: "senha", descricao: "Senha temporária gerada agora" },
      {
        nome: "caixa_acesso",
        descricao: "Caixa destacada com e-mail e senha",
        bloco: true,
      },
      { nome: "botao_entrar", descricao: "Botão “Entrar na minha conta”", bloco: true },
    ],
  },
  {
    chave: "recuperar-senha",
    rotulo: "Recuperar senha",
    quando: "Sai quando o cliente pede uma nova senha na tela de login.",
    variaveis: [
      VAR_NOME,
      { nome: "validade", descricao: "Por quanto tempo o link vale (ex.: 1 hora)" },
      {
        nome: "botao_redefinir",
        descricao: "Botão “Criar nova senha”",
        bloco: true,
      },
      { nome: "link", descricao: "Endereço do link, em texto" },
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
