"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { sairDaListaDeEspera } from "@/actions/conta";

export default function SairEsperaButton({ id }: { id: string }) {
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function sair() {
    if (carregando) return;
    if (!confirm("Sair da lista de espera deste peixe?")) return;
    setCarregando(true);
    try {
      const res = await sairDaListaDeEspera(id);
      if (res.ok) {
        toast.success("Você saiu da lista de espera.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível sair.");
        setCarregando(false);
      }
    } catch {
      toast.error("Falha de rede. Tente novamente.");
      setCarregando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={sair}
      disabled={carregando}
      aria-label="Sair da lista de espera"
      className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-500 hover:text-red-600 hover:border-red-300 disabled:opacity-60 transition-colors"
    >
      {carregando ? (
        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
      ) : (
        <X size={15} aria-hidden="true" />
      )}
      Sair
    </button>
  );
}
