"use client";

import { useState, useTransition } from "react";
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
  SEXO_COMPOSICAO_OPCOES,
  PADRAO_COR_SUGESTOES,
  CAUDA_SUGESTOES,
  CARACTERISTICA_SUGESTOES,
  ORIGEM_SUGESTOES,
} from "@/lib/validations/product";
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

// Templates de briefing clicáveis. `pesquisar` liga o grounding na geração.
// Por enquanto só um; o array deixa fácil adicionar outros depois.
const BRIEFING_TEMPLATES: { label: string; texto: string; pesquisar: boolean }[] =
  [
    {
      label: "Pesquisar linhagem",
      pesquisar: true,
      texto:
        "Pesquise a origem, características genéticas, padrão de cor, manejo (parâmetros de água, temperatura, alimentação, cuidados) e como criar esta linhagem. Priorize fontes especializadas em inglês e da Ásia (Tailândia, Japão, China, Taiwan), incluindo criadores e lojas de referência. Traga a informação técnica e confiável em português, sem inventar — se não encontrar dado sobre algum ponto, omita em vez de supor.",
    },
  ];

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
    tipo: "FISICO" | "DIGITAL";
    estoque: number;
    categoryId: string;
    ativo: boolean;
    destaque: boolean;
    metaTitle: string | null;
    metaDescription: string | null;
    keywords: string[];
    sexoComposicao: string | null;
    padraoCor: string | null;
    cauda: string | null;
    caracteristica: string | null;
    origem: string | null;
    temperatura: string | null;
    ph: string | null;
    alimentacao: string | null;
    expectativaVida: string | null;
    videos: VideoDraft[];
  };
};

export function ProductForm({ categorias, initialData }: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!initialData);
  const [videos, setVideos] = useState<VideoDraft[]>(initialData?.videos ?? []);
  // keywords fora do react-hook-form (array gerenciado como os vídeos):
  // serializado p/ FormData no submit; a IA preenche via setKeywords.
  const [keywords, setKeywords] = useState<string[]>(
    initialData?.keywords ?? [],
  );
  // Estado da geração com IA. Loading próprio (useState, não useTransition —
  // lição da 6c: server action em transition trava o botão).
  const [briefing, setBriefing] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  // Pesquisa web (grounding) sob demanda: liga ao aplicar o template de pesquisa.
  const [pesquisarAtivo, setPesquisarAtivo] = useState(false);

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
          preco: initialData.preco,
          descontoPix: initialData.descontoPix ?? undefined,
          parcelasMax: initialData.parcelasMax,
          tipo: initialData.tipo,
          estoque: initialData.estoque,
          categoryId: initialData.categoryId,
          ativo: initialData.ativo,
          destaque: initialData.destaque,
          metaTitle: initialData.metaTitle ?? "",
          metaDescription: initialData.metaDescription ?? "",
          sexoComposicao:
            (initialData.sexoComposicao as ProductInput["sexoComposicao"]) ?? "",
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
          tipo: "FISICO",
          estoque: 0,
          categoryId: "",
          ativo: true,
          destaque: false,
          metaTitle: "",
          metaDescription: "",
          sexoComposicao: "",
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

  const primaryVideo = videos.find((v) => v.principal) ?? videos[0];
  const canGenerate = !!primaryVideo?.titulo?.trim() || !!briefing.trim();

  function applyTemplate(t: (typeof BRIEFING_TEMPLATES)[number]) {
    setBriefing(t.texto); // substitui o conteúdo; operador edita depois
    if (t.pesquisar) setPesquisarAtivo(true);
  }

  function handleBriefingChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setBriefing(v);
    // Se o operador apagou tudo, a pesquisa deixa de fazer sentido — reseta.
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
      // Rede de segurança: a IA não conta caracteres com precisão e pode estourar
      // os limites do Zod, travando o save. Truncamos na última palavra inteira
      // antes do limite ANTES de preencher os campos. (números do schema)
      const nome = truncateAtWord(d.nome, 120);
      // Descrição final = parte da linhagem (IA) + assinatura fixa da Marchezi.
      // A assinatura nunca é gerada/reescrita pela IA; é colada ao final.
      const descricao = `${d.descricao.trim()}\n\n${MARCHEZI_SIGNATURE}`;

      setValue("nome", nome, { shouldValidate: true });
      // Slug deriva do nome pelo mecanismo existente — só recalcula se o operador
      // ainda não editou o slug à mão (mesma regra do handleNomeChange).
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
      // Atributos gerais (manejo) — a IA preenche; o operador revisa. Truncados
      // por segurança (são curtos, mas garante que nunca estouram o limite).
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
    formData.append("preco", String(data.preco));
    if (data.descontoPix !== undefined)
      formData.append("descontoPix", String(data.descontoPix));
    formData.append("parcelasMax", String(data.parcelasMax));
    formData.append("tipo", data.tipo);
    formData.append("estoque", String(data.estoque));
    formData.append("categoryId", data.categoryId);
    formData.append("ativo", String(data.ativo));
    formData.append("destaque", String(data.destaque));
    if (data.metaTitle) formData.append("metaTitle", data.metaTitle);
    if (data.metaDescription)
      formData.append("metaDescription", data.metaDescription);
    formData.append("keywords", JSON.stringify(keywords));
    // Atributos (string vazia → tratada como ausente no parseForm).
    formData.append("sexoComposicao", data.sexoComposicao ?? "");
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

      // Em sucesso, a action faz redirect — só chegamos aqui em erro.
      if (result?.success === false) {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      {/* Gerar conteúdo com IA — rascunha descrição/SEO/keywords; o operador revisa */}
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

        {/* Templates clicáveis de briefing */}
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

        <FormField label="Tipo" name="tipo" required error={errors.tipo?.message}>
          <select id="tipo" {...register("tipo")} className={inputClass}>
            <option value="FISICO">Físico</option>
            <option value="DIGITAL">Digital</option>
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

        <FormField
          label="Sexo / composição"
          name="sexoComposicao"
          error={errors.sexoComposicao?.message}
        >
          <select
            id="sexoComposicao"
            {...register("sexoComposicao")}
            className={inputClass}
          >
            <option value="">—</option>
            {SEXO_COMPOSICAO_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>

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

          <FormField
            label="Origem"
            name="origem"
            error={errors.origem?.message}
          >
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

      {/* Preço & estoque */}
      <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
        <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          Preço &amp; estoque
        </legend>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <FormField
            label="Preço (R$)"
            name="preco"
            required
            error={errors.preco?.message}
          >
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

          <FormField
            label="Parcelas máx."
            name="parcelasMax"
            error={errors.parcelasMax?.message}
          >
            <input
              id="parcelasMax"
              type="number"
              min="1"
              max="12"
              {...register("parcelasMax")}
              className={inputClass}
            />
          </FormField>

          <FormField
            label="Estoque"
            name="estoque"
            required
            error={errors.estoque?.message}
          >
            <input
              id="estoque"
              type="number"
              min="0"
              {...register("estoque")}
              className={inputClass}
            />
          </FormField>
        </div>
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
