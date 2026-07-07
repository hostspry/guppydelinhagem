// Renderiza JSON-LD em server components. Centraliza o escape anti-XSS: como
// descrições vêm do banco (geradas por IA), escapamos "<" para < e evitamos
// que um "</script>" na descrição quebre/injete no HTML.
export function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
}) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
