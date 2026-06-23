"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type SubmitErrorHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Plane,
  QrCode,
  ShoppingCart,
  Tag,
  Truck,
  X,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { formatBRL } from "@/lib/utils/format";
import {
  trackBeginCheckout,
  trackAddPaymentInfo,
  type AnalyticsItem,
} from "@/lib/analytics";
import {
  whatsappLink,
  MAX_PEIXES_POR_CAIXA,
  freteGollog,
} from "@/lib/constants";
import { checkoutSchema } from "@/lib/validations/checkout";
import {
  useCart,
  selectTotalPeixes,
  selectSubtotalPix,
  selectSubtotalCheio,
} from "@/lib/stores/cart";
import {
  criarPedidoCheckout,
  pagarComCartao,
  calcularTetoParcelas,
  precificarCheckout,
  validarCupom,
  type CheckoutPixData,
  type CartaoInput,
  type CheckoutPreco,
} from "@/actions/checkout";
import PixPanel from "@/components/checkout/PixPanel";
import CardPaymentBrick from "@/components/checkout/CardPaymentBrick";

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

// Só os campos visíveis do formulário (transportadora/itens vêm do carrinho e da
// regra de frete, não do form). Reusa as mensagens PT do checkoutSchema.
const camposSchema = checkoutSchema.omit({
  transportadora: true,
  modalidadeFrete: true,
  itens: true,
});
type CamposInput = z.input<typeof camposSchema>;
type CamposOutput = z.output<typeof camposSchema>;

// Ordem visual dos campos — para focar o PRIMEIRO com erro.
const FIELD_ORDER: (keyof CamposInput)[] = [
  "nome",
  "email",
  "telefone",
  "cpfCnpj",
  "cep",
  "logradouro",
  "numero",
  "bairro",
  "uf",
  "cidade",
];

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

const inputBase =
  "w-full min-h-11 px-3 rounded-lg border bg-white text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-all";
const inputOk =
  "border-border focus:border-primary focus:ring-primary/30";
const inputErr =
  "border-red-500 focus:border-red-500 focus:ring-red-500/30";
const labelCls = "block text-xs font-medium text-primary mb-1";

function cls(hasError: unknown) {
  return `${inputBase} ${hasError ? inputErr : inputOk}`;
}

// Componente de mensagem de erro — no topo do módulo (regra static-components).
function FieldError({ msg }: { msg?: string }) {
  return msg ? (
    <p role="alert" className="mt-1 text-xs text-red-600">
      {msg}
    </p>
  ) : null;
}

// Foco + scroll suave num campo pelo id (= nome do campo no RHF).
function focarCampo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  (el as HTMLElement).focus({ preventScroll: true });
}

