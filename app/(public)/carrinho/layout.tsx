import type { ReactNode } from "react";

// O carrinho chama Server Actions, cujo id muda entre builds. Como página
// estática, ele ia para o cache da Cloudflare (s-maxage de 1 ano) e, depois de um
// deploy, a cópia velha chamava uma action que não existe mais: o carrinho perdia
// campanha e cupom e mostrava o preço cheio. A página é "use client" e não pode
// declarar isto, por isso fica neste layout.
export const dynamic = "force-dynamic";

export default function CarrinhoLayout({ children }: { children: ReactNode }) {
  return children;
}
