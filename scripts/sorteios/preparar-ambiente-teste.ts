/**
 * Monta o banco DESCARTÁVEL para testar os sorteios no navegador.
 *
 *   DATABASE_URL=postgresql://teste:teste@localhost:55433/guppy_teste \
 *   AUTH_SECRET=teste-local npx tsx --conditions=react-server scripts/sorteios/preparar-ambiente-teste.ts
 *
 * Pessoas e telefones FICTÍCIOS (domínio .invalid, números 9xxxx-00xx).
 * Recusa rodar fora de banco de teste.
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { lerCsv } from "@/lib/sorteios/csv";
import { importarLances, importarParticipantes, salvarSorteio } from "@/lib/sorteios/servico";

if (!/teste/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Recusado: não é banco de teste.");
  process.exit(1);
}

const SENHA = "Teste@12345";
const ator = { id: null, nome: "Preparação de teste" };

async function usuario(email: string, nome: string, role: "CUSTOMER" | "SUPER_ADMIN") {
  const senhaHash = await bcrypt.hash(SENHA, 10);
  return prisma.user.upsert({
    where: { email },
    create: { email, nome, role, senhaHash },
    update: { senhaHash, role, senhaPrecisaTroca: false },
  });
}

async function main() {
  await prisma.sorteio.deleteMany({ where: { slug: "sorteio-ficticio-de-teste" } });
  await prisma.verificacaoTelefone.deleteMany({ where: { user: { email: { endsWith: "@teste.invalid" } } } });
  await prisma.telefoneVerificado.deleteMany({ where: { user: { email: { endsWith: "@teste.invalid" } } } });

  await usuario("dono@teste.invalid", "Dono Teste", "SUPER_ADMIN");
  const ana = await usuario("ana@teste.invalid", "Ana Souza", "CUSTOMER");
  await usuario("bruno@teste.invalid", "Bruno Lima", "CUSTOMER");
  await usuario("intruso@teste.invalid", "Intruso Teste", "CUSTOMER");

  // Cenário A: Ana já tem o WhatsApp verificado.
  await prisma.telefoneVerificado.create({ data: { userId: ana.id, telefone: "5521900000001", metodo: "ADMIN", confirmadoPorNome: "teste" } });

  const id = await salvarSorteio(
    null,
    {
      nome: "Sorteio Fictício de Teste",
      slug: "sorteio-ficticio-de-teste",
      organizador: "Marchezi Guppy Farm",
      eventoOrigem: "Leilão fictício (teste)",
      dataEvento: new Date("2026-10-09T12:00:00-03:00"),
      premio: "1 trio fictício Blue Glass",
      descricao: "Sorteio só para testar o módulo. Nada aqui é real.",
      regras: "1. Cada lance válido vale um bilhete.\n2. O sorteio é entre os bilhetes.",
      imagemUrl: "/images/guppy/blueglass.webp",
      transmissaoUrl: "https://instagram.com/guppydelinhagem",
      dataSorteio: new Date("2026-10-12T20:00:00-03:00"),
      publico: true,
      modoSorteio: "ELETRONICO",
      concursoLoteria: null,
    },
    ator,
  );

  const nomes = ["+55 21 90000-0001", "+55 11 90000-0002", "Fulano Só Nome", "+52 1 844 000 0004"];
  const chances = [26, 24, 22, 19, 15, 13, 10, 9, 8, 7, 6, 6, 4, 4, 4, 3, 3, 2, 2, 1, 1, 1];
  const linhas = chances.map((c, i) => `${i + 1};${nomes[i] ?? `+55 ${31 + i} 90000-${String(i + 1).padStart(4, "0")}`};${c}`);
  await importarParticipantes(id, lerCsv(`n;participante;chances\n${linhas.join("\n")}`).linhas, ator);

  await importarLances(
    id,
    lerCsv(
      [
        "lote_id;lote;sequencia;participante;valor;tipo;classificacao",
        "L-01;1;1;+55 21 90000-0001;60;;válido",
        "L-01;1;2;+55 11 90000-0002;65;;válido",
        "L-01;1;3;+55 21 90000-0001;65;;inválido",
        "L-01;1;4;+55 21 90000-0001;75;;válido",
        "L-02;1;1;+55 11 90000-0002;60;;válido",
        "L-02;1;2;+55 21 90000-0001;250;Xeque-Mate;",
        "L-02;1;3;+55 11 90000-0002;63;;válido",
      ].join("\n"),
    ).linhas,
    ator,
  );

  console.log(`Pronto. Senha de todos: ${SENHA}`);
  console.log("Admin: dono@teste.invalid · Clientes: ana@ (verificada), bruno@, intruso@");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
