import "server-only";
import { prisma } from "@/lib/prisma";
import { atribuirFaixas, lerListaCanonica, type Faixa } from "@/lib/sorteios/bilhetes";
import { codigoDaVerificacao, nomePublicoParticipante } from "@/lib/sorteios/servico";
import { chaveTelefone } from "@/lib/sorteios/telefone";

// Consultas dos sorteios. Três públicos, três recortes:
//  - painel: tudo, inclusive telefone completo (só com sorteios.gerenciar);
//  - cliente: SÓ as participações ligadas ao userId da sessão;
//  - público: dados do sorteio, total de bilhetes e nome público do vencedor.

export const STATUS_SORTEIO_LABEL = {
  CONFERENCIA: "Em conferência",
  HOMOLOGADO: "Homologado",
  REALIZADO: "Realizado",
  CANCELADO: "Cancelado",
} as const;

export type Indicadores = {
  participantes: number;
  identificados: number;
  pendentesIdentificacao: number;
  chancesPreliminares: number;
  chancesHomologadas: number | null;
  creditosVinculados: number;
  creditosAguardando: number;
  creditosSoNome: number;
};

function indicadores(
  participantes: { chances: number; telefone: string | null; userId: string | null }[],
  totalHomologado: number | null,
): Indicadores {
  const soma = (f: (p: (typeof participantes)[number]) => boolean) =>
    participantes.filter(f).reduce((a, p) => a + p.chances, 0);
  return {
    participantes: participantes.filter((p) => p.chances > 0).length,
    identificados: participantes.filter((p) => p.telefone || p.userId).length,
    pendentesIdentificacao: participantes.filter((p) => !p.telefone && !p.userId).length,
    chancesPreliminares: soma(() => true),
    chancesHomologadas: totalHomologado,
    creditosVinculados: soma((p) => !!p.userId),
    creditosAguardando: soma((p) => !p.userId && !!p.telefone),
    creditosSoNome: soma((p) => !p.userId && !p.telefone),
  };
}

// ── Painel ───────────────────────────────────────────────────────────────────

export async function listSorteiosAdmin() {
  const sorteios = await prisma.sorteio.findMany({
    orderBy: [{ criadoEm: "desc" }],
    include: {
      participantes: { select: { chances: true, telefone: true, userId: true } },
    },
  });
  return sorteios.map(({ participantes, ...s }) => ({
    ...s,
    indicadores: indicadores(participantes, s.totalBilhetes),
  }));
}

export async function getSorteioAdmin(id: string) {
  const s = await prisma.sorteio.findUnique({
    where: { id },
    include: {
      participantes: {
        orderBy: [{ ordem: "asc" }, { id: "asc" }],
        include: { user: { select: { id: true, nome: true, email: true } } },
      },
    },
  });
  if (!s) return null;

  const [porParticipante, lances, eventos, verificacoes] = await Promise.all([
    prisma.lanceSorteio.groupBy({
      by: ["participanteId", "classificacao"],
      where: { sorteioId: id },
      _count: true,
    }),
    prisma.lanceSorteio.findMany({
      where: { sorteioId: id },
      orderBy: [{ loteId: "asc" }, { sequencia: "asc" }],
    }),
    prisma.eventoSorteio.findMany({
      where: { sorteioId: id },
      orderBy: [{ ocorridoEm: "desc" }, { id: "desc" }],
    }),
    prisma.verificacaoTelefone.findMany({
      where: { status: "PENDENTE", telefone: { in: s.participantes.flatMap((p) => (p.telefone ? [p.telefone] : [])) } },
      select: { telefone: true },
    }),
  ]);

  // Clientes do cadastro com o mesmo número, AINDA NÃO verificado: é só uma
  // pista para a conferência (vínculo manual com justificativa), nunca vínculo.
  const soltos = s.participantes.filter((p) => p.telefone && !p.userId);
  const pistas = new Map<string, { nome: string; userId: string | null; origem: string }[]>();
  if (soltos.length > 0) {
    const [clientes, usuarios] = await Promise.all([
      prisma.cliente.findMany({
        where: { telefone: { not: null } },
        select: { nome: true, telefone: true, userId: true },
      }),
      prisma.user.findMany({
        where: { telefone: { not: null }, role: "CUSTOMER" },
        select: { id: true, nome: true, telefone: true },
      }),
    ]);
    for (const p of soltos) {
      const achados = [
        ...clientes
          .filter((c) => chaveTelefone(c.telefone!) === p.telefone)
          .map((c) => ({ nome: c.nome, userId: c.userId, origem: "Cliente (cadastro da loja)" })),
        ...usuarios
          .filter((u) => chaveTelefone(u.telefone!) === p.telefone)
          .map((u) => ({ nome: u.nome, userId: u.id, origem: "Conta do site (telefone não verificado)" })),
      ];
      if (achados.length) pistas.set(p.id, achados);
    }
  }

  const { faixas, total } = atribuirFaixas(s.participantes);
  const contagem = (pid: string, c: string) =>
    porParticipante.find((x) => x.participanteId === pid && x.classificacao === c)?._count ?? 0;
  const verifPendentes = new Set(verificacoes.map((v) => v.telefone));

  return {
    ...s,
    participantes: s.participantes.map((p) => ({
      ...p,
      faixa: (p.bilheteInicio != null ? { inicio: p.bilheteInicio, fim: p.bilheteFim! } : faixas.get(p.id)) ?? null,
      lancesValidos: contagem(p.id, "VALIDO"),
      lancesInvalidos: contagem(p.id, "INVALIDO"),
      lancesRevisar: contagem(p.id, "REVISAR"),
      pistas: pistas.get(p.id) ?? [],
      verificacaoPendente: !!p.telefone && verifPendentes.has(p.telefone),
      nomePublico: nomePublicoParticipante(p),
    })),
    totalCalculado: total,
    lances: lances.map((l) => ({ ...l, valor: l.valor == null ? null : Number(l.valor) })),
    eventos,
    indicadores: indicadores(s.participantes, s.totalBilhetes),
  };
}

