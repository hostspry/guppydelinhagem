import { auth } from "@/lib/auth";

export type ActionResult =
  | { success: true; message?: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

/**
 * Garante que há uma sessão autenticada com permissão de admin.
 * Lança em caso de não autenticado ou role CUSTOMER.
 */
export async function assertAuthorized() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  if (session.user.role === "CUSTOMER") throw new Error("Sem permissão");
  return session;
}

/** Narrow de erro do Prisma para acesso ao `code` (ex: P2002, P2025). */
export function isPrismaError(e: unknown): e is { code: string } {
  return typeof e === "object" && e !== null && "code" in e;
}
