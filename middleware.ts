import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Middleware roda no Edge Runtime — usa só a config leve (sem Prisma/bcrypt).
// A lógica de redirect/proteção fica no callback `authorized` de auth.config.ts.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: ["/admin/:path*"],
};
