"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, SlidersHorizontal } from "lucide-react";
import ProductCardSimple from "./ProductCardSimple";
import { loadMoreLojaProducts } from "@/actions/loja";
import type {
  PublicProductCard,
  LojaOrdenacao,
} from "@/lib/queries/products";

type Categoria = { slug: string; nome: string };

type Props = {
  initialItems: PublicProductCard[];
  total: number;
  categorias: Categoria[];
  busca: string;
  categoria: string; // slug ou "todos"
  ordem: LojaOrdenacao;
};

const ORDENS: { value: LojaOrdenacao; label: string }[] = [
  { value: "recentes", label: "Mais recentes" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
];

export default function LojaListing({
  initialItems,
  total,
  categorias,
  busca,
  categoria,
  ordem,
}: Props) {
  const router = useRouter();
  const [navegando, startNav] = useTransition();

  // Lista acumulada: parte do lote SSR e cresce com "carregar mais". Reseta
  // sempre que o servidor devolve um novo primeiro lote (mudança de filtro) —
  // ajuste de estado em render (padrão React), guardando o prop anterior.
  const [items, setItems] = useState(initialItems);
  const [carregando, setCarregando] = useState(false);
  const [lote0, setLote0] = useState(initialItems);
  if (lote0 !== initialItems) {
    setLote0(initialItems);
    setItems(initialItems);
  }

  // Texto da busca controlado aqui (foco preservado entre navegações) e
  // empurrado para a URL com debounce.
  const [buscaInput, setBuscaInput] = useState(busca);

  // A vitrine é a própria home: filtros vivem em "/" (estado na URL).
  function buildUrl(overrides: Partial<{ busca: string; categoria: string; ordem: string }>) {
    const next = { busca, categoria, ordem, ...overrides };
    const params = new URLSearchParams();
    if (next.busca.trim()) params.set("busca", next.busca.trim());
    if (next.categoria && next.categoria !== "todos")
      params.set("categoria", next.categoria);
    if (next.ordem && next.ordem !== "recentes") params.set("ordem", next.ordem);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  function navegar(url: string) {
    startNav(() => router.replace(url, { scroll: false }));
  }

  // Debounce da busca: só navega quando o texto diverge do que está na URL.
  useEffect(() => {
    if (buscaInput.trim() === busca) return;
    const t = setTimeout(() => navegar(buildUrl({ busca: buscaInput })), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaInput, busca]);

  const filtrosAtivos = busca.trim() !== "" || categoria !== "todos";

  function limparFiltros() {
    setBuscaInput("");
    navegar("/");
  }

  async function carregarMais() {
    setCarregando(true);
    try {
      const mais = await loadMoreLojaProducts(
        { busca, categoriaSlug: categoria, ordenacao: ordem },
        items.length,
      );
      setItems((prev) => [...prev, ...mais]);
    } finally {
      setCarregando(false);
    }
  }

  const temMais = items.length < total;

  return (
    <div className="container-site py-8 md:py-12 space-y-6">
      {/* Cabeçalho da vitrine (h2 — o h1 da página é o do hero) */}
      <header className="space-y-1">
        <h2 className="text-primary text-3xl md:text-4xl font-bold">
          Nossa Loja
        </h2>
        <p className="text-muted-foreground">
          Guppies de linhagem, escolhidos um a um. Pega o seu.
        </p>
      </header>

      {/* Toolbar: busca + ordenação */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="search"
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            placeholder="Buscar por nome ou linhagem (ex: koi, full red...)"
            aria-label="Buscar produtos"
            className="w-full h-11 pl-11 pr-4 rounded-pill bg-white border border-border text-text placeholder:text-muted-foreground focus:outline-none focus:border-primary text-sm transition-colors"
          />
        </div>

        <label className="relative shrink-0">
          <SlidersHorizontal
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <span className="sr-only">Ordenar por</span>
          <select
            value={ordem}
            onChange={(e) => navegar(buildUrl({ ordem: e.target.value }))}
            className="h-11 pl-9 pr-8 rounded-pill bg-white border border-border text-text text-sm focus:outline-none focus:border-primary cursor-pointer appearance-none"
          >
            {ORDENS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Pílulas de categoria (scroll horizontal no mobile) */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {[
          { slug: "todos", nome: "Todos" },
          { slug: "destaques", nome: "Destaques" },
          ...categorias,
        ].map((c) => {
          const ativa = categoria === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => navegar(buildUrl({ categoria: c.slug }))}
              className={`shrink-0 min-h-11 px-4 rounded-pill text-sm font-medium border transition-colors ${
                ativa
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-primary border-border hover:border-primary"
              }`}
            >
              {c.nome}
            </button>
          );
        })}
      </div>

      {/* Grade ou estado vazio */}
      {items.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-primary text-lg font-semibold">
            Nenhum peixe encontrado para sua busca
          </p>
          <p className="text-muted-foreground text-sm">
            Tente outro termo ou remova os filtros.
          </p>
          {filtrosAtivos && (
            <button
              type="button"
              onClick={limparFiltros}
              className="btn-outline mt-2"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Mostrando {items.length} de {total}{" "}
            {total === 1 ? "produto" : "produtos"}
            {navegando && (
              <Loader2
                size={14}
                className="inline-block ml-2 animate-spin align-[-2px]"
                aria-hidden="true"
              />
            )}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {items.map((p) => (
              <ProductCardSimple key={p.id} product={p} />
            ))}
          </div>

          {temMais && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={carregarMais}
                disabled={carregando}
                className="btn-outline disabled:opacity-60"
              >
                {carregando ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    Carregando...
                  </>
                ) : (
                  "Carregar mais"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
