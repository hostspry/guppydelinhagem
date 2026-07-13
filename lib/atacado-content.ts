// Conteúdo de /atacado (conversão B2B). Cluster: criador de guppy, comprar guppy
// no atacado, fornecedor de peixes ornamentais para revenda.
//
// Regra da missão: NÃO inventar condição comercial (quantidade mínima, preço,
// desconto por volume). Tudo que é negociação fica como "fale comigo", porque
// depende da linhagem e da disponibilidade. O que afirmo aqui é só o que é
// verdade: a criação, a estufa, os títulos e o envio para todo o Brasil.

import type { QaPair } from "@/lib/seo/jsonld";

export const ATACADO_INTRO =
  "Se você tem loja de aquarismo, cria para revenda ou monta projetos com guppy, dá para se abastecer direto da fonte. Aqui não é revenda de peixe importado sem procedência: é guppy nascido e selecionado na nossa estufa, em Guarapari, no Espírito Santo, a mesma criação que rendeu título mundial.";

export const ATACADO_MOTIVOS: { titulo: string; texto: string }[] = [
  {
    titulo: "Genética de campeonato",
    texto:
      "Você leva peixe da mesma linhagem que disputa e vence o World Guppy Contest, com padrão de cor e cauda consistente, não guppy comum de genética misturada.",
  },
  {
    titulo: "Peixe saudável e aclimatado",
    texto:
      "Criação própria, com controle de água e alimentação desde o nascimento. Peixe forte chega melhor na sua loja e vende melhor para o seu cliente.",
  },
  {
    titulo: "Envio para todo o Brasil",
    texto:
      "Embalo à mão, com oxigênio, e envio para qualquer estado. Você não precisa estar perto de Guarapari para trabalhar com a nossa criação.",
  },
  {
    titulo: "Direto com o criador",
    texto:
      "Você fala comigo, não com atravessador. Isso deixa a combinação de linhagem, quantidade e frequência mais fácil de acertar.",
  },
];

export const ATACADO_FAQ: QaPair[] = [
  {
    pergunta: "Vocês vendem guppy no atacado para lojistas?",
    resposta:
      "Sim. Atendo lojas de aquarismo, criadores e projetos de revenda. Como o fornecimento depende da linhagem e da ninhada disponível, o melhor caminho é falar comigo no WhatsApp para combinar o que você precisa.",
  },
  {
    pergunta: "Qual a quantidade mínima para comprar no atacado?",
    resposta:
      "Depende da linhagem e do momento da criação, então não tem um número fixo para tudo. Me diga o que você procura e o volume que pensa em levar, que eu vejo o que consigo atender e em quanto tempo.",
  },
  {
    pergunta: "Como funciona o preço no atacado?",
    resposta:
      "O preço varia conforme a linhagem, a raridade e a quantidade. Não trabalho com tabela pronta publicada porque a disponibilidade muda, então fechamos o valor na conversa, de acordo com o seu pedido.",
  },
  {
    pergunta: "Vocês enviam para revenda em outros estados?",
    resposta:
      "Envio para todo o Brasil. O peixe vai embalado à mão, com oxigênio e água da própria criação. O frete é combinado conforme o destino e o tamanho do pedido.",
  },
];
