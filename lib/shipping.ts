import "server-only";
import { MAX_PEIXES_POR_CAIXA } from "@/lib/constants";
import type { ProductType } from "@/lib/generated/prisma/enums";
import { FRETE_POR_TIPO } from "./frete-tipos";

// Regras por tipo moram em lib/frete-tipos (módulo puro): o checkout no browser
// precisa da mesma tabela e não pode importar deste arquivo (server-only).
export { FRETE_POR_TIPO } from "./frete-tipos";

// Config interna de frete. NUNCA importar de Client Component — o `server-only`
// quebra o build se isso acontecer, evitando vazar markup/regras pro browser.
export const FRETE_CONFIG = {
  cepOrigem: "29201010", // CEP da fazenda em Guarapari
  pacotePadrao: { height: 30, width: 30, length: 30, weight: 2 }, // cm / kg
  insuranceValue: 100,
  // Regras de precificação — SERVIDOR APENAS
  jadlogMarkup: 1.1, // multiplicador sobre o preço bruto da API (+10%)
  caixaIsopor: 20, // R$ adicionados após o markup
  gollog: { min: 80, max: 110 }, // faixa exibida ao cliente, valor fixo
  jadlogLabel: "JADLOG entrega no seu CEP", // label exibido ao client
  prazoMaximoSeguro: 13, // dias úteis — a partir disso (>=) frete terrestre exige avaliação
  maxPeixesPorCaixa: MAX_PEIXES_POR_CAIXA, // limite por caixa — frete único até aqui
};

// ── Regra de peso/caixa por quantidade ────────────────────────────────────
// CENTRALIZADA aqui — usada na página de produto, no carrinho e no checkout
// futuro. NÃO duplicar em outro lugar.
//
// Caixa e peso FIXOS para todo pedido de peixe: 15×15×20 cm / 2 kg,
// independentemente da quantidade (sem escalonamento por nº de peixes).

export type Caixa = { comprimento: number; largura: number; altura: number };
export type PesoCaixa = { pesoGramas: number; caixa: Caixa };

export function calcularPesoECaixa(_qtdPeixes: number): PesoCaixa {
  const pesoGramas = 2000; // g — fixo
  const caixa: Caixa = { comprimento: 15, largura: 15, altura: 20 };
  return { pesoGramas, caixa };
}

// ── Cotação de frete (Jadlog via Melhor Envio + Gollog) ───────────────────
// Extraída de /api/frete para ser reusável (página de produto, /frete, checkout
// futuro). A chamada à API e a fórmula de preço são iguais; o que varia é o
// peso/caixa (ver calcularPesoECaixa) passado pelo chamador.

const ME_ENDPOINT = "https://melhorenvio.com.br/api/v2/me/shipment/calculate";
const VIACEP_ENDPOINT = (cep: string) =>
  `https://viacep.com.br/ws/${cep}/json/`;

type ViaCepResponse = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | "true";
};

