"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertPermissao } from "@/lib/permissoes-server";
import { SemPermissaoError, type MembroAtual } from "@/lib/permissoes";
import { auditar } from "@/lib/auditoria";
import { uploadImage } from "@/lib/s3";
import { otimizarImagemProduto } from "@/lib/imagem";
import { lerCsv } from "@/lib/sorteios/csv";
import * as S from "@/lib/sorteios/servico";
import { buscarContas } from "@/lib/queries/sorteios";

// Actions do painel de sorteios. Toda regra vive em lib/sorteios/servico.ts;
// aqui só entra permissão, tradução de erro e revalidação de tela.

export type Resultado<T = undefined> =
  | ({ ok: true; mensagem?: string } & (T extends undefined ? object : { dados: T }))
  | { ok: false; erro: string };

async function ator(): Promise<{ membro: MembroAtual; ator: S.Ator }> {
  const membro = await assertPermissao("sorteios.gerenciar");
  return { membro, ator: { id: membro.id, nome: membro.nome } };
}

function erro(e: unknown): { ok: false; erro: string } {
  if (e instanceof S.ErroSorteio || e instanceof SemPermissaoError) return { ok: false, erro: e.message };
  console.error("[sorteios]", e);
  return { ok: false, erro: "Não foi possível concluir. Tente de novo." };
}

function revalidar(id: string) {
  revalidatePath("/admin/sorteios");
  revalidatePath(`/admin/sorteios/${id}`);
  revalidatePath("/minha-conta/sorteios");
  revalidatePath("/sorteios", "layout");
}

// ── Cadastro ─────────────────────────────────────────────────────────────────

