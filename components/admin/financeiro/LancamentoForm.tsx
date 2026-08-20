"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { FormField } from "@/components/admin/FormField";
import { LeitorComprovante, type RascunhoLido } from "./LeitorComprovante";
import { criarLancamento, atualizarLancamento } from "@/actions/financeiro";
import { CANAIS_VENDA } from "@/lib/validations/financeiro";

type Categoria = { id: string; nome: string; tipo: "ENTRADA" | "SAIDA" | null };

type Campos = {
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
  valor: string;
  data: string;
  categoriaId: string;
  observacoes: string;
  aPagar: boolean;
  vencimento: string;
  canal: string;
  campanha: string;
};

export type LancamentoInicial = {
  id: string;
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
  valor: number;
  data: string;
  categoriaId: string | null;
  observacoes: string | null;
  comprovanteUrl: string | null;
  vencimento: string | null;
  pendente: boolean;
  canal: string | null;
  campanha: string | null;
};

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export function LancamentoForm({
  categorias,
  campanhas = [],
  initialData,
  hoje,
}: {
  categorias: Categoria[];
  /** Campanhas já usadas — viram sugestão no campo (evita grafia solta). */
  campanhas?: string[];
  initialData?: LancamentoInicial;
  hoje: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(
    initialData?.comprovanteUrl ?? null,
  );
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<Campos>({
    defaultValues: initialData
      ? {
          tipo: initialData.tipo,
          descricao: initialData.descricao,
          valor: initialData.valor.toFixed(2).replace(".", ","),
          data: initialData.data,
          categoriaId: initialData.categoriaId ?? "",
          observacoes: initialData.observacoes ?? "",
          aPagar: initialData.pendente,
          vencimento: initialData.vencimento ?? "",
          canal: initialData.canal ?? "",
          campanha: initialData.campanha ?? "",
        }
      : {
          tipo: "SAIDA",
          descricao: "",
          valor: "",
          data: hoje,
          categoriaId: "",
          observacoes: "",
          aPagar: false,
          vencimento: "",
          canal: "",
          campanha: "",
        },
  });

  const tipo = watch("tipo");
  const aPagar = watch("aPagar");

  // Categoria de entrada não faz sentido numa saída (e vice-versa); as sem tipo
  // servem para os dois.
  const categoriasDoTipo = categorias.filter(
    (c) => c.tipo === null || c.tipo === tipo,
  );

  function aplicarRascunho(r: RascunhoLido) {
    const d = r.dados;
    setValue("tipo", d.tipo);
    if (d.valor != null) setValue("valor", d.valor.toFixed(2).replace(".", ","));
    if (d.data) setValue("data", d.data);
    if (d.descricao) {
      // A contraparte só é anexada se ainda não estiver na descrição. Comparação
      // sem acento e sem caixa: o banco manda "CARLA DE SOUZA" e o modelo escreve
      // "Carla de Souza" — sem normalizar, o nome sairia duplicado.
      const normal = (s: string) =>
        s
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase();
      const jaTem =
        d.contraparte && normal(d.descricao).includes(normal(d.contraparte));
      setValue(
        "descricao",
        d.contraparte && !jaTem ? `${d.descricao} — ${d.contraparte}` : d.descricao,
      );
    }
    if (r.categoriaId) setValue("categoriaId", r.categoriaId);
    if (d.observacoes) setValue("observacoes", d.observacoes);
    if (r.comprovanteUrl) setComprovanteUrl(r.comprovanteUrl);
  }

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const payload = { ...data, comprovanteUrl };
      const r = initialData
        ? await atualizarLancamento(initialData.id, payload)
        : await criarLancamento(payload);

      if (!r.success) {
        toast.error(r.error);
        for (const [campo, msgs] of Object.entries(r.fieldErrors ?? {})) {
          if (msgs?.[0]) setError(campo as keyof Campos, { message: msgs[0] });
        }
        return;
      }
      toast.success(r.message ?? "Salvo.");
      router.push("/admin/financeiro");
      router.refresh();
    });
  });

  return (
    <div className="max-w-2xl">
      {!initialData && <LeitorComprovante onLido={aplicarRascunho} />}

      <form
        onSubmit={onSubmit}
        className="bg-white border border-gray-200 rounded-lg p-5"
      >
        {/* Entrada x saída é a decisão que mais muda o resto — vem primeiro e
            grande, não escondida num select. */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {(["ENTRADA", "SAIDA"] as const).map((t) => {
            const ativo = tipo === t;
            const entrada = t === "ENTRADA";
            return (
              <button
                key={t}
                type="button"
                onClick={() => setValue("tipo", t)}
                className={`px-4 py-3 rounded-md border text-sm font-medium transition-all ${
                  ativo
                    ? entrada
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-[#FF035C] bg-[#FF035C]/5 text-[#FF035C]"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {entrada ? "Entrou dinheiro" : "Saiu dinheiro"}
              </button>
            );
          })}
        </div>
        <input type="hidden" {...register("tipo")} />

        <FormField
          label="Descrição"
          name="descricao"
          required
          error={errors.descricao?.message}
        >
          <input
            id="descricao"
            {...register("descricao")}
            className={inputClass}
            placeholder={
              tipo === "ENTRADA" ? "Venda na feira de Vitória" : "Ração Alcon 500g"
            }
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <FormField
            label="Valor (R$)"
            name="valor"
            required
            error={errors.valor?.message}
          >
            <input
              id="valor"
              inputMode="decimal"
              {...register("valor")}
              className={inputClass}
              placeholder="80,00"
            />
          </FormField>

          <FormField
            label={aPagar ? "Data de referência" : "Data"}
            name="data"
            required
            error={errors.data?.message}
          >
            <input
              id="data"
              type="date"
              {...register("data")}
              className={inputClass}
            />
          </FormField>
        </div>

        <FormField label="Categoria" name="categoriaId">
          <select id="categoriaId" {...register("categoriaId")} className={inputClass}>
            <option value="">Sem categoria</option>
            {categoriasDoTipo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </FormField>

        {/* Marcação de venda: só em entrada, e nunca obrigatória. Serve para
            depois saber que canal e que campanha trouxeram dinheiro. */}
        {tipo === "ENTRADA" && (
          <div className="mb-4 rounded-md border border-gray-200 bg-gray-50/60 p-3">
            <p className="text-xs font-medium text-gray-600 mb-2">
              De onde veio essa venda{" "}
              <span className="font-normal text-gray-400">
                — opcional, ajuda a saber o que dá resultado
              </span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <FormField label="Cliente veio de" name="canal">
                <select id="canal" {...register("canal")} className={inputClass}>
                  <option value="">Não sei / não informar</option>
                  {CANAIS_VENDA.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.rotulo}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Campanha"
                name="campanha"
                error={errors.campanha?.message}
              >
                <input
                  id="campanha"
                  list="campanhas-usadas"
                  {...register("campanha")}
                  className={inputClass}
                  placeholder="Black Friday, promoção avulsa…"
                />
                <datalist id="campanhas-usadas">
                  {campanhas.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </FormField>
            </div>
          </div>
        )}

        {/* Conta a pagar: fica fora do caixa até ser quitada. */}
        <label className="flex items-start gap-2 text-sm text-gray-700 mb-4">
          <input
            type="checkbox"
            {...register("aPagar")}
            className="mt-0.5 accent-[#FF035C]"
          />
          <span>
            Ainda não pagei — é uma conta com vencimento
            <span className="block text-xs text-gray-400">
              Fica fora do saldo do mês até você dar baixa.
            </span>
          </span>
        </label>

        {aPagar && (
          <FormField
            label="Vence em"
            name="vencimento"
            required
            error={errors.vencimento?.message}
          >
            <input
              id="vencimento"
              type="date"
              {...register("vencimento")}
              className={inputClass}
            />
          </FormField>
        )}

        <FormField label="Observações" name="observacoes">
          <textarea
            id="observacoes"
            rows={2}
            {...register("observacoes")}
            className={inputClass}
          />
        </FormField>

        {comprovanteUrl && (
          <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <a
              href={comprovanteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FF035C] hover:underline"
            >
              Comprovante anexado
            </a>
            <button
              type="button"
              onClick={() => setComprovanteUrl(null)}
              className="text-gray-400 hover:text-gray-600 underline"
            >
              remover
            </button>
          </p>
        )}

        <div className="flex gap-2 mt-2">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {isPending ? "Salvando..." : initialData ? "Salvar alterações" : "Lançar"}
          </button>
          <Link
            href="/admin/financeiro"
            className="px-5 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 transition-all"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
