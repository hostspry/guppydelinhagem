import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TemplateEmailEditor } from "@/components/admin/TemplateEmailEditor";
import { templateDef } from "@/lib/emails/catalogo";
import { carregarTemplate } from "@/lib/emails/render";

export const dynamic = "force-dynamic";

export default async function EditarMensagemPage({
  params,
}: {
  params: Promise<{ chave: string }>;
}) {
  const { chave } = await params;
  const def = templateDef(chave);
  if (!def) notFound();

  const atual = await carregarTemplate(chave);
  if (!atual) notFound();

  return (
    <div>
      <Link
        href="/admin/configuracoes/mensagens"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Todas as mensagens
      </Link>

      <TemplateEmailEditor
        inicial={{
          chave: def.chave,
          rotulo: def.rotulo,
          quando: def.quando,
          variaveis: def.variaveis.map((v) => ({ ...v })),
          assunto: atual.assunto,
          titulo: atual.titulo,
          corpo: atual.corpo,
          ativo: atual.ativo,
          personalizado: atual.personalizado,
        }}
      />
    </div>
  );
}
