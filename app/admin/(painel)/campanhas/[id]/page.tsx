import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { CampanhaForm } from "@/components/admin/CampanhaForm";
import { CampanhaAcoes } from "@/components/admin/CampanhaAcoes";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

/** Date → "AAAA-MM-DDTHH:mm" no horário de Brasília, que é o que o input espera. */
function paraInputLocal(d: Date | null): string {
  if (!d) return "";
  const br = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return br.toISOString().slice(0, 16);
}

export default async function CampanhaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await prisma.campanhaEmail.findUnique({ where: { id } });
  if (!c) notFound();

  const [total, enviados, falhas] = await Promise.all([
    prisma.envioCampanha.count({ where: { campanhaId: id } }),
    prisma.envioCampanha.count({ where: { campanhaId: id, enviadoEm: { not: null } } }),
    prisma.envioCampanha.count({
      where: { campanhaId: id, enviadoEm: null, tentativas: { gte: 3 } },
    }),
  ]);
  const pendentes = total - enviados - falhas;

  // Quem não recebeu: o que interessa é o motivo, para corrigir o cadastro.
  const problemas = await prisma.envioCampanha.findMany({
    where: { campanhaId: id, erro: { not: null }, enviadoEm: null },
    select: { email: true, erro: true, tentativas: true },
    take: 10,
  });

  const disparada = c.status === "ENVIADA" || c.status === "ENVIANDO";

  return (
    <div>
      <PageHeader
        title={c.nome}
        description={c.assunto}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Campanhas", href: "/admin/campanhas" },
          { label: c.nome },
        ]}
        action={
          <Link
            href="/admin/campanhas"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Voltar
          </Link>
        }
      />

      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 max-w-3xl">
          {[
            { rotulo: "Na lista", valor: total, cor: "text-[#07366A]" },
            { rotulo: "Enviados", valor: enviados, cor: "text-green-700" },
            { rotulo: "Na fila", valor: pendentes, cor: "text-amber-700" },
            { rotulo: "Não saíram", valor: falhas, cor: "text-[#FF035C]" },
          ].map((s) => (
            <div key={s.rotulo} className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">{s.rotulo}</p>
              <p className={`text-2xl font-bold ${s.cor}`}>{s.valor}</p>
            </div>
          ))}
        </div>
      )}

      {c.status === "AGENDADA" && c.agendadaPara && (
        <p className="mb-5 max-w-3xl text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-3">
          Agendada para <strong>{dataHora.format(c.agendadaPara)}</strong>. Sai
          sozinha nesse horário — ou use &ldquo;Enviar agora&rdquo; para adiantar.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] mb-6">
        <div className="lg:col-span-2">
          <CampanhaAcoes
            id={c.id}
            status={c.status}
            nome={c.nome}
            pendentes={pendentes}
          />
        </div>
      </div>

      {problemas.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 max-w-3xl">
          <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
            E-mails que não saíram
          </h2>
          <ul className="space-y-1.5 text-sm">
            {problemas.map((p) => (
              <li key={p.email} className="flex flex-wrap gap-x-2 text-gray-600">
                <span className="text-[#07366A]">{p.email}</span>
                <span className="text-xs text-gray-500">
                  {p.erro} {p.tentativas >= 3 && "(desistiu depois de 3 tentativas)"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CampanhaForm
        inicial={{
          id: c.id,
          nome: c.nome,
          assunto: c.assunto,
          titulo: c.titulo,
          corpo: c.corpo,
          publico: c.publico,
          agendadaPara: paraInputLocal(c.agendadaPara),
          bloqueada: disparada,
        }}
      />
    </div>
  );
}
