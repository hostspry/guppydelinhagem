import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ContaEmailForm } from "@/components/admin/ContaEmailForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function ConfiguracaoEmailPage() {
  // Sem a senha (nem cifrada): ela não tem por que sair do servidor.
  const c = await prisma.configuracaoEmail.findUnique({
    where: { id: "default" },
    select: {
      ativo: true,
      host: true,
      porta: true,
      seguranca: true,
      usuario: true,
      remetenteNome: true,
      remetenteEmail: true,
      responderPara: true,
      ultimoTesteEm: true,
      ultimoTesteOk: true,
      ultimoTesteErro: true,
    },
  });

  return (
    <div>
      <PageHeader
        title="E-mail"
        description="A conta que o site usa para mandar e-mail aos clientes."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Configurações", href: "/admin/configuracoes" },
          { label: "E-mail" },
        ]}
        action={
          <Link
            href="/admin/configuracoes"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Voltar
          </Link>
        }
      />

      <ContaEmailForm
        inicial={{
          existe: !!c,
          ativo: c?.ativo ?? false,
          host: c?.host ?? "",
          porta: c?.porta ?? 587,
          seguranca: c?.seguranca ?? "STARTTLS",
          usuario: c?.usuario ?? "",
          remetenteNome: c?.remetenteNome ?? "",
          remetenteEmail: c?.remetenteEmail ?? "",
          responderPara: c?.responderPara ?? null,
          ultimoTesteEm: c?.ultimoTesteEm ? dataHora.format(c.ultimoTesteEm) : null,
          ultimoTesteOk: c?.ultimoTesteOk ?? null,
          ultimoTesteErro: c?.ultimoTesteErro ?? null,
        }}
      />
    </div>
  );
}
