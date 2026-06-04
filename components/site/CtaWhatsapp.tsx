import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WHATSAPP_URL, WHATSAPP_DISPLAY } from "@/lib/constants";

export default function CtaWhatsapp() {
  return (
    <section className="bg-primary py-16">
      <div className="container-site flex flex-col items-center text-center space-y-5">
        <h3 className="text-white text-2xl sm:text-3xl font-semibold max-w-xl">
          Criação especializada de guppies selecionados
        </h3>
        <p className="text-white/80 font-light text-base max-w-md">
          Com foco em saúde, padrão e genética. Aqui, cada peixe conta uma história.
        </p>
        <div className="flex items-center gap-3 text-white text-xl font-semibold">
          <WhatsAppIcon className="w-7 h-7" />
          <span>{WHATSAPP_DISPLAY}</span>
        </div>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-accent text-[#302f2f] font-semibold px-8 py-3.5 rounded-pill hover:brightness-95 transition-all text-base"
        >
          <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
          Entrar em Contato
        </a>
      </div>
    </section>
  );
}
