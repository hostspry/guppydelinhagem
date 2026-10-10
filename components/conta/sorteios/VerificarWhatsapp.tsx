"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { solicitarVerificacaoAction } from "@/actions/sorteios-cliente";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { formatarTelefone } from "@/lib/sorteios/telefone";

const PAISES = [
  { ddi: "55", nome: "Brasil (+55)", exemplo: "21 99999-9999" },
  { ddi: "52", nome: "México (+52)", exemplo: "844 599 1131" },
  { ddi: "", nome: "Outro país", exemplo: "+DDI e número" },
];

function linkCodigo(codigo: string) {
  const msg = `Olá! Meu código de verificação do Guppy de Linhagem é ${codigo}`;
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
}

/**
 * Prova de que o WhatsApp é seu: você recebe um código e manda DO SEU
 * WhatsApp para o da loja. Só quem tem o celular consegue mandar daquele
 * número, então ninguém pega as chances de outra pessoa digitando o número dela.
 */
export function VerificarWhatsapp({
  verificados,
  pendentes,
}: {
  verificados: { telefone: string }[];
  pendentes: { id: string; telefone: string; codigo: string | null }[];
}) {
  const router = useRouter();
  const [pais, setPais] = useState(PAISES[0]);
  const [numero, setNumero] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState<{ telefone: string; codigo: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(verificados.length === 0 && pendentes.length === 0);

  function pedir() {
    setErro(null);
    const completo = pais.ddi ? `+${pais.ddi} ${numero}` : numero;
    iniciar(async () => {
      const r = await solicitarVerificacaoAction(completo);
      if (!r.ok) return setErro(r.erro);
      setNovo({ telefone: r.telefone, codigo: r.codigo });
      setNumero("");
      setAberto(false);
      router.refresh();
    });
  }

  const aguardando = pendentes.filter((p) => p.codigo && p.telefone !== novo?.telefone);

  return (
    <div className="space-y-4 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[#07366A]">
          <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
          Seus WhatsApp
        </h2>
        <p className="text-sm text-gray-500">As chances do leilão ficam guardadas no número que deu o lance. Confirme o seu número para elas aparecerem aqui.</p>
      </div>

      {verificados.length > 0 && (
        <ul className="space-y-1.5">
          {verificados.map((v) => (
            <li key={v.telefone} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
              <span className="font-mono">{formatarTelefone(v.telefone)}</span>
              <span className="text-xs text-green-700">verificado</span>
            </li>
          ))}
        </ul>
      )}

      {[...(novo ? [{ id: "novo", ...novo }] : []), ...aguardando].map((p) => (
        <div key={p.id} className="space-y-3 rounded-xl border border-[#FAB82A]/60 bg-[#FAB82A]/10 p-4">
          <p className="text-sm text-[#302F2F]">
            Para confirmar <strong className="font-mono">{formatarTelefone(p.telefone)}</strong>, mande este código <strong>a partir desse número</strong> para o WhatsApp da loja:
          </p>
          <p className="select-all text-center font-mono text-3xl font-bold tracking-widest text-[#07366A]">{p.codigo}</p>
          <a
            href={linkCodigo(p.codigo!)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-105"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Enviar código pelo WhatsApp
          </a>
          <p className="text-xs text-gray-500">
            A gente confere que a mensagem chegou do seu número e libera as chances. Costuma levar pouco tempo em horário comercial. O código vale 7 dias.
          </p>
        </div>
      ))}

      {aberto ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
            <select
              aria-label="País"
              className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm"
              value={pais.nome}
              onChange={(e) => setPais(PAISES.find((p) => p.nome === e.target.value)!)}
            >
              {PAISES.map((p) => (
                <option key={p.nome}>{p.nome}</option>
              ))}
            </select>
            <input
              inputMode="tel"
              autoComplete="tel-national"
              aria-label="Número do WhatsApp"
              placeholder={pais.exemplo}
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
            />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button
            type="button"
            onClick={pedir}
            disabled={pendente || numero.replace(/\D/g, "").length < 8}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#07366A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0E4C8F] disabled:opacity-50"
          >
            {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
            Gerar código
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAberto(true)} className="text-sm font-semibold text-[#FF035C] hover:underline">
          {verificados.length
            ? "+ Adicionar outro WhatsApp"
            : novo || aguardando.length
              ? "Usei outro número no leilão"
              : "Confirmar meu WhatsApp"}
        </button>
      )}
    </div>
  );
}
