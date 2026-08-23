import { PageHeader } from "@/components/admin/PageHeader";
import { CampanhaForm } from "@/components/admin/CampanhaForm";

export default function NovaCampanhaPage() {
  return (
    <div>
      <PageHeader
        title="Nova campanha"
        description="Escreva, escolha para quem vai e dispare (ou agende)."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Campanhas", href: "/admin/campanhas" },
          { label: "Nova" },
        ]}
      />
      <CampanhaForm
        inicial={{
          nome: "",
          assunto: "",
          titulo: "",
          corpo: "",
          publico: "TODOS",
          agendadaPara: "",
        }}
      />
    </div>
  );
}