const dataOuNull = z
  .string()
  .optional()
  .transform((s) => {
    if (!s) return null;
    // <input type="datetime-local"> vem sem fuso: é horário de Brasília.
    const d = new Date(s.length === 10 ? `${s}T12:00:00-03:00` : `${s}:00-03:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  });
const textoOuNull = z
  .string()
  .optional()
  .transform((s) => (s?.trim() ? s.trim() : null));

const sorteioSchema = z.object({
  nome: z.string().trim().min(3, "Nome muito curto"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífen"),
  organizador: z.string().trim().min(2, "Informe o organizador"),
  eventoOrigem: textoOuNull,
  dataEvento: dataOuNull,
  premio: z.string().trim().min(2, "Informe o prêmio"),
  descricao: textoOuNull,
  regras: textoOuNull,
  imagemUrl: textoOuNull,
  transmissaoUrl: textoOuNull.refine((u) => !u || /^https?:\/\//.test(u), "Link precisa começar com http"),
  dataSorteio: dataOuNull,
  publico: z.string().optional().transform((v) => v === "on" || v === "true"),
  modoSorteio: z.enum(["ELETRONICO", "LOTERIA_FEDERAL"]),
  concursoLoteria: textoOuNull,
});

export async function salvarSorteioAction(
  id: string | null,
  _prev: unknown,
  form: FormData,
): Promise<{ ok: false; erro: string; campos?: Record<string, string[]> } | { ok: true }> {
  let novoId: string;
  try {
    const { membro, ator: a } = await ator();
    const p = sorteioSchema.safeParse(Object.fromEntries(form));
    if (!p.success) {
      return { ok: false, erro: "Confira os campos.", campos: z.flattenError(p.error).fieldErrors };
    }
    novoId = await S.salvarSorteio(id, p.data, a);
    await auditar(membro, {
      acao: id ? "sorteio.editar" : "sorteio.criar",
      entidade: "Sorteio",
      entidadeId: novoId,
      descricao: `${id ? "Editou" : "Criou"} o sorteio "${p.data.nome}".`,
    });
    revalidar(novoId);
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return { ok: false, erro: "Já existe um sorteio com este endereço (slug)." };
    return erro(e);
  }
  redirect(`/admin/sorteios/${novoId}`);
}

export async function uploadImagemSorteio(form: FormData): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  try {
    await ator();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, erro: "Nenhum arquivo enviado." };
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return { ok: false, erro: "Use JPG, PNG ou WebP." };
    }
    if (file.size > 9 * 1024 * 1024) return { ok: false, erro: "Imagem muito grande (máx 9 MB)." };
    const original = Buffer.from(await file.arrayBuffer());
    try {
      const o = await otimizarImagemProduto(original);
      return { ok: true, url: await uploadImage(o.site.buffer, o.contentType, o.ext) };
    } catch {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      return { ok: true, url: await uploadImage(original, file.type, ext) };
    }
  } catch (e) {
    return erro(e);
  }
}

// ── Importações ──────────────────────────────────────────────────────────────

async function textoDoForm(form: FormData): Promise<string> {
  const f = form.get("arquivo");
  if (f instanceof File && f.size > 0) {
    if (f.size > 5 * 1024 * 1024) throw new S.ErroSorteio("Arquivo muito grande (máx 5 MB).");
    return await f.text();
  }
  const t = String(form.get("texto") ?? "");
  if (!t.trim()) throw new S.ErroSorteio("Envie um arquivo CSV ou cole o conteúdo.");
  return t;
}

export async function importarParticipantesAction(sorteioId: string, form: FormData): Promise<Resultado<S.ResumoImportacao>> {
  try {
    const { membro, ator: a } = await ator();
    const { linhas } = lerCsv(await textoDoForm(form));
    const r = await S.importarParticipantes(sorteioId, linhas, a, String(form.get("justificativa") ?? ""));
    await auditar(membro, {
      acao: "sorteio.importar_participantes",
      entidade: "Sorteio",
      entidadeId: sorteioId,
      descricao: `Importou participantes: ${r.novos} novos, ${r.atualizados} alterados, ${r.iguais} iguais.`,
    });
    revalidar(sorteioId);
    return { ok: true, dados: r };
  } catch (e) {
    return erro(e);
  }
}

export async function importarLancesAction(sorteioId: string, form: FormData): Promise<Resultado<S.ResumoLances>> {
  try {
    const { membro, ator: a } = await ator();
    const { linhas } = lerCsv(await textoDoForm(form));
    const r = await S.importarLances(sorteioId, linhas, a);
    await auditar(membro, {
      acao: "sorteio.importar_lances",
      entidade: "Sorteio",
      entidadeId: sorteioId,
      descricao: `Importou ${r.lidos} lances (${r.novos} novos).`,
    });
    revalidar(sorteioId);
    return { ok: true, dados: r };
  } catch (e) {
    return erro(e);
  }
}

// ── Conferência ──────────────────────────────────────────────────────────────

export async function decidirLanceAction(sorteioId: string, lanceId: string, classificacao: "VALIDO" | "INVALIDO", justificativa: string): Promise<Resultado> {
  try {
    const { ator: a } = await ator();
    await S.decidirLance(sorteioId, lanceId, classificacao, justificativa, a);
    revalidar(sorteioId);
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

export async function corrigirChancesAction(sorteioId: string, participanteId: string, chances: number, justificativa: string): Promise<Resultado> {
  try {
    const { ator: a } = await ator();
    await S.corrigirChances(sorteioId, participanteId, chances, justificativa, a);
    revalidar(sorteioId);
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

export async function aplicarChancesDosLancesAction(sorteioId: string, participanteId: string, justificativa: string): Promise<Resultado> {
  try {
    const { ator: a } = await ator();
    await S.aplicarChancesDosLances(sorteioId, participanteId, justificativa, a);
    revalidar(sorteioId);
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

export async function informarTelefoneAction(sorteioId: string, participanteId: string, telefone: string, justificativa: string): Promise<Resultado> {
  try {
    const { ator: a } = await ator();
    const n = await S.informarTelefone(sorteioId, participanteId, telefone, justificativa, a);
    revalidar(sorteioId);
    return { ok: true, mensagem: n ? "Telefone salvo e créditos ligados à conta verificada." : "Telefone salvo. Os créditos ficam esperando a verificação." };
  } catch (e) {
    return erro(e);
  }
}

export async function vincularManualAction(sorteioId: string, participanteId: string, userId: string, justificativa: string): Promise<Resultado> {
  try {
    const { membro, ator: a } = await ator();
    await S.vincularManual(sorteioId, participanteId, userId, justificativa, a);
    await auditar(membro, {
      acao: "sorteio.vincular_manual",
      entidade: "ParticipanteSorteio",
      entidadeId: participanteId,
      descricao: `Vinculou manualmente um participante a uma conta. Justificativa: ${justificativa}`,
    });
    revalidar(sorteioId);
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

export async function desvincularAction(sorteioId: string, participanteId: string, justificativa: string): Promise<Resultado> {
  try {
    const { ator: a } = await ator();
    await S.desvincular(sorteioId, participanteId, justificativa, a);
    revalidar(sorteioId);
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

export async function buscarContasAction(q: string) {
  await ator();
  return buscarContas(q);
}

// ── Homologação e sorteio ────────────────────────────────────────────────────

export async function homologarAction(sorteioId: string, observacao: string): Promise<Resultado<{ total: number; hash: string }>> {
  try {
    const { membro, ator: a } = await ator();
    const r = await S.homologar(sorteioId, a, observacao);
    await auditar(membro, {
      acao: "sorteio.homologar",
      entidade: "Sorteio",
      entidadeId: sorteioId,
      descricao: `Homologou ${r.total} bilhetes (SHA-256 ${r.hash.slice(0, 16)}…).`,
    });
    revalidar(sorteioId);
    return { ok: true, dados: r };
  } catch (e) {
    return erro(e);
  }
}

export async function retificarHomologacaoAction(sorteioId: string, justificativa: string): Promise<Resultado> {
  try {
    const { membro, ator: a } = await ator();
    await S.retificarHomologacao(sorteioId, justificativa, a);
    await auditar(membro, {
      acao: "sorteio.retificar",
      entidade: "Sorteio",
      entidadeId: sorteioId,
      descricao: `Desfez a homologação. Justificativa: ${justificativa}`,
    });
    revalidar(sorteioId);
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

export async function cancelarSorteioAction(sorteioId: string, justificativa: string): Promise<Resultado> {
  try {
    const { membro, ator: a } = await ator();
    await S.cancelarSorteio(sorteioId, justificativa, a);
    await auditar(membro, {
      acao: "sorteio.cancelar",
      entidade: "Sorteio",
      entidadeId: sorteioId,
      descricao: `Cancelou o sorteio. Justificativa: ${justificativa}`,
    });
    revalidar(sorteioId);
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}

export type ResultadoRoleta = { bilhete: number; total: number; vencedorPublico: string; ensaio: boolean };

/**
 * Sorteio de verdade. A confirmação digitada é a última trava contra clique
 * acidental: sem ela, nada acontece.
 */
export async function realizarSorteioAction(
  sorteioId: string,
  confirmacao: string,
  premiosLoteria?: string[],
): Promise<Resultado<ResultadoRoleta>> {
  try {
    const { membro, ator: a } = await ator();
    if (confirmacao.trim().toUpperCase() !== "SORTEAR") {
      return { ok: false, erro: 'Digite SORTEAR para confirmar.' };
    }
    const r = await S.realizarSorteio(sorteioId, a, { premiosLoteria });
    await auditar(membro, {
      acao: "sorteio.realizar",
      entidade: "Sorteio",
      entidadeId: sorteioId,
      descricao: `Realizou o sorteio: bilhete ${r.bilhete} de ${r.total} (${r.vencedorPublico}).`,
    });
    revalidar(sorteioId);
    return { ok: true, dados: { bilhete: r.bilhete, total: r.total, vencedorPublico: r.vencedorPublico, ensaio: false } };
  } catch (e) {
    return erro(e);
  }
}

export async function ensaioSorteioAction(sorteioId: string): Promise<Resultado<ResultadoRoleta>> {
  try {
    const { ator: a } = await ator();
    const r = await S.ensaioSorteio(sorteioId, a);
    revalidatePath(`/admin/sorteios/${sorteioId}`);
    return { ok: true, dados: { ...r, ensaio: true } };
  } catch (e) {
    return erro(e);
  }
}

// ── Verificação de telefone (lado da equipe) ─────────────────────────────────

export async function confirmarVerificacaoAction(verificacaoId: string, codigo: string): Promise<Resultado> {
  try {
    const membro = await assertPermissao("sorteios.gerenciar");
    const r = await S.confirmarVerificacao(verificacaoId, codigo, { id: membro.id, nome: membro.nome });
    if (!r.ok) return { ok: false, erro: r.erro };
    await auditar(membro, {
      acao: "sorteio.verificar_telefone",
      entidade: "User",
      entidadeId: r.userId,
      descricao: `Confirmou o WhatsApp de um cliente pelo código recebido. ${r.vinculados} participação(ões) ligada(s).`,
    });
    revalidatePath("/admin/sorteios", "layout");
    revalidatePath("/minha-conta/sorteios");
    return {
      ok: true,
      mensagem: r.vinculados ? `Verificado. Créditos ligados em ${r.vinculados} sorteio(s).` : "Verificado. Nenhum crédito esperando este número.",
    };
  } catch (e) {
    return erro(e);
  }
}

export async function cancelarVerificacaoAction(verificacaoId: string): Promise<Resultado> {
  try {
    await assertPermissao("sorteios.gerenciar");
    await S.cancelarVerificacao(verificacaoId);
    revalidatePath("/admin/sorteios/verificacoes");
    return { ok: true };
  } catch (e) {
    return erro(e);
  }
}
