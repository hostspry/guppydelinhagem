import type { NextAuthConfig } from "next-auth";

// Config "leve" usada pelo middleware (Edge Runtime).
// NÃO importa Prisma nem bcrypt — esses só rodam no Node runtime
// via lib/auth.ts. NextAuth v5 split config pattern.
export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24, // 1 dia
  },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  providers: [], // providers de verdade ficam em lib/auth.ts
  callbacks: {
    authorized({ request, auth }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;
      const isLoginPage = pathname === "/admin/login";
      const isAdminRoute = pathname.startsWith("/admin");

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/admin", request.nextUrl));
        }
        return true;
      }

      if (isAdminRoute && !isLoggedIn) {
        // false → NextAuth redireciona pra pages.signIn com callbackUrl
        return false;
      }

      return true;
    },
  },
};
