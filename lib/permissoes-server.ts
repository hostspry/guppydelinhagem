import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { auth } from "./auth";
import {
  ehPapelEquipe,
  ehPermissao,
  escopoDeSegmentos,
  PAPEL_LABEL,
  PERMISSOES_POR_PAPEL,
  PERMISSOES_TODAS,
  podeNoSegmento,
  SEGMENTO_LABEL,
  SEGMENTOS,
  SemPermissaoError,
  type MembroAtual,
  type PapelEquipe,
  type Permissao,
} from "./permissoes";
import type { SegmentoFinanceiro } from "@/lib/generated/prisma/enums";

/**
 * Quem está agindo, lido do BANCO (não do JWT).
 *
 * O token vive 1 dia; se o dono rebaixar ou remover alguém, o JWT antigo ainda
 * diria o papel velho. Lendo do banco a mudança vale no próximo clique. É uma
 * query a mais por action — irrelevante no volume do painel, e é o que garante
 * que "tirei o acesso" signifique agora.
 */
export async function membroAtual(): Promise<MembroAtual> {
  const session = await auth();
  if (!session?.user?.id) throw new SemPermissaoError("Não autenticado.");

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      limiteDescontoPercent: true,
      podeCancelarPedido: true,
      podeEstornar: true,
      limiteValorFinanceiro: true,
      senhaPrecisaTroca: true,
      cargo: {
        select: {
          id: true,
          nome: true,
          protegido: true,
          permissoes: true,
          segmentosFinanceiros: true,
        },
      },
    },
  });

  if (!u || !ehPapelEquipe(u.role)) {
    throw new SemPermissaoError("Sua conta não tem acesso ao painel.");
  }

  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: u.role,
    limiteDescontoPercent: u.limiteDescontoPercent,
    podeCancelarPedido: u.podeCancelarPedido,
    podeEstornar: u.podeEstornar,
    limiteValorFinanceiro:
      u.limiteValorFinanceiro == null ? null : Number(u.limiteValorFinanceiro),
    senhaPrecisaTroca: u.senhaPrecisaTroca,
    semLimites: u.role === "SUPER_ADMIN",
    segmentosFinanceiros: escopoDeSegmentos(u.cargo?.segmentosFinanceiros),
    cargo: u.cargo
      ? { id: u.cargo.id, nome: u.cargo.nome, protegido: u.cargo.protegido }
      : null,
    permissoes: permissoesDo(u.role, u.cargo),
  };
}

/**
 * Resolve as permissões efetivas.
 *
 * Cargo protegido (o dono) tem tudo por definição, sem consultar a lista: é a
 * trava que impede desmarcar uma caixinha e deixar o painel sem ninguém capaz de
 * gerenciar a equipe. Membro sem cargo cai na lista fixa do papel — só acontece
 * com conta antiga que a migração não pegou, e é melhor manter o acesso que
 * tinha do que trancar a pessoa para fora.
 */
function permissoesDo(
  role: PapelEquipe,
  cargo: { protegido: boolean; permissoes: string[] } | null,
): readonly Permissao[] {
  if (!cargo) return PERMISSOES_POR_PAPEL[role];
  if (cargo.protegido) return PERMISSOES_TODAS;
  return cargo.permissoes.filter(ehPermissao);
}

/**
 * Filtro de segmento para as consultas do financeiro. Devolve `{}` quando a
 * pessoa vê tudo, para poder ser espalhado dentro de qualquer `where`.
 *
 * Ponto único: toda consulta do caixa passa por aqui. Se uma consulta nova
 * esquecer de aplicar, ela vaza o caixa do outro sócio — por isso o filtro é uma
 * função só, e não um `if` repetido.
 */
export async function filtroSegmento(): Promise<
  { segmento?: { in: SegmentoFinanceiro[] } }
> {
  const membro = await membroAtual();
  return membro.segmentosFinanceiros === null
    ? {}
    : { segmento: { in: membro.segmentosFinanceiros } };
}

/** Segmentos que o membro atual pode lançar — para popular o formulário. */
export async function segmentosPermitidos(): Promise<SegmentoFinanceiro[]> {
  const membro = await membroAtual();
  return membro.segmentosFinanceiros ?? [...SEGMENTOS];
}

/**
 * Garante que o membro pode mexer NESTE segmento. Usada nas actions, depois da
 * permissão: ter `financeiro.gerenciar` não dá acesso ao caixa do outro sócio.
 */
export function assertSegmento(
  membro: MembroAtual,
  segmento: SegmentoFinanceiro,
): void {
  if (!podeNoSegmento(membro, segmento)) {
    throw new SemPermissaoError(
      `Você não tem acesso ao financeiro de ${SEGMENTO_LABEL[segmento]}.`,
    );
  }
}

/**
 * Porta de entrada das server actions: garante a permissão e devolve o membro
 * (com os limites) para quem precisar checar valores depois.
 */
export async function assertPermissao(
  permissao: Permissao,
): Promise<MembroAtual> {
  const membro = await membroAtual();
  if (!membro.permissoes.includes(permissao)) {
    const quem = membro.cargo?.nome ?? PAPEL_LABEL[membro.role];
    throw new SemPermissaoError(`Seu cargo (${quem}) não permite esta ação.`);
  }
  return membro;
}

/** Versão booleana, para esconder botão/menu na UI. */
export async function podeAtual(permissao: Permissao): Promise<boolean> {
  try {
    const membro = await membroAtual();
    return membro.permissoes.includes(permissao);
  } catch {
    return false;
  }
}

/**
 * Guarda de PÁGINA (use no layout da seção, não em cada page). Sem a permissão,
 * volta ao dashboard com o aviso — melhor do que uma tela de erro, e evita que
 * digitar a URL na mão contorne o menu escondido.
 */
export async function exigirPermissaoNaPagina(permissao: Permissao) {
  if (!(await podeAtual(permissao))) {
    redirect(`/admin?semPermissao=${encodeURIComponent(permissao)}`);
  }
}
