import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { criptografar, descriptografar } from "@/lib/cripto";
import {
  atribuirFaixas,
  bilheteDaLoteria,
  donoDoBilhete,
  faixasContinuas,
  lerListaCanonica,
  listaCanonica,
  METODO_SORTEIO,
  nomePublico,
  sha256,
  sortearBilhete,
} from "./bilhetes";
import { campo, type LinhaCsv } from "./csv";
import { avaliarLote, lerClassificacao, lerTipo, lerValor } from "./lances";
import { chaveTelefone, mascararTelefone, pareceTelefone } from "./telefone";

/**
 * Regras de negócio dos sorteios. Tudo que muda dado passa por aqui, dentro de
 * transação e com evento na corrente de auditoria (EventoSorteio).
 *
 * As actions (actions/sorteios.ts) só checam permissão e chamam estas funções;
 * o script de teste chama direto, sem Next.
 */

export type Ator = { id: string | null; nome: string };

export class ErroSorteio extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroSorteio";
  }
}

type Tx = Prisma.TransactionClient;

// ─────────────────────────────────────────────
// Corrente de eventos
// ─────────────────────────────────────────────

/**
 * Trava por sorteio: toda mudança no mesmo sorteio entra em fila. É o que
 * impede dois cliques em "Sortear" de produzirem dois vencedores e mantém a
 * corrente de eventos sem bifurcar.
 */
