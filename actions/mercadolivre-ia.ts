"use server";

import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { chamarMl } from "@/lib/mercadolivre/cliente";
import { montarAnuncio, juntarDescricao, LISTING_TYPE } from "@/lib/mercadolivre/publicar";
import { descricaoEmParagrafos } from "@/lib/markdown";
import { stripMarcheziSignature } from "@/lib/constants";
import { COMPOSICAO_LABEL } from "@/lib/composicoes";
import { ehSemCredito } from "@/lib/ai/credito";
import {
  sugerirTitulosIa,
  melhorarDescricaoIa,
  revisarTextoIa,
  type ContextoProduto,
  type OpcaoTitulo,
  type Revisao,
} from "@/lib/ai/textos-ml";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";

/**
 * IA nos textos do anúncio do ML. Tudo aqui SÓ SUGERE: nenhuma ação grava no
 * ML nem no banco. Quem salva é o botão de salvar da aba, depois de o dono ver.
 */

type Falha = { ok: false; erro: string };

function erroAmigavel(e: unknown): Falha {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[ia-ml]", msg);
  if (/GEMINI_API_KEY/.test(msg)) return { ok: false, erro: "A chave do Gemini não está configurada." };
  if (ehSemCredito(msg)) return { ok: false, erro: msg };
  if (/timeout|aborted/i.test(msg)) return { ok: false, erro: "A IA demorou demais. Tente de novo." };
  return { ok: false, erro: msg.startsWith("Gemini ") ? "A IA falhou agora. Tente de novo." : msg };
}

/** Buscas em alta na categoria Peixes do ML. Muda devagar: 6 h de memória. */
let tendencias: { em: number; termos: string[] } | null = null;
async function tendenciasPeixes(): Promise<string[]> {
  if (tendencias && Date.now() - tendencias.em < 6 * 60 * 60 * 1000) return tendencias.termos;
  const r = await chamarMl<{ keyword?: string }[]>("/trends/MLB/MLB1091");
  const termos = r.ok ? (r.dados ?? []).map((t) => t.keyword ?? "").filter(Boolean).slice(0, 25) : [];
  tendencias = { em: Date.now(), termos };
  return termos;
}

async function contexto(dados: {
  productId: string;
  composicao: TipoComposicao | null;
  anuncioId?: string | null;
}): Promise<ContextoProduto | null> {
  const p = await prisma.product.findUnique({
    where: { id: dados.productId },
    select: {
      nome: true,
      descricao: true,
      descricaoCurta: true,
      padraoCor: true,
      cauda: true,
      caracteristica: true,
      origem: true,
      temperatura: true,
      ph: true,
      alimentacao: true,
      variantes: {
        where: { ativo: true },
        select: { composicao: true, qtdMachos: true, qtdFemeas: true },
      },
      mercadoLivre: { select: { id: true, titulo: true } },
    },
  });
  if (!p) return null;

  const v = p.variantes.find((x) => x.composicao === dados.composicao);
  const atual = p.mercadoLivre.find((a) => a.id === dados.anuncioId);

  return {
    nome: p.nome,
    composicao: dados.composicao,
    rotuloComposicao: dados.composicao ? COMPOSICAO_LABEL[dados.composicao] : null,
    receita: v ? { qtdMachos: v.qtdMachos, qtdFemeas: v.qtdFemeas } : null,
    padraoCor: p.padraoCor,
    cauda: p.cauda,
    caracteristica: p.caracteristica,
    origem: p.origem,
    temperatura: p.temperatura,
    ph: p.ph,
    alimentacao: p.alimentacao,
    descricaoSite: descricaoEmParagrafos(stripMarcheziSignature(p.descricao || p.descricaoCurta || "")),
    tituloAtual: atual?.titulo ?? null,
    outrosTitulos: p.mercadoLivre
      .filter((a) => a.id !== dados.anuncioId && a.titulo)
      .map((a) => a.titulo as string),
    tendenciasMl: await tendenciasPeixes(),
  };
}

export async function iaSugerirTitulosMl(dados: {
  productId: string;
  composicao: TipoComposicao | null;
  anuncioId?: string | null;
}): Promise<{ ok: true; opcoes: OpcaoTitulo[]; descartadas: number } | Falha> {
  await assertPermissao("config.editar");
  try {
    const ctx = await contexto(dados);
    if (!ctx) return { ok: false, erro: "Produto não encontrado." };
    const r = await sugerirTitulosIa(ctx);
    if (r.opcoes.length === 0) {
      return {
        ok: false,
        erro: `Nenhuma sugestão passou nas regras do ML (${r.descartadas[0]?.motivos.join(", ") ?? "sem resposta"}). Tente de novo.`,
      };
    }
    return { ok: true, opcoes: r.opcoes, descartadas: r.descartadas.length };
  } catch (e) {
    return erroAmigavel(e);
  }
}

/**
 * Descrição reescrita para o ML, já com os blocos fixos no fim (envio, licença,
 * segunda). Devolve pronta para ir à caixa de texto.
 */
export async function iaMelhorarDescricaoMl(dados: {
  productId: string;
  composicao: TipoComposicao | null;
}): Promise<{ ok: true; descricao: string } | Falha> {
  await assertPermissao("config.editar");
  try {
    const [ctx, montado] = await Promise.all([
      contexto(dados),
      montarAnuncio({ productId: dados.productId, composicao: dados.composicao, tipoAnuncio: LISTING_TYPE }),
    ]);
    if (!ctx) return { ok: false, erro: "Produto não encontrado." };
    if (!montado.ok) return { ok: false, erro: montado.erro };
    const texto = await melhorarDescricaoIa(ctx);
    return { ok: true, descricao: juntarDescricao(texto, montado.dados.blocosFixos) };
  } catch (e) {
    return erroAmigavel(e);
  }
}

export async function iaRevisarTextoMl(dados: {
  texto: string;
  tipo: "titulo" | "descricao";
}): Promise<({ ok: true } & Revisao) | Falha> {
  await assertPermissao("config.editar");
  const texto = dados.texto.trim();
  if (texto.length < 5) return { ok: false, erro: "Nada para revisar." };
  if (texto.length > 20000) return { ok: false, erro: "Texto grande demais para revisar de uma vez." };
  try {
    const r = await revisarTextoIa(texto, dados.tipo === "titulo" ? "titulo" : "descricao");
    return { ok: true, ...r };
  } catch (e) {
    return erroAmigavel(e);
  }
}
