import Link from "next/link";
import { Plus, Mail } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ROTULO: Record<string, { texto: string; cor: string }> = {
  RASCUNHO: { texto: "rascunho", cor: "bg-gray-100 text-gray-600" },
  AGENDADA: { texto: "agendada", cor: "bg-blue-50 text-blue-700" },
  ENVIANDO: { texto: "enviando", cor: "bg-amber-50 text-amber-700" },
  ENVIADA: { texto: "enviada", cor: "bg-green-50 text-green-700" },
  CANCELADA: { texto: "cancelada", cor: "bg-gray-100 text-gray-500" },
};

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function CampanhasPage() {
  const campanhas = await prisma.campanhaEmail.findMany({
    orderBy: { criadaEm: "desc" },
    include: { _count: { select: { envios: true } } },
  });

  // Enviados por campanha numa consulta só, em vez de uma por linha.
  const enviados = await prisma.envioCampanha.groupBy({
    by: ["campanhaId"],
    where: { enviadoEm: { not: null } },
    _count: { _all: true },
  });
  const porCampanha = new Map(enviados.map((e) => [e.campanhaId, e._count._all]));

  return (
    <div>
      <PageHeader
        title="Campanhas"
        description="Promoções e avisos por e-mail, com envio na hora ou agendado."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Campanhas" }]}
        action={
          <Link
            href="/admin/campanhas/nova"
            className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Nova campanha
          </Link>
        }
      />

      <div className="space-y-3 max-w-3xl">
        {campanhas.map((c) => {
          const r = ROTULO[c.status] ?? ROTULO.RASCUNHO;
          const total = c._count.envios;
          const feitos = porCampanha.get(c.id) ?? 0;
          return (
            <Link
              key={c.id}
              href={`/admin/campanhas/${c.id}`}
              className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="w-9 h-9 rounded-md bg-[#07366A]/10 text-[#07366A] flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#07366A]">{c.nome}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{c.assunto}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {c.status === "AGENDADA" && c.agendadaPara
                    ? `Agendada para ${dataHora.format(c.agendadaPara)}`
                    : total > 0
                      ? `${feitos} de ${total} enviados`
                      : `Criada em ${dataHora.format(c.criadaEm)}`}
                </p>
              </div>
              <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${r.cor}`}>
                {r.texto}
              </span>
            </Link>
          );
        })}

        {campanhas.length === 0 && (
          <p className="text-sm text-gray-500">
            Nenhuma campanha ainda. Crie a primeira para avisar seus clientes de
            uma promoção.
          </p>
        )}
      </div>
    </div>
  );
}