async function travar(tx: Tx, sorteioId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"sorteio:" + sorteioId}))`;
}

/**
 * JSON com as chaves em ordem. O Postgres (jsonb) devolve as chaves em outra
 * ordem da que gravamos; sem isto o hash lido nunca bateria com o gravado.
 */
function jsonCanonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonCanonico).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${jsonCanonico(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

export function hashEvento(e: {
  hashAnterior: string | null;
  tipo: string;
  descricao: string;
  justificativa: string | null;
  dados: unknown;
  atorNome: string;
  ocorridoEm: Date;
}): string {
  return sha256(
    [
      e.hashAnterior ?? "",
      e.tipo,
      e.descricao,
      e.justificativa ?? "",
      jsonCanonico(e.dados),
      e.atorNome,
      e.ocorridoEm.toISOString(),
    ].join("␞"),
  );
}

export async function registrarEvento(
  tx: Tx,
  sorteioId: string,
  ator: Ator,
  e: { tipo: string; descricao: string; justificativa?: string | null; dados?: unknown },
) {
  const ultimo = await tx.eventoSorteio.findFirst({
    where: { sorteioId },
    orderBy: [{ ocorridoEm: "desc" }, { id: "desc" }],
    select: { hash: true, ocorridoEm: true },
  });
  // Relógio monotônico dentro do sorteio: a ordem da corrente é a do tempo.
  let ocorridoEm = new Date();
  if (ultimo && ocorridoEm <= ultimo.ocorridoEm) {
    ocorridoEm = new Date(ultimo.ocorridoEm.getTime() + 1);
  }
  const base = {
    hashAnterior: ultimo?.hash ?? null,
    tipo: e.tipo,
    descricao: e.descricao,
    justificativa: e.justificativa?.trim() || null,
    dados: e.dados ?? null,
    atorNome: ator.nome,
    ocorridoEm,
  };
  await tx.eventoSorteio.create({
    data: {
      sorteioId,
      ...base,
      dados: (base.dados ?? undefined) as Prisma.InputJsonValue | undefined,
      atorId: ator.id,
      hash: hashEvento(base),
    },
  });
}

/** Confere a corrente inteira. Devolve o índice do primeiro evento quebrado. */
export async function verificarCorrente(sorteioId: string) {
  const eventos = await prisma.eventoSorteio.findMany({
    where: { sorteioId },
    orderBy: [{ ocorridoEm: "asc" }, { id: "asc" }],
  });
  let anterior: string | null = null;
  for (let i = 0; i < eventos.length; i++) {
    const ev = eventos[i];
    const esperado = hashEvento({
      hashAnterior: anterior,
      tipo: ev.tipo,
      descricao: ev.descricao,
      justificativa: ev.justificativa,
      dados: ev.dados,
      atorNome: ev.atorNome,
      ocorridoEm: ev.ocorridoEm,
    });
    if (ev.hashAnterior !== anterior || ev.hash !== esperado) {
      return { integra: false, quebraEm: i, total: eventos.length };
    }
    anterior = ev.hash;
  }
  return { integra: true, quebraEm: null, total: eventos.length };
}

function exigirJustificativa(j: string | null | undefined, oQue: string): string {
  const t = (j ?? "").trim();
  if (t.length < 5) throw new ErroSorteio(`Escreva a justificativa para ${oQue}.`);
  return t;
}

async function carregarParaMudar(tx: Tx, sorteioId: string) {
  await travar(tx, sorteioId);
  const s = await tx.sorteio.findUnique({ where: { id: sorteioId } });
  if (!s) throw new ErroSorteio("Sorteio não encontrado.");
  return s;
}

function exigirConferencia(s: { status: string }) {
  if (s.status !== "CONFERENCIA") {
    throw new ErroSorteio(
      s.status === "HOMOLOGADO"
        ? "A lista está homologada e congelada. Para mudar, retifique a homologação (com justificativa)."
        : "Este sorteio já foi encerrado; a lista não pode mais mudar.",
    );
  }
}

// ─────────────────────────────────────────────
// Identidade do participante
// ─────────────────────────────────────────────

export function normalizarNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Chave estável: pelo telefone quando há um, senão pelo nome. */
export function identificar(
  bruto: string,
  telefoneExtra?: string,
): { chave: string; telefone: string | null; nome: string } {
  const nome = bruto.trim();
  const candidatoTel = telefoneExtra?.trim() || (pareceTelefone(nome) ? nome : "");
  const tel = candidatoTel ? chaveTelefone(candidatoTel) : null;
  if (tel) return { chave: `tel:${tel}`, telefone: tel, nome };
  return { chave: `nome:${normalizarNome(nome)}`, telefone: null, nome };
}

// ─────────────────────────────────────────────
// Importação de participantes
// ─────────────────────────────────────────────

export type ResumoImportacao = {
  novos: number;
  atualizados: number;
  iguais: number;
  ausentes: string[];
  avisos: string[];
  vinculados: number;
};

/**
 * Importa (ou reimporta) a lista de participantes. Idempotente pela chave.
 *
 * Colunas aceitas: participante | whatsapp | whatsapp_participante | nome |
 * telefone, e chances | bilhetes | lances_validos. A coluna "n"/"ordem" define a
 * ordem; sem ela, vale a ordem do arquivo.
 *
 * Quem já existe e não veio no arquivo NÃO é apagado: aparece em `ausentes`
 * para a conferência decidir. Mudança sobre lista já importada exige
 * justificativa.
 */
export async function importarParticipantes(
  sorteioId: string,
  linhas: LinhaCsv[],
  ator: Ator,
  justificativa?: string | null,
): Promise<ResumoImportacao> {
  const entradas: { chave: string; telefone: string | null; nome: string; chances: number; ordem: number; faixaInformada: string }[] = [];
  const avisos: string[] = [];
  linhas.forEach((l, i) => {
    const bruto = campo(l, "whatsapp_participante", "participante", "whatsapp", "nome", "telefone");
    const telExtra = campo(l, "telefone", "whatsapp");
    const chancesTxt = campo(l, "chances", "bilhetes_qtd", "lances_validos", "qtd", "quantidade");
    if (!bruto || /^total$/i.test(bruto.replace(/\*/g, "").trim())) return;
    const chances = Number(chancesTxt.replace(/\D/g, ""));
    if (!Number.isInteger(chances) || chancesTxt === "") {
      avisos.push(`Linha ${i + 2}: "${bruto}" sem número de chances; ignorada.`);
      return;
    }
    const id = identificar(bruto, telExtra !== bruto ? telExtra : undefined);
    if (pareceTelefone(bruto) && !id.telefone) {
      avisos.push(`Linha ${i + 2}: "${bruto}" parece telefone, mas não foi reconhecido. Entrou pelo nome.`);
    }
    const ordemTxt = campo(l, "n", "ordem", "no", "num");
    const ordem = Number(ordemTxt) || i + 1;
    if (entradas.some((e) => e.chave === id.chave)) {
      avisos.push(`Linha ${i + 2}: "${bruto}" repetido no arquivo; a segunda linha foi ignorada.`);
      return;
    }
    entradas.push({ ...id, chances, ordem, faixaInformada: campo(l, "bilhetes_provisorios", "bilhetes", "faixa") });
  });
  if (entradas.length === 0) throw new ErroSorteio("Nenhum participante reconhecido no arquivo.");

  return prisma.$transaction(
    async (tx) => {
      const s = await carregarParaMudar(tx, sorteioId);
      exigirConferencia(s);
      const existentes = await tx.participanteSorteio.findMany({ where: { sorteioId } });
      const porChave = new Map(existentes.map((p) => [p.chave, p]));
      const primeiraVez = existentes.length === 0;

      const mudancas: { chave: string; de?: { chances: number; ordem: number }; para: { chances: number; ordem: number } }[] = [];
      let novos = 0;
      let atualizados = 0;
      let iguais = 0;
      for (const e of entradas) {
        const atual = porChave.get(e.chave);
        if (!atual) {
          novos++;
          mudancas.push({ chave: e.chave, para: { chances: e.chances, ordem: e.ordem } });
        } else if (atual.chances !== e.chances || atual.ordem !== e.ordem) {
          atualizados++;
          mudancas.push({ chave: e.chave, de: { chances: atual.chances, ordem: atual.ordem }, para: { chances: e.chances, ordem: e.ordem } });
        } else iguais++;
      }
      const ausentes = existentes
        .filter((p) => !entradas.some((e) => e.chave === p.chave))
        .map((p) => p.nomeOrigem);

      if (!primeiraVez && mudancas.length > 0) {
        exigirJustificativa(justificativa, "alterar uma lista já importada");
      }

      for (const e of entradas) {
        await tx.participanteSorteio.upsert({
          where: { sorteioId_chave: { sorteioId, chave: e.chave } },
          create: {
            sorteioId,
            chave: e.chave,
            nomeOrigem: e.nome,
            telefone: e.telefone,
            ordem: e.ordem,
            chances: e.chances,
          },
          update: { chances: e.chances, ordem: e.ordem },
        });
      }

      // Confere a numeração provisória que veio na planilha contra a calculada.
      const todos = await tx.participanteSorteio.findMany({ where: { sorteioId } });
      const { faixas, total } = atribuirFaixas(todos);
      for (const e of entradas) {
        if (!e.faixaInformada) continue;
        const p = todos.find((t) => t.chave === e.chave)!;
        const f = faixas.get(p.id);
        const nums = e.faixaInformada.match(/\d+/g)?.map(Number) ?? [];
        const ini = nums[0];
        const fim = nums[1] ?? nums[0];
        if (f && (ini !== f.inicio || fim !== f.fim)) {
          avisos.push(`"${e.nome}": a planilha diz bilhetes ${e.faixaInformada}, a conta dá ${f.inicio}–${f.fim}.`);
        }
      }

      if (mudancas.length > 0 || primeiraVez) {
        await registrarEvento(tx, sorteioId, ator, {
          tipo: primeiraVez ? "importacao.participantes" : "retificacao.participantes",
          descricao: primeiraVez
            ? `Importou ${entradas.length} participantes com ${total} chances (preliminar).`
            : `Reimportou a lista: ${novos} novos, ${atualizados} alterados, ${iguais} iguais.`,
          justificativa: primeiraVez ? null : justificativa,
          dados: { mudancas, ausentes, total },
        });
      }

      const vinculados = await vincularSorteio(tx, sorteioId, ator);
      return { novos, atualizados, iguais, ausentes, avisos, vinculados };
    },
    { timeout: 60_000 },
  );
}

// ─────────────────────────────────────────────
// Importação e auditoria de lances
// ─────────────────────────────────────────────

export type ResumoLances = {
  lidos: number;
  novos: number;
  repetidos: number;
  validos: number;
  invalidos: number;
  revisar: number;
  semParticipante: number;
  avisos: string[];
};

function lerDataHora(s: string): Date | null {
  if (!s) return null;
  // "09/10/2026 20:15:03" ou ISO.
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (br) {
    const [, d, m, a, h, mi, se] = br;
    // Horário de Brasília (UTC-3, sem horário de verão desde 2019).
    return new Date(Date.UTC(+a, +m - 1, +d, +h + 3, +mi, +(se ?? 0)));
  }
  const iso = new Date(s);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

/**
 * Importa a auditoria de lances (aba "Auditoria de lances" da planilha).
 *
 * Colunas: lote_id (obrigatório, único por lote), lote (rótulo público),
 * sequencia/ordem, horario, encerramento, participante/autor, whatsapp,
 * valor, tipo (normal | xeque-mate | mestre criador), classificacao/situacao
 * (o que a planilha concluiu), texto/mensagem.
 *
 * Reimportar a mesma linha não duplica (chave = lote + sequência + autor +
 * valor). O motor reavalia o lote inteiro a cada importação; decisão manual da
 * conferência é preservada.
 */
export async function importarLances(
  sorteioId: string,
  linhas: LinhaCsv[],
  ator: Ator,
): Promise<ResumoLances> {
  const avisos: string[] = [];
  type Bruto = {
    loteId: string;
    loteRotulo: string | null;
    sequencia: number;
    horario: Date | null;
    encerramento: Date | null;
    autor: string;
    telefone: string | null;
    chaveParticipante: string;
    valor: number | null;
    tipo: ReturnType<typeof lerTipo>;
    planilha: ReturnType<typeof lerClassificacao>;
    texto: string | null;
    chaveImportacao: string;
  };
  const brutos: Bruto[] = [];
  linhas.forEach((l, i) => {
    const loteId = campo(l, "lote_id", "id_lote", "id_interno", "lote_interno");
    const autor = campo(l, "participante", "autor", "whatsapp_participante", "nome", "whatsapp");
    if (!loteId || !autor) {
      if (Object.values(l).some(Boolean)) avisos.push(`Linha ${i + 2}: sem lote_id ou participante; ignorada.`);
      return;
    }
    const seqTxt = campo(l, "sequencia", "ordem", "seq", "n");
    const sequencia = Number(seqTxt) || i + 1;
    const id = identificar(autor, campo(l, "whatsapp", "telefone") || undefined);
    const valor = lerValor(campo(l, "valor", "lance", "valor_lance"));
    const textoValor = campo(l, "valor", "lance", "valor_lance");
    brutos.push({
      loteId,
      loteRotulo: campo(l, "lote", "lote_publico", "numero_lote") || null,
      sequencia,
      horario: lerDataHora(campo(l, "horario", "hora", "data_hora")),
      encerramento: lerDataHora(campo(l, "encerramento", "fim_lote", "encerramento_lote")),
      autor,
      telefone: id.telefone,
      chaveParticipante: id.chave,
      valor,
      tipo: lerTipo(campo(l, "tipo", "modalidade")),
      planilha: lerClassificacao(campo(l, "classificacao", "situacao", "valido", "status")),
      texto: campo(l, "texto", "mensagem", "texto_original") || null,
      chaveImportacao: sha256([loteId, sequencia, id.chave, textoValor].join("|")).slice(0, 32),
    });
  });
  if (brutos.length === 0) throw new ErroSorteio("Nenhum lance reconhecido no arquivo.");

  return prisma.$transaction(
    async (tx) => {
      const s = await carregarParaMudar(tx, sorteioId);
      exigirConferencia(s);
      const participantes = await tx.participanteSorteio.findMany({
        where: { sorteioId },
        select: { id: true, chave: true },
      });
      const pid = new Map(participantes.map((p) => [p.chave, p.id]));

      let novos = 0;
      let repetidos = 0;
      for (const b of brutos) {
        const existente = await tx.lanceSorteio.findUnique({
          where: { sorteioId_chaveImportacao: { sorteioId, chaveImportacao: b.chaveImportacao } },
          select: { id: true },
        });
        if (existente) {
          repetidos++;
          continue;
        }
        novos++;
        await tx.lanceSorteio.create({
          data: {
            sorteioId,
            loteId: b.loteId,
            loteRotulo: b.loteRotulo,
            sequencia: b.sequencia,
            horario: b.horario,
            encerramento: b.encerramento,
            autor: b.autor,
            telefone: b.telefone,
            valor: b.valor,
            tipo: b.tipo,
            textoOriginal: b.texto,
            classificacaoMotor: "REVISAR",
            classificacaoPlanilha: b.planilha,
            classificacao: "REVISAR",
            participanteId: pid.get(b.chaveParticipante) ?? null,
            chaveImportacao: b.chaveImportacao,
          },
        });
      }

      // Reavalia cada lote inteiro (um lance novo no meio muda os seguintes).
      const lotes = [...new Set(brutos.map((b) => b.loteId))];
      for (const loteId of lotes) {
        const doLote = await tx.lanceSorteio.findMany({ where: { sorteioId, loteId } });
        const avaliados = avaliarLote(
          doLote.map((l) => ({
            sequencia: l.sequencia,
            valor: l.valor == null ? null : Number(l.valor),
            tipo: l.tipo,
            horario: l.horario,
            encerramento: l.encerramento,
            planilha: l.classificacaoPlanilha,
          })),
        );
        const seqs = new Map<number, number>();
        for (const l of doLote) seqs.set(l.sequencia, (seqs.get(l.sequencia) ?? 0) + 1);
        for (const l of doLote) {
          const a = avaliados.find((x) => x.sequencia === l.sequencia)!;
          let motor = a.motor;
          let classificacao = a.classificacao;
          let motivo = a.motivo;
          if ((seqs.get(l.sequencia) ?? 0) > 1) {
            motor = "REVISAR";
            classificacao = "REVISAR";
            motivo = `Sequência ${l.sequencia} repetida no lote ${l.loteId}; ordem dos lances incerta.`;
          }
          await tx.lanceSorteio.update({
            where: { id: l.id },
            data: {
              classificacaoMotor: motor,
              // Decisão da conferência vale mais que o motor.
              ...(l.decididoEm ? {} : { classificacao, motivo }),
            },
          });
        }
      }

      const contagem = await tx.lanceSorteio.groupBy({
        by: ["classificacao"],
        where: { sorteioId },
        _count: true,
      });
      const n = (c: string) => contagem.find((x) => x.classificacao === c)?._count ?? 0;
      const semParticipante = await tx.lanceSorteio.count({
        where: { sorteioId, participanteId: null, classificacao: "VALIDO" },
      });

      await registrarEvento(tx, sorteioId, ator, {
        tipo: "importacao.lances",
        descricao: `Importou ${brutos.length} lances (${novos} novos, ${repetidos} já existiam).`,
        dados: { novos, repetidos, lotes: lotes.length },
      });

      return {
        lidos: brutos.length,
        novos,
        repetidos,
        validos: n("VALIDO"),
        invalidos: n("INVALIDO"),
        revisar: n("REVISAR"),
        semParticipante,
        avisos,
      };
    },
    { timeout: 120_000 },
  );
}

/** Decisão da conferência sobre um lance. */
export async function decidirLance(
  sorteioId: string,
  lanceId: string,
  classificacao: "VALIDO" | "INVALIDO",
  justificativa: string,
  ator: Ator,
) {
  const j = exigirJustificativa(justificativa, "decidir o lance");
  await prisma.$transaction(async (tx) => {
    const s = await carregarParaMudar(tx, sorteioId);
    exigirConferencia(s);
    const l = await tx.lanceSorteio.findFirst({ where: { id: lanceId, sorteioId } });
    if (!l) throw new ErroSorteio("Lance não encontrado.");
    await tx.lanceSorteio.update({
      where: { id: l.id },
      data: { classificacao, motivo: j, decididoPorNome: ator.nome, decididoEm: new Date() },
    });
    await registrarEvento(tx, sorteioId, ator, {
      tipo: "lance.decisao",
      descricao: `Lance ${l.loteId}#${l.sequencia} (${l.autor}, ${l.valor ?? "?"}) de ${l.classificacao} para ${classificacao}.`,
      justificativa: j,
      dados: { lanceId, de: l.classificacao, para: classificacao, motor: l.classificacaoMotor },
    });
  });
}

