import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * Números agregados da página de Visitantes.
 *
 * SQL cru e não Prisma aqui, de propósito: agrupar por dia/semana/mês em cima
 * de um DateTime exige `date_trunc` no fuso certo, e o `groupBy` do Prisma não
 * alcança isso. Como tudo é gerado por parâmetro ($1, $2), não há concatenação
 * de valor em texto de consulta.
 *
 * Todo corte de tempo acontece em **America/Sao_Paulo**. O banco guarda UTC, e
 * agrupar em UTC jogaria as visitas das 21h às 23h59 para o dia seguinte — os
 * dois horários de maior movimento de uma loja.
 */

import {
  BALDE,
  FUSO,
  inicioDoPeriodo as inicio,
  type Periodo,
} from "@/lib/rastreio/periodo";

// Reexporta o que a tela usa, para a página não precisar saber que a lista de
// períodos mora noutro arquivo. O que é puro vive em lib/rastreio/periodo:
// o seletor é Client Component e não pode importar nada que puxe Prisma.
export {
  PERIODOS,
  ehPeriodo,
  rotularInstante,
  type Periodo,
} from "@/lib/rastreio/periodo";

export type PontoTempo = { instante: Date; sessoes: number; pessoas: number };

/**
 * Movimento ao longo do tempo: sessões e pessoas distintas por balde.
 *
 * Baldes vazios entram com zero (`generate_series`): sem isso, um dia sem visita
 * some do gráfico e a linha liga o dia anterior ao seguinte como se nada tivesse
 * acontecido — o buraco vira uma reta que mente.
 */
export async function movimentoNoTempo(p: Periodo): Promise<PontoTempo[]> {
  const balde = BALDE[p];
  const desde = inicio(p);

  const linhas = await prisma.$queryRaw<
    { instante: Date; sessoes: bigint; pessoas: bigint }[]
  >(Prisma.sql`
    WITH baldes AS (
      SELECT generate_series(
        date_trunc(${balde}, ${desde}::timestamptz AT TIME ZONE ${FUSO}),
        date_trunc(${balde}, now() AT TIME ZONE ${FUSO}),
        ${`1 ${balde}`}::interval
      ) AS instante
    ),
    dados AS (
      SELECT
        date_trunc(${balde}, "iniciadaEm" AT TIME ZONE ${FUSO}) AS instante,
        count(*) AS sessoes,
        count(DISTINCT "visitanteId") AS pessoas
      FROM "SessaoVisita"
      WHERE "iniciadaEm" >= ${desde}
      GROUP BY 1
    )
    SELECT b.instante, COALESCE(d.sessoes, 0) AS sessoes, COALESCE(d.pessoas, 0) AS pessoas
    FROM baldes b
    LEFT JOIN dados d ON d.instante = b.instante
    ORDER BY b.instante
  `);

  return linhas.map((l) => ({
    instante: l.instante,
    sessoes: Number(l.sessoes),
    pessoas: Number(l.pessoas),
  }));
}

export type EtapaFunil = { chave: string; rotulo: string; pessoas: number };

/**
 * Funil de compra, contado em PESSOAS e não em eventos.
 *
 * A diferença importa: quem recarrega a página do produto seis vezes conta uma
 * vez aqui. Contando evento, a taxa de conversão cairia junto com a paciência do
 * visitante, o que não diz nada sobre a loja.
 */
export async function funil(p: Periodo): Promise<EtapaFunil[]> {
  const desde = inicio(p);

  const linhas = await prisma.$queryRaw<{ tipo: string; pessoas: bigint }[]>(
    Prisma.sql`
      SELECT tipo, count(DISTINCT "visitanteId") AS pessoas
      FROM "EventoVisitante"
      WHERE "ocorridoEm" >= ${desde}
        AND tipo IN ('pagina_vista','produto_visto','carrinho_add','checkout_iniciado','pedido_criado')
      GROUP BY tipo
    `,
  );

  const conta = new Map(linhas.map((l) => [l.tipo, Number(l.pessoas)]));
  return [
    { chave: "pagina_vista", rotulo: "Entrou no site", pessoas: conta.get("pagina_vista") ?? 0 },
    { chave: "produto_visto", rotulo: "Olhou um peixe", pessoas: conta.get("produto_visto") ?? 0 },
    { chave: "carrinho_add", rotulo: "Pôs no carrinho", pessoas: conta.get("carrinho_add") ?? 0 },
    { chave: "checkout_iniciado", rotulo: "Foi ao checkout", pessoas: conta.get("checkout_iniciado") ?? 0 },
    { chave: "pedido_criado", rotulo: "Fechou o pedido", pessoas: conta.get("pedido_criado") ?? 0 },
  ];
}

