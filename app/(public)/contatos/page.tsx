import type { Metadata } from "next";
import { Mail } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
import CtaWhatsapp from "@/components/site/CtaWhatsapp";
import ContatosForm from "@/components/site/ContatosForm";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WHATSAPP_URL, WHATSAPP_DISPLAY } from "@/lib/constants";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Contato | Fale com a Marchezi Guppy Farm",
  description:
    "Fale com a Marchezi Guppy Farm: tire dúvidas sobre guppies de linhagem, disponibilidade e envio. Atendimento por WhatsApp e e-mail.",
  path: "/contatos",
});

export default function ContatosPage() {
  return (
    <>
      <PageBanner title="Contatos" />

      <section className="bg-white py-20">
        <div className="container-site">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            {/* Coluna esquerda — dados */}
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center">
                  <Mail size={28} className="text-accent" />
                </div>
                <h3 className="text-secondary text-2xl font-semibold">Dúvidas?</h3>
                <p className="text-text font-light leading-relaxed max-w-sm">
                  Tem alguma dúvida ou quer escolher o seu primeiro guppy? Chama a
                  gente, a gente responde.
                </p>
              </div>

              <div className="space-y-4">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 group"
                >
                  <div className="w-11 h-11 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0 group-hover:bg-green-600 transition-colors">
                    <WhatsAppIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-light">WhatsApp</p>
                    <p className="text-primary font-medium group-hover:text-accent transition-colors">
                      {WHATSAPP_DISPLAY}
                    </p>
                  </div>
                </a>

                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <Mail size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-light">E-mail</p>
                    <p className="text-primary font-medium">
                      contato@guppydelinhagem.com.br
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna direita — formulário (client) */}
            <ContatosForm />
          </div>
        </div>
      </section>

      <CtaWhatsapp />
    </>
  );
}
