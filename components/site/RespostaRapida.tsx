// Box "resposta rápida" (AEO/GEO): pergunta em negrito + resposta objetiva, num
// bloco destacado com os tokens da marca (borda rosa + fundo tênue). Usado 3x na
// página /conheca-os-guppy. Server component puro.
export default function RespostaRapida({
  titulo,
  texto,
}: {
  titulo: string;
  texto: string;
}) {
  return (
    <div className="rounded-2xl border-l-4 border-secondary bg-secondary/5 p-5 sm:p-6">
      <p className="font-bold text-primary mb-1.5">{titulo}</p>
      <p className="text-text font-light leading-relaxed">{texto}</p>
    </div>
  );
}
