import { CAMPO_LABEL } from "@/lib/auditoria";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const CAMPOS_DINHEIRO = new Set([
  "preco",
  "valor",
  "total",
  "subtotal",
  "frete",
  "desconto",
  "limiteValorFinanceiro",
  "taxaGateway",
  "custoFrete",
]);

function formatar(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (CAMPOS_DINHEIRO.has(campo)) {
    const n = Number(v);
    if (Number.isFinite(n)) return moeda.format(n);
  }
  const s = String(v);
  // ISO → data legível, sem virar dependência de timezone.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4);
  }
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

/** "preço: R$ 80,00 → R$ 90,00" para cada campo que mudou. */
export function MudancaAuditoria({
  antes,
  depois,
}: {
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}) {
  const campos = [
    ...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]),
  ];
  if (campos.length === 0) return null;

  return (
    <ul className="mt-1 space-y-0.5">
      {campos.map((c) => {
        const de = antes?.[c];
        const para = depois?.[c];
        const temAmbos = antes != null && depois != null && c in antes && c in depois;
        return (
          <li key={c} className="text-xs text-gray-500">
            <span className="text-gray-400">{CAMPO_LABEL[c] ?? c}:</span>{" "}
            {temAmbos ? (
              <>
                <span className="line-through text-gray-400">
                  {formatar(c, de)}
                </span>{" "}
                <span aria-hidden="true">→</span>{" "}
                <span className="text-[#07366A] font-medium">
                  {formatar(c, para)}
                </span>
              </>
            ) : (
              <span className="text-[#07366A]">
                {formatar(c, para !== undefined ? para : de)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
