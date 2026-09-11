"use client";

import TelaDeErro from "@/components/site/TelaDeErro";

// Borda de erro de todas as rotas (loja e painel). Sem ela, qualquer exceção
// caía na tela padrão do Next, em inglês, sem recuperação e sem registro.
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <TelaDeErro error={error} reset={reset} />;
}
