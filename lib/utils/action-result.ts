export type ActionResult =
  | { success: true; message?: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

// A checagem de acesso vive em lib/permissoes.ts (assertPermissao). O antigo
// assertAuthorized só perguntava "não é CUSTOMER?", o que dava a um EDITOR os
// mesmos poderes do dono — foi removido para ninguém reusá-lo sem querer.

/** Narrow de erro do Prisma para acesso ao `code` (ex: P2002, P2025). */
export function isPrismaError(e: unknown): e is { code: string } {
  return typeof e === "object" && e !== null && "code" in e;
}
