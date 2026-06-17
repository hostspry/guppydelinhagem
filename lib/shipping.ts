import "server-only";
import { MAX_PEIXES_POR_CAIXA } from "@/lib/constants";
import type { ProductType } from "@/lib/generated/prisma/enums";

// Comportamento de frete por tipo de produto (mapa central — não espalhar `if`).
// PEIXE é o caminho completo desta fase; os demais usam Product.peso (sem a regra
// de caixa por nº de peixes). DIGITAL não calcula frete.
export const FRETE_POR_TIPO: Record<
  ProductType,
  {
    calculaFrete: boolean;
    cargaViva: boolean;
    regraCaixaPeixe: boolean;
    avisoIdade: boolean;
  }
> = {
  PEIXE: { calculaFrete: true, cargaViva: true, regraCaixaPeixe: true, avisoIdade: true },
  CORAL: { calculaFrete: true, cargaViva: true, regraCaixaPeixe: false, avisoIdade: true },
  PLANTA: { calculaFrete: true, cargaViva: true, regraCaixaPeixe: false, avisoIdade: false },
  ALIMENTO_VIVO: { calculaFrete: true, cargaViva: true, regraCaixaPeixe: false, avisoIdade: false },
  RACAO: { calculaFrete: true, cargaViva: false, regraCaixaPeixe: false, avisoIdade: false },
  ACESSORIO: { calculaFrete: true, cargaViva: false, regraCaixaPeixe: false, avisoIdade: false },
  DIGITAL: { calculaFrete: false, cargaViva: false, regraCaixaPeixe: false, avisoIdade: false },
};

// Config interna de frete. NUNCA importar de Client Component — o `server-only`
// quebra o build se isso acontecer, evitando vazar markup/regras pro browser.
export const FRETE_CONFIG = {
  cepOrigem: "29201010", // CEP da fazenda em Guarapari
  pacotePadrao: { height: 30, width: 30, length: 30, weight: 2 }, // cm / kg
  insuranceValue: 100,
  // Regras de precificação — SERVIDOR APENAS
  jadlogMarkup: 1.5, // multiplicador sobre o preço bruto da API
  caixaIsopor: 20, // R$ adicionados após o markup
  gollog: { min: 80, max: 110 }, // faixa exibida ao cliente, valor fixo
  jadlogLabel: "JADLOG entrega no seu CEP", // label exibido ao client
  prazoMaximoSeguro: 13, // dias úteis — a partir disso (>=) frete terrestre exige avaliação
  maxPeixesPorCaixa: MAX_PEIXES_POR_CAIXA, // limite por caixa — frete único até aqui
};

// ── Regra de peso/caixa por quantidade (tabela do brief) ──────────────────
// CENTRALIZADA aqui — usada na página de produto, no carrinho e no checkout
// futuro. NÃO duplicar a tabela em outro lugar.
//
// | peixes  | peso                     | caixa     |
// | 1 a 10  | 4 kg                     | 30×30×30  |
// | 11 a 30 | 4kg + 300g × (qtd − 10)  | 30×30×30  |
// | > 30    | 4kg + 300g × (qtd − 10)  | 40×40×40  |

export type Caixa = { comprimento: number; largura: number; altura: number };
export type PesoCaixa = { pesoGramas: number; caixa: Caixa };

export function calcularPesoECaixa(qtdPeixes: number): PesoCaixa {
  const qtd = Math.max(1, Math.floor(qtdPeixes || 1));
  const pesoBase = 4000; // g — cobre de 1 a 10 peixes
  const pesoGramas = qtd <= 10 ? pesoBase : pesoBase + 300 * (qtd - 10);
  const caixa: Caixa =
    qtd > 30
      ? { comprimento: 40, largura: 40, altura: 40 }
      : { comprimento: 30, largura: 30, altura: 30 };
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
