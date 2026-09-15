"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw, Search } from "lucide-react";
import { alternarUnidadeGollog, atualizarUnidadesGollog } from "@/actions/unidades-gollog";

type Unidade = {
  id: string;
  titulo: string;
  cidade: string;
  uf: string;
  endereco: string;
  ativa: boolean;
  naListaGollog: boolean;
};

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Unidades da Gollog para retirada. A lista é a oficial da Gollog; aqui a loja
 * só decide para quais envia. O cliente vê apenas as ligadas.
 */
export function UnidadesGollogLista({
  unidades,
  ultimaSincronizacao,
}: {
  unidades: Unidade[];
  ultimaSincronizacao: Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState(unidades);

  const filtradas = useMemo(() => {
    const t = normal(termo.trim());
    return t ? lista.filter((u) => normal(`${u.titulo} ${u.cidade} ${u.uf}`).includes(t)) : lista;
  }, [lista, termo]);

  const ligadas = lista.filter((u) => u.ativa && u.naListaGollog).length;

  function atualizar() {
    startTransition(async () => {
      const r = await atualizarUnidadesGollog();
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });
  }

  function alternar(u: Unidade) {
    const ativa = !u.ativa;
    setLista((a) => a.map((x) => (x.id === u.id ? { ...x, ativa } : x)));
    startTransition(async () => {
      const r = await alternarUnidadeGollog(u.id, ativa);
      if (!r.ok) {
        setLista((a) => a.map((x) => (x.id === u.id ? { ...x, ativa: !ativa } : x)));
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm space-y-2">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          Unidades de retirada (Gollog)
        </h2>
        <p className="text-gray-600">
          A lista vem direto da Gollog e se atualiza sozinha uma vez por dia. Título,
          endereço e cidade são os que a Gollog publica. Aqui você só escolhe para quais
          unidades envia: o cliente vê apenas as ligadas.
        </p>
        <p className="text-xs text-gray-500">
          {ligadas} de {lista.length} ligadas
          {ultimaSincronizacao &&
            ` · atualizada em ${new Date(ultimaSincronizacao).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}`}
        </p>
        <button
          type="button"
          onClick={atualizar}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-300 text-xs font-medium text-[#07366A] hover:border-[#07366A] disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
          Atualizar agora pela Gollog
        </button>
      </div>

      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          aria-hidden="true"
        />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por cidade, estado ou código"
          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
        />
      </div>

      <ul className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {filtradas.map((u) => (
          <li key={u.id} className="p-3 text-sm">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={u.ativa}
                onChange={() => alternar(u)}
                disabled={!u.naListaGollog}
                className="mt-1 w-4 h-4 accent-[#FF035C]"
              />
              <span className="min-w-0">
                <span
                  className={`block font-medium ${u.ativa ? "text-[#07366A]" : "text-gray-400 line-through"}`}
                >
                  {u.titulo}
                </span>
                <span className="block text-xs text-gray-500">
                  {u.cidade}/{u.uf} · {u.endereco}
                </span>
                {!u.naListaGollog && (
                  <span className="block text-xs text-amber-700">
                    Saiu da lista da Gollog. Não aparece para o cliente.
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
        {filtradas.length === 0 && (
          <li className="p-3 text-sm text-gray-400">Nenhuma unidade com esse nome.</li>
        )}
      </ul>
    </div>
  );
}