export type FreteEndereco = {
  rua: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

type MeCompany = { name: string };
type MeQuoteOk = {
  id: number;
  name: string;
  price: string;
  delivery_time: number;
  company: MeCompany;
  error?: undefined;
};
type MeQuoteErr = { id: number; error: string; company?: MeCompany };
type MeQuote = MeQuoteOk | MeQuoteErr;

export type FreteJadlog = {
  id: number;
  name: string;
  price: number;
  deliveryTime: number;
  requerAvaliacao: boolean;
};

export type CotacaoFrete = {
  endereco: FreteEndereco | null;
  jadlog: FreteJadlog[];
  gollog: { min: number; max: number };
  maxPeixesPorCaixa: number;
};

export type CotarFreteResult =
  | { ok: true; data: CotacaoFrete }
  | { ok: false; status: number; error: string };

/**
 * Cota o frete para um CEP, peso e caixa. Faz Melhor Envio (Jadlog .Com) +
 * ViaCEP em paralelo, aplica o markup/caixa de isopor e devolve um resultado
 * discriminado (ok/erro) — o chamador decide como expor (rota, RSC, etc.).
 */
export async function cotarFrete(params: {
  cepDestino: string;
  pesoGramas: number;
  caixa: Caixa;
}): Promise<CotarFreteResult> {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token) {
    return { ok: false, status: 502, error: "Serviço de frete indisponível no momento." };
  }

  const cep = String(params.cepDestino ?? "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(cep)) {
    return { ok: false, status: 400, error: "CEP de destino inválido. Use 8 dígitos." };
  }

  // ME e ViaCEP em paralelo. ViaCEP é cosmético + valida existência do CEP;
  // se cair, segue sem endereço — não pode quebrar a cotação.
  const [meSettled, viacepSettled] = await Promise.allSettled([
    fetch(ME_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Guppy de Linhagem (contato@guppydelinhagem.com.br)",
      },
      body: JSON.stringify({
        from: { postal_code: FRETE_CONFIG.cepOrigem },
        to: { postal_code: cep },
        volumes: [
          {
            height: params.caixa.altura,
            width: params.caixa.largura,
            length: params.caixa.comprimento,
            weight: params.pesoGramas / 1000, // ME espera kg
            insurance_value: FRETE_CONFIG.insuranceValue,
          },
        ],
        options: { receipt: false, own_hand: false },
        services: "4", // Jadlog .Com
      }),
      cache: "no-store",
    }),
    fetch(VIACEP_ENDPOINT(cep), { cache: "no-store" }),
  ]);

  // ── ViaCEP: valida CEP + monta endereço ──
  let endereco: FreteEndereco | null = null;
  if (viacepSettled.status === "fulfilled" && viacepSettled.value.ok) {
    try {
      const data = (await viacepSettled.value.json()) as ViaCepResponse;
      if (data.erro === true || data.erro === "true") {
        return {
          ok: false,
          status: 400,
          error: "CEP não encontrado. Confira o número ou use o CEP da sua rua.",
        };
      }
      endereco = {
        rua: data.logradouro?.trim() || null,
        bairro: data.bairro?.trim() || null,
        cidade: data.localidade?.trim() || null,
        uf: data.uf?.trim() || null,
      };
    } catch {
      // payload inválido — segue sem endereço
    }
  }

  // ── Melhor Envio: cotação Jadlog ──
  if (meSettled.status === "rejected" || !meSettled.value.ok) {
    return { ok: false, status: 502, error: "Não foi possível calcular o frete agora." };
  }

  try {
    const rawResp = (await meSettled.value.json()) as unknown;
    const raw: MeQuote[] = Array.isArray(rawResp)
      ? (rawResp as MeQuote[])
      : ([rawResp] as MeQuote[]);

    const jadlog = raw
      .filter(
        (q): q is MeQuoteOk =>
          !("error" in q && q.error) &&
          q.company?.name === "Jadlog" &&
          q.id === 4, // só .Com — defesa em profundidade
      )
      .map((q) => {
        const bruto = parseFloat(q.price);
        const final =
          Math.round(
            (bruto * FRETE_CONFIG.jadlogMarkup + FRETE_CONFIG.caixaIsopor) * 100,
          ) / 100;
        return {
          id: q.id,
          name: FRETE_CONFIG.jadlogLabel,
          price: final,
          deliveryTime: q.delivery_time,
          requerAvaliacao: q.delivery_time >= FRETE_CONFIG.prazoMaximoSeguro,
        };
      });

    return {
      ok: true,
      data: {
        endereco,
        jadlog,
        gollog: FRETE_CONFIG.gollog,
        maxPeixesPorCaixa: FRETE_CONFIG.maxPeixesPorCaixa,
      },
    };
  } catch {
    return { ok: false, status: 502, error: "Não foi possível calcular o frete agora." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUTO SECO (não é carga viva): ração, criadeira, filtro, acessório.
//
// O peixe viaja em caixa de isopor e só pela Jadlog/aéreo, e por isso paga
// markup + R$ 20 de isopor. Nada disso vale para uma ração de 300 g: ela cabe
// em envelope, aceita qualquer transportadora do Melhor Envio e sai por menos
// da metade. Aqui cotamos o catálogo inteiro do ME e cobramos a cotação + uma
// taxa fixa de embalagem (editável no admin).
//
// Carrinho MISTO (peixe + seco) NÃO passa por aqui: manda a regra de carga viva,
// tudo vai na mesma caixa de isopor. Ver carrinhoTemCargaViva.
// ─────────────────────────────────────────────────────────────────────────────

/** Fallback de volume p/ produto seco sem peso/dimensão cadastrados. */
export const PACOTE_SECO_PADRAO = {
  pesoGramas: 500,
  comprimento: 20,
  largura: 15,
  altura: 10,
};

// Mínimos aceitos pelas transportadoras (Correios é a mais restritiva: 16x11x2).
// Mandar menos que isso faz o ME recusar a cotação inteira em vez de recusar só
// aquele serviço, então normalizamos antes de perguntar.
const MIN_CM = { comprimento: 16, largura: 11, altura: 2 };
const MIN_PESO_KG = 0.3;

type MeVolumeCalc = {
  height: number;
  width: number;
  length: number;
  weight: number;
  insurance_value: number;
};

export type ItemFreteSeco = {
  tipo: ProductType;
  quantidade: number;
  pesoGramas: number | null;
  comprimento: number | null;
  largura: number | null;
  altura: number | null;
};

/** true se QUALQUER item do carrinho é carga viva (peixe, planta, coral…). */
export function carrinhoTemCargaViva(itens: { tipo: ProductType }[]): boolean {
  return itens.some((it) => FRETE_POR_TIPO[it.tipo].cargaViva);
}

/** true se o carrinho tem ao menos um item que cobra frete. */
export function carrinhoCobraFrete(itens: { tipo: ProductType }[]): boolean {
  return itens.some((it) => FRETE_POR_TIPO[it.tipo].calculaFrete);
}

/**
 * UMA caixa com tudo dentro, empilhando os itens.
 *
 * A versão anterior mandava um volume por unidade, e isso custava caro de
 * verdade: duas criadeiras de 160 g para Bebedouro davam R$ 24,98 como dois
 * pacotes e R$ 16,90 numa caixa só. Pior, transportadora que não cota
 * fracionado (Loggi, JeT) simplesmente sumia da lista, então a opção mais
 * barata nem chegava a ser oferecida.
 *
 * O empilhamento é deliberadamente simples e conservador: soma as alturas,
 * mantém a maior largura e o maior comprimento. Não é encaixotamento 3D — dois
 * itens finos lado a lado caberiam numa caixa mais baixa —, mas errar para uma
 * caixa um pouco maior é seguro: a transportadora cobra pelo que foi declarado,
 * e declarar menos do que se posta dá diferença na hora do despacho.
 */
export function volumesDoCarrinhoSeco(itens: ItemFreteSeco[]): MeVolumeCalc[] {
  let altura = 0;
  let largura = 0;
  let comprimento = 0;
  let pesoKg = 0;

  for (const it of itens) {
    if (!FRETE_POR_TIPO[it.tipo].calculaFrete) continue; // DIGITAL não despacha
    const a = it.altura ?? PACOTE_SECO_PADRAO.altura;
    const l = it.largura ?? PACOTE_SECO_PADRAO.largura;
    const c = it.comprimento ?? PACOTE_SECO_PADRAO.comprimento;
    const p = (it.pesoGramas ?? PACOTE_SECO_PADRAO.pesoGramas) / 1000;

    altura += a * it.quantidade;
    largura = Math.max(largura, l);
    comprimento = Math.max(comprimento, c);
    pesoKg += p * it.quantidade;
  }

  if (pesoKg === 0 && altura === 0) return [];

  return [
    {
      height: Math.max(altura, MIN_CM.altura),
      width: Math.max(largura, MIN_CM.largura),
      length: Math.max(comprimento, MIN_CM.comprimento),
      weight: Math.max(pesoKg, MIN_PESO_KG),
      insurance_value: 0,
    },
  ];
}

/**
 * Empresa do Melhor Envio -> enum Transportadora. O enum tem 3 valores e o
 * catalogo do ME muda sozinho, entao so Jadlog e Gollog tem correspondencia
 * direta; o resto vira OUTRO e o nome real fica em Order.servicoEnvioNome.
 *
 * Devolve string e nao o enum para este modulo nao arrastar o client do Prisma
 * para quem so precisa do rotulo.
 */
export function transportadoraDaEmpresa(
  empresa: string,
): "JADLOG" | "GOLLOG" | "OUTRO" {
  if (/jadlog/i.test(empresa)) return "JADLOG";
  if (/gollog/i.test(empresa)) return "GOLLOG";
  return "OUTRO";
}

export type OpcaoFreteSeco = {
  servicoId: number;
  empresa: string;
  servico: string;
  /** Rótulo pro cliente: "Loggi Express". */
  label: string;
  preco: number;
  prazoDias: number;
};

export type CotacaoSeco = {
  endereco: FreteEndereco | null;
  /** Menor preço e menor prazo. Vem só uma quando é a mesma transportadora. */
  opcoes: OpcaoFreteSeco[];
};

export type CotarSecoResult =
  | { ok: true; data: CotacaoSeco }
  | { ok: false; status: number; error: string };

/**
 * Cota TODAS as transportadoras do Melhor Envio para um pacote seco e devolve
 * no máximo duas opções: a mais barata e a mais rápida.
 *
 * taxaEmbalagem entra UMA vez no preço final (é a caixa do pedido, não de cada
 * volume) e vem da config da loja — nunca hardcode aqui.
 */
export async function cotarFreteSeco(params: {
  cepDestino: string;
  volumes: MeVolumeCalc[];
  valorSegurado: number;
  taxaEmbalagem: number;
}): Promise<CotarSecoResult> {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token) {
    return {
      ok: false,
      status: 502,
      error: "Serviço de frete indisponível no momento.",
    };
  }
  const cep = String(params.cepDestino ?? "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(cep)) {
    return {
      ok: false,
      status: 400,
      error: "CEP de destino inválido. Use 8 dígitos.",
    };
  }
  if (params.volumes.length === 0) {
    return { ok: false, status: 400, error: "Nenhum item para despachar." };
  }

  // O seguro é do pedido inteiro; concentramos no primeiro volume para não
  // multiplicar o valor segurado (e o preço) por volume.
  const volumes = params.volumes.map((v, i) => ({
    ...v,
    insurance_value: i === 0 ? params.valorSegurado : 0,
  }));

  const [meSettled, viacepSettled] = await Promise.allSettled([
    fetch(ME_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Guppy de Linhagem (contato@guppydelinhagem.com.br)",
      },
      // SEM services: queremos o catálogo inteiro e escolhemos depois. Serviço
      // que não atende o trecho volta com error e é descartado no filtro.
      body: JSON.stringify({
        from: { postal_code: FRETE_CONFIG.cepOrigem },
        to: { postal_code: cep },
        volumes,
        options: { receipt: false, own_hand: false },
      }),
      cache: "no-store",
    }),
    fetch(VIACEP_ENDPOINT(cep), { cache: "no-store" }),
  ]);

  let endereco: FreteEndereco | null = null;
  if (viacepSettled.status === "fulfilled" && viacepSettled.value.ok) {
    try {
      const data = (await viacepSettled.value.json()) as ViaCepResponse;
      if (data.erro === true || data.erro === "true") {
        return {
          ok: false,
          status: 400,
          error: "CEP não encontrado. Confira o número ou use o CEP da sua rua.",
        };
      }
      endereco = {
        rua: data.logradouro?.trim() || null,
        bairro: data.bairro?.trim() || null,
        cidade: data.localidade?.trim() || null,
        uf: data.uf?.trim() || null,
      };
    } catch {
      // payload inválido — segue sem endereço
    }
  }

  if (meSettled.status === "rejected" || !meSettled.value.ok) {
    return {
      ok: false,
      status: 502,
      error: "Não foi possível calcular o frete agora.",
    };
  }

  try {
    const rawResp = (await meSettled.value.json()) as unknown;
    const raw: MeQuote[] = Array.isArray(rawResp)
      ? (rawResp as MeQuote[])
      : ([rawResp] as MeQuote[]);

    const taxa = Math.max(0, params.taxaEmbalagem);
    const validas = raw
      .filter(
        (q): q is MeQuoteOk =>
          !("error" in q && q.error) && typeof (q as MeQuoteOk).price === "string",
      )
      .map((q) => {
        const empresa = q.company?.name ?? "";
        return {
          servicoId: q.id,
          empresa,
          servico: q.name,
          label: [empresa, q.name].filter(Boolean).join(" "),
          preco: Math.round((parseFloat(q.price) + taxa) * 100) / 100,
          prazoDias: q.delivery_time,
        };
      })
      .filter((o) => Number.isFinite(o.preco) && o.preco > 0);

    if (validas.length === 0) {
      return {
        ok: false,
        status: 502,
        error:
          "Nenhuma transportadora atende esse CEP no momento. Finalize no WhatsApp.",
      };
    }

    // Mais barata; empate de preço decide pelo menor prazo.
    const maisBarata = [...validas].sort(
      (a, b) => a.preco - b.preco || a.prazoDias - b.prazoDias,
    )[0];
    // Mais rápida; empate de prazo decide pelo menor preço.
    const maisRapida = [...validas].sort(
      (a, b) => a.prazoDias - b.prazoDias || a.preco - b.preco,
    )[0];

    const opcoes =
      maisRapida.servicoId === maisBarata.servicoId
        ? [maisBarata]
        : [maisBarata, maisRapida];

    return { ok: true, data: { endereco, opcoes } };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Não foi possível calcular o frete agora.",
    };
  }
}
