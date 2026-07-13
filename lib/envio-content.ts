// Conteúdo de /envio (confiança/conversão). Cluster: transporte de peixes vivos,
// envio de peixe para todo o Brasil, como o peixe chega vivo.
//
// Complementa /frete (a calculadora): esta página explica o PROCESSO e gera
// confiança; /frete calcula o valor pelo CEP. Sem inventar prazo fixo nem termos
// de garantia. O que descrevo é o processo real de embalagem e o cuidado ao
// receber, que é orientação segura, não promessa comercial.

import type { QaPair } from "@/lib/seo/jsonld";

export const ENVIO_INTRO =
  "Mandar peixe vivo pelo Brasil parece arriscado, mas com a embalagem certa é seguro e acontece todo dia. Eu envio guppy para todos os estados a partir de Guarapari, no Espírito Santo, e aqui explico exatamente como o peixe viaja e o que fazer quando ele chega.";

export const ENVIO_PASSOS: { titulo: string; texto: string }[] = [
  {
    titulo: "1. Preparo antes de viajar",
    texto:
      "Separo o peixe e observo antes do envio. Peixe que não está no ponto para viajar não vai. A ideia é que ele saia forte da estufa.",
  },
  {
    titulo: "2. Embalagem com oxigênio",
    texto:
      "Cada peixe vai em saco próprio, com água da nossa criação e oxigênio, embalado à mão. O saco vai protegido dentro da caixa para segurar temperatura e absorver solavancos.",
  },
  {
    titulo: "3. Transporte para todo o Brasil",
    texto:
      "Uso transportadoras que atendem o país inteiro. O valor e o prazo dependem do seu CEP e você calcula na página de cada peixe e no carrinho, ou na calculadora de frete.",
  },
  {
    titulo: "4. Ao receber: aclimatação",
    texto:
      "Abra a caixa num lugar sem luz forte. Deixe o saco fechado boiando no aquário por cerca de 15 a 20 minutos para igualar a temperatura, vá misturando um pouco da água do aquário aos poucos e só então solte o peixe. Nada de despejar a água do transporte no aquário.",
  },
];

export const ENVIO_FAQ: QaPair[] = [
  {
    pergunta: "Como o peixe chega vivo pelo correio ou transportadora?",
    resposta:
      "Ele viaja em saco com água e oxigênio, embalado à mão e protegido dentro da caixa para manter a temperatura. Guppy aguenta bem esse tipo de transporte quando a embalagem é feita direito, que é como eu preparo cada envio.",
  },
  {
    pergunta: "Vocês enviam guppy para todo o Brasil?",
    resposta:
      "Sim, envio para todos os estados a partir de Guarapari, no Espírito Santo. O frete é calculado pelo seu CEP na página de cada peixe, no carrinho e na calculadora de frete.",
  },
  {
    pergunta: "Quanto custa o frete e quanto tempo demora?",
    resposta:
      "Depende do destino. Você calcula o valor e vê o prazo colocando o seu CEP na calculadora de frete e na página do peixe. Como varia muito por região, prefiro não prometer um prazo único para o Brasil inteiro.",
  },
  {
    pergunta: "O que faço quando o peixe chega?",
    resposta:
      "Aclimate antes de soltar: deixe o saco fechado boiando no aquário por 15 a 20 minutos para igualar a temperatura, misture um pouco da água do aquário aos poucos e então solte o peixe, sem jogar a água do transporte no aquário.",
  },
];
