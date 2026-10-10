import { PageHeader } from "@/components/admin/PageHeader";
import { ConfirmarVerificacao } from "@/components/admin/sorteios/Acoes";
import { listVerificacoesPendentes } from "@/lib/queries/sorteios";
import { formatarTelefone } from "@/lib/sorteios/telefone";
import { dataHoraBR } from "@/lib/sorteios/formato";
import { WHATSAPP_DISPLAY } from "@/lib/constants";

export const metadata = { title: "Verificar WhatsApp | Admin" };

export default async function VerificacoesPage() {
  const pendentes = await listVerificacoesPendentes();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Verificar WhatsApp de clientes"
        description="O cliente gera um código na conta e manda do próprio WhatsApp para o da loja. Confirme aqui só o que chegou do número pedido."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Sorteios", href: "/admin/sorteios" }, { label: "Verificar WhatsApp" }]}
      />

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Como conferir</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>Abra a conversa no WhatsApp da loja ({WHATSAPP_DISPLAY}).</li>
          <li>
            Confira que a mensagem veio <strong>do número exato</strong> listado abaixo. Encaminhada, print ou outro número não vale.
          </li>
          <li>Digite o código que está na mensagem. O painel não mostra o código: é você que confirma o que recebeu.</li>
        </ol>
      </div>

      {pendentes.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Nenhum pedido de verificação pendente.</p>
      ) : (
        <ul className="space-y-3">
          {pendentes.map((v) => (
            <li key={v.id} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-lg font-semibold text-[#07366A]">{formatarTelefone(v.telefone)}</p>
                <p className="text-xs text-gray-500">
                  {v.user.nome} · {v.user.email} · pedido em {dataHoraBR(v.criadoEm)}
                  {v.tentativas > 0 && <span className="text-red-600"> · {v.tentativas} tentativa(s) errada(s)</span>}
                </p>
                {v.creditosEsperando > 0 && <p className="text-xs font-medium text-green-700">{v.creditosEsperando} chance(s) esperando este número</p>}
              </div>
              <ConfirmarVerificacao verificacaoId={v.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
