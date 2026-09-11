"use client";

import TelaDeErro from "@/components/site/TelaDeErro";

// Último recurso: erro no próprio layout raiz, quando nem o <html> do app foi
// montado. Precisa trazer html/body e não pode depender do CSS do site.
export default function ErroGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <TelaDeErro error={error} reset={reset} raiz />
      </body>
    </html>
  );
}
