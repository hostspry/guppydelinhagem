// Conteúdo da página /peixe-guppy (guia pilar informacional). Fonte ÚNICA
// do texto para facilitar edição sem mexer no layout. Voz do criador (Manassés
// Marchezi): frases de tamanho variado, fato no lugar de adjetivo, vocabulário
// do aquarismo brasileiro. Nada de número/depoimento/prêmio inventado — os fatos
// da marca vivem em lib/sobre-content.

// ── Seção 6: ficha técnica ────────────────────────────────────────────────────
export const FICHA = [
  { label: "Nome popular", valor: "Guppy, Lebiste" },
  { label: "Nome científico", valor: "Poecilia reticulata" },
  { label: "Origem", valor: "América do Sul e Caribe" },
  { label: "Tamanho adulto", valor: "3–6 cm" },
  { label: "Temperatura ideal", valor: "22–28 °C" },
  { label: "pH ideal", valor: "6,8–7,8" },
  { label: "Dureza (GH)", valor: "8–12" },
  { label: "Comportamento", valor: "Pacífico, gregário" },
  { label: "Reprodução", valor: "Vivíparo" },
  { label: "Gestação", valor: "21–30 dias" },
  { label: "Expectativa de vida", valor: "2–3 anos" },
  { label: "Alimentação", valor: "Onívora" },
  { label: "Nível de cuidado", valor: "Fácil" },
] as const;

// ── Seção 4: tabela comparativa (guppy comum × de linhagem) ───────────────────
export const COMPARATIVO = [
  { c: "Genética", comum: "Misturada, sem controle", linhagem: "Selecionada por gerações" },
  { c: "Padrão dos filhotes", comum: "Imprevisível", linhagem: "Consistente com a linhagem" },
  { c: "Cores", comum: "Variadas, instáveis", linhagem: "Intensas e padronizadas" },
  { c: "Cauda", comum: "Sem padrão fixo", linhagem: "Selecionada por formato e abertura" },
  { c: "Indicado para", comum: "Primeiro aquário", linhagem: "Quem quer padrão, cor e reprodução controlada" },
  { c: "Preço", comum: "Mais baixo", linhagem: "Maior — paga-se a seleção genética" },
] as const;

// ── Seção 7: cuidados ─────────────────────────────────────────────────────────
export const CUIDADOS = [
  "Cicle o aquário antes de pôr os peixes: espere a colônia de bactérias se formar.",
  "Mantenha a temperatura estável entre 24 e 26 °C, com termostato.",
  "Use filtragem com fluxo suave — guppy não gosta de correnteza forte.",
  "Faça troca parcial de cerca de 20% da água por semana.",
  "Dê porções pequenas de comida, o que os peixes consomem em uns 2 minutos.",
  "Evite superpopulação: pense em torno de 1 cm de peixe por litro.",
  "Separe machos e fêmeas quando quiser controlar a reprodução.",
  "Fique de olho nos sinais de alerta: nadadeiras fechadas, falta de apetite, peixe isolado.",
] as const;

// ── Seção 8: alimentação ──────────────────────────────────────────────────────
export const ALIMENTACAO = [
  "Dieta variada deixa a cor mais forte e o peixe mais resistente.",
  "Ração de qualidade como base do dia a dia.",
  "Artêmia e dáfnia quando tiver, como reforço vivo.",
  "Reforço extra para matrizes e alevinos, que gastam mais energia.",
  "O erro mais comum é alimentar demais: pequenas porções 2 a 3 vezes ao dia.",
] as const;

// ── Seção 11: compatibilidade ─────────────────────────────────────────────────
export const COMPAT_BOAS = [
  "Mollys e platis",
  "Corydoras",
  "Tetras pacíficos",
  "Camarões Neocaridina",
] as const;
export const COMPAT_EVITAR = [
  "Bettas machos",
  "Ciclídeos agressivos",
  "Peixes grandes predadores",
  "Espécies que mordem nadadeiras",
] as const;

// ── Seção 12: equipamento ─────────────────────────────────────────────────────
export const EQUIPAMENTO = [
  "Aquário de pelo menos 40 litros",
  "Filtro com fluxo ajustável",
  "Aquecedor com termostato (50–100 W conforme o volume)",
  "Termômetro",
  "Iluminação LED (8–10 h por dia)",
  "Plantas naturais ou artificiais para abrigo",
] as const;

