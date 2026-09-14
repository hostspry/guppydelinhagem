import { prisma } from "@/lib/prisma";
import { ConfigMercadoLivre } from "@/components/admin/ConfigMercadoLivre";
import { diasAteExpirarAutorizacao } from "@/lib/mercadolivre/cliente";
import { urlRedirect, urlNotificacoes } from "@/actions/mercadolivre";

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
        estoqueEnviado: true,
        sincronizadoEm: true,
        ultimoErro: true,
        product: {
          select: {
            nome: true,
            tipo: true,
            estoque: true,
            estoqueMachos: true,
            estoqueFemeas: true,
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
        estoqueEnviado: l.estoqueEnviado,
        sincronizadoEm: l.sincronizadoEm,
        ultimoErro: l.ultimoErro,
        produtoNome: l.product.nome,
        produtoEstoque: disponivel(l.product),
      }))}
      produtos={produtos.map((p) => ({
        id: p.id,
        nome: p.nome,
        estoque: disponivel(p),
        ehPeixe: p.tipo === "PEIXE",
      }))}
    />
  );
}
