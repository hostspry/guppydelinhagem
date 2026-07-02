import "server-only";

// Configuração central do provider PagBank (Order API). A URL base NUNCA é
// hardcodada espalhada — deriva de PAGBANK_ENV aqui. Tudo server-only: token e
// segredos nunca vão ao client (o `server-only` quebra o build se alguém importar
// isto de um Client Component).
//
// Ambientes (doc "Ambientes disponíveis"):
//   produção → https://api.pagseguro.com        + SDK https://sdk.pagseguro.com
//   sandbox  → https://sandbox.api.pagseguro.com + SDK https://sandbox.sdk.pagseguro.com
// A Order API usa a base padrão; a sessão 3DS usa o host do SDK (§ criar-sessao-3ds).

type PagBankEnv = "sandbox" | "production";

function pagbankEnv(): PagBankEnv {
  return process.env.PAGBANK_ENV === "production" ? "production" : "sandbox";
}

/** Base da Order API (orders, charges, cancel). */
export function pagbankApiBase(): string {
  return pagbankEnv() === "production"
    ? "https://api.pagseguro.com"
    : "https://sandbox.api.pagseguro.com";
}

/** Base do host de SDK (criação da sessão 3DS: POST /checkout-sdk/sessions). */
export function pagbankSdkBase(): string {
  return pagbankEnv() === "production"
    ? "https://sdk.pagseguro.com"
    : "https://sandbox.sdk.pagseguro.com";
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
 * Chave pública p/ criptografar o cartão e rodar o 3DS no navegador. Embora
 * pública, é lida server-side e injetada por prop no checkout (mesma disciplina
 * do MP_PUBLIC_KEY: sem prefixo NEXT_PUBLIC_ → não é embutida em build-time, pode
 * ser rotacionada sem rebuild). Devolve null se não configurada (checkout esconde
 * a opção). NÃO lança.
 */
export function pagbankPublicKey(): string | null {
  return process.env.PAGBANK_PUBLIC_KEY || null;
}

/** Ambiente exposto ao SDK do navegador ("SANDBOX" | "PROD"). */
export function pagbankSdkEnv(): "SANDBOX" | "PROD" {
  return pagbankEnv() === "production" ? "PROD" : "SANDBOX";
}
