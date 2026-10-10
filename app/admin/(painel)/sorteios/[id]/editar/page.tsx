import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/PageHeader";
import { SorteioForm } from "@/components/admin/sorteios/SorteioForm";
import { paraInput } from "@/lib/sorteios/formato";

export const metadata = { title: "Editar sorteio | Admin" };

export default async function EditarSorteioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.sorteio.findUnique({ where: { id } });
  if (!s) notFound();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Editar sorteio"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Sorteios", href: "/admin/sorteios" },
          { label: s.nome, href: `/admin/sorteios/${s.id}` },
          { label: "Editar" },
        ]}
      />
      <SorteioForm
        id={s.id}
        travado={s.status !== "CONFERENCIA"}
        inicial={{
          nome: s.nome,
          slug: s.slug,
          organizador: s.organizador,
          eventoOrigem: s.eventoOrigem ?? "",
          dataEvento: paraInput(s.dataEvento, false),
          premio: s.premio,
          descricao: s.descricao ?? "",
          regras: s.regras ?? "",
          imagemUrl: s.imagemUrl ?? "",
          transmissaoUrl: s.transmissaoUrl ?? "",
          dataSorteio: paraInput(s.dataSorteio, true),
          publico: s.publico,
          modoSorteio: s.modoSorteio === "LOTERIA_FEDERAL" ? "LOTERIA_FEDERAL" : "ELETRONICO",
          concursoLoteria: s.concursoLoteria ?? "",
        }}
      />
    </div>
  );
}
