import { prisma } from "@/lib/prisma";
import { ConfigMercadoLivre } from "@/components/admin/ConfigMercadoLivre";
import { diasAteExpirarAutorizacao } from "@/lib/mercadolivre/cliente";
import { urlRedirect, urlNotificacoes } from "@/actions/mercadolivre";
import { disponivelNoAnuncio } from "@/lib/mercadolivre/estoque";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesMercadoLivrePage() {
  const [cfg, ligacoes, produtos] = await Promise.all([
    prisma.integracaoMercadoLivre.findUnique({ where: { id: "default" } }),
    prisma.mercadoLivreAnuncio.findMany({
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        itemId: true,
        variationId: true,
        titulo: true,
        tipoAnuncio: true,
        estoqueEnviado: true,
        sincronizadoEm: true,
        ultimoErro: true,
        composicao: true,
        product: {
          select: {
            nome: true,
            tipo: true,
            estoque: true,
            estoqueMachos: true,
            estoqueFemeas: true,
            variantes: {
              where: { ativo: true },
              select: { composicao: true, qtdMachos: true, qtdFemeas: true, padrao: true },
            },
          },
        },
      },
    }),
    // Peixe ENTRA aqui, diferente da Shopee: o ML aceita peixe ornamental vivo
    // com a licença do IBAMA no anúncio.
    prisma.product.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        tipo: true,
        estoque: true,
        estoqueMachos: true,
        estoqueFemeas: true,
        imagens: { select: { url: true }, take: 1 },
        variantes: {
          where: { ativo: true },
          orderBy: [{ padrao: "desc" }, { ordem: "asc" }],
          select: {
            composicao: true,
            preco: true,
            qtdMachos: true,
            qtdFemeas: true,
          },
        },
      },
    }),
  ]);

  // Peixe vende do pool (machos + fêmeas); o resto vende do estoque da linha.
  const disponivel = (p: {
    tipo: string;
    estoque: number;
    estoqueMachos: number;
    estoqueFemeas: number;
  }) => (p.tipo === "PEIXE" ? p.estoqueMachos + p.estoqueFemeas : p.estoque);

  return (
    <ConfigMercadoLivre
      inicial={{
        ativo: cfg?.ativo ?? false,
        clientId: cfg?.clientId ?? "",
        temSecret: !!cfg?.clientSecretCriptografado,
        sellerId: cfg?.sellerId ?? null,
        apelido: cfg?.apelido ?? null,
        tokenExpiraEm: cfg?.tokenExpiraEm ?? null,
        diasParaExpirar: diasAteExpirarAutorizacao(cfg?.refreshEmitidoEm ?? null),
        ultimaSincronizacaoEm: cfg?.ultimaSincronizacaoEm ?? null,
        ultimoErro: cfg?.ultimoErro ?? null,
      }}
      enderecos={{
        redirect: await urlRedirect(),
        notificacoes: await urlNotificacoes(),
      }}
      ligacoes={ligacoes.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        variationId: l.variationId,
        titulo: l.titulo,
        tipoAnuncio: l.tipoAnuncio,
        estoqueEnviado: l.estoqueEnviado,
        sincronizadoEm: l.sincronizadoEm,
        ultimoErro: l.ultimoErro,
        produtoNome: l.product.nome,
        // Conjuntos da composição do anúncio, igual ao que a sincronização manda.
        produtoEstoque: disponivelNoAnuncio(l.product, l.composicao),
      }))}
      produtos={produtos.map((p) => ({
        id: p.id,
        nome: p.nome,
        estoque: disponivel(p),
        ehPeixe: p.tipo === "PEIXE",
        temFoto: p.imagens.length > 0,
        // Uma composição por anúncio: o preço do ML é um só, e trio, casal e
        // macho têm preços diferentes.
        composicoes: p.variantes.map((v) => ({
          composicao: v.composicao,
          preco: Number(v.preco),
          // Quantos conjuntos o pool sustenta — é o estoque que vai ao anúncio.
          disponivel: (() => {
            const porM = v.qtdMachos > 0 ? Math.floor(p.estoqueMachos / v.qtdMachos) : Infinity;
            const porF = v.qtdFemeas > 0 ? Math.floor(p.estoqueFemeas / v.qtdFemeas) : Infinity;
            const u = Math.min(porM, porF);
            return Number.isFinite(u) ? Math.max(0, u) : 0;
          })(),
        })),
      }))}
      licencaIbama={cfg?.licencaIbama ?? ""}
    />
  );
}
