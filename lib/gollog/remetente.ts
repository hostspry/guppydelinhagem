import "server-only";

/**
 * Remetente da minuta da Gollog: quem despacha o peixe no aeroporto de Vitória
 * e emite a nota fiscal da remessa.
 *
 * Não é o remetente das etiquetas do Melhor Envio (Configurações da loja): o
 * peixe vivo sai pela estufa, com CNPJ próprio. Os dados são os da minuta
 * padrão que a loja já usa com a Gollog.
 */
export const REMETENTE_GOLLOG = {
  nome: "SAULO CEZAR PACHECO BATISTA",
  documento: "50595892000199",
  logradouro: "Rua Projetada",
  numero: "000",
  complemento: "",
  bairro: "Vila Nova",
  cep: "29330000",
  cidade: "Itapemirim",
  uf: "ES",
  telefone: "28999888594",
  email: "",
  /** Base Gollog onde a caixa é entregue para embarque. */
  aeroportoOrigem: "VIX",
  /** "Local e data" da autorização: onde a minuta é assinada, no despacho em Vitória. */
  localAssinatura: "Vitória - ES",
} as const;
