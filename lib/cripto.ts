import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Segredo guardado no banco de forma reversível (AES-256-GCM).
 *
 * Serve para credencial que o servidor precisa USAR, não conferir: a senha do
 * SMTP tem que chegar em texto ao servidor de e-mail, então hash não resolve.
 * O que dá para fazer é tirar o valor de dentro do banco — com isto, um dump do
 * Postgres sozinho não entrega a senha; é preciso também o AUTH_SECRET, que vive
 * nas variáveis de ambiente do servidor.
 *
 * Formato guardado: v1.<iv>.<tag>.<texto cifrado>, tudo em base64url. O prefixo
 * de versão existe para dar caminho de migração se um dia trocarmos o algoritmo.
 */

const VERSAO = "v1";
const SALT = "guppy-cripto-v1"; // fixo de propósito: a chave precisa ser estável

function chave(): Buffer {
  const segredo = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!segredo) {
    throw new Error(
      "AUTH_SECRET não configurado — sem ele não dá para guardar a senha do e-mail com segurança.",
    );
  }
  return scryptSync(segredo, SALT, 32);
}

export function criptografar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSAO,
    iv.toString("base64url"),
    tag.toString("base64url"),
    cifrado.toString("base64url"),
  ].join(".");
}

/**
 * Devolve o texto original. Lança se o valor foi adulterado ou se a chave mudou
 * (AUTH_SECRET trocado) — nesse caso a saída honesta é o admin cadastrar a senha
 * de novo, não seguir com um valor corrompido.
 */
export function descriptografar(guardado: string): string {
  const partes = guardado.split(".");
  if (partes.length !== 4 || partes[0] !== VERSAO) {
    throw new Error("Segredo em formato desconhecido.");
  }
  const [, iv, tag, cifrado] = partes;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    chave(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(cifrado, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