/**
 * Leva a contagem de lances válidos para as chances do participante. Não é
 * automático: a lista resumida e a auditoria de lances são fontes diferentes, e
 * a conferência decide qual vale.
 */
export async function aplicarChancesDosLances(
  sorteioId: string,
  participanteId: string,
  justificativa: string,
  ator: Ator,
) {
  const j = exigirJustificativa(justificativa, "aplicar a contagem dos lances");
  await prisma.$transaction(async (tx) => {
    const s = await carregarParaMudar(tx, sorteioId);
    exigirConferencia(s);
    const p = await tx.participanteSorteio.findFirst({ where: { id: participanteId, sorteioId } });
    if (!p) throw new ErroSorteio("Participante não encontrado.");
    const pendentes = await tx.lanceSorteio.count({ where: { participanteId, classificacao: "REVISAR" } });
    if (pendentes > 0) throw new ErroSorteio(`Ainda há ${pendentes} lance(s) deste participante para revisar.`);
    const validos = await tx.lanceSorteio.count({ where: { participanteId, classificacao: "VALIDO" } });
    await tx.participanteSorteio.update({ where: { id: p.id }, data: { chances: validos } });
    await registrarEvento(tx, sorteioId, ator, {
      tipo: "retificacao.chances",
      descricao: `${p.nomeOrigem}: chances de ${p.chances} para ${validos} (contagem dos lances válidos).`,
      justificativa: j,
      dados: { participanteId, de: p.chances, para: validos },
    });
  });
}

