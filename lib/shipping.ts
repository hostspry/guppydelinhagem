import "server-only";
import { MAX_PEIXES_POR_CAIXA } from "@/lib/constants";

// Config interna de frete. NUNCA importar de Client Component — o `server-only`
// quebra o build se isso acontecer, evitando vazar markup/regras pro browser.
export const FRETE_CONFIG = {
  cepOrigem: "29201010", // CEP da fazenda em Guarapari
  pacotePadrao: { height: 30, width: 30, length: 30, weight: 2 }, // cm / kg
  insuranceValue: 100,
  // Regras de precificação — SERVIDOR APENAS
  jadlogMarkup: 1.5, // multiplicador sobre o preço bruto da API
  caixaIsopor: 20, // R$ adicionados após o markup
  gollog: { min: 80, max: 110 }, // faixa exibida ao cliente, valor fixo
  jadlogLabel: "JADLOG entrega no seu CEP", // label exibido ao client
  prazoMaximoSeguro: 13, // dias úteis — a partir disso (>=) frete terrestre exige avaliação
  maxPeixesPorCaixa: MAX_PEIXES_POR_CAIXA, // limite por caixa — frete único até aqui
};
