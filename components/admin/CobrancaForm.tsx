"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FormField } from "./FormField";
import { criarCobranca } from "@/actions/cobrancas";

type Cliente = { id: string; nome: string };

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

/**
 * Formulário da cobrança avulsa. Validação de verdade é a do servidor
 * (cobrancaSchema) — aqui só repassamos os fieldErrors que a action devolve,
 * para não manter duas cópias da regra.
 */
export function CobrancaForm({ clientes }: { clientes: Cliente[] }) {
  const [isPending, startTransition] = useTransition();
  const [erros, setErros] = useState<Record<string, string[]>>({});
  // "" = cliente novo, digitado na hora (o caso mais comum na cobrança avulsa).
  const [clienteId, setClienteId] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await criarCobranca(fd);
      // Sucesso redireciona no servidor; só chega aqui quando deu erro.
      if (r?.success === false) {
        setErros(r.fieldErrors ?? {});
        toast.error(r.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-2xl">
      {/* ── Quem vai pagar ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-[#07366A] mb-4">
          Para quem é a cobrança
        </h2>

        <FormField
          label="Cliente já cadastrado"
          name="clienteId"
          hint="Deixe em branco para cadastrar alguém novo aqui mesmo."
        >
          <select
            id="clienteId"
            name="clienteId"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className={input}
          >
            <option value="">Cliente novo…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </FormField>

        {clienteId === "" && (
          <div className="grid gap-x-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                label="Nome"
                name="clienteNome"
                required
                error={erros.clienteNome?.[0]}
              >
                <input
                  id="clienteNome"
                  name="clienteNome"
                  className={input}
                  placeholder="Nome de quem vai pagar"
                />
              </FormField>
            </div>
            <FormField
              label="E-mail"
              name="clienteEmail"
              required
              error={erros.clienteEmail?.[0]}
              hint="Obrigatório: sem e-mail o Mercado Pago recusa o cartão."
            >
              <input
                id="clienteEmail"
                name="clienteEmail"
                type="email"
                className={input}
                placeholder="cliente@email.com"
              />
            </FormField>
            <FormField
              label="WhatsApp"
              name="clienteTelefone"
              hint="Para mandar o link direto por aqui."
            >
              <input
                id="clienteTelefone"
                name="clienteTelefone"
                className={input}
                placeholder="27 99999-9999"
              />
            </FormField>
          </div>
        )}

        <FormField
          label="CPF ou CNPJ de quem vai pagar"
          name="clienteCpf"
          error={erros.clienteCpf?.[0]}
          hint="Peça ao cliente. É o que mais ajuda o cartão a passar — sem CPF o antifraude do Mercado Pago costuma recusar. Se o cadastro já tiver, pode deixar em branco."
        >
          <input
            id="clienteCpf"
            name="clienteCpf"
            inputMode="numeric"
            className={input}
            placeholder="000.000.000-00"
          />
        </FormField>
      </div>

      {/* ── O que está sendo cobrado ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-[#07366A] mb-4">
          O que está sendo cobrado
        </h2>

        <FormField
          label="Descrição"
          name="descricao"
          required
          error={erros.descricao?.[0]}
          hint="É o que o cliente lê na tela de pagamento."
        >
          <input
            id="descricao"
            name="descricao"
            className={input}
            placeholder="Ex: 2 casais de guppy koi + caixa de transporte"
          />
        </FormField>

        <div className="grid gap-x-4 sm:grid-cols-3">
          <FormField
            label="Valor (R$)"
            name="valor"
            required
            error={erros.valor?.[0]}
          >
            <input
              id="valor"
              name="valor"
              inputMode="decimal"
              className={input}
              placeholder="150,00"
            />
          </FormField>

          <FormField
            label="Link vale por (dias)"
            name="validadeDias"
            error={erros.validadeDias?.[0]}
          >
            <input
              id="validadeDias"
              name="validadeDias"
              type="number"
              min={1}
              max={90}
              defaultValue={7}
              className={input}
            />
          </FormField>

          <FormField
            label="Parcelas até"
            name="maxParcelas"
            error={erros.maxParcelas?.[0]}
            hint="No cartão."
          >
            <select
              id="maxParcelas"
              name="maxParcelas"
              defaultValue="12"
              className={input}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField
          label="Observações"
          name="observacoes"
          hint="Anotação interna. O cliente não vê."
        >
          <textarea
            id="observacoes"
            name="observacoes"
            rows={2}
            className={input}
          />
        </FormField>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#FF035C] text-white text-sm font-medium px-5 py-2 rounded-md hover:brightness-110 transition-all disabled:opacity-60"
        >
          {isPending ? "Gerando…" : "Gerar link de pagamento"}
        </button>
        <Link
          href="/admin/cobrancas"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
