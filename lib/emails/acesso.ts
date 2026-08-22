import "server-only";
import { enviarEmail } from "@/lib/email";
import { botao, destaque } from "./layout";
import { montarEmail } from "./render";

/**
 * E-mail com o acesso que a loja criou para o cliente (venda direta).
 *
 * A senha vai em texto no corpo porque é temporária de propósito: serve para uma
 * entrada só e morre quando o cliente define a dele. Sem isso, o dono teria que
 * ditar a senha no WhatsApp — que é onde ela ficaria guardada para sempre.
 */
export async function emailAcessoCliente(dados: {
  nome: string;
  email: string;
  senha: string;
}): Promise<boolean> {
  const primeiroNome = dados.nome.trim().split(/\s+/)[0] || dados.nome.trim();

  const email = await montarEmail(
    "acesso-cliente",
    {
      nome: primeiroNome,
      email_login: dados.email,
      senha: dados.senha,
      caixa_acesso:
        destaque("E-mail", dados.email) + destaque("Senha temporária", dados.senha),
      botao_entrar: botao(
        "Entrar na minha conta",
        "https://www.guppydelinhagem.com.br/login",
      ),
    },
    "Seu acesso ao site está pronto.",
  );
  if (!email) return false;

  return enviarEmail({ para: dados.email, assunto: email.assunto, html: email.html });
}
