import "server-only";
import { prisma } from "@/lib/prisma";
import { coordenadaDaCidade, distanciaKm, normalizarCidade } from "@/lib/geo/municipios";
import { REMETENTE_GOLLOG } from "./remetente";

/**
 * Unidades da Gollog: a fonte de verdade é a própria Gollog.
 *
 * - A LISTA vem do cadastro oficial de unidades (o mesmo JSON que alimenta a
 *   página "Lojas GOLLOG" do site deles) e é copiada para o banco.
 * - A DISTÂNCIA vem do cálculo da Gollog pelo CEP do cliente (o mesmo que o
 *   app de cotação deles usa). Só se a Gollog não responder é que a distância
 *   sai estimada, pelo centro da cidade do cliente.
 *
 * Os dois endereços são internos da Gollog, sem documentação: podem mudar sem
 * aviso. Por isso a lista fica guardada e o site nunca depende da Gollog estar
 * no ar para abrir a página.
 */

const URL_UNIDADES = "https://channelcfg-api.voegol.com.br/ApplicationList/UnidadesGolLog";
const URL_PERTO = "https://servicos.gollog.com.br/api/services/app/ServiceNetwork/GetNearbyUnits";

/** Unidades para onde a loja não envia. Só vale quando a unidade entra no banco; depois quem manda é o painel. */
const DESLIGADAS_AO_CRIAR = new Set(["BEL"]);

/** Até esta distância a unidade conta como "da cidade" do cliente (bairros e cidades coladas). */
const KM_MESMA_CIDADE = 15;

const DIA_MS = 24 * 60 * 60 * 1000;

type UnidadeOficial = {
  Title: string;
  Endereco?: string;
  CEP?: string;
  Telefone?: string;
  HorarioFuncionamento?: string;
  latitude?: string;
  longitude?: string;
  Email?: string;
  PaisLookupValue?: string;
  SiglaEstado?: string;
  CidadeLookupValue?: string;
  TipoDeServico?: string;
};