/** Correção manual de chances, com justificativa. */
export async function corrigirChances(
  sorteioId: string,
  participanteId: string,
  chances: number,
  justificativa: string,
  ator: Ator,
) {
  const j = exigirJustificativa(justificativa, "corrigir as chances");
  if (!Number.isInteger(chances) || chances < 0 || chances > 100_000) {
    throw new ErroSorteio("Quantidade de chances inválida.");
  }
  await prisma.$transaction(async (tx) => {
    const s = await carregarParaMudar(tx, sorteioId);
    exigirConferencia(s);
    const p = await tx.participanteSorteio.findFirst({ where: { id: participanteId, sorteioId } });
    if (!p) throw new ErroSorteio("Participante não encontrado.");
    if (p.chances === chances) return;
    await tx.participanteSorteio.update({ where: { id: p.id }, data: { chances } });
    await registrarEvento(tx, sorteioId, ator, {
      tipo: "retificacao.chances",
      descricao: `${p.nomeOrigem}: chances de ${p.chances} para ${chances}.`,
      justificativa: j,
      dados: { participanteId, de: p.chances, para: chances },
    });
  });
}

/**
 * Informa o WhatsApp de quem entrou só pelo nome. Não vincula a conta por si:
 * o vínculo continua exigindo o telefone verificado pela própria pessoa.
 */
export async function informarTelefone(
  sorteioId: string,
  participanteId: string,
  telefoneBruto: string,
  justificativa: string,
  ator: Ator,
) {
  const j = exigirJustificativa(justificativa, "informar o telefone");
  const tel = chaveTelefone(telefoneBruto);
  if (!tel) throw new ErroSorteio("Telefone não reconhecido. Inclua o DDI (ex.: +55 21 99999-9999).");
  return prisma.$transaction(async (tx) => {
    const s = await carregarParaMudar(tx, sorteioId);
    exigirConferencia(s);
    const p = await tx.participanteSorteio.findFirst({ where: { id: participanteId, sorteioId } });
    if (!p) throw new ErroSorteio("Participante não encontrado.");
    if (p.telefone) throw new ErroSorteio("Este participante já tem telefone.");
    const outro = await tx.participanteSorteio.findUnique({
      where: { sorteioId_chave: { sorteioId, chave: `tel:${tel}` } },
    });
    if (outro) {
      throw new ErroSorteio(
        `Este número já está na lista como "${outro.nomeOrigem}". Se é a mesma pessoa, some as chances com justificativa e zere uma das linhas.`,
      );
    }
    await tx.participanteSorteio.update({
      where: { id: p.id },
      data: { telefone: tel, chave: `tel:${tel}` },
    });
    await registrarEvento(tx, sorteioId, ator, {
      tipo: "participante.telefone",
      descricao: `${p.nomeOrigem}: telefone informado (${mascararTelefone(tel)}).`,
      justificativa: j,
      dados: { participanteId, chaveAntiga: p.chave },
    });
    return vincularSorteio(tx, sorteioId, ator);
  });
}

// ─────────────────────────────────────────────
// Vínculo com a conta
// ─────────────────────────────────────────────

/**
 * Liga os participantes sem conta a quem tem o telefone verificado. Única porta
 * de vínculo automático: telefone sem verificação nunca liga nada.
 */
/**
 * Telefones do cadastro da LOJA ligados a uma conta: Cliente com userId,
 * telefone, e que a equipe digitou (cadastroProprioEm nulo).
 *
 * O formulário público /meus-dados não entra: ele não exige login e acha o
 * cliente pelo telefone, então qualquer um conseguiria pôr o próprio e-mail no
 * cadastro de outra pessoa. Telefone só vale como prova quando veio da equipe.
 * Número que aparece em mais de uma conta fica de fora (ambíguo).
 */
