"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, MapPin, Plane, Send } from "lucide-react";
import { unidadesParaEndereco, confirmarEnvioAereo } from "@/actions/envio-aereo";
import type { UnidadeParaCliente, UnidadesParaCliente } from "@/lib/gollog/unidades";
import { UFS_BR } from "@/lib/validations/cadastro-publico";
import { mascaraCep, mascaraDoc, mascaraTelefone } from "@/lib/mascaras";

type Campos = {
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  unidadeId: string;
  outraPessoaRetira: boolean;
  recebedorNome: string;
  recebedorCpf: string;
  recebedorTelefone: string;
};
type CampoTexto = Exclude<keyof Campos, "outraPessoaRetira">;

const inputBase =
  "w-full min-h-11 px-3 rounded-lg border bg-white text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-all";
const inputOk = "border-border focus:border-primary focus:ring-primary/30";
const inputErr = "border-red-500 focus:border-red-500 focus:ring-red-500/30";
const labelCls = "block text-xs font-medium text-primary mb-1";
const cls = (erro?: string) => `${inputBase} ${erro ? inputErr : inputOk}`;
const caixa = "rounded-xl border border-border bg-white p-4 sm:p-5";
const legenda = "px-2 text-xs font-semibold uppercase tracking-wide text-primary";

const PRIMEIRAS = 4;

function Erro({ msg }: { msg?: string }) {
  return msg ? (
    <p role="alert" className="mt-1 text-xs text-red-600">
      {msg}
    </p>
  ) : null;
}