export default function CheckoutClient({
  prefill,
  mpPublicKey,
  freteGratis,
}: {
  prefill: CheckoutPrefill;
  mpPublicKey: string | null;
  freteGratis: { ativo: boolean; acimaDe: number | null };
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const items = useCart((s) => s.items);
  const totalPeixes = useCart(selectTotalPeixes);
  const subtotalPixCart = useCart(selectSubtotalPix);
  const subtotalCheioCart = useCart(selectSubtotalCheio);
  const cupom = useCart((s) => s.cupom);
  const setCupom = useCart((s) => s.setCupom);
  const clearCupom = useCart((s) => s.clearCupom);

  // Desconto do cupom, revalidado no servidor (preview no checkout). O valor exato
  // é recalculado de novo ao fechar o pedido (anti-fraude); aqui é só o resumo.
  const [cupomDesc, setCupomDesc] = useState<{
    codigo: string;
    modo: "AMBOS_VENCE_MAIOR" | "AMBOS_ACUMULA" | "SO_PIX" | "SO_CARTAO";
    descontoPix: number;
    descontoCartao: number;
  } | null>(null);
  const [codigoCupom, setCodigoCupom] = useState("");
  const [cupomErro, setCupomErro] = useState<string | null>(null);
  const [aplicandoCupom, startCupom] = useTransition();

  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    trigger,
    getFieldState,
    formState: { errors, isSubmitted },
  } = useForm<CamposInput, unknown, CamposOutput>({
    resolver: zodResolver(camposSchema),
    defaultValues: prefill,
    shouldFocusError: false, // foco/scroll manual e suave (abaixo)
  });

  // Forma de pagamento (Pix padrão) + teto de parcelas (do servidor) + recusa.
  const [aba, setAba] = useState<"pix" | "cartao">("pix");
  // Modalidade de frete escolhida (Jadlog terrestre padrão | Gollog aéreo).
  const [modalidade, setModalidade] = useState<"TERRESTRE" | "AEREO">(
    "TERRESTRE",
  );
  const [teto, setTeto] = useState(1);
  const [recusa, setRecusa] = useState<string | null>(null);
  // Preços autoritativos do servidor (cheio + Pix). Fallback no cart até carregar.
  const [preco, setPreco] = useState<CheckoutPreco | null>(null);

  // Frete
  const [freteLoading, setFreteLoading] = useState(false);
  const [freteErro, setFreteErro] = useState<string | null>(null);
  const [frete, setFrete] = useState<FreteResponse | null>(null);

  // Submit / Pix
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [pix, setPix] = useState<CheckoutPixData | null>(null);

  const cepDigits = (watch("cep") ?? "").replace(/\D/g, "");
  const cepValido = /^\d{8}$/.test(cepDigits);
  const excedeCaixa = totalPeixes > MAX_PEIXES_POR_CAIXA;

  // Terrestre = Jadlog .Com (id 4, via Melhor Envio). Aéreo = Gollog fixo por UF.
  const jadlogSel = useMemo(
    () => frete?.jadlog.find((j) => j.id === 4) ?? frete?.jadlog[0] ?? null,
    [frete],
  );
  const ufAtual = (watch("uf") ?? "").toUpperCase();
  const gollogInfo = freteGollog(ufAtual); // {preco, regiao} | null
  // Valor do frete conforme a modalidade escolhida.
  const freteValor =
    modalidade === "AEREO"
      ? (gollogInfo?.preco ?? null)
      : (jadlogSel?.price ?? null);
  // Há opções a mostrar quando o frete foi calculado (Jadlog) — aí a UF também já
  // foi preenchida (autofill do ViaCEP), liberando o Gollog.
  const freteCalculado = frete != null;

  // Endereço (Seção 3): bloqueado até calcular o CEP. Quando o ViaCEP não devolve
  // a rua (CEP genérico/sem dados ou ViaCEP fora), desbloqueia vazio p/ manual.
  const enderecoBloqueado = !freteCalculado;
  const viacepSemResultado = freteCalculado && !frete?.endereco?.rua;

  // Subtotais: servidor manda; cart é fallback até o servidor responder.
  const subtotalPixView = preco?.subtotalPix ?? subtotalPixCart;
  const subtotalCheioView = preco?.subtotalCheio ?? subtotalCheioCart;
  // Desconto-base do Pix (sem cupom) = diferença entre o cheio e o Pix.
  const descontoPixBase = Math.max(0, subtotalCheioView - subtotalPixView);
  const precoMap = useMemo(() => {
    const m = new Map<string, { precoCheio: number; precoPix: number }>();
    preco?.itens.forEach((it) =>
      m.set(`${it.produtoId}|${it.composicao ?? ""}`, {
        precoCheio: it.precoCheio,
        precoPix: it.precoPix,
      }),
    );
    return m;
  }, [preco]);

  // Frete grátis: base ÚNICA = subtotal no CHEIO (cartão), igual ao servidor —
  // não muda entre abas Pix/Cartão. Aplica só quando ligado e atingido o valor.
  const freteGratisAplicado =
    freteGratis.ativo &&
    freteGratis.acimaDe != null &&
    subtotalCheioView >= freteGratis.acimaDe;
  // Valor do frete que efetivamente entra no total (0 quando frete grátis).
  const freteEfetivo = freteGratisAplicado ? 0 : freteValor;

  // Total exibido segue a ABA (Pix descontado × Cartão cheio). O cartão é cobrado
  // pelo cheio (Brick usa totalCartao); juros do parcelado vêm do MP.
  // Desconto do cupom conforme a aba (Pix × cartão). O cartão (Brick) precisa
  // bater EXATAMENTE com o que o servidor cobra (valorCartao), então subtraímos
  // o descontoCartao também no totalCartao.
  const descontoCupom = cupomDesc
    ? aba === "pix"
      ? cupomDesc.descontoPix
      : cupomDesc.descontoCartao
    : 0;
  // Cupom "vence o maior" no Pix: ele SUBSTITUI o desconto Pix (não soma). Aí não
  // mostramos a linha "Desconto no Pix"; o cupom aparece com o desconto cheio
  // (cheio → preço final), pra não parecer que os dois se somam.
  const cupomAbsorvePix =
    !!cupomDesc && aba === "pix" && cupomDesc.modo === "AMBOS_VENCE_MAIOR";
  const exibeDescontoPixBase =
    aba === "pix" && descontoPixBase > 0 && !cupomAbsorvePix;
  const cupomLinhaValor = cupomAbsorvePix
    ? descontoPixBase + (cupomDesc?.descontoPix ?? 0)
    : descontoCupom;
  const subtotalView = aba === "pix" ? subtotalPixView : subtotalCheioView;
  const total = Math.max(0, subtotalView + (freteEfetivo ?? 0) - descontoCupom);
  const totalCartao = Math.max(
    0,
    subtotalCheioView + (freteEfetivo ?? 0) - (cupomDesc?.descontoCartao ?? 0),
  );

  // Frete obrigatório: depois de uma tentativa de envio, sem valor e ≤10 peixes.
  const freteFaltando = isSubmitted && !excedeCaixa && freteValor == null;
  const temErros = Object.keys(errors).length > 0 || freteFaltando;

  // ── Analytics (GA4) — sem dado pessoal, só ids/valores ──
  // Itens do carrinho no formato do GA4 (preço Pix = preço efetivo destacado).
  function gaItens(): AnalyticsItem[] {
    return items.map((i) => ({
      item_id: i.produtoId,
      item_name: i.nome,
      price: i.precoPix,
      quantity: i.quantidade,
    }));
  }
  // begin_checkout uma vez, quando o carrinho hidratar com itens.
  const beginFired = useRef(false);
  useEffect(() => {
    if (beginFired.current || items.length === 0) return;
    beginFired.current = true;
    trackBeginCheckout(
      items.map((i) => ({
        item_id: i.produtoId,
        item_name: i.nome,
        price: i.precoPix,
        quantity: i.quantidade,
      })),
      subtotalPixCart,
    );
  }, [items, subtotalPixCart]);

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
          const fill = (
            campo: "logradouro" | "bairro" | "cidade" | "uf",
            valor: string | null,
          ) => {
            if (!getValues(campo) && valor) {
              setValue(campo, valor, { shouldValidate: isSubmitted });
            }
          };
          fill("logradouro", e.rua);
          fill("bairro", e.bairro);
          fill("cidade", e.cidade);
          fill("uf", e.uf);
        }
      }
    } catch {
      setFrete(null);
      setFreteErro("Falha de rede ao calcular o frete.");
    } finally {
      setFreteLoading(false);
    }
  }

  // Teto de parcelas (servidor) p/ o Brick — min(12, menor parcelasMax do carrinho).
  const produtoIdsKey = items.map((i) => i.produtoId).join(",");
  useEffect(() => {
    if (items.length === 0) return;
    let ativo = true;
    calcularTetoParcelas(items.map((i) => i.produtoId)).then((t) => {
      if (ativo) setTeto(t);
    });
    return () => {
      ativo = false;
    };
    // produtoIdsKey resume os ids do carrinho (evita refazer a cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoIdsKey]);

  // Itens do carrinho no formato da action (reuso Pix/Cartão).
  const itensPedido = () =>
    items.map((i) => ({
      produtoId: i.produtoId,
      composicao: i.composicao,
      quantidade: i.quantidade,
    }));

  function aplicarCupom() {
    const codigo = codigoCupom.trim();
    if (!codigo) {
      setCupomErro("Informe um código.");
      return;
    }
    startCupom(async () => {
      const r = await validarCupom(codigo, itensPedido());
      if (r.ok) {
        setCupom(r.codigo);
        setCupomDesc({
          codigo: r.codigo,
          modo: r.modo,
          descontoPix: r.descontoPix,
          descontoCartao: r.descontoCartao,
        });
        setCupomErro(null);
        setCodigoCupom("");
      } else {
        setCupomErro(r.motivo);
      }
    });
  }

  function removerCupom() {
    clearCupom();
    setCupomDesc(null);
    setCupomErro(null);
  }

  // Preços autoritativos (cheio + Pix) do servidor — refaz quando o carrinho muda.
  const itensKey = items
    .map((i) => `${i.produtoId}|${i.composicao ?? ""}|${i.quantidade}`)
    .join(";");
  useEffect(() => {
    if (items.length === 0) return;
    let ativo = true;
    precificarCheckout(itensPedido()).then((p) => {
      if (ativo) setPreco(p);
    });
    return () => {
      ativo = false;
    };
    // itensKey resume ids+composição+qtd do carrinho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itensKey]);

  // Revalida o cupom salvo (carrinho) contra os preços do servidor — preview do
  // resumo. Some o desconto se o cupom deixou de valer ou não cobre os itens.
  useEffect(() => {
    if (!cupom || items.length === 0) {
      setCupomDesc(null);
      return;
    }
    let ativo = true;
    validarCupom(cupom, itensPedido()).then((r) => {
      if (!ativo) return;
      setCupomDesc(
        r.ok
          ? {
              codigo: r.codigo,
              modo: r.modo,
              descontoPix: r.descontoPix,
              descontoCartao: r.descontoCartao,
            }
          : null,
      );
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itensKey, cupom]);

  function onValid(data: CamposOutput) {
    // O submit do form é só do Pix; na aba Cartão o Brick tem botão próprio.
    if (aba === "cartao") return;
    // Frete entra como “erro” do mesmo jeito: sem ele, não submete.
    if (excedeCaixa) {
      focarCampo("cep");
      return;
    }
    if (freteValor == null) {
      focarCampo("cep");
      return;
    }
    trackAddPaymentInfo(gaItens(), total, "pix");
    setErro(null);
    startTransition(async () => {
      const res = await criarPedidoCheckout({
        ...data,
        complemento: data.complemento ?? "",
        transportadora: modalidade === "AEREO" ? "GOLLOG" : "JADLOG",
        modalidadeFrete: modalidade,
        cupomCodigo: cupom ?? "",
        itens: itensPedido(),
      });
      if (res.ok) {
        setPix(res.data);
      } else {
        setErro(res.error);
      }
    });
  }

  // Form inválido: foca + rola suave pro primeiro campo com erro.
  const onInvalid: SubmitErrorHandler<CamposInput> = (formErrors) => {
    const primeiro = FIELD_ORDER.find((f) => formErrors[f]);
    if (primeiro) focarCampo(primeiro);
  };

  const submeter = handleSubmit(onValid, onInvalid);

  // Pagamento com cartão: o Brick chama isto no onSubmit. Valida o checkout
  // (mesma UX do Pix) ANTES de cobrar; depois trata os três desfechos. Lança em
  // erro/recusa pra o Brick reabilitar o botão e deixar tentar de novo.
  async function onCartao(cartao: CartaoInput) {
    setErro(null);
    setRecusa(null);

    const valido = await trigger();
    if (!valido) {
      const primeiro = FIELD_ORDER.find((f) => getFieldState(f).invalid);
      if (primeiro) focarCampo(primeiro);
      throw new Error("Revise os campos destacados.");
    }
    if (excedeCaixa || freteValor == null) {
      focarCampo("cep");
      throw new Error("Calcule o frete pelo seu CEP para continuar.");
    }

    trackAddPaymentInfo(gaItens(), totalCartao, "cartao");

    const dados = getValues();
    const res = await pagarComCartao(
      {
        ...dados,
        complemento: dados.complemento ?? "",
        transportadora: modalidade === "AEREO" ? "GOLLOG" : "JADLOG",
        modalidadeFrete: modalidade,
        cupomCodigo: cupom ?? "",
        itens: itensPedido(),
      },
      cartao,
    );

    if (res.resultado === "aprovado") {
      router.push(`/pedido/${res.numero.replace(/^#/, "")}/sucesso`);
      return;
    }
    if (res.resultado === "analise") {
      router.push(`/pedido/${res.numero.replace(/^#/, "")}/analise`);
      return;
    }
    if (res.resultado === "recusado") {
      setRecusa(res.mensagem);
      throw new Error(res.mensagem);
    }
    setErro(res.mensagem);
    throw new Error(res.mensagem);
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

      <form
        noValidate
        onSubmit={submeter}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"
      >
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
                  className={cls(errors.nome)}
                  autoComplete="name"
                  aria-invalid={!!errors.nome}
                  {...register("nome")}
                />
                <FieldError msg={errors.nome?.message} />
              </div>
              <div>
                <label className={labelCls} htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  className={cls(errors.email)}
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
                <FieldError msg={errors.email?.message} />
              </div>
              <div>
                <label className={labelCls} htmlFor="telefone">
                  Telefone / WhatsApp
                </label>
                <input
                  id="telefone"
                  inputMode="numeric"
                  className={cls(errors.telefone)}
                  autoComplete="tel"
                  aria-invalid={!!errors.telefone}
                  {...register("telefone")}
                  onChange={(e) =>
                    setValue("telefone", formatTel(e.target.value), {
                      shouldValidate: isSubmitted,
                    })
                  }
                />
                <FieldError msg={errors.telefone?.message} />
              </div>
              <div>
                <label className={labelCls} htmlFor="cpfCnpj">
                  CPF / CNPJ
                </label>
                <input
                  id="cpfCnpj"
                  inputMode="numeric"
                  className={cls(errors.cpfCnpj)}
                  aria-invalid={!!errors.cpfCnpj}
                  {...register("cpfCnpj")}
                  onChange={(e) =>
                    setValue("cpfCnpj", formatCpf(e.target.value), {
                      shouldValidate: isSubmitted,
                    })
                  }
                />
                <FieldError msg={errors.cpfCnpj?.message} />
              </div>
            </div>
          </section>

          {/* ── Seção 2 — Frete (o CEP e o cálculo moram aqui) ── */}
          <section className="bg-white border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-primary font-semibold">Frete</h2>

            {freteGratisAplicado && (
              <p className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                <Truck size={16} className="shrink-0" aria-hidden="true" />
                Frete grátis neste pedido! Calcule o CEP para confirmarmos a
                entrega. O valor fica zerado.
              </p>
            )}

            {/* CEP + Calcular */}
            <div className="max-w-xs">
              <label className={labelCls} htmlFor="cep">
                CEP
              </label>
              <div className="flex gap-2">
                <input
                  id="cep"
                  inputMode="numeric"
                  className={cls(errors.cep || freteFaltando)}
                  autoComplete="postal-code"
                  maxLength={9}
                  aria-invalid={!!errors.cep}
                  {...register("cep")}
                  onChange={(e) => {
                    setValue("cep", formatCep(e.target.value), {
                      shouldValidate: isSubmitted,
                    });
                    setFrete(null); // muda CEP → bloqueia endereço de novo
                  }}
                />
                <button
                  type="button"
                  onClick={calcularFrete}
                  disabled={!cepValido || freteLoading}
                  className="inline-flex items-center justify-center min-h-11 px-4 rounded-lg border border-border text-primary font-medium text-sm hover:border-primary disabled:opacity-50 transition-all whitespace-nowrap"
                >
                  {freteLoading ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  ) : (
                    "Calcular"
                  )}
                </button>
              </div>
              <FieldError msg={errors.cep?.message} />
            </div>

            {/* Estado / opções de frete */}
            <div aria-live="polite" className="space-y-2 empty:hidden">
              {freteErro && (
                <p role="alert" className="text-xs text-red-700">
                  {freteErro}
                </p>
              )}
              {freteFaltando && !freteErro && (
                <p role="alert" className="text-xs text-red-600">
                  Calcule o frete pelo seu CEP para continuar.
                </p>
              )}

              {/* Estado inicial — sem CEP calculado */}
              {!freteCalculado && !freteErro && !excedeCaixa && (
                <p className="text-sm text-muted-foreground">
                  Informe o CEP para ver as opções de envio.
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

              {!excedeCaixa && (freteCalculado || !!gollogInfo) && (
                <fieldset className="space-y-2">
                  <legend className="text-xs font-medium text-primary mb-1">
                    Escolha o frete
                  </legend>

                  {/* Terrestre — Jadlog (via Melhor Envio) */}
                  <label
                    className={`flex items-center gap-3 rounded-lg border p-3 text-sm cursor-pointer transition-all ${
                      modalidade === "TERRESTRE"
                        ? "border-primary/60 bg-primary/5"
                        : "border-border hover:border-primary/40"
                    } ${jadlogSel ? "" : "opacity-60"}`}
                  >
                    <input
                      type="radio"
                      name="modalidadeFrete"
                      className="accent-secondary"
                      checked={modalidade === "TERRESTRE"}
                      disabled={!jadlogSel}
                      onChange={() => setModalidade("TERRESTRE")}
                    />
                    <span className="flex-1">
                      <span className="flex items-center gap-1.5 text-primary font-medium">
                        <Clock size={14} aria-hidden="true" />
                        JADLOG (terrestre)
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {jadlogSel
                          ? `entrega no seu CEP · ${jadlogSel.deliveryTime} dias úteis`
                          : "indisponível para esse CEP"}
                      </span>
                    </span>
                    <span
                      className={`font-bold shrink-0 ${
                        freteGratisAplicado && jadlogSel
                          ? "text-green-600"
                          : "text-primary"
                      }`}
                    >
                      {jadlogSel
                        ? freteGratisAplicado
                          ? "Grátis"
                          : formatBRL(jadlogSel.price)
                        : "-"}
                    </span>
                  </label>

                  {/* Aviso de prazo longo (>13 dias) — não bloqueia a escolha */}
                  {jadlogSel?.requerAvaliacao && (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-snug space-y-1">
                      <p className="flex items-start gap-1.5">
                        <AlertTriangle
                          size={13}
                          className="shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        Prazo longo ({jadlogSel.deliveryTime} dias) é arriscado para
                        peixe vivo. Recomendamos combinar pelo WhatsApp ou usar o
                        aéreo.
                      </p>
                      <a
                        href={whatsappLink(
                          `Olá! O frete terrestre do meu CEP ficou em ${jadlogSel.deliveryTime} dias. Pode me ajudar com o envio?`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold underline hover:text-amber-900"
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                        Combinar pelo WhatsApp
                      </a>
                    </div>
                  )}

                  {/* Aéreo — Gollog (tabela fixa por região) */}
                  <label
                    className={`flex items-center gap-3 rounded-lg border p-3 text-sm cursor-pointer transition-all ${
                      modalidade === "AEREO"
                        ? "border-primary/60 bg-primary/5"
                        : "border-border hover:border-primary/40"
                    } ${gollogInfo ? "" : "opacity-60"}`}
                  >
                    <input
                      type="radio"
                      name="modalidadeFrete"
                      className="accent-secondary"
                      checked={modalidade === "AEREO"}
                      disabled={!gollogInfo}
                      onChange={() => setModalidade("AEREO")}
                    />
                    <span className="flex-1">
                      <span className="flex items-center gap-1.5 text-primary font-medium">
                        <Plane size={14} aria-hidden="true" />
                        Gollog (aéreo)
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {gollogInfo ? "1–2 dias úteis" : "informe a UF do endereço"}
                      </span>
                    </span>
                    <span
                      className={`font-bold shrink-0 ${
                        freteGratisAplicado && gollogInfo
                          ? "text-green-600"
                          : "text-primary"
                      }`}
                    >
                      {gollogInfo
                        ? freteGratisAplicado
                          ? "Grátis"
                          : formatBRL(gollogInfo.preco)
                        : "-"}
                    </span>
                  </label>

                  {/* Aviso Gollog — retirada na base do aeroporto */}
                  {gollogInfo && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-snug">
                      <strong>Retirada na base Gollog do aeroporto</strong> (não é
                      entregue em casa). Confirme que há uma unidade Gollog perto de
                      você antes de escolher.
                    </p>
                  )}

                  {frete?.endereco?.cidade && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin size={12} aria-hidden="true" />
                      {frete.endereco.cidade}
                      {frete.endereco.uf ? ` - ${frete.endereco.uf}` : ""}
                    </p>
                  )}
                </fieldset>
              )}
            </div>
          </section>

          {/* ── Seção 3 — Endereço de entrega (bloqueada até calcular o CEP) ── */}
          <section className="bg-white border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-primary font-semibold">Endereço de entrega</h2>

            {enderecoBloqueado ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground bg-bg-alt rounded-lg p-3">
                <MapPin size={15} className="shrink-0" aria-hidden="true" />
                Informe o CEP na seção{" "}
                <strong className="text-primary">Frete</strong> primeiro.
              </p>
            ) : viacepSemResultado ? (
              <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2.5">
                Não encontramos o endereço automaticamente. Preencha à mão.
              </p>
            ) : null}

            <fieldset
              disabled={enderecoBloqueado}
              aria-disabled={enderecoBloqueado}
              className={
                enderecoBloqueado ? "opacity-50 pointer-events-none" : ""
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                <div className="sm:col-span-4">
                  <label className={labelCls} htmlFor="logradouro">
                    Endereço
                  </label>
                  <input
                    id="logradouro"
                    className={cls(errors.logradouro)}
                    autoComplete="address-line1"
                    aria-invalid={!!errors.logradouro}
                    {...register("logradouro")}
                  />
                  <FieldError msg={errors.logradouro?.message} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="numero">
                    Número
                  </label>
                  <input
                    id="numero"
                    className={cls(errors.numero)}
                    aria-invalid={!!errors.numero}
                    {...register("numero")}
                  />
                  <FieldError msg={errors.numero?.message} />
                </div>
                <div className="sm:col-span-3">
                  <label className={labelCls} htmlFor="bairro">
                    Bairro
                  </label>
                  <input
                    id="bairro"
                    className={cls(errors.bairro)}
                    aria-invalid={!!errors.bairro}
                    {...register("bairro")}
                  />
                  <FieldError msg={errors.bairro?.message} />
                </div>
                <div className="sm:col-span-3">
                  <label className={labelCls} htmlFor="complemento">
                    Complemento
                  </label>
                  <input
                    id="complemento"
                    className={cls(errors.complemento)}
                    placeholder="opcional"
                    {...register("complemento")}
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className={labelCls} htmlFor="cidade">
                    Cidade
                  </label>
                  <input
                    id="cidade"
                    className={cls(errors.cidade)}
                    aria-invalid={!!errors.cidade}
                    {...register("cidade")}
                  />
                  <FieldError msg={errors.cidade?.message} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="uf">
                    UF
                  </label>
                  <input
                    id="uf"
                    className={cls(errors.uf)}
                    maxLength={2}
                    aria-invalid={!!errors.uf}
                    {...register("uf")}
                    onChange={(e) =>
                      setValue("uf", e.target.value.toUpperCase().slice(0, 2), {
                        shouldValidate: isSubmitted,
                      })
                    }
                  />
                  <FieldError msg={errors.uf?.message} />
                </div>
              </div>
            </fieldset>
          </section>
        </div>

        {/* Resumo */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4 lg:sticky lg:top-4">
          <h2 className="text-primary font-semibold">Resumo</h2>

          {temErros && (
            <p
              role="alert"
              className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2 flex items-center gap-1.5"
            >
              <AlertTriangle size={13} aria-hidden="true" />
              Revise os campos destacados.
            </p>
          )}

          <ul className="divide-y divide-border text-sm">
            {items.map((i) => {
              const srv = precoMap.get(`${i.produtoId}|${i.composicao ?? ""}`);
              // Mostra sempre o preço cheio (cartão à vista); os descontos (Pix e
              // cupom) aparecem itemizados abaixo, no resumo.
              const unit = srv?.precoCheio ?? i.precoCheio;
              return (
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
                    {formatBRL(unit * i.quantidade)}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Cupom de desconto */}
          <div className="border-t border-border pt-3">
            {cupomDesc ? (
              <div className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-sm text-green-700 font-medium">
                  <Tag size={14} aria-hidden="true" />
                  Cupom {cupomDesc.codigo}
                </span>
                <button
                  type="button"
                  onClick={removerCupom}
                  aria-label="Remover cupom"
                  className="text-green-700 hover:text-secondary transition-colors"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div>
                <label htmlFor="cupom" className="block text-xs font-medium text-primary mb-1">
                  Cupom de desconto
                </label>
                <div className="flex gap-2">
                  <input
                    id="cupom"
                    value={codigoCupom}
                    onChange={(e) => setCodigoCupom(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        aplicarCupom();
                      }
                    }}
                    placeholder="Digite o código"
                    className="flex-1 min-w-0 min-h-11 px-3 rounded-lg border border-border bg-white text-sm text-primary uppercase placeholder:normal-case placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={aplicarCupom}
                    disabled={aplicandoCupom}
                    className="shrink-0 inline-flex items-center justify-center min-h-11 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
                  >
                    {aplicandoCupom ? "…" : "Aplicar"}
                  </button>
                </div>
                {cupomErro && (
                  <p className="text-xs text-red-600 mt-1">{cupomErro}</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1 border-t border-border pt-3 text-sm">
            {/* Subtotal sempre no preço CHEIO (cartão à vista) — os descontos vêm
                listados abaixo, pra ficar claro de onde sai cada valor. */}
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatBRL(subtotalCheioView)}</span>
            </div>
            {exibeDescontoPixBase && (
              <div className="flex justify-between text-green-700">
                <span>Desconto no Pix</span>
                <span className="tabular-nums font-medium">
                  − {formatBRL(descontoPixBase)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Frete</span>
              {freteGratisAplicado ? (
                <span className="tabular-nums font-semibold text-green-600">
                  Grátis
                </span>
              ) : (
                <span className="tabular-nums">
                  {freteValor != null ? formatBRL(freteValor) : "calcular CEP"}
                </span>
              )}
            </div>
            {cupomDesc && cupomLinhaValor > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Cupom {cupomDesc.codigo}</span>
                <span className="tabular-nums font-medium">
                  − {formatBRL(cupomLinhaValor)}
                </span>
              </div>
            )}
            <div className="flex items-end justify-between pt-2">
              <span className="text-sm font-medium text-primary">
                Total {aba === "pix" ? "no Pix" : "no cartão"}
              </span>
              <span className="text-green-600 text-2xl font-bold tabular-nums">
                {formatBRL(total)}
              </span>
            </div>
            {aba === "cartao" && (
              <p className="text-[11px] text-muted-foreground text-right">
                À vista no crédito
                {teto > 1 ? ` ou em até ${teto}x com juros` : ""}.
              </p>
            )}
          </div>

          {/* Forma de pagamento: Pix (padrão) | Cartão */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-bg-alt p-1">
            <button
              type="button"
              onClick={() => setAba("pix")}
              className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-all ${
                aba === "pix"
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              <QrCode size={15} aria-hidden="true" />
              Pix
            </button>
            <button
              type="button"
              onClick={() => setAba("cartao")}
              className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-all ${
                aba === "cartao"
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              <CreditCard size={15} aria-hidden="true" />
              Cartão
            </button>
          </div>

          {erro && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 rounded-md p-2">
              {erro}
            </p>
          )}

          {aba === "pix" ? (
            <>
              <button
                type="submit"
                disabled={pending}
                className="w-full inline-flex items-center justify-center gap-2 bg-secondary text-white text-sm font-semibold py-3 rounded-pill hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {pending ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : null}
                {pending ? "Gerando Pix…" : "Pagar com Pix"}
              </button>

              {!freteValor && !excedeCaixa && !freteFaltando && (
                <p className="text-[11px] text-muted-foreground text-center leading-snug flex items-center justify-center gap-1">
                  <AlertTriangle size={12} aria-hidden="true" />
                  Calcule o frete pelo CEP para concluir.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              {!mpPublicKey ? (
                <p className="text-xs text-amber-700">
                  Pagamento com cartão indisponível no momento. Use o Pix.
                </p>
              ) : excedeCaixa ? (
                <p className="text-xs text-amber-700">
                  Acima de {MAX_PEIXES_POR_CAIXA} peixes, finalize no WhatsApp.
                </p>
              ) : freteValor == null ? (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 leading-snug">
                  <AlertTriangle size={12} aria-hidden="true" />
                  Calcule o frete pelo seu CEP para ver as parcelas do cartão.
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Em até {teto}x com juros.
                  </p>
                  <CardPaymentBrick
                    publicKey={mpPublicKey}
                    amount={totalCartao}
                    maxInstallments={teto}
                    payerEmail={watch("email")}
                    onPagar={onCartao}
                    onErro={(m) => setErro(m)}
                  />
                </>
              )}

              {recusa && (
                <p
                  role="alert"
                  className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2"
                >
                  {recusa}
                </p>
              )}
            </div>
          )}

          <Link
            href="/carrinho"
            className="block text-center text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Voltar ao carrinho
          </Link>
        </div>
      </form>
    </div>
  );
}
