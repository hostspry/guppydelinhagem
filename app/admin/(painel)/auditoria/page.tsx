import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { MudancaAuditoria } from "@/components/admin/MudancaAuditoria";
import {
  areasComRegistro,
  listarAuditoria,
  membrosComRegistro,
} from "@/lib/queries/auditoria";

const dataHoraBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const AREA_LABEL: Record<string, string> = {
  produto: "Produtos",
  categoria: "Categorias",
  cupom: "Cupons",
  cliente: "Clientes",
  pedido: "Pedidos",
  financeiro: "Financeiro",
  equipe: "Equipe",
  config: "Configurações",
  conta: "Conta",
};

const AREA_COR: Record<string, string> = {
  produto: "bg-blue-100 text-blue-700",
  categoria: "bg-blue-100 text-blue-700",
  cupom: "bg-violet-100 text-violet-700",
  cliente: "bg-teal-100 text-teal-700",
  pedido: "bg-amber-100 text-amber-800",
  financeiro: "bg-green-100 text-green-700",
  equipe: "bg-rose-100 text-rose-700",
  config: "bg-gray-100 text-gray-600",
  conta: "bg-gray-100 text-gray-600",
};

function LinkFiltro({
  base,
  ativo,
  children,
}: {
  base: string;
  ativo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={base}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
        ativo
          ? "bg-[#07366A] text-white border-[#07366A]"
          : "border-gray-200 text-gray-600 hover:border-gray-300"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ membro?: string; area?: string; q?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const pagina = Number(sp.p) > 0 ? Number(sp.p) : 1;

  const [dados, membros, areas] = await Promise.all([
    listarAuditoria({
      membroId: sp.membro,
      area: sp.area,
      busca: sp.q,
      pagina,
    }),
    membrosComRegistro(),
    areasComRegistro(),
  ]);

  const query = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { membro: sp.membro, area: sp.area, q: sp.q, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/auditoria?${s}` : "/admin/auditoria";
  };

  return (
    <div>
      <PageHeader
        title="Histórico da equipe"
        description="Cada alteração feita no painel: quem fez, quando, de onde e o que mudou."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Histórico" }]}
      />

      <div className="flex flex-wrap gap-1.5 mb-3">
        <LinkFiltro base={query({ membro: undefined })} ativo={!sp.membro}>
          Todo mundo
        </LinkFiltro>
        {membros.map((m) => (
          <LinkFiltro
            key={m.id}
            base={query({ membro: m.id })}
            ativo={sp.membro === m.id}
          >
            {m.nome}
          </LinkFiltro>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <LinkFiltro base={query({ area: undefined })} ativo={!sp.area}>
          Todas as áreas
        </LinkFiltro>
        {areas.map((a) => (
          <LinkFiltro key={a} base={query({ area: a })} ativo={sp.area === a}>
            {AREA_LABEL[a] ?? a}
          </LinkFiltro>
        ))}
      </div>

      <form action="/admin/auditoria" className="mb-4 flex gap-2 max-w-md">
        {sp.membro && <input type="hidden" name="membro" value={sp.membro} />}
        {sp.area && <input type="hidden" name="area" value={sp.area} />}
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Buscar por descrição ou pessoa"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
        />
        <button
          type="submit"
          className="px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-md hover:border-gray-400"
        >
          Buscar
        </button>
      </form>

      {dados.itens.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          Nenhum registro ainda. A partir de agora, tudo que a equipe fizer no
          painel aparece aqui.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {dados.itens.map((i) => (
            <div key={i.id} className="p-4 flex gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      AREA_COR[i.area] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {AREA_LABEL[i.area] ?? i.area}
                  </span>
                  <span className="text-sm text-[#07366A]">{i.descricao}</span>
                </div>

                <MudancaAuditoria antes={i.antes} depois={i.depois} />

                <div className="text-xs text-gray-400 mt-1">
                  {i.userNome}
                  <span className="text-gray-300"> · {i.userPapel}</span>
                  {i.ip && <span className="text-gray-300"> · {i.ip}</span>}
                  {i.entidade === "Order" && i.entidadeId && (
                    <>
                      {" · "}
                      <Link
                        href={`/admin/pedidos/${i.entidadeId}`}
                        className="hover:text-[#FF035C]"
                      >
                        ver pedido
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-400 whitespace-nowrap">
                {dataHoraBR.format(i.ocorridoEm)}
              </div>
            </div>
          ))}
        </div>
      )}

      {dados.paginas > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">
            {dados.total} registro(s) · página {dados.pagina} de {dados.paginas}
          </span>
          <div className="flex gap-2">
            {dados.pagina > 1 && (
              <Link
                href={query({ p: String(dados.pagina - 1) })}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:border-gray-400"
              >
                Anterior
              </Link>
            )}
            {dados.pagina < dados.paginas && (
              <Link
                href={query({ p: String(dados.pagina + 1) })}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:border-gray-400"
              >
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
