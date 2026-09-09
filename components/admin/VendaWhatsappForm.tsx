"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardPaste, Plus, Trash2, UserCheck, UserPlus } from "lucide-react";
import { FormField } from "@/components/admin/FormField";
import { lerDadosWhatsapp, cpfValido } from "@/lib/whatsapp-cliente";
import {
  criarVendaWhatsapp,
  procurarCliente,
  type ClienteParecido,
} from "@/actions/venda-whatsapp";
import { COMPOSICAO_LABEL } from "@/lib/composicoes";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";

type Variante = {
  composicao: TipoComposicao;
  preco: number;
  qtdMachos: number;
  qtdFemeas: number;
};
type Produto = {
  id: string;
  nome: string;
  preco: number;
  tipo: string;
  variantes: Variante[];
};

type Item = {
  produtoId: string | null;
  composicao: TipoComposicao | null;
  nomeProduto: string;
  precoUnitario: string;
  quantidade: string;
};

const ITEM_VAZIO: Item = {
  produtoId: null,
  composicao: null,
  nomeProduto: "",
  precoUnitario: "",
  quantidade: "1",
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

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: string) => Number(String(v).replace(",", ".")) || 0;

export function VendaWhatsappForm({ produtos }: { produtos: Produto[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [colado, setColado] = useState("");
  const [campos, setCampos] = useState<Record<Campo, string>>({
    nome: "", cpfCnpj: "", telefone: "", email: "", cep: "", logradouro: "",
    numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  });
  const [preenchidos, setPreenchidos] = useState<Set<Campo>>(new Set());
  const [parecidos, setParecidos] = useState<ClienteParecido[] | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);

  const [itens, setItens] = useState<Item[]>([{ ...ITEM_VAZIO }]);
  const [frete, setFrete] = useState("");
  const [desconto, setDesconto] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [jaPago, setJaPago] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("PIX");

  function setCampo(c: Campo, v: string) {
    setCampos((atual) => ({ ...atual, [c]: v }));
  }

  /** Lê o bloco colado e já procura o cliente pelos dados que saíram dele. */
  function interpretar() {
    const { dados, encontrados } = lerDadosWhatsapp(colado);
    if (encontrados.length === 0) {
      toast.error("Não reconheci nenhum campo nesse texto.");
      return;
    }
    setCampos({
      nome: dados.nome,
      cpfCnpj: dados.cpfCnpj,
      telefone: dados.telefone,
      email: dados.email,
      cep: dados.cep,
      logradouro: dados.logradouro,
      numero: dados.numero,
      complemento: dados.complemento,
      bairro: dados.bairro,
      cidade: dados.cidade,
      uf: dados.uf,
    });
    setPreenchidos(new Set(encontrados as Campo[]));
    setClienteId(null);
    toast.success(`${encontrados.length} campo(s) reconhecido(s).`);

    startTransition(async () => {
      const achados = await procurarCliente({
        cpfCnpj: dados.cpfCnpj,
        email: dados.email,
        telefone: dados.telefone,
      });
      setParecidos(achados);
    });
  }

  function trocarProduto(i: number, produtoId: string) {
    const p = produtos.find((x) => x.id === produtoId) ?? null;
    setItens((atual) =>
      atual.map((it, idx) => {
        if (idx !== i) return it;
        if (!p) return { ...it, produtoId: null, composicao: null };
        const padrao = p.variantes[0] ?? null;
        return {
          ...it,
          produtoId: p.id,
          nomeProduto: p.nome,
          composicao: padrao ? padrao.composicao : null,
          precoUnitario: String(padrao ? padrao.preco : p.preco),
        };
      }),
    );
  }

  function trocarComposicao(i: number, composicao: string) {
    setItens((atual) =>
      atual.map((it, idx) => {
        if (idx !== i) return it;
        const p = produtos.find((x) => x.id === it.produtoId);
        const v = p?.variantes.find((x) => x.composicao === composicao);
        return {
          ...it,
          composicao: (composicao || null) as TipoComposicao | null,
          precoUnitario: v ? String(v.preco) : it.precoUnitario,
        };
      }),
    );
  }

  const subtotal = itens.reduce(
    (s, it) => s + num(it.precoUnitario) * num(it.quantidade),
    0,
  );
  const total = Math.max(0, subtotal + num(frete) - num(desconto));

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
      });
      if (!r.success) {
        toast.error(r.error);
        const campos1 = Object.entries(r.fieldErrors ?? {})
          .map(([k, v]) => `${k}: ${v?.[0]}`)
          .slice(0, 3);
        if (campos1.length) toast.error(campos1.join(" · "));
        return;
      }
      toast.success(
        `Venda ${r.numero} registrada${r.clienteNovo ? " e cliente cadastrado" : ""}.`,
      );
      router.push(`/admin/pedidos/${r.orderId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={salvar} className="max-w-3xl space-y-5">
      {/* ── 1. Colar ── */}
      <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
        <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          1. Cole o que o cliente mandou
        </legend>
        <textarea
          value={colado}
          onChange={(e) => setColado(e.target.value)}
          rows={8}
          placeholder={`Nome: Raul Moreira Castro Junior\nCPF:172.160.938-52\nRua : Quintino Bocaiuva\nNúmero: 1203\nComplemento:\nBairro:Jardim Paraíso\nCidade: Bebedouro\nEstado: SP\nCep : 14.701-470\nTelefone com DDD:\n24 999277785`}
          className={`${input} font-mono text-xs leading-relaxed`}
        />
        <button
          type="button"
          onClick={interpretar}
          disabled={!colado.trim() || isPending}
          className="mt-3 inline-flex items-center gap-1.5 bg-[#07366A] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-125 transition-all disabled:opacity-60"
        >
          <ClipboardPaste className="w-4 h-4" aria-hidden="true" />
          Ler os dados
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Entende rótulo com ou sem espaço, valor na linha de baixo, estado por
          extenso e CEP/CPF pontuados. O que não reconhecer, você completa abaixo.
        </p>
      </fieldset>

      {/* ── 2. Cliente ── */}
      <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
        <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          2. Cliente
        </legend>

        {parecidos && parecidos.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900 mb-2">
              Já existe cadastro parecido. Use o mesmo para não duplicar:
            </p>
            <div className="space-y-1.5">
              {parecidos.map((c) => (
                <label
                  key={c.id}
                  className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer"
                >
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
            <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Vai usar o cadastro existente. Campos vazios dele são completados com
            o que veio no texto; o que já estava preenchido não é sobrescrito.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          {CAMPOS.map(([campo, rotulo]) => (
            <FormField
              key={campo}
              label={rotulo}
              name={campo}
              hint={
                preenchidos.has(campo) ? "veio do texto colado" : undefined
              }
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

      {/* ── 3. Itens ── */}
      <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
        <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          3. O que ele comprou
        </legend>

        <div className="space-y-3">
          {itens.map((it, i) => {
            const prod = produtos.find((p) => p.id === it.produtoId);
            return (
              <div key={i} className="rounded-md border border-gray-200 p-3">
                <div className="flex items-start gap-2 mb-2">
                  <select
                    value={it.produtoId ?? ""}
                    onChange={(e) => trocarProduto(i, e.target.value)}
                    className={`${input} flex-1`}
                    aria-label="Produto"
                  >
                    <option value="">Item avulso (digitar o nome)</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
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
                    onChange={(e) =>
                      setItens((a) =>
                        a.map((x, idx) =>
                          idx === i ? { ...x, nomeProduto: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Nome do item (ex.: Ração importada 50g)"
                    className={`${input} mb-2`}
                  />
                )}

                {prod && prod.variantes.length > 0 && (
                  <select
                    value={it.composicao ?? ""}
                    onChange={(e) => trocarComposicao(i, e.target.value)}
                    className={`${input} mb-2`}
                    aria-label="Composição"
                  >
                    {prod.variantes.map((v) => (
                      <option key={v.composicao} value={v.composicao}>
                        {COMPOSICAO_LABEL[v.composicao]} — {brl.format(v.preco)}
                      </option>
                    ))}
                  </select>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">
                      Preço unitário (R$)
                    </span>
                    <input
                      value={it.precoUnitario}
                      onChange={(e) =>
                        setItens((a) =>
                          a.map((x, idx) =>
                            idx === i ? { ...x, precoUnitario: e.target.value } : x,
                          ),
                        )
                      }
                      inputMode="decimal"
                      className={input}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-gray-600 mb-1">
                      Quantidade
                    </span>
                    <input
                      value={it.quantidade}
                      onChange={(e) =>
                        setItens((a) =>
                          a.map((x, idx) =>
                            idx === i ? { ...x, quantidade: e.target.value } : x,
                          ),
                        )
                      }
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

        <div className="grid grid-cols-2 gap-x-4 mt-4">
          <FormField label="Frete (R$)" name="frete">
            <input
              id="frete"
              value={frete}
              onChange={(e) => setFrete(e.target.value)}
              inputMode="decimal"
              className={input}
              placeholder="0"
            />
          </FormField>
          <FormField label="Desconto (R$)" name="desconto">
            <input
              id="desconto"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              inputMode="decimal"
              className={input}
              placeholder="0"
            />
          </FormField>
        </div>

        <p className="text-sm text-[#07366A]">
          Subtotal {brl.format(subtotal)} · Total{" "}
          <strong className="text-base">{brl.format(total)}</strong>
        </p>
      </fieldset>

      {/* ── 4. Pagamento ── */}
      <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
        <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          4. Pagamento
        </legend>

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
              O pedido nasce PAGO, entra no caixa para você conferir e libera a
              geração da etiqueta.
            </span>
          </span>
        </label>

        {jaPago && (
          <FormField label="Como ele pagou" name="formaPagamento">
            <select
              id="formaPagamento"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              className={input}
            >
              <option value="PIX">Pix</option>
              <option value="CARTAO">Cartão</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="BOLETO">Boleto</option>
              <option value="OUTRO">Outro</option>
            </select>
          </FormField>
        )}

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
          {isPending ? "Registrando..." : "Registrar venda"}
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
