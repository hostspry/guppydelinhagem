/**
 * Permissões da equipe.
 *
 * Este arquivo é PURO de propósito (sem Prisma, sem auth, sem next/navigation):
 * o formulário e a sidebar são client components e importam os labels daqui. As
 * funções que tocam o banco vivem em lib/permissoes-server.ts.
 *
 * Duas camadas, de propósito:
 *  1. PAPEL (role) — diz em QUE áreas o membro mexe. Fixo, sem exceção por pessoa.
 *  2. LIMITES (colunas do User) — dizem QUANTO ele pode mexer onde envolve dinheiro.
 *
 * SUPER_ADMIN passa por tudo: tem todas as permissões e ignora os limites. Quem
 * gerencia o time não se auto-limita (e assim ninguém se tranca fora do painel).
 */

export type Permissao =
  // Catálogo
  | "catalogo.ver"
  | "catalogo.editar"
  | "catalogo.excluir"
  // Vendas
  | "pedidos.ver"
  | "pedidos.editar"
  | "pedidos.excluir"
  | "pedidos.status"
  | "pedidos.envio"
  | "clientes.ver"
  | "clientes.editar"
  | "clientes.excluir"
  // Sistema
  | "config.editar"
  | "equipe.gerenciar";

/** Papéis que entram no painel (CUSTOMER não é membro da equipe). */
export type PapelEquipe = "EDITOR" | "ADMIN" | "SUPER_ADMIN";

const CATALOGO: Permissao[] = ["catalogo.ver", "catalogo.editar", "catalogo.excluir"];

const VENDAS: Permissao[] = [
  "pedidos.ver",
  "pedidos.editar",
  "pedidos.status",
  "pedidos.envio",
  "clientes.ver",
  "clientes.editar",
  "clientes.excluir",
];

/**
 * `pedidos.excluir` fica só no SUPER_ADMIN de propósito: apagar pedido some com o
 * histórico (cascata em itens e pagamentos) e não tem desfazer. Para desfazer uma
 * venda existe CANCELADO, que preserva o registro e devolve o estoque.
 */
export const PERMISSOES_POR_PAPEL: Record<PapelEquipe, readonly Permissao[]> = {
  EDITOR: CATALOGO,
  ADMIN: [...CATALOGO, ...VENDAS],
  SUPER_ADMIN: [
    ...CATALOGO,
    ...VENDAS,
    "pedidos.excluir",
    "config.editar",
    "equipe.gerenciar",
  ],
};

export const PAPEL_LABEL: Record<PapelEquipe, string> = {
  EDITOR: "Editor",
  ADMIN: "Administrador",
  SUPER_ADMIN: "Dono",
};

export const PAPEL_DESCRICAO: Record<PapelEquipe, string> = {
  EDITOR: "Produtos, categorias, cupons e hero da home. Não vê pedidos nem clientes.",
  ADMIN: "Tudo do editor, mais pedidos, clientes, status e envios.",
  SUPER_ADMIN: "Acesso total, incluindo configurações da loja e gestão da equipe.",
};

export const PAPEIS_EQUIPE: PapelEquipe[] = ["EDITOR", "ADMIN", "SUPER_ADMIN"];

export function ehPapelEquipe(role: string): role is PapelEquipe {
  return role === "EDITOR" || role === "ADMIN" || role === "SUPER_ADMIN";
}

export function papelTem(role: string, permissao: Permissao): boolean {
  return ehPapelEquipe(role) && PERMISSOES_POR_PAPEL[role].includes(permissao);
}

/** Erro de permissão — mensagem já pronta para mostrar ao membro. */
export class SemPermissaoError extends Error {
  constructor(message = "Você não tem permissão para isso.") {
    super(message);
    this.name = "SemPermissaoError";
  }
}

export type MembroAtual = {
  id: string;
  nome: string;
  email: string;
  role: PapelEquipe;
  limiteDescontoPercent: number | null;
  podeCancelarPedido: boolean;
  podeEstornar: boolean;
  limiteValorFinanceiro: number | null;
  /** Ainda está com a senha temporária que o dono gerou. */
  senhaPrecisaTroca: boolean;
  /** SUPER_ADMIN não é limitado por nenhum teto. */
  semLimites: boolean;
};

// ─────────────────────────────────────────────
// Limites (dinheiro)
// ─────────────────────────────────────────────

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Teto de desconto, em % do subtotal. Vale para desconto digitado no pedido e
 * para cupom percentual. Retorna a mensagem de erro, ou null se está dentro.
 */
export function checarLimiteDesconto(
  membro: MembroAtual,
  percentual: number,
): string | null {
  if (membro.semLimites || membro.limiteDescontoPercent == null) return null;
  if (percentual <= membro.limiteDescontoPercent) return null;
  return `Seu limite de desconto é ${membro.limiteDescontoPercent}%. Este pedido está em ${percentual.toFixed(1)}%.`;
}

/**
 * Desconto de um pedido contra o teto do membro. O teto é em % do subtotal — é
 * assim que se compara maçã com maçã entre um pedido de R$ 80 e um de R$ 800.
 * Subtotal zero não tem o que limitar (qualquer desconto ali abate 0 de fato).
 */
export function checarDescontoDoPedido(
  membro: MembroAtual,
  subtotal: number,
  desconto: number,
): string | null {
  if (desconto <= 0 || subtotal <= 0) return null;
  return checarLimiteDesconto(membro, (desconto / subtotal) * 100);
}

/** Teto em R$ para operações que mexem em dinheiro já pago. */
export function checarLimiteValor(
  membro: MembroAtual,
  valor: number,
  operacao: string,
): string | null {
  if (membro.semLimites || membro.limiteValorFinanceiro == null) return null;
  if (valor <= membro.limiteValorFinanceiro) return null;
  return `Seu limite para ${operacao} é ${moeda(membro.limiteValorFinanceiro)}. Este pedido é de ${moeda(valor)}. Peça a um administrador.`;
}
