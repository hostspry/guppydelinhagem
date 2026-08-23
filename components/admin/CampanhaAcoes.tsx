"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Play, Send, Trash2 } from "lucide-react";
import {
  cancelarCampanha,
  continuarEnvio,
  dispararCampanha,
  enviarTesteCampanha,
  excluirCampanha,
} from "@/actions/campanhas";

/**
 * Disparo, teste e cancelamento.
 *
 * O disparo pede confirmação com o número de pessoas no texto: mandar e-mail
 * para a lista inteira não tem desfazer, e o susto tem que vir antes.
 */
export function CampanhaAcoes({
  id,
  status,
  nome,
  pendentes,
}: {
  id: string;
  status: string;
  nome: string;
  pendentes: number;
}) {
  const [pendente, start] = useTransition();
  const [emailTeste, setEmailTeste] = useState("");
  const router = useRouter();

  const disparar = () => {
    if (
      !confirm(
        `Enviar "${nome}" agora? O e-mail sai para a lista escolhida e não tem como voltar atrás.`,
      )
    )
      return;
    start(async () => {
      const r = await dispararCampanha(id);
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.mensagem);
      router.refresh();
    });
  };

  const continuar = () =>
    start(async () => {
      const r = await continuarEnvio(id);
      toast.success(r.mensagem);
      router.refresh();
    });

  const cancelar = () => {
    if (!confirm(`Cancelar "${nome}"? Quem já recebeu continua tendo recebido.`)) return;
    start(async () => {
      const r = await cancelarCampanha(id);
      if (r.success) toast.success(r.message ?? "Cancelada.");
      else toast.error(r.error);
      router.refresh();
    });
  };

  const apagar = () => {
    if (!confirm(`Apagar "${nome}"?`)) return;
    start(async () => {
      const r = await excluirCampanha(id);
      if (r.success) {
        toast.success(r.message ?? "Apagada.");
        router.push("/admin/campanhas");
      } else toast.error(r.error);
    });
  };

  const testar = () =>
    start(async () => {
      const r = await enviarTesteCampanha(id, emailTeste);
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.mensagem);
    });

  const btn =
    "inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md transition-all disabled:opacity-50";
  const podeDisparar = status === "RASCUNHO" || status === "AGENDADA";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-1">
          Mandar um teste
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Vai só para este endereço, com o texto como está salvo.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={emailTeste}
            onChange={(e) => setEmailTeste(e.target.value)}
            placeholder="seu@email.com"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm max-w-xs focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
          />
          <button
            type="button"
            onClick={testar}
            disabled={pendente || !emailTeste}
            className={`${btn} border border-gray-300 text-gray-700 hover:border-gray-400`}
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            Enviar teste
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          Envio
        </h2>
        <div className="flex flex-wrap gap-2">
          {podeDisparar && (
            <button
              type="button"
              onClick={disparar}
              disabled={pendente}
              className={`${btn} bg-[#FF035C] text-white hover:brightness-110`}
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              {status === "AGENDADA" ? "Enviar agora (adiantar)" : "Enviar agora"}
            </button>
          )}

          {status === "ENVIANDO" && pendentes > 0 && (
            <button
              type="button"
              onClick={continuar}
              disabled={pendente}
              className={`${btn} bg-[#07366A] text-white hover:brightness-125`}
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              Continuar ({pendentes} na fila)
            </button>
          )}

          {status !== "ENVIADA" && status !== "CANCELADA" && (
            <button
              type="button"
              onClick={cancelar}
              disabled={pendente}
              className={`${btn} border border-gray-300 text-gray-700 hover:border-gray-400`}
            >
              <Ban className="w-4 h-4" aria-hidden="true" />
              Cancelar
            </button>
          )}

          {(status === "RASCUNHO" || status === "AGENDADA" || status === "CANCELADA") && (
            <button
              type="button"
              onClick={apagar}
              disabled={pendente}
              className={`${btn} border border-gray-300 text-gray-700 hover:border-[#FF035C]/40 hover:text-[#FF035C]`}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Apagar
            </button>
          )}
        </div>

        {status === "ENVIANDO" && (
          <p className="text-xs text-gray-500 mt-3">
            O envio segue sozinho em lotes. Você pode fechar esta tela.
          </p>
        )}
      </div>
    </div>
  );
}
