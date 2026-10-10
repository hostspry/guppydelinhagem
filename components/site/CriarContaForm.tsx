"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { criarConta } from "@/actions/cadastro-conta";
import { UFS_BR } from "@/lib/validations/cadastro-publico";
import { mascaraCep, mascaraDoc, mascaraTelefone } from "@/lib/mascaras";

type Campo =
  | "nome"
  | "cpfCnpj"
  | "telefone"
  | "email"
  | "senha"
  | "cep"
  | "logradouro"
  | "numero"
  | "complemento"
  | "bairro"
  | "cidade"
  | "uf";

const VAZIO: Record<Campo, string> = {
  nome: "", cpfCnpj: "", telefone: "", email: "", senha: "", cep: "", logradouro: "",
  numero: "", complemento: "", bairro: "", cidade: "", uf: "",
};

const inputBase =
  "w-full min-h-12 px-3 rounded-lg border bg-white text-base text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-all";
const cls = (erro?: string) =>
  `${inputBase} ${erro ? "border-red-500 focus:border-red-500 focus:ring-red-500/30" : "border-border focus:border-primary focus:ring-primary/30"}`;
const labelCls = "block text-sm font-medium text-primary mb-1";

function Erro({ msg }: { msg?: string }) {
  return msg ? (
    <p role="alert" className="mt-1 text-sm text-red-600">
      {msg}
    </p>
  ) : null;
}

function Etapa({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-border bg-white p-4 sm:p-5">
      <legend className="flex items-center gap-2 px-2 text-sm font-semibold text-primary">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs text-white">{n}</span>
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Cadastro de conta. Pensado para quem não lida bem com internet: uma página
 * só, três blocos numerados, letra grande, o CEP preenche a rua, e no fim já
 * entra na conta sozinho (sem pedir para digitar a senha de novo).
 */
export function CriarContaForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [campos, setCampos] = useState<Record<Campo, string>>(VAZIO);
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [jaTemConta, setJaTemConta] = useState(false);
  const [verSenha, setVerSenha] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [isPending, startTransition] = useTransition();
  const numeroRef = useRef<HTMLInputElement>(null);
  const isca = useRef<HTMLInputElement>(null);
  const loginHref = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  function set(campo: Campo, valor: string) {
    setCampos((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: undefined }));
  }

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
        numeroRef.current?.focus();
      }
    } catch {
      // sem internet no meio do preenchimento: segue na mão
    } finally {
      setBuscandoCep(false);
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    setJaTemConta(false);
    startTransition(async () => {
      const r = await criarConta({ ...campos, site: isca.current?.value ?? "" });
      if (!r.ok) {
        setAviso(r.error);
        setJaTemConta(!!r.jaTemConta);
        const novos: Partial<Record<Campo, string>> = {};
        for (const [campo, msgs] of Object.entries(r.fieldErrors ?? {})) novos[campo as Campo] = msgs?.[0];
        setErros(novos);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const login = await signIn("credentials", { email: r.email, password: campos.senha, redirect: false });
      if (login?.error) {
        router.push(loginHref);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    });
  }

  const campo = (id: Campo, rotulo: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, ajuda?: string) => (
    <div>
      <label className={labelCls} htmlFor={id}>
        {rotulo}
      </label>
      <input id={id} value={campos[id]} onChange={(e) => set(id, e.target.value)} className={cls(erros[id])} {...props} />
      {ajuda && !erros[id] && <p className="mt-1 text-xs text-muted-foreground">{ajuda}</p>}
      <Erro msg={erros[id]} />
    </div>
  );

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      {aviso && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {aviso}
          {jaTemConta && (
            <Link href={loginHref} className="mt-2 block font-semibold text-secondary underline">
              Ir para Entrar
            </Link>
          )}
        </div>
      )}

      <Etapa n={1} titulo="Seus dados">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{campo("nome", "Nome completo", { autoComplete: "name", placeholder: "Como está no documento" })}</div>
          <div>
            <label className={labelCls} htmlFor="telefone">WhatsApp</label>
            <input
              id="telefone"
              value={campos.telefone}
              onChange={(e) => set("telefone", mascaraTelefone(e.target.value))}
              className={cls(erros.telefone)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="(21) 99999-9999"
            />
            {!erros.telefone && <p className="mt-1 text-xs text-muted-foreground">Com DDD. Você vai usar ele para entrar.</p>}
            <Erro msg={erros.telefone} />
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
            {!erros.cpfCnpj && <p className="mt-1 text-xs text-muted-foreground">A transportadora exige no envio do peixe.</p>}
            <Erro msg={erros.cpfCnpj} />
          </div>
          <div className="sm:col-span-2">
            {campo("email", "E-mail", { type: "email", autoComplete: "email", inputMode: "email", placeholder: "seuemail@gmail.com" }, "Serve para recuperar a senha se você esquecer.")}
          </div>
        </div>
      </Etapa>

      <Etapa n={2} titulo="Endereço de entrega">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
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
                className={cls(erros.cep)}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="00000-000"
              />
              {buscandoCep && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
            </div>
            {!erros.cep && <p className="mt-1 text-xs text-muted-foreground">A rua aparece sozinha.</p>}
            <Erro msg={erros.cep} />
          </div>
          <div className="sm:col-span-4">{campo("logradouro", "Rua", { autoComplete: "address-line1" })}</div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="numero">Número</label>
            <input id="numero" ref={numeroRef} value={campos.numero} onChange={(e) => set("numero", e.target.value)} className={cls(erros.numero)} placeholder="123 ou S/N" />
            <Erro msg={erros.numero} />
          </div>
          <div className="sm:col-span-4">{campo("complemento", "Complemento (se tiver)", { placeholder: "apto, bloco, fundos" })}</div>
          <div className="sm:col-span-3">{campo("bairro", "Bairro")}</div>
          <div className="sm:col-span-2">{campo("cidade", "Cidade")}</div>
          <div className="sm:col-span-1">
            <label className={labelCls} htmlFor="uf">UF</label>
            <select id="uf" value={campos.uf} onChange={(e) => set("uf", e.target.value)} className={`${cls(erros.uf)} appearance-none`}>
              <option value="">--</option>
              {UFS_BR.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
            <Erro msg={erros.uf} />
          </div>
        </div>
      </Etapa>

      <Etapa n={3} titulo="Crie sua senha">
        <label className={labelCls} htmlFor="senha">Senha</label>
        <div className="relative">
          <input
            id="senha"
            type={verSenha ? "text" : "password"}
            value={campos.senha}
            onChange={(e) => set("senha", e.target.value)}
            className={`${cls(erros.senha)} pr-12`}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setVerSenha((v) => !v)}
            aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
            className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-muted-foreground hover:text-primary"
          >
            {verSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {!erros.senha && <p className="mt-1 text-xs text-muted-foreground">Pelo menos 6 letras ou números. Toque no olho para ver o que digitou.</p>}
        <Erro msg={erros.senha} />
      </Etapa>

      <input ref={isca} type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-px w-px opacity-0" />

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-secondary py-4 text-base font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <UserPlus className="h-5 w-5" aria-hidden="true" />}
        {isPending ? "Criando sua conta..." : "Criar minha conta"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href={loginHref} className="font-semibold text-secondary hover:underline">
          Entrar
        </Link>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Usamos seus dados só para os seus pedidos, envios e sorteios. Mora fora do Brasil? Entre com o Google.
      </p>
    </form>
  );
}
