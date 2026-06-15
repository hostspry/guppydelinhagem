import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { ClienteForm } from "@/components/admin/ClienteForm";
import { getClienteById } from "@/lib/queries/clientes";

type Props = { params: Promise<{ id: string }> };

export default async function EditarClientePage({ params }: Props) {
  const { id } = await params;
  const cliente = await getClienteById(id);
  if (!cliente) notFound();

  return (
    <div>
      <PageHeader
        title="Editar cliente"
        description={cliente.nome}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Clientes", href: "/admin/clientes" },
          { label: cliente.nome },
        ]}
      />
      <ClienteForm
        initialData={{
          id: cliente.id,
          nome: cliente.nome,
          telefone: cliente.telefone ?? "",
          email: cliente.email ?? "",
          cpfCnpj: cliente.cpfCnpj ?? "",
          cep: cliente.cep ?? "",
          logradouro: cliente.logradouro ?? "",
          numero: cliente.numero ?? "",
          complemento: cliente.complemento ?? "",
          bairro: cliente.bairro ?? "",
          cidade: cliente.cidade ?? "",
          uf: cliente.uf ?? "",
          observacoes: cliente.observacoes ?? "",
        }}
      />
    </div>
  );
}
