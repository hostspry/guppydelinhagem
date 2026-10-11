/**
 * Lança o leilão de 09/10/2026 e os 24 lotes arrematados (relação enviada pelo
 * dono em 11/10/2026). NÃO gera as cobranças: isso é o "Cobrar todos" no painel,
 * que começa a contar o prazo de pagamento.
 *
 *   npx tsx --conditions=react-server scripts/leiloes/importar-leilao-2026-10-09.ts
 *
 * Trava: só roda em banco de teste, a não ser que LEILAO_PRODUCAO_AUTORIZADO=sim.
 * Não duplica: se o leilão já tiver lotes, para sem mexer em nada.
 *
 * Os lotes 08, 10 e 16 aparecem duas vezes (Xeque-Mate e Mestre Criador) e o 14
 * tem duas genéticas: a relação conta as 24 arrematações e fecha em R$ 7.300,00,
 * então cada linha vira um lote cobrado.
 */
import { prisma } from "@/lib/prisma";
import { chaveTelefone } from "@/lib/sorteios/telefone";
import { telefoneDoCadastro } from "@/lib/leiloes/telefone";
import { acharOuCriarArrematante } from "@/lib/leiloes/arrematante";
import { meioDiaBRT, rotuloLote } from "@/lib/leiloes/situacao";

const NOME = "Leilão Marchezi Guppy Farm";
const DIA = "2026-10-09";

type Lance = "XEQUE_MATE" | "MESTRE_CRIADOR" | "CONVENCIONAL";
const SUFIXO: Record<Lance, string> = {
  XEQUE_MATE: " (Xeque-Mate)",
  MESTRE_CRIADOR: " (Mestre Criador)",
  CONVENCIONAL: "",
};

// Arrematante: nome da relação e o WhatsApp. Vinicius e Felipe vieram "a
// confirmar"; o número é o que eles mesmos verificaram no site (sorteio).
const PESSOAS = {
  fabio: ["Fábio", "11 94768-5242"],
  pan: ["Pan", "11 96036-4760"],
  marcus: ["Marcus", "81 9404-8719"],
  pompeo: ["Pompeo", "12 99125-0075"],
  matheus: ["Matheus", "11 96919-6047"],
  rafinha: ["Rafinha", "28 99971-8554"],
  snook: ["Snook Iscas", "22 99763-3302"],
  erick: ["Erick", "32 8412-7643"],
  vinicius: ["Vinicius Auch", "53 98119-1075"],
  felipe: ["Felipe Cesar Romera", "19 99753-5425"],
  marius: ["Marius", "+52 1 844 599 1131"],
  ricardo: ["Ricardo", "62 8505-8587"],
  olympio: ["Olympio", "11 98162-1438"],
} as const;
type Pessoa = keyof typeof PESSOAS;