export function ConfirmacaoAereoForm({
  token,
  inicial,
  unidades: unidadesIniciais,
  fonteDistancia: fonteInicial,
  jaConfirmado,
  aeroportoEscolhido,
}: {
  token: string;
  inicial: Campos;
  unidades: UnidadeParaCliente[];
  fonteDistancia: UnidadesParaCliente["fonteDistancia"];
  jaConfirmado: boolean;
  /** A unidade inicial foi escolhida (pelo cliente ou pela loja), não sugerida. */
  aeroportoEscolhido: boolean;
}) {
  const [campos, setCampos] = useState<Campos>({
    ...inicial,
    cpfCnpj: mascaraDoc(inicial.cpfCnpj),
    telefone: mascaraTelefone(inicial.telefone),
    cep: mascaraCep(inicial.cep),
    recebedorCpf: mascaraDoc(inicial.recebedorCpf),
    recebedorTelefone: mascaraTelefone(inicial.recebedorTelefone),
  });
  const [bases, setBases] = useState(unidadesIniciais);
  const [fonte, setFonte] = useState(fonteInicial);
  const [verTodas, setVerTodas] = useState(false);
  const [erros, setErros] = useState<Partial<Record<keyof Campos, string>>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [isPending, startTransition] = useTransition();
  const numeroRef = useRef<HTMLInputElement>(null);
  const isca = useRef<HTMLInputElement>(null);
  const enderecoConsultado = useRef(`${inicial.cep.replace(/\D/g, "")}|${inicial.cidade}|${inicial.uf}`);
  // Unidade que veio só como sugestão acompanha a mudança de cidade; a que a
  // pessoa clicou (ou já tinha confirmado) fica.
  const escolhaManual = useRef(aeroportoEscolhido);

  function set(campo: CampoTexto, valor: string) {
    setCampos((a) => ({ ...a, [campo]: valor }));
    setErros((a) => ({ ...a, [campo]: undefined }));
  }

  /** Endereço mudou: a Gollog recalcula a distância das unidades pelo CEP novo. */
  async function atualizarBases(cep: string, cidade: string, uf: string) {
    const chave = `${cep.replace(/\D/g, "")}|${cidade}|${uf}`;
    if (!cidade || uf.length !== 2 || chave === enderecoConsultado.current) return;
    enderecoConsultado.current = chave;
    const r = await unidadesParaEndereco(cep, cidade, uf);
    if (!r) return;
    setBases(r.unidades);
    setFonte(r.fonteDistancia);
    // Sugestão só da cidade do cliente; sem unidade lá, fica sem marcação.
    if (!escolhaManual.current) {
      const daCidade = r.unidades.find((b) => b.naCidade);
      setCampos((a) => ({ ...a, unidadeId: daCidade?.id ?? "" }));
    }
  }

  async function buscarCep(valor: string) {
    const cep = valor.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = res.ok ? await res.json() : null;
      if (data && !data.erro) {
        setCampos((a) => ({
          ...a,
          logradouro: data.logradouro || a.logradouro,
          bairro: data.bairro || a.bairro,
          cidade: data.localidade || a.cidade,
          uf: data.uf || a.uf,
        }));
        numeroRef.current?.focus();
        void atualizarBases(cep, data.localidade, data.uf);
      }
    } catch {
      // sem rede: a pessoa completa na mão
    } finally {
      setBuscandoCep(false);
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    startTransition(async () => {
      const r = await confirmarEnvioAereo(token, {
        ...campos,
        site: isca.current?.value ?? "",
      });
      if (r.ok) {
        setPronto(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setAviso(r.error);
      const novos: Partial<Record<keyof Campos, string>> = {};
      for (const [campo, msgs] of Object.entries(r.fieldErrors ?? {})) {
        novos[campo as keyof Campos] = msgs?.[0];
      }
      setErros(novos);
    });
  }

  const escolhida = bases.find((b) => b.id === campos.unidadeId) ?? null;

  if (pronto) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" aria-hidden="true" />
        <h2 className="text-xl font-bold text-primary">Tudo confirmado!</h2>
        <p className="text-sm text-muted-foreground">
          Sua caixa vai para{" "}
          <strong className="text-primary">
            {escolhida ? `${escolhida.titulo} (${escolhida.cidade}/${escolhida.uf})` : "a unidade escolhida"}
          </strong>
          . Quando ela chegar, a Gollog manda um SMS. A retirada é em até 72 horas,
          com documento com foto. Qualquer coisa, me chame no WhatsApp.
        </p>
      </div>
    );
  }

  // Mostra primeiro as mais perto; a escolhida sempre aparece, mesmo se estiver longe.
  const visiveis = verTodas
    ? bases
    : [
        ...bases.slice(0, PRIMEIRAS),
        ...(escolhida && !bases.slice(0, PRIMEIRAS).includes(escolhida) ? [escolhida] : []),
      ];
  const maisPerto = bases[0];
  const temNaCidade = bases.some((b) => b.naCidade);

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      {jaConfirmado && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-primary">
          Você já confirmou antes. Pode corrigir e enviar de novo enquanto a caixa não sai.
        </p>
      )}
      {aviso && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {aviso}
        </p>
      )}

      {/* ── Dados do destinatário ── */}
      <fieldset className={caixa}>
        <legend className={legenda}>Seus dados</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="nome">Nome completo</label>
            <input id="nome" value={campos.nome} onChange={(e) => set("nome", e.target.value)} className={cls(erros.nome)} autoComplete="name" placeholder="Como está no documento" />
            <Erro msg={erros.nome} />
          </div>
          <div>
            <label className={labelCls} htmlFor="cpfCnpj">CPF</label>
            <input id="cpfCnpj" value={campos.cpfCnpj} onChange={(e) => set("cpfCnpj", mascaraDoc(e.target.value))} className={cls(erros.cpfCnpj)} inputMode="numeric" placeholder="000.000.000-00" />
            <p className="mt-1 text-xs text-muted-foreground">Vai no documento de envio da Gollog.</p>
            <Erro msg={erros.cpfCnpj} />
          </div>
          <div>
            <label className={labelCls} htmlFor="telefone">WhatsApp</label>
            <input id="telefone" value={campos.telefone} onChange={(e) => set("telefone", mascaraTelefone(e.target.value))} className={cls(erros.telefone)} inputMode="tel" autoComplete="tel" placeholder="(19) 99999-9999" />
            <p className="mt-1 text-xs text-muted-foreground">A Gollog avisa por SMS quando a caixa chega.</p>
            <Erro msg={erros.telefone} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="email">
              E-mail <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input id="email" type="email" value={campos.email} onChange={(e) => set("email", e.target.value)} className={cls(erros.email)} autoComplete="email" />
            <Erro msg={erros.email} />
          </div>
        </div>
      </fieldset>

      {/* ── Endereço ── */}
      <fieldset className={caixa}>
        <legend className={legenda}>Seu endereço</legend>
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
                  if (v.replace(/\D/g, "").length === 8) void buscarCep(v);
                }}
                className={cls(erros.cep)}
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="00000-000"
              />
              {buscandoCep && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" aria-hidden="true" />
              )}
            </div>
            <Erro msg={erros.cep} />
          </div>
          <div className="sm:col-span-4">
            <label className={labelCls} htmlFor="logradouro">Rua</label>
            <input id="logradouro" value={campos.logradouro} onChange={(e) => set("logradouro", e.target.value)} className={cls(erros.logradouro)} autoComplete="address-line1" />
            <Erro msg={erros.logradouro} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="numero">Número</label>
            <input id="numero" ref={numeroRef} value={campos.numero} onChange={(e) => set("numero", e.target.value)} className={cls(erros.numero)} placeholder="123 ou S/N" />
            <Erro msg={erros.numero} />
          </div>
          <div className="sm:col-span-4">
            <label className={labelCls} htmlFor="complemento">
              Complemento <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input id="complemento" value={campos.complemento} onChange={(e) => set("complemento", e.target.value)} className={cls(erros.complemento)} />
            <Erro msg={erros.complemento} />
          </div>
          <div className="sm:col-span-3">
            <label className={labelCls} htmlFor="bairro">Bairro</label>
            <input id="bairro" value={campos.bairro} onChange={(e) => set("bairro", e.target.value)} className={cls(erros.bairro)} />
            <Erro msg={erros.bairro} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="cidade">Cidade</label>
            <input
              id="cidade"
              value={campos.cidade}
              onChange={(e) => set("cidade", e.target.value)}
              onBlur={() => void atualizarBases(campos.cep, campos.cidade, campos.uf)}
              className={cls(erros.cidade)}
            />
            <Erro msg={erros.cidade} />
          </div>
          <div className="sm:col-span-1">
            <label className={labelCls} htmlFor="uf">UF</label>
            <select
              id="uf"
              value={campos.uf}
              onChange={(e) => {
                set("uf", e.target.value);
                void atualizarBases(campos.cep, campos.cidade, e.target.value);
              }}
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

      {/* ── Unidade de retirada ── */}
      <fieldset className={caixa}>
        <legend className={legenda}>Onde retirar</legend>
        <p className="text-xs text-muted-foreground mb-3">
          Escolha a unidade da Gollog onde você vai buscar a caixa: pode ser no
          aeroporto ou numa loja da Gollog. A lista é a da própria Gollog, em ordem de
          distância {fonte === "gollog" ? "do seu CEP" : "da sua cidade"}.
        </p>

        {!temNaCidade && maisPerto?.km != null && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Não achei unidade da Gollog na sua cidade. A mais perto fica a cerca de{" "}
            {maisPerto.km} km. Se você costuma retirar em outro lugar, é só escolher
            na lista. A retirada precisa ser em até 72 horas.
          </p>
        )}

        <div className="space-y-2" role="radiogroup" aria-label="Unidade de retirada">
          {visiveis.map((b) => {
            const ativo = campos.unidadeId === b.id;
            return (
              <label
                key={b.id}
                className={`flex gap-3 rounded-lg border p-3 text-sm cursor-pointer transition-all ${
                  ativo ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <input
                  type="radio"
                  name="unidadeId"
                  value={b.id}
                  checked={ativo}
                  onChange={() => {
                    escolhaManual.current = true;
                    set("unidadeId", b.id);
                  }}
                  className="mt-1 accent-secondary"
                />
                <span className="flex-1 min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2 text-primary font-medium">
                    <Plane size={14} className="self-center shrink-0" aria-hidden="true" />
                    {b.titulo}
                    {b.km != null && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {b.km} km{b.naCidade ? " · na sua cidade" : ""}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">{b.cidade}/{b.uf}</span>
                  {ativo && (
                    <span className="mt-1 block text-xs text-muted-foreground space-y-0.5">
                      <span className="flex gap-1">
                        <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                        {b.endereco}
                      </span>
                      {b.horario && <span className="block">{b.horario}</span>}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>

        {!verTodas && bases.length > visiveis.length && (
          <button
            type="button"
            onClick={() => setVerTodas(true)}
            className="mt-3 text-sm font-medium text-secondary hover:underline"
          >
            Ver todas as {bases.length} unidades
          </button>
        )}
        <Erro msg={erros.unidadeId} />
      </fieldset>

      {/* ── Quem retira ── */}
      <fieldset className={caixa}>
        <legend className={legenda}>Quem vai buscar</legend>
        <div className="space-y-2">
          {[
            { v: false, t: "Eu vou buscar", d: "Leve um documento com foto." },
            { v: true, t: "Outra pessoa", d: "A base só entrega para quem estiver no documento de envio." },
          ].map((o) => (
            <label
              key={String(o.v)}
              className={`flex gap-3 rounded-lg border p-3 text-sm cursor-pointer ${
                campos.outraPessoaRetira === o.v ? "border-primary/60 bg-primary/5" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="quemRetira"
                checked={campos.outraPessoaRetira === o.v}
                onChange={() => setCampos((a) => ({ ...a, outraPessoaRetira: o.v }))}
                className="mt-1 accent-secondary"
              />
              <span>
                <span className="block font-medium text-primary">{o.t}</span>
                <span className="block text-xs text-muted-foreground">{o.d}</span>
              </span>
            </label>
          ))}
        </div>

        {campos.outraPessoaRetira && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="recebedorNome">Nome completo de quem retira</label>
              <input id="recebedorNome" value={campos.recebedorNome} onChange={(e) => set("recebedorNome", e.target.value)} className={cls(erros.recebedorNome)} />
              <Erro msg={erros.recebedorNome} />
            </div>
            <div>
              <label className={labelCls} htmlFor="recebedorCpf">CPF de quem retira</label>
              <input id="recebedorCpf" value={campos.recebedorCpf} onChange={(e) => set("recebedorCpf", mascaraDoc(e.target.value))} className={cls(erros.recebedorCpf)} inputMode="numeric" placeholder="000.000.000-00" />
              <Erro msg={erros.recebedorCpf} />
            </div>
            <div>
              <label className={labelCls} htmlFor="recebedorTelefone">Telefone de quem retira</label>
              <input id="recebedorTelefone" value={campos.recebedorTelefone} onChange={(e) => set("recebedorTelefone", mascaraTelefone(e.target.value))} className={cls(erros.recebedorTelefone)} inputMode="tel" placeholder="(19) 99999-9999" />
              <Erro msg={erros.recebedorTelefone} />
            </div>
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              A Gollog pede que essa pessoa leve o documento com foto dela, uma
              cópia do seu documento e uma autorização assinada por você.
            </p>
          </div>
        )}
      </fieldset>

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
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
        {isPending ? "Enviando..." : "Confirmar envio"}
      </button>
    </form>
  );
}
