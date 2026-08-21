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
