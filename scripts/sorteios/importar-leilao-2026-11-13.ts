/**
 * Cria o "Sorteio Casal Black Flame Silverado" (Leilão Black Novembro 2,
 * 13/11/2026) e importa a apuração PRELIMINAR
 * (docs/sorteios/leilao-2026-11-13-participantes.csv): 22 participantes e 273
 * chances, apuradas pelos lances do export do grupo
 * (docs/sorteios/leilao-2026-11-13-lances.csv, lance por lance).
 *
 * Regras anunciadas às 19:41 do dia 13: cada lance válido dá 1 chance, mesmo
 * sem arrematar; quem arrematou ganha vagas extras por lote (até R$ 199 = 5,
 * R$ 200 = 10, R$ 400 = 20). 108 lances válidos + 165 vagas = 273.
 *
 *   npx tsx --conditions=react-server scripts/sorteios/importar-leilao-2026-11-13.ts
 *
 * Com SIMULAR=sim só lê o arquivo e mostra quem entra, sem gravar nada.
 *
 * Entra em CONFERÊNCIA e fora da página pública. Não homologa, não sorteia.
 * Pode rodar de novo: o sorteio é achado pelo slug e a importação não duplica.
 *
 * Trava: só roda em banco cujo endereço tem "teste", a não ser que
 * SORTEIO_PRODUCAO_AUTORIZADO=sim esteja no ambiente (decisão do dono).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { campo, lerCsv } from "@/lib/sorteios/csv";
import { identificar, importarParticipantes, salvarSorteio } from "@/lib/sorteios/servico";

const SLUG = "casal-black-flame-silverado-2026-11";
const ARQUIVO = "docs/sorteios/leilao-2026-11-13-participantes.csv";
const PARTICIPANTES = 22;
const CHANCES = 273;
const ator = { id: null, nome: "Importação inicial (script)" };

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.replace(/^[^@]*@/, "").replace(/\?.*$/, "");
  const simular = process.env.SIMULAR === "sim";
  if (!simular && !/teste/.test(url) && process.env.SORTEIO_PRODUCAO_AUTORIZADO !== "sim") {
    console.error(`Recusado: ${host} não é banco de teste. Em produção, só com SORTEIO_PRODUCAO_AUTORIZADO=sim.`);
    process.exit(1);
  }
  console.log(`Banco: ${host}${simular ? " (SIMULAÇÃO, nada é gravado)" : ""}`);

  const { linhas } = lerCsv(readFileSync(join(process.cwd(), ARQUIVO), "utf8"));
  const validas = linhas.filter((l) => !/^total$/i.test(campo(l, "participante").trim()));
  const soma = validas.reduce((a, l) => a + Number(campo(l, "chances")), 0);
  const chaves = new Set(validas.map((l) => identificar(campo(l, "participante"), campo(l, "telefone")).chave));
  if (validas.length !== PARTICIPANTES || soma !== CHANCES || chaves.size !== PARTICIPANTES) {
    throw new Error(
      `Conferência falhou: ${validas.length} linhas, ${chaves.size} pessoas, ${soma} chances (esperado ${PARTICIPANTES} e ${CHANCES}).`,
    );
  }

  if (simular) {
    for (const l of validas) {
      const id = identificar(campo(l, "participante"), campo(l, "telefone"));
      console.log(`  ${id.nome.padEnd(20)} ${id.chave.padEnd(20)} ${campo(l, "chances")}`);
    }
    console.log(`${validas.length} participantes, ${soma} chances.`);
    const s = await prisma.sorteio.findUnique({ where: { slug: SLUG } });
    console.log(s ? `Sorteio já existe: ${s.id} (${s.status})` : "Sorteio seria criado.");
    return;
  }

  let s = await prisma.sorteio.findUnique({ where: { slug: SLUG } });
  if (!s) {
    const id = await salvarSorteio(
      null,
      {
        nome: "Sorteio Casal Black Flame Silverado",
        slug: SLUG,
        organizador: "Marchezi Guppy Farm",
        eventoOrigem: "Leilão Black Novembro 2 ao vivo pelo WhatsApp",
        dataEvento: new Date("2026-11-13T12:00:00-03:00"),
        premio: "1 casal Black Flame Silverado",
        descricao:
          "Cada lance válido dado no Leilão Black Novembro de 13/11/2026 virou um bilhete, ganhando o lote ou não. Quem arrematou ganhou bilhetes extras por lote. Quem tem mais bilhetes tem mais chances.",
        regras: [
          "1. Cada lance válido no leilão de 13/11/2026 vale um bilhete, ganhando o lote ou não.",
          "2. Lance inicial de R$ 60,00; cada lance precisa superar o maior lance válido anterior em R$ 5,00 ou múltiplos de R$ 5,00.",
          "3. Lances iguais, menores ou depois do encerramento do lote não valem. Em lances iguais, vale o primeiro.",
          "4. Xeque-Mate (R$ 200,00) e Mestre Criador (R$ 400,00) aceitos também valem um bilhete cada.",
          "5. Quem arrematou ganha bilhetes extras por lote: 5 no lote arrematado até R$ 199,00, 10 no de R$ 200,00 e 20 no de R$ 400,00.",
          "6. O sorteio é entre os bilhetes: quem tem mais bilhetes tem mais chances.",
          "7. A lista de bilhetes é conferida, homologada e congelada antes do sorteio.",
        ].join("\n"),
        imagemUrl: null,
        transmissaoUrl: null,
        dataSorteio: null,
        publico: false,
        modoSorteio: "ELETRONICO",
        concursoLoteria: null,
      },
      ator,
    );
    s = await prisma.sorteio.findUniqueOrThrow({ where: { id } });
    console.log(`Sorteio criado: ${s.id}`);
  } else {
    console.log(`Sorteio já existia: ${s.id} (${s.status})`);
  }

  const r = await importarParticipantes(s.id, linhas, ator);
  const total = await prisma.participanteSorteio.aggregate({ where: { sorteioId: s.id }, _sum: { chances: true }, _count: true });
  console.log(`Participantes: ${total._count} · chances: ${total._sum.chances}`);
  console.log(`Novos ${r.novos}, alterados ${r.atualizados}, iguais ${r.iguais}, ligados a contas ${r.vinculados}`);
  if (r.avisos.length) console.log("Avisos:\n - " + r.avisos.join("\n - "));
  if (r.ausentes.length) console.log("No banco e fora do arquivo: " + r.ausentes.join(", "));
  console.log(`\nPainel: /admin/sorteios/${s.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
