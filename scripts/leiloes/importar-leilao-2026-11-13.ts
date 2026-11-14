/**
 * Lança o 2º Leilão Black Novembro (13/11/2026): 16 lotes, 18 arrematações.
 * NÃO gera as cobranças: isso é o "Cobrar todos" no painel.
 *
 *   npx tsx --conditions=react-server scripts/leiloes/importar-leilao-2026-11-13.ts
 *
 * Com SIMULAR=sim só mostra o que faria (quem já tem cadastro, quem ganha um
 * novo, lotes e total), sem gravar nada.
 *
 * Trava: só roda em banco de teste, a não ser que LEILAO_PRODUCAO_AUTORIZADO=sim.
 * Não duplica: se o leilão já tiver lotes, para sem mexer em nada.
 *
 * Não houve relatório do dono desta vez: tudo sai do export do grupo
 * ("A régua da verdade é o lance"). Regras anunciadas às 19:38 do dia 13:
 *  - lance convencional: o lote como foi anunciado (trio 1 macho + 2 fêmeas,
 *    Pet Premium 8 machos + 2 fêmeas);
 *  - lances iguais não valem: vale o que chegou primeiro;
 *  - Xeque-Mate (R$ 200): todos os peixes do vídeo (o trio; no lote 15,
 *    os 10 machos);
 *  - Mestre Criador (R$ 400): o dobro dos peixes do vídeo, conforme estoque.
 *    Nos lotes 14 e 16 o Xeque-Mate veio antes, então o trio filmado fica com
 *    ele e o Mestre recebe 2 machos + 4 fêmeas que não são os do vídeo. Os dois
 *    são cobrados, por isso 14 e 16 aparecem duas vezes.
 *  - cartão em até 10x (maxParcelas 10).
 *
 * Fora daqui: a promoção "até 5 outras linhagens pelo valor do menor arremate"
 * é venda combinada no privado, não lote deste leilão. O sorteio do casal
 * Black Flame Silverado também fica de fora.
 *
 * Rodar de novo com os lotes já lançados e ainda sem cobrança REESCREVE nome e
 * peixes.
 */
import { prisma } from "@/lib/prisma";
import { chaveTelefone } from "@/lib/sorteios/telefone";
import { telefoneDoCadastro, variantesTelefone } from "@/lib/leiloes/telefone";
import { acharOuCriarArrematante } from "@/lib/leiloes/arrematante";
import { meioDiaBRT, rotuloLote } from "@/lib/leiloes/situacao";

const NOME = "Leilão Black Novembro 2";
const DIA = "2026-11-13";
const ROTULO_DIA = "13/11/2026";
const QTD = 18;
const TOTAL = 3750;

const TRIO = "trio: 1 macho + 2 fêmeas";
const XM = "Xeque-Mate: trio do vídeo";
const MC_DEPOIS_XM = "Mestre Criador: o dobro, 2 machos + 4 fêmeas da mesma linhagem, fora os do vídeo";

// Arrematante: nome que o dono usou no grupo e o WhatsApp do lance. Quem já tem
// cadastro é achado pelo número (o nome daqui só vale para cadastro novo). Quem
// só aparece pelo número fica com o número como nome até o dono identificar, e
// a mensagem de cobrança sai com "Oi! Tudo bem?" sem nome.
const PESSOAS = {
  vinicius: ["Vinicius Auch", "53 8119-1075"],
  alexandre48: ["Alexandre", "48 9111-3525"],
  pompeo: ["Pompeo", "12 99125-0075"],
  // Entrou no grupo às 20:25 como "Pai Do Ravi"; o dono chamou de "Pai do Davi".
  paiDoRavi: ["+55 14 99736-1214", "14 99736-1214"],
  marcos: ["Marcos Vinícius", "34 9819-4760"],
  alexandre84: ["Alexandre", "84 8826-9909"],
  higor: ["Higor", "65 9959-4390"],
  jean: ["Jean", "62 8103-7988"],
  cristiano: ["Cristiano", "28 99974-9911"],
  thales: ["Thales", "21 98382-7966"],
  tiago: ["Tiago", "85 9951-0140"],
  // Lote 15: o dono não disse o nome. Provável "CB.", que o Criatorio Severo
  // adicionou ao grupo às 20:58, a mesma hora da primeira mensagem deste número.
  final0194: ["+55 19 99781-0194", "19 99781-0194"],
} as const;
type Pessoa = keyof typeof PESSOAS;

// [lote, nome (o que a pessoa leva), valor, arrematante, peixes]
const LOTES: [string, string, number, Pessoa, number][] = [
  ["01", "Pet Premium Misto (8 machos + 2 fêmeas)", 150, "vinicius", 10],
  ["02", `Magenta Round Tail (${TRIO})`, 165, "alexandre48", 3],
  ["03", `Asian Platinum White Mosaico Delta (${TRIO})`, 170, "pompeo", 3],
  ["04", `Koi Tuxedo Red/Black Ear (${XM})`, 200, "pompeo", 3],
  ["05", `Red Old Dragon (${TRIO})`, 165, "paiDoRavi", 3],
  ["06", `Albino Red Koi (${XM})`, 200, "marcos", 3],
  ["07", `Asian King Cobra (${TRIO})`, 170, "alexandre84", 3],
  ["08", `Japan Blue Blue Tail (${XM})`, 200, "higor", 3],
  ["09", `Albino White Platinum (${XM})`, 200, "vinicius", 3],
  ["10", `Black Flame Silverado (${XM})`, 200, "marcos", 3],
  ["11", `Metal Leopard Half Moon (${TRIO})`, 170, "jean", 3],
  ["12", `Platinum Red Mosaic Big Ear (${TRIO})`, 160, "cristiano", 3],
  ["13", `Leopard Half Moon (${XM})`, 200, "thales", 3],
  ["14", `Black Silverado Super Delta (${XM})`, 200, "tiago", 3],
  ["14", `Black Silverado Super Delta (${MC_DEPOIS_XM})`, 400, "pompeo", 6],
  ["15", "Exclusive Aquarium Black Flame Silverado (Xeque-Mate: 10 machos do vídeo)", 200, "final0194", 10],
  ["16", `Blue Grass Super Delta (${XM})`, 200, "marcos", 3],
  ["16", `Blue Grass Super Delta (${MC_DEPOIS_XM})`, 400, "higor", 6],
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
      descricao: `Lançou ${criados.length} lote(s) do leilão de ${ROTULO_DIA} a partir dos lances do grupo (R$ 3.750,00)`,
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
