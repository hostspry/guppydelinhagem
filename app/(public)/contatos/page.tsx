"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
import CtaWhatsapp from "@/components/site/CtaWhatsapp";

function IconWhatsApp({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

type Fields = { nome: string; telefone: string; email: string; mensagem: string };
const EMPTY: Fields = { nome: "", telefone: "", email: "", mensagem: "" };

export default function ContatosPage() {
  const [form, setForm] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Fields>>({});
  const [success, setSuccess] = useState(false);

  function set(key: keyof Fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));
  }

  function validate(): boolean {
    const e: Partial<Fields> = {};
    if (!form.nome.trim()) e.nome = "Nome é obrigatório";
    if (!form.email.trim()) e.email = "E-mail é obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "E-mail inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setForm(EMPTY);
    setErrors({});
    setSuccess(true);
    setTimeout(() => setSuccess(false), 5000);
  }

  const input =
    "w-full h-11 px-4 rounded-xl border border-border bg-white text-text text-sm font-light placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

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
                  Precisa de ajuda ou está procurando seu primeiro Guppy para comprar?
                  Entre em contato agora mesmo!
                </p>
              </div>

              <div className="space-y-4">
                <a
                  href="https://wa.me/27997594173"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 group"
                >
                  <div className="w-11 h-11 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0 group-hover:bg-green-600 transition-colors">
                    <IconWhatsApp size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-light">WhatsApp</p>
                    <p className="text-primary font-medium group-hover:text-accent transition-colors">
                      (27) 99759-4173
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

            {/* Coluna direita — formulário */}
            <div className="bg-white border border-border rounded-[20px] shadow-sm p-8 space-y-5">
              <h3 className="text-primary text-xl font-semibold">Enviar Mensagem</h3>

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-xl px-4 py-3">
                  ✓ Mensagem recebida! Entraremos em contato em breve.
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">Nome *</label>
                  <input type="text" placeholder="Seu nome completo" className={input} value={form.nome} onChange={set("nome")} />
                  {errors.nome && <p className="text-red-500 text-xs">{errors.nome}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">Telefone</label>
                  <input type="text" placeholder="DDD + Número" className={input} value={form.telefone} onChange={set("telefone")} />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">E-mail *</label>
                  <input type="email" placeholder="seu@email.com" className={input} value={form.email} onChange={set("email")} />
                  {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-text">Mensagem</label>
                  <textarea
                    rows={4}
                    placeholder="Escreva a sua dúvida aqui..."
                    className="w-full px-4 py-3 rounded-xl border border-border bg-white text-text text-sm font-light placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                    value={form.mensagem}
                    onChange={set("mensagem")}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full md:w-[45%] bg-primary text-white font-semibold py-3 rounded-pill hover:bg-accent hover:text-[#302f2f] transition-all text-sm"
                >
                  Envia Dúvida
                </button>
              </form>
            </div>

          </div>
        </div>
      </section>

      <CtaWhatsapp />
    </>
  );
}
