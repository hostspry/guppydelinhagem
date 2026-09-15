import "server-only";
import { chamarMl, type MlResult } from "./cliente";

/**
 * O anúncio como está NO MERCADO LIVRE agora, e o que dá para mudar nele.
 *
 * O banco guarda só a ligação (item, produto, composição). Preço, status,
 * título e qualidade são lidos do ML na hora: guardar cópia aqui seria mostrar
 * ao dono um número que alguém já mudou no painel de lá.
 */

export type StatusMl = "active" | "paused" | "closed" | "under_review" | "inactive" | string;

export type PendenciaQualidade = { chave: string; texto: string };

export type DetalheAnuncio = {
  itemId: string;
  titulo: string;
  status: StatusMl;
  subStatus: string[];
  preco: number;
  estoque: number;
  vendidos: number;
  tipoAnuncio: string;
  permalink: string | null;
  fotos: { url: string; largura: number }[];
  /** 0 a 100. Nulo quando o ML ainda não calculou. */
  qualidade: number | null;
  qualidadeNivel: string | null;
  pendencias: PendenciaQualidade[];
  descricao: string;
  /** O ML trava o título de anúncio que já vendeu. */
  podeEditarTitulo: boolean;
};

type ItemResp = {
  id?: string;
  title?: string;
  status?: string;
  sub_status?: string[];
  price?: number;
  available_quantity?: number;
  sold_quantity?: number;
  listing_type_id?: string;
  permalink?: string;
  pictures?: { secure_url?: string; url?: string; max_size?: string }[];
};

type PerformanceResp = {
  score?: number;
  level_wording?: string;
  buckets?: {
    variables?: {
      key?: string;
      status?: string;
      rules?: { key?: string; status?: string; wordings?: { title?: string } }[];
    }[];
  }[];
};

/** Lê item, qualidade e descrição. Qualidade e descrição são opcionais: faltar não derruba. */
export async function detalharAnuncio(itemId: string): Promise<MlResult<DetalheAnuncio>> {
  const item = await chamarMl<ItemResp>(`/items/${itemId}`);
  if (!item.ok) return item;
  const it = item.dados;

  const [perf, desc] = await Promise.all([
    chamarMl<PerformanceResp>(`/item/${itemId}/performance`),
    chamarMl<{ plain_text?: string }>(`/items/${itemId}/description`),
  ]);

  const pendencias: PendenciaQualidade[] = [];
  if (perf.ok) {
    for (const b of perf.dados.buckets ?? []) {
      for (const v of b.variables ?? []) {
        for (const r of v.rules ?? []) {
          if (r.status === "PENDING" && r.wordings?.title) {
            pendencias.push({ chave: r.key ?? v.key ?? "", texto: r.wordings.title });
          }
        }
      }
    }
  }

  return {
    ok: true,
    dados: {
      itemId,
      titulo: it.title ?? "",
      status: it.status ?? "",
      subStatus: it.sub_status ?? [],
      preco: Number(it.price ?? 0),
      estoque: Number(it.available_quantity ?? 0),
      vendidos: Number(it.sold_quantity ?? 0),
      tipoAnuncio: it.listing_type_id ?? "",
      permalink: it.permalink ?? null,
      // max_size é o que o ML guardou ("720x720"): é a largura DELE que decide
      // o zoom (acima de 800 px), não a do arquivo que subimos.
      fotos: (it.pictures ?? []).map((p) => ({
        url: p.secure_url ?? p.url ?? "",
        largura: Number((p.max_size ?? "0x0").split("x")[0]) || 0,
      })),
      qualidade: perf.ok && typeof perf.dados.score === "number" ? perf.dados.score : null,
      qualidadeNivel: perf.ok ? (perf.dados.level_wording ?? null) : null,
      pendencias,
      descricao: desc.ok ? (desc.dados.plain_text ?? "") : "",
      podeEditarTitulo: Number(it.sold_quantity ?? 0) === 0,
    },
  };
}

/** Preço e/ou título. Só manda o que mudou: campo igual no PUT ainda gasta revisão. */
export async function editarAnuncio(
  itemId: string,
  mudancas: { titulo?: string; preco?: number },
): Promise<MlResult<null>> {
  const corpo: Record<string, unknown> = {};
  if (mudancas.titulo !== undefined) corpo.title = mudancas.titulo;
  if (mudancas.preco !== undefined) corpo.price = Number(mudancas.preco.toFixed(2));
  if (Object.keys(corpo).length === 0) return { ok: true, dados: null };

  const r = await chamarMl(`/items/${itemId}`, { method: "PUT", body: corpo });
  return r.ok ? { ok: true, dados: null } : r;
}

/**
 * Ativar, pausar ou finalizar. Finalizar ("closed") é o fim do anúncio: o ML não
 * deixa voltar para ativo, só republicar como outro.
 */
export async function mudarStatusAnuncio(
  itemId: string,
  status: "active" | "paused" | "closed",
): Promise<MlResult<null>> {
  const r = await chamarMl(`/items/${itemId}`, { method: "PUT", body: { status } });
  return r.ok ? { ok: true, dados: null } : r;
}

/** Troca a descrição. O ML aceita só texto simples, sem HTML. */
export async function salvarDescricaoAnuncio(
  itemId: string,
  texto: string,
): Promise<MlResult<null>> {
  const r = await chamarMl(`/items/${itemId}/description`, {
    method: "PUT",
    body: { plain_text: texto.slice(0, 50000) },
  });
  return r.ok ? { ok: true, dados: null } : r;
}