const limpa = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();
const num = (s: string | undefined) => {
  const n = Number(s);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

/** "Av X,10 - Bairro:Y - Complemento:N/A - CEP:00000-000" → "Av X, 10, Y, CEP 00000-000". */
function enderecoLegivel(bruto: string): string {
  return limpa(bruto)
    .replace(/\s*-\s*Complemento:\s*N\/A/gi, "")
    .replace(/\s*-\s*Bairro:\s*/gi, ", ")
    .replace(/\s*-\s*Complemento:\s*/gi, ", ")
    .replace(/\s*-\s*CEP:\s*/gi, ", CEP ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*N\/A\b/gi, "");
}

export type ResultadoSincronizacao =
  | { ok: true; total: number; novas: number; removidas: number }
  | { ok: false; error: string };

/** Copia a lista oficial para o banco. Unidade que sumiu da Gollog fica marcada, não é apagada. */
export async function sincronizarUnidadesGollog(): Promise<ResultadoSincronizacao> {
  let lista: UnidadeOficial[];
  try {
    const res = await fetch(URL_UNIDADES, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `A Gollog respondeu ${res.status}.` };
    const json = (await res.json()) as { content?: UnidadeOficial[] };
    lista = (json.content ?? []).filter((u) => u.PaisLookupValue === "Brasil" && u.Title);
  } catch (e) {
    console.error("[gollog] sincronizar unidades", e);
    return { ok: false, error: "Não consegui falar com a Gollog agora." };
  }
  // Lista vazia ou quebrada não pode desligar todas as unidades do banco.
  if (lista.length < 30) return { ok: false, error: "A Gollog devolveu uma lista incompleta." };

  const agora = new Date();
  const existentes = new Set(
    (await prisma.unidadeGollog.findMany({ select: { titulo: true } })).map((u) => u.titulo),
  );
  let novas = 0;

  for (const u of lista) {
    const titulo = limpa(u.Title);
    const codigo = titulo.split("-")[0].trim().toUpperCase().slice(0, 3);
    const dados = {
      codigo,
      cidade: limpa(u.CidadeLookupValue),
      uf: limpa(u.SiglaEstado).toUpperCase().slice(0, 2),
      endereco: enderecoLegivel(u.Endereco ?? ""),
      cep: limpa(u.CEP) || null,
      telefone: limpa(u.Telefone) || null,
      horario: limpa(u.HorarioFuncionamento) || null,
      email: limpa(u.Email).replace(/^mailto:/i, "") || null,
      tipoServico: limpa(u.TipoDeServico).replace(/;#/g, ", ").replace(/^,\s*|,\s*$/g, "") || null,
      latitude: num(u.latitude),
      longitude: num(u.longitude),
      naListaGollog: true,
      sincronizadaEm: agora,
    };
    if (!existentes.has(titulo)) novas++;
    await prisma.unidadeGollog.upsert({
      where: { titulo },
      create: { titulo, ...dados, ativa: !DESLIGADAS_AO_CRIAR.has(codigo) },
      update: dados,
    });
  }

  const removidas = await prisma.unidadeGollog.updateMany({
    where: { sincronizadaEm: { lt: agora } },
    data: { naListaGollog: false },
  });

  return { ok: true, total: lista.length, novas, removidas: removidas.count };
}

/** Banco vazio: sincroniza já. Lista com mais de um dia: atualiza em segundo plano. */
export async function garantirUnidadesGollog(): Promise<void> {
  const maisNova = await prisma.unidadeGollog.findFirst({
    orderBy: { sincronizadaEm: "desc" },
    select: { sincronizadaEm: true },
  });
  if (!maisNova) {
    await sincronizarUnidadesGollog();
    return;
  }
  if (Date.now() - maisNova.sincronizadaEm.getTime() > DIA_MS) {
    void sincronizarUnidadesGollog();
  }
}

export type UnidadeParaCliente = {
  id: string;
  codigo: string;
  titulo: string;
  cidade: string;
  uf: string;
  endereco: string;
  horario: string | null;
  telefone: string | null;
  km: number | null;
  /** Fica na cidade do cliente (mesmo nome de cidade, ou a até 15 km). */
  naCidade: boolean;
};

export type UnidadesParaCliente = {
  unidades: UnidadeParaCliente[];
  /** "gollog" = distância calculada pela Gollog; "estimada" = centro da cidade. */
  fonteDistancia: "gollog" | "estimada" | "nenhuma";
};

/** Distâncias da Gollog para um CEP, por título da unidade. null se a Gollog não respondeu. */
async function distanciasGollog(cep: string): Promise<Map<string, number> | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`${URL_PERTO}?cep=${d}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: { distance?: number; unity?: { title?: string } }[];
    };
    const mapa = new Map<string, number>();
    for (const r of json.result ?? []) {
      const t = limpa(r.unity?.title);
      if (t && typeof r.distance === "number") mapa.set(t, r.distance);
    }
    return mapa.size ? mapa : null;
  } catch {
    return null;
  }
}

/**
 * Unidades que o cliente pode escolher, da mais perto para a mais longe.
 * Ficam de fora as desligadas pela loja, as que a Gollog tirou da lista e a
 * de origem (a caixa sai de lá).
 */
export async function unidadesParaCliente(destino: {
  cep?: string | null;
  cidade?: string | null;
  uf?: string | null;
}): Promise<UnidadesParaCliente> {
  await garantirUnidadesGollog();
  const [lista, oficiais] = await Promise.all([
    prisma.unidadeGollog.findMany({
      where: { ativa: true, naListaGollog: true, codigo: { not: REMETENTE_GOLLOG.aeroportoOrigem } },
      orderBy: [{ uf: "asc" }, { cidade: "asc" }, { titulo: "asc" }],
    }),
    destino.cep ? distanciasGollog(destino.cep) : Promise.resolve(null),
  ]);

  const origem = coordenadaDaCidade(destino.cidade, destino.uf);
  const cidade = normalizarCidade(destino.cidade ?? "");
  const uf = (destino.uf ?? "").trim().toUpperCase();

  const unidades = lista.map((u) => {
    let km: number | null = null;
    if (oficiais) {
      km = oficiais.get(u.titulo) ?? null;
    } else if (origem && u.latitude != null && u.longitude != null) {
      km = distanciaKm(origem, { lat: u.latitude, lon: u.longitude });
    }
    const mesmoNome = !!cidade && u.uf === uf && normalizarCidade(u.cidade) === cidade;
    return {
      id: u.id,
      codigo: u.codigo,
      titulo: u.titulo,
      cidade: u.cidade,
      uf: u.uf,
      endereco: u.endereco,
      horario: u.horario,
      telefone: u.telefone,
      km: km != null ? Math.round(km) : null,
      naCidade: mesmoNome || (km != null && km <= KM_MESMA_CIDADE),
    };
  });

  const doEstado = (x: UnidadeParaCliente) => (x.uf === uf ? 0 : 1);
  unidades.sort((a, b) =>
    a.km != null && b.km != null
      ? a.km - b.km
      : a.km != null
        ? -1
        : b.km != null
          ? 1
          : doEstado(a) - doEstado(b),
  );

  return {
    unidades,
    fonteDistancia: oficiais ? "gollog" : origem ? "estimada" : "nenhuma",
  };
}

/** A unidade da cidade do cliente, a mais perto se houver várias. null se a cidade não tem Gollog. */
export function unidadeDaCidade(lista: UnidadeParaCliente[]): UnidadeParaCliente | null {
  return lista.find((u) => u.naCidade) ?? null;
}

/**
 * Unidade que vai na minuta: a escolhida (cliente ou loja); sem escolha, a da
 * cidade do cliente; cidade sem Gollog fica em branco.
 */
export async function unidadeDaMinuta(pedido: {
  unidadeGollogId: string | null;
  aeroportoDestino: string | null;
  cep?: string | null;
  cidade?: string | null;
  uf?: string | null;
}): Promise<{ codigo: string; titulo: string } | null> {
  if (pedido.unidadeGollogId) {
    const u = await prisma.unidadeGollog.findUnique({
      where: { id: pedido.unidadeGollogId },
      select: { codigo: true, titulo: true },
    });
    if (u) return u;
  }
  if (pedido.aeroportoDestino) return { codigo: pedido.aeroportoDestino, titulo: pedido.aeroportoDestino };
  const { unidades } = await unidadesParaCliente(pedido);
  const u = unidadeDaCidade(unidades);
  return u ? { codigo: u.codigo, titulo: u.titulo } : null;
}
