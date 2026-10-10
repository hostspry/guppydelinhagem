import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Gift, Ticket } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
import { listSorteiosPublicos } from "@/lib/queries/sorteios";
import { dataHoraBR, dataBR } from "@/lib/sorteios/formato";

export const metadata: Metadata = {
  title: "Sorteios | Guppy de Linhagem",
  description: "Sorteios da Marchezi Guppy Farm: prêmios, regras, datas e resultados.",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function SorteiosPublicosPage() {
  const sorteios = await listSorteiosPublicos();
  const abertos = sorteios.filter((s) => s.status !== "REALIZADO");
  const encerrados = sorteios.filter((s) => s.status === "REALIZADO");

  return (
    <>
      <PageBanner as="h1" title="Sorteios" subtitle="Cada lance válido nos nossos leilões vira um bilhete." />
      <section className="bg-white py-14">
        <div className="container-site space-y-12">
          {sorteios.length === 0 && (
            <p className="mx-auto max-w-md text-center font-light text-text">Nenhum sorteio no momento. Fique de olho nos nossos leilões.</p>
          )}
          {abertos.length > 0 && <Lista titulo="Próximos sorteios" itens={abertos} />}
          {encerrados.length > 0 && <Lista titulo="Resultados" itens={encerrados} />}
          <p className="text-center text-sm font-light text-text">
            Participou de um leilão?{" "}
            <Link href="/login?callbackUrl=/minha-conta/sorteios" className="font-medium text-secondary hover:underline">
              Veja suas chances na sua conta
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}

function Lista({ titulo, itens }: { titulo: string; itens: Awaited<ReturnType<typeof listSorteiosPublicos>> }) {
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-secondary">{titulo}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map((s) => (
          <Link key={s.id} href={`/sorteios/${s.slug}`} className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md">
            <div className="relative aspect-[4/3] bg-primary">
              {s.imagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.imagemUrl} alt={s.premio} className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
              ) : (
                <Gift className="absolute inset-0 m-auto h-14 w-14 text-white/40" aria-hidden="true" />
              )}
            </div>
            <div className="space-y-2 p-5">
              <p className="font-semibold text-primary group-hover:text-secondary">{s.nome}</p>
              <p className="text-sm font-light text-text">{s.premio}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {s.dataSorteio ? dataHoraBR(s.dataSorteio) : `evento ${dataBR(s.dataEvento)}`}
                </span>
                {s.totalBilhetes && (
                  <span className="inline-flex items-center gap-1">
                    <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                    {s.totalBilhetes} chances homologadas
                  </span>
                )}
              </div>
              {s.status === "REALIZADO" && (
                <p className="text-sm font-medium text-green-700">
                  Bilhete {s.bilheteVencedor}: {s.vencedorPublico}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
