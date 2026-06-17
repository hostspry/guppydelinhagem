"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Sparkles, Search } from "lucide-react";
import Link from "next/link";
import { FormField } from "./FormField";
import {
  productSchema,
  type ProductInput,
  type VideoDraft,
  TIPO_PRODUTO_OPCOES,
  PADRAO_COR_SUGESTOES,
  CAUDA_SUGESTOES,
  CARACTERISTICA_SUGESTOES,
  ORIGEM_SUGESTOES,
} from "@/lib/validations/product";
import {
  COMPOSICAO_LABEL,
  ORDEM_COMPOSICAO,
  QTD_PEIXES_PADRAO,
  COMPOSICAO_PADRAO_LIGADA,
  sugerirPrecos,
} from "@/lib/composicoes";
import type { ProductType, TipoComposicao } from "@/lib/generated/prisma/enums";
import { slugify } from "@/lib/utils/slug";
import { truncateAtWord } from "@/lib/utils/text";
import { MARCHEZI_SIGNATURE } from "@/lib/constants";
import { createProduct, updateProduct } from "@/actions/products";
import { generateContent } from "@/actions/ai";
import { ProductVideosField } from "./ProductVideosField";
import { KeywordsField } from "./KeywordsField";
import { SuggestInput } from "./SuggestInput";

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

const BRIEFING_TEMPLATES: { label: string; texto: string; pesquisar: boolean }[] =
  [
    {
      label: "Pesquisar linhagem",
      pesquisar: true,
      texto:
        "Pesquise a origem, características genéticas, padrão de cor, manejo (parâmetros de água, temperatura, alimentação, cuidados) e como criar esta linhagem. Priorize fontes especializadas em inglês e da Ásia (Tailândia, Japão, China, Taiwan), incluindo criadores e lojas de referência. Traga a informação técnica e confiável em português, sem inventar — se não encontrar dado sobre algum ponto, omita em vez de supor.",
    },
  ];

// Linha do editor de composições (estado local; campos como string p/ inputs).
type VarRow = {
  composicao: TipoComposicao;
  ativo: boolean;
  preco: string;
  estoque: string;
  qtdPeixes: string;
  rotulo: string;
};

type InitVariante = {
  composicao: TipoComposicao;
  preco: number;
  estoque: number;
  qtdPeixes: number;
  rotulo: string | null;
  ativo: boolean;
};

type ProductFormProps = {
  categorias: { id: string; nome: string }[];
  initialData?: {
    id: string;
    nome: string;
    slug: string;
    descricao: string;
    descricaoCurta: string | null;
    preco: number;
    descontoPix: number | null;
    parcelasMax: number;
    tipo: ProductType;
    estoque: number;
    categoryId: string;
    ativo: boolean;
    destaque: boolean;
    metaTitle: string | null;
    metaDescription: string | null;
    keywords: string[];
    padraoCor: string | null;
    cauda: string | null;
    caracteristica: string | null;
    origem: string | null;
    temperatura: string | null;
    ph: string | null;
    alimentacao: string | null;
    expectativaVida: string | null;
    videos: VideoDraft[];
    variantes: InitVariante[];
  };
};

