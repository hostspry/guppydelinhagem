import "server-only";
import { prisma } from "@/lib/prisma";
import { chamarMl, type MlResult } from "./cliente";
import { COMPOSICAO_LABEL } from "@/lib/composicoes";
import { stripMarcheziSignature } from "@/lib/constants";
import { descricaoEmTextoSimples } from "@/lib/markdown";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";

/**
 * Cria anúncio no Mercado Livre a partir de um produto do site.
 *
 * NASCE PAUSADO, sempre. Publicar direto no ar seria despejar 17 linhagens numa
 * vitrine sem ninguém ter conferido título, foto e preço — e anúncio de peixe
 * vivo errado no ML custa mais do que uma venda perdida: custa a conta. O dono
 * revisa lá e ativa quando quiser.
 *
 * Um anúncio por COMPOSIÇÃO (trio, casal, macho, fêmea), decidido com o dono:
 * anúncio do ML tem um preço só, e as composições têm preços diferentes.
 */

/** Categoria de peixe vivo. Conferido na API: aceita anúncio e NÃO usa Mercado
 *  Envios (`shipping_options: ["custom"]`), que é o que viabiliza bicho vivo. */
export const CATEGORIA_PEIXE = "MLB1098";

/** Clássico. Premium cobra 17,5% contra 12,5% — a diferença sai da margem. */
export const LISTING_TYPE = "gold_special";

/** Valores obrigatórios da categoria, lidos da própria API do ML. */
const ESPECIE_GUPPY = "3221175";
const AGUA_DOCE = "3221180";
const GENERO = {
  MACHO: "3896960",
  FEMEA: "3896959",
  MISTO: "4052847", // "Não sexado" — é o que existe para lote com os dois sexos
} as const;

/** O ML corta título em 60 caracteres. Cortar aqui, na palavra, evita meia palavra. */
const TITULO_MAX = 60;

function cortarTitulo(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= TITULO_MAX) return t;
  const corte = t.slice(0, TITULO_MAX);
  const espaco = corte.lastIndexOf(" ");
  return (espaco > 20 ? corte.slice(0, espaco) : corte).trim();
}

function generoDaComposicao(c: TipoComposicao | null): string {
  if (c === "MACHO") return GENERO.MACHO;
  if (c === "FEMEA") return GENERO.FEMEA;
  return GENERO.MISTO;
}

/** Quantos conjuntos desta composição o pool sustenta. Mesma conta da loja. */
function unidadesDoPool(
  pool: { machos: number; femeas: number },
  receita: { qtdMachos: number; qtdFemeas: number },
): number {
  const porM = receita.qtdMachos > 0 ? Math.floor(pool.machos / receita.qtdMachos) : Infinity;
  const porF = receita.qtdFemeas > 0 ? Math.floor(pool.femeas / receita.qtdFemeas) : Infinity;
  const u = Math.min(porM, porF);
  return Number.isFinite(u) ? Math.max(0, u) : 0;
}

export type PublicacaoOk = { itemId: string; permalink: string | null; status: string };

export type EntradaPublicacao = {
  productId: string;
  /** Null só em produto sem composição (seco). */
  composicao: TipoComposicao | null;
  /** Preço do anúncio no ML. Quem decide é o dono — o do site é só a sugestão. */
  preco: number;
};

/**
 * Monta e cria o anúncio. Devolve o erro do ML em texto quando recusa — é por
 * ele que se descobre o atributo que faltou, e a mensagem deles é específica.
 */
