"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Copy,
  CreditCard,
  Loader2,
  Pencil,
  Plane,
  QrCode,
  RefreshCw,
  Store,
  Truck,
} from "lucide-react";
import CardPaymentBrick from "@/components/checkout/CardPaymentBrick";
import ThreeDsChallenge from "@/components/checkout/ThreeDsChallenge";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { carregarDeviceMp } from "@/lib/mp-device";
import { relatarFalhaCartao } from "@/lib/falha-cartao";
import { formatBRL } from "@/lib/utils/format";
import { mascaraCep, mascaraDoc, mascaraTelefone } from "@/lib/mascaras";
import { whatsappLink, RETIRADA_INSTRUCOES_PADRAO } from "@/lib/constants";
import { finalizarDesafio3ds, type CartaoInput } from "@/actions/checkout";
import {
  arrematePago,
  cotarEntregaArremate,
  pagarArremateCartao,
  pagarArrematePix,
  salvarEntregaArremate,
  type CotacaoArremate,
} from "@/actions/leilao-pagamento";
import type { PixArremate } from "@/lib/queries/leiloes";

/**
 * Entrega + pagamento do arremate. Usado no link público (/leilao/[token]) e
 * na área do cliente (/minha-conta/leiloes) — mesmo componente, mesma regra.
 *
 * Passo 1, entrega: o cliente confirma os dados, escolhe terrestre, aéreo ou
 * retirada e o servidor grava o frete (re-cotado lá, nunca o daqui).
 * Passo 2, pagamento: Pix (QR na própria tela) ou cartão (Brick + 3DS), sobre o
 * total que o servidor gravou.
 */

