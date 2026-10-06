"use client";

/**
 * Avisa o servidor que o cartão morreu no navegador (SDK que não carregou,
 * formulário que recusou os dados). Dispara e esquece: nunca lança e nunca
 * atrasa o checkout — se este aviso falhar, o cliente não pode nem perceber.
 *
 * `keepalive` porque a pessoa costuma fechar a aba ou voltar para o Pix logo
 * depois do erro, e a requisição precisa sair mesmo assim.
 *
 * NUNCA envia dado de cartão: número e CVV vivem no iframe do gateway e não
 * passam por este código.
 */
export function relatarFalhaCartao(f: {
  // ABERTO e ENVIO são funil (formulário apareceu / clicou em Pagar): sem eles
  // não dá para saber se o cliente nem tentou ou se tentou e travou.
  etapa: "SDK" | "FORMULARIO" | "COBRANCA" | "VALIDACAO" | "ABERTO" | "ENVIO";
  mensagem: string;
  valor?: number;
  parcelas?: number;
  email?: string;
  telefone?: string;
  /** checkout | cobranca */
  fluxo?: string;
}): void {
  try {
    fetch("/api/checkout/falha-cartao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        etapa: f.etapa,
        mensagem: f.mensagem,
        valor: f.valor,
        parcelas: f.parcelas,
        fluxo: f.fluxo,
        // Fingerprint do antifraude: "chegou ou não" é o que explica recusa de
        // cartão bom, e é o primeiro dado que a gente quer ver no relatório.
        deviceOk:
          typeof window !== "undefined" && !!window.MP_DEVICE_SESSION_ID,
        email: f.email,
        telefone: f.telefone,
      }),
    }).catch(() => {});
  } catch {
    // Sem rede, sem o que fazer. O checkout segue.
  }
}
