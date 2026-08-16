/**
 * Tipos de evento do visitante. Arquivo PURO: o client importa daqui para
 * enviar, e o admin para exibir.
 */
export const EVENTOS = {
  PAGINA: "pagina_vista",
  PRODUTO: "produto_visto",
  BUSCA: "busca",
  CARRINHO_ADD: "carrinho_add",
  CARRINHO_REMOVE: "carrinho_remove",
  CARRINHO_QTD: "carrinho_qtd",
  CARRINHO_ABERTO: "carrinho_aberto",
  CHECKOUT: "checkout_iniciado",
  PAGAMENTO: "pagamento_iniciado",
  PEDIDO: "pedido_criado",
  LOGIN: "login",
  CADASTRO: "cadastro",
  CONTA_ALTERADA: "conta_alterada",
  SENHA_ALTERADA: "senha_alterada",
  ENDERECO_ALTERADO: "endereco_alterado",
  WHATSAPP: "whatsapp_clicado",
} as const;

export type TipoEvento = (typeof EVENTOS)[keyof typeof EVENTOS];

export const TIPOS_VALIDOS: string[] = Object.values(EVENTOS);

export const EVENTO_LABEL: Record<string, string> = {
  pagina_vista: "Abriu uma página",
  produto_visto: "Olhou o peixe",
  busca: "Buscou",
  carrinho_add: "Colocou no carrinho",
  carrinho_remove: "Tirou do carrinho",
  carrinho_qtd: "Mudou a quantidade",
  carrinho_aberto: "Abriu o carrinho",
  checkout_iniciado: "Começou o checkout",
  pagamento_iniciado: "Foi para o pagamento",
  pedido_criado: "Fechou o pedido",
  login: "Entrou na conta",
  cadastro: "Criou a conta",
  conta_alterada: "Mudou dados da conta",
  senha_alterada: "Trocou a senha",
  endereco_alterado: "Mexeu no endereço",
  whatsapp_clicado: "Chamou no WhatsApp",
};

/** Eventos que valem destaque na jornada (os outros são ruído de navegação). */
export const EVENTOS_IMPORTANTES = new Set<string>([
  EVENTOS.PRODUTO,
  EVENTOS.CARRINHO_ADD,
  EVENTOS.CARRINHO_REMOVE,
  EVENTOS.CHECKOUT,
  EVENTOS.PAGAMENTO,
  EVENTOS.PEDIDO,
  EVENTOS.CADASTRO,
  EVENTOS.WHATSAPP,
]);
