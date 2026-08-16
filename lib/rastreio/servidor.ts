import "server-only";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";
import { mascararIp, resolverGeo } from "./ip";

/**
 * Núcleo do rastreio: identifica o visitante, mantém a sessão e grava o evento.
 *
 * Uma SESSÃO é uma visita: eventos do mesmo visitante caem na mesma sessão
 * enquanto ele não ficar mais de 30 minutos parado. Passou disso, é uma visita
 * nova — é o mesmo corte que as ferramentas de analytics usam, e é o que faz a
 * jornada ("olhou 3 peixes, colocou 1 no carrinho, saiu") fazer sentido.
 */

export const COOKIE_VISITANTE = "gdl_vid";
export const JANELA_SESSAO_MS = 30 * 60 * 1000;
export const VALIDADE_COOKIE_S = 365 * 24 * 60 * 60;

/** Aparelho e navegador a partir do user-agent. Aproximação honesta, sem lib. */
export function lerDispositivo(ua: string): {
  dispositivo: string;
  navegador: string;
  sistema: string;
} {
  const u = ua.toLowerCase();

  const dispositivo = /ipad|tablet/.test(u)
    ? "tablet"
    : /mobi|android|iphone/.test(u)
      ? "celular"
      : "computador";

  // Ordem importa: Edge e Opera se declaram Chrome; Chrome se declara Safari.
  const navegador = /edg\//.test(u)
    ? "Edge"
    : /opr\/|opera/.test(u)
      ? "Opera"
      : /firefox/.test(u)
        ? "Firefox"
        : /chrome|crios/.test(u)
          ? "Chrome"
          : /safari/.test(u)
            ? "Safari"
            : "outro";

  const sistema = /android/.test(u)
    ? "Android"
    : /iphone|ipad|ios/.test(u)
      ? "iOS"
      : /windows/.test(u)
        ? "Windows"
        : /mac os|macintosh/.test(u)
          ? "macOS"
          : /linux/.test(u)
            ? "Linux"
            : "outro";

  return { dispositivo, navegador, sistema };
}

export type ContextoRastreio = {
  visitanteId: string | null;
  consentimento: boolean;
  headers: Headers;
  userId?: string | null;
  /** Só na primeira página da visita. */
  referrer?: string | null;
  url?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
};

export type EventoParaRegistrar = {
  tipo: string;
  url?: string | null;
  titulo?: string | null;
  produtoId?: string | null;
  produtoNome?: string | null;
  variantId?: string | null;
  composicao?: string | null;
  quantidade?: number | null;
  valor?: number | null;
  busca?: string | null;
  meta?: Record<string, unknown> | null;
};

/**
 * Garante visitante + sessão e grava o evento. Devolve o id do visitante para
 * quem chamou gravar no cookie.
 *
 * Nunca lança: rastreio não pode quebrar navegação. Erro vai para o console.
 */
export async function registrarEvento(
  ctx: ContextoRastreio,
  evento: EventoParaRegistrar,
): Promise<{ visitanteId: string } | null> {
  try {
    const ipReal = clientIp(ctx.headers);
    const ipGuardado = ctx.consentimento ? ipReal : mascararIp(ipReal);
    const ua = ctx.headers.get("user-agent") ?? "";

    // Visitante: reaproveita o do cookie, se ele existir de verdade no banco.
    let visitanteId = ctx.visitanteId;
    if (visitanteId) {
      const existe = await prisma.visitante.findUnique({
        where: { id: visitanteId },
        select: { id: true },
      });
      if (!existe) visitanteId = null;
    }
    if (!visitanteId) {
      const novo = await prisma.visitante.create({
        data: { userId: ctx.userId ?? null },
        select: { id: true },
      });
      visitanteId = novo.id;
    } else if (ctx.userId) {
      // Logou: amarra as visitas anônimas anteriores à conta.
      await prisma.visitante.updateMany({
        where: { id: visitanteId, userId: null },
        data: { userId: ctx.userId },
      });
    }

    // Sessão aberta = última atividade dentro da janela.
    const corte = new Date(Date.now() - JANELA_SESSAO_MS);
    const aberta = await prisma.sessaoVisita.findFirst({
      where: { visitanteId, ultimaAtividade: { gte: corte } },
      orderBy: { ultimaAtividade: "desc" },
      select: { id: true, consentimento: true },
    });

    let sessaoId: string;
    if (aberta) {
      sessaoId = aberta.id;

      // O banner aparece DEPOIS da primeira página, então a sessão nasce sem
      // consentimento e o aceite chega no evento seguinte. Quando isso acontece,
      // a visita é promovida: passa a guardar o IP inteiro e ganha a
      // geolocalização. O caminho contrário não existe — ninguém "desaceita" no
      // meio da visita, e mesmo que desaceitasse não daria para desver o IP.
      const promoveu = ctx.consentimento && !aberta.consentimento;
      const geo = promoveu
        ? await resolverGeo(ipReal)
        : { cidade: null, regiao: null, pais: null, provedor: null };

      await prisma.sessaoVisita.update({
        where: { id: sessaoId },
        data: {
          ultimaAtividade: new Date(),
          ...(promoveu
            ? { consentimento: true, ip: ipReal, ...geo }
            : {}),
        },
      });
    } else {
      const { dispositivo, navegador, sistema } = lerDispositivo(ua);
      // Geolocalização só com consentimento — sem ele o IP não sai daqui.
      const geo = ctx.consentimento
        ? await resolverGeo(ipReal)
        : { cidade: null, regiao: null, pais: null, provedor: null };

      const nova = await prisma.sessaoVisita.create({
        data: {
          visitanteId,
          ip: ipGuardado,
          consentimento: ctx.consentimento,
          userAgent: ua.slice(0, 300),
          dispositivo,
          navegador,
          sistema,
          referrer: ctx.referrer?.slice(0, 500) ?? null,
          utmSource: ctx.utm?.source ?? null,
          utmMedium: ctx.utm?.medium ?? null,
          utmCampaign: ctx.utm?.campaign ?? null,
          paginaEntrada: (ctx.url ?? evento.url)?.slice(0, 500) ?? null,
          ...geo,
        },
        select: { id: true },
      });
      sessaoId = nova.id;
      await prisma.visitante.update({
        where: { id: visitanteId },
        data: { totalSessoes: { increment: 1 } },
      });
    }

    await prisma.eventoVisitante.create({
      data: {
        visitanteId,
        sessaoId,
        tipo: evento.tipo,
        url: evento.url?.slice(0, 500) ?? null,
        titulo: evento.titulo?.slice(0, 200) ?? null,
        produtoId: evento.produtoId ?? null,
        produtoNome: evento.produtoNome?.slice(0, 200) ?? null,
        variantId: evento.variantId ?? null,
        composicao: evento.composicao ?? null,
        quantidade: evento.quantidade ?? null,
        valor: evento.valor ?? null,
        busca: evento.busca?.slice(0, 200) ?? null,
        meta: (evento.meta ?? undefined) as never,
      },
    });

    await prisma.visitante.update({
      where: { id: visitanteId },
      data: { ultimoAcesso: new Date(), totalEventos: { increment: 1 } },
    });

    return { visitanteId };
  } catch (e) {
    console.error("[rastreio] falhou", evento.tipo, e);
    return null;
  }
}
