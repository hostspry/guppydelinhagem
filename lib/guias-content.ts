// Conteúdo dos guias de conteúdo (/guia/*). Separado do JSX no mesmo padrão de
// lib/guia-content.ts. Copy de criador, primeira pessoa, direta, sem termos
// inflados e sem dose de medicamento.
//
// Anti-canibalização: /peixe-guppy é a página pilar ("o que é" + "como
// cuidar"). Estes guias tratam SUBTEMAS com volume próprio e pouca sobreposição
// com o pilar (reprodução aprofundada, sexagem, filhotes). Cada um linka de volta
// para o pilar e para os guias irmãos.

import type { QaPair } from "@/lib/seo/jsonld";

// ── /guia/reproducao-de-guppy ─────────────────────────────────────────────────
// Cluster: reprodução de guppy, guppy grávida, guppy prenha, guppy tendo filhote,
// guppy come os filhotes, reprodução de lebiste.

export const REPRODUCAO_INTRO =
  "Reproduzir guppy é uma das coisas mais fáceis do aquarismo: junte machos e fêmeas saudáveis, com água estável, e a natureza faz o resto. O guppy é vivíparo, ou seja, a fêmea não põe ovos, os filhotes já nascem nadando. O que dá trabalho não é reproduzir, é manter linhagem, e disso eu falo no fim.";

export const REPRODUCAO_GRAVIDA: string[] = [
  "Barriga volumosa e quadrada, que vai crescendo ao longo dos dias.",
  "Mancha gravídica: uma área escura perto da nadadeira anal, que fica mais forte conforme o parto se aproxima.",
  "A fêmea costuma se isolar e procurar cantos mais calmos quando está perto de parir.",
];

export const REPRODUCAO_PASSOS: { titulo: string; texto: string }[] = [
  {
    titulo: "Gestação de 21 a 30 dias",
    texto:
      "Depois do cruzamento, a gestação leva de 21 a 30 dias, dependendo da temperatura da água. Água mais quente, dentro do saudável, tende a encurtar um pouco esse tempo.",
  },
  {
    titulo: "A fêmea armazena esperma",
    texto:
      "De um único cruzamento a fêmea pode ter várias ninhadas seguidas, com intervalo de algumas semanas. Por isso uma fêmea que veio de outro aquário pode parir mesmo sem macho por perto.",
  },
  {
    titulo: "Hora do parto",
    texto:
      "Cada ninhada costuma ter de 20 a 60 filhotes, às vezes mais em fêmeas grandes. O parto acontece aos poucos, ao longo de algumas horas.",
  },
  {
    titulo: "Proteja os filhotes",
    texto:
      "Guppy adulto come alevino, inclusive a própria mãe. Separe a fêmea numa maternidade antes do parto e devolva ela ao aquário logo depois, ou dê muito esconderijo com plantas densas para os filhotes se salvarem.",
  },
];

export const REPRODUCAO_FAQ: QaPair[] = [
  {
    pergunta: "Como sei que minha guppy está grávida?",
    resposta:
      "Observe a barriga, que fica volumosa e mais quadrada, e a mancha gravídica, aquela área escura perto da nadadeira anal que escurece conforme o parto se aproxima. Fêmea adulta em aquário com machos quase sempre está gerando.",
  },
  {
    pergunta: "Quanto tempo dura a gestação do guppy?",
    resposta:
      "De 21 a 30 dias, variando com a temperatura. A fêmea ainda armazena esperma, então pode ter várias ninhadas seguidas a partir de um único cruzamento.",
  },
  {
    pergunta: "Por que o guppy come os próprios filhotes?",
    resposta:
      "É instinto: para o guppy adulto, o alevino é só uma presa pequena, não um filho. Não é doença nem falta de comida. A solução é separar a fêmea numa maternidade na hora do parto ou dar muito esconderijo com plantas.",
  },
  {
    pergunta: "Reprodução de lebiste é diferente da de guppy?",
    resposta:
      "Não, é o mesmo peixe. Guppy e lebiste são dois nomes do Poecilia reticulata, então a reprodução é idêntica: vivíparo, filhotes nadando ao nascer e a mesma necessidade de proteger os alevinos.",
  },
];

// ── /guia/macho-e-femea (REMOVIDO) ────────────────────────────────────────────
// A sexagem foi consolidada na seção "Macho e fêmea" do pilar /peixe-guppy
// (dados em lib/peixe-guppy-content). A rota antiga agora faz 308 para o pilar
// (next.config), então os antigos exports MACHO_FEMEA_* saíram daqui.

// ── /guia/filhotes-de-guppy ───────────────────────────────────────────────────
// Cluster: filhote de guppy, alevino de guppy, como cuidar de alevinos, ração
// para alevinos de guppy.

export const FILHOTES_INTRO =
  "Alevino de guppy é frágil nas primeiras semanas, mas cria fácil com o básico bem feito: água limpa e estável, comida boa e frequente, e proteção contra os adultos. Este é o cuidado pós-nascimento, seguindo do que eu explico no guia de reprodução.";

export const FILHOTES_CUIDADOS: string[] = [
  "Mantenha a água limpa e estável, com trocas parciais pequenas e frequentes.",
  "Não superlote a maternidade: alevino cresce melhor com espaço.",
  "Ofereça bastante planta ou esconderijo se os filhotes dividem aquário com adultos.",
  "Temperatura estável, entre 24 e 26 °C na maior parte do Brasil, acelera o crescimento saudável.",
];

export const FILHOTES_ALIMENTACAO: string[] = [
  "Comida bem fininha, várias vezes ao dia, em pouca quantidade de cada vez.",
  "Ração em pó específica para alevino, ou ração de adulto triturada bem fina.",
  "Náuplios de artêmia recém-eclodidos, quando possível, engordam e dão cor.",
  "Retire o excesso de comida para não sujar a água, que é o maior risco nessa fase.",
];

export const FILHOTES_FAQ: QaPair[] = [
  {
    pergunta: "O que dar de comer para alevino de guppy?",
    resposta:
      "Comida bem fina, várias vezes ao dia: ração em pó para alevino ou ração de adulto triturada, e, quando der, náuplios de artêmia recém-eclodidos. Ofereça pouco de cada vez e tire o excesso para não sujar a água.",
  },
  {
    pergunta: "Quando os filhotes de guppy podem ir para o aquário principal?",
    resposta:
      "Quando ficam grandes o bastante para não caber na boca dos adultos, geralmente por volta de 4 a 6 semanas, dependendo do crescimento. Antes disso, o risco de virarem presa é alto.",
  },
  {
    pergunta: "Quando separar os filhotes por sexo?",
    resposta:
      "Assim que der para identificar o sexo, por volta de 4 a 8 semanas. Se você cria linhagem, separar cedo evita cruzamentos que você não planejou e mantém o controle da genética.",
  },
  {
    pergunta: "Quantos filhotes um guppy tem?",
    resposta:
      "Cada ninhada costuma ter de 20 a 60 filhotes, às vezes mais em fêmeas grandes. E como a fêmea armazena esperma, novas ninhadas podem vir a cada poucas semanas.",
  },
];