export type SorteioAdmin = NonNullable<Awaited<ReturnType<typeof getSorteioAdmin>>>;

export async function listVerificacoesPendentes() {
  const vs = await prisma.verificacaoTelefone.findMany({
    where: { status: "PENDENTE", expiraEm: { gt: new Date() } },
    orderBy: { criadoEm: "asc" },
    include: { user: { select: { nome: true, email: true } } },
  });
  // Mostra quantos créditos estão esperando este número, para priorizar.
  const creditos = await prisma.participanteSorteio.groupBy({
    by: ["telefone"],
    where: { telefone: { in: vs.map((v) => v.telefone) }, userId: null },
    _sum: { chances: true },
  });
  // O código nunca sai daqui: a equipe digita o que recebeu no WhatsApp.
  return vs.map((v) => ({
    id: v.id,
    telefone: v.telefone,
    tentativas: v.tentativas,
    criadoEm: v.criadoEm,
    user: v.user,
    creditosEsperando: creditos.find((c) => c.telefone === v.telefone)?._sum.chances ?? 0,
  }));
}

export async function contarVerificacoesPendentes() {
  return prisma.verificacaoTelefone.count({
    where: { status: "PENDENTE", expiraEm: { gt: new Date() } },
  });
}

/** Contas para o vínculo manual (busca por nome/e-mail). */
export async function buscarContas(q: string) {
  const t = q.trim();
  if (t.length < 2) return [];
  return prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      OR: [{ nome: { contains: t, mode: "insensitive" } }, { email: { contains: t, mode: "insensitive" } }],
    },
    select: { id: true, nome: true, email: true },
    take: 10,
  });
}

// ── Cliente ──────────────────────────────────────────────────────────────────

export async function getMeusSorteios(userId: string) {
  const minhas = await prisma.participanteSorteio.findMany({
    where: { userId, sorteio: { status: { not: "CANCELADO" } } },
    include: {
      sorteio: true,
      lances: {
        where: { classificacao: "VALIDO" },
        orderBy: [{ loteId: "asc" }, { sequencia: "asc" }],
        select: { id: true, loteRotulo: true, loteId: true, valor: true, horario: true, tipo: true },
      },
    },
    orderBy: { sorteio: { criadoEm: "desc" } },
  });

  // Numeração provisória: precisa da lista inteira do sorteio, mas só devolve
  // a faixa DESTE cliente e o total.
  const ids = [...new Set(minhas.map((m) => m.sorteioId))];
  const listas = await prisma.participanteSorteio.findMany({
    where: { sorteioId: { in: ids } },
    select: { id: true, sorteioId: true, ordem: true, chances: true },
  });

  return minhas.map((m) => {
    const s = m.sorteio;
    let faixa: Faixa | null;
    let total: number;
    const provisoria = s.status === "CONFERENCIA";
    if (!provisoria && m.bilheteInicio != null) {
      faixa = { inicio: m.bilheteInicio, fim: m.bilheteFim! };
      total = s.totalBilhetes ?? 0;
    } else {
      const r = atribuirFaixas(listas.filter((l) => l.sorteioId === s.id));
      faixa = r.faixas.get(m.id) ?? null;
      total = r.total;
    }
    const venceu = s.status === "REALIZADO" && s.participanteVencedorId === m.id;
    return {
      participanteId: m.id,
      chances: m.chances,
      faixa,
      total,
      provisoria,
      avisoNovo: m.avisoVistoEm == null,
      venceu,
      lances: m.lances.map((l) => ({ ...l, valor: l.valor == null ? null : Number(l.valor) })),
      sorteio: {
        id: s.id,
        slug: s.slug,
        nome: s.nome,
        premio: s.premio,
        imagemUrl: s.imagemUrl,
        dataEvento: s.dataEvento,
        dataSorteio: s.dataSorteio,
        status: s.status,
        transmissaoUrl: s.transmissaoUrl,
        publico: s.publico,
        bilheteVencedor: s.status === "REALIZADO" ? s.bilheteVencedor : null,
        vencedorPublico: s.status === "REALIZADO" ? s.vencedorPublico : null,
      },
    };
  });
}

