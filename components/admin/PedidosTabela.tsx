"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Truck, Eye, Pencil, Loader2, Check, X } from "lucide-react";
import { DeletePedidoButton } from "@/components/admin/DeletePedidoButton";
import { STATUS_PEDIDO } from "@/lib/pedido-status";
import { formatBRL } from "@/lib/utils/format";
import {
  marcarPedidosComoEnviados,
  type EnvioResultado,
} from "@/actions/pedidos";
import type { PedidoListItem } from "@/lib/queries/pedidos";
import type { TipoEntrega } from "@/lib/generated/prisma/client";

const ENTREGA_BADGE: Record<TipoEntrega, { label: string; badge: string }> = {
  ENVIO: { label: "Envio", badge: "bg-blue-50 text-blue-700" },
  RETIRADA: { label: "Retirada", badge: "bg-amber-50 text-amber-700" },
};
const TRANSPORTE_BADGE: Record<"GOLLOG" | "JADLOG", { label: string; badge: string }> = {
  GOLLOG: { label: "Gollog · aéreo", badge: "bg-sky-50 text-sky-700" },
  JADLOG: { label: "Jadlog · terrestre", badge: "bg-violet-50 text-violet-700" },
};

function placeholderCodigo(p: PedidoListItem): string {
  if (p.tipoEntrega === "RETIRADA") return "— não se aplica";
  if (p.transporte === "GOLLOG") return "AWB Gollog";
  if (p.transporte === "JADLOG") return "CTe/código Jadlog";
  return "Código de rastreio (opcional)";
}

const inputCls =
  "w-full min-h-9 px-2.5 rounded-md border border-gray-300 text-sm text-[#07366A] focus:outline-none focus:border-[#07366A] focus:ring-1 focus:ring-[#07366A]/30";