async function telefonesDoCadastroDaLoja(tx: Tx, telefones: string[]): Promise<Map<string, string>> {
  // Sempre olha TODAS as contas: filtrar só a do usuário esconderia que o
  // mesmo número também está no cadastro de outra pessoa.
  const clientes = await tx.cliente.findMany({
    where: {
      userId: { not: null },
      cadastroProprioEm: null,
      telefone: { not: null },
    },
    select: { telefone: true, userId: true },
  });
  const donos = new Map<string, Set<string>>();
  for (const c of clientes) {
    const chave = chaveTelefone(c.telefone!);
    if (!chave || !telefones.includes(chave)) continue;
    if (!donos.has(chave)) donos.set(chave, new Set());
    donos.get(chave)!.add(c.userId!);
  }
  const unicos = new Map<string, string>();
  for (const [tel, contas] of donos) if (contas.size === 1) unicos.set(tel, [...contas][0]);
  return unicos;
}

/**
 * Liga os participantes sem conta. Duas provas valem, nesta ordem:
 *  1. telefone verificado pela própria pessoa (WhatsApp reverso);
 *  2. telefone que a equipe cadastrou para um cliente que tem conta.
 * Telefone digitado pelo cliente sem verificação nunca liga nada.
 */
async function vincularSorteio(tx: Tx, sorteioId: string, ator: Ator, soDoUsuario?: string): Promise<number> {
  const soltos = await tx.participanteSorteio.findMany({
    where: { sorteioId, userId: null, telefone: { not: null } },
    select: { id: true, telefone: true, nomeOrigem: true, chances: true },
  });
  if (soltos.length === 0) return 0;
  const telefones = soltos.map((s) => s.telefone!);
  const verificados = await tx.telefoneVerificado.findMany({
    where: { telefone: { in: telefones } },
    select: { telefone: true, userId: true },
  });
  const porVerificado = new Map(verificados.map((v) => [v.telefone, v.userId]));
  const porCadastro = await telefonesDoCadastroDaLoja(tx, telefones);

  let n = 0;
  for (const p of soltos) {
    const tel = p.telefone!;
    // Verificado manda: se o número foi provado por uma conta, o cadastro da
    // loja não pode mandar os créditos para outra.
    const verificadoPor = porVerificado.get(tel);
    const userId = verificadoPor ?? porCadastro.get(tel);
    if (!userId || (soDoUsuario && userId !== soDoUsuario)) continue;
    const origem = verificadoPor ? "TELEFONE_VERIFICADO" : "CADASTRO_LOJA";
    await tx.participanteSorteio.update({
      where: { id: p.id },
      data: { userId, vinculadoEm: new Date(), vinculoOrigem: origem },
    });
    await registrarEvento(tx, sorteioId, ator, {
      tipo: "vinculo.automatico",
      descricao: `${p.nomeOrigem} (${p.chances} chances) ligado à conta pelo ${
        verificadoPor ? "telefone verificado" : "telefone do cadastro da loja"
      }.`,
      dados: { participanteId: p.id, userId, origem },
    });
    n++;
  }
  return n;
}

/**
 * Liga os créditos do usuário pelo cadastro da loja. Roda quando ele abre
 * Meus Sorteios: o cliente que a equipe cadastrou só ganha conta (e o vínculo
 * Cliente → User por e-mail) quando entra pela primeira vez.
 */
export async function vincularPeloCadastroDoUsuario(userId: string): Promise<number> {
  const clientes = await prisma.cliente.findMany({
    where: { userId, cadastroProprioEm: null, telefone: { not: null } },
    select: { telefone: true },
  });
  const telefones = clientes.flatMap((c) => {
    const k = chaveTelefone(c.telefone!);
    return k ? [k] : [];
  });
  if (telefones.length === 0) return 0;
  const sorteios = await prisma.participanteSorteio.findMany({
    where: { telefone: { in: telefones }, userId: null },
    select: { sorteioId: true },
    distinct: ["sorteioId"],
  });
  if (sorteios.length === 0) return 0;
  const ator = { id: null, nome: "Sistema (cadastro da loja)" };
  return prisma.$transaction(async (tx) => {
    let n = 0;
    for (const { sorteioId } of sorteios) {
      await travar(tx, sorteioId);
      n += await vincularSorteio(tx, sorteioId, ator, userId);
    }
    return n;
  });
}

/** Depois de verificar um telefone: liga os créditos dele em todos os sorteios. */
export async function vincularTelefoneEmTodos(tx: Tx, telefone: string, ator: Ator) {
  const sorteios = await tx.participanteSorteio.findMany({
    where: { telefone, userId: null },
    select: { sorteioId: true },
    distinct: ["sorteioId"],
  });
  let n = 0;
  for (const { sorteioId } of sorteios) {
    await travar(tx, sorteioId);
    n += await vincularSorteio(tx, sorteioId, ator);
  }
  return n;
}

/**
 * Vínculo manual pela equipe (ex.: o comprador do leilão é cliente antigo e o
 * número dele já está no cadastro). Exige justificativa e fica na corrente.
 */
export async function vincularManual(
  sorteioId: string,
  participanteId: string,
  userId: string,
  justificativa: string,
  ator: Ator,
) {
  const j = exigirJustificativa(justificativa, "vincular manualmente");
  await prisma.$transaction(async (tx) => {
    await carregarParaMudar(tx, sorteioId);
    const p = await tx.participanteSorteio.findFirst({ where: { id: participanteId, sorteioId } });
    if (!p) throw new ErroSorteio("Participante não encontrado.");
    const u = await tx.user.findUnique({ where: { id: userId }, select: { id: true, nome: true, email: true } });
    if (!u) throw new ErroSorteio("Conta não encontrada.");
    await tx.participanteSorteio.update({
      where: { id: p.id },
      data: { userId: u.id, vinculadoEm: new Date(), vinculoOrigem: "ADMIN", avisoVistoEm: null },
    });
    await registrarEvento(tx, sorteioId, ator, {
      tipo: "vinculo.manual",
      descricao: `${p.nomeOrigem} ligado manualmente à conta de ${u.nome}.`,
      justificativa: j,
      dados: { participanteId, userId: u.id, anterior: p.userId },
    });
  });
}

