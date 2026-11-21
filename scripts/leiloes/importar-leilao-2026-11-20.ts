/**
 * Lança o 3º Leilão Black Novembro (20/11/2026, último do ano): 27 lotes.
 * NÃO gera as cobranças: isso é o "Cobrar todos" no painel.
 *
 *   npx tsx --conditions=react-server scripts/leiloes/importar-leilao-2026-11-20.ts
 *
 * Com SIMULAR=sim só mostra o que faria (quem já tem cadastro, quem ganha um
 * novo, lotes e total), sem gravar nada.
 *
 * Trava: só roda em banco de teste, a não ser que LEILAO_PRODUCAO_AUTORIZADO=sim.
 * Não duplica: se o leilão já tiver lotes cobrados ou outra carga, para sem
 * mexer em nada.
 *
 * Fonte: export do grupo ("A régua da verdade é o lance"). Regras da noite:
 *  - lance convencional: o lote como foi anunciado (trio 1 macho + 2 fêmeas,
 *    Pet Premium 8 machos + 2 fêmeas);
 *  - lances iguais não valem: vale o que chegou primeiro;
 *  - Xeque-Mate (R$ 200): 2 casais, os 4 peixes do lote. Nos kits, o kit;
 *  - Mestre Criador (R$ 400): o dobro, 8 peixes da linhagem;
 *  - cartão em até 10x (maxParcelas 10).
 *
 * Decisões do dono (20/11):
 *  - lote 01: "Parabens Thaylisson" foi engano, o lance de R$ 200 é do Thales;
 *  - lote 14 (sem Xeque-Mate): R$ 400 leva o trio + 1 fêmea extra;
 *  - lote 19: vale. O Marius está no Brasil, apesar do número +52;
 *  - lotes 20 e 24: a legenda não tinha Xeque-Mate, mas no grupo ficou dito
 *    que R$ 200 levava 2 casais;
 *  - lotes 26 e 27: o dono confirmou Xeque-Mate no grupo, e o 210 da Thay veio
 *    depois do lance de R$ 200, por isso não vale.
 *
 * Fora daqui: a promoção "até 5 linhagens pelo menor arremate" e as criadeiras
 * a R$ 50 são vendas combinadas no privado. O sorteio Old Dragon também.
 *
 * Rodar de novo com os lotes já lançados e ainda sem cobrança REESCREVE nome e
 * peixes.
 */
import { prisma } from "@/lib/prisma";
import { chaveTelefone } from "@/lib/sorteios/telefone";
import { telefoneDoCadastro, variantesTelefone } from "@/lib/leiloes/telefone";
import { acharOuCriarArrematante } from "@/lib/leiloes/arrematante";
import { meioDiaBRT, rotuloLote } from "@/lib/leiloes/situacao";

const NOME = "Leilão Black Novembro 3";
const DIA = "2026-11-20";
const ROTULO_DIA = "20/11/2026";
const QTD = 27;
const TOTAL = 5650;

const TRIO = "trio: 1 macho + 2 fêmeas";
const XM = "Xeque-Mate: 2 casais, os 4 peixes do lote";
const DOIS_CASAIS = "R$ 200: 2 casais, os 4 peixes do lote";
const MC = "Mestre Criador: 8 peixes da linhagem";
const KIT = "Kit Pet Premium Misto (8 machos + 2 fêmeas)";

// Arrematante: nome que o dono usou no grupo e o WhatsApp do lance. Quem já tem
// cadastro é achado pelo número (o nome daqui só vale para cadastro novo).
const PESSOAS = {
  thales: ["Thales", "21 98382-7966"],
  cassiano: ["Cassiano", "19 99781-0194"],
  hugo: ["Hugo", "27 99922-6494"],
  erika: ["Erika", "61 8212-8090"],
  alexandre: ["Alexandre", "48 9111-3525"],
  kaua: ["Kauã Simões", "28 99926-2054"],
  diego: ["Diego", "86 9928-8685"],
  vinicius: ["Vinicius Auch", "53 8119-1075"],
  klinger: ["Klinger", "11 99955-0244"],
  paiDoRavi: ["+55 14 99736-1214", "14 99736-1214"],
  armando: ["Armando", "12 99635-6831"],
  danny: ["Danny Vils", "21 97030-1292"],
  tiago: ["Tiago", "85 9951-0140"],
  marius: ["Marius", "+52 844 599 1131"],
  matheus: ["Matheus", "21 99458-1396"],
  wilson: ["Wilson", "11 97171-6647"],
} as const;
type Pessoa = keyof typeof PESSOAS;