export default function PedidosTabela({
  pedidos,
}: {
  pedidos: PedidoListItem[];
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  const [modal, setModal] = useState<
    | { tipo: "single"; pedido: PedidoListItem }
    | { tipo: "lote" }
    | null
  >(null);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<Record<string, EnvioResultado>>({});

  const enviaveis = useMemo(
    () => pedidos.filter((p) => p.status === "PAGO"),
    [pedidos],
  );
  const todosSel = enviaveis.length > 0 && enviaveis.every((p) => sel.has(p.id));
  const selecionados = pedidos.filter((p) => sel.has(p.id));

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleTodos() {
    setSel(todosSel ? new Set() : new Set(enviaveis.map((p) => p.id)));
  }
  const setCodigo = (id: string, v: string) =>
    setCodigos((c) => ({ ...c, [id]: v }));

  function abrirSingle(p: PedidoListItem) {
    setResultados({});
    setModal({ tipo: "single", pedido: p });
  }
  function abrirLote() {
    setResultados({});
    setModal({ tipo: "lote" });
  }
  function fechar() {
    if (enviando) return;
    setModal(null);
    setResultados({});
  }

  async function enviar(alvos: PedidoListItem[]) {
    if (enviando || alvos.length === 0) return;
    setEnviando(true);
    try {
      const res = await marcarPedidosComoEnviados({
        envios: alvos.map((p) => ({
          pedidoId: p.id,
          codigoRastreio: codigos[p.id] ?? "",
        })),
      });
      const mapa: Record<string, EnvioResultado> = {};
      res.resultados.forEach((r) => (mapa[r.pedidoId] = r));
      setResultados(mapa);

      const ok = res.resultados.filter((r) => r.sucesso);
      const falhas = res.resultados.filter((r) => !r.sucesso);
      router.refresh();

      if (falhas.length === 0) {
        toast.success(
          ok.length === 1
            ? "Pedido marcado como enviado ✓"
            : `${ok.length} pedidos marcados como enviados ✓`,
        );
        // remove os enviados da seleção e fecha
        setSel((s) => {
          const n = new Set(s);
          ok.forEach((r) => n.delete(r.pedidoId));
          return n;
        });
        setModal(null);
      } else {
        toast.warning(
          `${ok.length} enviado(s), ${falhas.length} falhou/falharam. Veja abaixo.`,
        );
        // tira os que deram certo da seleção; mantém o modal com o resultado
        setSel((s) => {
          const n = new Set(s);
          ok.forEach((r) => n.delete(r.pedidoId));
          return n;
        });
      }
    } catch {
      toast.error("Não foi possível marcar como enviado.");
    } finally {
      setEnviando(false);
    }
  }

  const houveResultado = Object.keys(resultados).length > 0;

  return (
    <>
      {/* Barra de ação em lote */}
      {sel.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-3 rounded-lg border border-[#07366A]/20 bg-[#07366A]/5 px-4 py-2.5">
          <span className="text-sm font-medium text-[#07366A]">
            {sel.size} selecionado{sel.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={abrirLote}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#FF035C] text-white text-sm font-medium px-3 py-1.5 hover:brightness-110 transition-all"
            >
              <Truck className="w-4 h-4" aria-hidden="true" />
              Marcar como enviados
            </button>
            <button
              type="button"
              onClick={() => setSel(new Set())}
              className="text-sm text-gray-500 hover:text-[#07366A] px-2 py-1.5"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={todosSel}
                  onChange={toggleTodos}
                  disabled={enviaveis.length === 0}
                  aria-label="Selecionar todos os pagos"
                  className="w-4 h-4 accent-[#07366A] disabled:opacity-30"
                />
              </th>
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Entrega</th>
              <th className="px-4 py-3">Transportadora</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3 text-right w-32">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pedidos.map((p) => {
              const pode = p.status === "PAGO";
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={sel.has(p.id)}
                      onChange={() => toggle(p.id)}
                      disabled={!pode}
                      aria-label={`Selecionar ${p.numero}`}
                      className="w-4 h-4 accent-[#07366A] disabled:opacity-30"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-[#07366A]">
                    <Link href={`/admin/pedidos/${p.id}`} className="hover:text-[#FF035C]">
                      {p.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.clienteNome}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PEDIDO[p.status].badge}`}
                    >
                      {STATUS_PEDIDO[p.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ENTREGA_BADGE[p.tipoEntrega].badge}`}
                    >
                      {ENTREGA_BADGE[p.tipoEntrega].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.tipoEntrega === "RETIRADA" ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : p.transporte ? (
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TRANSPORTE_BADGE[p.transporte].badge}`}
                        >
                          {TRANSPORTE_BADGE[p.transporte].label}
                        </span>
                        {p.codigoRastreio && (
                          <span className="font-mono text-[11px] text-gray-400">
                            {p.codigoRastreio}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                        a definir
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[#07366A]">
                    {formatBRL(p.total)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.criadoEm.toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {pode && (
                        <button
                          type="button"
                          onClick={() => abrirSingle(p)}
                          title="Marcar como enviado"
                          aria-label={`Marcar ${p.numero} como enviado`}
                          className="text-gray-400 hover:text-[#FF035C] p-1"
                        >
                          <Truck className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      <Link
                        href={`/admin/pedidos/${p.id}`}
                        className="text-gray-400 hover:text-[#07366A] p-1"
                        aria-label={`Ver ${p.numero}`}
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      </Link>
                      <Link
                        href={`/admin/pedidos/${p.id}/editar`}
                        className="text-gray-400 hover:text-[#07366A] p-1"
                        aria-label={`Editar ${p.numero}`}
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </Link>
                      <DeletePedidoButton id={p.id} numero={p.numero} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={fechar}
        >
          <div
            className="bg-white rounded-lg p-5 w-full max-w-lg space-y-4 shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-[#07366A]">
              {modal.tipo === "single"
                ? `Marcar ${modal.pedido.numero} como enviado`
                : `Despachar ${selecionados.length} pedido${selecionados.length > 1 ? "s" : ""}`}
            </h3>

            {(modal.tipo === "single"
              ? [modal.pedido]
              : selecionados
            ).map((p) => {
              const r = resultados[p.id];
              return (
                <div
                  key={p.id}
                  className={`space-y-1 rounded-md border p-3 ${
                    r?.sucesso
                      ? "border-green-200 bg-green-50"
                      : r && !r.sucesso
                        ? "border-red-200 bg-red-50"
                        : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-mono font-medium text-[#07366A]">
                      {p.numero}
                    </span>
                    <span className="text-gray-500 truncate">{p.clienteNome}</span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {p.tipoEntrega === "RETIRADA"
                        ? "Retirada"
                        : p.transporte
                          ? TRANSPORTE_BADGE[p.transporte].label
                          : "sem transportadora"}
                    </span>
                  </div>
                  {r ? (
                    <p
                      className={`flex items-center gap-1.5 text-xs font-medium ${r.sucesso ? "text-green-700" : "text-red-700"}`}
                    >
                      {r.sucesso ? (
                        <>
                          <Check className="w-3.5 h-3.5" aria-hidden="true" /> Enviado
                        </>
                      ) : (
                        <>
                          <X className="w-3.5 h-3.5" aria-hidden="true" /> {r.erro}
                        </>
                      )}
                    </p>
                  ) : (
                    <input
                      className={inputCls}
                      value={codigos[p.id] ?? ""}
                      onChange={(e) => setCodigo(p.id, e.target.value)}
                      placeholder={placeholderCodigo(p)}
                      disabled={p.tipoEntrega === "RETIRADA"}
                    />
                  )}
                </div>
              );
            })}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={fechar}
                disabled={enviando}
                className="px-4 py-2 text-sm text-gray-600 hover:text-[#07366A] disabled:opacity-50"
              >
                {houveResultado ? "Fechar" : "Cancelar"}
              </button>
              {!houveResultado && (
                <button
                  type="button"
                  onClick={() =>
                    enviar(modal.tipo === "single" ? [modal.pedido] : selecionados)
                  }
                  disabled={enviando}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#FF035C] text-white font-medium rounded-md hover:brightness-110 disabled:opacity-50"
                >
                  {enviando && (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  )}
                  {modal.tipo === "single"
                    ? "Confirmar envio"
                    : `Confirmar ${selecionados.length} envio${selecionados.length > 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
