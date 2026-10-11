import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Gavel } from "lucide-react";
import { exigirSessao } from "@/lib/auth";
import { listArrematesDoUsuario } from "@/lib/queries/minha-conta";
import { getArrematePorToken } from "@/lib/queries/leiloes";
import { getTelefonesDoUsuario } from "@/lib/queries/sorteios";
import { dataLeilaoBR, SITUACAO_ARREMATE } from "@/lib/leiloes/situacao";
import { formatBRL } from "@/lib/utils/format";
import CobrancaArremate from "@/components/leilao/CobrancaArremate";
import { VerificarWhatsapp } from "@/components/conta/sorteios/VerificarWhatsapp";

export const metadata: Metadata = {
  title: "Meus Leilões | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

/**
 * Arremates do cliente. O último leilão vem aberto, com a entrega e o
 * pagamento na própria página; os anteriores ficam numa lista curta.
 */
export default async function MeusLeiloesPage() {
  const user = await exigirSessao("/minha-conta/leiloes");
  const [arremates, telefones] = await Promise.all([
    listArrematesDoUsuario(user.id, user.email),
    getTelefonesDoUsuario(user.id),
  ]);

  const ultimoLeilaoId = arremates[0]?.leilao?.id ?? null;
  const doUltimo = arremates.filter((a) => (a.leilao?.id ?? null) === ultimoLeilaoId);
  const anteriores = arremates.filter((a) => (a.leilao?.id ?? null) !== ultimoLeilaoId);

  // Só um formulário de cartão por página (o Brick do MP usa um container fixo):
  // a cobrança aberta mais recente vem completa; outra aberta do mesmo leilão,
  // caso exista, vai para o link próprio.
  const principal =
    doUltimo.find((a) => a.situacao === "ESCOLHER_ENTREGA" || a.situacao === "AGUARDANDO_PAGAMENTO") ??
    doUltimo[0] ??
    null;
  const detalhe = principal?.token ? await getArrematePorToken(principal.token) : null;
  // Arrematante cadastrado pela loja costuma vir sem e-mail: o da conta logada
  // já serve de ponto de partida (ele confirma antes de pagar).
  if (detalhe && !detalhe.pagador.email && user.email) detalhe.pagador.email = user.email;
  const outros = [...doUltimo.filter((a) => a !== principal), ...anteriores];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#07366A]">Meus Leilões</h1>
        <p className="text-sm text-gray-500">
          Os lotes que você arrematou nos nossos leilões ao vivo pelo WhatsApp.
        </p>
      </div>

      {!detalhe ? (
        <div className="rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
          <Gavel className="mx-auto mb-2 h-8 w-8 text-[#FAB82A]" aria-hidden="true" />
          <p className="font-semibold text-[#07366A]">Nenhum arremate ligado à sua conta</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            Arrematou algum lote? Confirme abaixo o WhatsApp que você usou nos lances e ele
            aparece aqui, pronto para escolher o frete e pagar.
          </p>
        </div>
      ) : (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500">
            Último leilão
            {detalhe.leilao ? ` · ${dataLeilaoBR(detalhe.leilao.dataLeilao)}` : ""}
          </h2>
          <CobrancaArremate token={principal!.token!} a={detalhe} mostrarSaudacao={false} />
        </section>
      )}

      {outros.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500">Outros arremates</h2>
          <ul className="space-y-2">
            {outros.map((a) => {
              const s = SITUACAO_ARREMATE[a.situacao];
              return (
                <li key={a.id}>
                  <Link
                    href={a.token ? `/leilao/${a.token}` : "/minha-conta/pedidos"}
                    className="flex items-center gap-4 rounded-xl bg-white border border-black/5 p-4 shadow-sm hover:border-[#07366A] transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#07366A]">
                          {a.leilao?.nome ?? "Leilão"}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.badge}`}>
                          {s.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {a.leilao ? dataLeilaoBR(a.leilao.dataLeilao) : ""} · {a.numero}
                      </p>
                      <p className="text-sm text-gray-600 truncate">{a.lotes.join(", ")}</p>
                    </div>
                    <span className="font-semibold text-[#07366A] shrink-0">{formatBRL(a.total)}</span>
                    <ChevronRight size={18} className="text-gray-400 shrink-0" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">WhatsApp dos lances</h2>
        <VerificarWhatsapp
          verificados={telefones.verificados}
          pendentes={telefones.pendentes}
          explicacao="Os lotes ficam guardados no número que deu o lance. Confirme o seu número para eles aparecerem aqui."
        />
      </section>
    </div>
  );
}
