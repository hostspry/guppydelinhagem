import { getConfiguracaoLoja } from "@/lib/queries/config";

// Tarja promocional fina no topo do site (acima do header). Liga/desliga e texto
// vêm da config da loja (mesmo singleton do frete grátis), então o admin controla
// sem novo deploy. Cores do Brasil: verde bandeira de fundo + acento amarelo
// (listra inferior e o código do cupom). Fica ISOLADA acima do header, então o
// verde-amarelo de Copa não conflita com o navy/rosa/âmbar da marca.

const FALLBACK =
  "🇧🇷 Brasil em campo! Use o cupom HEXABRASIL e ganhe 50% OFF em todo o plantel.";

// Realça cada ocorrência de "HEXABRASIL" no texto, em amarelo bandeira, para o
// código saltar aos olhos (texto da tarja é livre, editável pelo admin).
function comCodigoRealcado(texto: string) {
  return texto.split(/(HEXABRASIL)/i).map((parte, i) =>
    /^HEXABRASIL$/i.test(parte) ? (
      <span
        key={i}
        className="font-extrabold text-[#FEDD00] underline underline-offset-2"
      >
        {parte}
      </span>
    ) : (
      <span key={i}>{parte}</span>
    ),
  );
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
        {comCodigoRealcado(texto)}
      </p>
    </div>
  );
}
