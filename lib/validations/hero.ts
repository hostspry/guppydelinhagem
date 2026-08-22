import { z } from "zod";

/**
 * Slide do hero da home.
 *
 * O que é obrigatório aqui é o que o slide não consegue renderizar sem: a
 * primeira linha do título e a imagem do peixe. Todo o resto (eyebrow, segunda
 * linha, subtítulo, selo, segundo botão) é enfeite opcional — um slide de
 * promoção costuma usar poucos deles.
 */

const opcional = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v));

/** Caminho interno (/images/...) ou URL do nosso CDN. */
const urlImagem = z
  .string()
  .trim()
  .min(1, "Escolha ou informe a imagem")
  .max(500);

/** Link de botão: rota interna, âncora, URL completa ou WhatsApp. */
const urlLink = (max = 300) => z.string().trim().max(max);

export const heroSlideSchema = z.object({
  active: z.coerce.boolean().default(true),
  order: z.coerce.number().int().min(0).max(999).default(0),

  eyebrowText: opcional(60),
  eyebrowIcon: opcional(40),

  titleLine1: z.string().trim().min(2, "Escreva a primeira linha do título").max(60),
  titleLine2: opcional(60),
  subtitle: opcional(300),

  fishImageUrl: urlImagem,
  fishImageAlt: z
    .string()
    .trim()
    .min(3, "Descreva a imagem (acessibilidade e SEO)")
    .max(150),
  backgroundUrl: opcional(500),

  badgeText: opcional(40),
  badgeYear: opcional(10),
  badgeIcon: opcional(40),

  primaryCtaText: z.string().trim().min(2, "Texto do botão").max(40),
  primaryCtaUrl: urlLink().min(1, "Link do botão"),
  secondaryCtaText: opcional(40),
  secondaryCtaUrl: opcional(300),
});

export type HeroSlideInput = z.output<typeof heroSlideSchema>;
