import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { contaAtiva, enviarComConta } from "@/lib/email";
import { botao, esc, h1, layoutEmail } from "@/lib/emails/layout";
import { corpoParaHtml, aplicarVariaveisTexto } from "@/lib/emails/render";
import type {
  OrderStatus,
  PublicoCampanha,
} from "@/lib/generated/prisma/enums";

/**
 * Campanhas de e-mail (promoções e avisos).
 *
 * Três regras que separam isto de "mandar e-mail em massa":
 *
 * 1. Todo envio carrega link de descadastro. Sem isso o domínio queima: provedor
 *    grande trata mala direta sem opt-out como spam, e aí o e-mail de PEDIDO
 *    também para de chegar.
 * 2. A lista é congelada no disparo. Quem se cadastrar depois não recebe uma
 *    campanha antiga, e reenviar não manda duas vezes para a mesma pessoa.
 * 3. Quem descadastrou some das campanhas, mas continua recebendo aviso de
 *    pedido — isso é resposta a uma compra, não divulgação.
 */

const SITE = "https://www.guppydelinhagem.com.br";

/** Quantos e-mails por rodada. O SMTP compartilhado tem limite por hora. */
export const LOTE_ENVIO = 15;

// ── Descadastro ──────────────────────────────────────────────────────────────
// Token derivado do e-mail: não precisa de tabela nem expira, e ninguém
// descadastra terceiro sem conhecer o segredo do servidor.
function segredo(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET ausente");
  return s;
}

export function tokenDescadastro(email: string): string {
  return createHmac("sha256", segredo())
    .update(email.trim().toLowerCase())
    .digest("base64url");
}

