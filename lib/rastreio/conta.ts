import "server-only";
import { cookies, headers } from "next/headers";
import { COOKIE_VISITANTE, registrarEvento } from "./servidor";

/**
 * Eventos de conta registrados direto no servidor (login, cadastro, mudança de
 * endereço). Não passam pelo endpoint público porque quem os dispara é uma
 * server action, que já tem a sessão na mão.
 *
 * O consentimento não é lido aqui: alteração da própria conta é registro
 * operacional da loja (quem mudou o quê, de onde), não medição de audiência.
 * Ainda assim o IP entra mascarado quando não há cookie de consentimento, para
 * seguir a mesma régua do resto.
 */
export async function rastrearNaConta(
  tipo: string,
  userId: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const [h, jar] = await Promise.all([headers(), cookies()]);
    await registrarEvento(
      {
        visitanteId: jar.get(COOKIE_VISITANTE)?.value ?? null,
        // Sem o banner aceito, o IP fica mascarado (ver registrarEvento).
        consentimento: false,
        headers: h,
        userId,
      },
      { tipo, meta: meta ?? null },
    );
  } catch (e) {
    console.error("[rastreio-conta]", tipo, e);
  }
}