// [lote, nome (o que a pessoa leva), valor, arrematante, peixes]
const LOTES: [string, string, number, Pessoa, number][] = [
  ["01", `Full Red Glass Belly (${XM})`, 200, "thales", 4],
  ["02", KIT, 200, "cassiano", 10],
  ["03", `Albino Red Silverado (${TRIO})`, 150, "hugo", 3],
  ["04", `Asian King Cobra (${XM})`, 200, "erika", 4],
  ["05", `Lazuli Blue Delta (${TRIO})`, 165, "alexandre", 3],
  ["06", `Half Black Red Half Moon (${XM})`, 200, "kaua", 4],
  ["07", `Moscow Dark Blue (${XM})`, 200, "diego", 4],
  ["08", `Moscow Blue (${TRIO})`, 165, "vinicius", 3],
  ["09", `Half Black Yellow (${XM})`, 200, "cassiano", 4],
  ["10", KIT, 200, "klinger", 10],
  ["11", `Koi Tuxedo Red Tail (${XM})`, 200, "paiDoRavi", 4],
  ["12", `Platinum White Mosaic (${TRIO})`, 160, "vinicius", 3],
  ["13", `Old Red Dragon Delta (${TRIO})`, 160, "cassiano", 3],
  ["14", "Sky Blue (trio: 1 macho + 2 fêmeas + 1 fêmea extra)", 400, "armando", 4],
  ["15", `Yellow Tiger (${MC})`, 400, "danny", 8],
  ["16", `Black Flame Silverado (${MC})`, 400, "paiDoRavi", 8],
  ["17", KIT, 200, "erika", 10],
  ["18", `Metal Tiger/Leopard Half Moon (${TRIO})`, 160, "tiago", 3],
  ["19", `Red Spanish Big Ear (${XM})`, 200, "marius", 4],
  ["20", `Metal Yellow Dragon Half Moon (${DOIS_CASAIS})`, 200, "thales", 4],
  ["21", `Red Dragon Half Moon (${TRIO})`, 160, "matheus", 3],
  ["22", `Blue Grass Big Dorsal (${TRIO})`, 170, "vinicius", 3],
  ["23", `Black Silverado (${TRIO})`, 160, "vinicius", 3],
  ["24", `Albino Platinum White (${DOIS_CASAIS})`, 200, "thales", 4],
  ["25", `Moscow Full Black (${XM})`, 200, "wilson", 4],
  ["26", `Albino Red Koi (${XM})`, 200, "vinicius", 4],
  ["27", `Platinum Red Mosaico Big Ear (${XM})`, 200, "tiago", 4],
];

