import Link from "next/link";
import { Plus } from "lucide-react";
import { listProducts, type ProdutoOrdem } from "@/lib/queries/products";
import { listCategories } from "@/lib/queries/categories";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProdutosLista } from "@/components/admin/ProdutosLista";

const ORDENS = new Set<ProdutoOrdem>([
  "recentes",
  "preco-asc",
  "preco-desc",
  "estoque-asc",
  "estoque-desc",
]);

// Aplica o modo Mini/Gigante salvo ANTES do paint (evita flash). Roda no parse,
// quando o container #admin-produtos-lista já está no DOM (script vem depois dele).
const VIEW_INIT = `(function(){try{var v=localStorage.getItem('admin:produtos:view');var el=document.getElementById('admin-produtos-lista');if(el&&(v==='gigante'||v==='mini'))el.setAttribute('data-view',v);}catch(e){}})();`;

type Props = {
  searchParams: Promise<{ q?: string; categoria?: string; ordem?: string }>;
};

export default async function ProdutosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const categoria =
    typeof sp.categoria === "string" && sp.categoria ? sp.categoria : "todos";
  const ordem: ProdutoOrdem =
    typeof sp.ordem === "string" && ORDENS.has(sp.ordem as ProdutoOrdem)
      ? (sp.ordem as ProdutoOrdem)
      : "recentes";

  const [produtos, categoriasRaw] = await Promise.all([
    listProducts({ q, categoriaSlug: categoria, ordem }),
    listCategories(),
  ]);
  const categorias = categoriasRaw.map((c) => ({
    id: c.id,
    nome: c.nome,
    slug: c.slug,
    count: c._count.produtos,
  }));

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Cadastro de peixes e itens da loja."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Produtos" }]}
        action={
          <Link
            href="/admin/produtos/novo"
            className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Novo produto
          </Link>
        }
      />

      <ProdutosLista
        produtos={produtos}
        categorias={categorias}
        q={q}
        categoria={categoria}
        ordem={ordem}
      />
      <script dangerouslySetInnerHTML={{ __html: VIEW_INIT }} />
    </div>
  );
}
