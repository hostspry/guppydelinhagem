import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "../auth.config";
import { prisma } from "./prisma";
import { rateLimit, clientIp } from "./rate-limit";

// Config COMPLETA (Node runtime): inclui providers reais com Prisma + bcrypt.
// PrismaAdapter foi omitido propositadamente — strategy "jwt" + Credentials
// não precisa persistir Account/Session/VerificationToken.

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
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
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.senhaPrecisaTroca = user.senhaPrecisaTroca;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.senhaPrecisaTroca = token.senhaPrecisaTroca as boolean;
      }
      return session;
    },
  },
});
