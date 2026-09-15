import "server-only";
import { prisma } from "@/lib/prisma";
import { chamarMl, type MlResult } from "./cliente";
import { COMPOSICAO_LABEL, conjuntosDoPool } from "@/lib/composicoes";
import { tituloPeixeMl, atributosPeixe, type AtributoMl } from "./seo";
import { stripMarcheziSignature } from "@/lib/constants";
import { descricaoEmParagrafos } from "@/lib/markdown";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";
import { TEXTO_ENVIO_SEGUNDA } from "@/lib/envio-peixe";
import { prazoMl, saleTermPrazo } from "./prazo";
import { problemasTitulo, problemasDescricao } from "./texto-ml";

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

/**
 * Tipos de anúncio que o MLB realmente vende hoje. Os outros quatro (Diamante,
 * Ouro, Prata, Bronze) ainda aparecem na API, mas estão desativados há anos.
 *
 * PUBLICAR O MESMO PRODUTO EM MAIS DE UM TIPO É DUPLICATA, e a política do ML
 * cancela os anúncios e pode derrubar a conta — "oferecer o mesmo produto em
 * mais de um anúncio para oferecer diferentes condições de pagamento" é o
 * exemplo do manual deles. Por isso a escolha é UMA por anúncio, e trocar de
 * tipo depois se faz no anúncio existente, não criando outro.
 */
export const TIPOS_ANUNCIO = {
  gold_special: { nome: "Clássico", estoqueMax: 99999 },
  gold_pro: { nome: "Premium", estoqueMax: 99999 },
  // Grátis: 0% de comissão, mas 1 unidade por anúncio e 60 dias de validade.
  free: { nome: "Grátis", estoqueMax: 1 },
} as const;

export type TipoAnuncio = keyof typeof TIPOS_ANUNCIO;

export const LISTING_TYPE: TipoAnuncio = "gold_special";

export function ehTipoAnuncio(v: string): v is TipoAnuncio {
  return v in TIPOS_ANUNCIO;
}

/** Gênero por composição. Os demais valores da ficha moram em ./seo. */
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

export type PublicacaoOk = { itemId: string; permalink: string | null; status: string };

/**
 * O anúncio como ele vai sair, antes de ir. A aba do produto mostra isto para o
 * dono ver título, ficha e descrição sem publicar, e a publicação usa o mesmo
 * objeto: o que se vê na prévia é exatamente o que vai.
 */
export type AnuncioMontado = {
  titulo: string;
  descricao: string;
  /** Parte da descrição que vem do produto (a IA pode reescrever). */
  textoProduto: string;
  /** Envio, licença, regra da segunda e garantia: sempre do código, sempre no fim. */
  blocosFixos: string;
  /** Apresentação da loja: sempre do código, sempre no topo. */
  abertura: string;
  atributos: AtributoMl[];
  /** Conjuntos que o pool monta (peixe) ou estoque da linha (seco). */
  disponivel: number;
  quantidade: number;
  fotos: string[];
  ehPeixe: boolean;
  receita: { qtdMachos: number; qtdFemeas: number } | null;
};

/**
 * Título que pode ir ao ML: regras de lib/mercadolivre/texto-ml, contra os
 * títulos dos outros anúncios do mesmo produto. Devolve a mensagem ou null.
 */
export async function conferirTitulo(
  productId: string,
  composicao: TipoComposicao | null,
  titulo: string,
  anuncioIdIgnorar?: string,
): Promise<string | null> {
  const outros = await prisma.mercadoLivreAnuncio.findMany({
    where: { productId, ...(anuncioIdIgnorar ? { NOT: { id: anuncioIdIgnorar } } : {}) },
    select: { titulo: true },
  });
  const problemas = problemasTitulo(titulo, {
    composicao,
    outrosTitulos: outros.map((o) => o.titulo ?? "").filter(Boolean),
  });
  return problemas.length ? `Título recusado: ${problemas.join(", ")}.` : null;
}

/** Descrição que pode ir ao ML. Peixe tem que manter a licença do IBAMA. */
export function conferirDescricao(texto: string, licencaIbama: string | null): string | null {
  const problemas = problemasDescricao(texto);
  if (licencaIbama && !texto.includes(licencaIbama)) {
    problemas.push("tirou a licença do IBAMA, sem a qual o ML cancela o anúncio");
  }
  return problemas.length ? `Descrição recusada: ${problemas.join(", ")}.` : null;
}

/** Descrição final: apresentação da loja, texto do produto e blocos fixos. */
export function juntarDescricao(
  textoProduto: string,
  blocosFixos: string,
  abertura = "",
): string {
  return [abertura.trim(), textoProduto.trim(), blocosFixos.trim()]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 50000);
}

