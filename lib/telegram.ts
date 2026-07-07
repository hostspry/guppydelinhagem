import "server-only";

// Transporte de baixo nível do Telegram (Bot API oficial, HTTP puro via fetch —
// sem SDK). Fire-and-forget SEGURO: nada aqui pode quebrar o fluxo que chamou.
// A camada de eventos semânticos fica em lib/notificacoes.ts.

const TELEGRAM_API = "https://api.telegram.org";

/** Escapa <, > e & para uso seguro em parse_mode HTML (nomes/produtos dinâmicos). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Envia uma mensagem (HTML) a todos os chat_ids configurados. Lê as vars em
 * RUNTIME (nunca no topo do módulo — não exigir env em build). Sem token/chat_ids
 * → apenas console.warn e retorna. NUNCA lança nem propaga erro: notificação é
 * acessória; falhar aqui não pode derrubar webhook/checkout/action.
 */
export async function enviarTelegram(texto: string): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const idsRaw = process.env.TELEGRAM_CHAT_IDS?.trim();
    if (!token || !idsRaw) {
      console.warn("[telegram] não configurado (TELEGRAM_BOT_TOKEN/CHAT_IDS)");
      return;
    }
    const chatIds = idsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (chatIds.length === 0) {
      console.warn("[telegram] nenhum chat_id válido");
      return;
    }

    await Promise.allSettled(
      chatIds.map(async (chatId) => {
        try {
          const r = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: texto,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }),
            signal: AbortSignal.timeout(5000),
          });
          if (!r.ok) {
            const corpo = await r.text().catch(() => "");
            console.error(
              `[telegram] envio falhou (${r.status}) chat=${chatId}: ${corpo.slice(0, 200)}`,
            );
          }
        } catch (e) {
          console.error(`[telegram] erro no envio chat=${chatId}`, e);
        }
      }),
    );
  } catch (e) {
    // Blindagem final — qualquer coisa inesperada é só logada.
    console.error("[telegram] erro inesperado", e);
  }
}
