"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

/**
 * A senha aparece UMA vez, logo depois de ser gerada — não fica guardada em
 * lugar nenhum legível (o banco só tem o hash bcrypt). Se a pessoa perder, o
 * caminho é gerar outra.
 */
export function SenhaTemporaria({
  nome,
  email,
  senha,
}: {
  nome: string;
  email: string;
  senha: string;
}) {
  const [copiado, setCopiado] = useState(false);

  const texto = `Acesso ao painel Guppy de Linhagem\nSite: https://guppydelinhagem.com.br/admin/login\nE-mail: ${email}\nSenha temporária: ${senha}\n\nTroque a senha no primeiro acesso.`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de clipboard (http, navegador antigo): a senha está na
      // tela, dá para selecionar e copiar na mão.
    }
  }

  return (
    <div className="bg-white border-2 border-[#FF035C] rounded-lg p-5 max-w-2xl">
      <div className="flex items-center gap-2 mb-3">
        <KeyRound className="w-4 h-4 text-[#FF035C]" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-[#07366A]">
          Acesso criado para {nome}
        </h2>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Copie e mande para {nome.split(" ")[0]}. Esta senha aparece só agora: ao
        sair desta tela ela não pode mais ser consultada, só trocada por outra.
      </p>

      <dl className="text-sm mb-4 space-y-1.5">
        <div className="flex gap-2">
          <dt className="text-gray-500 w-32 shrink-0">E-mail</dt>
          <dd className="font-medium text-[#07366A] break-all">{email}</dd>
        </div>
        <div className="flex gap-2 items-center">
          <dt className="text-gray-500 w-32 shrink-0">Senha temporária</dt>
          <dd className="font-mono text-base font-semibold text-[#07366A] bg-gray-50 border border-gray-200 rounded px-2 py-1 select-all">
            {senha}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={copiar}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 transition-all"
      >
        {copiado ? (
          <Check className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Copy className="w-4 h-4" aria-hidden="true" />
        )}
        {copiado ? "Copiado" : "Copiar mensagem pronta"}
      </button>
    </div>
  );
}
