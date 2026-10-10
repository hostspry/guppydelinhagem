import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Disc3, Gift, PlayCircle } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
import { getSorteioPublico } from "@/lib/queries/sorteios";
import { dataBR, dataHoraBR, STATUS_CLIENTE } from "@/lib/sorteios/formato";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await getSorteioPublico((await params).slug);
  return {
    title: s ? `${s.nome} | Guppy de Linhagem` : "Sorteio | Guppy de Linhagem",
    robots: { index: false, follow: true },
  };
}

export default async function SorteioPublicoPage({ params }: { params: Promise<{ slug: string }> }) {
  const s = await getSorteioPublico((await params).slug);
  if (!s) notFound();

  return (
    <>
      <PageBanner as="h1" title={s.nome} subtitle={`${s.organizador}${s.eventoOrigem ? ` · ${s.eventoOrigem}` : ""}`} />
      <section className="bg-white py-14">
        <div className="container-site grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-8">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-primary">
              {s.imagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.imagemUrl} alt={s.premio} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <Gift className="absolute inset-0 m-auto h-16 w-16 text-white/40" aria-hidden="true" />
              )}
            </div>
            {s.descricao && <p className="whitespace-pre-line font-light leading-relaxed text-text">{s.descricao}</p>}
            {s.regras && (
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-secondary">Regras</h2>
                <div className="whitespace-pre-line font-light leading-relaxed text-text">{s.regras}</div>
              </div>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="space-y-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Prêmio</p>
                <p className="text-xl font-semibold text-primary">{s.premio}</p>
              </div>
              <dl className="space-y-2 text-sm">
                <Linha rotulo="Situação" valor={STATUS_CLIENTE[s.status]} />
                <Linha rotulo="Evento" valor={dataBR(s.dataEvento)} />
                <Linha rotulo="Sorteio" valor={s.dataSorteio ? dataHoraBR(s.dataSorteio) : "data a definir"} />
                {s.totalBilhetes && <Linha rotulo="Chances homologadas" valor={String(s.totalBilhetes)} />}
                <Linha rotulo="Como é sorteado" valor={s.modoSorteio === "LOTERIA_FEDERAL" ? `Loteria Federal, concurso ${s.concursoLoteria}` : "Sorteio eletrônico entre os bilhetes"} />
              </dl>
              {s.status === "REALIZADO" && (
                <div className="rounded-xl bg-gradient-to-b from-[#FF035C] to-[#87002F] p-4 text-white">
                  <p className="text-xs uppercase tracking-wider text-white/80">Bilhete vencedor</p>
                  <p className="font-mono text-4xl font-bold">{s.bilheteVencedor}</p>
                  <p className="font-semibold">{s.vencedorPublico}</p>
                  <p className="mt-1 text-xs text-white/70">{dataHoraBR(s.realizadoEm)}</p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {(s.status === "HOMOLOGADO" || s.status === "REALIZADO") && (
                  <Link href={`/sorteios/${s.slug}/roleta`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
                    <Disc3 className="h-4 w-4" aria-hidden="true" /> {s.status === "REALIZADO" ? "Ver a roleta" : "Acompanhar na roleta"}
                  </Link>
                )}
                {s.transmissaoUrl && (
                  <a href={s.transmissaoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
                    <PlayCircle className="h-4 w-4" aria-hidden="true" /> Transmissão
                  </a>
                )}
                <Link href="/minha-conta/sorteios" className="text-center text-sm font-medium text-secondary hover:underline">
                  Ver minhas chances
                </Link>
              </div>
            </div>
            {s.hashLista && (
              <p className="break-all text-[11px] font-light text-muted-foreground">
                Lista de bilhetes homologada em {dataHoraBR(s.homologadoEm)}. Impressão digital (SHA-256): <span className="font-mono">{s.hashLista}</span>
              </p>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right font-medium text-primary">{valor}</dd>
    </div>
  );
}
