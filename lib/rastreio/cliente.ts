import { EVENTOS, type TipoEvento } from "./eventos";

/**
 * Envio dos eventos do navegador para /api/rastreio.
 *
 * Regras de ouro daqui: nunca atrapalhar a navegação e nunca estourar erro na
 * cara do cliente. Tudo é fire-and-forget com `keepalive` (o evento sobrevive à
 * troca de página) e falha em silêncio.
 */

const CHAVE_CONSENTIMENTO = "consent-lgpd";

/** Só "granted" conta como aceite; sem resposta é tratado como recusa. */
function consentimento(): boolean {
  try {
    return localStorage.getItem(CHAVE_CONSENTIMENTO) === "granted";
  } catch {
    return false;
  }
}

export type DadosEvento = {
  url?: string;
  titulo?: string;
  referrer?: string;
  produtoId?: string;
  produtoNome?: string;
  variantId?: string;
  composicao?: string;
  quantidade?: number;
  valor?: number;
  busca?: string;
};

function utmDaUrl(): Record<string, string> | undefined {
  try {
    const p = new URLSearchParams(window.location.search);
    const source = p.get("utm_source");
    const medium = p.get("utm_medium");
    const campaign = p.get("utm_campaign");
    if (!source && !medium && !campaign) return undefined;
    return {
      ...(source ? { source } : {}),
      ...(medium ? { medium } : {}),
      ...(campaign ? { campaign } : {}),
    };
  } catch {
    return undefined;
  }
}

export function rastrear(tipo: TipoEvento, dados: DadosEvento = {}): void {
  if (typeof window === "undefined") return;

  const corpo = JSON.stringify({
    tipo,
    consentimento: consentimento(),
    url: dados.url ?? window.location.pathname + window.location.search,
    titulo: dados.titulo ?? document.title,
    referrer: dados.referrer ?? (document.referrer || undefined),
    utm: utmDaUrl(),
    ...dados,
  });

  try {
    void fetch("/api/rastreio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: corpo,
      keepalive: true, // sobrevive à navegação que o próprio clique provoca
      credentials: "same-origin",
    }).catch(() => {});
  } catch {
    // sem rede, storage bloqueado, extensão bloqueando: segue o jogo
  }
}

export { EVENTOS };
