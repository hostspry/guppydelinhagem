"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { ImageUp, Loader2 } from "lucide-react";
import { FormField } from "@/components/admin/FormField";
import { uploadProductImage } from "@/actions/upload";
import { criarHeroSlide, atualizarHeroSlide } from "@/actions/hero";

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export type HeroSlideInicial = {
  id?: string;
  active: boolean;
  order: number;
  eyebrowText: string;
  eyebrowIcon: string;
  titleLine1: string;
  titleLine2: string;
  subtitle: string;
  fishImageUrl: string;
  fishImageAlt: string;
  backgroundUrl: string;
  badgeText: string;
  badgeYear: string;
  badgeIcon: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  secondaryCtaText: string;
  secondaryCtaUrl: string;
};

/** Ícones do Lucide que fazem sentido no hero — evita digitar nome errado. */
const ICONES = [
  "", "Trophy", "Award", "Star", "Sparkles", "Crown", "Tag", "Percent",
  "Flame", "Heart", "Fish", "ShieldCheck", "Truck",
];

export function HeroSlideForm({ inicial }: { inicial: HeroSlideInicial }) {
  const [salvando, startSalvar] = useTransition();
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const [d, setD] = useState<HeroSlideInicial>(inicial);

  const set = <K extends keyof HeroSlideInicial>(
    campo: K,
    valor: HeroSlideInicial[K],
  ) => setD((atual) => ({ ...atual, [campo]: valor }));

  async function enviarImagem(
    e: React.ChangeEvent<HTMLInputElement>,
    campo: "fishImageUrl" | "backgroundUrl",
  ) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reenviar o mesmo arquivo
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setEnviando(true);
    try {
      const r = await uploadProductImage(fd);
      if (r.ok) {
        set(campo, r.url);
        toast.success("Imagem enviada.");
      } else toast.error(r.error);
    } finally {
      setEnviando(false);
    }
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    startSalvar(async () => {
      const r = inicial.id
        ? await atualizarHeroSlide(inicial.id, d)
        : await criarHeroSlide(d);
      // Sucesso redireciona no servidor; só chega aqui quando deu errado.
      if (r?.success === false) {
        setErros(r.fieldErrors ?? {});
        toast.error(r.error);
      }
    });
  }

  return (
    <form onSubmit={salvar} className="max-w-2xl space-y-5">
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-4">
          Texto
        </h2>

        <div className="grid gap-x-4 sm:grid-cols-[1fr_180px]">
          <FormField
            label="Chamada pequena (acima do título)"
            name="eyebrowText"
            hint="Ex.: PROMOÇÃO DA SEMANA"
          >
            <input
              id="eyebrowText"
              value={d.eyebrowText}
              onChange={(e) => set("eyebrowText", e.target.value)}
              className={input}
            />
          </FormField>
          <FormField label="Ícone da chamada" name="eyebrowIcon">
            <select
              id="eyebrowIcon"
              value={d.eyebrowIcon}
              onChange={(e) => set("eyebrowIcon", e.target.value)}
              className={input}
            >
              {ICONES.map((i) => (
                <option key={i} value={i}>
                  {i || "sem ícone"}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField
          label="Título — primeira linha"
          name="titleLine1"
          required
          error={erros.titleLine1?.[0]}
        >
          <input
            id="titleLine1"
            value={d.titleLine1}
            onChange={(e) => set("titleLine1", e.target.value)}
            className={input}
          />
        </FormField>

        <FormField
          label="Título — segunda linha"
          name="titleLine2"
          hint="Aparece destacada em rosa. Pode deixar vazio."
        >
          <input
            id="titleLine2"
            value={d.titleLine2}
            onChange={(e) => set("titleLine2", e.target.value)}
            className={input}
          />
        </FormField>

        <FormField label="Subtítulo" name="subtitle">
          <textarea
            id="subtitle"
            rows={2}
            value={d.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            className={input}
          />
        </FormField>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-4">
          Imagem
        </h2>

        <div className="flex items-start gap-4">
          {d.fishImageUrl ? (
            <div className="relative w-28 h-28 shrink-0 rounded-md border border-gray-200 bg-gray-50 overflow-hidden">
              <Image
                src={d.fishImageUrl}
                alt=""
                fill
                sizes="112px"
                className="object-contain"
              />
            </div>
          ) : (
            <div className="w-28 h-28 shrink-0 rounded-md border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
              sem imagem
            </div>
          )}

          <div className="flex-1 min-w-0">
            <FormField
              label="Imagem do peixe"
              name="fishImageUrl"
              required
              error={erros.fishImageUrl?.[0]}
              hint="PNG ou WebP com fundo transparente fica melhor."
            >
              <input
                id="fishImageUrl"
                value={d.fishImageUrl}
                onChange={(e) => set("fishImageUrl", e.target.value)}
                className={input}
                placeholder="/images/hero/peixe.webp"
              />
            </FormField>
            <label className="inline-flex items-center gap-1.5 text-sm text-gray-700 border border-gray-300 rounded-md px-3 py-1.5 cursor-pointer hover:border-gray-400">
              {enviando ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <ImageUp className="w-4 h-4" aria-hidden="true" />
              )}
              {enviando ? "Enviando…" : "Enviar imagem"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => enviarImagem(e, "fishImageUrl")}
              />
            </label>
          </div>
        </div>

        <div className="mt-4">
          <FormField
            label="Descrição da imagem"
            name="fishImageAlt"
            required
            error={erros.fishImageAlt?.[0]}
            hint="Para leitores de tela e para o Google. Ex.: Trio de guppy Japan Blue."
          >
            <input
              id="fishImageAlt"
              value={d.fishImageAlt}
              onChange={(e) => set("fishImageAlt", e.target.value)}
              className={input}
            />
          </FormField>

          <FormField
            label="Fundo do slide"
            name="backgroundUrl"
            hint="Vazio usa o fundo padrão do hero."
          >
            <input
              id="backgroundUrl"
              value={d.backgroundUrl}
              onChange={(e) => set("backgroundUrl", e.target.value)}
              className={input}
            />
          </FormField>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-4">
          Botões
        </h2>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormField
            label="Botão principal"
            name="primaryCtaText"
            required
            error={erros.primaryCtaText?.[0]}
          >
            <input
              id="primaryCtaText"
              value={d.primaryCtaText}
              onChange={(e) => set("primaryCtaText", e.target.value)}
              className={input}
            />
          </FormField>
          <FormField
            label="Link do botão"
            name="primaryCtaUrl"
            required
            error={erros.primaryCtaUrl?.[0]}
            hint="Ex.: /loja ou /loja/nome-do-produto"
          >
            <input
              id="primaryCtaUrl"
              value={d.primaryCtaUrl}
              onChange={(e) => set("primaryCtaUrl", e.target.value)}
              className={input}
            />
          </FormField>
          <FormField label="Botão secundário" name="secondaryCtaText">
            <input
              id="secondaryCtaText"
              value={d.secondaryCtaText}
              onChange={(e) => set("secondaryCtaText", e.target.value)}
              className={input}
            />
          </FormField>
          <FormField label="Link do secundário" name="secondaryCtaUrl">
            <input
              id="secondaryCtaUrl"
              value={d.secondaryCtaUrl}
              onChange={(e) => set("secondaryCtaUrl", e.target.value)}
              className={input}
            />
          </FormField>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-4">
          Selo (opcional)
        </h2>
        <div className="grid gap-x-4 sm:grid-cols-3">
          <FormField label="Texto do selo" name="badgeText">
            <input
              id="badgeText"
              value={d.badgeText}
              onChange={(e) => set("badgeText", e.target.value)}
              className={input}
            />
          </FormField>
          <FormField label="Ano" name="badgeYear">
            <input
              id="badgeYear"
              value={d.badgeYear}
              onChange={(e) => set("badgeYear", e.target.value)}
              className={input}
            />
          </FormField>
          <FormField label="Ícone" name="badgeIcon">
            <select
              id="badgeIcon"
              value={d.badgeIcon}
              onChange={(e) => set("badgeIcon", e.target.value)}
              className={input}
            >
              {ICONES.map((i) => (
                <option key={i} value={i}>
                  {i || "sem ícone"}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-700 mt-2">
          <input
            type="checkbox"
            checked={d.active}
            onChange={(e) => set("active", e.target.checked)}
            className="mt-0.5 accent-[#FF035C]"
          />
          <span>
            Mostrar este slide na home
            <span className="block text-xs text-gray-400">
              Desmarcado, ele fica guardado aqui sem aparecer para o cliente.
            </span>
          </span>
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="px-5 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {salvando ? "Salvando…" : inicial.id ? "Salvar alterações" : "Criar slide"}
        </button>
        <Link
          href="/admin/hero-slides"
          className="px-5 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 transition-all"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
