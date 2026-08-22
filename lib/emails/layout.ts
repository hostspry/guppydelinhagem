import "server-only";

/**
 * Layout dos e-mails que vão para o cliente.
 *
 * HTML de e-mail não é HTML de site: cliente de e-mail ignora folha de estilo,
 * classe e boa parte do CSS moderno. Por isso aqui é tabela com estilo inline,
 * largura fixa e nada de flex/grid. Feio de escrever, mas é o que abre igual no
 * Gmail, no Outlook e no app do celular.
 */

const AZUL = "#07366A";
const ROSA = "#FF035C";
const SITE = "https://www.guppydelinhagem.com.br";

/** Tudo que vem do banco passa por aqui antes de entrar no HTML. */
export function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Botão que funciona no Outlook (que ignora padding em <a>). */
export function botao(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0">
    <tr><td align="center" bgcolor="${ROSA}" style="border-radius:6px">
      <a href="${esc(url)}" style="display:inline-block;padding:12px 24px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${esc(texto)}</a>
    </td></tr>
  </table>`;
}

/** Bloco de destaque (código de rastreio, senha, número do pedido). */
export function destaque(rotulo: string, valor: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
    <tr><td style="background:#f6f7f8;border-radius:6px;padding:14px 16px">
      <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;color:#6b7280">${esc(rotulo)}</p>
      <p style="margin:0;font-family:'Courier New',monospace;font-size:18px;font-weight:bold;color:${AZUL};letter-spacing:0.5px">${esc(valor)}</p>
    </td></tr>
  </table>`;
}

/** Lista de itens do pedido. */
export function listaItens(itens: { nome: string; qtd: number }[]): string {
  if (!itens.length) return "";
  const linhas = itens
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;font-family:Arial,sans-serif;font-size:14px;color:#374151;border-bottom:1px solid #f0f0f0">${esc(i.nome)}</td>
         <td align="right" style="padding:6px 0;font-family:Arial,sans-serif;font-size:14px;color:#6b7280;border-bottom:1px solid #f0f0f0">${i.qtd}x</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0">${linhas}</table>`;
}

/**
 * Envelope comum: logo, conteúdo e rodapé. `preheader` é a linha que o app de
 * e-mail mostra ao lado do assunto na lista — sem ela, o cliente vê o começo do
 * HTML, que costuma ser lixo.
 */
export function layoutEmail(opts: {
  titulo: string;
  preheader: string;
  conteudo: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.titulo)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f6">
  <span style="display:none;font-size:1px;color:#f4f5f6;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f6;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden">
        <tr><td style="background:${AZUL};padding:18px 24px">
          <a href="${SITE}" style="font-family:Arial,sans-serif;font-size:18px;font-weight:bold;color:#ffffff;text-decoration:none">Guppy de Linhagem</a>
        </td></tr>
        <tr><td style="padding:24px">${opts.conteudo}</td></tr>
        <tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee">
          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;line-height:1.6">
            Guppy de Linhagem · Marchezi Guppy Farm · Guarapari/ES<br>
            Dúvida? Responda este e-mail ou chame no WhatsApp 27 99602-4171.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Parágrafo padrão do corpo. */
export function p(texto: string): string {
  return `<p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:15px;color:#374151;line-height:1.6">${texto}</p>`;
}

/** Título do corpo. */
export function h1(texto: string): string {
  return `<h1 style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:20px;color:${AZUL}">${esc(texto)}</h1>`;
}
