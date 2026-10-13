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

// ── /guia/criadeira-mgv16 ─────────────────────────────────────────────────────
// Manual de montagem e uso da Criadeira Marchezi MGV16, tirado do manual
// impresso (6 páginas) que vai com o produto. Slug e rota ficam em
// lib/constants.ts (a página do produto, client, linka de volta).

export const CRIADEIRA_INTRO =
  "Eu desenvolvi a Criadeira Marchezi MGV16 a partir do que vivo todo dia na estufa: separar peixes, reproduzir, acompanhar matrizes, proteger os filhotes e manter a criação organizada. Ela é a mesma criadeira que uso nos meus guppies de linhagem, e aqui está o passo a passo para montar e o que eu faço com ela no dia a dia.";

export const CRIADEIRA_ORIGEM =
  "A Marchezi Guppy Farm cria guppies de linhagem e participa da criação seletiva, com peixes reconhecidos em competições nacionais e internacionais (WGA / UNAQUA 2023 e 2024). O que aprendo dentro da criação vira produto que eu mesmo uso, e é isso que coloco à disposição de outros criadores.";

export const CRIADEIRA_PECAS: readonly { nome: string; qtd: number }[] = [
  { nome: "Lateral esquerda", qtd: 1 },
  { nome: "Lateral direita", qtd: 1 },
  { nome: "Piso", qtd: 1 },
  { nome: "Traseira", qtd: 1 },
  { nome: "Viga de esquadro", qtd: 1 },
];

export const CRIADEIRA_PASSOS: readonly {
  titulo: string;
  texto: string;
  imagem: string;
}[] = [
  {
    titulo: "Posicione as laterais",
    texto:
      "Coloque as duas laterais (esquerda e direita) em pé e paralelas, com as presilhas viradas para a frente. As presilhas e as telas já vêm montadas nas laterais.",
    imagem: "/images/criadeira-mgv16/passo-1.webp",
  },
  {
    titulo: "Encaixe o piso",
    texto:
      "Deslize o piso pelo trilho de baixo das laterais e empurre até o fim do curso.",
    imagem: "/images/criadeira-mgv16/passo-2.webp",
  },
  {
    titulo: "Encaixe a traseira",
    texto:
      "Deslize a traseira pelos trilhos das laterais até encaixar por completo.",
    imagem: "/images/criadeira-mgv16/passo-3.webp",
  },
  {
    titulo: "Instale a viga de esquadro",
    texto:
      "Encaixe a viga de esquadro na parte de cima das laterais. Ela trava o conjunto no esquadro e fecha a montagem.",
    imagem: "/images/criadeira-mgv16/passo-4.webp",
  },
];

export const CRIADEIRA_USOS: readonly { titulo: string; texto: string }[] = [
  {
    titulo: "Reprodução",
    texto:
      "Isolo a fêmea prenha na criadeira. Na hora do parto os filhotes passam pela tela para a área protegida e não viram comida dos adultos.",
  },
  {
    titulo: "Acompanhamento",
    texto:
      "Com o peixe separado e perto do vidro, fica fácil observar, comparar e decidir quem segue na seleção.",
  },
  {
    titulo: "Organização das linhagens",
    texto:
      "Várias criadeiras no mesmo aquário mantêm linhagens e cruzamentos separados, usando o mesmo filtro e a mesma luz.",
  },
  {
    titulo: "Fotos e vídeos",
    texto:
      "O peixe fica perto do vidro e sem nada na frente, então dá para fotografar e filmar de perto com o celular.",
  },
];

export const CRIADEIRA_FAQ: readonly QaPair[] = [
  {
    pergunta: "Precisa de ferramenta ou cola para montar a criadeira MGV16?",
    resposta:
      "Não. Todas as peças vêm prontas e as telas já saem presas nas estruturas. A montagem é só de encaixe: laterais, piso, traseira e viga de esquadro, nessa ordem.",
  },
  {
    pergunta: "Quantos peixes cabem na criadeira MGV16?",
    resposta:
      "Ela tem 6 litros e comporta de 3 a 6 peixes, conforme o tamanho deles e o manejo.",
  },
  {
    pergunta: "Os filhotes ficam protegidos dos adultos?",
    resposta:
      "Sim. Na hora do parto os alevinos escapam pela tela para a área protegida, longe da mãe e dos outros adultos.",
  },
  {
    pergunta: "Posso colocar mais de uma criadeira no mesmo aquário?",
    resposta:
      "Pode. É assim que eu uso na estufa: várias criadeiras num aquário só, cada uma com uma linhagem ou um cruzamento, aproveitando o filtro e a iluminação que já existem.",
  },
  {
    pergunta: "A criadeira MGV16 serve para outros peixes além do guppy?",
    resposta:
      "Serve para outros poecilídeos, como platy, molinésia e espadinha, que também parem filhotes vivos.",
  },
];
