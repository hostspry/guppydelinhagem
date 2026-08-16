import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "./generated/prisma/client";
import { prisma } from "./prisma";
import { clientIp } from "./rate-limit";
import { PAPEL_LABEL, type MembroAtual } from "./permissoes";

/**
 * Registro do que a EQUIPE faz no painel.
 *
 * Três decisões que valem explicar:
 *
 * 1. NUNCA lança. Auditoria que derruba a operação é pior do que auditoria
 *    faltando: ninguém quer perder uma venda porque o log falhou. Erro aqui vai
 *    para o console e a ação segue.
 *
 * 2. Guarda só o que MUDOU (ver `diff`), não o registro inteiro. Um dump do
 *    produto a cada salvamento tornaria o histórico ilegível e pesado.
 *
 * 3. Nome, e-mail e papel de quem agiu são snapshot. Se a pessoa sair da equipe
 *    e a conta for apagada, o histórico continua sabendo quem fez o quê.
 */

export type EntradaAuditoria = {
  /** "produto.atualizar", "pedido.cancelar" — área.verbo, para filtrar depois. */
  acao: string;
  entidade?: string;
  entidadeId?: string;
  descricao: string;
  antes?: Record<string, unknown> | null;
  depois?: Record<string, unknown> | null;
};

/** Campos que nunca podem entrar no log, mesmo se vierem no objeto. */
const PROIBIDOS = new Set([
  "senha",
  "senhaHash",
  "password",
  "token",
  "secret",
  "cvv",
  "cardToken",
]);

function limpar(
  obj: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (PROIBIDOS.has(k)) continue;
    // Decimal do Prisma e Date não sobrevivem ao JSON de forma legível.
    out[k] =
      v instanceof Date
        ? v.toISOString()
        : typeof v === "object" && v !== null && "toString" in v && !Array.isArray(v)
          ? String(v)
          : v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function auditar(
  membro: Pick<MembroAtual, "id" | "nome" | "email" | "role">,
  e: EntradaAuditoria,
): Promise<void> {
  try {
    const h = await headers();
    await prisma.auditoriaAdmin.create({
      data: {
        userId: membro.id,
        userNome: membro.nome,
        userEmail: membro.email,
        userPapel: PAPEL_LABEL[membro.role] ?? membro.role,
        acao: e.acao,
        entidade: e.entidade ?? null,
        entidadeId: e.entidadeId ?? null,
        descricao: e.descricao,
        antes: (limpar(e.antes) ?? undefined) as Prisma.InputJsonValue | undefined,
        depois: (limpar(e.depois) ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: clientIp(h),
        userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
  } catch (err) {
    console.error("[auditoria] falhou ao registrar", e.acao, err);
  }
}

/**
 * Compara dois estados e devolve só os campos diferentes, no formato
 * { campo: { de, para } }. Vazio = nada mudou (e aí nem vale registrar).
 */
export function diff(
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
  campos?: string[],
): { mudou: boolean; antes: Record<string, unknown>; depois: Record<string, unknown> } {
  const chaves = campos ?? [
    ...new Set([...Object.keys(antes), ...Object.keys(depois)]),
  ];
  const a: Record<string, unknown> = {};
  const d: Record<string, unknown> = {};

  for (const k of chaves) {
    const va = antes[k];
    const vd = depois[k];
    // String(): Decimal(80) e "80" são o mesmo dinheiro para efeito de histórico.
    const iguais =
      va === vd ||
      (va != null && vd != null && String(va) === String(vd)) ||
      (va == null && vd == null);
    if (!iguais) {
      a[k] = va ?? null;
      d[k] = vd ?? null;
    }
  }

  return { mudou: Object.keys(d).length > 0, antes: a, depois: d };
}

/** Rótulos amigáveis para os campos que mais aparecem no histórico. */
export const CAMPO_LABEL: Record<string, string> = {
  nome: "nome",
  preco: "preço",
  estoque: "estoque",
  estoqueMachos: "machos em estoque",
  estoqueFemeas: "fêmeas em estoque",
  ativo: "publicado",
  destaque: "destaque",
  status: "status",
  valor: "valor",
  total: "total",
  desconto: "desconto",
  frete: "frete",
  role: "papel",
  email: "e-mail",
  descricao: "descrição",
  categoriaId: "categoria",
  codigo: "código",
  limiteDescontoPercent: "limite de desconto",
  podeCancelarPedido: "pode cancelar",
  podeEstornar: "pode estornar",
  limiteValorFinanceiro: "teto financeiro",
};
