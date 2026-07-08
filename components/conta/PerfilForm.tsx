"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { atualizarPerfil } from "@/actions/conta";

const inputCls =
  "w-full h-11 px-4 rounded-lg border border-gray-200 bg-white text-sm text-[#07366A] placeholder:text-gray-400 focus:outline-none focus:border-[#07366A] focus:ring-2 focus:ring-[#07366A]/15 transition-all";
const labelCls = "block text-sm font-medium text-[#07366A] mb-1.5";

export default function PerfilForm({
  inicial,
}: {
  inicial: { nome: string; email: string; telefone: string; cpfCnpj: string };
}) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial.nome);
  const [telefone, setTelefone] = useState(inicial.telefone);
  const [cpfCnpj, setCpfCnpj] = useState(inicial.cpfCnpj);
  const [salvando, setSalvando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    try {
      const res = await atualizarPerfil({ nome, telefone, cpfCnpj });
      if (res.ok) {
        toast.success("Perfil atualizado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível salvar.");
      }
    } catch {
      toast.error("Falha de rede. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="nome" className={labelCls}>
          Nome
        </label>
        <input
          id="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="email" className={labelCls}>
          E-mail
        </label>
        <input
          id="email"
          value={inicial.email}
          readOnly
          disabled
          className={`${inputCls} bg-gray-50 text-gray-400 cursor-not-allowed`}
        />
        <p className="text-xs text-gray-400 mt-1">
          O e-mail vem do seu login e não pode ser alterado aqui.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="telefone" className={labelCls}>
            WhatsApp
          </label>
          <input
            id="telefone"
            type="tel"
            inputMode="numeric"
            placeholder="(27) 99999-9999"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="cpf" className={labelCls}>
            CPF <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            id="cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={salvando}
        className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-[#FF035C] text-white font-semibold text-sm hover:brightness-110 disabled:opacity-60 transition-all"
      >
        {salvando && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        Salvar
      </button>
    </form>
  );
}
