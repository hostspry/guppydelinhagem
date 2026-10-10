import { PageHeader } from "@/components/admin/PageHeader";
import { SorteioForm } from "@/components/admin/sorteios/SorteioForm";

export const metadata = { title: "Novo sorteio | Admin" };

export default function NovoSorteioPage() {
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Novo sorteio"
        description="Cadastre o sorteio e o prêmio. A lista de participantes entra depois, por importação."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Sorteios", href: "/admin/sorteios" }, { label: "Novo" }]}
      />
      <SorteioForm
        id={null}
        travado={false}
        inicial={{
          nome: "",
          slug: "",
          organizador: "Marchezi Guppy Farm",
          eventoOrigem: "",
          dataEvento: "",
          premio: "",
          descricao: "",
          regras: "",
          imagemUrl: "",
          transmissaoUrl: "",
          dataSorteio: "",
          publico: false,
          modoSorteio: "ELETRONICO",
          concursoLoteria: "",
        }}
      />
    </div>
  );
}
