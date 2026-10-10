/**
 * Teste do módulo de sorteios contra um banco DESCARTÁVEL.
 *
 *   DATABASE_URL=postgresql://teste:teste@localhost:55433/guppy_teste \
 *   AUTH_SECRET=teste npx tsx --conditions=react-server scripts/sorteios/teste-sorteios.ts
 *
 * Recusa rodar se o banco não tiver "teste" no nome: ele apaga e cria dados.
 * Todos os telefones e pessoas aqui são fictícios.
 */
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { chaveTelefone, formatarTelefone, mascararTelefone, pareceTelefone } from "@/lib/sorteios/telefone";
import { atribuirFaixas, bilheteDaLoteria, donoDoBilhete, lerListaCanonica, nomePublico, sortearBilhete } from "@/lib/sorteios/bilhetes";
import { avaliarLote, lerValor } from "@/lib/sorteios/lances";
import { lerCsv } from "@/lib/sorteios/csv";
import * as S from "@/lib/sorteios/servico";

if (!/teste/.test(process.env.DATABASE_URL ?? "")) {
  console.error("Recusado: DATABASE_URL não parece um banco de teste.");
  process.exit(1);
}

const ator: S.Ator = { id: null, nome: "Teste automatizado" };
let ok = 0;
const falhas: string[] = [];
async function caso(nome: string, fn: () => unknown | Promise<unknown>) {
  try {
    await fn();
    ok++;
    console.log(`  ✓ ${nome}`);
  } catch (e) {
    falhas.push(nome);
    console.log(`  ✗ ${nome}\n     ${(e as Error).message}`);
  }
}
async function lanca(fn: () => Promise<unknown>, trecho: RegExp) {
  try {
    await fn();
  } catch (e) {
    assert.match((e as Error).message, trecho);
    return;
  }
  assert.fail(`deveria ter recusado (${trecho})`);
}

