import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Gift, PlayCircle, Ticket, Trophy } from "lucide-react";
import { exigirSessao } from "@/lib/auth";
import { getMeusSorteios, getTelefonesDoUsuario, type MeuSorteio } from "@/lib/queries/sorteios";
import { solicitarVerificacao, vincularPeloCadastroDoUsuario } from "@/lib/sorteios/servico";
import { chaveTelefone } from "@/lib/sorteios/telefone";
import { prisma } from "@/lib/prisma";
import { formatarBilhete, formatarFaixa } from "@/lib/sorteios/bilhetes";
import { dataBR, dataHoraBR, STATUS_CLIENTE } from "@/lib/sorteios/formato";
import { VerificarWhatsapp } from "@/components/conta/sorteios/VerificarWhatsapp";
import { AvisoCreditos } from "@/components/conta/sorteios/AvisoCreditos";

export const metadata: Metadata = {
  title: "Meus Sorteios | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

/**
 * Quem informou o WhatsApp no cadastro não deveria ter que digitar de novo:
 * se o número ainda não está verificado nem tem código pendente, o código já
 * nasce pronto e a tela mostra o botão de mandar pelo WhatsApp. Acessório: se
 * falhar (limite diário, número já de outra conta), a página abre igual.
 */
async function codigoParaTelefoneDoCadastro(userId: string) {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { telefone: true } });
    const chave = u?.telefone ? chaveTelefone(u.telefone) : null;
    if (!chave) return;
    const [verificado, pendente] = await Promise.all([
      prisma.telefoneVerificado.findUnique({ where: { telefone: chave }, select: { id: true } }),
      prisma.verificacaoTelefone.findFirst({
        where: { userId, telefone: chave, status: "PENDENTE", expiraEm: { gt: new Date() } },
        select: { id: true },
      }),
    ]);
    if (verificado || pendente) return;
    await solicitarVerificacao(userId, chave);
  } catch {
    // segue sem código pronto; o cliente gera na mão
  }
}