/** Mesma busca do acharOuCriarArrematante, sem criar nada (para SIMULAR). */
async function cadastroExistente(telefone: string) {
  const c = await prisma.cliente.findFirst({
    where: { telefone: { in: variantesTelefone(telefone) } },
    orderBy: { criadoEm: "asc" },
    select: { id: true, nome: true },
  });
  if (c) return c;
  const v = await prisma.telefoneVerificado.findUnique({
    where: { telefone },
    select: { user: { select: { cliente: { select: { id: true, nome: true } } } } },
  });
  return v?.user.cliente ?? null;
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.replace(/^[^@]*@/, "").replace(/\?.*$/, "");
  const simular = process.env.SIMULAR === "sim";
  if (!simular && !/teste/.test(url) && process.env.LEILAO_PRODUCAO_AUTORIZADO !== "sim") {
    console.error(`Recusado: ${host} não é banco de teste. Em produção, só com LEILAO_PRODUCAO_AUTORIZADO=sim.`);
    process.exit(1);
  }
  console.log(`Banco: ${host}${simular ? " (SIMULAÇÃO, nada é gravado)" : ""}`);

  const soma = LOTES.reduce((a, l) => a + l[2], 0);
  if (LOTES.length !== QTD || soma !== TOTAL) {
    throw new Error(`Conferência falhou: ${LOTES.length} lotes, R$ ${soma} (esperado ${QTD} e R$ ${TOTAL}).`);
  }
  for (const [chave, [nome, tel]] of Object.entries(PESSOAS)) {
    if (!chaveTelefone(tel)) throw new Error(`WhatsApp inválido para ${nome}: ${tel}`);
    if (!LOTES.some((l) => l[3] === chave)) throw new Error(`${nome} não arrematou nenhum lote da lista.`);
  }

  const dataLeilao = meioDiaBRT(DIA);
  let leilao = await prisma.leilao.findFirst({ where: { nome: NOME, dataLeilao } });

  if (simular) {
    console.log(leilao ? `Leilão já existe: ${leilao.id}` : "Leilão seria criado.");
    for (const [nome, tel] of Object.values(PESSOAS)) {
      const telefone = chaveTelefone(tel)!;
      const c = await cadastroExistente(telefone);
      console.log(`${nome.padEnd(24)} ${telefone}  → ${c ? c.nome : "(cadastro novo)"}`);
    }
    const porPessoa = new Map<Pessoa, { total: number; peixes: number }>();
    for (const [, , valor, p, peixes] of LOTES) {
      const t = porPessoa.get(p) ?? { total: 0, peixes: 0 };
      porPessoa.set(p, { total: t.total + valor, peixes: t.peixes + peixes });
    }
    console.log("\nPor arrematante:");
    for (const [p, t] of porPessoa) {
      console.log(`  ${PESSOAS[p][0].padEnd(24)} R$ ${t.total.toFixed(2).padStart(7)} · ${t.peixes} peixes`);
    }
    console.log(`\n${LOTES.length} lotes, ${porPessoa.size} arrematantes, R$ ${soma.toFixed(2)}.`);
    LOTES.forEach(([numero, nome, valor, , peixes]) =>
      console.log(`  ${rotuloLote({ numero, nome })} · R$ ${valor} · ${peixes} peixes`),
    );
    return;
  }

  if (leilao) {
    const existentes = await prisma.loteLeilao.findMany({
      where: { leilaoId: leilao.id },
      orderBy: { ordem: "asc" },
      select: { id: true, ordem: true, orderId: true },
    });
    if (existentes.length > 0) {
      const cobrados = existentes.filter((l) => l.orderId).length;
      const mesmaCarga =
        existentes.length === LOTES.length && existentes.every((l, i) => l.ordem === i + 1);
      if (cobrados > 0 || !mesmaCarga) {
        console.log(
          `Leilão já tem ${existentes.length} lote(s) (${cobrados} cobrado(s)). Nada a fazer: corrija no painel.`,
        );
        return;
      }
      await prisma.$transaction(
        LOTES.map(([, nome, , , peixes], i) =>
          prisma.loteLeilao.update({
            where: { id: existentes[i].id },
            data: { nome, qtdPeixes: peixes },
          }),
        ),
      );
      await prisma.auditoriaAdmin.create({
        data: {
          userNome: "Importação (script)",
          userEmail: "",
          userPapel: "Sistema",
          acao: "leilao.lote.editar",
          entidade: "Leilao",
          entidadeId: leilao.id,
          descricao: `Reaplicou nome e peixes dos ${LOTES.length} lotes de ${ROTULO_DIA}, conforme os anúncios e os lances do grupo`,
        },
      });
      console.log("Lotes atualizados.");
      return;
    }
  } else {
    leilao = await prisma.leilao.create({
      data: { nome: NOME, dataLeilao, maxParcelas: 10 },
    });
    console.log(`Leilão criado: ${leilao.id}`);
  }

  // Arrematantes: cadastro existente pelo WhatsApp (ou pela conta que verificou
  // o número); quem não tem cadastro ganha um, com nome e número.
  const clientes = new Map<Pessoa, string>();
  for (const [chave, [nome, tel]] of Object.entries(PESSOAS) as [Pessoa, readonly [string, string]][]) {
    const telefone = chaveTelefone(tel)!;
    const id = await acharOuCriarArrematante(nome, telefone);
    clientes.set(chave, id);
    const c = await prisma.cliente.findUniqueOrThrow({ where: { id }, select: { nome: true, telefone: true, criadoEm: true } });
    const novo = Date.now() - c.criadoEm.getTime() < 60_000;
    console.log(`${nome.padEnd(24)} → ${c.nome}${novo ? " (cadastro novo)" : ""}`);

    // Cadastro achado só pela conta que verificou o número, com o telefone
    // gravado diferente: vale o verificado.
    const certo = telefoneDoCadastro(telefone);
    if (c.telefone !== certo && chaveTelefone(c.telefone ?? "") !== telefone) {
      await prisma.cliente.update({ where: { id }, data: { telefone: certo } });
      console.log(`   telefone do cadastro corrigido: ${c.telefone ?? "(vazio)"} → ${certo}`);
    }
  }

  const criados = await prisma.$transaction(
    LOTES.map(([numero, nome, valor, pessoa, peixes], i) =>
      prisma.loteLeilao.create({
        data: {
          leilaoId: leilao!.id,
          numero,
          nome,
          qtdPeixes: peixes,
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
      descricao: `Lançou ${criados.length} lote(s) do leilão de ${ROTULO_DIA} a partir dos lances do grupo (R$ 5.650,00)`,
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
