import { redirect } from "next/navigation";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "../auth.config";
import { prisma } from "./prisma";
import { rateLimit, clientIp } from "./rate-limit";
import { rastrearNaConta } from "./rastreio/conta";
import { auditar } from "./auditoria";
import { ehPapelEquipe } from "./permissoes";
import { EVENTOS } from "./rastreio/eventos";
import { chaveTelefone } from "./sorteios/telefone";

// Config COMPLETA (Node runtime): providers reais + Prisma + bcrypt + adapter.
// Sessão continua JWT (auth.config.ts trava strategy). O adapter entra só para
// persistir User/Account do OAuth — não para sessão em banco.

// O campo se chama "email" por compatibilidade, mas aceita também o WhatsApp:
// quem criou a conta no /cadastro entra com o número que usa todo dia.
const loginSchema = z.object({
  email: z.string().trim().min(5).max(200),
  password: z.string().min(6),
});

const CAMPOS_LOGIN = {
  id: true,
  email: true,
  nome: true,
  role: true,
  senhaHash: true,
  senhaPrecisaTroca: true,
} as const;

/** Acha a conta pelo e-mail ou pelo WhatsApp. Número em mais de uma conta não entra. */
async function contaDoLogin(identificador: string) {
  if (identificador.includes("@")) {
    return prisma.user.findUnique({
      where: { email: identificador.toLowerCase() },
      select: CAMPOS_LOGIN,
    });
  }
  const chave = chaveTelefone(identificador);
  if (!chave) return null;
  const candidatos = await prisma.user.findMany({
    where: { telefone: { endsWith: chave.slice(-8) }, senhaHash: { not: null } },
    select: { ...CAMPOS_LOGIN, telefone: true },
    take: 20,
  });
  const iguais = candidatos.filter((u) => u.telefone && chaveTelefone(u.telefone) === chave);
  return iguais.length === 1 ? iguais[0] : null;
}

// Adapter customizado: o PrismaAdapter cria o User com { name, email,
// emailVerified, image }, mas nosso model exige `nome` (obrigatório) — a fonte de
// verdade do app. Sobrescrevemos createUser para copiar name→nome. `role` nasce
// CUSTOMER (@default). O resto do adapter (Account, getUser…) fica padrão.
const base = PrismaAdapter(prisma);
const adapter: Adapter = {
  ...base,
  createUser: async (data) => {
    const criado = await prisma.user.create({
      data: {
        name: data.name ?? null,
        email: data.email,
        emailVerified: data.emailVerified ?? null,
        image: data.image ?? null,
        nome: data.name ?? data.email ?? "Cliente",
      },
    });
    return criado as unknown as AdapterUser;
  },
};

// Facebook SÓ entra se configurado (o app Meta precisa de Política de Privacidade
// para ir Live). Sem AUTH_FACEBOOK_ID o provider nem aparece — nada meio-config.
// allowDangerousEmailAccountLinking só no Google (e-mail verificado); no Facebook
// NÃO, para não permitir takeover por e-mail não verificado.
const providers = [
  Google({ allowDangerousEmailAccountLinking: true }),
  ...(process.env.AUTH_FACEBOOK_ID ? [Facebook] : []),
  Credentials({
    credentials: {
      email: { label: "Email" },
      password: { label: "Senha", type: "password" },
    },
    authorize: async (credentials, request) => {
      // Anti brute-force: 5 tentativas/min por IP. Bloqueia ANTES do bcrypt
      // (falha como credencial inválida, sem revelar o motivo).
      const ip = clientIp(request.headers);
      if (!rateLimit(`login:${ip}`, 5, 60_000).ok) return null;

      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const { email: identificador, password } = parsed.data;
      if (!rateLimit(`login-id:${identificador.toLowerCase()}`, 10, 15 * 60_000).ok) return null;

      const user = await contaDoLogin(identificador);

      if (!user?.senhaHash) return null;

      const valid = await bcrypt.compare(password, user.senhaHash);
      if (!valid) return null;

      // CUSTOMER entra por aqui desde que a loja tenha criado uma senha para
      // ele (venda direta). Quem barra o painel é o callback `authorized`, que
      // checa o role em toda rota /admin — não este provider.

      // Fire-and-forget — não bloqueia o login
      prisma.user
        .update({
          where: { id: user.id },
          data: { ultimoLogin: new Date() },
        })
        .catch(() => {});

      return {
        id: user.id,
        email: user.email,
        name: user.nome,
        role: user.role,
        senhaPrecisaTroca: user.senhaPrecisaTroca,
      };
    },
  }),
];

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  providers,
  events: {
    // O Google liga a conta pelo e-mail (allowDangerousEmailAccountLinking).
    // Se a conta tinha sido aberta no /cadastro com esse e-mail, quem digitou a
    // senha não provou ser o dono do e-mail; o Google provou. A senha antiga é
    // apagada (o dono cria outra em "esqueci a senha" se quiser) e o e-mail
    // passa a valer como confirmado.
    linkAccount: async ({ user, account }) => {
      if (account.provider !== "google" || !user.id) return;
      try {
        await prisma.user.updateMany({
          where: { id: user.id, cadastroSiteEm: { not: null }, emailVerified: null },
          data: { senhaHash: null, emailVerified: new Date() },
        });
      } catch (e) {
        console.error("[auth] linkAccount", e);
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    jwt: async ({ token, user }) => {
      if (user) {
        // Credentials já traz role/senhaPrecisaTroca no `user`. OAuth entrega um
        // AdapterUser (sem esses campos no tipo) — buscamos do banco pelo id que o
        // adapter acabou de criar/linkar e gravamos role/nome no token (mesmo
        // shape que o middleware e o assertAuthorized já esperam).
        const comRole = user as { role?: string; senhaPrecisaTroca?: boolean };
        if (comRole.role) {
          token.role = comRole.role;
          token.senhaPrecisaTroca = comRole.senhaPrecisaTroca ?? false;
        } else if (user.id) {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, senhaPrecisaTroca: true, nome: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.senhaPrecisaTroca = dbUser.senhaPrecisaTroca;
            token.name = dbUser.nome;
          }
        }

        // Primeiro token da sessão = login que acabou de acontecer. Cliente vai
        // para a jornada de visitante; equipe vai para a auditoria do painel —
        // são registros com propósitos diferentes e não devem se misturar.
        if (user.id) {
          const papel = String(token.role ?? "CUSTOMER");
          if (ehPapelEquipe(papel)) {
            void auditar(
              {
                id: user.id,
                nome: (token.name as string) ?? user.email ?? "—",
                email: user.email ?? "—",
                role: papel,
              },
              { acao: "conta.login", descricao: "Entrou no painel" },
            );
          } else {
            void rastrearNaConta(EVENTOS.LOGIN, user.id);
          }
        }
      }
      return token;
    },
    // session: herdado de authConfig (edge-safe, mapeia token → sessão com role).
  },
});

/**
 * Sessão obrigatória numa página do painel do cliente.
 *
 * O layout de /minha-conta já redireciona quem não está logado, mas layout e
 * página renderizam ao mesmo tempo: o redirect do layout não impede a página de
 * rodar. Quem confiava nisso escrevia `session!.user`, e bastava a sessão ter
 * expirado para a página estourar `Cannot read properties of null` e o cliente
 * ver a tela de erro no lugar da tela de login. Aconteceu em produção.
 */
export async function exigirSessao(callbackUrl = "/minha-conta") {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return session.user;
}
