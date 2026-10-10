import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDadosRoleta, getSorteioPublico } from "@/lib/queries/sorteios";
import { RoletaPublica } from "@/components/sorteios/RoletaPublica";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Roleta | Guppy de Linhagem", robots: { index: false, follow: false } };

// Roleta pública: só existe depois da homologação (antes disso os números são
// provisórios e não vão a público).
export default async function RoletaPublicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getSorteioPublico(slug);
  if (!s || (s.status !== "HOMOLOGADO" && s.status !== "REALIZADO")) notFound();
  const dados = await getDadosRoleta(s.id);
  if (!dados) notFound();

  return (
    <section className="bg-white py-8">
      <div className="container-site space-y-4">
        <Link href={`/sorteios/${slug}`} className="inline-flex items-center gap-1 text-sm font-light text-text hover:text-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {dados.nome}
        </Link>
        <RoletaPublica
          slug={slug}
          fatias={dados.fatias}
          total={dados.total}
          premio={dados.premio}
          imagemUrl={dados.imagemUrl}
          statusInicial={dados.status}
          resultadoInicial={dados.resultado ? { bilhete: dados.resultado.bilhete, vencedorPublico: dados.resultado.vencedorPublico } : null}
        />
      </div>
    </section>
  );
}