// Só o que é do usuário logado: getMeusSorteios filtra por userId da sessão.
export default async function MeusSorteiosPage() {
  const user = await exigirSessao("/minha-conta/sorteios");
  // Cliente que a equipe já tinha cadastrado com este WhatsApp: os créditos
  // entram sem pedir verificação. Acessório: se falhar, a página abre igual.
  await vincularPeloCadastroDoUsuario(user.id).catch((e) => console.error("[sorteios] vínculo pelo cadastro", e));
  await codigoParaTelefoneDoCadastro(user.id);
  const [sorteios, telefones] = await Promise.all([getMeusSorteios(user.id), getTelefonesDoUsuario(user.id)]);
  const avisos = sorteios
    .filter((s) => s.avisoNovo && s.chances > 0)
    .map((s) => ({ participanteId: s.participanteId, chances: s.chances, sorteio: s.sorteio.nome.replace(/^Sorteio\s+/i, "sorteio do ") }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#07366A]">Meus Sorteios</h1>
        <p className="text-sm text-gray-500">Cada lance válido nos nossos leilões vira um bilhete no sorteio do evento.</p>
      </div>

      <AvisoCreditos avisos={avisos} />

      {sorteios.length === 0 ? (
        <div className="rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
          <Gift className="mx-auto mb-2 h-8 w-8 text-[#FAB82A]" aria-hidden="true" />
          <p className="font-semibold text-[#07366A]">Nenhuma chance ligada à sua conta ainda</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            Participou de um leilão pelo WhatsApp? Confirme abaixo o número que você usou nos lances e as chances aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {sorteios.map((s) => (
            <CartaoSorteio key={s.participanteId} s={s} />
          ))}
        </div>
      )}

      <VerificarWhatsapp verificados={telefones.verificados} pendentes={telefones.pendentes} />
    </div>
  );
}

function CartaoSorteio({ s }: { s: MeuSorteio }) {
  const z = s.sorteio;
  const bilhetes = s.faixa ? Array.from({ length: s.faixa.fim - s.faixa.inicio + 1 }, (_, i) => s.faixa!.inicio + i) : [];
  return (
    <article className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <div className="grid sm:grid-cols-[200px_1fr]">
        <div className="relative aspect-[16/10] bg-[#07366A] sm:aspect-auto">
          {z.imagemUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={z.imagemUrl} alt={z.premio} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <Gift className="absolute inset-0 m-auto h-12 w-12 text-white/40" aria-hidden="true" />
          )}
        </div>
        <div className="space-y-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#FF035C]">{z.nome}</p>
            <p className="text-sm text-gray-500">Prêmio: {z.premio}</p>
          </div>

          <p className="text-2xl font-bold uppercase leading-tight text-[#07366A]">
            Você tem {s.chances} {s.chances === 1 ? "chance" : "chances"}!
          </p>

          {s.venceu && (
            <p className="flex items-center gap-2 rounded-lg bg-green-50 p-3 font-semibold text-green-800">
              <Trophy className="h-5 w-5" aria-hidden="true" /> Seu bilhete {formatarBilhete(z.bilheteVencedor!, s.total)} foi sorteado! A gente vai falar com você pelo WhatsApp.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-gray-400">Seus bilhetes</dt>
              <dd className="font-mono font-semibold text-[#07366A]">{formatarFaixa(s.faixa, s.total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Total de bilhetes</dt>
              <dd className="font-semibold text-[#07366A]">{s.total}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Situação</dt>
              <dd className="font-semibold text-[#07366A]">{STATUS_CLIENTE[z.status]}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Evento</dt>
              <dd className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                {dataBR(z.dataEvento)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Data do sorteio</dt>
              <dd>{z.dataSorteio ? dataHoraBR(z.dataSorteio) : "a definir"}</dd>
            </div>
            {z.status === "REALIZADO" && (
              <div>
                <dt className="text-xs text-gray-400">Resultado</dt>
                <dd>
                  Bilhete {formatarBilhete(z.bilheteVencedor!, s.total)} · {z.vencedorPublico}
                </dd>
              </div>
            )}
          </dl>

          {s.provisoria && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              A apuração ainda está em conferência. A quantidade de chances e a numeração dos bilhetes são provisórias até a homologação.
            </p>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-[#07366A]">
              <Ticket className="mr-1 inline h-4 w-4" aria-hidden="true" />
              Ver bilhetes {s.lances.length > 0 && "e lances"}
            </summary>
            <div className="mt-3 space-y-3">
              <ul className="flex flex-wrap gap-1.5">
                {bilhetes.map((b) => (
                  <li key={b} className={`rounded-md px-2 py-1 font-mono text-xs ${z.bilheteVencedor === b ? "bg-green-600 text-white" : "bg-[#07366A]/5 text-[#07366A]"}`}>
                    {formatarBilhete(b, s.total)}
                  </li>
                ))}
              </ul>
              {s.lances.length > 0 && (
                <table className="w-full text-xs">
                  <thead className="text-left text-gray-400">
                    <tr>
                      <th className="py-1">Lote</th>
                      <th className="py-1">Lance</th>
                      <th className="py-1">Horário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {s.lances.map((l) => (
                      <tr key={l.id}>
                        <td className="py-1">{l.loteRotulo ?? l.loteId}</td>
                        <td className="py-1">
                          {l.valor != null ? l.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                          {l.tipo !== "NORMAL" && <span className="ml-1 text-gray-400">({l.tipo === "XEQUE_MATE" ? "Xeque-Mate" : "Mestre Criador"})</span>}
                        </td>
                        <td className="py-1">{l.horario ? dataHoraBR(l.horario) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            {z.transmissaoUrl && (
              <a href={z.transmissaoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#FF035C] px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
                <PlayCircle className="h-4 w-4" aria-hidden="true" /> Acompanhar a transmissão
              </a>
            )}
            {z.publico && (z.status === "HOMOLOGADO" || z.status === "REALIZADO") && (
              <Link href={`/sorteios/${z.slug}/roleta`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-[#07366A] hover:bg-gray-50">
                Ver a roleta
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