export async function desvincular(
  sorteioId: string,
  participanteId: string,
  justificativa: string,
  ator: Ator,
) {
  const j = exigirJustificativa(justificativa, "desfazer o vínculo");
  await prisma.$transaction(async (tx) => {
    await carregarParaMudar(tx, sorteioId);
    const p = await tx.participanteSorteio.findFirst({ where: { id: participanteId, sorteioId } });
    if (!p?.userId) throw new ErroSorteio("Participante sem vínculo.");
    await tx.participanteSorteio.update({
      where: { id: p.id },
      data: { userId: null, vinculadoEm: null, vinculoOrigem: null, avisoVistoEm: null },
    });
    await registrarEvento(tx, sorteioId, ator, {
      tipo: "vinculo.desfeito",
      descricao: `${p.nomeOrigem}: vínculo com a conta desfeito.`,
      justificativa: j,
      dados: { participanteId, userId: p.userId },
    });
  });
}

// ─────────────────────────────────────────────
// Verificação de telefone (WhatsApp reverso)
// ─────────────────────────────────────────────

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I/L
const VALIDADE_DIAS = 7;
const MAX_TENTATIVAS = 5;

export function gerarCodigo(): string {
  let c = "";
  for (let i = 0; i < 6; i++) c += ALFABETO[randomInt(ALFABETO.length)];
  return `GDL-${c.slice(0, 3)}${c.slice(3)}`;
}

function normalizarCodigo(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^GDL/, "");
}

/**
 * O cliente pede para verificar um número. Devolve o código que ele vai mandar
 * do próprio WhatsApp para o da loja.
 */
export async function solicitarVerificacao(userId: string, telefoneBruto: string) {
  const tel = chaveTelefone(telefoneBruto);
  if (!tel) throw new ErroSorteio("Número não reconhecido. Confira o DDD (e o DDI, se for de fora do Brasil).");

  const dono = await prisma.telefoneVerificado.findUnique({ where: { telefone: tel } });
  if (dono?.userId === userId) throw new ErroSorteio("Este número já está verificado na sua conta.");
  if (dono) {
    throw new ErroSorteio("Este número já está verificado em outra conta. Fale com a gente pelo WhatsApp para resolver.");
  }
  const hoje = await prisma.verificacaoTelefone.count({
    where: { userId, criadoEm: { gte: new Date(Date.now() - 24 * 3600_000) } },
  });
  if (hoje >= 6) throw new ErroSorteio("Muitos pedidos de verificação hoje. Tente amanhã.");

  const codigo = gerarCodigo();
  await prisma.$transaction([
    prisma.verificacaoTelefone.updateMany({
      where: { userId, telefone: tel, status: "PENDENTE" },
      data: { status: "CANCELADA" },
    }),
    prisma.verificacaoTelefone.create({
      data: {
        userId,
        telefone: tel,
        codigoCifrado: criptografar(codigo),
        expiraEm: new Date(Date.now() + VALIDADE_DIAS * 24 * 3600_000),
      },
    }),
  ]);
  return { telefone: tel, codigo };
}

/** Código de uma verificação pendente do PRÓPRIO usuário (para rever na tela). */
export function codigoDaVerificacao(v: { codigoCifrado: string }): string {
  return descriptografar(v.codigoCifrado);
}

/**
 * A equipe confirma: chegou no WhatsApp da loja, VINDO DO NÚMERO pedido, a
 * mensagem com este código. Confere o código, grava o telefone verificado e
 * liga os créditos.
 */