// ── Seções 2, 5, 10: respostas rápidas (boxes GEO) ────────────────────────────
export type RespostaRapidaData = { titulo: string; texto: string };

export const RESP_O_QUE_E: RespostaRapidaData = {
  titulo: "Resposta rápida: o que é um guppy de linhagem?",
  texto:
    "Guppy de linhagem é um guppy selecionado geneticamente por várias gerações para manter características específicas: cor, formato de cauda, padrão corporal, tamanho e qualidade reprodutiva. Diferente do guppy comum, os filhotes saem com padrão previsível e as cores se mantêm entre as gerações.",
};
export const RESP_INICIANTE: RespostaRapidaData = {
  titulo: "Resposta rápida: guppy é bom para iniciantes?",
  texto:
    "Sim. O guppy é resistente, ativo e se reproduz com facilidade, por isso é a porta de entrada clássica do aquarismo. Ainda assim precisa de aquário ciclado, água estável e alimentação correta — os cuidados abaixo cobrem isso.",
};
export const RESP_FILHOTES: RespostaRapidaData = {
  titulo: "Resposta rápida: quantos filhotes um guppy tem?",
  texto:
    "Em geral de 20 a 50 filhotes por ninhada, dependendo do tamanho e da idade da fêmea, com gestação de 21 a 30 dias. Fêmeas maduras e bem alimentadas tendem a ter ninhadas maiores.",
};

// ── Seção 16: FAQ (acordeão) — o FAQPage JSON-LD reflete estas perguntas 1:1 ───
export const FAQ = [
  {
    pergunta: "Guppy e lebiste são o mesmo peixe?",
    resposta:
      "São. Guppy e lebiste são dois nomes populares do mesmo peixe, o Poecilia reticulata. Lebiste é mais usado em algumas regiões do Brasil; guppy é o nome internacional.",
  },
  {
    pergunta: "Qual a diferença entre guppy de linhagem e guppy comum?",
    resposta:
      "O guppy comum tem genética misturada, então os filhotes saem imprevisíveis. O de linhagem passou por seleção de várias gerações, então mantém cor, cauda e padrão de forma consistente entre as ninhadas.",
  },
  {
    pergunta: "Qual o tamanho mínimo de aquário para guppys?",
    resposta:
      "Para um grupo inicial de 6 a 8 guppys, comece com pelo menos 40 litros. Volume maior facilita manter a água estável e dá mais espaço para os peixes.",
  },
  {
    pergunta: "Guppy precisa de aquecedor?",
    resposta:
      "Na maior parte do Brasil, sim, para manter a temperatura estável entre 24 e 26 °C. Oscilação brusca de temperatura estressa o peixe e abre porta para doença.",
  },
  {
    pergunta: "Quantos filhotes um guppy tem por ninhada?",
    resposta:
      "Normalmente de 20 a 50 filhotes, dependendo do tamanho e da idade da fêmea. Fêmeas maduras e bem alimentadas costumam ter ninhadas maiores.",
  },
  {
    pergunta: "Como saber se a fêmea está grávida?",
    resposta:
      "A barriga fica mais volumosa e aparece a mancha gravídica, uma área escura perto da nadadeira anal, que escurece conforme a gestação avança.",
  },
  {
    pergunta: "Posso misturar linhagens diferentes?",
    resposta:
      "Pode, mas se o objetivo é preservar o padrão, o ideal é manter cada linhagem separada. Cruzar linhagens diferentes embaralha a genética e os filhotes saem fora do padrão.",
  },
  {
    pergunta: "Guppys podem viver com outros peixes?",
    resposta:
      "Sim. Convivem bem com mollys, platis, corydoras, tetras pacíficos e camarões Neocaridina. Evite bettas machos, ciclídeos agressivos e peixes grandes o suficiente para predar ou estressar o guppy.",
  },
  {
    pergunta: "Quais os sinais de que o guppy está doente?",
    resposta:
      "Nadadeiras fechadas, perda de apetite, peixe isolado num canto, cor apagada ou pontos brancos no corpo. Ao notar, confira os parâmetros da água e isole o peixe se precisar.",
  },
  {
    pergunta: "Onde comprar guppy de linhagem?",
    resposta:
      "Compre de criador especializado que trabalha seleção genética e sabe embalar para transporte. É o que fazemos na nossa criação em Guarapari/ES: enviamos guppys vivos, com genética documentada, para todo o Brasil.",
  },
] as const;