export function ProductForm({ categorias, initialData }: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!initialData);
  const [videos, setVideos] = useState<VideoDraft[]>(initialData?.videos ?? []);
  const [keywords, setKeywords] = useState<string[]>(
    initialData?.keywords ?? [],
  );
  const [briefing, setBriefing] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [pesquisarAtivo, setPesquisarAtivo] = useState(false);

  // ── Composições (estado local, sincronizado ao RHF p/ validação) ──
  const [variantes, setVariantes] = useState<VarRow[]>(() => {
    const existentes = new Map(
      (initialData?.variantes ?? []).map((v) => [v.composicao, v]),
    );
    return ORDEM_COMPOSICAO.map((c) => {
      const ex = existentes.get(c);
      if (ex) {
        return {
          composicao: c,
          ativo: ex.ativo,
          preco: String(ex.preco),
          estoque: String(ex.estoque),
          qtdPeixes: String(ex.qtdPeixes),
          rotulo: ex.rotulo ?? "",
        };
      }
      return {
        composicao: c,
        ativo: c === "TRIO" ? true : COMPOSICAO_PADRAO_LIGADA[c],
        preco: "",
        estoque: "0",
        qtdPeixes: String(QTD_PEIXES_PADRAO[c]),
        rotulo: "",
      };
    });
  });
  // Preços de casal/macho/fêmea editados à mão não são sobrescritos pelo auto-fill.
  const [precoTouched, setPrecoTouched] = useState<Set<TipoComposicao>>(
    () => new Set(),
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof productSchema>, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: initialData
      ? {
          nome: initialData.nome,
          slug: initialData.slug,
          descricao: initialData.descricao,
          descricaoCurta: initialData.descricaoCurta ?? "",
          preco: initialData.tipo === "PEIXE" ? "" : initialData.preco,
          descontoPix: initialData.descontoPix ?? undefined,
          parcelasMax: initialData.parcelasMax,
          tipo: initialData.tipo,
          estoque: initialData.tipo === "PEIXE" ? "" : initialData.estoque,
          categoryId: initialData.categoryId,
          ativo: initialData.ativo,
          destaque: initialData.destaque,
          metaTitle: initialData.metaTitle ?? "",
          metaDescription: initialData.metaDescription ?? "",
          variantes: [],
          padraoCor: initialData.padraoCor ?? "",
          cauda: initialData.cauda ?? "",
          caracteristica: initialData.caracteristica ?? "",
          origem: initialData.origem ?? "",
          temperatura: initialData.temperatura ?? "",
          ph: initialData.ph ?? "",
          alimentacao: initialData.alimentacao ?? "",
          expectativaVida: initialData.expectativaVida ?? "",
        }
      : {
          nome: "",
          slug: "",
          descricao: "",
          descricaoCurta: "",
          preco: "",
          descontoPix: "",
          parcelasMax: 3,
          tipo: "PEIXE",
          estoque: "",
          categoryId: "",
          ativo: true,
          destaque: false,
          metaTitle: "",
          metaDescription: "",
          variantes: [],
          padraoCor: "",
          cauda: "",
          caracteristica: "",
          origem: "",
          temperatura: "",
          ph: "",
          alimentacao: "",
          expectativaVida: "",
        },
  });

  const tipo = watch("tipo");
  const isPeixe = tipo === "PEIXE";

  // Payload das variantes ativas (TRIO sempre é o padrão). Não-peixe → [].
  function variantPayload() {
    if (!isPeixe) return [];
    return variantes
      .filter((v) => v.ativo)
      .map((v) => ({
        composicao: v.composicao,
        preco: Number(v.preco) || 0,
        estoque: Number(v.estoque) || 0,
        qtdPeixes: Number(v.qtdPeixes) || QTD_PEIXES_PADRAO[v.composicao],
        rotulo: v.rotulo,
        padrao: v.composicao === "TRIO",
        ativo: true,
      }));
  }

  // Mantém o array do RHF em sincronia com o estado local (p/ o superRefine).
  useEffect(() => {
    setValue("variantes", variantPayload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantes, tipo]);

  function handleNomeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const novoNome = e.target.value;
    setValue("nome", novoNome, { shouldValidate: true });
    if (!slugManuallyEdited) {
      setValue("slug", slugify(novoNome), { shouldValidate: true });
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugManuallyEdited(true);
    setValue("slug", e.target.value, { shouldValidate: true });
  }

  // ── Editor de composições ──
  function setVar(comp: TipoComposicao, patch: Partial<VarRow>) {
    setVariantes((prev) =>
      prev.map((v) => (v.composicao === comp ? { ...v, ...patch } : v)),
    );
  }
  function toggleAtivo(comp: TipoComposicao) {
    if (comp === "TRIO") return; // trio é sempre presente (o padrão)
    setVar(comp, { ativo: !variantes.find((v) => v.composicao === comp)?.ativo });
  }
  function onPrecoChange(comp: TipoComposicao, value: string) {
    setVar(comp, { preco: value });
    if (comp === "TRIO") {
      const trio = Number(value);
      if (trio > 0) {
        const sug = sugerirPrecos(trio);
        // Pré-preenche casal/macho/fêmea só se o operador não editou à mão.
        setVariantes((prev) =>
          prev.map((v) => {
            if (v.composicao === "CASAL" && !precoTouched.has("CASAL"))
              return { ...v, preco: String(sug.CASAL) };
            if (v.composicao === "MACHO" && !precoTouched.has("MACHO"))
              return { ...v, preco: String(sug.MACHO) };
            if (v.composicao === "FEMEA" && !precoTouched.has("FEMEA"))
              return { ...v, preco: String(sug.FEMEA) };
            return v;
          }),
        );
      }
    } else {
      setPrecoTouched((s) => new Set(s).add(comp));
    }
  }

  const primaryVideo = videos.find((v) => v.principal) ?? videos[0];
  const canGenerate = !!primaryVideo?.titulo?.trim() || !!briefing.trim();

  function applyTemplate(t: (typeof BRIEFING_TEMPLATES)[number]) {
    setBriefing(t.texto);
    if (t.pesquisar) setPesquisarAtivo(true);
  }
  function handleBriefingChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setBriefing(v);
    if (v.trim() === "") setPesquisarAtivo(false);
  }

  async function handleGenerate() {
    if (aiGenerated) {
      const ok = window.confirm(
        "Isto vai substituir nome, descrição, descrição curta, SEO e palavras-chave. Edições manuais nesses campos serão perdidas. Continuar?",
      );
      if (!ok) return;
    }
    setAiLoading(true);
    try {
      const categoriaId = watch("categoryId");
      const categoria = categorias.find((c) => c.id === categoriaId)?.nome;
      const res = await generateContent({
        videoTitle: primaryVideo?.titulo ?? "",
        briefing,
        categoria,
        pesquisar: pesquisarAtivo,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const d = res.data;
      const nome = truncateAtWord(d.nome, 120);
      const descricao = `${d.descricao.trim()}\n\n${MARCHEZI_SIGNATURE}`;

      setValue("nome", nome, { shouldValidate: true });
      if (!slugManuallyEdited) {
        setValue("slug", slugify(nome), { shouldValidate: true });
      }
      setValue("descricao", descricao, { shouldValidate: true });
      setValue("descricaoCurta", truncateAtWord(d.descricaoCurta, 160), {
        shouldValidate: true,
      });
      setValue("metaTitle", truncateAtWord(d.metaTitle, 60), {
        shouldValidate: true,
      });
      setValue("metaDescription", truncateAtWord(d.metaDescription, 160), {
        shouldValidate: true,
      });
      setValue("temperatura", truncateAtWord(d.temperatura, 40), { shouldValidate: true });
      setValue("ph", truncateAtWord(d.ph, 40), { shouldValidate: true });
      setValue("alimentacao", truncateAtWord(d.alimentacao, 60), { shouldValidate: true });
      setValue("expectativaVida", truncateAtWord(d.expectativaVida, 40), {
        shouldValidate: true,
      });
      setKeywords(d.keywords);
      setAiGenerated(true);
      toast.success("Conteúdo gerado. Revise antes de salvar.");
    } finally {
      setAiLoading(false);
    }
  }

  const onSubmit = handleSubmit((data) => {
    const formData = new FormData();
    formData.append("nome", data.nome);
    formData.append("slug", data.slug);
    formData.append("descricao", data.descricao);
    if (data.descricaoCurta) formData.append("descricaoCurta", data.descricaoCurta);
    if (data.preco !== undefined && data.preco !== null)
      formData.append("preco", String(data.preco));
    if (data.descontoPix !== undefined)
      formData.append("descontoPix", String(data.descontoPix));
    formData.append("parcelasMax", String(data.parcelasMax));
    formData.append("tipo", data.tipo);
    if (data.estoque !== undefined && data.estoque !== null)
      formData.append("estoque", String(data.estoque));
    formData.append("categoryId", data.categoryId);
    formData.append("ativo", String(data.ativo));
    formData.append("destaque", String(data.destaque));
    if (data.metaTitle) formData.append("metaTitle", data.metaTitle);
    if (data.metaDescription)
      formData.append("metaDescription", data.metaDescription);
    formData.append("keywords", JSON.stringify(keywords));
    formData.append("variantes", JSON.stringify(variantPayload()));
    formData.append("padraoCor", data.padraoCor ?? "");
    formData.append("cauda", data.cauda ?? "");
    formData.append("caracteristica", data.caracteristica ?? "");
    formData.append("origem", data.origem ?? "");
    formData.append("temperatura", data.temperatura ?? "");
    formData.append("ph", data.ph ?? "");
    formData.append("alimentacao", data.alimentacao ?? "");
    formData.append("expectativaVida", data.expectativaVida ?? "");
    formData.append("videos", JSON.stringify(videos));

    startTransition(async () => {
      const result = initialData
        ? await updateProduct(initialData.id, formData)
        : await createProduct(formData);
      if (result?.success === false) {
        toast.error(result.error);
      }
    });
  });

  const variantesError =
    typeof errors.variantes?.message === "string"
      ? errors.variantes.message
      : undefined;

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      {/* Gerar conteúdo com IA */}
      <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
        <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          Gerar conteúdo com IA
        </legend>

        <div className="text-xs text-gray-600 mb-3">
          {primaryVideo ? (
            <p>
              A IA vai ler o vídeo primário:{" "}
              <span className="font-medium text-[#07366A]">
                {primaryVideo.titulo || "(sem título — use o briefing abaixo)"}
              </span>
            </p>
          ) : (
            <p className="text-amber-600">
              Nenhum vídeo adicionado. Você pode gerar só pelo briefing, mas o
              resultado fica mais genérico.
            </p>
          )}
        </div>

        <label
          htmlFor="ai-briefing"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Briefing <span className="text-gray-400">(opcional)</span>
        </label>

        <div className="flex flex-wrap gap-2 mb-2">
          {BRIEFING_TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => applyTemplate(t)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-[#07366A]/30 rounded-full text-xs font-medium text-[#07366A] hover:bg-[#07366A]/5 transition-all"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          id="ai-briefing"
          value={briefing}
          onChange={handleBriefingChange}
          rows={3}
          className={inputClass}
          placeholder="macho, cauda véu, linhagem importada, pais campeões, últimas unidades"
        />

        {pesquisarAtivo && (
          <p className="flex items-center gap-1.5 text-[11px] text-[#07366A] mt-1.5 font-medium">
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            Pesquisa web ativada — esta geração consulta fontes online (mais
            lenta e com custo maior).
          </p>
        )}

        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={aiLoading || !canGenerate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {aiLoading
              ? pesquisarAtivo
                ? "Pesquisando…"
                : "Gerando…"
              : aiGenerated
                ? "Gerar novamente"
                : "Gerar com IA"}
          </button>
          {aiGenerated && (
            <p className="text-[11px] text-amber-600">
              Gerado pela IA — revise antes de salvar. Pode haver imprecisões.
            </p>
          )}
        </div>
      </fieldset>

      {/* Básico */}
      <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
        <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          Básico
        </legend>

        <FormField label="Nome" name="nome" required error={errors.nome?.message}>
          <input
            id="nome"
            {...register("nome")}
            onChange={handleNomeChange}
            className={inputClass}
            placeholder="Ex: Guppy Koi Red Ear"
            autoFocus
          />
        </FormField>

        <FormField
          label="Slug"
          name="slug"
          required
          error={errors.slug?.message}
          hint="URL amigável. Gerado automaticamente do nome — pode editar."
        >
          <input
            id="slug"
            {...register("slug")}
            onChange={handleSlugChange}
            className={`${inputClass} font-mono`}
            placeholder="guppy-koi-red-ear"
          />
        </FormField>

        <FormField
          label="Categoria"
          name="categoryId"
          required
          error={errors.categoryId?.message}
        >
          <select id="categoryId" {...register("categoryId")} className={inputClass}>
            <option value="">Selecione…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Tipo"
          name="tipo"
          required
          error={errors.tipo?.message}
          hint="Peixe usa composições (trio/casal/…). Os demais usam preço e estoque do produto."
        >
          <select id="tipo" {...register("tipo")} className={inputClass}>
            {TIPO_PRODUTO_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Descrição"
          name="descricao"
          required
          error={errors.descricao?.message}
        >
          <textarea
            id="descricao"
            {...register("descricao")}
            rows={4}
            className={inputClass}
            placeholder="Detalhes do peixe, linhagem, cuidados…"
          />
        </FormField>

        <FormField
          label="Descrição curta"
          name="descricaoCurta"
          error={errors.descricaoCurta?.message}
          hint="Resumo de até 160 caracteres (listagens, cards). Opcional."
        >
          <input
            id="descricaoCurta"
            {...register("descricaoCurta")}
            className={inputClass}
            placeholder="Casal premium de linhagem importada"
          />
        </FormField>
      </fieldset>

      {/* Atributos */}
      <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
        <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          Atributos
        </legend>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <FormField
            label="Padrão / cor"
            name="padraoCor"
            error={errors.padraoCor?.message}
            hint="Eixo principal de busca. Escolha uma sugestão ou digite a sua."
          >
            <SuggestInput
              id="padraoCor"
              listId="padraoCor-list"
              suggestions={PADRAO_COR_SUGESTOES}
              className={inputClass}
              placeholder="koi, full red, tuxedo…"
              {...register("padraoCor")}
            />
          </FormField>

          <FormField
            label="Cauda"
            name="cauda"
            error={errors.cauda?.message}
            hint="Formato do rabo."
          >
            <SuggestInput
              id="cauda"
              listId="cauda-list"
              suggestions={CAUDA_SUGESTOES}
              className={inputClass}
              placeholder="halfmoon, delta, roundtail…"
              {...register("cauda")}
            />
          </FormField>

          <FormField
            label="Característica"
            name="caracteristica"
            error={errors.caracteristica?.message}
            hint="Extra física (opcional)."
          >
            <SuggestInput
              id="caracteristica"
              listId="caracteristica-list"
              suggestions={CARACTERISTICA_SUGESTOES}
              className={inputClass}
              placeholder="dumbo…"
              {...register("caracteristica")}
            />
          </FormField>

          <FormField label="Origem" name="origem" error={errors.origem?.message}>
            <SuggestInput
              id="origem"
              listId="origem-list"
              suggestions={ORIGEM_SUGESTOES}
              className={inputClass}
              placeholder="nacional, asiático…"
              {...register("origem")}
            />
          </FormField>
        </div>

        <p className="text-xs text-gray-500 mt-3 mb-1">
          Manejo (preenchido pela IA ao gerar — editável):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <FormField label="Temperatura" name="temperatura" error={errors.temperatura?.message}>
            <input id="temperatura" {...register("temperatura")} className={inputClass} placeholder="22–28°C" />
          </FormField>
          <FormField label="pH" name="ph" error={errors.ph?.message}>
            <input id="ph" {...register("ph")} className={inputClass} placeholder="6.8–7.8" />
          </FormField>
          <FormField label="Alimentação" name="alimentacao" error={errors.alimentacao?.message}>
            <input id="alimentacao" {...register("alimentacao")} className={inputClass} placeholder="Onívoro" />
          </FormField>
          <FormField label="Expectativa de vida" name="expectativaVida" error={errors.expectativaVida?.message}>
            <input id="expectativaVida" {...register("expectativaVida")} className={inputClass} placeholder="2–3 anos" />
          </FormField>
        </div>
      </fieldset>

      {/* Vídeos */}
      <ProductVideosField value={videos} onChange={setVideos} />

      {/* Preço / Composições */}
      <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
        <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          {isPeixe ? "Composições & preço" : "Preço & estoque"}
        </legend>

        {isPeixe ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              O <strong>Trio</strong> é a composição padrão (pré-selecionada na
              compra). Ao digitar o preço do trio, casal/macho/fêmea são sugeridos
              (75% / R$99 / R$89) — tudo editável.
            </p>
            {variantesError && (
              <p className="text-xs text-[#FF035C]">{variantesError}</p>
            )}

            <div className="space-y-2">
              {ORDEM_COMPOSICAO.map((comp) => {
                const v = variantes.find((x) => x.composicao === comp)!;
                const isTrio = comp === "TRIO";
                const isLote = comp === "LOTE";
                return (
                  <div
                    key={comp}
                    className={`rounded-md border p-3 ${v.ativo ? "border-gray-300" : "border-gray-200 bg-gray-50"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#07366A]">
                        {COMPOSICAO_LABEL[comp]}
                        {isTrio && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-[#FF035C]">
                            padrão
                          </span>
                        )}
                      </span>
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={v.ativo}
                          disabled={isTrio}
                          onChange={() => toggleAtivo(comp)}
                          className="w-4 h-4 accent-[#FF035C] disabled:opacity-50"
                        />
                        {isTrio ? "Sempre ativo" : v.ativo ? "Ativo" : "Inativo"}
                      </label>
                    </div>

                    {v.ativo && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <label className="block">
                          <span className="block text-[10px] text-gray-400 mb-0.5">Preço (R$)</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={v.preco}
                            onChange={(e) => onPrecoChange(comp, e.target.value)}
                            className={inputClass}
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[10px] text-gray-400 mb-0.5">Estoque</span>
                          <input
                            type="number"
                            min="0"
                            value={v.estoque}
                            onChange={(e) => setVar(comp, { estoque: e.target.value })}
                            className={inputClass}
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[10px] text-gray-400 mb-0.5">Qtd peixes</span>
                          <input
                            type="number"
                            min="1"
                            value={v.qtdPeixes}
                            onChange={(e) => setVar(comp, { qtdPeixes: e.target.value })}
                            className={inputClass}
                          />
                        </label>
                        {isLote && (
                          <label className="block col-span-2 sm:col-span-1">
                            <span className="block text-[10px] text-gray-400 mb-0.5">Rótulo</span>
                            <input
                              type="text"
                              value={v.rotulo}
                              onChange={(e) => setVar(comp, { rotulo: e.target.value })}
                              className={inputClass}
                              placeholder="8 machos e 2 fêmeas"
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desconto Pix e parcelas valem para o produto (todas as composições) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 pt-1">
              <FormField
                label="Desconto Pix (%)"
                name="descontoPix"
                error={errors.descontoPix?.message}
                hint="Opcional. Aplica a todas as composições."
              >
                <input
                  id="descontoPix"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  {...register("descontoPix")}
                  className={inputClass}
                  placeholder="5"
                />
              </FormField>
              <FormField label="Parcelas máx." name="parcelasMax" error={errors.parcelasMax?.message}>
                <input
                  id="parcelasMax"
                  type="number"
                  min="1"
                  max="12"
                  {...register("parcelasMax")}
                  className={inputClass}
                />
              </FormField>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <FormField label="Preço (R$)" name="preco" required error={errors.preco?.message}>
              <input
                id="preco"
                type="number"
                step="0.01"
                min="0"
                {...register("preco")}
                className={inputClass}
                placeholder="49.90"
              />
            </FormField>
            <FormField
              label="Desconto Pix (%)"
              name="descontoPix"
              error={errors.descontoPix?.message}
              hint="Opcional. Deixe vazio para não aplicar."
            >
              <input
                id="descontoPix"
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register("descontoPix")}
                className={inputClass}
                placeholder="5"
              />
            </FormField>
            <FormField label="Parcelas máx." name="parcelasMax" error={errors.parcelasMax?.message}>
              <input
                id="parcelasMax"
                type="number"
                min="1"
                max="12"
                {...register("parcelasMax")}
                className={inputClass}
              />
            </FormField>
            <FormField label="Estoque" name="estoque" required error={errors.estoque?.message}>
              <input
                id="estoque"
                type="number"
                min="0"
                {...register("estoque")}
                className={inputClass}
              />
            </FormField>
          </div>
        )}
      </fieldset>

      {/* Publicação */}
      <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
        <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          Publicação
        </legend>

        <label className="flex items-start gap-2.5 mb-3 cursor-pointer">
          <input
            type="checkbox"
            {...register("ativo")}
            className="mt-0.5 w-4 h-4 accent-[#FF035C]"
          />
          <span className="text-sm text-gray-700">
            <span className="font-medium text-[#07366A]">Ativo</span> — visível na
            loja. Desmarque para ocultar sem excluir.
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            {...register("destaque")}
            className="mt-0.5 w-4 h-4 accent-[#FF035C]"
          />
          <span className="text-sm text-gray-700">
            <span className="font-medium text-[#07366A]">Destaque</span> — aparece na
            vitrine da home.
          </span>
        </label>
      </fieldset>

      {/* SEO */}
      <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
        <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          SEO
        </legend>

        <FormField
          label="Meta título"
          name="metaTitle"
          error={errors.metaTitle?.message}
          hint="Título da página nos resultados de busca (até 60 caracteres). Opcional."
        >
          <input
            id="metaTitle"
            {...register("metaTitle")}
            className={inputClass}
            placeholder="Guppy Koi Red Ear — casal premium | Guppy de Linhagem"
          />
        </FormField>

        <FormField
          label="Meta descrição"
          name="metaDescription"
          error={errors.metaDescription?.message}
          hint="Trecho exibido no Google (até 160 caracteres). Opcional."
        >
          <textarea
            id="metaDescription"
            {...register("metaDescription")}
            rows={2}
            className={inputClass}
            placeholder="Casal de Guppy Koi Red Ear de linhagem importada, pronto para reprodução…"
          />
        </FormField>

        <div className="mt-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Palavras-chave
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Termos que as pessoas buscariam. Enter ou “Adicionar” para incluir.
          </p>
          <KeywordsField value={keywords} onChange={setKeywords} />
        </div>
      </fieldset>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending
            ? "Salvando..."
            : initialData
              ? "Salvar alterações"
              : "Criar produto"}
        </button>
        <Link
          href="/admin/produtos"
          className="px-5 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 transition-all"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
