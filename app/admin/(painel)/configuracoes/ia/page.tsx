import { prisma } from "@/lib/prisma";
import { ConfigIa } from "@/components/admin/ConfigIa";
import { FUSO } from "@/lib/rastreio/periodo";

export const dynamic = "force-dynamic";

/** Nome do que gastou, na língua do painel. */
const FUNCAO: Record<string, string> = {
  "ml.titulos": "Títulos do Mercado Livre",
  "ml.descricao": "Descrições do Mercado Livre",
  "ml.revisao.titulo": "Revisão de título",
  "ml.revisao.descricao": "Revisão de descrição",
  "produto.conteudo": "Conteúdo de produto",
  "produto.conteudo.pesquisa": "Conteúdo de produto (com pesquisa)",
  comprovante: "Leitura de comprovante",
};

/** Primeiro dia do mês corrente em São Paulo, como instante UTC. */
function inicioDoMes(agora = new Date()): Date {
  const [a, m] = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO })
    .format(agora)
    .split("-")
    .map(Number);
  // 03:00 UTC = meia-noite em São Paulo (sem horário de verão desde 2019).
  return new Date(Date.UTC(a, m - 1, 1, 3));
}

export default async function ConfiguracaoIaPage() {
  const cfg = await prisma.configuracaoIa.findUnique({ where: { id: "default" } });
  const mes = inicioDoMes();

  const [doMes, porFuncao, desdeSaldo, ultimas] = await Promise.all([
    prisma.usoIa.aggregate({
      where: { criadoEm: { gte: mes } },
      _sum: { custoUsd: true },
      _count: true,
    }),
    prisma.usoIa.groupBy({
      by: ["funcao"],
      where: { criadoEm: { gte: mes } },
      _sum: { custoUsd: true },
      _count: true,
    }),
    cfg?.saldoInformadoEm
      ? prisma.usoIa.aggregate({
          where: { criadoEm: { gte: cfg.saldoInformadoEm } },
          _sum: { custoUsd: true },
        })
      : Promise.resolve(null),
    prisma.usoIa.findMany({
      orderBy: { criadoEm: "desc" },
      take: 10,
      select: { funcao: true, custoUsd: true, criadoEm: true, tokensEntrada: true, tokensSaida: true },
    }),
  ]);

  const saldoInformado = cfg?.saldoUsd != null ? Number(cfg.saldoUsd) : null;
  const gastoDesde = Number(desdeSaldo?._sum.custoUsd ?? 0);

  return (
    <ConfigIa
      chaveConfigurada={!!process.env.GEMINI_API_KEY}
      saldoInformado={saldoInformado}
      saldoInformadoEm={cfg?.saldoInformadoEm ?? null}
      saldoEstimado={saldoInformado !== null ? saldoInformado - gastoDesde : null}
      alertaUsd={cfg?.alertaUsd != null ? Number(cfg.alertaUsd) : null}
      semCreditoEm={cfg?.semCreditoEm ?? null}
      mes={{
        gastoUsd: Number(doMes._sum.custoUsd ?? 0),
        chamadas: doMes._count,
        porFuncao: porFuncao
          .map((f) => ({
            nome: FUNCAO[f.funcao] ?? f.funcao,
            chamadas: f._count,
            gastoUsd: Number(f._sum.custoUsd ?? 0),
          }))
          .sort((a, b) => b.gastoUsd - a.gastoUsd),
      }}
      ultimas={ultimas.map((u) => ({
        nome: FUNCAO[u.funcao] ?? u.funcao,
        gastoUsd: Number(u.custoUsd),
        em: u.criadoEm,
        tokens: u.tokensEntrada + u.tokensSaida,
      }))}
    />
  );
}
