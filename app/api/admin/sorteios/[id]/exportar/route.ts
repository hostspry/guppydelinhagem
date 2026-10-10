import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { podeAtual } from "@/lib/permissoes-server";
import { getSorteioAdmin } from "@/lib/queries/sorteios";
import { formatarFaixa } from "@/lib/sorteios/bilhetes";
import { formatarTelefone } from "@/lib/sorteios/telefone";
import { dataHoraBR } from "@/lib/sorteios/formato";

// Relatórios do sorteio em CSV (abre direto no Excel: ";" e BOM UTF-8).
// tipo = participantes | lances | auditoria | lista

function csv(linhas: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + linhas.map((l) => l.map(esc).join(";")).join("\r\n");
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await podeAtual("sorteios.gerenciar"))) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const { id } = await params;
  const tipo = new URL(req.url).searchParams.get("tipo") ?? "participantes";
  const s = await getSorteioAdmin(id);
  if (!s) return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });

  let corpo: string;
  let tipoConteudo = "text/csv; charset=utf-8";
  let ext = "csv";
  const total = s.totalBilhetes ?? s.totalCalculado;

  if (tipo === "lista") {
    const r = await prisma.sorteio.findUnique({ where: { id }, select: { listaCongelada: true } });
    if (!r?.listaCongelada) return NextResponse.json({ erro: "Lista ainda não homologada." }, { status: 404 });
    corpo = r.listaCongelada;
    tipoConteudo = "text/plain; charset=utf-8";
    ext = "txt";
  } else if (tipo === "lances") {
    corpo = csv([
      ["lote_id", "lote", "sequencia", "horario", "participante", "whatsapp", "valor", "tipo", "planilha", "motor", "classificacao", "motivo", "decidido_por"],
      ...s.lances.map((l) => [
        l.loteId,
        l.loteRotulo,
        l.sequencia,
        l.horario ? dataHoraBR(l.horario) : "",
        l.autor,
        l.telefone ? formatarTelefone(l.telefone) : "",
        l.valor != null ? l.valor.toFixed(2).replace(".", ",") : "",
        l.tipo,
        l.classificacaoPlanilha,
        l.classificacaoMotor,
        l.classificacao,
        l.motivo,
        l.decididoPorNome,
      ]),
    ]);
  } else if (tipo === "auditoria") {
    corpo = csv([
      ["quando", "quem", "tipo", "descricao", "justificativa", "hash", "hash_anterior"],
      ...[...s.eventos].reverse().map((e) => [dataHoraBR(e.ocorridoEm), e.atorNome, e.tipo, e.descricao, e.justificativa, e.hash, e.hashAnterior]),
    ]);
  } else {
    corpo = csv([
      [`${s.nome} · ${s.status} · ${total} bilhetes${s.hashLista ? ` · SHA-256 ${s.hashLista}` : " · numeração provisória"}`],
      ["n", "participante", "whatsapp", "chances", "bilhetes", "lances_validos", "conta", "vinculo", "nome_publico", "vencedor"],
      ...s.participantes.map((p) => [
        p.ordem,
        p.nomeOrigem,
        p.telefone ? formatarTelefone(p.telefone) : "",
        p.chances,
        formatarFaixa(p.faixa, total),
        p.lancesValidos,
        p.user ? `${p.user.nome} <${p.user.email}>` : "",
        p.vinculoOrigem ?? (p.telefone ? "aguardando verificação" : "sem WhatsApp"),
        p.nomePublico,
        s.participanteVencedorId === p.id ? `SIM (bilhete ${s.bilheteVencedor})` : "",
      ]),
    ]);
  }

  return new NextResponse(corpo, {
    headers: {
      "Content-Type": tipoConteudo,
      "Content-Disposition": `attachment; filename="sorteio-${s.slug}-${tipo}.${ext}"`,
      "Cache-Control": "no-store",
    },
  });
}