/**
 * Pedidos do site realmente pagos na janela.
 *
 * O último passo do funil vem do rastreio, e rastreio depende do navegador do
 * cliente chegar na página de sucesso com o script ligado. Este número vem da
 * tabela de pedidos, então é o que aconteceu de fato. Pedido do WhatsApp e da
 * Shopee fica de fora: eles não passaram pelo funil do site.
 */
export async function pedidosPagosDoPeriodo(p: Periodo): Promise<number> {
  return prisma.order.count({
    where: {
      tipo: "PEDIDO",
      origem: "SITE",
      criadoEm: { gte: inicio(p) },
      status: { in: ["PAGO", "ENVIADO", "ENTREGUE"] },
    },
  });
}

export type Fatia = { rotulo: string; total: number };

/**
 * De onde vieram as visitas.
 *
 * UTM manda quando existe (é o que a gente mesmo marcou nos links); sem UTM,
 * o domínio do referrer; sem referrer, "direto" — que junta digitou o endereço,
 * salvou nos favoritos e clicou num app que não repassa origem.
 *
 * O próprio site é descartado: navegação interna não é origem de visita.
 */
export async function origens(p: Periodo, limite = 8): Promise<Fatia[]> {
  const desde = inicio(p);

  const linhas = await prisma.$queryRaw<{ rotulo: string; total: bigint }[]>(
    Prisma.sql`
      SELECT
        COALESCE(
          NULLIF("utmSource", ''),
          NULLIF(regexp_replace(split_part(regexp_replace(referrer, '^https?://', ''), '/', 1), '^www\\.', ''), ''),
          'direto'
        ) AS rotulo,
        count(*) AS total
      FROM "SessaoVisita"
      WHERE "iniciadaEm" >= ${desde}
      GROUP BY 1
      HAVING COALESCE(
        NULLIF("utmSource", ''),
        NULLIF(regexp_replace(split_part(regexp_replace(referrer, '^https?://', ''), '/', 1), '^www\\.', ''), ''),
        'direto'
      ) NOT IN ('guppydelinhagem.com.br')
      ORDER BY 2 DESC
      LIMIT ${limite}
    `,
  );
  return linhas.map((l) => ({ rotulo: l.rotulo, total: Number(l.total) }));
}

/** Celular, computador, tablet. */
export async function dispositivos(p: Periodo): Promise<Fatia[]> {
  const desde = inicio(p);
  const linhas = await prisma.$queryRaw<{ rotulo: string; total: bigint }[]>(
    Prisma.sql`
      SELECT COALESCE(NULLIF(dispositivo, ''), 'não identificado') AS rotulo, count(*) AS total
      FROM "SessaoVisita"
      WHERE "iniciadaEm" >= ${desde}
      GROUP BY 1 ORDER BY 2 DESC
    `,
  );
  return linhas.map((l) => ({ rotulo: l.rotulo, total: Number(l.total) }));
}

export type Cidade = { cidade: string; uf: string | null; total: number };

/**
 * Cidades. Só aparece quem consentiu com o rastreio — sem consentimento não há
 * geolocalização, e essas visitas ficam de fora da conta em vez de virar "?".
 * Por isso o total daqui é sempre menor que o de sessões, e a tela diz isso.
 */
export async function cidades(p: Periodo, limite = 8): Promise<{
  itens: Cidade[];
  semLocalizacao: number;
}> {
  const desde = inicio(p);
  const [linhas, sem] = await Promise.all([
    prisma.$queryRaw<{ cidade: string; uf: string | null; total: bigint }[]>(
      Prisma.sql`
        SELECT cidade, regiao AS uf, count(*) AS total
        FROM "SessaoVisita"
        WHERE "iniciadaEm" >= ${desde} AND cidade IS NOT NULL AND cidade <> ''
        GROUP BY 1, 2 ORDER BY 3 DESC LIMIT ${limite}
      `,
    ),
    prisma.sessaoVisita.count({
      where: { iniciadaEm: { gte: desde }, OR: [{ cidade: null }, { cidade: "" }] },
    }),
  ]);
  return {
    itens: linhas.map((l) => ({ cidade: l.cidade, uf: l.uf, total: Number(l.total) })),
    semLocalizacao: sem,
  };
}

export type ResumoPeriodo = {
  sessoes: number;
  pessoas: number;
  novos: number;
  eventos: number;
  buscas: number;
  /** Sessões com um único evento — entrou e saiu sem clicar em nada. */
  saidaDireta: number;
  /** Variação percentual contra o período anterior, do mesmo tamanho. */
  variacaoSessoes: number | null;
};

