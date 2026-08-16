import { prisma } from "@/lib/prisma";

export type VisitanteItem = {
  id: string;
  clienteNome: string | null;
  clienteEmail: string | null;
  primeiroAcesso: Date;
  ultimoAcesso: Date;
  totalSessoes: number;
  totalEventos: number;
  ultimaCidade: string | null;
  ultimoProvedor: string | null;
  ultimoIp: string | null;
  ultimoDispositivo: string | null;
  comprou: boolean;
};

export async function listarVisitantes(pagina = 1): Promise<{
  itens: VisitanteItem[];
  total: number;
  paginas: number;
}> {
  const porPagina = 40;
  const [linhas, total] = await Promise.all([
    prisma.visitante.findMany({
      orderBy: { ultimoAcesso: "desc" },
      take: porPagina,
      skip: (pagina - 1) * porPagina,
      select: {
        id: true,
        primeiroAcesso: true,
        ultimoAcesso: true,
        totalSessoes: true,
        totalEventos: true,
        user: { select: { nome: true, email: true } },
        sessoes: {
          orderBy: { iniciadaEm: "desc" },
          take: 1,
          select: {
            cidade: true,
            regiao: true,
            provedor: true,
            ip: true,
            dispositivo: true,
          },
        },
        eventos: {
          where: { tipo: "pedido_criado" },
          take: 1,
          select: { id: true },
        },
      },
    }),
    prisma.visitante.count(),
  ]);

  return {
    itens: linhas.map((v) => {
      const s = v.sessoes[0];
      return {
        id: v.id,
        clienteNome: v.user?.nome ?? null,
        clienteEmail: v.user?.email ?? null,
        primeiroAcesso: v.primeiroAcesso,
        ultimoAcesso: v.ultimoAcesso,
        totalSessoes: v.totalSessoes,
        totalEventos: v.totalEventos,
        ultimaCidade: s?.cidade ? `${s.cidade}${s.regiao ? `/${s.regiao}` : ""}` : null,
        ultimoProvedor: s?.provedor ?? null,
        ultimoIp: s?.ip ?? null,
        ultimoDispositivo: s?.dispositivo ?? null,
        comprou: v.eventos.length > 0,
      };
    }),
    total,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

export type SessaoDetalhe = {
  id: string;
  iniciadaEm: Date;
  ultimaAtividade: Date;
  ip: string | null;
  consentimento: boolean;
  cidade: string | null;
  regiao: string | null;
  pais: string | null;
  provedor: string | null;
  dispositivo: string | null;
  navegador: string | null;
  sistema: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  eventos: {
    id: string;
    tipo: string;
    ocorridoEm: Date;
    url: string | null;
    produtoId: string | null;
    produtoNome: string | null;
    quantidade: number | null;
    valor: number | null;
    busca: string | null;
  }[];
};

export async function getVisitante(id: string): Promise<{
  visitante: VisitanteItem;
  sessoes: SessaoDetalhe[];
} | null> {
  const v = await prisma.visitante.findUnique({
    where: { id },
    select: {
      id: true,
      primeiroAcesso: true,
      ultimoAcesso: true,
      totalSessoes: true,
      totalEventos: true,
      user: { select: { nome: true, email: true } },
      sessoes: {
        orderBy: { iniciadaEm: "desc" },
        take: 50,
        select: {
          id: true,
          iniciadaEm: true,
          ultimaAtividade: true,
          ip: true,
          consentimento: true,
          cidade: true,
          regiao: true,
          pais: true,
          provedor: true,
          dispositivo: true,
          navegador: true,
          sistema: true,
          referrer: true,
          utmSource: true,
          utmCampaign: true,
          eventos: {
            orderBy: { ocorridoEm: "asc" },
            take: 300,
            select: {
              id: true,
              tipo: true,
              ocorridoEm: true,
              url: true,
              produtoId: true,
              produtoNome: true,
              quantidade: true,
              valor: true,
              busca: true,
            },
          },
        },
      },
      eventos: { where: { tipo: "pedido_criado" }, take: 1, select: { id: true } },
    },
  });
  if (!v) return null;

  const ultima = v.sessoes[0];
  return {
    visitante: {
      id: v.id,
      clienteNome: v.user?.nome ?? null,
      clienteEmail: v.user?.email ?? null,
      primeiroAcesso: v.primeiroAcesso,
      ultimoAcesso: v.ultimoAcesso,
      totalSessoes: v.totalSessoes,
      totalEventos: v.totalEventos,
      ultimaCidade: ultima?.cidade
        ? `${ultima.cidade}${ultima.regiao ? `/${ultima.regiao}` : ""}`
        : null,
      ultimoProvedor: ultima?.provedor ?? null,
      ultimoIp: ultima?.ip ?? null,
      ultimoDispositivo: ultima?.dispositivo ?? null,
      comprou: v.eventos.length > 0,
    },
    sessoes: v.sessoes.map((s) => ({
      ...s,
      eventos: s.eventos.map((e) => ({
        ...e,
        valor: e.valor == null ? null : Number(e.valor),
      })),
    })),
  };
}

/** Ranking de peixes mais olhados e o que virou carrinho. */
export async function produtosMaisVistos(dias = 30): Promise<
  { produtoId: string; nome: string; vistas: number; carrinho: number }[]
> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const [vistas, carrinho] = await Promise.all([
    prisma.eventoVisitante.groupBy({
      by: ["produtoId", "produtoNome"],
      where: { tipo: "produto_visto", produtoId: { not: null }, ocorridoEm: { gte: desde } },
      _count: { _all: true },
    }),
    prisma.eventoVisitante.groupBy({
      by: ["produtoId"],
      where: { tipo: "carrinho_add", produtoId: { not: null }, ocorridoEm: { gte: desde } },
      _count: { _all: true },
    }),
  ]);

  const noCarrinho = new Map(carrinho.map((c) => [c.produtoId, c._count._all]));

  return vistas
    .filter((v): v is typeof v & { produtoId: string } => v.produtoId !== null)
    .map((v) => ({
      produtoId: v.produtoId,
      nome: v.produtoNome ?? "produto removido",
      vistas: v._count._all,
      carrinho: noCarrinho.get(v.produtoId) ?? 0,
    }))
    .sort((a, b) => b.vistas - a.vistas)
    .slice(0, 15);
}

export type ResumoRastreio = {
  visitantes: number;
  sessoes7d: number;
  eventos: number;
  registroMaisAntigo: Date | null;
  temMaisDe90Dias: number;
};

export async function resumoRastreio(): Promise<ResumoRastreio> {
  const corte90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const semana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [visitantes, sessoes7d, eventos, antigo, temMaisDe90Dias] = await Promise.all([
    prisma.visitante.count(),
    prisma.sessaoVisita.count({ where: { iniciadaEm: { gte: semana } } }),
    prisma.eventoVisitante.count(),
    prisma.eventoVisitante.findFirst({
      orderBy: { ocorridoEm: "asc" },
      select: { ocorridoEm: true },
    }),
    prisma.eventoVisitante.count({ where: { ocorridoEm: { lt: corte90 } } }),
  ]);

  return {
    visitantes,
    sessoes7d,
    eventos,
    registroMaisAntigo: antigo?.ocorridoEm ?? null,
    temMaisDe90Dias,
  };
}
