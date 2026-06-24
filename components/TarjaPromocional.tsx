import { getConfiguracaoLoja } from "@/lib/queries/config";

// Tarja promocional fina no topo do site (acima do header). Liga/desliga e texto
// vêm da config da loja (mesmo singleton do frete grátis), então o admin controla
// sem novo deploy. Cores do Brasil: verde bandeira de fundo + acento amarelo
// (listra inferior, badge do cupom e bandeirinha). Fica ISOLADA acima do header,
// então o verde-amarelo de Copa não conflita com o navy/rosa/âmbar da marca.

const FALLBACK =
  "Brasil em campo! Use o cupom HEXABRASIL e ganhe 50% OFF em todo o plantel.";

// Bandeira do Brasil simplificada em SVG inline (emoji 🇧🇷 não renderiza no
// Chrome/Windows). Elemento fixo do componente — não faz parte do texto editável.
function BandeiraBR() {
  return (
    <svg
      viewBox="0 0 28 20"
      width="26"
      height="18"
      className="inline-block shrink-0 rounded-[2px] align-middle"
      aria-hidden="true"
    >
      <rect width="28" height="20" rx="2" fill="#009739" />
      <polygon points="14,2 26,10 14,18 2,10" fill="#FEDD00" />
      <circle cx="14" cy="10" r="4.2" fill="#012169" />
    </svg>
  );
}

// Realça, no texto livre da tarja: o código "HEXABRASIL" como badge amarelo e o
// desconto "N% OFF" com peso/tamanho maior (hierarquia: bandeira → cupom → %).
function comDestaques(texto: string) {
  return texto.split(/(HEXABRASIL|\d+%\s*OFF)/i).map((parte, i) => {
    if (/^HEXABRASIL$/i.test(parte)) {
      return (
        <span
          key={i}
          className="mx-0.5 inline-block rounded bg-[#FEDD00] px-2 py-0.5 align-middle font-extrabold uppercase text-[#009739]"
        >
          {parte}
        </span>
      );
    }
    if (/^\d+%\s*OFF$/i.test(parte)) {
      return (
        <span key={i} className="text-base font-extrabold sm:text-lg">
          {parte}
        </span>
      );
    }
    return <span key={i}>{parte}</span>;
  });
}

export default async function TarjaPromocional() {
  const { tarjaAtiva, tarjaTexto } = await getConfiguracaoLoja();
  if (!tarjaAtiva) return null;

  const texto = tarjaTexto && tarjaTexto.trim() ? tarjaTexto.trim() : FALLBACK;

  return (
    <div
      role="region"
      aria-label="Aviso promocional"
      className="w-full bg-[#009739] text-white border-b-4 border-[#FEDD00]"
    >
      <p className="mx-auto max-w-[1200px] px-4 py-2 text-center text-xs font-bold leading-snug sm:text-sm">
        <BandeiraBR />
        <span className="ml-2 align-middle">{comDestaques(texto)}</span>
      </p>
    </div>
  );
}
