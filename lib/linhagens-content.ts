// Conteúdo estático das páginas de linhagens (/linhagens e /linhagens/endler).
// Fica separado do JSX para manter as páginas legíveis, no mesmo padrão de
// lib/guia-content.ts. Copy em primeira pessoa, direta, sem termos inflados.
//
// IMPORTANTE (regra da missão de SEO): nada aqui inventa linhagem. Os tipos
// listados em TIPOS_GUPPY são apenas os que o próprio site já nomeia (home e
// /peixe-guppy) e que aparecem no catálogo. Cada chip aponta para a busca
// da loja, então se não houver peixe daquela linhagem o filtro só volta vazio,
// nunca uma página falsa.

import type { QaPair } from "@/lib/seo/jsonld";
import type { RespostaRapidaData } from "@/lib/guia-content";

// ── /linhagens ────────────────────────────────────────────────────────────────

// Chips de "tipos de guppy". `busca` é o termo que a vitrine da home entende
// (?busca=...), casando por nome ou padrão de cor do produto.
export type TipoGuppy = { nome: string; busca: string };

export const TIPOS_GUPPY: TipoGuppy[] = [
  { nome: "Full Red", busca: "full red" },
  { nome: "Full Black", busca: "full black" },
  { nome: "Koi", busca: "koi" },
  { nome: "Half Moon", busca: "half moon" },
  { nome: "Half Black", busca: "half black" },
  { nome: "Japan Blue", busca: "japan blue" },
  { nome: "Blue Grass", busca: "blue grass" },
];

export const RESP_O_QUE_E_LINHAGEM: RespostaRapidaData = {
  titulo: "O que é um guppy de linhagem?",
  texto:
    "É o guppy, também chamado de lebiste, que passou por seleção de várias gerações para fixar cor, cauda e padrão. Diferente do guppy comum de loja, os filhotes saem parecidos com os pais, ninhada após ninhada.",
};

export const LINHAGENS_FAQ: QaPair[] = [
  {
    pergunta: "Guppy e lebiste são a mesma coisa?",
    resposta:
      "São. Guppy e lebiste são dois nomes do mesmo peixe, o Poecilia reticulata. Lebiste é o nome popular em várias regiões do Brasil; guppy é o nome internacional. Aqui você encontra as duas grafias porque é o mesmo peixe.",
  },
  {
    pergunta: "Qual a diferença entre guppy de linhagem e guppy comum?",
    resposta:
      "O guppy comum tem genética misturada, então os filhotes saem imprevisíveis. O de linhagem vem de seleção de reprodutores por várias gerações, então mantém cor, cauda e padrão de forma consistente. É esse trabalho que rendeu o tricampeonato mundial na linha Full Black.",
  },
  {
    pergunta: "Quais linhagens de guppy vocês criam?",
    resposta:
      "Trabalho com linhagens como Full Red, Full Black, Koi, Half Moon, Half Black, Japan Blue e Blue Grass, além de guppy Endler. A disponibilidade muda conforme a criação, então vale conferir a lista atual na loja ou falar comigo no WhatsApp.",
  },
  {
    pergunta: "Quanto custa um guppy de linhagem?",
    resposta:
      "O preço varia conforme a linhagem, a raridade e se é casal, trio ou macho avulso. Os valores de cada peixe disponível ficam na loja, com desconto no Pix. Como é criação selecionada, o preço é diferente do guppy comum de loja.",
  },
  {
    pergunta: "Vocês enviam guppy vivo para todo o Brasil?",
    resposta:
      "Sim. Embalo cada peixe à mão, com oxigênio e água da própria criação, e envio para todo o Brasil. O frete é calculado pelo CEP na página de cada peixe e no carrinho.",
  },
];

// ── /linhagens/endler ─────────────────────────────────────────────────────────

export const RESP_O_QUE_E_ENDLER: RespostaRapidaData = {
  titulo: "O que é o guppy Endler?",
  texto:
    "O Endler (Poecilia wingei) é um primo próximo do guppy comum. É menor, com cores muito vivas e metálicas, e mantém um visual mais próximo do peixe selvagem. Convive e cruza com o guppy, mas quem cria linhagem prefere manter o Endler puro para preservar o padrão.",
};

export const ENDLER_FAQ: QaPair[] = [
  {
    pergunta: "Guppy Endler é a mesma coisa que lebiste?",
    resposta:
      "São parentes próximos, mas não idênticos. O lebiste comum é o Poecilia reticulata; o Endler é o Poecilia wingei. Os dois são pequenos, coloridos e vivíparos, e chegam a cruzar entre si, mas o Endler tem corpo menor e cores mais metálicas.",
  },
  {
    pergunta: "Endler é bom para iniciante?",
    resposta:
      "É. O Endler é resistente e ativo, como o guppy. Precisa da mesma base de cuidado: água estável, temperatura entre 24 e 26 °C e alimentação variada. Por ser pequeno, cabe bem em aquários menores e plantados.",
  },
  {
    pergunta: "O Endler cruza com guppy comum?",
    resposta:
      "Cruza, e os filhotes são férteis. Por isso, para manter a linhagem Endler pura, o certo é criar o Endler separado do guppy comum. Se o objetivo é só um aquário bonito, a mistura não é problema, mas deixa de ser Endler puro.",
  },
  {
    pergunta: "Vocês têm guppy Endler à venda?",
    resposta:
      "O Endler entra e sai conforme a criação. Quando não estiver na lista da loja, me chame no WhatsApp para entrar na lista de espera ou saber a próxima ninhada disponível.",
  },
];
