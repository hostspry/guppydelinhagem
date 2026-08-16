import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * IP e geolocalização do visitante.
 *
 * Regra de privacidade combinada: quem ACEITOU os cookies tem o IP guardado
 * inteiro e a cidade/provedor consultados; quem RECUSOU (ou nem respondeu) tem o
 * último bloco do IP trocado por "xxx" e nenhuma consulta externa — o IP dessa
 * pessoa não sai do servidor.
 */

/** 191.240.12.87 → 191.240.12.xxx (IPv6: mantém só o prefixo de rede). */
export function mascararIp(ip: string): string {
  if (ip.includes(":")) {
    const partes = ip.split(":");
    return `${partes.slice(0, 3).join(":")}:xxxx`;
  }
  const partes = ip.split(".");
  if (partes.length !== 4) return "xxx";
  return `${partes.slice(0, 3).join(".")}.xxx`;
}

export type Geo = {
  cidade: string | null;
  regiao: string | null;
  pais: string | null;
  provedor: string | null;
};

const VAZIO: Geo = { cidade: null, regiao: null, pais: null, provedor: null };

/** IP que não faz sentido consultar (rede local, loopback, desconhecido). */
function ehPrivado(ip: string): boolean {
  return (
    ip === "unknown" ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

// Uma semana: provedor e cidade de um IP residencial mudam pouco, e reconsultar
// a cada visita gastaria a cota da API à toa.
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

type RespostaIpWho = {
  success?: boolean;
  city?: string;
  region?: string;
  country?: string;
  connection?: { isp?: string; org?: string };
};

/**
 * Resolve o IP em cidade/provedor, com cache no banco.
 *
 * Nunca lança: geolocalização é enfeite, não pode derrubar o registro do evento.
 * Falha vira uma linha marcada com `falhou`, que também serve de cache negativo
 * (não adianta martelar um IP que o serviço não conhece).
 */
export async function resolverGeo(ip: string): Promise<Geo> {
  if (ehPrivado(ip)) return VAZIO;

  try {
    const cache = await prisma.geoIp.findUnique({ where: { ip } });
    if (cache && Date.now() - cache.consultadoEm.getTime() < VALIDADE_MS) {
      return {
        cidade: cache.cidade,
        regiao: cache.regiao,
        pais: cache.pais,
        provedor: cache.provedor,
      };
    }

    const res = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country,connection`,
      { signal: AbortSignal.timeout(4000) },
    );

    if (!res.ok) throw new Error(`ipwho.is ${res.status}`);
    const dados = (await res.json()) as RespostaIpWho;
    if (dados.success === false) throw new Error("ip não resolvido");

    const geo: Geo = {
      cidade: dados.city ?? null,
      regiao: dados.region ?? null,
      pais: dados.country ?? null,
      provedor: dados.connection?.isp ?? dados.connection?.org ?? null,
    };

    await prisma.geoIp.upsert({
      where: { ip },
      create: { ip, ...geo, falhou: false },
      update: { ...geo, falhou: false, consultadoEm: new Date() },
    });

    return geo;
  } catch (e) {
    console.error("[geo] falhou para", ip, e instanceof Error ? e.message : e);
    await prisma.geoIp
      .upsert({
        where: { ip },
        create: { ip, falhou: true },
        update: { falhou: true, consultadoEm: new Date() },
      })
      .catch(() => {});
    return VAZIO;
  }
}
