import { prisma } from "@/lib/prisma";
import { garantirUnidadesGollog } from "@/lib/gollog/unidades";
import { UnidadesGollogLista } from "@/components/admin/UnidadesGollogLista";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesGollogPage() {
  await garantirUnidadesGollog();
  const unidades = await prisma.unidadeGollog.findMany({
    orderBy: [{ uf: "asc" }, { cidade: "asc" }, { titulo: "asc" }],
    select: {
      id: true,
      titulo: true,
      cidade: true,
      uf: true,
      endereco: true,
      ativa: true,
      naListaGollog: true,
      sincronizadaEm: true,
    },
  });
  const ultima = unidades.reduce<Date | null>(
    (m, u) => (!m || u.sincronizadaEm > m ? u.sincronizadaEm : m),
    null,
  );

  // A chave muda a cada sincronização: a lista da tela recomeça com os dados novos.
  return (
    <UnidadesGollogLista
      key={ultima?.toISOString() ?? "vazia"}
      unidades={unidades}
      ultimaSincronizacao={ultima}
    />
  );
}