async function limpar() {
  await prisma.sorteio.deleteMany({ where: { slug: { startsWith: "teste-" } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@teste.invalid" } } });
}

async function main() {
  console.log("\nFunções puras");
  await caso("telefone BR com e sem o 9 dão a mesma chave", () => {
    assert.equal(chaveTelefone("+55 99 8111-4155"), "5599981114155");
    assert.equal(chaveTelefone("+55 99 98111-4155"), "5599981114155");
    assert.equal(chaveTelefone("(21) 96642-9563"), "5521966429563");
  });
  await caso("México +52 1 preserva o país e casa com/sem o 1", () => {
    assert.equal(chaveTelefone("+52 1 844 599 1131"), "528445991131");
    assert.equal(chaveTelefone("+52 844 599 1131"), "528445991131");
    assert.equal(formatarTelefone("528445991131"), "+52 844 599 1131");
  });
  await caso("nome não é telefone", () => {
    assert.equal(pareceTelefone("Vinicius Auch"), false);
    assert.equal(pareceTelefone("Felipe Cesar Romera Lista Guppy"), false);
    assert.equal(pareceTelefone("+55 21 96642-9563"), true);
  });
  await caso("máscara pública não expõe o número", () => {
    assert.equal(mascararTelefone("5521966429563"), "(21) •••••-9563");
    assert.equal(nomePublico("vinicius auch"), "Vinicius A.");
  });
  await caso("faixas da tabela do leilão batem (001–026 … 226)", () => {
    const chances = [26, 24, 22, 19, 19, 15, 13, 10, 9, 8, 7, 6, 6, 4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1];
    const { faixas, total } = atribuirFaixas(chances.map((c, i) => ({ id: `p${i}`, ordem: i + 1, chances: c })));
    assert.equal(total, 226);
    assert.deepEqual(faixas.get("p0"), { inicio: 1, fim: 26 });
    assert.deepEqual(faixas.get("p4"), { inicio: 92, fim: 110 });
    assert.deepEqual(faixas.get("p8"), { inicio: 149, fim: 157 });
    assert.deepEqual(faixas.get("p31"), { inicio: 226, fim: 226 });
  });
  await caso("regras de lance: inicial, incremento, iguais, encerramento, XM/MC", () => {
    const fim = new Date("2026-10-09T23:00:00Z");
    const h = (m: number) => new Date(fim.getTime() + m * 60_000);
    const r = avaliarLote([
      { sequencia: 1, valor: 55, tipo: "NORMAL", horario: h(-30), encerramento: fim },
      { sequencia: 2, valor: 60, tipo: "NORMAL", horario: h(-29), encerramento: fim },
      { sequencia: 3, valor: 60, tipo: "NORMAL", horario: h(-28), encerramento: fim },
      { sequencia: 4, valor: 63, tipo: "NORMAL", horario: h(-27), encerramento: fim },
      { sequencia: 5, valor: 70, tipo: "NORMAL", horario: h(-26), encerramento: fim },
      { sequencia: 6, valor: 65, tipo: "NORMAL", horario: h(-25), encerramento: fim },
      { sequencia: 7, valor: 72.5, tipo: "NORMAL", horario: h(-24), encerramento: fim },
      { sequencia: 8, valor: 80, tipo: "NORMAL", horario: h(-23), encerramento: fim, planilha: "VALIDO" },
      { sequencia: 9, valor: 200, tipo: "XEQUE_MATE", horario: h(-22), encerramento: fim },
      { sequencia: 10, valor: 90, tipo: "NORMAL", horario: h(+1), encerramento: fim },
      { sequencia: 11, valor: 85, tipo: "NORMAL", horario: h(-1), encerramento: fim, planilha: "INVALIDO" },
    ]);
    const c = r.map((x) => x.classificacao);
    assert.deepEqual(c, ["INVALIDO", "VALIDO", "INVALIDO", "INVALIDO", "VALIDO", "INVALIDO", "INVALIDO", "VALIDO", "REVISAR", "INVALIDO", "REVISAR"]);
    assert.equal(lerValor("R$ 1.065,00"), 1065);
  });
  await caso("CSV com ; aspas e BOM", () => {
    const { linhas } = lerCsv('﻿Nº;WhatsApp / Participante;Chances\r\n1;"+55 21 96642-9563";26\r\n5;"Auch; Vinicius";19\r\n');
    assert.equal(linhas[0].whatsapp_participante, "+55 21 96642-9563");
    assert.equal(linhas[1].whatsapp_participante, "Auch; Vinicius");
    assert.equal(linhas[1].n, "5");
  });
  await caso("Loteria Federal: regra determinística", () => {
    assert.equal(bilheteDaLoteria(["58.123", "12.999", "45.001"], 226).bilhete, 123);
    assert.equal(bilheteDaLoteria(["58.999", "12.001"], 226).bilhete, 1);
    assert.equal(bilheteDaLoteria(["00.000", "11.999", "22.998", "33.997", "44.996"], 226).bilhete, 1);
  });
  await caso("probabilidade proporcional aos bilhetes (300 mil sorteios)", () => {
    const chances = [26, 10, 1];
    const { faixas, total } = atribuirFaixas(chances.map((c, i) => ({ id: `p${i}`, ordem: i, chances: c })));
    const linhas = [...faixas].map(([id, f]) => ({ id, ...f! }));
    const cont: Record<string, number> = { p0: 0, p1: 0, p2: 0 };
    const N = 300_000;
    for (let i = 0; i < N; i++) cont[donoDoBilhete(linhas, sortearBilhete(total))!.id]++;
    chances.forEach((c, i) => {
      const esperado = c / total;
      const visto = cont[`p${i}`] / N;
      assert.ok(Math.abs(visto - esperado) < 0.005, `p${i}: ${visto.toFixed(4)} vs ${esperado.toFixed(4)}`);
    });
  });

  console.log("\nBanco (dados fictícios)");
  await limpar();
  const [ana, bruno, carla, intruso] = await Promise.all(
    ["ana", "bruno", "carla", "intruso"].map((n) =>
      prisma.user.create({ data: { email: `${n}@teste.invalid`, nome: `${n[0].toUpperCase()}${n.slice(1)} Teste`, role: "CUSTOMER" } }),
    ),
  );
  // Cenário A: Ana já tem o telefone verificado ANTES da importação.
  await prisma.telefoneVerificado.create({ data: { userId: ana.id, telefone: "5521911110001", metodo: "ADMIN" } });

  const id = await S.salvarSorteio(null, {
    nome: "Sorteio de teste", slug: `teste-${Date.now()}`, organizador: "Teste", eventoOrigem: "Leilão fictício",
    dataEvento: new Date(), premio: "Trio fictício", descricao: null, regras: null, imagemUrl: null,
    transmissaoUrl: null, dataSorteio: null, publico: false, modoSorteio: "ELETRONICO", concursoLoteria: null,
  }, ator);

  const csv = [
    "Nº;WhatsApp / Participante;Chances;Bilhetes provisórios",
    "1;+55 21 91111-0001;5;001–005",   // Ana (verificado → vincula na hora)
    "2;+55 11 92222-0002;3;006–008",   // Bruno (ainda sem cadastro do número)
    "3;+52 1 844 000 0003;2;009–010",  // estrangeiro
    "4;Fulano Só Nome;4;011–014",      // só nome
    "5;+55 99 8333-0004;1;015",        // celular antigo sem o 9 (Carla)
    "**TOTAL**;;15;",
  ].join("\n");

  let r1: S.ResumoImportacao;
  await caso("importação: cenário A vincula na hora quem já tem número verificado", async () => {
    r1 = await S.importarParticipantes(id, lerCsv(csv).linhas, ator);
    assert.equal(r1.novos, 5);
    assert.equal(r1.vinculados, 1);
    assert.equal(r1.avisos.length, 0, r1.avisos.join(" | "));
    const pa = await prisma.participanteSorteio.findFirstOrThrow({ where: { sorteioId: id, userId: ana.id } });
    assert.equal(pa.chances, 5);
  });
  await caso("reimportar o mesmo arquivo não duplica nada", async () => {
    const r = await S.importarParticipantes(id, lerCsv(csv).linhas, ator);
    assert.equal(r.novos + r.atualizados, 0);
    assert.equal(await prisma.participanteSorteio.count({ where: { sorteioId: id } }), 5);
  });
  await caso("mudar a lista importada exige justificativa", async () => {
    await lanca(() => S.importarParticipantes(id, lerCsv(csv.replace(";5;001", ";6;001")).linhas, ator), /justificativa/);
  });
  await caso("participante só com nome fica pendente (sem telefone fictício)", async () => {
    const p = await prisma.participanteSorteio.findFirstOrThrow({ where: { sorteioId: id, chave: "nome:fulano so nome" } });
    assert.equal(p.telefone, null);
    assert.equal(p.userId, null);
  });

  await caso("cenário B: número digitado sem verificar NÃO vincula", async () => {
    await prisma.user.update({ where: { id: bruno.id }, data: { telefone: "11922220002" } });
    const p = await prisma.participanteSorteio.findFirstOrThrow({ where: { sorteioId: id, telefone: "5511922220002" } });
    assert.equal(p.userId, null);
  });
  await caso("cenário B: verificação com código errado conta tentativas e não vincula", async () => {
    await S.solicitarVerificacao(bruno.id, "+55 11 92222-0002");
    const v = await prisma.verificacaoTelefone.findFirstOrThrow({ where: { userId: bruno.id, status: "PENDENTE" } });
    const r = await S.confirmarVerificacao(v.id, "GDL-XXXXXX", ator);
    assert.equal(r.ok, false);
    assert.equal((await prisma.verificacaoTelefone.findUniqueOrThrow({ where: { id: v.id } })).tentativas, 1);
  });
  await caso("cenário B: código certo verifica e vincula os créditos", async () => {
    const { codigo } = await S.solicitarVerificacao(bruno.id, "11 92222-0002");
    const v = await prisma.verificacaoTelefone.findFirstOrThrow({ where: { userId: bruno.id, status: "PENDENTE" } });
    const r = await S.confirmarVerificacao(v.id, codigo.toLowerCase().replace("-", " "), ator);
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.vinculados, 1);
    const p = await prisma.participanteSorteio.findFirstOrThrow({ where: { sorteioId: id, telefone: "5511922220002" } });
    assert.equal(p.userId, bruno.id);
    assert.equal(p.vinculoOrigem, "TELEFONE_VERIFICADO");
  });
  await caso("segurança: outra conta não consegue pedir o número já verificado", async () => {
    await lanca(() => S.solicitarVerificacao(intruso.id, "+55 11 92222-0002"), /outra conta/);
  });
  await caso("segurança: intruso pede número de terceiro ainda livre, mas sem o código vindo do WhatsApp não vincula", async () => {
    await S.solicitarVerificacao(intruso.id, "+55 99 98333-0004");
    const v = await prisma.verificacaoTelefone.findFirstOrThrow({ where: { userId: intruso.id, status: "PENDENTE" } });
    for (let i = 0; i < 5; i++) await S.confirmarVerificacao(v.id, `GDL-AAAAA${i}`, ator);
    assert.equal((await prisma.verificacaoTelefone.findUniqueOrThrow({ where: { id: v.id } })).status, "CANCELADA");
    const p = await prisma.participanteSorteio.findFirstOrThrow({ where: { sorteioId: id, telefone: "5599983330004" } });
    assert.equal(p.userId, null);
  });
  await caso("cenário C: Carla adiciona um segundo WhatsApp (antigo, sem o 9) e recebe os créditos", async () => {
    await prisma.telefoneVerificado.create({ data: { userId: carla.id, telefone: "5527900000009", metodo: "ADMIN" } });
    const { codigo } = await S.solicitarVerificacao(carla.id, "+55 99 8333-0004");
    const v = await prisma.verificacaoTelefone.findFirstOrThrow({ where: { userId: carla.id, status: "PENDENTE" } });
    const r = await S.confirmarVerificacao(v.id, codigo, ator);
    assert.equal(r.ok && r.vinculados, 1);
    assert.equal(await prisma.telefoneVerificado.count({ where: { userId: carla.id } }), 2);
    assert.equal(await prisma.user.count({ where: { email: { endsWith: "@teste.invalid" } } }), 4, "nenhuma conta nova criada");
  });
  await caso("isolamento: cada conta só enxerga as próprias participações", async () => {
    const daAna = await prisma.participanteSorteio.findMany({ where: { userId: ana.id } });
    assert.ok(daAna.every((p) => p.userId === ana.id));
    assert.equal(await prisma.participanteSorteio.count({ where: { userId: intruso.id } }), 0);
  });
  await caso("só nome: informar o telefone (com justificativa) não vincula sozinho", async () => {
    const p = await prisma.participanteSorteio.findFirstOrThrow({ where: { sorteioId: id, chave: "nome:fulano so nome" } });
    await lanca(() => S.informarTelefone(id, p.id, "+55 31 94444-0005", "", ator), /justificativa/);
    await S.informarTelefone(id, p.id, "+55 31 94444-0005", "Confirmado pelo grupo do leilão", ator);
    const depois = await prisma.participanteSorteio.findUniqueOrThrow({ where: { id: p.id } });
    assert.equal(depois.telefone, "5531944440005");
    assert.equal(depois.userId, null);
  });

  await caso("lances: importa, classifica e reimporta sem duplicar", async () => {
    const lancesCsv = [
      "lote_id;lote;sequencia;participante;valor;tipo;classificacao",
      "L1;1;1;+55 21 91111-0001;60;;válido",
      "L1;1;2;+55 11 92222-0002;65;;válido",
      "L1;1;3;+55 21 91111-0001;65;;inválido",
      "L2;1;1;+55 11 92222-0002;60;;válido",
      "L2;1;2;+55 21 91111-0001;150;Xeque-Mate;",
    ].join("\n");
    const r = await S.importarLances(id, lerCsv(lancesCsv).linhas, ator);
    assert.equal(r.novos, 5);
    assert.equal(r.validos, 3);
    assert.equal(r.invalidos, 1);
    assert.equal(r.revisar, 1);
    const r2 = await S.importarLances(id, lerCsv(lancesCsv).linhas, ator);
    assert.equal(r2.novos, 0);
    assert.equal(r2.repetidos, 5);
  });
  await caso("homologação bloqueada com lance para revisar", async () => {
    await lanca(() => S.homologar(id, ator), /revisar/);
    const xm = await prisma.lanceSorteio.findFirstOrThrow({ where: { sorteioId: id, classificacao: "REVISAR" } });
    await S.decidirLance(id, xm.id, "VALIDO", "Xeque-Mate aceito pelo organizador", ator);
  });
  await caso("sorteio sem homologação é recusado", async () => {
    await lanca(() => S.realizarSorteio(id, ator), /homologada/);
  });

  let hash = "";
  await caso("homologação congela a lista com SHA-256", async () => {
    const h = await S.homologar(id, ator);
    assert.equal(h.total, 15);
    assert.match(h.hash, /^[0-9a-f]{64}$/);
    hash = h.hash;
    const linhas = lerListaCanonica((await prisma.sorteio.findUniqueOrThrow({ where: { id } })).listaCongelada!);
    assert.equal(linhas.length, 5);
  });
  await caso("lista homologada não aceita correção", async () => {
    const p = await prisma.participanteSorteio.findFirstOrThrow({ where: { sorteioId: id } });
    await lanca(() => S.corrigirChances(id, p.id, 99, "tentativa depois de homologar", ator), /homologada/);
  });
  await caso("alteração silenciosa no banco bloqueia o sorteio", async () => {
    const p = await prisma.participanteSorteio.findFirstOrThrow({ where: { sorteioId: id, userId: ana.id } });
    await prisma.participanteSorteio.update({ where: { id: p.id }, data: { chances: 50 } });
    await lanca(() => S.realizarSorteio(id, ator), /não bate/);
    await prisma.participanteSorteio.update({ where: { id: p.id }, data: { chances: 5 } });
  });
  await caso("ensaio não grava vencedor", async () => {
    const e = await S.ensaioSorteio(id, ator);
    assert.ok(e.bilhete >= 1 && e.bilhete <= 15);
    assert.equal((await prisma.sorteio.findUniqueOrThrow({ where: { id } })).bilheteVencedor, null);
  });
  await caso("dois cliques simultâneos em Sortear: um vencedor só", async () => {
    const rs = await Promise.allSettled([S.realizarSorteio(id, ator), S.realizarSorteio(id, ator), S.realizarSorteio(id, ator)]);
    const okr = rs.filter((r) => r.status === "fulfilled");
    assert.equal(okr.length, 1);
    rs.filter((r) => r.status === "rejected").forEach((r) => assert.match(((r as PromiseRejectedResult).reason as Error).message, /já foi realizado/));
    const s = await prisma.sorteio.findUniqueOrThrow({ where: { id } });
    assert.equal(s.status, "REALIZADO");
    assert.equal(s.hashLista, hash);
    const dono = await prisma.participanteSorteio.findUniqueOrThrow({ where: { id: s.participanteVencedorId! } });
    assert.ok(s.bilheteVencedor! >= dono.bilheteInicio! && s.bilheteVencedor! <= dono.bilheteFim!);
    console.log(`     bilhete ${s.bilheteVencedor} → ${s.vencedorPublico}`);
  });
  await caso("corrente de auditoria íntegra e acusa adulteração", async () => {
    const c = await S.verificarCorrente(id);
    assert.equal(c.integra, true);
    assert.ok(c.total >= 10);
    const ev = await prisma.eventoSorteio.findFirstOrThrow({ where: { sorteioId: id, tipo: "sorteio.realizado" } });
    await prisma.eventoSorteio.update({ where: { id: ev.id }, data: { descricao: "Bilhete 1 de 15: outra pessoa." } });
    assert.equal((await S.verificarCorrente(id)).integra, false);
  });

  await caso("Loteria Federal: precisa do concurso antes de homologar e usa o resultado", async () => {
    const id2 = await S.salvarSorteio(null, {
      nome: "Teste loteria", slug: `teste-lf-${Date.now()}`, organizador: "Teste", eventoOrigem: null, dataEvento: null,
      premio: "Fictício", descricao: null, regras: null, imagemUrl: null, transmissaoUrl: null, dataSorteio: null,
      publico: false, modoSorteio: "LOTERIA_FEDERAL", concursoLoteria: null,
    }, ator);
    await S.importarParticipantes(id2, lerCsv("participante;chances\n+55 21 95555-0001;100\n+55 21 95555-0002;126").linhas, ator);
    await lanca(() => S.homologar(id2, ator), /concurso/);
    await prisma.sorteio.update({ where: { id: id2 }, data: { concursoLoteria: "9999" } });
    await S.homologar(id2, ator);
    const r = await S.realizarSorteio(id2, ator, { premiosLoteria: ["12.345", "67.890"] });
    // 345 e 890 passam de 226 → regra do resto: 12345 mod 226 + 1.
    assert.equal(r.bilhete, (12345 % 226) + 1);
  });

  await limpar();
  console.log(`\n${ok} ok, ${falhas.length} falha(s)${falhas.length ? ": " + falhas.join("; ") : ""}`);
  await prisma.$disconnect();
  process.exit(falhas.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
