import { prisma } from "@/lib/prisma";
import { ConfigShopee } from "@/components/admin/ConfigShopee";
import { diasAteExpirarAutorizacao } from "@/lib/shopee/cliente";
import { urlCallback, urlWebhook } from "@/actions/shopee";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesShopeePage() {
  const [cfg, ligacoes, produtos] = await Promise.all([
    prisma.integracaoShopee.findUnique({ where: { id: "default" } }),
    prisma.shopeeAnuncio.findMany({
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        itemId: true,
        modelId: true,
        titulo: true,
        estoqueEnviado: true,
        sincronizadoEm: true,
        ultimoErro: true,
        product: { select: { id: true, nome: true, estoque: true } },
      },
    }),
    // Só produto seco: a Shopee não permite bicho vivo, e o estoque de peixe é
    // por macho e fêmea — não cabe num número só do outro lado.
    prisma.product.findMany({
      where: { tipo: { not: "PEIXE" }, ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, estoque: true },
    }),
  ]);

  return (
    <ConfigShopee
      inicial={{
        ativo: cfg?.ativo ?? false,
        ambiente: cfg?.ambiente ?? "SANDBOX",
        partnerId: cfg?.partnerId ?? "",
        temChave: !!cfg?.partnerKeyCriptografada,
        shopId: cfg?.shopId ?? null,
        tokenExpiraEm: cfg?.tokenExpiraEm ?? null,
        diasParaExpirar: diasAteExpirarAutorizacao(cfg?.refreshEmitidoEm ?? null),
        ultimaSincronizacaoEm: cfg?.ultimaSincronizacaoEm ?? null,
        ultimoErro: cfg?.ultimoErro ?? null,
      }}
      enderecos={{ callback: await urlCallback(), webhook: await urlWebhook() }}
      ligacoes={ligacoes.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        modelId: l.modelId,
        titulo: l.titulo,
        estoqueEnviado: l.estoqueEnviado,
        sincronizadoEm: l.sincronizadoEm,
        ultimoErro: l.ultimoErro,
        produtoNome: l.product.nome,
        produtoEstoque: l.product.estoque,
      }))}
      produtos={produtos}
    />
  );
}
