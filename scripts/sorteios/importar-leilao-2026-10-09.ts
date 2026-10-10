/**
 * Cria o "Sorteio Trio Red Silverado Albino" (leilão de 09/10/2026) e importa
 * a apuração PRELIMINAR (docs/sorteios/leilao-2026-10-09-participantes.csv).
 *
 *   npx tsx --conditions=react-server scripts/sorteios/importar-leilao-2026-10-09.ts
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
import { lerCsv } from "@/lib/sorteios/csv";
import { importarParticipantes, salvarSorteio } from "@/lib/sorteios/servico";

const SLUG = "trio-red-silverado-albino-2026-10";
const ator = { id: null, nome: "Importação inicial (script)" };

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.replace(/^[^@]*@/, "").replace(/\?.*$/, "");
  if (!/teste/.test(url) && process.env.SORTEIO_PRODUCAO_AUTORIZADO !== "sim") {
    console.error(`Recusado: ${host} não é banco de teste. Em produção, só com SORTEIO_PRODUCAO_AUTORIZADO=sim.`);
    process.exit(1);
  }
  console.log(`Banco: ${host}`);

  let s = await prisma.sorteio.findUnique({ where: { slug: SLUG } });
  if (!s) {
    const id = await salvarSorteio(
      null,
      {
        nome: "Sorteio Trio Red Silverado Albino",
        slug: SLUG,
        organizador: "Marchezi Guppy Farm",
        eventoOrigem: "Leilão ao vivo pelo WhatsApp",
        dataEvento: new Date("2026-10-09T12:00:00-03:00"),
        premio: "1 trio Red Silverado Albino",
        descricao:
          "Cada lance válido dado no leilão de 09/10/2026 virou um bilhete, ganhando o lote ou não. Quem deu mais lances válidos tem mais bilhetes.",
        regras: [
          "1. Cada lance válido no leilão de 09/10/2026 vale um bilhete.",
          "2. Lance inicial de R$ 60,00; cada lance precisa superar o maior lance válido anterior em R$ 5,00 ou múltiplos de R$ 5,00.",
          "3. Lances iguais, menores ou depois do encerramento do lote não valem. Em lances iguais, vale o primeiro.",
          "4. O sorteio é entre os bilhetes: quem tem mais lances válidos tem mais chances.",
          "5. A lista de bilhetes é conferida, homologada e congelada antes do sorteio.",
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

  const texto = readFileSync(join(process.cwd(), "docs/sorteios/leilao-2026-10-09-participantes.csv"), "utf8");
  const r = await importarParticipantes(s.id, lerCsv(texto).linhas, ator);
  const soma = await prisma.participanteSorteio.aggregate({ where: { sorteioId: s.id }, _sum: { chances: true }, _count: true });
  console.log(`Participantes: ${soma._count} · chances: ${soma._sum.chances}`);
  console.log(`Novos ${r.novos}, alterados ${r.atualizados}, iguais ${r.iguais}, ligados a contas ${r.vinculados}`);
  if (r.avisos.length) console.log("Avisos:\n - " + r.avisos.join("\n - "));
  if (r.ausentes.length) console.log("No banco e fora do arquivo: " + r.ausentes.join(", "));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
