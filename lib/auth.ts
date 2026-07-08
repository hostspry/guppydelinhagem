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

// Config COMPLETA (Node runtime): providers reais + Prisma + bcrypt + adapter.
// Sessão continua JWT (auth.config.ts trava strategy). O adapter entra só para
// persistir User/Account do OAuth — não para sessão em banco.

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

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

      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          nome: true,
          role: true,
          senhaHash: true,
          senhaPrecisaTroca: true,
        },
      });

      if (!user?.senhaHash) return null;

      const valid = await bcrypt.compare(password, user.senhaHash);
      if (!valid) return null;

      if (user.role === "CUSTOMER") return null;

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
      }
      return token;
    },
    // session: herdado de authConfig (edge-safe, mapeia token → sessão com role).
  },
});
