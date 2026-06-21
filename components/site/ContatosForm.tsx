"use client";

import { useState } from "react";

type Fields = { nome: string; telefone: string; email: string; mensagem: string };
const EMPTY: Fields = { nome: "", telefone: "", email: "", mensagem: "" };

// Formulário de contato (client) — extraído da página para que /contatos seja um
// Server Component e possa exportar metadata (OG/Twitter/canonical).
export default function ContatosForm() {
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
  );
}
