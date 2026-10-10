import Link from "next/link";
import { Plus, PhoneCall, Gift } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { contarVerificacoesPendentes, listSorteiosAdmin, STATUS_SORTEIO_LABEL } from "@/lib/queries/sorteios";
import { dataBR, STATUS_BADGE } from "@/lib/sorteios/formato";

export const metadata = { title: "Sorteios | Admin" };

export default async function SorteiosPage() {
  const [sorteios, verificacoes] = await Promise.all([listSorteiosAdmin(), contarVerificacoesPendentes()]);

  return (
    <div>
      <PageHeader
        title="Sorteios"
        description="Importe os lances, confira as chances, homologue e sorteie. Os bilhetes não têm relação com saldo ou desconto da loja."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Sorteios" }]}
        action={
          <div className="flex gap-2">
            <Link href="/admin/sorteios/verificacoes" className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              Verificar WhatsApp
              {verificacoes > 0 && <span className="rounded-full bg-[#FF035C] px-1.5 text-xs text-white">{verificacoes}</span>}
            </Link>
            <Link href="/admin/sorteios/novo" className="inline-flex items-center gap-1.5 rounded-md bg-[#FF035C] px-4 py-2 text-sm font-medium text-white hover:brightness-110">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo sorteio
            </Link>
          </div>
        }
      />

      {sorteios.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <Gift className="mx-auto mb-2 h-8 w-8 text-[#FAB82A]" aria-hidden="true" />
          <p className="mb-3 text-sm text-gray-500">Nenhum sorteio cadastrado ainda.</p>
          <Link href="/admin/sorteios/novo" className="text-sm font-medium text-[#FF035C] hover:underline">
            Criar o primeiro sorteio →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sorteios.map((s) => {
            const i = s.indicadores;
            return (
              <Link key={s.id} href={`/admin/sorteios/${s.id}`} className="group flex gap-4 rounded-lg border border-gray-200 bg-white p-4 hover:border-[#07366A]">
                {s.imagemUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imagemUrl} alt="" className="h-20 w-20 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-md bg-[#07366A]/5">
                    <Gift className="h-7 w-7 text-[#07366A]/40" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-[#07366A] group-hover:text-[#FF035C]">{s.nome}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s.status]}`}>{STATUS_SORTEIO_LABEL[s.status]}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {s.organizador} · evento {dataBR(s.dataEvento)}
                    {s.dataSorteio && <> · sorteio {dataBR(s.dataSorteio)}</>}
                  </p>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-gray-400">Participantes</dt>
                      <dd className="font-semibold text-[#07366A]">{i.participantes}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">{s.status === "CONFERENCIA" ? "Chances (prelim.)" : "Bilhetes"}</dt>
                      <dd className="font-semibold text-[#07366A]">{s.totalBilhetes ?? i.chancesPreliminares}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Em contas</dt>
                      <dd className="font-semibold text-[#07366A]">{i.creditosVinculados}</dd>
                    </div>
                  </dl>
                  {s.status === "REALIZADO" && (
                    <p className="mt-2 text-xs text-green-700">
                      Bilhete {s.bilheteVencedor}: {s.vencedorPublico}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