export async function confirmarVerificacao(verificacaoId: string, codigoDigitado: string, ator: Ator) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"verif:" + verificacaoId}))`;
    const v = await tx.verificacaoTelefone.findUnique({ where: { id: verificacaoId } });
    if (!v || v.status !== "PENDENTE") throw new ErroSorteio("Pedido de verificação não está mais pendente.");
    if (v.expiraEm < new Date()) {
      await tx.verificacaoTelefone.update({ where: { id: v.id }, data: { status: "EXPIRADA" } });
      throw new ErroSorteio("Este código expirou. O cliente precisa gerar outro.");
    }
    const certo = normalizarCodigo(descriptografar(v.codigoCifrado));
    if (normalizarCodigo(codigoDigitado) !== certo) {
      const tentativas = v.tentativas + 1;
      await tx.verificacaoTelefone.update({
        where: { id: v.id },
        data: { tentativas, ...(tentativas >= MAX_TENTATIVAS ? { status: "CANCELADA" } : {}) },
      });
      // Devolve em vez de lançar: lançar desfaria a contagem de tentativas.
      return { ok: false as const, erro: tentativas >= MAX_TENTATIVAS
        ? "Código errado de novo. O pedido foi cancelado; o cliente precisa gerar outro."
        : `Código não confere (tentativa ${tentativas} de ${MAX_TENTATIVAS}).` };
    }
    const dono = await tx.telefoneVerificado.findUnique({ where: { telefone: v.telefone } });
    if (dono && dono.userId !== v.userId) {
      throw new ErroSorteio("Este número já foi verificado por outra conta.");
    }
    if (!dono) {
      await tx.telefoneVerificado.create({
        data: { userId: v.userId, telefone: v.telefone, metodo: "WHATSAPP_REVERSO", confirmadoPorNome: ator.nome },
      });
    }
    await tx.verificacaoTelefone.update({
      where: { id: v.id },
      data: { status: "CONFIRMADA", confirmadaEm: new Date(), confirmadaPorNome: ator.nome },
    });
    const vinculados = await vincularTelefoneEmTodos(tx, v.telefone, ator);
    return { ok: true as const, vinculados, telefone: v.telefone, userId: v.userId };
  });
}

export async function cancelarVerificacao(verificacaoId: string) {
  await prisma.verificacaoTelefone.updateMany({
    where: { id: verificacaoId, status: "PENDENTE" },
    data: { status: "CANCELADA" },
  });
}

// ─────────────────────────────────────────────
// Homologação, retificação e sorteio
// ─────────────────────────────────────────────

async function montarLista(tx: Tx, sorteioId: string) {
  const participantes = await tx.participanteSorteio.findMany({ where: { sorteioId } });
  const { faixas, total } = atribuirFaixas(participantes);
  const linhas = participantes
    .filter((p) => faixas.get(p.id))
    .map((p) => {
      const f = faixas.get(p.id)!;
      return { participanteId: p.id, chave: p.chave, inicio: f.inicio, fim: f.fim };
    });
  return { participantes, faixas, total, linhas };
}

export async function homologar(sorteioId: string, ator: Ator, observacao?: string | null) {
  return prisma.$transaction(
    async (tx) => {
      const s = await carregarParaMudar(tx, sorteioId);
      exigirConferencia(s);
      const revisar = await tx.lanceSorteio.count({ where: { sorteioId, classificacao: "REVISAR" } });
      if (revisar > 0) throw new ErroSorteio(`Ainda há ${revisar} lance(s) para revisar antes de homologar.`);
      if (s.modoSorteio === "LOTERIA_FEDERAL" && !s.concursoLoteria) {
        throw new ErroSorteio("Informe o concurso da Loteria Federal antes de homologar.");
      }
      const { participantes, faixas, total, linhas } = await montarLista(tx, sorteioId);
      if (total < 1) throw new ErroSorteio("Não há bilhetes para homologar.");
      if (!faixasContinuas(linhas)) throw new ErroSorteio("A numeração dos bilhetes ficou com buraco; confira as chances.");

      let texto = listaCanonica(sorteioId, linhas);
      if (s.modoSorteio === "LOTERIA_FEDERAL") texto += `loteria:${s.concursoLoteria}\n`;
      const hash = sha256(texto);
      for (const p of participantes) {
        const f = faixas.get(p.id) ?? null;
        await tx.participanteSorteio.update({
          where: { id: p.id },
          data: { bilheteInicio: f?.inicio ?? null, bilheteFim: f?.fim ?? null },
        });
      }
      await tx.sorteio.update({
        where: { id: sorteioId },
        data: {
          status: "HOMOLOGADO",
          homologadoEm: new Date(),
          homologadoPorNome: ator.nome,
          totalBilhetes: total,
          hashLista: hash,
          listaCongelada: texto,
        },
      });
      await registrarEvento(tx, sorteioId, ator, {
        tipo: "homologacao",
        descricao: `Homologou ${linhas.length} participantes e ${total} bilhetes. SHA-256 ${hash}.`,
        justificativa: observacao ?? null,
        dados: { total, hash, participantes: linhas.length, modo: s.modoSorteio, concurso: s.concursoLoteria },
      });
      return { total, hash };
    },
    { timeout: 60_000 },
  );
}

/** Desfaz a homologação (lista volta a ser editável). Fica na corrente. */
export async function retificarHomologacao(sorteioId: string, justificativa: string, ator: Ator) {
  const j = exigirJustificativa(justificativa, "retificar a homologação");
  await prisma.$transaction(async (tx) => {
    const s = await carregarParaMudar(tx, sorteioId);
    if (s.status !== "HOMOLOGADO") throw new ErroSorteio("Só dá para retificar uma lista homologada e ainda não sorteada.");
    await tx.participanteSorteio.updateMany({
      where: { sorteioId },
      data: { bilheteInicio: null, bilheteFim: null },
    });
    await tx.sorteio.update({
      where: { id: sorteioId },
      data: {
        status: "CONFERENCIA",
        homologadoEm: null,
        homologadoPorNome: null,
        totalBilhetes: null,
        hashLista: null,
        listaCongelada: null,
      },
    });
    await registrarEvento(tx, sorteioId, ator, {
      tipo: "retificacao.homologacao",
      descricao: `Homologação desfeita. Hash anterior ${s.hashLista}.`,
      justificativa: j,
      dados: { hashAnterior: s.hashLista, totalAnterior: s.totalBilhetes },
    });
  });
}

/** Recalcula o hash a partir do banco e compara com o congelado. */
async function conferirCongelamento(tx: Tx, s: { id: string; hashLista: string | null; listaCongelada: string | null; modoSorteio: string; concursoLoteria: string | null }) {
  const participantes = await tx.participanteSorteio.findMany({ where: { sorteioId: s.id } });
  const linhas = participantes
    .filter((p) => p.bilheteInicio != null && p.bilheteFim != null && p.chances > 0)
    .map((p) => ({ participanteId: p.id, chave: p.chave, inicio: p.bilheteInicio!, fim: p.bilheteFim! }));
  const coerentes = participantes.every((p) =>
    p.chances === 0 ? p.bilheteInicio == null : p.bilheteFim! - p.bilheteInicio! + 1 === p.chances,
  );
  let texto = listaCanonica(s.id, linhas);
  if (s.modoSorteio === "LOTERIA_FEDERAL") texto += `loteria:${s.concursoLoteria}\n`;
  if (!coerentes || sha256(texto) !== s.hashLista || texto !== s.listaCongelada) {
    throw new ErroSorteio(
      "A lista no banco não bate com a lista homologada (hash diferente). O sorteio foi bloqueado; confira a auditoria.",
    );
  }
  return linhas;
}

export function nomePublicoParticipante(p: {
  nomeOrigem: string;
  telefone: string | null;
  user?: { nome: string } | null;
}): string {
  if (p.user?.nome) return nomePublico(p.user.nome);
  if (!pareceTelefone(p.nomeOrigem) && p.nomeOrigem.trim()) return nomePublico(p.nomeOrigem);
  return mascararTelefone(p.telefone);
}

/**
 * Realiza o sorteio. O número sai daqui (servidor), nunca do navegador.
 *
 * A trava do sorteio + a troca de status HOMOLOGADO → REALIZADO na mesma
 * transação garantem um vencedor só, mesmo com dois cliques ou duas abas.
 */
export async function realizarSorteio(
  sorteioId: string,
  ator: Ator,
  opcoes: { premiosLoteria?: string[]; rng?: (max: number) => number } = {},
) {
  return prisma.$transaction(
    async (tx) => {
      const s = await carregarParaMudar(tx, sorteioId);
      if (s.status === "REALIZADO") throw new ErroSorteio("Este sorteio já foi realizado.");
      if (s.status !== "HOMOLOGADO" || !s.totalBilhetes || !s.hashLista) {
        throw new ErroSorteio("O sorteio só pode ser feito com a lista homologada.");
      }
      const linhas = await conferirCongelamento(tx, s);

      let bilhete: number;
      let metodo: string;
      let criterio: string | null = null;
      if (s.modoSorteio === "LOTERIA_FEDERAL") {
        const premios = (opcoes.premiosLoteria ?? []).map((p) => p.trim()).filter(Boolean);
        if (premios.length < 1) throw new ErroSorteio("Informe os prêmios da Loteria Federal.");
        const r = bilheteDaLoteria(premios, s.totalBilhetes);
        bilhete = r.bilhete;
        criterio = r.criterio;
        metodo = `Loteria Federal, concurso ${s.concursoLoteria}: ${r.criterio}`;
      } else {
        bilhete = sortearBilhete(s.totalBilhetes, opcoes.rng);
        metodo = METODO_SORTEIO;
      }

      const dono = donoDoBilhete(linhas, bilhete);
      if (!dono) throw new ErroSorteio("Bilhete sorteado sem dono na lista congelada.");
      const vencedor = await tx.participanteSorteio.findUniqueOrThrow({
        where: { id: dono.participanteId },
        include: { user: { select: { nome: true } } },
      });
      const publico = nomePublicoParticipante(vencedor);

      const r = await tx.sorteio.updateMany({
        where: { id: sorteioId, status: "HOMOLOGADO" },
        data: {
          status: "REALIZADO",
          realizadoEm: new Date(),
          realizadoPorNome: ator.nome,
          realizadoPorId: ator.id,
          metodoSorteio: metodo,
          bilheteVencedor: bilhete,
          participanteVencedorId: vencedor.id,
          vencedorPublico: publico,
          ...(s.modoSorteio === "LOTERIA_FEDERAL" ? { premiosLoteria: opcoes.premiosLoteria } : {}),
        },
      });
      if (r.count !== 1) throw new ErroSorteio("Este sorteio já foi realizado.");

      await registrarEvento(tx, sorteioId, ator, {
        tipo: "sorteio.realizado",
        descricao: `Bilhete ${bilhete} de ${s.totalBilhetes}: ${publico}.`,
        dados: {
          bilhete,
          total: s.totalBilhetes,
          participanteId: vencedor.id,
          chave: vencedor.chave,
          hashLista: s.hashLista,
          metodo,
          criterio,
          premiosLoteria: opcoes.premiosLoteria ?? null,
        },
      });
      return { bilhete, total: s.totalBilhetes, vencedorPublico: publico, participanteId: vencedor.id };
    },
    { timeout: 30_000 },
  );
}

/**
 * Ensaio da roleta: sorteia um número para testar a apresentação, sem
 * resultado. Fica registrado como ensaio, nunca como vencedor.
 */
export async function ensaioSorteio(sorteioId: string, ator: Ator) {
  return prisma.$transaction(async (tx) => {
    const s = await carregarParaMudar(tx, sorteioId);
    if (s.status === "REALIZADO" || s.status === "CANCELADO") {
      throw new ErroSorteio("Sorteio encerrado; não há ensaio.");
    }
    const { total, linhas } = await montarLista(tx, sorteioId);
    const bilhete = sortearBilhete(total);
    const dono = donoDoBilhete(linhas, bilhete)!;
    const p = await tx.participanteSorteio.findUniqueOrThrow({
      where: { id: dono.participanteId },
      include: { user: { select: { nome: true } } },
    });
    await registrarEvento(tx, sorteioId, ator, {
      tipo: "sorteio.ensaio",
      descricao: `ENSAIO da roleta (sem valor): bilhete ${bilhete} de ${total}.`,
      dados: { bilhete, total },
    });
    return { bilhete, total, vencedorPublico: nomePublicoParticipante(p) };
  });
}

export async function cancelarSorteio(sorteioId: string, justificativa: string, ator: Ator) {
  const j = exigirJustificativa(justificativa, "cancelar o sorteio");
  await prisma.$transaction(async (tx) => {
    const s = await carregarParaMudar(tx, sorteioId);
    if (s.status === "CANCELADO") return;
    await tx.sorteio.update({ where: { id: sorteioId }, data: { status: "CANCELADO", publico: false } });
    await registrarEvento(tx, sorteioId, ator, {
      tipo: "sorteio.cancelado",
      descricao:
        s.status === "REALIZADO"
          ? `Sorteio cancelado DEPOIS de realizado (bilhete ${s.bilheteVencedor}, ${s.vencedorPublico}). O resultado fica no histórico.`
          : "Sorteio cancelado.",
      justificativa: j,
      dados: { statusAnterior: s.status, bilhete: s.bilheteVencedor },
    });
  });
}

/** Cadastro/edição dos dados do sorteio (não toca na lista). */
export type DadosSorteio = {
  nome: string;
  slug: string;
  organizador: string;
  eventoOrigem: string | null;
  dataEvento: Date | null;
  premio: string;
  descricao: string | null;
  regras: string | null;
  imagemUrl: string | null;
  transmissaoUrl: string | null;
  dataSorteio: Date | null;
  publico: boolean;
  modoSorteio: "ELETRONICO" | "LOTERIA_FEDERAL";
  concursoLoteria: string | null;
};

export async function salvarSorteio(id: string | null, d: DadosSorteio, ator: Ator) {
  if (!id) {
    const s = await prisma.$transaction(async (tx) => {
      const novo = await tx.sorteio.create({ data: { ...d, status: "CONFERENCIA" } });
      await registrarEvento(tx, novo.id, ator, {
        tipo: "sorteio.criado",
        descricao: `Criou o sorteio "${d.nome}".`,
        dados: { premio: d.premio, modo: d.modoSorteio },
      });
      return novo;
    });
    return s.id;
  }
  await prisma.$transaction(async (tx) => {
    const s = await carregarParaMudar(tx, id);
    const travado = s.status !== "CONFERENCIA";
    if (travado && (d.modoSorteio !== s.modoSorteio || d.concursoLoteria !== s.concursoLoteria)) {
      throw new ErroSorteio("Modo de sorteio e concurso ficam fixos depois da homologação.");
    }
    const mudou: Record<string, { de: unknown; para: unknown }> = {};
    for (const k of Object.keys(d) as (keyof DadosSorteio)[]) {
      const a = s[k] instanceof Date ? (s[k] as Date).toISOString() : s[k];
      const b = d[k] instanceof Date ? (d[k] as Date).toISOString() : d[k];
      if (a !== b) mudou[k] = { de: a, para: b };
    }
    if (Object.keys(mudou).length === 0) return;
    await tx.sorteio.update({ where: { id }, data: d });
    await registrarEvento(tx, id, ator, {
      tipo: "sorteio.editado",
      descricao: `Editou: ${Object.keys(mudou).join(", ")}.`,
      dados: mudou,
    });
  });
  return id;
}

/** Marca como visto o aviso de créditos novos do cliente. */
export async function marcarAvisoVisto(userId: string, participanteIds: string[]) {
  await prisma.participanteSorteio.updateMany({
    where: { id: { in: participanteIds }, userId, avisoVistoEm: null },
    data: { avisoVistoEm: new Date() },
  });
}

export { lerListaCanonica };
