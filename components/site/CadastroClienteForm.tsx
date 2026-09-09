"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { enviarCadastroPublico } from "@/actions/cadastro-publico";
import { UFS_BR } from "@/lib/validations/cadastro-publico";

type Campo =
  | "nome"
  | "cpfCnpj"
  | "telefone"
  | "email"
  | "cep"
  | "logradouro"
  | "numero"
  | "complemento"
  | "bairro"
  | "cidade"
  | "uf";

const VAZIO: Record<Campo, string> = {
  nome: "", cpfCnpj: "", telefone: "", email: "", cep: "", logradouro: "",
  numero: "", complemento: "", bairro: "", cidade: "", uf: "",
};

const inputBase =
  "w-full min-h-11 px-3 rounded-lg border bg-white text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-all";
const inputOk = "border-border focus:border-primary focus:ring-primary/30";
const inputErr = "border-red-500 focus:border-red-500 focus:ring-red-500/30";
const labelCls = "block text-xs font-medium text-primary mb-1";

const cls = (erro?: string) => `${inputBase} ${erro ? inputErr : inputOk}`;

function Erro({ msg }: { msg?: string }) {
  return msg ? (
    <p role="alert" className="mt-1 text-xs text-red-600">
      {msg}
    </p>
  ) : null;
}

