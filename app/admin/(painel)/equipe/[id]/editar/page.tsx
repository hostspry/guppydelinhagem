import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { MembroForm } from "@/components/admin/MembroForm";
import { getMembro } from "@/lib/queries/equipe";
import { membroAtual } from "@/lib/permissoes-server";

export default async function EditarMembroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [membro, eu] = await Promise.all([getMembro(id), membroAtual()]);
  if (!membro) notFound();

  return (
    <div>
      <PageHeader
        title={membro.nome}
        description={membro.email}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Equipe", href: "/admin/equipe" },
          { label: "Editar" },
        ]}
      />
      <MembroForm
        initialData={{
          id: membro.id,
          nome: membro.nome,
          email: membro.email,
          role: membro.role,
          limiteDescontoPercent: membro.limiteDescontoPercent,
          podeCancelarPedido: membro.podeCancelarPedido,
          podeEstornar: membro.podeEstornar,
          limiteValorFinanceiro: membro.limiteValorFinanceiro,
        }}
        souEu={membro.id === eu.id}
      />
    </div>
  );
}
