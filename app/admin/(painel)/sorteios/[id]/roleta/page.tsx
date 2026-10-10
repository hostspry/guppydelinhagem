import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDadosRoleta, STATUS_SORTEIO_LABEL } from "@/lib/queries/sorteios";
import { RoletaAdmin } from "@/components/admin/sorteios/RoletaAdmin";

export const metadata = { title: "Roleta | Admin" };

export default async function RoletaAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await getDadosRoleta(id);
  if (!dados) notFound();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/admin/sorteios/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#07366A]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {dados.nome}
        </Link>
        <span className="text-xs text-gray-500">
          {STATUS_SORTEIO_LABEL[dados.status]} · {dados.total} bilhetes · {dados.modoSorteio === "LOTERIA_FEDERAL" ? `Loteria Federal ${dados.concursoLoteria}` : "sorteio eletrônico no servidor"}
        </span>
      </div>
      {dados.total === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Importe os participantes para montar a roleta.</p>
      ) : (
        <RoletaAdmin dados={dados} />
      )}
      <p className="text-xs text-gray-500">
        Para a transmissão, use o botão de tela cheia no canto da roleta. O número sai do servidor no clique em Sortear; a roleta só mostra o resultado.
      </p>
    </div>
  );
}
