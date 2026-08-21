import Link from "next/link";
import { Ticket } from "lucide-react";
import { ConfigLojaForm } from "@/components/admin/ConfigLojaForm";
import { getConfiguracaoLoja } from "@/lib/queries/config";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesLojaPage() {
  const config = await getConfiguracaoLoja();

  return (
    <div className="space-y-6">
      <ConfigLojaForm
        inicial={{
          tarjaAtiva: config.tarjaAtiva,
          tarjaTexto: config.tarjaTexto,
        }}
      />

      {/* Cupons têm tela própria; aqui fica só o caminho até ela. */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-[#FF035C]/10 text-[#FF035C] rounded-md flex items-center justify-center shrink-0">
            <Ticket className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-[#07366A]">
              Cupons de desconto
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Crie cupons percentuais ou de valor fixo, defina escopo, validade e
              limite de usos.
            </p>
          </div>
          <Link
            href="/admin/cupons"
            className="shrink-0 inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-gray-400 transition-all"
          >
            Gerenciar cupons
          </Link>
        </div>
      </div>
    </div>
  );
}