/** "1 macho e 2 fêmeas", "3 machos", "1 fêmea". */
export function descreverReceita(r: { qtdMachos: number; qtdFemeas: number }): string {
  const partes = [
    r.qtdMachos > 0 ? `${r.qtdMachos} ${r.qtdMachos === 1 ? "macho" : "machos"}` : "",
    r.qtdFemeas > 0 ? `${r.qtdFemeas} ${r.qtdFemeas === 1 ? "fêmea" : "fêmeas"}` : "",
  ].filter(Boolean);
  return partes.join(" e ");
}

/** Monta o anúncio sem chamar o ML. Erro em texto quando falta algo do lado de cá. */
export async function montarAnuncio(
  entrada: Omit<EntradaPublicacao, "preco">,
): Promise<MlResult<AnuncioMontado>> {
  const cfg = await prisma.integracaoMercadoLivre.findUnique({
    where: { id: "default" },
    select: { licencaIbama: true, apresentacaoLoja: true, garantiaChegada: true },
  });

  const p = await prisma.product.findUnique({
    where: { id: entrada.productId },
    select: {
      nome: true,
      descricao: true,
      descricaoCurta: true,
      padraoCor: true,
      tipo: true,
      estoque: true,
      estoqueMachos: true,
      estoqueFemeas: true,
      imagens: { orderBy: { ordem: "asc" }, select: { url: true, urlAlta: true } },
      variantes: {
        where: { ativo: true },
        select: { composicao: true, qtdMachos: true, qtdFemeas: true },
      },
    },
  });
  if (!p) return { ok: false, erro: "Produto não encontrado." };

  const ehPeixe = p.tipo === "PEIXE";

  // Estoque: peixe sai do pool pela receita da composição; o resto, do estoque.
  let disponivel = p.estoque;
  let receita: { qtdMachos: number; qtdFemeas: number } | null = null;
  if (ehPeixe) {
    const v = p.variantes.find((x) => x.composicao === entrada.composicao);
    if (!v) return { ok: false, erro: "Composição não encontrada neste produto." };
    receita = { qtdMachos: v.qtdMachos, qtdFemeas: v.qtdFemeas };
    disponivel = conjuntosDoPool(receita, {
      machos: p.estoqueMachos,
      femeas: p.estoqueFemeas,
    });
  }

  const tipo = entrada.tipoAnuncio ?? LISTING_TYPE;
  // O Grátis aceita 1 unidade por anúncio. Mandar mais faz o ML recusar a
  // publicação inteira, então corta aqui e o resto do estoque fica no site.
  const quantidade = Math.min(disponivel, TIPOS_ANUNCIO[tipo].estoqueMax);

  const rotulo = entrada.composicao ? COMPOSICAO_LABEL[entrada.composicao] : null;
  // Peixe ganha título montado para a BUSCA do ML (ver lib/mercadolivre/seo):
  // o nome da vitrine gasta caracteres com travessão e "Premium", que ninguém
  // digita, e deixa de fora "peixe", "lebiste" e "vivo", que é o que se busca.
  const titulo = ehPeixe
    ? tituloPeixeMl({ nome: p.nome, composicao: rotulo })
    : cortarTitulo(rotulo ? `${p.nome} ${rotulo}` : p.nome);

  // Texto do produto (o que a IA pode reescrever) separado do que só o código
  // escreve: a apresentação da loja no topo e, no fim, o que vai no envio,
  // licença, regra da segunda e garantia. Os dois textos da loja vêm de
  // Configurações → Mercado Livre.
  const textoProduto = descricaoEmParagrafos(
    stripMarcheziSignature(p.descricao || p.descricaoCurta || p.nome),
  );
  const abertura = ehPeixe ? (cfg?.apresentacaoLoja?.trim() ?? "") : "";
  const blocosFixos = [
    receita && descreverReceita(receita)
      ? `O que vai no envio: ${descreverReceita(receita)}.`
      : "",
    ehPeixe && cfg?.licencaIbama
      ? `Peixe ornamental vivo, criado em cativeiro. Licença IBAMA: ${cfg.licencaIbama}.`
      : "",
    ehPeixe ? TEXTO_ENVIO_SEGUNDA : "",
    ehPeixe ? "O peixe vai em caixa preparada para transporte de peixe vivo." : "",
    ehPeixe ? (cfg?.garantiaChegada?.trim() ?? "") : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // Ficha técnica vale ranqueamento: o ML usa os atributos nos FILTROS da busca,
  // e anúncio sem ficha some quando o comprador filtra por espécie, cor ou
  // quantidade. Os obrigatórios são três; mandamos o que mais der para saber.
  const atributos = ehPeixe
    ? atributosPeixe({
        genero: generoDaComposicao(entrada.composicao),
        quantidadePeixes: receita ? receita.qtdMachos + receita.qtdFemeas : null,
        textoParaCor: `${p.nome} ${p.padraoCor ?? ""}`,
      })
    : [];

  return {
    ok: true,
    dados: {
      titulo,
      descricao: juntarDescricao(textoProduto, blocosFixos, abertura),
      textoProduto,
      blocosFixos,
      abertura,
      atributos,
      disponivel,
      quantidade,
      // O ML recebe a versão em alta (zoom acima de 800 px); foto antiga não tem, e vai a do site.
      fotos: p.imagens.slice(0, 10).map((i) => i.urlAlta ?? i.url),
      ehPeixe,
      receita,
    },
  };
}

export type EntradaPublicacao = {
  productId: string;
  /** Null só em produto sem composição (seco). */
  composicao: TipoComposicao | null;
  /** Preço do anúncio no ML. Quem decide é o dono — o do site é só a sugestão. */
  preco: number;
  /** Clássico, Premium ou Grátis. Um por anúncio (ver TIPOS_ANUNCIO). */
  tipoAnuncio?: TipoAnuncio;
  /** Título editado (à mão ou pela IA). Vazio = o montado pelo site. */
  titulo?: string;
  /** Descrição editada. Vazio = a montada pelo site. */
  descricao?: string;
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

  const montado = await montarAnuncio(entrada);
  if (!montado.ok) return montado;
  const m = montado.dados;

  // Produto seco não tem categoria decidida aqui: cada um cai numa categoria do
  // ML com ficha obrigatória própria (marca, modelo, GTIN). Publicar sem isso
  // volta erro do ML; melhor dizer o caminho que funciona.
  if (!m.ehPeixe) {
    return {
      ok: false,
      erro: "Publicar produto seco por aqui ainda não dá: cada categoria do ML pede uma ficha diferente. Publique no painel do ML e ligue o anúncio pelo número (MLB…).",
    };
  }

  // Foto é barreira real: o ML não publica anúncio sem imagem, e não aceita
  // link de vídeo no lugar. Melhor dizer isso aqui do que receber o erro cru.
  if (m.fotos.length === 0) {
    return {
      ok: false,
      erro: "Este produto não tem foto cadastrada, e o Mercado Livre não publica anúncio sem imagem. Suba as fotos no cadastro do produto e tente de novo.",
    };
  }
  if (!cfg.licencaIbama) {
    return {
      ok: false,
      erro: "Informe o número da licença do IBAMA nas configurações do Mercado Livre. Anúncio de peixe vivo sem ela é cancelado pelo ML.",
    };
  }
  if (m.quantidade <= 0) {
    return {
      ok: false,
      erro: "Sem estoque para esta composição. O ML recusa anúncio com quantidade zero.",
    };
  }

  // Composição já anunciada: um segundo anúncio do mesmo peixe é duplicata, e o
  // ML cancela os dois. Trocar tipo ou preço se faz no anúncio que existe.
  const jaTem = await prisma.mercadoLivreAnuncio.findFirst({
    where: { productId: entrada.productId, composicao: entrada.composicao },
    select: { itemId: true },
  });
  if (jaTem) {
    return {
      ok: false,
      erro: `Esta composição já está no anúncio ${jaTem.itemId}. Publicar outro é duplicata, e o ML cancela os dois. Edite o que existe.`,
    };
  }

  const tipo = entrada.tipoAnuncio ?? LISTING_TYPE;
  const quantidade = m.quantidade;
  const atributos = m.atributos;

  // Texto editado passa pelas mesmas regras que filtram a IA.
  const titulo = entrada.titulo?.trim().replace(/\s+/g, " ") || m.titulo;
  const erroTitulo = await conferirTitulo(entrada.productId, entrada.composicao, titulo);
  if (erroTitulo) return { ok: false, erro: erroTitulo };
  const descricaoFinal = entrada.descricao?.trim() || m.descricao;
  const erroDescricao = conferirDescricao(descricaoFinal, cfg.licencaIbama);
  if (erroDescricao) return { ok: false, erro: erroDescricao };

  const item = {
    title: titulo,
    category_id: CATEGORIA_PEIXE,
    price: Number(entrada.preco.toFixed(2)),
    currency_id: "BRL",
    available_quantity: quantidade,
    buying_mode: "buy_it_now",
    listing_type_id: tipo,
    condition: "new",
    // A categoria de peixe não usa Mercado Envios: o frete é combinado, que é
    // justamente o que permite mandar bicho vivo no isopor.
    shipping: { mode: "custom", local_pick_up: false, free_shipping: false },
    // Nasce pausado de propósito. Quem ativa é o dono, depois de conferir.
    status: "paused",
    // Peixe sai só na segunda: o anúncio já nasce dizendo em quantos dias o
    // pedido sai, e o cron mantém o número em dia (lib/mercadolivre/prazo).
    sale_terms: [saleTermPrazo(prazoMl())],
    pictures: m.fotos.map((url) => ({ source: url })),
    // SEM VÍDEO, e não por esquecimento: o ML desligou o vídeo do YouTube por
    // API em 09/2024. O campo `video_id` continua existindo no item e aceita o
    // PUT sem reclamar, mas o valor volta null — testado em produção. Hoje o
    // vídeo entra só como Clip, enviado no painel deles. Não readicionar.
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
    body: { plain_text: descricaoFinal },
  });
  if (!descricao.ok) {
    console.error("[ml] anúncio criado sem descrição", itemId, descricao.erro);
  }

  // Liga na hora: anúncio criado e não ligado é estoque que não sincroniza.
  await prisma.mercadoLivreAnuncio.create({
    data: {
      productId: entrada.productId,
      itemId,
      variationId: null,
      titulo,
      tipoAnuncio: tipo,
      composicao: entrada.composicao,
      prazoEnvioDias: prazoMl(),
      estoqueEnviado: quantidade,
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

export type AtualizacaoOk = { fotos: number; atributos: number };

/**
 * Leva ao anúncio que JÁ EXISTE as fotos atuais do produto e a ficha técnica
 * completa.
 *
 * Existe porque publicar tira uma foto do momento: foto subida no site depois
 * não chega sozinha ao ML, e a qualidade do anúncio cai por "menos de 3 fotos"
 * mesmo com o produto cheio de foto aqui.
 *
 * Não mexe em título, preço nem estoque. Título de anúncio com venda o ML não
 * deixa trocar, preço é decisão do dono e estoque tem sincronização própria.
 * As fotos são SUBSTITUÍDAS pela lista do site, na ordem do site: a primeira
 * vira a capa. Atributo o ML mescla: só muda o que vai no corpo.
 */
export async function atualizarAnuncioNoMl(
  anuncioId: string,
): Promise<MlResult<AtualizacaoOk>> {
  const anuncio = await prisma.mercadoLivreAnuncio.findUnique({
    where: { id: anuncioId },
    select: {
      itemId: true,
      product: {
        select: {
          nome: true,
          padraoCor: true,
          tipo: true,
          imagens: { orderBy: { ordem: "asc" }, select: { url: true, urlAlta: true } },
        },
      },
    },
  });
  if (!anuncio) return { ok: false, erro: "Anúncio não encontrado." };
  const p = anuncio.product;
  if (p.imagens.length === 0) {
    return { ok: false, erro: "O produto não tem foto no site para mandar." };
  }

  let atributos: AtributoMl[] = [];
  if (p.tipo === "PEIXE") {
    // O anúncio não guarda a composição aqui. O gênero que foi publicado está no
    // próprio item, e é dele que sai o tamanho; a quantidade de peixes já está
    // lá e não vai no corpo, então não muda.
    const item = await chamarMl<{ attributes?: { id: string; value_id?: string | null }[] }>(
      `/items/${anuncio.itemId}`,
    );
    if (!item.ok) return item;
    const genero =
      item.dados.attributes?.find((a) => a.id === "ANIMAL_GENDER")?.value_id ??
      GENERO.MISTO;
    atributos = atributosPeixe({
      genero,
      textoParaCor: `${p.nome} ${p.padraoCor ?? ""}`,
    });
  }

  const r = await chamarMl(`/items/${anuncio.itemId}`, {
    method: "PUT",
    body: {
      pictures: p.imagens.slice(0, 10).map((i) => ({ source: i.urlAlta ?? i.url })),
      ...(atributos.length > 0 ? { attributes: atributos } : {}),
    },
  });
  if (!r.ok) {
    await prisma.mercadoLivreAnuncio
      .update({ where: { id: anuncioId }, data: { ultimoErro: r.erro } })
      .catch(() => {});
    return r;
  }

  await prisma.mercadoLivreAnuncio.update({
    where: { id: anuncioId },
    data: { ultimoErro: null },
  });
  return {
    ok: true,
    dados: { fotos: Math.min(p.imagens.length, 10), atributos: atributos.length },
  };
}
