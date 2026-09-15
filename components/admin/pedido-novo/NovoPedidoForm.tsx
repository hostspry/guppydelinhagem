"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Link2,
  PackageSearch,
  Plus,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { FormField } from "@/components/admin/FormField";
import { lerDadosWhatsapp, cpfValido } from "@/lib/whatsapp-cliente";
import type { CadastroPeloLink, ProdutoPedido } from "@/lib/queries/pedidos";
import {
  criarVendaWhatsapp,
  procurarCliente,
  type ClienteCompleto,
  type ClienteParecido,
  type LeituraConversaResult,
} from "@/actions/venda-whatsapp";
import { COMPOSICAO_LABEL } from "@/lib/composicoes";
import { semanasParaAdmin } from "@/lib/semana-envio";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";
import { LeitorConversa } from "./LeitorConversa";
import { BuscaProduto } from "./BuscaProduto";
import { BuscaCliente } from "./BuscaCliente";

type Leitura = Extract<LeituraConversaResult, { ok: true }>;

type Item = {
  produtoId: string | null;
  composicao: TipoComposicao | null;
  nomeProduto: string;
  precoUnitario: string;
  quantidade: string;
  /** O preço ainda é o de tabela, posto automaticamente: falta o valor pago. */
  precoDeTabela: boolean;
  /** Como o item veio escrito na conversa, quando veio da leitura. */
  daConversa: string | null;
};

const ITEM_VAZIO: Item = {
  produtoId: null,
  composicao: null,
  nomeProduto: "",
  precoUnitario: "",
  quantidade: "1",
  precoDeTabela: false,
  daConversa: null,
};

const CAMPOS = [
  ["nome", "Nome completo"],
  ["cpfCnpj", "CPF/CNPJ"],
  ["telefone", "Telefone"],
  ["email", "E-mail"],
  ["cep", "CEP"],
  ["logradouro", "Rua"],
  ["numero", "Número"],
  ["complemento", "Complemento"],
  ["bairro", "Bairro"],
  ["cidade", "Cidade"],
  ["uf", "UF"],
] as const;

type Campo = (typeof CAMPOS)[number][0];
type Campos = Record<Campo, string>;

const CAMPOS_VAZIOS: Campos = {
  nome: "", cpfCnpj: "", telefone: "", email: "", cep: "", logradouro: "",
  numero: "", complemento: "", bairro: "", cidade: "", uf: "",
};

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: string) => Number(String(v).replace(",", ".")) || 0;
const r2 = (n: number) => Math.round(n * 100) / 100;
const paraCampo = (n: number) => r2(n).toFixed(2).replace(".", ",");

const LINK_CADASTRO = "https://guppydelinhagem.com.br/meus-dados";

const RANK_MOTIVO = { cpf: 0, email: 1, telefone: 2 } as const;

const AVISO_CONFIANCA = {
  ALTA: "Leitura limpa. Confira os valores antes de registrar.",
  MEDIA: "Alguma coisa foi deduzida. Confira itens e valores com atenção.",
  BAIXA: "Conversa difícil de ler. Trate como rascunho e confira tudo.",
} as const;

