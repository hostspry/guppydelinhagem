import { Check } from "lucide-react";
import type { BlocoTexto, TrechoTexto } from "@/lib/markdown";

function Trechos({ trechos }: { trechos: TrechoTexto[] }) {
  return (
    <>
      {trechos.map((t, i) =>
        t.forte ? (
          <strong key={i} className="font-semibold text-primary">
            {t.texto}
          </strong>
        ) : (
          <span key={i}>{t.texto}</span>
        ),
      )}
    </>
  );
}

/**
 * Descrição do produto já estruturada (lib/markdown): títulos viram subtítulo,
 * listas viram lista com check e o resto vira parágrafo. Nunca injeta HTML.
 */
export default function DescricaoRica({ blocos }: { blocos: BlocoTexto[] }) {
  return (
    <div className="space-y-3 text-text leading-relaxed">
      {blocos.map((b, i) => {
        if (b.tipo === "titulo") {
          return (
            <h3
              key={i}
              className="text-primary text-base font-semibold pt-1 first:pt-0"
            >
              <Trechos trechos={b.trechos} />
            </h3>
          );
        }
        if (b.tipo === "lista") {
          return (
            <ul key={i} className="space-y-1.5">
              {b.itens.map((item, j) => (
                <li key={j} className="flex items-start gap-2">
                  <Check
                    size={16}
                    className="text-green-600 shrink-0 mt-1"
                    aria-hidden="true"
                  />
                  <span>
                    <Trechos trechos={item} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            <Trechos trechos={b.trechos} />
          </p>
        );
      })}
    </div>
  );
}
