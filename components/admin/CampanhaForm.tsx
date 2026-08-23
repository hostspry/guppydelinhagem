"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, Send, Users } from "lucide-react";
import { FormField } from "@/components/admin/FormField";
import {
  contarPublico,
  previewCampanha,
  salvarCampanha,
} from "@/actions/campanhas";

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

type Publico = "TODOS" | "COMPRADORES" | "SEM_COMPRA" | "LEADS";

export type CampanhaInicial = {
  id?: string;
  nome: string;
  assunto: string;
  titulo: string;
  corpo: string;
  publico: Publico;
  agendadaPara: string; // "AAAA-MM-DDTHH:mm" ou ""
  bloqueada?: boolean; // já disparada: só leitura
};

const PUBLICOS: { valor: Publico; rotulo: string; ajuda: string }[] = [
  { valor: "TODOS", rotulo: "Todos os clientes", ajuda: "Todo cadastro com e-mail." },
  { valor: "COMPRADORES", rotulo: "Quem já comprou", ajuda: "Com pelo menos um pedido pago." },
  { valor: "SEM_COMPRA", rotulo: "Cadastrados que não compraram", ajuda: "Na base, sem pedido pago." },
  { valor: "LEADS", rotulo: "Carrinhos abandonados", ajuda: "Deixaram contato e não fecharam." },
];

const ETIQUETAS = [
  { nome: "nome", descricao: "Primeiro nome de quem recebe" },
  { nome: "botao_loja", descricao: "Botão “Ver a loja”" },
  { nome: "link_loja", descricao: "Endereço da loja, em texto" },
];

/**
 * Escreve a campanha, escolhe o público e (opcionalmente) agenda.
 *
 * A prévia sai do servidor, pela mesma função que monta o e-mail real — fazer no
 * navegador arriscaria mostrar uma coisa e enviar outra.
 */
export function CampanhaForm({ inicial }: { inicial: CampanhaInicial }) {
  const [salvando, startSalvar] = useTransition();
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const [d, setD] = useState(inicial);
  const [previa, setPrevia] = useState("");
  // Guarda o público junto do número: enquanto o par não bater com o
  // selecionado, ainda estamos contando. Evita zerar o estado dentro do efeito.
  const [contagem, setContagem] = useState<{ publico: Publico; n: number } | null>(null);

  const set = <K extends keyof CampanhaInicial>(k: K, v: CampanhaInicial[K]) =>
    setD((a) => ({ ...a, [k]: v }));

  useEffect(() => {
    const id = setTimeout(async () => {
      setPrevia(await previewCampanha({ titulo: d.titulo, corpo: d.corpo }));
    }, 500);
    return () => clearTimeout(id);
  }, [d.titulo, d.corpo]);

  // Quantas pessoas o público alcança — é o número que evita o susto de mandar
  // para a lista errada.
  useEffect(() => {
    let vivo = true;
    const publico = d.publico;
    contarPublico(publico)
      .then((n) => vivo && setContagem({ publico, n }))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [d.publico]);

  const alcance = contagem?.publico === d.publico ? contagem.n : null;

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    startSalvar(async () => {
      const r = await salvarCampanha(inicial.id ?? null, {
        nome: d.nome,
        assunto: d.assunto,
        titulo: d.titulo,
        corpo: d.corpo,
        publico: d.publico,
        agendadaPara: d.agendadaPara,
      });
      if (r?.success === false) {
        setErros(r.fieldErrors ?? {});
        toast.error(r.error);
      }
    });
  }

  const bloqueada = !!inicial.bloqueada;

  return (
    <form
      onSubmit={salvar}
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]"
    >
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <FormField label="Nome da campanha" name="nome" required error={erros.nome?.[0]} hint="Só para você achar depois. O cliente não vê.">
            <input
              id="nome"
              value={d.nome}
              onChange={(e) => set("nome", e.target.value)}
              disabled={bloqueada}
              className={input}
              placeholder="Promoção trio R$ 140"
            />
          </FormField>

          <FormField label="Assunto do e-mail" name="assunto" required error={erros.assunto?.[0]}>
            <input
              id="assunto"
              value={d.assunto}
              onChange={(e) => set("assunto", e.target.value)}
              disabled={bloqueada}
              className={input}
            />
          </FormField>

          <FormField label="Título dentro do e-mail" name="titulo" required error={erros.titulo?.[0]}>
            <input
              id="titulo"
              value={d.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              disabled={bloqueada}
              className={input}
            />
          </FormField>

          <FormField
            label="Mensagem"
            name="corpo"
            required
            error={erros.corpo?.[0]}
            hint="Linha em branco separa parágrafo. Use **asteriscos** para negrito."
          >
            <textarea
              id="corpo"
              rows={12}
              value={d.corpo}
              onChange={(e) => set("corpo", e.target.value)}
              disabled={bloqueada}
              className={`${input} font-mono text-[13px] leading-relaxed`}
            />
          </FormField>

          <div className="flex flex-wrap gap-1.5">
            {ETIQUETAS.map((e) => (
              <button
                key={e.nome}
                type="button"
                disabled={bloqueada}
                onClick={() => set("corpo", `${d.corpo.trimEnd()}\n\n{{${e.nome}}}`)}
                title={e.descricao}
                className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100 text-[#07366A] hover:bg-gray-200 disabled:opacity-50"
              >
                {`{{${e.nome}}}`}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
            Para quem
          </h2>

          <FormField label="Público" name="publico">
            <select
              id="publico"
              value={d.publico}
              onChange={(e) => set("publico", e.target.value as Publico)}
              disabled={bloqueada}
              className={input}
            >
              {PUBLICOS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </FormField>

          <p className="flex items-center gap-1.5 text-sm text-gray-600 -mt-2 mb-4">
            <Users className="w-4 h-4 text-gray-400" aria-hidden="true" />
            {alcance == null ? (
              "contando…"
            ) : (
              <>
                <strong className="text-[#07366A]">{alcance}</strong> pessoa
                {alcance === 1 ? "" : "s"} receberiam agora
              </>
            )}
            <span className="text-xs text-gray-400">
              · {PUBLICOS.find((p) => p.valor === d.publico)?.ajuda}
            </span>
          </p>

          <FormField
            label="Agendar para"
            name="agendadaPara"
            hint="Vazio = você dispara na mão. Horário de Brasília."
          >
            <input
              id="agendadaPara"
              type="datetime-local"
              value={d.agendadaPara}
              onChange={(e) => set("agendadaPara", e.target.value)}
              disabled={bloqueada}
              className={input}
            />
          </FormField>
        </div>

        {!bloqueada && (
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {salvando ? "Salvando…" : inicial.id ? "Salvar" : "Criar campanha"}
            </button>
            <Link
              href="/admin/campanhas"
              className="px-5 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 transition-all"
            >
              Cancelar
            </Link>
          </div>
        )}

        {bloqueada && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
            Esta campanha já foi disparada, então o texto ficou travado. Para
            mudar alguma coisa, crie uma nova.
          </p>
        )}
      </div>

      <div className="lg:sticky lg:top-4 self-start w-full">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          <Eye className="w-4 h-4" aria-hidden="true" />
          Como o cliente vê
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <iframe
            title="Prévia da campanha"
            srcDoc={previa}
            className="w-full h-[520px] border-0"
            sandbox=""
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-2 flex items-start gap-1">
          <Send className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
          O rodapé com o link de descadastro entra automaticamente no envio real.
        </p>
      </div>
    </form>
  );
}
