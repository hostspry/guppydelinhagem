"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  List,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Pencil,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { VideoThumb } from "@/components/admin/VideoThumb";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";
import { AtivoToggle, DestaqueToggle } from "@/components/admin/ProdutoToggles";
import { formatBRL } from "@/lib/utils/format";
import { COMPOSICAO_LABEL } from "@/lib/composicoes";
import type { ProdutoListItem, ProdutoOrdem } from "@/lib/queries/products";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";

type Categoria = { id: string; nome: string; slug: string; count: number };

const CHIP_CLASS: Record<TipoComposicao, string> = {
  TRIO: "bg-blue-100 text-blue-700",
  MACHO: "bg-blue-100 text-blue-700",
  CASAL: "bg-pink-100 text-pink-700",
  FEMEA: "bg-pink-100 text-pink-700",
  LOTE: "bg-amber-100 text-amber-800",
};

const VIEW_KEY = "admin:produtos:view";

// Fora do componente (regra static-components): seta direção pela ordem atual.
function SortIcon({
  campo,
  ordem,
}: {
  campo: "preco" | "estoque";
  ordem: ProdutoOrdem;
}) {
  if (ordem === `${campo}-asc`) return <ArrowUp size={13} aria-hidden="true" />;
  if (ordem === `${campo}-desc`) return <ArrowDown size={13} aria-hidden="true" />;
  return <ArrowUpDown size={13} className="text-gray-400" aria-hidden="true" />;
}