export type DadosArremate = {
  numero: string;
  subtotal: number;
  frete: number;
  total: number;
  maxParcelas: number;
  qtdPeixes: number;
  maxPeixesPorCaixa: number;
  entrega: {
    tipo: "ENVIO" | "RETIRADA";
    modalidade: "TERRESTRE" | "AEREO" | null;
    cidade: string | null;
    uf: string | null;
  } | null;
  pagador: {
    nome: string;
    email: string;
    telefone: string;
    cpfCnpj: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  retirada: { ativa: boolean; instrucoes: string | null };
  pixPendente: PixArremate | null;
};

const input =
  "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#07366A] focus:ring-1 focus:ring-[#07366A]";

function Campo({
  label,
  erro,
  children,
  className = "",
}: {
  label: string;
  erro?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
      {erro && <span className="block text-xs text-red-600 mt-1">{erro}</span>}
    </label>
  );
}

export default function PagamentoArremate({
  token,
  dados,
  mpPublicKey,
}: {
  token: string;
  dados: DadosArremate;
  mpPublicKey: string | null;
}) {
  const router = useRouter();
  const [atualizando, startRefresh] = useTransition();
  const [etapa, setEtapa] = useState<"entrega" | "pagamento">(
    dados.entrega ? "pagamento" : "entrega",
  );
  const atualizar = useCallback(() => startRefresh(() => router.refresh()), [router]);

  return (
    <div className="space-y-5">
      <ol className="flex items-center gap-2 text-xs font-medium">
        {(["entrega", "pagamento"] as const).map((e, i) => (
          <li
            key={e}
            className={`flex items-center gap-1.5 ${etapa === e ? "text-[#07366A]" : "text-gray-400"}`}
          >
            <span
              className={`grid place-items-center w-5 h-5 rounded-full text-[11px] ${
                etapa === e ? "bg-[#07366A] text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              {i + 1}
            </span>
            {e === "entrega" ? "Entrega" : "Pagamento"}
            {i === 0 && <span className="text-gray-300 mx-1">›</span>}
          </li>
        ))}
      </ol>

      {etapa === "entrega" ? (
        <EtapaEntrega
          token={token}
          dados={dados}
          onSalvo={() => {
            setEtapa("pagamento");
            atualizar();
          }}
        />
      ) : atualizando || !dados.entrega ? (
        <p className="flex items-center justify-center gap-2 text-sm text-gray-500 py-8">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Atualizando o total…
        </p>
      ) : (
        <EtapaPagamento
          token={token}
          dados={dados}
          mpPublicKey={mpPublicKey}
          onAlterarEntrega={() => setEtapa("entrega")}
          onPago={atualizar}
        />
      )}
    </div>
  );
}

// ── Passo 1: entrega ─────────────────────────────────────────────────────────

function EtapaEntrega({
  token,
  dados,
  onSalvo,
}: {
  token: string;
  dados: DadosArremate;
  onSalvo: () => void;
}) {
  const p = dados.pagador;
  const [campos, setCampos] = useState({
    nome: p.nome,
    email: p.email,
    telefone: mascaraTelefone(p.telefone.replace(/^55(?=\d{10,11}$)/, "")),
    cpfCnpj: mascaraDoc(p.cpfCnpj),
    cep: mascaraCep(p.cep),
    logradouro: p.logradouro,
    numero: p.numero,
    complemento: p.complemento,
    bairro: p.bairro,
    cidade: p.cidade,
    uf: p.uf,
  });
  const [tipo, setTipo] = useState<"ENVIO" | "RETIRADA">(dados.entrega?.tipo ?? "ENVIO");
  const [modalidade, setModalidade] = useState<"TERRESTRE" | "AEREO">(
    dados.entrega?.modalidade ?? "TERRESTRE",
  );
  const [cotacao, setCotacao] = useState<CotacaoArremate | null>(null);
  const [cotando, setCotando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const [erro, setErro] = useState<string | null>(null);
  const cepCotado = useRef<string>("");

  const set = (k: keyof typeof campos, v: string) =>
    setCampos((c) => ({ ...c, [k]: v }));

  const cotar = useCallback(
    async (cep: string, trocouCep: boolean) => {
      setCotando(true);
      setErro(null);
      try {
        const r = await cotarEntregaArremate(token, cep);
        setCotacao(r);
        cepCotado.current = cep;
        if (!r.ok) return;
        const e = r.endereco;
        // CEP novo reescreve rua/bairro/cidade; o mesmo CEP só completa o vazio.
        if (e) {
          setCampos((c) => ({
            ...c,
            logradouro: trocouCep || !c.logradouro ? (e.rua ?? c.logradouro) : c.logradouro,
            bairro: trocouCep || !c.bairro ? (e.bairro ?? c.bairro) : c.bairro,
            cidade: trocouCep || !c.cidade ? (e.cidade ?? c.cidade) : c.cidade,
            uf: trocouCep || !c.uf ? (e.uf ?? c.uf) : c.uf,
          }));
        }
        setModalidade((m) => {
          const atual = m === "AEREO" ? r.aereo : r.terrestre;
          if (atual.disponivel) return m;
          if (r.terrestre.disponivel) return "TERRESTRE";
          if (r.aereo.disponivel) return "AEREO";
          return m;
        });
      } catch {
        setCotacao({ ok: false, error: "Não consegui calcular o frete agora. Tente de novo." });
      } finally {
        setCotando(false);
      }
    },
    [token],
  );

  // Endereço já conhecido: o frete aparece sem o cliente precisar mexer no CEP.
  useEffect(() => {
    const cep = campos.cep.replace(/\D/g, "");
    if (tipo === "ENVIO" && cep.length === 8 && !cepCotado.current) {
      void cotar(cep, false);
    }
    // só na abertura e quando muda para envio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  function mudarCep(v: string) {
    const m = mascaraCep(v);
    set("cep", m);
    const cep = m.replace(/\D/g, "");
    if (cep.length === 8 && cep !== cepCotado.current) void cotar(cep, true);
    if (cep.length < 8) setCotacao(null);
  }

  const retirada = tipo === "RETIRADA";
  const cot = cotacao?.ok ? cotacao : null;
  const opcao = cot ? (modalidade === "AEREO" ? cot.aereo : cot.terrestre) : null;
  const freteAtual = retirada ? 0 : opcao?.disponivel ? opcao.preco : null;
  const podeSalvar =
    !salvando && (retirada || (!!cot && !cot.acimaDoLimite && !!opcao?.disponivel));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    setErros({});
    try {
      const r = await salvarEntregaArremate(token, {
        ...campos,
        tipoEntrega: tipo,
        modalidadeFrete: modalidade,
      });
      if (r.ok) {
        onSalvo();
        return;
      }
      setErros(r.fieldErrors ?? {});
      setErro(r.error);
    } catch {
      setErro("A conexão caiu. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const e1 = (k: string) => erros[k]?.[0];

  return (
    <form onSubmit={salvar} className="space-y-5" noValidate>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[#07366A] mb-1">Seus dados</legend>
        <Campo label="Nome completo" erro={e1("nome")}>
          <input className={input} value={campos.nome} onChange={(e) => set("nome", e.target.value)} autoComplete="name" />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="E-mail" erro={e1("email")}>
            <input className={input} type="email" value={campos.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
          </Campo>
          <Campo label="WhatsApp" erro={e1("telefone")}>
            <input
              className={input}
              inputMode="tel"
              value={campos.telefone}
              onChange={(e) => set("telefone", mascaraTelefone(e.target.value))}
              autoComplete="tel"
            />
          </Campo>
        </div>
        <Campo label="CPF ou CNPJ" erro={e1("cpfCnpj")}>
          <input
            className={input}
            inputMode="numeric"
            value={campos.cpfCnpj}
            onChange={(e) => set("cpfCnpj", mascaraDoc(e.target.value))}
          />
        </Campo>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[#07366A] mb-1">Como você quer receber</legend>

        {dados.retirada.ativa && (
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { v: "ENVIO", label: "Receber pelo correio", Icon: Truck },
                { v: "RETIRADA", label: "Retirar em Guarapari/ES", Icon: Store },
              ] as const
            ).map(({ v, label, Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => setTipo(v)}
                className={`flex items-center gap-2 rounded-lg border p-3 text-sm text-left transition-colors ${
                  tipo === v
                    ? "border-[#07366A] bg-[#07366A]/5 text-[#07366A] font-medium"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        )}

        {retirada ? (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">
            {dados.retirada.instrucoes?.trim() || RETIRADA_INSTRUCOES_PADRAO}
          </p>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-[minmax(0,1fr)_auto] items-end">
              <Campo label="CEP" erro={e1("cep")}>
                <input
                  className={input}
                  inputMode="numeric"
                  value={campos.cep}
                  onChange={(e) => mudarCep(e.target.value)}
                  autoComplete="postal-code"
                  placeholder="00000-000"
                />
              </Campo>
              {cotando && (
                <Loader2 className="w-5 h-5 animate-spin text-gray-400 mb-2.5" aria-label="Calculando frete" />
              )}
            </div>

            {cotacao && !cotacao.ok && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{cotacao.error}</p>
            )}

            {cot && (
              <>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                  <Campo label="Rua" erro={e1("logradouro")}>
                    <input className={input} value={campos.logradouro} onChange={(e) => set("logradouro", e.target.value)} autoComplete="address-line1" />
                  </Campo>
                  <Campo label="Número" erro={e1("numero")}>
                    <input className={input} value={campos.numero} onChange={(e) => set("numero", e.target.value)} />
                  </Campo>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo label="Complemento (opcional)">
                    <input className={input} value={campos.complemento} onChange={(e) => set("complemento", e.target.value)} autoComplete="address-line2" />
                  </Campo>
                  <Campo label="Bairro" erro={e1("bairro")}>
                    <input className={input} value={campos.bairro} onChange={(e) => set("bairro", e.target.value)} />
                  </Campo>
                </div>
                <div className="grid gap-3 grid-cols-[minmax(0,1fr)_5rem]">
                  <Campo label="Cidade" erro={e1("cidade")}>
                    <input className={input} value={campos.cidade} onChange={(e) => set("cidade", e.target.value)} />
                  </Campo>
                  <Campo label="UF" erro={e1("uf")}>
                    <input
                      className={input}
                      maxLength={2}
                      value={campos.uf}
                      onChange={(e) => set("uf", e.target.value.toUpperCase())}
                    />
                  </Campo>
                </div>

                {cot.acimaDoLimite ? (
                  <AvisoWhatsapp
                    texto={`São ${dados.qtdPeixes} peixes, mais do que cabe numa caixa (${dados.maxPeixesPorCaixa}). O frete desse envio eu combino com você pelo WhatsApp.`}
                    mensagem={`Oi! Arrematei ${dados.qtdPeixes} peixes no leilão (pedido ${dados.numero}) e quero combinar o frete.`}
                  />
                ) : (
                  <div className="space-y-2" role="radiogroup" aria-label="Frete">
                    <OpcaoFrete
                      ativo={modalidade === "TERRESTRE"}
                      onEscolher={() => setModalidade("TERRESTRE")}
                      Icon={Truck}
                      titulo="JADLOG (terrestre)"
                      opcao={cot.terrestre}
                      detalhe="entrega no seu endereço"
                    />
                    <OpcaoFrete
                      ativo={modalidade === "AEREO"}
                      onEscolher={() => setModalidade("AEREO")}
                      Icon={Plane}
                      titulo="Gollog (aéreo)"
                      opcao={cot.aereo}
                      detalhe=""
                    />
                    {!cot.terrestre.disponivel && !cot.aereo.disponivel && (
                      <AvisoWhatsapp
                        texto="Para esse CEP o frete precisa ser combinado."
                        mensagem={`Oi! Quero combinar o frete do meu arremate (pedido ${dados.numero}), CEP ${campos.cep}.`}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </fieldset>

      <Resumo subtotal={dados.subtotal} frete={freteAtual} />

      {erro && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2.5">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={!podeSalvar}
        className="w-full inline-flex items-center justify-center gap-2 bg-[#FF035C] text-white font-semibold py-3.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
      >
        {salvando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        {salvando ? "Salvando…" : "Continuar para o pagamento"}
      </button>
      {!retirada && !cot && (
        <p className="text-xs text-gray-500 text-center -mt-2">Digite o CEP para ver o frete.</p>
      )}
    </form>
  );
}

function OpcaoFrete({
  ativo,
  onEscolher,
  Icon,
  titulo,
  opcao,
  detalhe,
}: {
  ativo: boolean;
  onEscolher: () => void;
  Icon: typeof Truck;
  titulo: string;
  opcao: Extract<CotacaoArremate, { ok: true }>["terrestre"];
  detalhe: string;
}) {
  const ok = opcao.disponivel;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      aria-label={ok ? `${titulo}, ${formatBRL(opcao.preco)}` : `${titulo}, indisponível`}
      disabled={!ok}
      onClick={onEscolher}
      className={`w-full flex items-center gap-3 rounded-lg border p-3 text-sm text-left transition-colors ${
        ativo && ok ? "border-[#07366A] bg-[#07366A]/5" : "border-gray-200 hover:border-gray-300"
      } ${ok ? "" : "opacity-60 cursor-not-allowed"}`}
    >
      <span
        className={`w-4 h-4 rounded-full border-2 shrink-0 ${
          ativo && ok ? "border-[#07366A] bg-[#07366A] shadow-[inset_0_0_0_2px_white]" : "border-gray-300"
        }`}
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 font-medium text-[#07366A]">
          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
          {titulo}
        </span>
        <span className="block text-xs text-gray-500">
          {ok ? [detalhe, opcao.prazo].filter(Boolean).join(" · ") : opcao.motivo}
        </span>
      </span>
      {ok && <span className="font-bold text-[#07366A] shrink-0">{formatBRL(opcao.preco)}</span>}
    </button>
  );
}

function AvisoWhatsapp({ texto, mensagem }: { texto: string; mensagem: string }) {
  return (
    <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
      <p className="flex items-start gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        {texto}
      </p>
      <a
        href={whatsappLink(mensagem)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-semibold underline"
      >
        <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
        Combinar pelo WhatsApp
      </a>
    </div>
  );
}

function Resumo({ subtotal, frete }: { subtotal: number; frete: number | null }) {
  return (
    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
      <div className="flex justify-between px-4 py-2.5">
        <span className="text-gray-600">{subtotal > 0 ? "Lotes" : "Prêmio"}</span>
        <span className="text-gray-800">{subtotal > 0 ? formatBRL(subtotal) : "grátis"}</span>
      </div>
      <div className="flex justify-between px-4 py-2.5">
        <span className="text-gray-600">Frete</span>
        <span className="text-gray-800">
          {frete == null ? "a calcular" : frete === 0 ? "Sem frete" : formatBRL(frete)}
        </span>
      </div>
      <div className="flex justify-between items-center px-4 py-3">
        <span className="font-medium text-gray-700">Total</span>
        <span className="text-lg font-bold text-[#07366A]">
          {formatBRL(subtotal + (frete ?? 0))}
        </span>
      </div>
    </div>
  );
}

// ── Passo 2: pagamento ───────────────────────────────────────────────────────

function rotuloEntrega(e: NonNullable<DadosArremate["entrega"]>): string {
  if (e.tipo === "RETIRADA") return "Retirada em Guarapari/ES";
  const destino = e.cidade ? ` para ${e.cidade}/${e.uf ?? ""}` : "";
  return e.modalidade === "AEREO" ? `Aéreo (Gollog)${destino}` : `Terrestre (Jadlog)${destino}`;
}

function EtapaPagamento({
  token,
  dados,
  mpPublicKey,
  onAlterarEntrega,
  onPago,
}: {
  token: string;
  dados: DadosArremate;
  mpPublicKey: string | null;
  onAlterarEntrega: () => void;
  onPago: () => void;
}) {
  const [aba, setAba] = useState<"pix" | "cartao">("pix");
  const [erro, setErro] = useState<string | null>(null);
  const [recusa, setRecusa] = useState<string | null>(null);
  const [desafio, setDesafio] = useState<{
    paymentId: string;
    externalResourceUrl: string;
    creq: string;
  } | null>(null);
  const entrega = dados.entrega!;

  // Fingerprint do antifraude começa a coletar na abertura, não no clique.
  useEffect(() => {
    carregarDeviceMp("checkout");
  }, []);

  async function onCartao(cartao: CartaoInput) {
    setErro(null);
    setRecusa(null);
    let res;
    try {
      res = await pagarArremateCartao(token, cartao);
    } catch (e) {
      relatarFalhaCartao({
        etapa: "COBRANCA",
        mensagem: `chamada do leilão falhou: ${e instanceof Error ? e.message : String(e)}`,
        valor: dados.total,
        parcelas: cartao.installments,
        fluxo: "leilao",
      });
      setErro("A conexão caiu antes de concluir. Tente de novo ou pague no Pix.");
      throw e;
    }
    if (res.resultado === "aprovado" || res.resultado === "analise") {
      onPago();
      return;
    }
    if (res.resultado === "desafio") {
      setDesafio({
        paymentId: res.paymentId,
        externalResourceUrl: res.externalResourceUrl,
        creq: res.creq,
      });
      return;
    }
    if (res.resultado === "recusado") {
      setRecusa(res.mensagem);
      throw new Error(res.mensagem); // o Brick reabilita o formulário
    }
    setErro(res.mensagem);
    throw new Error(res.mensagem);
  }

  async function onFim3ds(paymentId: string) {
    const res = await finalizarDesafio3ds(paymentId);
    setDesafio(null);
    if (res.resultado === "aprovado" || res.resultado === "analise") {
      onPago();
      return;
    }
    if (res.resultado === "recusado") setRecusa(res.mensagem);
    else setErro(res.resultado === "erro" ? res.mensagem : "Não deu para confirmar. Tente de novo.");
  }

  const abaCls = (ativa: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-all ${
      ativa ? "bg-white text-[#07366A] shadow-sm" : "text-gray-500 hover:text-[#07366A]"
    }`;

  return (
    <div className="space-y-4">
      {desafio && (
        <ThreeDsChallenge
          externalResourceUrl={desafio.externalResourceUrl}
          creq={desafio.creq}
          onConcluido={() => onFim3ds(desafio.paymentId)}
        />
      )}

      <div className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Entrega</p>
          <p className="font-medium text-[#07366A]">{rotuloEntrega(entrega)}</p>
        </div>
        <button
          type="button"
          onClick={onAlterarEntrega}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#FF035C] hover:underline shrink-0"
        >
          <Pencil className="w-3 h-3" aria-hidden="true" />
          Alterar
        </button>
      </div>

      <Resumo subtotal={dados.subtotal} frete={dados.frete} />

      <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg">
        <button type="button" onClick={() => setAba("pix")} className={abaCls(aba === "pix")}>
          <QrCode size={15} aria-hidden="true" />
          Pix
        </button>
        <button type="button" onClick={() => setAba("cartao")} className={abaCls(aba === "cartao")}>
          <CreditCard size={15} aria-hidden="true" />
          Cartão
        </button>
      </div>

      {aba === "pix" ? (
        <AreaPix token={token} total={dados.total} inicial={dados.pixPendente} onPago={onPago} />
      ) : mpPublicKey ? (
        <div>
          <p className="text-[11px] text-gray-500 text-center mb-2">
            Em até {dados.maxParcelas}x no cartão.
          </p>
          <CardPaymentBrick
            publicKey={mpPublicKey}
            amount={dados.total}
            maxInstallments={dados.maxParcelas}
            payerEmail={dados.pagador.email || undefined}
            onPagar={onCartao}
            onErro={(m) => setErro(m)}
            fluxo="leilao"
          />
        </div>
      ) : (
        <p className="text-xs text-amber-700">Cartão indisponível no momento. Use o Pix.</p>
      )}

      {recusa && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
          {recusa}
        </p>
      )}
      {erro && (
        <p role="alert" className="text-sm text-[#FF035C] text-center">
          {erro}
        </p>
      )}
    </div>
  );
}

const POLL_MS = 4500;

function segundosAte(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function relogio(seg: number): string {
  if (seg >= 3600) {
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  }
  return `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
}

function AreaPix({
  token,
  total,
  inicial,
  onPago,
}: {
  token: string;
  total: number;
  inicial: PixArremate | null;
  onPago: () => void;
}) {
  const [pix, setPix] = useState<PixArremate | null>(inicial);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [restante, setRestante] = useState(() => segundosAte(inicial?.expiraEm ?? null));
  const avisado = useRef(false);

  const valido = !!pix && Math.abs(pix.valor - total) < 0.01;
  const expirado = valido && !!pix?.expiraEm && restante <= 0;

  useEffect(() => {
    if (!pix?.expiraEm) return;
    const id = setInterval(() => setRestante(segundosAte(pix.expiraEm)), 1000);
    return () => clearInterval(id);
  }, [pix?.expiraEm]);

  // Confirmação vem do webhook; aqui só olhamos o banco de tempos em tempos.
  useEffect(() => {
    if (!valido || expirado) return;
    let vivo = true;
    const id = setInterval(async () => {
      try {
        if (vivo && !avisado.current && (await arrematePago(token))) {
          avisado.current = true;
          onPago();
        }
      } catch {
        // rede instável: tenta no próximo ciclo
      }
    }, POLL_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [valido, expirado, token, onPago]);

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const r = await pagarArrematePix(token);
      if (r.ok) {
        setPix(r.pix);
        setRestante(segundosAte(r.pix.expiraEm));
      } else {
        setErro(r.error);
      }
    } catch {
      setErro("Não consegui gerar o Pix agora. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    if (!pix?.copiaECola) return;
    try {
      await navigator.clipboard.writeText(pix.copiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não deu para copiar. Selecione o código e copie na mão.");
    }
  }

  if (!valido || expirado) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={gerar}
          disabled={gerando}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#FF035C] text-white font-semibold py-3.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-60"
        >
          {gerando ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : expirado ? (
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          ) : (
            <QrCode className="w-4 h-4" aria-hidden="true" />
          )}
          {gerando ? "Gerando Pix…" : expirado ? "Gerar novo Pix" : `Gerar Pix de ${formatBRL(total)}`}
        </button>
        <p className="text-xs text-gray-500 text-center">
          {expirado ? "O Pix anterior venceu." : "O QR aparece aqui mesmo e a confirmação é automática."}
        </p>
        {erro && (
          <p role="alert" className="text-xs text-red-700 bg-red-50 rounded-md p-2">
            {erro}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-center">
      {pix.qrCodeBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/png;base64,${pix.qrCodeBase64}`}
          alt="QR Code do Pix"
          width={224}
          height={224}
          className="mx-auto w-56 h-56 rounded-lg border border-gray-200 bg-white"
        />
      ) : (
        <p className="text-sm text-amber-700">O QR não carregou. Use o código abaixo.</p>
      )}
      {pix.copiaECola && (
        <div className="space-y-2 text-left">
          <span className="block text-xs font-medium text-gray-600">Pix copia e cola</span>
          <code className="block break-all rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-700 max-h-24 overflow-y-auto">
            {pix.copiaECola}
          </code>
          <button
            type="button"
            onClick={copiar}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-[#07366A] hover:border-[#07366A]"
          >
            {copiado ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            {copiado ? "Código copiado" : "Copiar código"}
          </button>
        </div>
      )}
      <p className="flex items-center justify-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin text-[#07366A]" aria-hidden="true" />
        Aguardando o pagamento
        {pix.expiraEm && <span className="tabular-nums">· vence em {relogio(restante)}</span>}
      </p>
      <p className="text-xs text-gray-500">
        Pague no app do banco lendo o QR ou colando o código. Pode deixar esta página aberta: ela
        avisa quando o pagamento cair.
      </p>
      {erro && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 rounded-md p-2">
          {erro}
        </p>
      )}
    </div>
  );
}