const LOTES: [string, string, Lance, number, Pessoa][] = [
  ["01", "Misto", "XEQUE_MATE", 300, "fabio"],
  ["02", "Red Grass jovens + fêmeas Blue Grass", "CONVENCIONAL", 150, "pan"],
  ["03", "Red Silverado Albino", "XEQUE_MATE", 300, "marcus"],
  ["04", "Metal Yellow Pingu", "CONVENCIONAL", 155, "pompeo"],
  ["05", "Espada Red Cap", "CONVENCIONAL", 165, "matheus"],
  ["06", "Misto", "CONVENCIONAL", 190, "rafinha"],
  ["07", "Full Red Albino Big Dorsal", "XEQUE_MATE", 300, "fabio"],
  ["08", "Leopardo Red Fire", "XEQUE_MATE", 300, "pompeo"],
  ["08", "Leopardo Red Fire", "MESTRE_CRIADOR", 600, "snook"],
  ["09", "Half Black Yellow", "XEQUE_MATE", 300, "pompeo"],
  ["10", "Metal Blue SSK", "XEQUE_MATE", 300, "erick"],
  ["10", "Metal Blue SSK", "MESTRE_CRIADOR", 600, "vinicius"],
  ["11", "Red Old Dragon", "XEQUE_MATE", 300, "felipe"],
  ["12", "Misto", "CONVENCIONAL", 220, "marius"],
  ["13", "Blue Grass Big Dorsal", "XEQUE_MATE", 300, "marcus"],
  ["14", "Sky Blue", "XEQUE_MATE", 300, "fabio"],
  ["14", "Moscow Dark Blue", "XEQUE_MATE", 300, "marcus"],
  ["15", "Koi Tuxedo", "CONVENCIONAL", 225, "vinicius"],
  ["16", "Moscow Full Black", "MESTRE_CRIADOR", 600, "marius"],
  ["16", "Moscow Full Black", "XEQUE_MATE", 300, "ricardo"],
  ["17", "Metal Yellow Dragon Halfmoon", "CONVENCIONAL", 195, "vinicius"],
  ["18", "Red Dragon Halfmoon", "XEQUE_MATE", 300, "ricardo"],
  ["19", "Blue Dragon Halfmoon", "XEQUE_MATE", 300, "olympio"],
  ["20", "Full Gold + White Platinum Albino", "XEQUE_MATE", 300, "vinicius"],
];

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.replace(/^[^@]*@/, "").replace(/\?.*$/, "");
  if (!/teste/.test(url) && process.env.LEILAO_PRODUCAO_AUTORIZADO !== "sim") {
    console.error(`Recusado: ${host} não é banco de teste. Em produção, só com LEILAO_PRODUCAO_AUTORIZADO=sim.`);
    process.exit(1);
  }
  console.log(`Banco: ${host}`);

  const soma = LOTES.reduce((a, l) => a + l[3], 0);
  if (LOTES.length !== 24 || soma !== 7300) {
    throw new Error(`Conferência falhou: ${LOTES.length} lotes, R$ ${soma} (esperado 24 e R$ 7.300).`);
  }

  const dataLeilao = meioDiaBRT(DIA);
  let leilao = await prisma.leilao.findFirst({ where: { nome: NOME, dataLeilao } });
  if (leilao) {
    const n = await prisma.loteLeilao.count({ where: { leilaoId: leilao.id } });
    if (n > 0) {
      console.log(`Leilão já tem ${n} lote(s). Nada a fazer.`);
      return;
    }
  } else {
    leilao = await prisma.leilao.create({
      data: { nome: NOME, dataLeilao, prazoPagamentoDias: 3, maxParcelas: 12 },
    });
    console.log(`Leilão criado: ${leilao.id}`);
  }

  // Arrematantes: cadastro existente pelo WhatsApp (ou pela conta que verificou
  // o número); quem não tem cadastro ganha um, com nome e número.
  const clientes = new Map<Pessoa, string>();
  for (const [chave, [nome, tel]] of Object.entries(PESSOAS) as [Pessoa, readonly [string, string]][]) {
    const telefone = chaveTelefone(tel);
    if (!telefone) throw new Error(`WhatsApp inválido para ${nome}: ${tel}`);
    const id = await acharOuCriarArrematante(nome, telefone);
    clientes.set(chave, id);
    const c = await prisma.cliente.findUniqueOrThrow({ where: { id }, select: { nome: true, telefone: true, criadoEm: true } });
    const novo = Date.now() - c.criadoEm.getTime() < 60_000;
    console.log(`${nome.padEnd(20)} → ${c.nome}${novo ? " (cadastro novo)" : ""}`);

    // Pompeo: a conta dele verificou o 12 99125-0075, mas o cadastro guardava o
    // número cortado ("55129912500"). Vale o verificado.
    const certo = telefoneDoCadastro(telefone);
    if (c.telefone !== certo && chaveTelefone(c.telefone ?? "") !== telefone) {
      await prisma.cliente.update({ where: { id }, data: { telefone: certo } });
      console.log(`   telefone do cadastro corrigido: ${c.telefone ?? "(vazio)"} → ${certo}`);
    }
  }

  const criados = await prisma.$transaction(
    LOTES.map(([numero, genetica, lance, valor, pessoa], i) =>
      prisma.loteLeilao.create({
        data: {
          leilaoId: leilao!.id,
          numero,
          nome: genetica + SUFIXO[lance],
          qtdPeixes: 3,
          valor,
          clienteId: clientes.get(pessoa)!,
          ordem: i + 1,
        },
        select: { numero: true, nome: true },
      }),
    ),
  );

  await prisma.auditoriaAdmin.create({
    data: {
      userNome: "Importação (script)",
      userEmail: "",
      userPapel: "Sistema",
      acao: "leilao.lote.importar",
      entidade: "Leilao",
      entidadeId: leilao.id,
      descricao: `Lançou ${criados.length} lote(s) do leilão de 09/10/2026 a partir da relação de arrematadores (R$ 7.300,00)`,
      depois: { lotes: criados.length, arrematantes: clientes.size, total: soma },
    },
  });

  console.log(`\n${criados.length} lotes lançados, ${clientes.size} arrematantes, R$ ${soma.toFixed(2)}.`);
  console.log(criados.map((l) => `  ${rotuloLote(l)}`).join("\n"));
  console.log(`\nPainel: /admin/leiloes/${leilao.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
