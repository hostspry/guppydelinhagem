/**
 * Lança o Leilão Black Novembro (06/11/2026) e as 22 arrematações do relatório
 * de apuração do dono. NÃO gera as cobranças: isso é o "Cobrar todos" no painel.
 *
 *   npx tsx --conditions=react-server scripts/leiloes/importar-leilao-2026-11-06.ts
 *
 * Com SIMULAR=sim só mostra o que faria (quem já tem cadastro, quem ganha um
 * novo, lotes e total), sem gravar nada.
 *
 * Trava: só roda em banco de teste, a não ser que LEILAO_PRODUCAO_AUTORIZADO=sim.
 * Não duplica: se o leilão já tiver lotes, para sem mexer em nada.
 *
 * O que cada um leva vem dos anúncios dos lotes no grupo (06/11). Regras desta
 * noite, diferentes das de 09/10:
 *  - lance convencional: o lote como foi anunciado (trio, Pet Premium, cardume);
 *  - Xeque-Mate (R$ 200): 2 casais do vídeo, SEM criadeira de brinde (o dono
 *    respondeu "Não" no grupo quando perguntaram); nos lotes Pet, os peixes do
 *    vídeo (8 machos + 2 fêmeas ou 10 machos);
 *  - Mestre Criador (R$ 400): 4 casais da mesma linhagem. Nos lotes 17 e 20 o
 *    Xeque-Mate veio antes, então o casal do vídeo fica com o Xeque-Mate e o
 *    Mestre recebe 4 casais que não são os filmados. Os dois são cobrados.
 * Por isso 17 e 20 aparecem duas vezes. Fecha em 22 arrematações e R$ 4.470,00.
 *
 * Fora daqui (pendências do relatório, decisão do dono): o R$ 300 do Vinicius
 * no lote 07 (que não tinha Mestre Criador) não conta como compra, e a promoção
 * "até 5 linhagens pelo menor arremate" é venda futura, não lote deste leilão.
 *
 * Rodar de novo com os lotes já lançados e ainda sem cobrança REESCREVE nome e
 * peixes.
 */
import { prisma } from "@/lib/prisma";
import { chaveTelefone } from "@/lib/sorteios/telefone";
import { telefoneDoCadastro, variantesTelefone } from "@/lib/leiloes/telefone";
import { acharOuCriarArrematante } from "@/lib/leiloes/arrematante";
import { meioDiaBRT, rotuloLote } from "@/lib/leiloes/situacao";

const NOME = "Leilão Black Novembro";
const DIA = "2026-11-06";
const ROTULO_DIA = "06/11/2026";
const QTD = 22;
const TOTAL = 4470;

const XM = "Xeque-Mate: 2 casais do vídeo";
const MC_DEPOIS_XM = "Mestre Criador: 4 casais da mesma linhagem, fora os do vídeo";
const TRIO = "trio: 1 macho + 2 fêmeas";

// Arrematante: nome e WhatsApp do relatório. Quem já tem cadastro é achado pelo
// número (o nome daqui só vale para cadastro novo). O do lote 11 só aparece
// pelo número no grupo: fica com o número como nome até o dono identificar, e a
// mensagem de cobrança sai com "Oi! Tudo bem?" sem nome.
const PESSOAS = {
  wanderson: ["Wanderson", "99 8111-4155"],
  jefferson: ["Jefferson", "62 8564-5429"],
  rodrigo: ["Rodrigo", "11 98223-6496"],
  danny: ["Danny Vils", "21 97030-1292"],
  elisandro: ["Elisandro", "11 94598-4448"],
  frederico: ["Frederico", "21 99411-5093"],
  pompeo: ["Pompeo", "12 99125-0075"],
  kaua: ["Kauã Simões", "28 99926-2054"],
  final4755: ["+55 85 99922-4755", "85 9922-4755"],
  lucas: ["Lucas", "16 99408-4049"],
  tiago: ["Tiago", "85 9951-0140"],
  ricardo: ["Ricardo", "62 8505-8587"],
  // Nome completo do próprio Igor, digitado num checkout da loja com este número.
  igor: ["Igor Granero Tarantelli", "94 8406-0316"],
  fernando: ["Fernando", "63 9913-6171"],
  erick: ["Erick", "32 8412-7643"],
  vinicius: ["Vinicius Auch", "53 8119-1075"],
  armando: ["Armando", "12 99635-6831"],
} as const;
type Pessoa = keyof typeof PESSOAS;

// [lote, nome (o que a pessoa leva), valor, arrematante, peixes]
const LOTES: [string, string, number, Pessoa, number][] = [
  ["01", "Pet Premium Misto (8 machos + 2 fêmeas)", 175, "wanderson", 10],
  ["02", `Albino Red Silverado (${TRIO})`, 155, "jefferson", 3],
  ["03", `Moscow Blue (${TRIO})`, 175, "rodrigo", 3],
  ["04", `Metal Yellow Dragon Half Moon (${XM})`, 200, "danny", 4],
  ["05", `Lazuli Blue Delta (${XM})`, 200, "elisandro", 4],
  ["06", `Half Black Red Tail (${XM})`, 200, "elisandro", 4],
  ["07", `Full Red Big Dorsal (${XM})`, 200, "frederico", 4],
  ["08", "Pet Premium machos Red Albino Silverado (Xeque-Mate: 10 machos do vídeo)", 200, "pompeo", 10],
  ["09", `Old Red Dragon Delta (${XM})`, 200, "pompeo", 4],
  ["10", `Half Black Yellow Tail Super Delta (${XM})`, 200, "kaua", 4],
  ["11", `Fire Leopardo (${XM})`, 200, "final4755", 4],
  ["12", `Red Glass Belly (${TRIO})`, 135, "lucas", 3],
  ["13", "Pet Premium Misto (8 machos + 2 fêmeas)", 140, "pompeo", 10],
  ["14", "Pet Espadas Premium Red Cap Koi (cardume de 10 peixes)", 130, "jefferson", 10],
  ["15", `Moscow Dark Blue (${TRIO})`, 160, "tiago", 3],
  ["16", `Red Dragon Half Moon (${XM})`, 200, "ricardo", 4],
  ["17", `Blue Dragon Half Moon (${XM})`, 200, "igor", 4],
  ["17", `Blue Dragon Half Moon (${MC_DEPOIS_XM})`, 400, "fernando", 8],
  ["18", "Mix Dragons machos Red Dragon (Xeque-Mate: 10 machos do vídeo)", 200, "erick", 10],
  ["19", `Moscow Full Black Delta (${XM})`, 200, "vinicius", 4],
  ["20", `Red Spanish Big Ear (${XM})`, 200, "armando", 4],
  ["20", `Red Spanish Big Ear (${MC_DEPOIS_XM})`, 400, "pompeo", 8],
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
          descricao: `Reaplicou nome e peixes dos ${LOTES.length} lotes de ${ROTULO_DIA}, conforme os anúncios do grupo`,
        },
      });
      console.log("Lotes atualizados.");
      return;
    }
  } else {
    leilao = await prisma.leilao.create({
      data: { nome: NOME, dataLeilao, maxParcelas: 12 },
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
      descricao: `Lançou ${criados.length} lote(s) do leilão de ${ROTULO_DIA} a partir do relatório de apuração (R$ 4.470,00)`,
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
