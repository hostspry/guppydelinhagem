import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { descriptografar } from "@/lib/cripto";

/**
 * Envio de e-mail pela conta cadastrada no admin (Configurações → E-mail).
 *
 * A conta é um singleton no banco, não variável de ambiente: quem troca a senha
 * da caixa é o dono, e ele não mexe no Coolify. Enquanto não houver conta ativa,
 * `enviarEmail` devolve `false` em vez de lançar — e-mail é sempre um complemento
 * aqui (o pedido já existe, o acesso já foi criado), nunca pode derrubar a
 * operação principal.
 */

export type ContaSmtp = {
  host: string;
  porta: number;
  seguranca: "STARTTLS" | "SSL" | "NENHUMA";
  usuario: string;
  senha: string;
  remetenteNome: string;
  remetenteEmail: string;
  responderPara?: string | null;
};

export type ResultadoEnvio =
  | { ok: true; messageId: string | null }
  | { ok: false; erro: string };

const TIMEOUT_MS = 15_000;

function transporte(c: ContaSmtp) {
  return nodemailer.createTransport({
    host: c.host,
    port: c.porta,
    // 465 fala TLS desde o primeiro byte; 587 abre limpo e sobe para TLS.
    secure: c.seguranca === "SSL",
    requireTLS: c.seguranca === "STARTTLS",
    auth: { user: c.usuario, pass: c.senha },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
}

/** Mensagem do servidor traduzida para algo que o dono resolva sozinho. */
export function explicarErroSmtp(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string } | null)?.code ?? "";

  if (/EAUTH|535|534|authentication/i.test(msg + code)) {
    return "Usuário ou senha recusados pelo servidor. Confira o e-mail completo como usuário e a senha da caixa.";
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg + code)) {
    return "Servidor não encontrado. Confira o endereço do servidor de saída (host).";
  }
  if (/ETIMEDOUT|ECONNREFUSED|ESOCKET|timeout/i.test(msg + code)) {
    return "Não deu para conectar nessa porta. Tente 587 com STARTTLS, ou 465 com SSL.";
  }
  if (/self.signed|certificate|CERT/i.test(msg)) {
    return "O certificado do servidor não confere com o endereço informado. Use o host oficial do provedor.";
  }
  if (/550|553|relay|not permitted|sender/i.test(msg)) {
    return "O servidor recusou o remetente. O e-mail do remetente precisa ser uma caixa desse mesmo servidor.";
  }
  return msg.slice(0, 200);
}

/** Testa conexão + autenticação, sem mandar mensagem nenhuma. */
export async function verificarConta(c: ContaSmtp): Promise<ResultadoEnvio> {
  try {
    await transporte(c).verify();
    return { ok: true, messageId: null };
  } catch (e) {
    return { ok: false, erro: explicarErroSmtp(e) };
  }
}

export async function enviarComConta(
  c: ContaSmtp,
  msg: { para: string; assunto: string; html: string; texto?: string },
): Promise<ResultadoEnvio> {
  try {
    const info = await transporte(c).sendMail({
      from: `"${c.remetenteNome}" <${c.remetenteEmail}>`,
      to: msg.para,
      subject: msg.assunto,
      html: msg.html,
      // Cliente de e-mail que não renderiza HTML ainda lê a mensagem.
      text: msg.texto ?? msg.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      ...(c.responderPara ? { replyTo: c.responderPara } : {}),
    });
    return { ok: true, messageId: info.messageId ?? null };
  } catch (e) {
    return { ok: false, erro: explicarErroSmtp(e) };
  }
}

/** Conta salva, já com a senha aberta. null = nada cadastrado ou desligado. */
export async function contaAtiva(): Promise<ContaSmtp | null> {
  const c = await prisma.configuracaoEmail.findUnique({
    where: { id: "default" },
  });
  if (!c || !c.ativo) return null;
  try {
    return {
      host: c.host,
      porta: c.porta,
      seguranca: c.seguranca,
      usuario: c.usuario,
      senha: descriptografar(c.senhaCriptografada),
      remetenteNome: c.remetenteNome,
      remetenteEmail: c.remetenteEmail,
      responderPara: c.responderPara,
    };
  } catch (e) {
    // AUTH_SECRET trocado ou registro adulterado: melhor não enviar do que
    // enviar com credencial quebrada e travar a caixa por tentativas.
    console.error("[email] senha guardada ilegível", e);
    return null;
  }
}

/**
 * Envia pela conta cadastrada. `false` quando não há conta ativa ou o envio
 * falhou — quem chama decide se isso importa, e nunca quebra por causa disso.
 */
export async function enviarEmail(msg: {
  para: string;
  assunto: string;
  html: string;
  texto?: string;
}): Promise<boolean> {
  const conta = await contaAtiva();
  if (!conta) return false;
  const r = await enviarComConta(conta, msg);
  if (!r.ok) console.error("[email] falha ao enviar:", r.erro);
  return r.ok;
}