/** Quanto tempo faz, em palavra de gente ("agora", "há 2 h", "ontem"). */
function faz(data: Date): string {
  const min = Math.round((Date.now() - new Date(data).getTime()) / 60000);
  if (min < 2) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/** Preço de tabela de um produto na composição escolhida. */
function precoTabela(p: ProdutoPedido | undefined, composicao: string | null): number | null {
  if (!p) return null;
  const v = p.variantes.find((x) => x.composicao === composicao);
  return v ? v.preco : p.preco;
}

export function NovoPedidoForm({
  produtos,
  cadastros = [],
}: {
  produtos: ProdutoPedido[];
  cadastros?: CadastroPeloLink[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const semanas = useMemo(() => semanasParaAdmin(), []);

  const [campos, setCampos] = useState<Campos>(CAMPOS_VAZIOS);
  const [preenchidos, setPreenchidos] = useState<Set<Campo>>(new Set());
  const [parecidos, setParecidos] = useState<ClienteParecido[] | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteEscolhido, setClienteEscolhido] = useState<string | null>(null);

  const [itens, setItens] = useState<Item[]>([{ ...ITEM_VAZIO }]);
  const [frete, setFrete] = useState("");
  const [desconto, setDesconto] = useState("");
  const [valorPago, setValorPago] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [jaPago, setJaPago] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [transportadora, setTransportadora] = useState("");
  const [semanaEnvio, setSemanaEnvio] = useState("");

  const [aviso, setAviso] = useState<{ texto: string; nivel: "ALTA" | "MEDIA" | "BAIXA" } | null>(
    null,
  );

  const setCampo = (c: Campo, v: string) => setCampos((a) => ({ ...a, [c]: v }));
  const mudarItem = (i: number, parcial: Partial<Item>) =>
    setItens((a) => a.map((x, idx) => (idx === i ? { ...x, ...parcial } : x)));

  // ── Cliente ────────────────────────────────────────────────

  function aplicarParecidos(achados: ClienteParecido[]) {
    const ordenados = [...achados].sort((a, b) => RANK_MOTIVO[a.motivo] - RANK_MOTIVO[b.motivo]);
    setParecidos(ordenados);
    // Cliente que já existe é usado. O operador pode trocar para "cadastro novo"
    // quando for outra pessoa com o mesmo telefone.
    setClienteId(ordenados[0]?.id ?? null);
    setClienteEscolhido(null);
  }

  function usarCliente(c: ClienteCompleto | CadastroPeloLink) {
    const { id, nome } = c;
    setCampos({
      nome: c.nome, cpfCnpj: c.cpfCnpj, telefone: c.telefone, email: c.email,
      cep: c.cep, logradouro: c.logradouro, numero: c.numero,
      complemento: c.complemento, bairro: c.bairro, cidade: c.cidade, uf: c.uf,
    });
    setPreenchidos(new Set());
    setClienteId(id);
    setClienteEscolhido(nome);
    setParecidos(null);
    toast.success(`Dados de ${nome.split(/\s+/)[0]} carregados.`);
  }

  /** Dados da conversa em cima do que havia. Campo vazio na leitura não apaga o digitado. */
  function aplicarDadosCliente(dados: Campos) {
    const achados = CAMPOS.map(([c]) => c).filter((c) => dados[c]);
    setCampos((a) => {
      const novo = { ...a };
      for (const c of achados) novo[c] = dados[c];
      return novo;
    });
    setPreenchidos(new Set(achados));
    return achados.length;
  }

  // ── Leitura ────────────────────────────────────────────────

  function aplicarLeitura({ dados, parecidos: achados }: Leitura) {
    const nCampos = aplicarDadosCliente(dados.cliente);
    aplicarParecidos(achados);

    if (dados.itens.length) {
      setItens(
        dados.itens.map((it) => {
          const prod = produtos.find((p) => p.id === it.produtoId);
          const tabela = precoTabela(prod, it.composicao);
          const pago = it.precoUnitario;
          return {
            produtoId: prod?.id ?? null,
            composicao: prod ? (it.composicao as TipoComposicao | null) : null,
            nomeProduto: prod ? prod.nome : it.descricao,
            quantidade: String(it.quantidade),
            precoUnitario: pago != null ? paraCampo(pago) : tabela != null ? paraCampo(tabela) : "",
            precoDeTabela: pago == null,
            daConversa: it.descricao || null,
          };
        }),
      );
    }

    if (dados.frete != null) setFrete(paraCampo(dados.frete));
    if (dados.desconto != null) setDesconto(paraCampo(dados.desconto));
    setValorPago(dados.totalPago != null ? paraCampo(dados.totalPago) : "");
    setJaPago(dados.jaPago);
    if (dados.formaPagamento) setFormaPagamento(dados.formaPagamento);
    if (dados.observacoes) {
      setObservacoes((a) => (a.includes(dados.observacoes!) ? a : [a, dados.observacoes].filter(Boolean).join("\n")));
    }

    setAviso({ texto: dados.aviso ?? AVISO_CONFIANCA[dados.confianca], nivel: dados.confianca });
    const naoAchados = dados.itens.filter((i) => !i.produtoId).length;
    toast.success(
      `Li ${nCampos} dado(s) do cliente e ${dados.itens.length} item(ns)` +
        (naoAchados ? `, ${naoAchados} fora do catálogo.` : "."),
    );
  }

  function aplicarLeituraSemIa(texto: string) {
    const { dados, encontrados } = lerDadosWhatsapp(texto);
    if (encontrados.length === 0) {
      toast.error("Não reconheci nenhum dado de cliente nesse texto.");
      return;
    }
    aplicarDadosCliente(dados);
    setAviso(null);
    toast.success(`${encontrados.length} campo(s) reconhecido(s). Escolha os itens abaixo.`);
    startTransition(async () => {
      aplicarParecidos(
        await procurarCliente({ cpfCnpj: dados.cpfCnpj, email: dados.email, telefone: dados.telefone }),
      );
    });
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(LINK_CADASTRO);
      toast.success("Link copiado. Cole na conversa do cliente.");
    } catch {
      toast.error(`Copie na mão: ${LINK_CADASTRO}`);
    }
  }

  // ── Itens ──────────────────────────────────────────────────

  function trocarProduto(i: number, produtoId: string | null) {
    const p = produtos.find((x) => x.id === produtoId);
    setItens((atual) =>
      atual.map((it, idx) => {
        if (idx !== i) return it;
        if (!p) return { ...it, produtoId: null, composicao: null };
        const comp = p.variantes[0]?.composicao ?? null;
        const tabela = precoTabela(p, comp);
        // Preço digitado (o pago) fica. Só o de tabela acompanha o produto.
        const manterPreco = it.precoUnitario && !it.precoDeTabela;
        return {
          ...it,
          produtoId: p.id,
          nomeProduto: p.nome,
          composicao: comp,
          precoUnitario: manterPreco ? it.precoUnitario : tabela != null ? paraCampo(tabela) : "",
          precoDeTabela: manterPreco ? false : true,
        };
      }),
    );
  }

  function trocarComposicao(i: number, composicao: TipoComposicao) {
    setItens((atual) =>
      atual.map((it, idx) => {
        if (idx !== i) return it;
        const tabela = precoTabela(
          produtos.find((x) => x.id === it.produtoId),
          composicao,
        );
        return {
          ...it,
          composicao,
          precoUnitario:
            it.precoDeTabela && tabela != null ? paraCampo(tabela) : it.precoUnitario,
        };
      }),
    );
  }

  const subtotal = r2(itens.reduce((s, it) => s + num(it.precoUnitario) * num(it.quantidade), 0));
  const total = r2(Math.max(0, subtotal + num(frete) - num(desconto)));
  const pago = num(valorPago);
  const diferenca = valorPago.trim() ? r2(pago - total) : 0;
  const itensDeTabela = itens.filter((it) => it.precoDeTabela && it.produtoId).length;

  /**
   * Leva os preços dos itens ao valor que o cliente pagou. O que sobra depois
   * de frete e desconto é repartido na proporção dos preços atuais; o centavo
   * que a divisão não fecha vai para o primeiro item de quantidade 1.
   */
  function ajustarAoPago() {
    const alvo = r2(pago - num(frete) + num(desconto));
    if (alvo <= 0) {
      toast.error("O valor pago não cobre o frete. Confira os valores.");
      return;
    }
    const base = itens.map((it) => num(it.precoUnitario) * num(it.quantidade));
    const soma = base.reduce((s, v) => s + v, 0);
    const pesoIgual = soma <= 0;

    const novos = itens.map((it, i) => {
      const q = Math.max(1, num(it.quantidade));
      const linha = pesoIgual ? alvo / itens.length : (alvo * base[i]) / soma;
      return { ...it, precoUnitario: paraCampo(linha / q), precoDeTabela: false };
    });

    const fechado = r2(novos.reduce((s, it) => s + num(it.precoUnitario) * num(it.quantidade), 0));
    const resto = r2(alvo - fechado);
    if (resto !== 0) {
      const j = novos.findIndex((it) => num(it.quantidade) === 1);
      if (j >= 0) novos[j].precoUnitario = paraCampo(num(novos[j].precoUnitario) + resto);
    }
    setItens(novos);
  }

  // ── Salvar ─────────────────────────────────────────────────

  const cpfSuspeito =
    campos.cpfCnpj.replace(/\D/g, "").length === 11 && !cpfValido(campos.cpfCnpj);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await criarVendaWhatsapp({
        clienteId,
        ...campos,
        itens: itens.map((it) => ({
          produtoId: it.produtoId,
          composicao: it.composicao,
          nomeProduto: it.nomeProduto,
          precoUnitario: num(it.precoUnitario),
          quantidade: num(it.quantidade),
        })),
        frete: num(frete),
        desconto: num(desconto),
        observacoes,
        jaPago,
        formaPagamento: jaPago ? formaPagamento : null,
        transportadora,
        semanaEnvio,
      });
      if (!r.success) {
        toast.error(r.error);
        const erros = Object.entries(r.fieldErrors ?? {})
          .map(([k, v]) => `${k}: ${v?.[0]}`)
          .slice(0, 3);
        if (erros.length) toast.error(erros.join(" · "));
        return;
      }
      toast.success(`Pedido ${r.numero} registrado${r.clienteNovo ? " e cliente cadastrado" : ""}.`);
      router.push(`/admin/pedidos/${r.orderId}`);
      router.refresh();
    });
  }

  const legenda = "px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide";
  const caixa = "bg-white border border-gray-200 rounded-lg p-5";

  return (
    <form onSubmit={salvar} className="max-w-3xl space-y-5">
      <LeitorConversa onLido={aplicarLeitura} onLidoSemIa={aplicarLeituraSemIa} />

      {aviso && (
        <p
          className={`text-xs rounded-md px-3 py-2 border ${
            aviso.nivel === "ALTA"
              ? "text-green-800 bg-green-50 border-green-200"
              : "text-amber-800 bg-amber-50 border-amber-200"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {/* ── Link de cadastro ── */}
      <div className={caixa}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide">
              Link de cadastro
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Mande <code className="text-[#07366A]">guppydelinhagem.com.br/meus-dados</code>{" "}
              e o cliente preenche o endereço sozinho, sem ditar CEP na conversa.
            </p>
          </div>
          <button
            type="button"
            onClick={copiarLink}
            className="inline-flex items-center gap-1.5 border border-gray-300 text-[#07366A] text-sm font-medium px-3 py-2 rounded-md hover:border-[#07366A] transition-all"
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
            Copiar link
          </button>
        </div>

        {cadastros.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
              Chegaram pelo link (últimos 7 dias)
            </p>
            <ul className="space-y-1.5">
              {cadastros.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <span className="text-sm text-gray-700 min-w-0">
                    <strong className="text-[#07366A]">{c.nome}</strong>
                    <span className="block text-xs text-gray-500 truncate">
                      {[c.cidade, c.uf].filter(Boolean).join("/")} · {faz(c.cadastroEm)}
                      {c.pedidos > 0 && ` · ${c.pedidos} pedido(s)`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => usarCliente(c)}
                    className="shrink-0 text-sm font-medium text-[#FF035C] hover:underline"
                  >
                    Usar estes dados
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── 1. Cliente ── */}
      <fieldset className={caixa}>
        <legend className={legenda}>1. Cliente</legend>

        <BuscaCliente onEscolher={usarCliente} />

        {parecidos && parecidos.length > 0 && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-semibold text-[#07366A] mb-2">
              Esse cliente já tem cadastro. Vou usar o mesmo:
            </p>
            <div className="space-y-1.5">
              {parecidos.map((c) => (
                <label key={c.id} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="clienteEscolhido"
                    checked={clienteId === c.id}
                    onChange={() => setClienteId(c.id)}
                    className="mt-1 accent-[#FF035C]"
                  />
                  <span>
                    <strong className="text-[#07366A]">{c.nome}</strong>
                    <span className="block text-xs text-gray-500">
                      bateu por {c.motivo === "cpf" ? "CPF" : c.motivo === "email" ? "e-mail" : "telefone"}
                      {c.cidade ? ` · ${c.cidade}${c.uf ? `/${c.uf}` : ""}` : ""}
                      {` · ${c.pedidos} pedido(s)`}
                    </span>
                  </span>
                </label>
              ))}
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="clienteEscolhido"
                  checked={clienteId === null}
                  onChange={() => setClienteId(null)}
                  className="mt-1 accent-[#FF035C]"
                />
                <span>
                  <strong className="text-[#07366A]">Criar um cadastro novo</strong>
                  <span className="block text-xs text-gray-500">
                    Use se for outra pessoa (mesmo telefone da família, por exemplo).
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}

        {parecidos && parecidos.length === 0 && (
          <p className="mb-4 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
            Ninguém com esse CPF, e-mail ou telefone. Vai entrar como cliente novo.
          </p>
        )}

        {clienteId && (
          <p className="mb-4 flex items-center gap-1.5 text-xs text-[#07366A] bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
            <UserCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {clienteEscolhido ? `Usando o cadastro de ${clienteEscolhido}. ` : "Vai usar o cadastro existente. "}
            Campos vazios dele são completados com o que está abaixo; o que já
            estava preenchido não é sobrescrito.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          {CAMPOS.map(([campo, rotulo]) => (
            <FormField
              key={campo}
              label={rotulo}
              name={campo}
              hint={preenchidos.has(campo) ? "veio da conversa" : undefined}
            >
              <input
                id={campo}
                value={campos[campo]}
                onChange={(e) => setCampo(campo, e.target.value)}
                className={`${input} ${preenchidos.has(campo) ? "bg-green-50/60" : ""}`}
              />
            </FormField>
          ))}
        </div>

        {cpfSuspeito && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Esse CPF não passa na conta do dígito verificador. Confira com o
            cliente: CPF errado trava a etiqueta e a nota.
          </p>
        )}
      </fieldset>

      {/* ── 2. Itens ── */}
      <fieldset className={caixa}>
        <legend className={legenda}>2. O que ele comprou</legend>

        <div className="space-y-3">
          {itens.map((it, i) => {
            const prod = produtos.find((p) => p.id === it.produtoId);
            const tabela = precoTabela(prod, it.composicao);
            return (
              <div key={i} className="rounded-md border border-gray-200 p-3">
                {it.daConversa && (
                  <p
                    className={`mb-2 flex items-center gap-1.5 text-xs ${
                      prod ? "text-green-700" : "text-amber-700"
                    }`}
                  >
                    {prod ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <PackageSearch className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      Na conversa: “{it.daConversa}”.{" "}
                      {prod ? "Achei no catálogo." : "Não achei no catálogo: busque o produto ou deixe avulso."}
                    </span>
                  </p>
                )}

                <div className="flex items-start gap-2 mb-2">
                  <BuscaProduto
                    produtos={produtos}
                    produtoId={it.produtoId}
                    onEscolher={(id) => trocarProduto(i, id)}
                  />
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItens((a) => a.filter((_, x) => x !== i))}
                      aria-label="Remover item"
                      className="p-2 text-gray-500 hover:text-[#FF035C]"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {!it.produtoId && (
                  <input
                    value={it.nomeProduto}
                    onChange={(e) => mudarItem(i, { nomeProduto: e.target.value })}
                    placeholder="Nome do item (ex.: Ração importada 50g)"
                    className={`${input} mb-2`}
                  />
                )}

                {prod && prod.variantes.length > 0 && (
                  <select
                    value={it.composicao ?? ""}
                    onChange={(e) => trocarComposicao(i, e.target.value as TipoComposicao)}
                    className={`${input} mb-2`}
                    aria-label="Composição"
                  >
                    {prod.variantes.map((v) => (
                      <option key={v.composicao} value={v.composicao}>
                        {COMPOSICAO_LABEL[v.composicao]}
                        {v.rotulo ? ` (${v.rotulo})` : ""}
                      </option>
                    ))}
                  </select>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">Preço pago, unidade (R$)</span>
                    <input
                      value={it.precoUnitario}
                      onChange={(e) =>
                        mudarItem(i, { precoUnitario: e.target.value, precoDeTabela: false })
                      }
                      inputMode="decimal"
                      className={`${input} ${it.precoDeTabela && it.produtoId ? "bg-amber-50/70" : ""}`}
                    />
                    {tabela != null && (
                      <span className="block text-[11px] text-gray-400 mt-0.5">
                        {it.precoDeTabela
                          ? "Preço de tabela. Troque pelo valor que ele pagou."
                          : `Tabela: ${brl.format(tabela)}`}
                      </span>
                    )}
                  </label>
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">Quantidade</span>
                    <input
                      value={it.quantidade}
                      onChange={(e) => mudarItem(i, { quantidade: e.target.value })}
                      inputMode="numeric"
                      className={input}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setItens((a) => [...a, { ...ITEM_VAZIO }])}
          className="mt-3 inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-[#07366A] transition-all"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Mais um item
        </button>
      </fieldset>

      {/* ── 3. Valores e pagamento ── */}
      <fieldset className={caixa}>
        <legend className={legenda}>3. Valores e pagamento</legend>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
          <FormField label="Frete (R$)" name="frete">
            <input id="frete" value={frete} onChange={(e) => setFrete(e.target.value)} inputMode="decimal" className={input} placeholder="0" />
          </FormField>
          <FormField label="Desconto (R$)" name="desconto">
            <input id="desconto" value={desconto} onChange={(e) => setDesconto(e.target.value)} inputMode="decimal" className={input} placeholder="0" />
          </FormField>
          <FormField label="Valor que ele pagou (R$)" name="valorPago" hint="Só para conferir o total.">
            <input id="valorPago" value={valorPago} onChange={(e) => setValorPago(e.target.value)} inputMode="decimal" className={input} placeholder="opcional" />
          </FormField>
        </div>

        <p className="text-sm text-[#07366A] mb-3">
          Subtotal {brl.format(subtotal)} · Total do pedido{" "}
          <strong className="text-base">{brl.format(total)}</strong>
        </p>

        {diferenca !== 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              O pedido soma {brl.format(total)}, mas ele pagou {brl.format(pago)} (
              {diferenca > 0 ? "sobram" : "faltam"} {brl.format(Math.abs(diferenca))}).
            </p>
            <button
              type="button"
              onClick={ajustarAoPago}
              className="text-xs font-medium text-[#FF035C] hover:underline"
            >
              Ajustar os preços ao valor pago
            </button>
          </div>
        )}

        {diferenca === 0 && itensDeTabela > 0 && (
          <p className="mb-4 flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {itensDeTabela === 1 ? "Um item está" : `${itensDeTabela} itens estão`} com preço de
            tabela. O pedido tem que ter o valor que o cliente pagou.
          </p>
        )}

        <label className="flex items-start gap-2.5 cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={jaPago}
            onChange={(e) => setJaPago(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#FF035C]"
          />
          <span className="text-sm text-gray-700">
            <span className="font-medium text-[#07366A]">O cliente já pagou</span>
            <span className="block text-xs text-gray-500">
              O pedido nasce PAGO: baixa o estoque, entra no caixa para você
              conferir e libera a etiqueta. Sem marcar, fica aguardando pagamento.
            </span>
          </span>
        </label>

        {jaPago && (
          <FormField label="Como ele pagou" name="formaPagamento">
            <select id="formaPagamento" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className={input}>
              <option value="PIX">Pix</option>
              <option value="CARTAO">Cartão</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="BOLETO">Boleto</option>
              <option value="OUTRO">Outro</option>
            </select>
          </FormField>
        )}
      </fieldset>

      {/* ── 4. Envio ── */}
      <fieldset className={caixa}>
        <legend className={legenda}>4. Envio</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <FormField label="Transportadora" name="transportadora">
            <select id="transportadora" value={transportadora} onChange={(e) => setTransportadora(e.target.value)} className={input}>
              <option value="">Decidir depois</option>
              <option value="JADLOG">Jadlog</option>
              <option value="GOLLOG">Gollog</option>
              <option value="OUTRO">Outra</option>
            </select>
          </FormField>
          <FormField
            label="Semana do envio"
            name="semanaEnvio"
            hint="Entra no lembrete semanal do Telegram."
          >
            <select id="semanaEnvio" value={semanaEnvio} onChange={(e) => setSemanaEnvio(e.target.value)} className={input}>
              <option value="">Sem data definida</option>
              {semanas.map((s) => (
                <option key={s.chave} value={s.chave}>
                  Semana de {s.rotulo}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Observações" name="observacoes">
          <textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            className={input}
            placeholder="Combinado de envio, prazo pedido pelo cliente…"
          />
        </FormField>
      </fieldset>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#FF035C] text-white text-sm font-medium px-5 py-2 rounded-md hover:brightness-110 transition-all disabled:opacity-60"
        >
          {isPending ? "Registrando..." : "Registrar pedido"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/pedidos")}
          className="border border-gray-300 text-sm font-medium text-gray-700 px-5 py-2 rounded-md hover:border-gray-400 transition-all"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