export type MeuSorteio = Awaited<ReturnType<typeof getMeusSorteios>>[number];

export async function getTelefonesDoUsuario(userId: string) {
  const [verificados, pendentes] = await Promise.all([
    prisma.telefoneVerificado.findMany({ where: { userId }, orderBy: { verificadoEm: "asc" } }),
    prisma.verificacaoTelefone.findMany({
      where: { userId, status: "PENDENTE", expiraEm: { gt: new Date() } },
      orderBy: { criadoEm: "desc" },
    }),
  ]);
  return {
    verificados: verificados.map((v) => ({ telefone: v.telefone, verificadoEm: v.verificadoEm })),
    pendentes: pendentes.map((v) => {
      let codigo: string | null = null;
      try {
        codigo = codigoDaVerificacao(v);
      } catch {
        codigo = null; // AUTH_SECRET trocado: o cliente gera outro
      }
      return { id: v.id, telefone: v.telefone, codigo, expiraEm: v.expiraEm };
    }),
  };
}

// ── Público ──────────────────────────────────────────────────────────────────

const CAMPOS_PUBLICOS = {
  id: true,
  slug: true,
  nome: true,
  organizador: true,
  eventoOrigem: true,
  dataEvento: true,
  premio: true,
  descricao: true,
  regras: true,
  imagemUrl: true,
  transmissaoUrl: true,
  dataSorteio: true,
  status: true,
  totalBilhetes: true,
  hashLista: true,
  homologadoEm: true,
  modoSorteio: true,
  concursoLoteria: true,
  premiosLoteria: true,
  realizadoEm: true,
  bilheteVencedor: true,
  vencedorPublico: true,
  metodoSorteio: true,
} as const;

export async function listSorteiosPublicos() {
  return prisma.sorteio.findMany({
    where: { publico: true, status: { not: "CANCELADO" } },
    orderBy: [{ dataSorteio: "desc" }, { criadoEm: "desc" }],
    select: CAMPOS_PUBLICOS,
  });
}

export async function getSorteioPublico(slug: string) {
  return prisma.sorteio.findFirst({
    where: { slug, publico: true, status: { not: "CANCELADO" } },
    select: CAMPOS_PUBLICOS,
  });
}

export async function existeSorteioPublico(): Promise<boolean> {
  try {
    return (await prisma.sorteio.count({ where: { publico: true, status: { not: "CANCELADO" } } })) > 0;
  } catch {
    return false;
  }
}

/**
 * O que a roleta precisa: as fatias (faixas com rótulo público) e, se já
 * houver, o resultado. Nada de telefone completo nem e-mail.
 */
export async function getDadosRoleta(sorteioId: string) {
  const s = await prisma.sorteio.findUnique({
    where: { id: sorteioId },
    include: {
      participantes: { include: { user: { select: { nome: true } } } },
    },
  });
  if (!s) return null;

  let fatias: { inicio: number; fim: number; rotulo: string }[];
  let total: number;
  if (s.listaCongelada) {
    const linhas = lerListaCanonica(s.listaCongelada);
    total = s.totalBilhetes ?? 0;
    fatias = linhas.map((l) => {
      const p = s.participantes.find((x) => x.id === l.participanteId);
      return { inicio: l.inicio, fim: l.fim, rotulo: p ? nomePublicoParticipante(p) : "Participante" };
    });
  } else {
    const r = atribuirFaixas(s.participantes);
    total = r.total;
    fatias = s.participantes
      .filter((p) => r.faixas.get(p.id))
      .map((p) => ({ ...r.faixas.get(p.id)!, rotulo: nomePublicoParticipante(p) }))
      .sort((a, b) => a.inicio - b.inicio);
  }

  return {
    id: s.id,
    slug: s.slug,
    nome: s.nome,
    premio: s.premio,
    imagemUrl: s.imagemUrl,
    status: s.status,
    modoSorteio: s.modoSorteio,
    concursoLoteria: s.concursoLoteria,
    hashLista: s.hashLista,
    publico: s.publico,
    total,
    fatias,
    resultado:
      s.status === "REALIZADO" && s.bilheteVencedor
        ? { bilhete: s.bilheteVencedor, vencedorPublico: s.vencedorPublico ?? "", realizadoEm: s.realizadoEm?.toISOString() ?? null }
        : null,
  };
}

export type DadosRoleta = NonNullable<Awaited<ReturnType<typeof getDadosRoleta>>>;
