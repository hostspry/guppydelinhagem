/**
 * A vitrine agora é a própria home: a grade de produtos fica abaixo do hero,
 * na âncora #loja. CTAs internos que apontavam para a listagem (`/loja` ou `/`)
 * passam a rolar até a grade. Links externos (WhatsApp), de produto
 * (`/loja/[slug]`) ou para outras páginas ficam intactos.
 */
export function storeAnchorHref(url: string): string {
  if (url === "/" || url === "/loja" || url.startsWith("/loja?")) {
    return "/#loja";
  }
  return url;
}
