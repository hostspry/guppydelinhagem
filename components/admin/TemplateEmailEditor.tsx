"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Eye, RotateCcw, Send } from "lucide-react";
import { FormField } from "@/components/admin/FormField";
import {
  enviarTesteTemplate,
  previewTemplateEmail,
  restaurarTemplateEmail,
  salvarTemplateEmail,
} from "@/actions/templates-email";

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export type TemplateEditavel = {
  chave: string;
  rotulo: string;
  quando: string;
  variaveis: { nome: string; descricao: string; bloco?: boolean }[];
  assunto: string;
  titulo: string;
  corpo: string;
  ativo: boolean;
  personalizado: boolean;
};

/**
 * Editor de um e-mail automático, com prévia ao lado.
 *
 * A prévia é renderizada no SERVIDOR (mesma função que monta o e-mail de
 * verdade) e mostrada num iframe. Fazer a prévia no client seria reimplementar a
 * montagem e arriscar mostrar uma coisa e enviar outra.
 */
export function TemplateEmailEditor({ inicial }: { inicial: TemplateEditavel }) {
  const [salvando, startSalvar] = useTransition();
  const [restaurando, startRestaurar] = useTransition();
  const [testando, startTestar] = useTransition();

  const [assunto, setAssunto] = useState(inicial.assunto);
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [corpo, setCorpo] = useState(inicial.corpo);
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [previa, setPrevia] = useState<string>("");
  const [emailTeste, setEmailTeste] = useState("");

  // Prévia acompanha a digitação, com uma pausa para não chamar a cada tecla.
  useEffect(() => {
    const id = setTimeout(async () => {
      const r = await previewTemplateEmail({ chave: inicial.chave, titulo, corpo });
      if (r.ok) setPrevia(r.html);
    }, 500);
    return () => clearTimeout(id);
  }, [inicial.chave, titulo, corpo]);

  function salvar() {
    startSalvar(async () => {
      const r = await salvarTemplateEmail({
        chave: inicial.chave,
        assunto,
        titulo,
        corpo,
        ativo,
      });
      if (r.success) toast.success(r.message ?? "Salvo.");
      else toast.error(r.error);
    });
  }

  function restaurar() {
    startRestaurar(async () => {
      const r = await restaurarTemplateEmail(inicial.chave);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Restaurado.");
      // Recarrega para os campos voltarem ao texto padrão vindo do servidor.
      window.location.reload();
    });
  }

  function testar() {
    startTestar(async () => {
      const r = await enviarTesteTemplate(inicial.chave, emailTeste);
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.mensagem);
    });
  }

  /** Insere a etiqueta no fim do corpo (mais simples que rastrear o cursor). */
  function inserir(nome: string) {
    setCorpo((c) => `${c.trimEnd()}\n\n{{${nome}}}`);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#07366A]">
                {inicial.rotulo}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">{inicial.quando}</p>
            </div>
            {inicial.personalizado && (
              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                texto editado
              </span>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700 mb-4">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="mt-0.5 accent-[#FF035C]"
            />
            <span>
              Enviar este e-mail
              <span className="block text-xs text-gray-400">
                Desmarcado, este aviso deixa de sair (os outros continuam).
              </span>
            </span>
          </label>

          <FormField label="Assunto" name="assunto" required>
            <input
              id="assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              className={input}
            />
          </FormField>

          <FormField
            label="Título dentro do e-mail"
            name="titulo"
            required
            hint="A frase grande no topo da mensagem."
          >
            <input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className={input}
            />
          </FormField>

          <FormField
            label="Mensagem"
            name="corpo"
            required
            hint="Linha em branco separa parágrafo. Use **asteriscos** para negrito."
          >
            <textarea
              id="corpo"
              rows={14}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              className={`${input} font-mono text-[13px] leading-relaxed`}
            />
          </FormField>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="px-5 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {salvando ? "Salvando…" : "Salvar texto"}
            </button>
            {inicial.personalizado && (
              <button
                type="button"
                onClick={restaurar}
                disabled={restaurando}
                className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-gray-400 disabled:opacity-50 transition-all"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                {restaurando ? "Restaurando…" : "Voltar ao texto padrão"}
              </button>
            )}
          </div>
        </div>

        {/* Etiquetas disponíveis nesta mensagem */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-1">
            Etiquetas que esta mensagem conhece
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Clique para inserir. Na hora do envio, cada uma vira o dado real do
            cliente.
          </p>
          <ul className="space-y-1.5">
            {inicial.variaveis.map((v) => (
              <li key={v.nome} className="flex items-start gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => inserir(v.nome)}
                  className="shrink-0 font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100 text-[#07366A] hover:bg-gray-200"
                >
                  {`{{${v.nome}}}`}
                </button>
                <span className="text-gray-600 text-xs pt-0.5">
                  {v.descricao}
                  {v.bloco && (
                    <span className="text-gray-400"> (bloco pronto)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Envio de teste */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-1">
            Mandar um teste
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Manda esta mensagem, como está <strong>salva</strong>, com dados de
            exemplo.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              value={emailTeste}
              onChange={(e) => setEmailTeste(e.target.value)}
              placeholder="seu@email.com"
              className={`${input} max-w-xs`}
            />
            <button
              type="button"
              onClick={testar}
              disabled={testando || !emailTeste}
              className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-gray-400 disabled:opacity-50 transition-all"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              {testando ? "Enviando…" : "Enviar teste"}
            </button>
          </div>
        </div>
      </div>

      {/* Prévia */}
      <div className="lg:sticky lg:top-4 self-start w-full">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          <Eye className="w-4 h-4" aria-hidden="true" />
          Como o cliente vê
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <iframe
            title="Prévia do e-mail"
            srcDoc={previa}
            className="w-full h-[560px] border-0"
            sandbox=""
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Prévia com dados de exemplo. Nenhum e-mail é enviado aqui.
        </p>
      </div>
    </div>
  );
}
