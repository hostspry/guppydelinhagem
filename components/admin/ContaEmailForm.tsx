"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { FormField } from "@/components/admin/FormField";
import { salvarContaEmail, testarContaEmail } from "@/actions/email";

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export type ContaEmailInicial = {
  existe: boolean;
  ativo: boolean;
  host: string;
  porta: number;
  seguranca: "STARTTLS" | "SSL" | "NENHUMA";
  usuario: string;
  remetenteNome: string;
  remetenteEmail: string;
  responderPara: string | null;
  ultimoTesteEm: string | null;
  ultimoTesteOk: boolean | null;
  ultimoTesteErro: string | null;
};

/**
 * Cadastro da conta de e-mail (SMTP) que o site usa para enviar.
 *
 * A senha nunca é devolvida pelo servidor — o campo nasce vazio mesmo quando já
 * existe uma salva, e deixar vazio significa "mantém a atual". Assim dá para
 * corrigir a porta sem redigitar a senha, e a senha não trafega de volta.
 */
export function ContaEmailForm({ inicial }: { inicial: ContaEmailInicial }) {
  const [salvando, startSalvar] = useTransition();
  const [testando, startTestar] = useTransition();
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const [emailTeste, setEmailTeste] = useState("");
  const [resultado, setResultado] = useState<{
    ok: boolean;
    mensagem: string;
  } | null>(null);

  const [ativo, setAtivo] = useState(inicial.ativo);
  const [seguranca, setSeguranca] = useState(inicial.seguranca);
  const [porta, setPorta] = useState(String(inicial.porta));

  // As duas combinações que os provedores usam. Trocar uma acerta a outra —
  // porta 465 com STARTTLS (ou 587 com SSL) simplesmente não conecta.
  function mudarSeguranca(v: "STARTTLS" | "SSL" | "NENHUMA") {
    setSeguranca(v);
    if (v === "SSL" && porta === "587") setPorta("465");
    if (v === "STARTTLS" && porta === "465") setPorta("587");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const dados = {
      ativo: fd.get("ativo") === "on",
      host: String(fd.get("host") ?? ""),
      porta: String(fd.get("porta") ?? ""),
      seguranca: String(fd.get("seguranca") ?? "STARTTLS"),
      usuario: String(fd.get("usuario") ?? ""),
      senha: String(fd.get("senha") ?? ""),
      remetenteNome: String(fd.get("remetenteNome") ?? ""),
      remetenteEmail: String(fd.get("remetenteEmail") ?? ""),
      responderPara: String(fd.get("responderPara") ?? ""),
    };
    startSalvar(async () => {
      const r = await salvarContaEmail(dados);
      if (!r.success) {
        setErros(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      setErros({});
      toast.success(r.message ?? "Conta salva.");
    });
  }

  function testar() {
    setResultado(null);
    startTestar(async () => {
      const r = await testarContaEmail({ para: emailTeste });
      setResultado(r);
      if (r.ok) toast.success("E-mail de teste enviado.");
      else toast.error("O teste falhou.");
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-lg p-5">
        <label className="flex items-start gap-2 text-sm text-gray-700 mb-5">
          <input
            type="checkbox"
            name="ativo"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="mt-0.5 accent-[#FF035C]"
          />
          <span>
            Usar esta conta para enviar e-mails
            <span className="block text-xs text-gray-400">
              Desligado, o site simplesmente não manda e-mail — nada quebra.
            </span>
          </span>
        </label>

        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          Servidor de saída
        </h2>

        <FormField
          label="Servidor (host)"
          name="host"
          required
          error={erros.host?.[0]}
          hint="O provedor informa. No seu domínio hoje é elion.serversbr.com."
        >
          <input
            id="host"
            name="host"
            defaultValue={inicial.host}
            className={input}
            placeholder="elion.serversbr.com"
          />
        </FormField>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormField label="Segurança" name="seguranca">
            <select
              id="seguranca"
              name="seguranca"
              value={seguranca}
              onChange={(e) =>
                mudarSeguranca(e.target.value as "STARTTLS" | "SSL" | "NENHUMA")
              }
              className={input}
            >
              <option value="STARTTLS">STARTTLS (porta 587)</option>
              <option value="SSL">SSL/TLS (porta 465)</option>
              <option value="NENHUMA">Sem criptografia</option>
            </select>
          </FormField>

          <FormField label="Porta" name="porta" required error={erros.porta?.[0]}>
            <input
              id="porta"
              name="porta"
              inputMode="numeric"
              value={porta}
              onChange={(e) => setPorta(e.target.value)}
              className={input}
            />
          </FormField>
        </div>

        <FormField
          label="Usuário"
          name="usuario"
          required
          error={erros.usuario?.[0]}
          hint="Quase sempre é o endereço completo, tipo loja@guppydelinhagem.com.br."
        >
          <input
            id="usuario"
            name="usuario"
            autoComplete="off"
            defaultValue={inicial.usuario}
            className={input}
            placeholder="loja@guppydelinhagem.com.br"
          />
        </FormField>

        <FormField
          label="Senha"
          name="senha"
          error={erros.senha?.[0]}
          hint={
            inicial.existe
              ? "Já existe uma senha guardada. Deixe em branco para mantê-la."
              : "A senha da caixa de e-mail. Fica guardada criptografada e nunca volta para esta tela."
          }
        >
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            className={input}
            placeholder={inicial.existe ? "••••••••" : ""}
          />
        </FormField>

        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3 mt-6">
          Como o cliente vê
        </h2>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormField
            label="Nome do remetente"
            name="remetenteNome"
            required
            error={erros.remetenteNome?.[0]}
          >
            <input
              id="remetenteNome"
              name="remetenteNome"
              defaultValue={inicial.remetenteNome || "Guppy de Linhagem"}
              className={input}
            />
          </FormField>

          <FormField
            label="E-mail do remetente"
            name="remetenteEmail"
            required
            error={erros.remetenteEmail?.[0]}
            hint="Precisa ser uma caixa desse mesmo servidor."
          >
            <input
              id="remetenteEmail"
              name="remetenteEmail"
              type="email"
              defaultValue={inicial.remetenteEmail}
              className={input}
              placeholder="loja@guppydelinhagem.com.br"
            />
          </FormField>
        </div>

        <FormField
          label="Responder para"
          name="responderPara"
          error={erros.responderPara?.[0]}
          hint="Opcional. Para onde vai a resposta do cliente, se for outro endereço."
        >
          <input
            id="responderPara"
            name="responderPara"
            type="email"
            defaultValue={inicial.responderPara ?? ""}
            className={input}
          />
        </FormField>

        <button
          type="submit"
          disabled={salvando}
          className="mt-2 px-5 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {salvando ? "Salvando…" : "Salvar conta"}
        </button>
      </form>

      {/* Teste: conecta, autentica e manda uma mensagem de verdade. */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-[#07366A] mb-1">
          Testar o envio
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Manda uma mensagem de verdade para o endereço que você escolher. Salve a
          conta antes.
        </p>

        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={emailTeste}
            onChange={(e) => setEmailTeste(e.target.value)}
            placeholder="seu@email.com"
            className={`${input} max-w-xs`}
          />
          <button
            type="button"
            onClick={testar}
            disabled={testando || !emailTeste}
            className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-gray-400 disabled:opacity-50 transition-all"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            {testando ? "Enviando…" : "Enviar teste"}
          </button>
        </div>

        {resultado && (
          <p
            role="status"
            className={`mt-3 flex items-start gap-1.5 text-sm ${
              resultado.ok ? "text-green-700" : "text-red-700"
            }`}
          >
            {resultado.ok ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            {resultado.mensagem}
          </p>
        )}

        {!resultado && inicial.ultimoTesteEm && (
          <p className="mt-3 text-xs text-gray-500">
            Último teste em {inicial.ultimoTesteEm}:{" "}
            {inicial.ultimoTesteOk ? (
              <span className="text-green-700">funcionou</span>
            ) : (
              <span className="text-red-700">
                falhou — {inicial.ultimoTesteErro}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
