"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";

export type Foto = { url: string; alt: string | null };

/**
 * Foto de produto com zoom.
 *
 * Dois gestos diferentes porque os dois aparelhos são diferentes:
 *
 * - No computador, a lupa segue o mouse sem precisar clicar. É o que a pessoa
 *   espera de loja e resolve o caso comum (ver a trama da tela, o encaixe)
 *   sem tirar ela da página.
 * - No celular não existe hover, então o toque abre em tela cheia, onde a
 *   pinça do próprio sistema amplia. Toque duplo dá zoom no ponto tocado, para
 *   quem está com uma mão só.
 *
 * A lupa usa transform-origin em vez de uma segunda imagem ampliada: a mesma
 * imagem já baixada serve, sem requisição extra nem pulo de layout.
 */
export function ZoomableImage({
  fotos,
  indice,
  onIndice,
  nome,
  className,
}: {
  fotos: Foto[];
  indice: number;
  onIndice: (i: number) => void;
  nome: string;
  className?: string;
}) {
  const [origem, setOrigem] = useState("50% 50%");
  const [comLupa, setComLupa] = useState(false);
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);

  const foto = fotos[indice] ?? fotos[0] ?? null;

  // Só liga a lupa em ponteiro fino (mouse). Em touch o hover "gruda" e a
  // imagem ficaria ampliada depois do toque, sem jeito óbvio de voltar.
  const [temMouse, setTemMouse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const aplicar = () => setTemMouse(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);

  function moverLupa(e: React.MouseEvent<HTMLDivElement>) {
    if (!temMouse) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setOrigem(`${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`);
  }

  if (!foto) return null;

  return (
    <>
      <div
        ref={caixaRef}
        className={`relative overflow-hidden bg-muted ${className ?? ""}`}
        onMouseEnter={() => temMouse && setComLupa(true)}
        onMouseLeave={() => setComLupa(false)}
        onMouseMove={moverLupa}
      >
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label={`Ampliar foto de ${nome}`}
          className="absolute inset-0 z-10 cursor-zoom-in"
        />
        <Image
          src={foto.url}
          alt={foto.alt || nome}
          fill
          sizes="(max-width: 1024px) 100vw, 40vw"
          priority
          className="object-cover transition-transform duration-150 ease-out"
          style={{
            transform: comLupa ? "scale(2.2)" : "scale(1)",
            transformOrigin: origem,
          }}
        />

        {/* Dica de zoom. No mouse a lupa some quando já está ampliando. */}
        {!comLupa && (
          <span className="pointer-events-none absolute bottom-2 right-2 z-20 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white">
            <ZoomIn size={12} aria-hidden="true" />
            {temMouse ? "passe o mouse" : "toque para ampliar"}
          </span>
        )}
      </div>

      {aberto && (
        <Lightbox
          fotos={fotos}
          indice={indice}
          onIndice={onIndice}
          nome={nome}
          onFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

/**
 * Tela cheia. A pinça é a nativa do navegador (touch-action: pinch-zoom); o
 * toque duplo dá 2,5x no ponto tocado, que é o gesto de quem está com uma mão
 * só segurando o celular.
 */
function Lightbox({
  fotos,
  indice,
  onIndice,
  nome,
  onFechar,
}: {
  fotos: Foto[];
  indice: number;
  onIndice: (i: number) => void;
  nome: string;
  onFechar: () => void;
}) {
  const [escala, setEscala] = useState(1);
  const [origem, setOrigem] = useState("50% 50%");
  const foto = fotos[indice] ?? fotos[0];
  const varias = fotos.length > 1;

  const irPara = useCallback(
    (delta: number) => {
      setEscala(1);
      onIndice((indice + delta + fotos.length) % fotos.length);
    },
    [indice, fotos.length, onIndice],
  );

  // Teclado: Esc fecha, setas trocam de foto.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
      if (varias && e.key === "ArrowRight") irPara(1);
      if (varias && e.key === "ArrowLeft") irPara(-1);
    }
    window.addEventListener("keydown", tecla);
    // Trava a rolagem do fundo enquanto a foto está aberta.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
    };
  }, [onFechar, irPara, varias]);

  function duploToque(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setOrigem(`${x}% ${y}%`);
    setEscala((v) => (v > 1 ? 1 : 2.5));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto de ${nome} ampliada`}
      className="fixed inset-0 z-[100] bg-black/92 flex items-center justify-center"
      onClick={onFechar}
    >
      <button
        type="button"
        onClick={onFechar}
        aria-label="Fechar"
        className="absolute top-3 right-3 z-20 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 transition-colors"
      >
        <X size={20} aria-hidden="true" />
      </button>

      {varias && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              irPara(-1);
            }}
            aria-label="Foto anterior"
            className="absolute left-2 z-20 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 transition-colors"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              irPara(1);
            }}
            aria-label="Próxima foto"
            className="absolute right-2 z-20 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 transition-colors"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </>
      )}

      {/* touch-action pinch-zoom entrega a pinça nativa; o clique/toque duplo
          cobre quem está com uma mão só. stopPropagation para o clique na foto
          não fechar junto. */}
      <div
        className="relative w-full h-full max-w-5xl max-h-[88vh] m-4 overflow-hidden"
        style={{ touchAction: "pinch-zoom" }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={duploToque}
      >
        <Image
          src={foto.url}
          alt={foto.alt || nome}
          fill
          sizes="100vw"
          className="object-contain transition-transform duration-200 ease-out"
          style={{ transform: `scale(${escala})`, transformOrigin: origem }}
        />
      </div>

      <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/70">
        {varias ? `${indice + 1} de ${fotos.length} · ` : ""}
        pinça ou toque duplo para ampliar · toque fora para fechar
      </p>
    </div>
  );
}
