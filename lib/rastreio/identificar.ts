import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { COOKIE_VISITANTE } from "./servidor";
import { EVENTOS, EVENTOS_IMPORTANTES } from "./eventos";

/**
 * Liga a navegação anônima à pessoa, quando a gente descobre quem ela é.
 *
 * Até aqui o rastreio guardava 1.444 histórias sem dono. Elas não viravam nada:
 * não dá para escrever para um cookie, nem para dizer "esse cliente olhou Full
 * Red três vezes e não comprou" sem saber que aquele visitante é ele.
 *
 * Os três momentos em que a identidade aparece sozinha, sem perguntar nada a
 * mais para o cliente:
 *
 *   pedido    — fechou a compra e deu nome, e-mail e CPF;
 *   cadastro  — preencheu o link /meus-dados depois da venda no WhatsApp;
 *   login     — entrou na conta (já existia, via userId).
 *
 * Nada aqui lança: identificação é enfeite em cima de uma venda que já
 * aconteceu. Se falhar, a venda continua de pé e o painel só não mostra o
 * histórico ligado.
 */

export type OrigemIdentificacao = "pedido" | "cadastro" | "login";

/**
 * Marca o visitante do navegador atual como sendo deste cliente.
 *
 * Só preenche o que está vazio: um visitante já ligado a outro cliente não é
 * roubado. Isso acontece de verdade no computador de casa que a família toda
 * usa, e trocar o dono a cada compra faria o histórico do primeiro sumir.
 */
export async function identificarVisitante(
  clienteId: string,
  origem: OrigemIdentificacao,
): Promise<void> {
  try {
    const jar = await cookies();
    const visitanteId = jar.get(COOKIE_VISITANTE)?.value;
    if (!visitanteId) return; // sem rastreio (bot, navegador travado, primeira visita)

    const r = await prisma.visitante.updateMany({
      where: { id: visitanteId, clienteId: null },
      data: {
        clienteId,
        identificadoEm: new Date(),
        identificadoPor: origem,
      },
    });
    if (r.count === 0) return;

    // O cliente pode já ter uma conta de acesso. Aproveita para amarrar o
    // visitante a ela também, o que faz o login futuro em outro aparelho cair
    // no mesmo lugar.
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { userId: true },
    });
    if (cliente?.userId) {
      await prisma.visitante.updateMany({
        where: { id: visitanteId, userId: null },
        data: { userId: cliente.userId },
      });
    }
  } catch (e) {
    console.error("[rastreio] identificar visitante", e);
  }
}

export type HistoricoVisitante = {
  visitantes: number;
  sessoes: number;
  primeiroAcesso: Date | null;
  ultimoAcesso: Date | null;
  identificadoPor: string | null;
  /** Aparelhos por onde essa pessoa entrou. */
  aparelhos: string[];
  /** O que ela olhou, do mais visto para o menos. */
  produtos: { produtoId: string; nome: string; vezes: number; ultimaVez: Date }[];
  /** O que ela digitou na busca. */
  buscas: { termo: string; vezes: number }[];
  /** Últimos passos, para a linha do tempo. */
  ultimosEventos: { tipo: string; ocorridoEm: Date; detalhe: string | null }[];
};

/**
 * Todo o comportamento conhecido de um cliente, juntando os aparelhos dele.
 *
 * É isto que transforma rastreio em ferramenta de venda: saber que o cliente
 * abriu a página do Full Red quatro vezes esta semana e não comprou vale mais
 * que qualquer campanha para "todos".
 */
export async function historicoDoCliente(
  clienteId: string,
): Promise<HistoricoVisitante | null> {
  const visitantes = await prisma.visitante.findMany({
    where: { clienteId },
    select: {
      id: true,
      primeiroAcesso: true,
      ultimoAcesso: true,
      totalSessoes: true,
      identificadoPor: true,
    },
  });
  if (visitantes.length === 0) return null;

  const ids = visitantes.map((v) => v.id);

  const [produtos, buscas, eventos, aparelhos] = await Promise.all([
    prisma.eventoVisitante.groupBy({
      by: ["produtoId", "produtoNome"],
      where: { visitanteId: { in: ids }, tipo: "produto_visto", produtoId: { not: null } },
      _count: { _all: true },
      _max: { ocorridoEm: true },
    }),
    prisma.eventoVisitante.groupBy({
      by: ["busca"],
      where: { visitanteId: { in: ids }, tipo: "busca", busca: { not: null } },
      _count: { _all: true },
    }),
    // Só os passos que contam. Abrir a página de um peixe dispara dois eventos
    // (página vista + produto visto), então a linha do tempo sem filtro repetia
    // cada produto duas vezes e enterrava carrinho e checkout no meio.
    // EVENTOS_IMPORTANTES existe no projeto para isso; a busca entra junto aqui
    // porque nesta loja ela é o sinal mais direto do que a pessoa quer.
    prisma.eventoVisitante.findMany({
      where: {
        visitanteId: { in: ids },
        tipo: { in: [...EVENTOS_IMPORTANTES, EVENTOS.BUSCA] },
      },
      orderBy: { ocorridoEm: "desc" },
      take: 20,
      select: { tipo: true, ocorridoEm: true, produtoNome: true, busca: true, url: true },
    }),
    prisma.sessaoVisita.findMany({
      where: { visitanteId: { in: ids }, dispositivo: { not: null } },
      distinct: ["dispositivo"],
      select: { dispositivo: true },
    }),
  ]);

  return {
    visitantes: visitantes.length,
    sessoes: visitantes.reduce((s, v) => s + v.totalSessoes, 0),
    primeiroAcesso: visitantes
      .map((v) => v.primeiroAcesso)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
    ultimoAcesso: visitantes
      .map((v) => v.ultimoAcesso)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
    identificadoPor: visitantes.find((v) => v.identificadoPor)?.identificadoPor ?? null,
    aparelhos: aparelhos.map((a) => a.dispositivo as string),
    produtos: produtos
      .filter((p): p is typeof p & { produtoId: string } => p.produtoId !== null)
      .map((p) => ({
        produtoId: p.produtoId,
        nome: p.produtoNome ?? "produto removido",
        vezes: p._count._all,
        ultimaVez: p._max.ocorridoEm ?? new Date(0),
      }))
      .sort((a, b) => b.vezes - a.vezes)
      .slice(0, 8),
    buscas: buscas
      .map((b) => ({ termo: (b.busca ?? "").trim(), vezes: b._count._all }))
      .filter((b) => b.termo.length > 0)
      .sort((a, b) => b.vezes - a.vezes)
      .slice(0, 8),
    ultimosEventos: eventos.map((e) => ({
      tipo: e.tipo,
      ocorridoEm: e.ocorridoEm,
      detalhe: e.produtoNome ?? e.busca ?? e.url ?? null,
    })),
  };
}
