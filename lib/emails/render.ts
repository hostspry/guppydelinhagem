import "server-only";
import { prisma } from "@/lib/prisma";
import { templateDef } from "./catalogo";
import { esc, h1, layoutEmail, p } from "./layout";

/**
 * Monta o e-mail final: texto do painel (ou o padrão) + variáveis + layout.
 *
 * Regra de segurança do texto: o CORPO é escapado antes de virar HTML, mesmo
 * vindo do painel — assim uma tag colada sem querer não quebra o e-mail e não
 * abre caminho para injeção. A formatação permitida entra depois do escape
 * (`**negrito**`), e os blocos ricos (lista de itens, botão, caixa de rastreio)
 * vêm prontos do código, não do texto.
 */

/** Valor simples ({{nome}}) ou bloco pronto ({{itens}}). */
export type Variaveis = Record<string, string>;

export type TemplateResolvido = {
  assunto: string;
  titulo: string;
  corpo: string;
  ativo: boolean;
  /** true = o texto foi editado no painel; false = está usando o padrão. */
  personalizado: boolean;
};

/** Texto salvo no painel; sem linha no banco, devolve o padrão do catálogo. */
export async function carregarTemplate(
  chave: string,
): Promise<TemplateResolvido | null> {
  const def = templateDef(chave);
  if (!def) return null;
  try {
    const salvo = await prisma.templateEmail.findUnique({ where: { chave } });
    if (salvo) {
      return {
        assunto: salvo.assunto,
        titulo: salvo.titulo,
        corpo: salvo.corpo,
        ativo: salvo.ativo,
        personalizado: true,
      };
    }
  } catch (e) {
    // Banco fora do ar não pode impedir o e-mail: cai no padrão.
    console.error("[email] carregar template", chave, e);
  }
  return { ...def.padrao, ativo: true, personalizado: false };
}

/** Substitui {{variavel}} num texto de UMA linha (assunto/título). */
export function aplicarVariaveisTexto(
  texto: string,
  vars: Variaveis,
): string {
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, nome: string) =>
    (vars[nome] ?? "").replace(/<[^>]+>/g, "").trim(),
  );
}

/**
 * Corpo (texto do painel) → HTML.
 *
 * Ordem importa: escapa tudo, aplica negrito, quebra em parágrafos e só então
 * troca as variáveis. Bloco (`__BLOCO__nome`) é trocado pelo HTML pronto FORA
 * do parágrafo, senão uma tabela ficaria dentro de um <p> e o Outlook estraga o
 * espaçamento.
 */
export function corpoParaHtml(corpo: string, vars: Variaveis): string {
  const blocos = new Map<string, string>();
  let i = 0;

  // 1) Tira os blocos de circulação antes de escapar (eles JÁ são HTML nosso).
  const comMarcadores = corpo.replace(
    /\{\{\s*([a-z_]+)\s*\}\}/gi,
    (inteiro, nome: string) => {
      const valor = vars[nome];
      if (valor == null) return inteiro; // variável desconhecida fica visível
      if (/^\s*</.test(valor)) {
        const marca = `@@BLOCO${i++}@@`;
        blocos.set(marca, valor);
        return marca;
      }
      return `@@TEXTO:${nome}@@`;
    },
  );

  // 2) Escapa o que o dono escreveu e aplica a formatação permitida.
  const html = comMarcadores
    .split(/\n{2,}/)
    .map((paragrafo) => {
      const marcaSozinha = paragrafo.trim().match(/^@@BLOCO\d+@@$/);
      if (marcaSozinha) return paragrafo.trim(); // bloco fica fora do <p>
      const texto = esc(paragrafo.trim())
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
      return texto ? p(texto) : "";
    })
    .filter(Boolean)
    .join("");

  // 3) Devolve blocos e valores simples (estes escapados).
  let final = html;
  for (const [marca, conteudo] of blocos) final = final.replace(marca, conteudo);
  final = final.replace(
    /@@TEXTO:([a-z_]+)@@/gi,
    (_, nome: string) => esc(vars[nome] ?? ""),
  );
  // Sobra de espaço quando uma variável opcional vem vazia (ex.: transportadora).
  return final.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1");
}

/** E-mail pronto para enviar. null = template desligado no painel. */
export async function montarEmail(
  chave: string,
  vars: Variaveis,
  preheader: string,
): Promise<{ assunto: string; html: string } | null> {
  const t = await carregarTemplate(chave);
  if (!t || !t.ativo) return null;
  return {
    assunto: aplicarVariaveisTexto(t.assunto, vars),
    html: layoutEmail({
      titulo: aplicarVariaveisTexto(t.titulo, vars),
      preheader,
      conteudo:
        h1(aplicarVariaveisTexto(t.titulo, vars)) + corpoParaHtml(t.corpo, vars),
    }),
  };
}