export function ProdutosLista({
  produtos,
  categorias,
  q,
  categoria,
  ordem,
}: {
  produtos: ProdutoListItem[];
  categorias: Categoria[];
  q: string;
  categoria: string;
  ordem: ProdutoOrdem;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(q);

  function buildUrl(over: Partial<{ q: string; categoria: string; ordem: string }>) {
    const next = { q, categoria, ordem, ...over };
    const p = new URLSearchParams();
    if (next.q.trim()) p.set("q", next.q.trim());
    if (next.categoria && next.categoria !== "todos") p.set("categoria", next.categoria);
    if (next.ordem && next.ordem !== "recentes") p.set("ordem", next.ordem);
    const qs = p.toString();
    return qs ? `/admin/produtos?${qs}` : "/admin/produtos";
  }
  function navegar(url: string) {
    router.replace(url, { scroll: false });
  }

  // Busca debounced (estado na URL) — não navega se igual ao que já está lá.
  useEffect(() => {
    if (busca.trim() === q) return;
    const t = setTimeout(() => navegar(buildUrl({ q: busca })), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, q]);

  // Alternador Mini/Gigante: data-view é gerenciado FORA do React (script inline
  // no parse evita flash; aqui só gravamos no clique). O "ativo" dos botões é CSS.
  function setVista(v: "mini" | "gigante") {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
    document.getElementById("admin-produtos-lista")?.setAttribute("data-view", v);
  }

  const totalGeral = categorias.reduce((s, c) => s + c.count, 0);
  const filtrosAtivos = q.trim() !== "" || categoria !== "todos";

  function sortHref(campo: "preco" | "estoque") {
    const asc = `${campo}-asc`;
    const desc = `${campo}-desc`;
    return buildUrl({ ordem: ordem === asc ? desc : asc });
  }

  return (
    <div id="admin-produtos-lista" className="produtos-lista">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou linhagem..."
            aria-label="Buscar produtos"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
          />
        </div>

        {/* Alternador de miniatura */}
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setVista("mini")}
            className="seg-mini inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
            aria-label="Miniatura pequena"
          >
            <List size={14} aria-hidden="true" /> Mini
          </button>
          <button
            type="button"
            onClick={() => setVista("gigante")}
            className="seg-gigante inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-gray-300"
            aria-label="Miniatura grande"
          >
            <ImageIcon size={14} aria-hidden="true" /> Gigante
          </button>
        </div>
      </div>

      {/* Pílulas de categoria */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {[{ slug: "todos", nome: "Todos", count: totalGeral }, ...categorias].map((c) => {
          const ativa = categoria === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => navegar(buildUrl({ categoria: c.slug }))}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                ativa
                  ? "bg-[#07366A] text-white border-[#07366A]"
                  : "bg-white text-gray-600 border-gray-300 hover:border-[#07366A]"
              }`}
            >
              {c.nome} <span className="opacity-70">({c.count})</span>
            </button>
          );
        })}
      </div>

      {produtos.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">
            {filtrosAtivos
              ? "Nenhum produto encontrado para os filtros."
              : "Nenhum produto cadastrado ainda."}
          </p>
          {filtrosAtivos ? (
            <button
              type="button"
              onClick={() => {
                setBusca("");
                navegar("/admin/produtos");
              }}
              className="text-sm text-[#FF035C] hover:underline font-medium"
            >
              Limpar filtros
            </button>
          ) : (
            <Link
              href="/admin/produtos/novo"
              className="text-sm text-[#FF035C] hover:underline font-medium"
            >
              Cadastrar primeiro produto →
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => navegar(sortHref("preco"))}
                      className="inline-flex items-center gap-1 hover:text-[#07366A] uppercase"
                    >
                      Preço <SortIcon campo="preco" ordem={ordem} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => navegar(sortHref("estoque"))}
                      className="inline-flex items-center gap-1 hover:text-[#07366A] uppercase"
                    >
                      Estoque <SortIcon campo="estoque" ordem={ordem} />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center">Ativo</th>
                  <th className="px-4 py-3 text-center">Destaque</th>
                  <th className="px-4 py-3 text-right w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {produtos.map((p) => (
                  <tr key={p.id} className="produto-linha hover:bg-gray-50 align-top">
                    <td className="px-4 py-2.5">
                      <div className="flex gap-3">
                        <div className="produto-thumb relative shrink-0 rounded bg-gray-100 overflow-hidden">
                          {p.videos[0]?.thumbnailUrl ? (
                            <VideoThumb
                              src={p.videos[0].thumbnailUrl}
                              alt=""
                              sizes="200px"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="produto-nome font-semibold text-[#07366A] leading-tight">
                            {p.nome}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {p.category.nome}
                          </p>
                          {p.variantes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {p.variantes.map((v) => (
                                <span
                                  key={v.composicao}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CHIP_CLASS[v.composicao]}`}
                                >
                                  {COMPOSICAO_LABEL[v.composicao]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                      {formatBRL(p.preco)}
                    </td>
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      {p.estoque <= 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                          Esgotado
                        </span>
                      ) : p.estoque <= 5 ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-medium tabular-nums">
                          <AlertTriangle size={13} aria-hidden="true" />
                          {p.estoque}
                        </span>
                      ) : (
                        <span className="text-gray-600 tabular-nums">{p.estoque}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <AtivoToggle id={p.id} value={p.ativo} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <DestaqueToggle id={p.id} value={p.destaque} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <a
                          href={`/loja/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={
                            p.ativo
                              ? "Ver na loja"
                              : "Inativo — não aparece na loja (pré-visualização)"
                          }
                          aria-label={
                            p.ativo
                              ? `Ver ${p.nome} na loja`
                              : `Pré-visualizar ${p.nome} (inativo)`
                          }
                          className={`p-1 ${p.ativo ? "text-gray-400 hover:text-[#07366A]" : "text-amber-400 hover:text-amber-600"}`}
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </a>
                        <Link
                          href={`/admin/produtos/${p.id}/editar`}
                          className="text-gray-400 hover:text-[#07366A] p-1"
                          aria-label={`Editar ${p.nome}`}
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </Link>
                        <DeleteProductButton
                          id={p.id}
                          nome={p.nome}
                          qtdPedidos={p._count.orderItems}
                          qtdImagens={p._count.imagens}
                          qtdVideos={p._count.videos}
                          qtdWaitlist={p._count.waitlist}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Mostrando {produtos.length} de {totalGeral} produto
            {totalGeral === 1 ? "" : "s"}.
          </p>
        </>
      )}
    </div>
  );
}
