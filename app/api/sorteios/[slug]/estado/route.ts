import { NextResponse } from "next/server";
import { getSorteioPublico } from "@/lib/queries/sorteios";

// Estado público do sorteio, para a roleta da página pública girar quando o
// resultado sair. Só o que já é público: status, bilhete e nome público.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getSorteioPublico(slug);
  if (!s) return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
  return NextResponse.json(
    {
      status: s.status,
      resultado:
        s.status === "REALIZADO" && s.bilheteVencedor
          ? { bilhete: s.bilheteVencedor, vencedorPublico: s.vencedorPublico ?? "" }
          : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
