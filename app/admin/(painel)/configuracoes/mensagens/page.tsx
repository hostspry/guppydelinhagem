import Link from "next/link";
import { Mail, MailX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { TEMPLATES } from "@/lib/emails/catalogo";

export const dynamic = "force-dynamic";

export default async function MensagensPage() {
  // Uma consulta só: o resto sai do catálogo (que é a lista de verdade).
  const salvos = await prisma.templateEmail.findMany({
    select: { chave: true, ativo: true, atualizadoEm: true },
  });
  const porChave = new Map(salvos.map((s) => [s.chave, s]));

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-gray-500">
        Os textos que o site manda para o cliente. Você pode reescrever cada um,
        desligar o que não quiser enviar e mandar um teste antes.
      </p>

      {TEMPLATES.map((t) => {
        const s = porChave.get(t.chave);
        const desligado = s && !s.ativo;
        return (
          <Link
            key={t.chave}
            href={`/admin/configuracoes/mensagens/${t.chave}`}
            className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
          >
            <div
              className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
                desligado
                  ? "bg-gray-100 text-gray-400"
                  : "bg-[#07366A]/10 text-[#07366A]"
              }`}
            >
              {desligado ? (
                <MailX className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Mail className="w-5 h-5" aria-hidden="true" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#07366A]">{t.rotulo}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.quando}</p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              {desligado && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  desligado
                </span>
              )}
              {s && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  texto editado
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
