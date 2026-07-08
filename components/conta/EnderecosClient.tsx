"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Plus, Loader2, Star, Pencil, Trash2 } from "lucide-react";
import {
  criarEndereco,
  atualizarEndereco,
  excluirEndereco,
  marcarEnderecoPadrao,
} from "@/actions/conta";

export type Endereco = {
  id: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  principal: boolean;
};

const VAZIO = {
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  principal: false,
};
type FormState = typeof VAZIO;

const inputCls =
  "w-full h-11 px-3 rounded-lg border border-gray-200 bg-white text-sm text-[#07366A] placeholder:text-gray-400 focus:outline-none focus:border-[#07366A] focus:ring-2 focus:ring-[#07366A]/15 transition-all";

function formatCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export default function EnderecosClient({
  enderecos,
}: {
  enderecos: Endereco[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  function abrirNovo() {
    setForm(VAZIO);
    setEditando("novo");
  }
  function abrirEdicao(e: Endereco) {
    setForm({
      cep: formatCep(e.cep),
      rua: e.rua,
      numero: e.numero,
      complemento: e.complemento ?? "",
      bairro: e.bairro,
      cidade: e.cidade,
      estado: e.estado,
      principal: e.principal,
    });
    setEditando(e.id);
  }
  function fechar() {
    setEditando(null);
    setForm(VAZIO);
  }
  const set = (campo: keyof FormState, valor: string | boolean) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  // ViaCEP: completa endereço ao sair do campo CEP (degrada em silêncio).
  async function buscarCep() {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data?.erro) {
          setForm((f) => ({
            ...f,
            rua: data.logradouro || f.rua,
            bairro: data.bairro || f.bairro,
            cidade: data.localidade || f.cidade,
            estado: data.uf || f.estado,
          }));
        }
      }
    } catch {
      // rede/CEP inválido — só não preenche
    } finally {
      setBuscandoCep(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    try {
      const res =
        editando === "novo"
          ? await criarEndereco(form)
          : await atualizarEndereco(editando as string, form);
      if (res.ok) {
        toast.success("Endereço salvo.");
        fechar();
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

  async function excluir(id: string) {
    if (!confirm("Excluir este endereço?")) return;
    const res = await excluirEndereco(id);
    if (res.ok) {
      toast.success("Endereço excluído.");
      router.refresh();
    } else {
      toast.error(res.error ?? "Não foi possível excluir.");
    }
  }

  async function tornarPadrao(id: string) {
    const res = await marcarEnderecoPadrao(id);
    if (res.ok) {
      toast.success("Endereço padrão atualizado.");
      router.refresh();
    } else {
      toast.error(res.error ?? "Não foi possível marcar como padrão.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Lista */}
      {enderecos.length > 0 && (
        <ul className="space-y-3">
          {enderecos.map((e) => (
            <li
              key={e.id}
              className="rounded-xl bg-white border border-black/5 p-4 shadow-sm flex items-start justify-between gap-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-[#07366A] shrink-0" aria-hidden="true" />
                  <span className="text-sm font-semibold text-[#07366A]">
                    {e.rua}, {e.numero}
                  </span>
                  {e.principal && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-medium">
                      <Star size={11} aria-hidden="true" /> Padrão
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {[e.complemento, e.bairro, `${e.cidade}/${e.estado}`, formatCep(e.cep)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                  {!e.principal && (
                    <button
                      type="button"
                      onClick={() => tornarPadrao(e.id)}
                      className="text-xs font-medium text-[#07366A] hover:underline"
                    >
                      Tornar padrão
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => abrirEdicao(e)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-[#07366A]"
                  >
                    <Pencil size={12} aria-hidden="true" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => excluir(e.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600"
                  >
                    <Trash2 size={12} aria-hidden="true" /> Excluir
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Form (novo/edição) ou botão adicionar */}
      {editando ? (
        <form
          onSubmit={salvar}
          className="rounded-2xl bg-white border border-black/5 p-5 shadow-sm space-y-3"
        >
          <p className="text-sm font-semibold text-[#07366A]">
            {editando === "novo" ? "Novo endereço" : "Editar endereço"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 sm:col-span-1 relative">
              <input
                aria-label="CEP"
                placeholder="CEP"
                value={form.cep}
                onChange={(e) => set("cep", formatCep(e.target.value))}
                onBlur={buscarCep}
                inputMode="numeric"
                className={inputCls}
              />
              {buscandoCep && (
                <Loader2
                  size={15}
                  className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
              )}
            </div>
            <input
              aria-label="Rua"
              placeholder="Rua"
              value={form.rua}
              onChange={(e) => set("rua", e.target.value)}
              className={`${inputCls} col-span-2 sm:col-span-3`}
            />
            <input
              aria-label="Número"
              placeholder="Número"
              value={form.numero}
              onChange={(e) => set("numero", e.target.value)}
              className={inputCls}
            />
            <input
              aria-label="Complemento"
              placeholder="Complemento"
              value={form.complemento}
              onChange={(e) => set("complemento", e.target.value)}
              className={`${inputCls} col-span-1 sm:col-span-3`}
            />
            <input
              aria-label="Bairro"
              placeholder="Bairro"
              value={form.bairro}
              onChange={(e) => set("bairro", e.target.value)}
              className={`${inputCls} col-span-2`}
            />
            <input
              aria-label="Cidade"
              placeholder="Cidade"
              value={form.cidade}
              onChange={(e) => set("cidade", e.target.value)}
              className={inputCls}
            />
            <input
              aria-label="UF"
              placeholder="UF"
              maxLength={2}
              value={form.estado}
              onChange={(e) => set("estado", e.target.value.toUpperCase())}
              className={inputCls}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={form.principal}
              onChange={(e) => set("principal", e.target.checked)}
              className="w-4 h-4 accent-[#07366A]"
            />
            Usar como endereço padrão
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-[#FF035C] text-white font-semibold text-sm hover:brightness-110 disabled:opacity-60 transition-all"
            >
              {salvando && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              Salvar
            </button>
            <button
              type="button"
              onClick={fechar}
              className="h-11 px-5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={abrirNovo}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-lg border border-dashed border-gray-300 text-sm font-medium text-[#07366A] hover:border-[#07366A] transition-colors"
        >
          <Plus size={16} aria-hidden="true" />
          Adicionar endereço
        </button>
      )}
    </div>
  );
}
