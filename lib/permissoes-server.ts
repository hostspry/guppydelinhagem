import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { auth } from "./auth";
import {
  ehPapelEquipe,
  PAPEL_LABEL,
  PERMISSOES_POR_PAPEL,
  SemPermissaoError,
  type MembroAtual,
  type Permissao,
} from "./permissoes";

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
  };
}

/**
 * Porta de entrada das server actions: garante a permissão e devolve o membro
 * (com os limites) para quem precisar checar valores depois.
 */
export async function assertPermissao(
  permissao: Permissao,
): Promise<MembroAtual> {
  const membro = await membroAtual();
  if (!PERMISSOES_POR_PAPEL[membro.role].includes(permissao)) {
    throw new SemPermissaoError(
      `Seu perfil (${PAPEL_LABEL[membro.role]}) não permite esta ação.`,
    );
  }
  return membro;
}

/** Versão booleana, para esconder botão/menu na UI. */
export async function podeAtual(permissao: Permissao): Promise<boolean> {
  try {
    const membro = await membroAtual();
    return PERMISSOES_POR_PAPEL[membro.role].includes(permissao);
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