export function tokenDescadastroConfere(email: string, token: string): boolean {
  try {
    const a = Buffer.from(tokenDescadastro(email));
    const b = Buffer.from(token ?? "");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function linkDescadastro(email: string): string {
  const params = new URLSearchParams({
    e: email.trim().toLowerCase(),
    t: tokenDescadastro(email),
  });
  return `${SITE}/descadastrar?${params.toString()}`;
}

// ── Público ──────────────────────────────────────────────────────────────────
export type Destinatario = { email: string; nome: string };

export const PUBLICOS: { valor: PublicoCampanha; rotulo: string; ajuda: string }[] = [
  { valor: "TODOS", rotulo: "Todos os clientes", ajuda: "Todo cadastro com e-mail." },
  {
    valor: "COMPRADORES",
    rotulo: "Quem já comprou",
    ajuda: "Clientes com pelo menos um pedido pago.",
  },
  {
    valor: "SEM_COMPRA",
    rotulo: "Cadastrados que não compraram",
    ajuda: "Estão na base, mas nenhum pedido pago ainda.",
  },
  {
    valor: "LEADS",
    rotulo: "Carrinhos abandonados",
    ajuda: "Deixaram contato no checkout e não fecharam.",
  },
];

/**
 * Lista de quem recebe. Sempre sem quem descadastrou e sem e-mail repetido —
 * a mesma pessoa pode aparecer em mais de um cadastro.
 */
export async function destinatarios(
  publico: PublicoCampanha,
): Promise<Destinatario[]> {
  const porEmail = new Map<string, Destinatario>();

  if (publico === "LEADS") {
    const leads = await prisma.leadCheckout.findMany({
      where: { email: { not: null }, convertido: false },
      select: { email: true, nome: true },
    });
    for (const l of leads) {
      const email = (l.email ?? "").trim().toLowerCase();
      if (email) porEmail.set(email, { email, nome: l.nome ?? "" });
    }
    // Um lead que já descadastrou como cliente não deve voltar pela outra porta.
    const optOut = await prisma.cliente.findMany({
      where: { aceitaEmails: false, email: { not: null } },
      select: { email: true },
    });
    for (const c of optOut) porEmail.delete((c.email ?? "").toLowerCase());
    return [...porEmail.values()];
  }

  const compradoresFiltro = {
    pedidos: {
      some: {
        tipo: "PEDIDO" as const,
        // Sem `as const` na lista: o Prisma espera array mutável aqui.
        status: { in: ["PAGO", "ENVIADO", "ENTREGUE"] as OrderStatus[] },
      },
    },
  };

  const clientes = await prisma.cliente.findMany({
    where: {
      email: { not: null },
      aceitaEmails: true,
      ...(publico === "COMPRADORES" ? compradoresFiltro : {}),
      ...(publico === "SEM_COMPRA" ? { NOT: compradoresFiltro } : {}),
    },
    select: { email: true, nome: true },
  });
  for (const c of clientes) {
    const email = (c.email ?? "").trim().toLowerCase();
    if (email) porEmail.set(email, { email, nome: c.nome });
  }
  return [...porEmail.values()];
}

// ── Montagem e envio ─────────────────────────────────────────────────────────
const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] || n.trim();

/** Variáveis que uma campanha conhece. */
export function variaveisCampanha(nome: string) {
  return {
    nome: primeiroNome(nome) || "tudo bem",
    botao_loja: botao("Ver a loja", `${SITE}/loja`),
    link_loja: `${SITE}/loja`,
  };
}

/** Rodapé obrigatório: quem recebeu precisa poder sair. */
function rodapeDescadastro(email: string): string {
  return `<p style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;line-height:1.6">
    Você recebe este e-mail porque comprou ou deixou seu contato com a gente.
    <a href="${esc(linkDescadastro(email))}" style="color:#9ca3af">Não quero mais receber promoções</a>.
  </p>`;
}

export function montarCampanha(
  campanha: { titulo: string; corpo: string; assunto: string },
  dest: Destinatario,
): { assunto: string; html: string } {
  const vars = variaveisCampanha(dest.nome);
  const titulo = aplicarVariaveisTexto(campanha.titulo, vars);
  return {
    assunto: aplicarVariaveisTexto(campanha.assunto, vars),
    html: layoutEmail({
      titulo,
      preheader: aplicarVariaveisTexto(campanha.assunto, vars),
      conteudo:
        h1(titulo) +
        corpoParaHtml(campanha.corpo, vars) +
        rodapeDescadastro(dest.email),
    }),
  };
}

export type ResultadoLote = {
  enviados: number;
  falhas: number;
  restantes: number;
};

/**
 * Manda um lote de pendentes de uma campanha. Chamado pelo botão do painel (que
 * adianta o primeiro lote) e pelo cron (que termina o resto). Idempotente: só
 * pega quem ainda não tem `enviadoEm`.
 */
export async function processarLote(
  campanhaId: string,
  limite = LOTE_ENVIO,
): Promise<ResultadoLote> {
  const campanha = await prisma.campanhaEmail.findUnique({
    where: { id: campanhaId },
  });
  if (!campanha || campanha.status === "CANCELADA") {
    return { enviados: 0, falhas: 0, restantes: 0 };
  }

  const conta = await contaAtiva();
  if (!conta) {
    console.error("[campanha] nenhuma conta de e-mail ativa");
    return { enviados: 0, falhas: 0, restantes: 0 };
  }

  const pendentes = await prisma.envioCampanha.findMany({
    where: { campanhaId, enviadoEm: null, tentativas: { lt: 3 } },
    take: limite,
    orderBy: { criadoEm: "asc" },
  });

  let enviados = 0;
  let falhas = 0;
  for (const p of pendentes) {
    const msg = montarCampanha(campanha, { email: p.email, nome: p.nome });
    const r = await enviarComConta(conta, {
      para: p.email,
      assunto: msg.assunto,
      html: msg.html,
    });
    await prisma.envioCampanha.update({
      where: { id: p.id },
      data: {
        enviadoEm: r.ok ? new Date() : null,
        erro: r.ok ? null : r.erro.slice(0, 300),
        tentativas: { increment: 1 },
      },
    });
    if (r.ok) enviados++;
    else falhas++;
  }

  // 3 tentativas é o teto: e-mail que não vai nunca (caixa inexistente) não
  // pode segurar a campanha em ENVIANDO para sempre.
  const restantes = await prisma.envioCampanha.count({
    where: { campanhaId, enviadoEm: null, tentativas: { lt: 3 } },
  });
  if (restantes === 0) {
    await prisma.campanhaEmail.update({
      where: { id: campanhaId },
      data: { status: "ENVIADA", concluidaEm: new Date() },
    });
  }

  return { enviados, falhas, restantes };
}

/** Campanhas agendadas cuja hora chegou. Usado pelo cron. */
export async function campanhasParaDisparar(): Promise<string[]> {
  const agora = new Date();
  const agendadas = await prisma.campanhaEmail.findMany({
    where: { status: "AGENDADA", agendadaPara: { lte: agora } },
    select: { id: true },
  });
  return agendadas.map((c) => c.id);
}
