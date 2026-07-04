import "server-only";

// Configuração central do provider PagBank (Checkout hospedado). A URL base NUNCA
// é hardcodada espalhada — deriva de PAGBANK_ENV aqui. Tudo server-only: o token
// nunca vai ao client (o `server-only` quebra o build se alguém importar isto de
// um Client Component).
//
// Ambientes (doc "Ambientes disponíveis"):
//   produção → https://api.pagseguro.com
//   sandbox  → https://sandbox.api.pagseguro.com

type PagBankEnv = "sandbox" | "production";

function pagbankEnv(): PagBankEnv {
  return process.env.PAGBANK_ENV === "production" ? "production" : "sandbox";
}

/** Base da API (checkouts, orders, charges, cancel). */
export function pagbankApiBase(): string {
  return pagbankEnv() === "production"
    ? "https://api.pagseguro.com"
    : "https://sandbox.api.pagseguro.com";
}

/** Bearer token da conta (server-only). Lança se ausente — pagamento indisponível. */
export function pagbankToken(): string {
  const t = process.env.PAGBANK_TOKEN;
  if (!t) {
    throw new Error(
      "PAGBANK_TOKEN não configurado. Pagamento indisponível no momento.",
    );
  }
  return t;
}

/**
 * True se o PagBank está configurado no servidor (token presente). O checkout só
 * oferece PagBank quando o toggle do admin está ligado E isto é true — evita
 * mostrar um botão que quebraria por falta de credencial.
 */
export function pagbankConfigurado(): boolean {
  return !!process.env.PAGBANK_TOKEN;
}
