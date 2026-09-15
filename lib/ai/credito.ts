/**
 * Crédito do Gemini acabou: a mensagem e o endereço para comprar mais.
 *
 * Client-safe (sem server-only): o servidor escreve a mensagem e a tela
 * reconhece por ela para oferecer o botão que abre a página do Google.
 */

/** Página do AI Studio onde se compra crédito (Billing → Buy credits). */
export const URL_CREDITOS_GEMINI = "https://aistudio.google.com/billing";
/** Página do AI Studio com o uso e o saldo exato. */
export const URL_USO_GEMINI = "https://aistudio.google.com/usage";

export const MSG_SEM_CREDITO =
  "Os créditos do Gemini acabaram (ou chegaram no limite), e a IA parou. Adicione crédito no Google para voltar a usar.";

export function ehSemCredito(mensagem: string | null | undefined): boolean {
  return !!mensagem && mensagem.startsWith("Os créditos do Gemini acabaram");
}