/**
 * Números do topo, com comparação contra o período anterior do mesmo tamanho.
 *
 * A comparação é o que transforma um número em informação: "75 visitas" não diz
 * nada sozinho; "75, 20% acima da semana passada" diz.
 */
export async function resumoDoPeriodo(p: Periodo): Promise<ResumoPeriodo> {
  const desde = inicio(p);
  const duracao = Date.now() - desde.getTime();
  const anterior = new Date(desde.getTime() - duracao);

  const [atual, previo] = await Promise.all([
    prisma.$queryRaw<
      {
        sessoes: bigint;
        pessoas: bigint;
        novos: bigint;
        eventos: bigint;
        buscas: bigint;
        saida_direta: bigint;
      }[]
    >(Prisma.sql`
      SELECT
        (SELECT count(*) FROM "SessaoVisita" WHERE "iniciadaEm" >= ${desde}) AS sessoes,
        (SELECT count(DISTINCT "visitanteId") FROM "SessaoVisita" WHERE "iniciadaEm" >= ${desde}) AS pessoas,
        (SELECT count(*) FROM "Visitante" WHERE "primeiroAcesso" >= ${desde}) AS novos,
        (SELECT count(*) FROM "EventoVisitante" WHERE "ocorridoEm" >= ${desde}) AS eventos,
        (SELECT count(*) FROM "EventoVisitante" WHERE "ocorridoEm" >= ${desde} AND tipo = 'busca') AS buscas,
        (SELECT count(*) FROM (
           SELECT s.id FROM "SessaoVisita" s
           LEFT JOIN "EventoVisitante" e ON e."sessaoId" = s.id
           WHERE s."iniciadaEm" >= ${desde}
           GROUP BY s.id HAVING count(e.id) <= 1
         ) x) AS saida_direta
    `),
    prisma.sessaoVisita.count({
      where: { iniciadaEm: { gte: anterior, lt: desde } },
    }),
  ]);

  const a = atual[0];
  const sessoes = Number(a?.sessoes ?? 0);

  return {
    sessoes,
    pessoas: Number(a?.pessoas ?? 0),
    novos: Number(a?.novos ?? 0),
    eventos: Number(a?.eventos ?? 0),
    buscas: Number(a?.buscas ?? 0),
    saidaDireta: Number(a?.saida_direta ?? 0),
    // Sem período anterior não existe variação. Zero seria mentira: "0%" diz
    // "ficou igual", e o certo é não ter o que dizer.
    variacaoSessoes:
      previo > 0 ? Math.round(((sessoes - previo) / previo) * 100) : null,
  };
}

export type TermoBusca = { termo: string; vezes: number };

/**
 * O que as pessoas digitaram na busca. É o pedido do cliente em texto livre —
 * termo que aparece muito e não tem produto correspondente é linhagem a criar.
 */
export async function buscasMaisFeitas(p: Periodo, limite = 10): Promise<TermoBusca[]> {
  const desde = inicio(p);
  const linhas = await prisma.$queryRaw<{ termo: string; vezes: bigint }[]>(
    Prisma.sql`
      SELECT lower(trim(busca)) AS termo, count(*) AS vezes
      FROM "EventoVisitante"
      WHERE "ocorridoEm" >= ${desde} AND tipo = 'busca'
        AND busca IS NOT NULL AND trim(busca) <> ''
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT ${limite}
    `,
  );
  return linhas.map((l) => ({ termo: l.termo, vezes: Number(l.vezes) }));
}

/** Produtos mais olhados na janela escolhida (a versão antiga era fixa em 30 dias). */
export async function produtosDoPeriodo(p: Periodo, limite = 10) {
  const desde = inicio(p);
  const linhas = await prisma.$queryRaw<
    { produtoId: string; nome: string; vistas: bigint; carrinho: bigint }[]
  >(Prisma.sql`
    SELECT
      "produtoId",
      COALESCE(max("produtoNome"), 'produto removido') AS nome,
      count(*) FILTER (WHERE tipo = 'produto_visto') AS vistas,
      count(*) FILTER (WHERE tipo = 'carrinho_add') AS carrinho
    FROM "EventoVisitante"
    WHERE "ocorridoEm" >= ${desde}
      AND "produtoId" IS NOT NULL
      AND tipo IN ('produto_visto','carrinho_add')
    GROUP BY "produtoId"
    HAVING count(*) FILTER (WHERE tipo = 'produto_visto') > 0
    ORDER BY 3 DESC
    LIMIT ${limite}
  `);
  return linhas.map((l) => ({
    produtoId: l.produtoId,
    nome: l.nome,
    vistas: Number(l.vistas),
    carrinho: Number(l.carrinho),
  }));
}
