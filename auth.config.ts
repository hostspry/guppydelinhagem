import type { NextAuthConfig } from "next-auth";

// Config "leve" usada pelo middleware (Edge Runtime).
// NÃO importa Prisma nem bcrypt — esses só rodam no Node runtime via lib/auth.ts.
// NextAuth v5 split config pattern.
export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt", // com adapter, o default viraria "database" — travar em jwt
    maxAge: 60 * 60 * 24, // 1 dia
  },
  pages: {
    signIn: "/admin/login",
    // Erros de OAuth (ex.: OAuthAccountNotLinked do Facebook) caem no /login do
    // cliente, que mostra a mensagem amigável. Erro de credenciais do admin é
    // tratado inline na própria /admin/login (redirect:false).
    error: "/login",
  },
  providers: [], // providers de verdade ficam em lib/auth.ts
  callbacks: {
    // JWT → sessão. EDGE-SAFE (sem Prisma) para o middleware enxergar o role.
    // role/senhaPrecisaTroca vêm do token (gravados no callback jwt de lib/auth.ts).
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.sub as string) ?? session.user.id;
        session.user.role = (token.role as string) ?? "CUSTOMER";
        session.user.senhaPrecisaTroca =
          (token.senhaPrecisaTroca as boolean) ?? false;
      }
      return session;
    },
    authorized({ request, auth }) {
      const pathname = request.nextUrl.pathname;
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;
      // Admin = qualquer papel que não seja CUSTOMER (mesma regra do Credentials).
      // Com OAuth um CUSTOMER PODE estar logado, então a checagem de role aqui é o
      // que barra o painel — não basta "estar logado".
      const isAdmin = isLoggedIn && !!role && role !== "CUSTOMER";
      const isLoginPage = pathname === "/admin/login";
      const isAdminRoute = pathname.startsWith("/admin");

      if (isLoginPage) {
        // Admin logado → painel. CUSTOMER logado ou deslogado → mostra o form
        // (pode entrar com uma conta admin).
        if (isAdmin) {
          return Response.redirect(new URL("/admin", request.nextUrl));
        }
        return true;
      }

      if (isAdminRoute) {
        if (!isLoggedIn) return false; // → pages.signIn com callbackUrl
        if (!isAdmin) {
          // Logado como CUSTOMER: não entra no admin. Volta pra home.
          return Response.redirect(new URL("/", request.nextUrl));
        }
      }

      return true;
    },
  },
};
