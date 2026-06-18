"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Loader2,
  MapPin,
  ShoppingCart,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { formatBRL } from "@/lib/utils/format";
import { whatsappLink, MAX_PEIXES_POR_CAIXA } from "@/lib/constants";
import {
  useCart,
  selectTotalPeixes,
  selectSubtotalPix,
} from "@/lib/stores/cart";
import {
  criarPedidoCheckout,
  type CheckoutPixData,
} from "@/actions/checkout";
import PixPanel from "@/components/checkout/PixPanel";

export type CheckoutPrefill = {
  nome: string;
  telefone: string;
  email: string;
  cpfCnpj: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

type JadlogOpt = {
  id: number;
  name: string;
  price: number;
  deliveryTime: number;
  requerAvaliacao: boolean;
};
type FreteResponse = {
  endereco: {
    rua: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
  } | null;
  jadlog: JadlogOpt[];
  gollog: { min: number; max: number };
};

function formatCep(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
function formatTel(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function formatCpf(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

const inputCls =
  "w-full min-h-11 px-3 rounded-lg border border-border bg-white text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all";
const labelCls = "block text-xs font-medium text-primary mb-1";

export default function CheckoutClient({
  prefill,
}: {
  prefill: CheckoutPrefill;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const items = useCart((s) => s.items);
  const totalPeixes = useCart(selectTotalPeixes);
  const subtotalPix = useCart(selectSubtotalPix);

  const [form, setForm] = useState<CheckoutPrefill>(prefill);
  const set = (k: keyof CheckoutPrefill, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Frete
  const [freteLoading, setFreteLoading] = useState(false);
  const [freteErro, setFreteErro] = useState<string | null>(null);
  const [frete, setFrete] = useState<FreteResponse | null>(null);

  // Submit / Pix
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [pix, setPix] = useState<CheckoutPixData | null>(null);

  const cepDigits = form.cep.replace(/\D/g, "");
  const cepValido = /^\d{8}$/.test(cepDigits);
  const excedeCaixa = totalPeixes > MAX_PEIXES_POR_CAIXA;

  // Opção de frete cobrável = Jadlog .Com (id 4). Gollog é faixa/manual.
  const freteSel = useMemo(
    () => frete?.jadlog.find((j) => j.id === 4) ?? frete?.jadlog[0] ?? null,
    [frete],
  );
  const freteValor = freteSel?.price ?? null;
  const total = subtotalPix + (freteValor ?? 0);

  async function calcularFrete() {
    if (!cepValido || freteLoading) return;
    setFreteLoading(true);
    setFreteErro(null);
    try {
      const res = await fetch("/api/frete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cepDestino: cepDigits, qtd: totalPeixes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFrete(null);
        setFreteErro(data?.error ?? "Não foi possível calcular o frete.");
      } else {
        setFrete(data as FreteResponse);
        // Autofill do endereço a partir do ViaCEP (preenche o que estiver vazio).
        const e = (data as FreteResponse).endereco;
        if (e) {
          setForm((f) => ({
            ...f,
            logradouro: f.logradouro || e.rua || "",
            bairro: f.bairro || e.bairro || "",
            cidade: f.cidade || e.cidade || "",
            uf: f.uf || e.uf || "",
          }));
        }
      }
    } catch {
      setFrete(null);
      setFreteErro("Falha de rede ao calcular o frete.");
    } finally {
      setFreteLoading(false);
    }
  }

  const camposOk =
    form.nome.trim().length >= 2 &&
    form.email.includes("@") &&
    form.telefone.replace(/\D/g, "").length >= 10 &&
    form.cpfCnpj.replace(/\D/g, "").length >= 11 &&
    cepValido &&
    form.logradouro.trim() &&
    form.numero.trim() &&
    form.bairro.trim() &&
    form.cidade.trim() &&
    form.uf.trim().length === 2;

  const podePagar =
    !!camposOk && !!freteValor && !excedeCaixa && !pending && items.length > 0;

  function pagar() {
    setErro(null);
    startTransition(async () => {
      const res = await criarPedidoCheckout({
        nome: form.nome,
        telefone: form.telefone,
        email: form.email,
        cpfCnpj: form.cpfCnpj,
        cep: form.cep,
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        transportadora: "JADLOG",
        itens: items.map((i) => ({
          produtoId: i.produtoId,
          composicao: i.composicao,
          quantidade: i.quantidade,
        })),
      });
      if (res.ok) {
        setPix(res.data);
      } else {
        setErro(res.error);
      }
    });
  }

  // ── Hidratação / carrinho vazio ──
  if (!mounted) {
    return (
      <div className="container-site py-20">
        <p className="text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (!pix && items.length === 0) {
    return (
      <div className="container-site py-20 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <ShoppingCart className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="text-primary text-2xl font-semibold">
          Seu carrinho está vazio
        </h1>
        <Link
          href="/"
          className="bg-secondary text-white text-sm font-semibold px-6 py-2.5 rounded-pill hover:brightness-110 transition-all"
        >
          Ver produtos
        </Link>
      </div>
    );
  }

  // ── Pix gerado: tela do QR + copia-e-cola + contagem + poll de status ──
  if (pix) {
    return <PixPanel pix={pix} />;
  }

  // ── Formulário de checkout ──
  return (
    <div className="container-site py-12">
      <h1 className="text-primary text-2xl font-semibold mb-6">
        Finalizar pedido
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Coluna principal: dados + entrega + frete */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identificação */}
          <section className="bg-white border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-primary font-semibold">Seus dados</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="nome">
                  Nome completo
                </label>
                <input
                  id="nome"
                  className={inputCls}
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="telefone">
                  Telefone / WhatsApp
                </label>
                <input
                  id="telefone"
                  inputMode="numeric"
                  className={inputCls}
                  value={form.telefone}
                  onChange={(e) => set("telefone", formatTel(e.target.value))}
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="cpf">
                  CPF / CNPJ
                </label>
                <input
                  id="cpf"
                  inputMode="numeric"
                  className={inputCls}
                  value={form.cpfCnpj}
                  onChange={(e) => set("cpfCnpj", formatCpf(e.target.value))}
                />
              </div>
            </div>
          </section>

          {/* Entrega */}
          <section className="bg-white border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-primary font-semibold">Endereço de entrega</h2>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="cep">
                  CEP
                </label>
                <div className="flex gap-2">
                  <input
                    id="cep"
                    inputMode="numeric"
                    className={inputCls}
                    value={form.cep}
                    onChange={(e) => {
                      set("cep", formatCep(e.target.value));
                      setFrete(null);
                    }}
                    autoComplete="postal-code"
                    maxLength={9}
                  />
                  <button
                    type="button"
                    onClick={calcularFrete}
                    disabled={!cepValido || freteLoading}
                    className="inline-flex items-center justify-center min-h-11 px-3 rounded-lg border border-border text-primary font-medium text-sm hover:border-primary disabled:opacity-50 transition-all whitespace-nowrap"
                  >
                    {freteLoading ? (
                      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    ) : (
                      "Calcular"
                    )}
                  </button>
                </div>
              </div>
              <div className="sm:col-span-3">
                <label className={labelCls} htmlFor="logradouro">
                  Endereço
                </label>
                <input
                  id="logradouro"
                  className={inputCls}
                  value={form.logradouro}
                  onChange={(e) => set("logradouro", e.target.value)}
                  autoComplete="address-line1"
                />
              </div>
              <div className="sm:col-span-1">
                <label className={labelCls} htmlFor="numero">
                  Número
                </label>
                <input
                  id="numero"
                  className={inputCls}
                  value={form.numero}
                  onChange={(e) => set("numero", e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <label className={labelCls} htmlFor="bairro">
                  Bairro
                </label>
                <input
                  id="bairro"
                  className={inputCls}
                  value={form.bairro}
                  onChange={(e) => set("bairro", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="complemento">
                  Complemento
                </label>
                <input
                  id="complemento"
                  className={inputCls}
                  value={form.complemento}
                  onChange={(e) => set("complemento", e.target.value)}
                  placeholder="opcional"
                />
              </div>
              <div className="sm:col-span-1">
                <label className={labelCls} htmlFor="uf">
                  UF
                </label>
                <input
                  id="uf"
                  className={inputCls}
                  value={form.uf}
                  onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))}
                  maxLength={2}
                />
              </div>
              <div className="sm:col-span-3">
                <label className={labelCls} htmlFor="cidade">
                  Cidade
                </label>
                <input
                  id="cidade"
                  className={inputCls}
                  value={form.cidade}
                  onChange={(e) => set("cidade", e.target.value)}
                />
              </div>
            </div>

            {/* Frete */}
            <div aria-live="polite" className="space-y-2 empty:hidden">
              {freteErro && (
                <p role="alert" className="text-xs text-red-700">
                  {freteErro}
                </p>
              )}
              {excedeCaixa && (
                <div className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3 leading-snug space-y-1">
                  <p className="font-medium">
                    Mais de {MAX_PEIXES_POR_CAIXA} peixes neste pedido.
                  </p>
                  <p>
                    O frete acima desse limite é calculado manualmente. Finalize
                    no WhatsApp para combinarmos o envio.
                  </p>
                  <a
                    href={whatsappLink(
                      `Olá! Tenho um pedido com ${totalPeixes} peixes e gostaria de combinar o frete.`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold underline hover:text-amber-900"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                    Fechar no WhatsApp
                  </a>
                </div>
              )}
              {!excedeCaixa && freteSel && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-primary">
                      <Clock size={14} aria-hidden="true" />
                      {freteSel.name} · {freteSel.deliveryTime} dias úteis
                    </span>
                    <span className="font-bold text-primary shrink-0">
                      {formatBRL(freteSel.price)}
                    </span>
                  </div>
                  {frete?.endereco?.cidade && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <MapPin size={12} aria-hidden="true" />
                      {frete.endereco.cidade}
                      {frete.endereco.uf ? ` - ${frete.endereco.uf}` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Resumo */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4 lg:sticky lg:top-4">
          <h2 className="text-primary font-semibold">Resumo</h2>

          <ul className="divide-y divide-border text-sm">
            {items.map((i) => (
              <li key={i.variantId} className="py-2 flex justify-between gap-3">
                <span className="text-primary">
                  {i.nome}
                  {i.composicaoLabel ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {i.composicaoLabel}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground"> ×{i.quantidade}</span>
                </span>
                <span className="text-primary font-medium shrink-0 tabular-nums">
                  {formatBRL(i.precoPix * i.quantidade)}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatBRL(subtotalPix)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Frete</span>
              <span className="tabular-nums">
                {freteValor != null ? formatBRL(freteValor) : "calcular CEP"}
              </span>
            </div>
            <div className="flex items-end justify-between pt-2">
              <span className="text-sm font-medium text-primary">Total</span>
              <span className="text-green-600 text-2xl font-bold tabular-nums">
                {formatBRL(total)}
              </span>
            </div>
          </div>

          {erro && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 rounded-md p-2">
              {erro}
            </p>
          )}

          <button
            type="button"
            onClick={pagar}
            disabled={!podePagar}
            className="w-full inline-flex items-center justify-center gap-2 bg-secondary text-white text-sm font-semibold py-3 rounded-pill hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {pending ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : null}
            {pending ? "Gerando Pix…" : "Pagar com Pix"}
          </button>

          {!freteValor && !excedeCaixa && (
            <p className="text-[11px] text-muted-foreground text-center leading-snug flex items-center justify-center gap-1">
              <AlertTriangle size={12} aria-hidden="true" />
              Calcule o frete pelo CEP para liberar o pagamento.
            </p>
          )}

          <Link
            href="/carrinho"
            className="block text-center text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Voltar ao carrinho
          </Link>
        </div>
      </div>
    </div>
  );
}
