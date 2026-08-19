"use client";

/**
 * Device fingerprint do Mercado Pago (antifraude).
 *
 * O antifraude do MP pontua MUITO a identidade do dispositivo. Sem ela o
 * pagamento chega marcado como `security:none` e cartão bom volta recusado com
 * `cc_rejected_high_risk` — foi exatamente o que acontecia aqui: 35 de 38
 * cobranças no cartão recusadas por risco.
 *
 * A armadilha: o SDK v2 (sdk.mercadopago.com/js/v2) NÃO define
 * `window.MP_DEVICE_SESSION_ID`. Ele faz coleta própria para o Brick, mas a
 * variável global só existe quando este script de segurança é carregado. Testado
 * em produção: só com o SDK v2 a variável fica undefined; com o security.js ela
 * aparece em ~1s.
 *
 * `view` diz ao MP em que etapa da jornada o cliente está — quanto mais cedo o
 * script carrega, mais sinal de comportamento ele coleta até o pagamento.
 */

const SECURITY_SRC = "https://www.mercadopago.com/v2/security.js";

let promessa: Promise<void> | null = null;

export function carregarDeviceMp(
  view: "home" | "item" | "checkout" = "checkout",
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.MP_DEVICE_SESSION_ID) return Promise.resolve();
  if (promessa) return promessa;

  promessa = new Promise<void>((resolve) => {
    const s = document.createElement("script");
    s.src = SECURITY_SRC;
    s.setAttribute("view", view);
    s.async = true;
    // Resolve nos dois casos: o fingerprint é um "quanto melhor, melhor", nunca
    // um bloqueio de checkout. Quem espera o ID usa esperarDeviceId (com timeout).
    s.onload = () => resolve();
    s.onerror = () => {
      promessa = null;
      resolve();
    };
    document.head.appendChild(s);
  });
  return promessa;
}

/**
 * Espera o ID aparecer (a coleta é assíncrona: leva ~0,5–2s depois do load).
 * Devolve null no estouro — melhor pagar sem fingerprint do que travar a compra.
 */
export async function esperarDeviceId(timeoutMs = 6000): Promise<string | null> {
  if (typeof window === "undefined") return null;
  carregarDeviceMp();
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    if (window.MP_DEVICE_SESSION_ID) return window.MP_DEVICE_SESSION_ID;
    await new Promise((r) => setTimeout(r, 250));
  }
  return window.MP_DEVICE_SESSION_ID ?? null;
}
