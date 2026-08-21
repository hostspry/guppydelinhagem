"use client";

import { useState, useTransition } from "react";
import { Copy, KeyRound, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { criarAcessoCliente } from "@/actions/clientes";

/**
 * Cria o acesso do cliente ao painel e entrega as credenciais para o dono
 * repassar. Pensado para a venda direta: quem comprou pelo WhatsApp nunca passou
 * pelo cadastro do site e não tem como acompanhar o pedido sozinho.
 *
 * A senha aparece UMA vez, aqui. Não fica salva em lugar nenhum (só o hash) e
 * some ao recarregar a página — se o dono perder, gera outra.
 */
export function AcessoCliente({
  clienteId,
  clienteNome,
  clienteEmail,
  clienteTelefone,
  jaTemAcesso,
}: {
  clienteId: string;
  clienteNome: string;
  clienteEmail: string | null;
  clienteTelefone: string | null;
  /** Já existe conta ligada a este cliente (o botão vira "gerar nova senha"). */
  jaTemAcesso: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [cred, setCred] = useState<{ email: string; senha: string } | null>(null);

  const primeiroNome = clienteNome.trim().split(/\s+/)[0] ?? "";

  const mensagem = cred
    ? `Oi ${primeiroNome}! Criei seu acesso no site para você acompanhar seu pedido e o rastreio da entrega.\n\n` +
      `Entre em https://www.guppydelinhagem.com.br/login\n` +
      `E-mail: ${cred.email}\n` +
      `Senha: ${cred.senha}\n\n` +
      `Na primeira entrada o site pede para você criar a sua própria senha.`
    : "";

  const digitos = (clienteTelefone ?? "").replace(/\D/g, "");
  const comDdi = digitos
    ? digitos.startsWith("55")
      ? digitos
      : `55${digitos}`
    : "";
  const waHref = `https://wa.me/${comDdi}?text=${encodeURIComponent(mensagem)}`;

  function gerar() {
    startTransition(async () => {
      const r = await criarAcessoCliente(clienteId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setCred({ email: r.email, senha: r.senha });
      toast.success(r.recriado ? "Nova senha gerada." : "Acesso criado.");
    });
  }

  async function copiar(texto: string, aviso: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(aviso);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie na mão.");
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h2 className="text-sm font-semibold text-[#07366A] mb-1 flex items-center gap-1.5">
        <KeyRound className="w-4 h-4" aria-hidden="true" />
        Acesso do cliente
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        {jaTemAcesso
          ? `${primeiroNome} já tem conta no site e vê os pedidos dele em Minha conta.`
          : `Cria a conta de ${primeiroNome} para ele acompanhar o pedido e o rastreio sozinho.`}
      </p>

      {!clienteEmail ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          Este cliente está sem e-mail no cadastro. O e-mail é o usuário do
          acesso — preencha antes de criar.
        </p>
      ) : cred ? (
        <div className="space-y-3">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-1.5">
            <p className="text-xs text-gray-500">E-mail</p>
            <p className="text-sm font-medium text-[#07366A] break-all">
              {cred.email}
            </p>
            <p className="text-xs text-gray-500 pt-1">Senha temporária</p>
            <p className="text-base font-mono font-semibold text-[#07366A] break-all">
              {cred.senha}
            </p>
          </div>

          <p className="text-[11px] text-gray-500">
            Anote ou mande agora: esta senha some quando você sair da página. Ela
            serve para uma entrada só — depois o cliente cria a dele.
          </p>

          <div className="flex flex-wrap gap-2">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#25D366] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-95 transition-all"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Mandar no WhatsApp
            </a>
            <button
              type="button"
              onClick={() => copiar(mensagem, "Mensagem copiada.")}
              className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-gray-400 transition-all"
            >
              <Copy className="w-4 h-4" aria-hidden="true" />
              Copiar mensagem
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={gerar}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-gray-400 transition-all disabled:opacity-60"
        >
          {jaTemAcesso ? (
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          ) : (
            <KeyRound className="w-4 h-4" aria-hidden="true" />
          )}
          {isPending
            ? "Gerando…"
            : jaTemAcesso
              ? "Gerar nova senha"
              : "Criar acesso e senha"}
        </button>
      )}
    </div>
  );
}
