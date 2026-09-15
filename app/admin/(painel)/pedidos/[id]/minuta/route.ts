import { NextResponse, type NextRequest } from "next/server";
import { podeAtual } from "@/lib/permissoes-server";
import { gerarMinutaGollog } from "@/lib/gollog/minuta";

export const dynamic = "force-dynamic";

/** Minuta da Gollog preenchida, para baixar e imprimir. ?nf=texto&volumes=1 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await podeAtual("pedidos.ver"))) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const { id } = await params;
  const nf = req.nextUrl.searchParams.get("nf")?.slice(0, 120) ?? "";
  const volumes = Number(req.nextUrl.searchParams.get("volumes") ?? "1") || 1;

  try {
    const r = await gerarMinutaGollog(id, { notaFiscal: nf, volumes: Math.min(volumes, 99) });
    if (!r) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    return new NextResponse(Buffer.from(r.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${r.nomeArquivo}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[gollog] minuta", e);
    return NextResponse.json({ error: "Não consegui gerar a minuta." }, { status: 500 });
  }
}