// Máscaras de digitação. Só enfeite: o que vai para o servidor são os dígitos,
// e é lá que a validação decide.
function mascaraCep(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
function mascaraTelefone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  const corte = d.length <= 10 ? 6 : 7;
  return `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`;
}
function mascaraDoc(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/**
 * Formulário do link que mandamos depois de fechar a venda no WhatsApp.
 *
 * A pessoa está no celular, terminou de pagar e quer acabar logo com isso. Por
 * isso: campo por campo na ordem de quem preenche envelope, CEP puxando o
 * endereço sozinho, e o foco pulando para o número — que é a única parte que o
 * CEP não sabe.
 */
export function CadastroClienteForm() {
  const [campos, setCampos] = useState<Record<Campo, string>>(VAZIO);
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [pronto, setPronto] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [isPending, startTransition] = useTransition();
  const numeroRef = useRef<HTMLInputElement>(null);
  const isca = useRef<HTMLInputElement>(null);

  function set(campo: Campo, valor: string) {
    setCampos((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: undefined }));
  }

  // ViaCEP. Degrada bem: CEP inexistente ou rede caída só não preenche, e a
  // pessoa digita na mão.
  async function buscarCep(valor: string) {
    const cep = valor.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = res.ok ? await res.json() : null;
      if (data && !data.erro) {
        setCampos((atual) => ({
          ...atual,
          logradouro: data.logradouro || atual.logradouro,
          bairro: data.bairro || atual.bairro,
          cidade: data.localidade || atual.cidade,
          uf: data.uf || atual.uf,
        }));
        setErros({});
        numeroRef.current?.focus();
      }
    } catch {
      // sem internet no meio do preenchimento — segue na mão
    } finally {
      setBuscandoCep(false);
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    startTransition(async () => {
      const r = await enviarCadastroPublico({
        ...campos,
        site: isca.current?.value ?? "",
      });
      if (r.ok) {
        setPronto(r.nome);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setAviso(r.error);
      const novos: Partial<Record<Campo, string>> = {};
      for (const [campo, msgs] of Object.entries(r.fieldErrors ?? {})) {
        novos[campo as Campo] = msgs?.[0];
      }
      setErros(novos);
    });
  }

  if (pronto !== null) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" aria-hidden="true" />
        <h2 className="text-xl font-bold text-primary">
          Recebi seus dados{pronto ? `, ${pronto}` : ""}!
        </h2>
        <p className="text-sm text-muted-foreground">
          Agora é com a gente: separamos os peixes e te mandamos o código de
          rastreio pelo WhatsApp assim que a caixa sair. Qualquer coisa, é só
          responder na nossa conversa.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      {aviso && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {aviso}
        </p>
      )}

      {/* ── Quem é você ── */}
      <fieldset className="rounded-xl border border-border bg-white p-4 sm:p-5">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-primary">
          Seus dados
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="nome">Nome completo</label>
            <input
              id="nome"
              value={campos.nome}
              onChange={(e) => set("nome", e.target.value)}
              className={cls(erros.nome)}
              autoComplete="name"
              placeholder="Como está no documento"
            />
            <Erro msg={erros.nome} />
          </div>

          <div>
            <label className={labelCls} htmlFor="cpfCnpj">CPF</label>
            <input
              id="cpfCnpj"
              value={campos.cpfCnpj}
              onChange={(e) => set("cpfCnpj", mascaraDoc(e.target.value))}
              className={cls(erros.cpfCnpj)}
              inputMode="numeric"
              placeholder="000.000.000-00"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              A transportadora exige na nota do envio.
            </p>
            <Erro msg={erros.cpfCnpj} />
          </div>

          <div>
            <label className={labelCls} htmlFor="telefone">WhatsApp</label>
            <input
              id="telefone"
              value={campos.telefone}
              onChange={(e) => set("telefone", mascaraTelefone(e.target.value))}
              className={cls(erros.telefone)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="(19) 99999-9999"
            />
            <Erro msg={erros.telefone} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="email">
              E-mail <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="email"
              type="email"
              value={campos.email}
              onChange={(e) => set("email", e.target.value)}
              className={cls(erros.email)}
              autoComplete="email"
              placeholder="para receber o rastreio por e-mail também"
            />
            <Erro msg={erros.email} />
          </div>
        </div>
      </fieldset>

      {/* ── Para onde vai a caixa ── */}
      <fieldset className="rounded-xl border border-border bg-white p-4 sm:p-5">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-primary">
          Endereço de entrega
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="cep">CEP</label>
            <div className="relative">
              <input
                id="cep"
                value={campos.cep}
                onChange={(e) => {
                  const v = mascaraCep(e.target.value);
                  set("cep", v);
                  if (v.replace(/\D/g, "").length === 8) buscarCep(v);
                }}
                onBlur={(e) => buscarCep(e.target.value)}
                className={cls(erros.cep)}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="00000-000"
              />
              {buscandoCep && (
                <Loader2
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              )}
            </div>
            <Erro msg={erros.cep} />
          </div>

          <div className="sm:col-span-4">
            <label className={labelCls} htmlFor="logradouro">Rua</label>
            <input
              id="logradouro"
              value={campos.logradouro}
              onChange={(e) => set("logradouro", e.target.value)}
              className={cls(erros.logradouro)}
              autoComplete="address-line1"
            />
            <Erro msg={erros.logradouro} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="numero">Número</label>
            <input
              id="numero"
              ref={numeroRef}
              value={campos.numero}
              onChange={(e) => set("numero", e.target.value)}
              className={cls(erros.numero)}
              placeholder="123 ou S/N"
            />
            <Erro msg={erros.numero} />
          </div>

          <div className="sm:col-span-4">
            <label className={labelCls} htmlFor="complemento">
              Complemento <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="complemento"
              value={campos.complemento}
              onChange={(e) => set("complemento", e.target.value)}
              className={cls(erros.complemento)}
              placeholder="apto, bloco, fundos, ponto de referência"
            />
            <Erro msg={erros.complemento} />
          </div>

          <div className="sm:col-span-3">
            <label className={labelCls} htmlFor="bairro">Bairro</label>
            <input
              id="bairro"
              value={campos.bairro}
              onChange={(e) => set("bairro", e.target.value)}
              className={cls(erros.bairro)}
            />
            <Erro msg={erros.bairro} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="cidade">Cidade</label>
            <input
              id="cidade"
              value={campos.cidade}
              onChange={(e) => set("cidade", e.target.value)}
              className={cls(erros.cidade)}
            />
            <Erro msg={erros.cidade} />
          </div>

          <div className="sm:col-span-1">
            <label className={labelCls} htmlFor="uf">UF</label>
            <select
              id="uf"
              value={campos.uf}
              onChange={(e) => set("uf", e.target.value)}
              className={`${cls(erros.uf)} appearance-none`}
            >
              <option value="">--</option>
              {UFS_BR.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
            <Erro msg={erros.uf} />
          </div>
        </div>
      </fieldset>

      {/* Campo isca: fica fora da tela e fora da navegação por teclado. */}
      <input
        ref={isca}
        type="text"
        name="site"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] w-px h-px opacity-0"
      />

      <button
        type="submit"
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 bg-secondary text-white text-sm font-semibold py-3 rounded-pill hover:brightness-110 disabled:opacity-60 transition-all"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="w-4 h-4" aria-hidden="true" />
        )}
        {isPending ? "Enviando..." : "Enviar meus dados"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Usamos seus dados só para emitir a etiqueta e te avisar do envio.
      </p>
    </form>
  );
}