export async function publicarNoMl(
  entrada: EntradaPublicacao,
): Promise<MlResult<PublicacaoOk>> {
  const cfg = await prisma.integracaoMercadoLivre.findUnique({
    where: { id: "default" },
    select: { ativo: true, sellerId: true, licencaIbama: true },
  });
  if (!cfg?.ativo || !cfg.sellerId) {
    return { ok: false, erro: "Conecte a conta do Mercado Livre primeiro." };
  }

  const p = await prisma.product.findUnique({
    where: { id: entrada.productId },
    select: {
      id: true,
      nome: true,
      descricao: true,
      descricaoCurta: true,
      tipo: true,
      estoque: true,
      estoqueMachos: true,
      estoqueFemeas: true,
      imagens: { orderBy: { ordem: "asc" }, select: { url: true } },
      variantes: {
        where: { ativo: true },
        select: { composicao: true, qtdMachos: true, qtdFemeas: true, rotulo: true },
      },
    },
  });
  if (!p) return { ok: false, erro: "Produto não encontrado." };

  // Foto é barreira real: o ML não publica anúncio sem imagem, e não aceita
  // link de vídeo no lugar. Melhor dizer isso aqui do que receber o erro cru.
  if (p.imagens.length === 0) {
    return {
      ok: false,
      erro: "Este produto não tem foto cadastrada, e o Mercado Livre não publica anúncio sem imagem. Suba as fotos no cadastro do produto e tente de novo.",
    };
  }

  const ehPeixe = p.tipo === "PEIXE";
  if (ehPeixe && !cfg.licencaIbama) {
    return {
      ok: false,
      erro: "Informe o número da licença do IBAMA nas configurações do Mercado Livre. Anúncio de peixe vivo sem ela é cancelado pelo ML.",
    };
  }

  // Estoque: peixe sai do pool pela receita da composição; o resto, do estoque.
  let disponivel = p.estoque;
  let receita: { qtdMachos: number; qtdFemeas: number } | null = null;
  if (ehPeixe) {
    const v = p.variantes.find((x) => x.composicao === entrada.composicao);
    if (!v) return { ok: false, erro: "Composição não encontrada neste produto." };
    receita = { qtdMachos: v.qtdMachos, qtdFemeas: v.qtdFemeas };
    disponivel = unidadesDoPool(
      { machos: p.estoqueMachos, femeas: p.estoqueFemeas },
      receita,
    );
  }
  if (disponivel <= 0) {
    return {
      ok: false,
      erro: "Sem estoque para esta composição. O ML recusa anúncio com quantidade zero.",
    };
  }

  const rotulo = entrada.composicao ? COMPOSICAO_LABEL[entrada.composicao] : null;
  const titulo = cortarTitulo(rotulo ? `${p.nome} ${rotulo}` : p.nome);

  const corpo = [
    stripMarcheziSignature(p.descricao || p.descricaoCurta || p.nome),
    receita
      ? `\n\nO que vai no envio: ${receita.qtdMachos} macho(s) e ${receita.qtdFemeas} fêmea(s).`
      : "",
    ehPeixe
      ? `\n\nPeixe ornamental vivo, criado em cativeiro. Licença IBAMA: ${cfg.licencaIbama}.`
      : "",
    "\n\nEnvio combinado com o vendedor, em caixa preparada para transporte de peixe vivo.",
  ].join("");

  const atributos: { id: string; value_id?: string; value_name?: string }[] = ehPeixe
    ? [
        { id: "FISH_SPECIES", value_id: ESPECIE_GUPPY },
        { id: "ANIMAL_GENDER", value_id: generoDaComposicao(entrada.composicao) },
        { id: "REQUIRED_WATER_TYPE", value_id: AGUA_DOCE },
      ]
    : [];

  const item = {
    title: titulo,
    category_id: ehPeixe ? CATEGORIA_PEIXE : undefined,
    price: Number(entrada.preco.toFixed(2)),
    currency_id: "BRL",
    available_quantity: disponivel,
    buying_mode: "buy_it_now",
    listing_type_id: LISTING_TYPE,
    condition: "new",
    // A categoria de peixe não usa Mercado Envios: o frete é combinado, que é
    // justamente o que permite mandar bicho vivo no isopor.
    shipping: { mode: "custom", local_pick_up: false, free_shipping: false },
    // Nasce pausado de propósito. Quem ativa é o dono, depois de conferir.
    status: "paused",
    pictures: p.imagens.slice(0, 10).map((i) => ({ source: i.url })),
    attributes: atributos,
  };

  const criado = await chamarMl<{ id?: string; permalink?: string; status?: string }>(
    "/items",
    { method: "POST", body: item },
  );
  if (!criado.ok) return criado;

  const itemId = criado.dados?.id;
  if (!itemId) return { ok: false, erro: "O Mercado Livre não devolveu o id do anúncio." };

  // Descrição vai em chamada separada: o campo do item aceita só texto simples,
  // e o markdown do admin viraria lixo na tela do comprador.
  const descricao = await chamarMl(`/items/${itemId}/description`, {
    method: "POST",
    body: { plain_text: descricaoEmTextoSimples(corpo).slice(0, 50000) },
  });
  if (!descricao.ok) {
    console.error("[ml] anúncio criado sem descrição", itemId, descricao.erro);
  }

  // Liga na hora: anúncio criado e não ligado é estoque que não sincroniza.
  await prisma.mercadoLivreAnuncio.create({
    data: {
      productId: p.id,
      itemId,
      variationId: null,
      titulo,
      estoqueEnviado: disponivel,
      sincronizadoEm: new Date(),
    },
  });

  return {
    ok: true,
    dados: {
      itemId,
      permalink: criado.dados?.permalink ?? null,
      status: criado.dados?.status ?? "paused",
    },
  };
}
