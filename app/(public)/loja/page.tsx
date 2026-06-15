import type { Metadata } from "next";
import {
  listProductsLoja,
  type LojaOrdenacao,
} from "@/lib/queries/products";
import { listCategories } from "@/lib/queries/categories";
import LojaListing from "@/components/product/LojaListing";

export const metadata: Metadata = {
  title: "Loja — Guppy de Linhagem",
  description:
    "Guppies de linhagem selecionados à mão. Busque por nome ou linhagem (koi, full red, tuxedo…) e filtre por categoria. Criação premiada, envio para todo o Brasil.",
};

const ORDENS = new Set<LojaOrdenacao>([
  "recentes",
  "menor-preco",
  "maior-preco",
]);

type Props = {
  searchParams: Promise<{
    busca?: string;
    categoria?: string;
    ordem?: string;
  }>;
};

export default async function LojaPage({ searchParams }: Props) {
  const sp = await searchParams;
  const busca = typeof sp.busca === "string" ? sp.busca : "";
  const categoria =
    typeof sp.categoria === "string" && sp.categoria ? sp.categoria : "todos";
  const ordem: LojaOrdenacao =
    typeof sp.ordem === "string" && ORDENS.has(sp.ordem as LojaOrdenacao)
      ? (sp.ordem as LojaOrdenacao)
      : "recentes";

  const [{ items, total }, categorias] = await Promise.all([
    listProductsLoja({ busca, categoriaSlug: categoria, ordenacao: ordem }),
    listCategories(),
  ]);

  return (
    <LojaListing
      initialItems={items}
      total={total}
      categorias={categorias.map((c) => ({ slug: c.slug, nome: c.nome }))}
      busca={busca}
      categoria={categoria}
      ordem={ordem}
    />
  );
}
