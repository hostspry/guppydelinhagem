"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  FileText,
  Link2,
  Pause,
  Play,
  RefreshCw,
  Unlink,
  Upload,
  XCircle,
} from "lucide-react";
import {
  painelMlDoProduto,
  previaPublicacaoMl,
  salvarAnuncioMl,
  statusAnuncioMl,
  descricaoAnuncioMl,
  descricaoDoSiteMl,
  atualizarDescricaoDoSiteMl,
  composicaoAnuncioMl,
  enviarEstoqueProdutoMl,
  ligarAnuncioPorNumeroMl,
  type PainelMl,
  type AnuncioPainel,
  type ComposicaoPainel,
} from "@/actions/mercadolivre-produto";
import {
  atualizarAnuncioMl,
  desligarAnuncioMl,
  publicarProdutoNoMl,
  sugerirPrecoMl,
  trocarTipoAnuncioMl,
  type PrecoSugerido,
} from "@/actions/mercadolivre";
import { COMPOSICAO_LABEL } from "@/lib/composicoes";
import {
  AvisosTitulo,
  MelhorarDescricao,
  RevisarTexto,
  SugerirTitulos,
} from "@/components/admin/IaTextoMl";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";

/**
 * Aba "Mercado Livre" do produto: publicar, ver como está lá e editar o que a
 * API deixa editar. Tudo o que aparece do anúncio é lido do ML na hora.
 */

type Resp = { ok: boolean; mensagem?: string; erro?: string };

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C] disabled:bg-gray-50 disabled:text-gray-500";
const botao =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:border-[#07366A] disabled:opacity-50";
const cartao = "bg-white border border-gray-200 rounded-lg p-5";
const titulo = "text-xs font-semibold text-[#07366A] uppercase tracking-wide";

const TIPOS: { id: string; nome: string }[] = [
  { id: "gold_special", nome: "Clássico" },
  { id: "gold_pro", nome: "Premium" },
  { id: "free", nome: "Grátis" },
];
const nomeTipo = (id: string | null | undefined) =>
  TIPOS.find((t) => t.id === id)?.nome ?? id ?? "—";

const STATUS: Record<string, { rotulo: string; cor: string }> = {
  active: { rotulo: "Ativo", cor: "bg-green-100 text-green-800" },
  paused: { rotulo: "Pausado", cor: "bg-amber-100 text-amber-800" },
  under_review: { rotulo: "Em revisão", cor: "bg-blue-100 text-blue-800" },
  inactive: { rotulo: "Inativo", cor: "bg-gray-100 text-gray-700" },
  closed: { rotulo: "Finalizado", cor: "bg-gray-200 text-gray-700" },
};

/** Nome legível dos atributos que o site manda na ficha. */
const ATRIBUTO: Record<string, string> = {
  FISH_SPECIES: "Espécie",
  ANIMAL_GENDER: "Gênero",
  REQUIRED_WATER_TYPE: "Tipo de água",
  REQUIRED_WATER_TEMPERATURE: "Temperatura da água",
  FISH_SIZE: "Tamanho",
  FISHES_NUMBER: "Quantidade de peixes",
  MAIN_COLOR: "Cor principal",
  COLOR: "Cor",
};
const VALOR: Record<string, string> = {
  "3221175": "Guppy",
  "3221180": "Doce",
  "3896960": "Macho",
  "3896959": "Fêmea",
  "4052847": "Não sexado",
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numero = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

export function ProdutoMercadoLivre({ productId }: { productId: string }) {
  const [painel, setPainel] = useState<PainelMl | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [pending, startTransition] = useTransition();

  const aplicar = useCallback((r: Awaited<ReturnType<typeof painelMlDoProduto>>) => {
    if (r.ok) {
      setPainel(r.dados);
      setErro(null);
    } else {
      setErro(r.erro);
    }
    setCarregando(false);
  }, []);

  const recarregar = useCallback(
    async () => aplicar(await painelMlDoProduto(productId)),
    [aplicar, productId],
  );

  // Primeira leitura quando a aba abre. O `vivo` evita gravar estado de uma
  // resposta que chegou depois de a aba ter sido desmontada.
  useEffect(() => {
    let vivo = true;
    painelMlDoProduto(productId).then((r) => {
      if (vivo) aplicar(r);
    });
    return () => {
      vivo = false;
    };
  }, [aplicar, productId]);

  /** Roda uma ação, avisa e relê o painel (o ML é a fonte do que aparece). */
  function rodar(fn: () => Promise<Resp>) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.erro ?? "Não deu certo.");
        return;
      }
      toast.success(r.mensagem ?? "Pronto.");
      await recarregar();
    });
  }

  if (carregando) {
    return <p className="text-sm text-gray-500">Consultando o Mercado Livre…</p>;
  }
  if (erro || !painel) {
    return (
      <p className="flex items-start gap-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
        {erro ?? "Não consegui carregar."}
      </p>
    );
  }

  const { produto, anuncios, envio } = painel;

  if (!painel.conectado) {
    return (
      <div className={`${cartao} max-w-2xl text-sm text-gray-700`}>
        A conta do Mercado Livre ainda não está conectada.{" "}
        <Link
          href="/admin/configuracoes/mercado-livre"
          className="font-medium text-[#07366A] underline"
        >
          Conectar em Configurações → Mercado Livre
        </Link>
        .
      </div>
    );
  }

  const semAnuncio = produto.composicoes.filter((c) => !c.anuncioId);

  return (
    <div className="max-w-3xl space-y-5">
      {/* ── Avisos que impedem ou atrapalham ── */}
      {!painel.integracaoLigada && (
        <Aviso>
          A integração está desligada: estoque e pedidos não sincronizam. Ligue em{" "}
          <Link href="/admin/configuracoes/mercado-livre" className="underline">
            Configurações → Mercado Livre
          </Link>
          .
        </Aviso>
      )}
      {produto.ehPeixe && !painel.temLicencaIbama && (
        <Aviso>
          Falta o número da licença do IBAMA. Sem ele o ML cancela anúncio de peixe vivo, e o
          site não publica.
        </Aviso>
      )}
      {produto.fotos < 3 && (
        <Aviso>
          O produto tem {produto.fotos} foto(s). O ML pede pelo menos 3, e anúncio com menos
          perde qualidade.
        </Aviso>
      )}

      {/* ── Envio na segunda ── */}
      {produto.ehPeixe && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <CalendarClock size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p>
              Compra feita agora sai na <strong>{envio.rotulo}</strong> ({envio.dias} dias). É o
              prazo de <strong>{envio.prazoMl} dias</strong> que o anúncio mostra em
              &quot;Disponibilidade de estoque&quot;, atualizado sozinho todo dia.
            </p>
            {envio.puladas.length > 0 && (
              <p className="mt-1 text-xs">
                Semana(s) pulada(s) por feriado: {envio.puladas.join(", ")}.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Como publica ── */}
      <details className={cartao}>
        <summary className={`${titulo} cursor-pointer`}>Como o site publica no ML</summary>
        <ul className="mt-3 list-disc ml-4 space-y-1.5 text-xs text-gray-700 leading-relaxed">
          <li>
            <strong>Um anúncio por composição</strong> (trio, casal, macho, fêmea), porque o
            anúncio do ML tem um preço só. A mesma composição em dois anúncios é duplicata, e o
            ML cancela os dois.
          </li>
          <li>
            <strong>Nasce pausado.</strong> Você confere aqui e ativa quando quiser.
          </li>
          <li>
            <strong>Título</strong> montado para a busca do ML, com até 60 caracteres (&quot;Peixe
            Guppy … Trio Lebiste Vivo Aquário&quot;). Depois da primeira venda o ML trava o
            título.
          </li>
          <li>
            <strong>Ficha técnica:</strong> espécie, gênero, quantidade de peixes, tipo e
            temperatura da água, cor e tamanho.
          </li>
          <li>
            <strong>Descrição:</strong> texto do produto, o que vai no envio, licença do IBAMA e a
            regra do envio na segunda.
          </li>
          <li>
            <strong>Fotos:</strong> as do produto, na mesma ordem (a primeira é a capa), até 10.
            Subiu foto nova? Use &quot;Atualizar fotos e ficha&quot;.
          </li>
          <li>
            <strong>Estoque:</strong> quantos conjuntos da composição o pool monta. Vai a cada
            venda e a cada 15 minutos.
          </li>
          <li>
            <strong>Prazo:</strong> dias até a próxima segunda de envio, pulando semana com
            feriado.
          </li>
          <li>
            <strong>Frete a combinar:</strong> a categoria de peixe vivo não usa Mercado Envios.
          </li>
          <li>
            <strong>Vídeo não vai pela API</strong> (o ML desligou). Suba como Clip no painel do
            ML.
          </li>
        </ul>
      </details>

      {/* ── Anúncios ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className={titulo}>Anúncios deste produto ({anuncios.length})</h2>
          {anuncios.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => rodar(() => enviarEstoqueProdutoMl(productId))}
              className={botao}
            >
              <RefreshCw size={13} aria-hidden="true" />
              Reenviar estoque
            </button>
          )}
        </div>
        {anuncios.length === 0 && (
          <p className="text-sm text-gray-500">Nenhum anúncio ligado a este produto ainda.</p>
        )}
        {anuncios.map((a) => (
          <CartaoAnuncio
            // O painel relê o ML depois de cada ação. A chave muda quando o que
            // voltou de lá muda, e o cartão renasce com os campos já certos.
            key={`${a.id}:${a.detalhe?.titulo}:${a.detalhe?.preco}:${a.detalhe?.descricao.length}`}
            anuncio={a}
            produto={produto}
            pending={pending}
            rodar={rodar}
          />
        ))}
      </section>

      {/* ── Publicar ── */}
      {produto.ehPeixe ? (
        <section className={`${cartao} space-y-3`}>
          <h2 className={`${titulo} flex items-center gap-1.5`}>
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            Publicar composição
          </h2>
          {produto.composicoes.length === 0 ? (
            <p className="text-sm text-gray-500">
              O produto não tem composição ativa. Ligue pelo menos uma na aba Produto.
            </p>
          ) : semAnuncio.length === 0 ? (
            <p className="text-sm text-gray-500">Todas as composições já têm anúncio.</p>
          ) : (
            semAnuncio.map((c) => (
              <PublicarComposicao
                key={c.composicao}
                productId={productId}
                c={c}
                pending={pending}
                rodar={rodar}
              />
            ))
          )}
        </section>
      ) : (
        <section className={`${cartao} text-sm text-gray-700`}>
          <h2 className={`${titulo} mb-2`}>Publicar</h2>
          Produto seco ainda não publica por aqui: cada categoria do ML pede uma ficha
          diferente (marca, modelo, código de barras). Publique no painel do ML e ligue o anúncio
          pelo número abaixo.
        </section>
      )}

      <LigarPorNumero
        productId={productId}
        composicoes={produto.ehPeixe ? produto.composicoes : []}
        pending={pending}
        rodar={rodar}
      />
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5">
      <AlertTriangle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

// ── Um anúncio ───────────────────────────────────────────────────────────────

function CartaoAnuncio({
  anuncio: a,
  produto,
  pending,
  rodar,
}: {
  anuncio: AnuncioPainel;
  produto: PainelMl["produto"];
  pending: boolean;
  rodar: (fn: () => Promise<Resp>) => void;
}) {
  const d = a.detalhe;
  const [tituloEd, setTituloEd] = useState(d?.titulo ?? "");
  const [precoEd, setPrecoEd] = useState(d ? d.preco.toFixed(2).replace(".", ",") : "");
  const [sugestao, setSugestao] = useState<PrecoSugerido | null>(null);
  const [descAberta, setDescAberta] = useState(false);
  const [desc, setDesc] = useState(d?.descricao ?? "");
  const [ocupado, startLocal] = useTransition();

  const travado = pending || ocupado;
  const st = d ? (STATUS[d.status] ?? { rotulo: d.status, cor: "bg-gray-100 text-gray-700" }) : null;
  const semZoom = d ? d.fotos.filter((f) => f.largura > 0 && f.largura <= 800).length : 0;
  const mudouTitulo = !!d && tituloEd.trim() !== d.titulo;
  const precoNum = numero(precoEd);
  const mudouPreco = !!d && Number.isFinite(precoNum) && Math.abs(precoNum - d.preco) >= 0.005;
  const podeMudarComposicao = produto.ehPeixe;

  function sugerir() {
    if (!a.composicao) {
      toast.error("Marque a composição do anúncio para sugerir o preço.");
      return;
    }
    startLocal(async () => {
      const r = await sugerirPrecoMl({ productId: produto.id, composicao: a.composicao });
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      setSugestao(r.dados);
      const doTipo = r.dados.opcoes.find((o) => o.tipoAnuncio === (d?.tipoAnuncio ?? a.tipoAnuncio));
      if (doTipo) setPrecoEd(doTipo.precoSugerido.toFixed(2).replace(".", ","));
    });
  }

  function usarTextoDoSite() {
    startLocal(async () => {
      const r = await descricaoDoSiteMl(a.id);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      setDesc(r.texto);
      toast.info("Texto do site carregado. Revise e salve.");
    });
  }

  return (
    <article className={`${cartao} space-y-4`}>
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#07366A] break-words">
            {d?.titulo ?? a.itemId}
          </p>
          <p className="text-xs text-gray-500">
            {a.itemId}
            {d?.permalink && (
              <>
                {" · "}
                <a
                  href={d.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[#07366A] hover:text-[#FF035C]"
                >
                  ver no ML <ExternalLink size={11} aria-hidden="true" />
                </a>
              </>
            )}
          </p>
        </div>
        {st && (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cor}`}>
            {st.rotulo}
          </span>
        )}
      </div>

      {a.erroDetalhe && <Aviso>Não consegui ler o anúncio no ML: {a.erroDetalhe}</Aviso>}
      {a.ultimoErro && <Aviso>Último erro: {a.ultimoErro}</Aviso>}
      {d && d.subStatus.length > 0 && (
        <Aviso>Situação no ML: {d.subStatus.join(", ")}</Aviso>
      )}

      {/* Números */}
      {d && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Dado rotulo="Preço" valor={brl(d.preco)} />
          <Dado
            rotulo="Estoque no ML"
            valor={`${d.estoque}`}
            nota={d.estoque !== a.estoqueSite ? `site manda ${a.estoqueSite}` : undefined}
          />
          <Dado rotulo="Vendidos" valor={`${d.vendidos}`} />
          <Dado
            rotulo="Fotos"
            valor={`${d.fotos.length}`}
            nota={semZoom ? `${semZoom} sem zoom` : undefined}
          />
        </dl>
      )}

      {/* Qualidade */}
      {d?.qualidade != null && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-gray-700">
              Qualidade do anúncio{d.qualidadeNivel ? ` (${d.qualidadeNivel})` : ""}
            </span>
            <span className="font-semibold text-[#07366A]">{Math.round(d.qualidade)}/100</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full ${d.qualidade >= 80 ? "bg-green-500" : d.qualidade >= 60 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(100, Math.max(0, d.qualidade))}%` }}
            />
          </div>
          {d.pendencias.length > 0 && (
            <ul className="mt-2 list-disc ml-4 space-y-0.5 text-xs text-gray-600">
              {d.pendencias.map((p) => (
                <li key={p.chave + p.texto}>{p.texto}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Composição e tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {podeMudarComposicao && (
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Composição que este anúncio vende</span>
            <select
              value={a.composicao ?? ""}
              disabled={travado}
              onChange={(e) =>
                rodar(() =>
                  composicaoAnuncioMl({
                    anuncioId: a.id,
                    composicao: (e.target.value || null) as TipoComposicao | null,
                  }),
                )
              }
              className={input}
            >
              <option value="">Não marcada (usa a padrão)</option>
              {produto.composicoes.map((c) => (
                <option key={c.composicao} value={c.composicao}>
                  {c.rotulo}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">Tipo de anúncio</span>
          <select
            value={d?.tipoAnuncio ?? a.tipoAnuncio ?? ""}
            disabled={travado || !d || d.status === "closed"}
            onChange={(e) =>
              rodar(() => trocarTipoAnuncioMl({ anuncioId: a.id, tipoAnuncio: e.target.value }))
            }
            className={input}
          >
            {!TIPOS.some((t) => t.id === (d?.tipoAnuncio ?? a.tipoAnuncio)) && (
              <option value={d?.tipoAnuncio ?? a.tipoAnuncio ?? ""}>
                {nomeTipo(d?.tipoAnuncio ?? a.tipoAnuncio)}
              </option>
            )}
            <option value="gold_special">Clássico (12,5%)</option>
            <option value="gold_pro">Premium (17,5%, parcelado sem juros)</option>
            <option value="free">Grátis (0%, 1 unidade)</option>
          </select>
        </label>
      </div>

      {/* Título e preço */}
      {d && d.status !== "closed" && (
        <div className="space-y-3">
          <label className="block">
            <span className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Título</span>
              <span className={tituloEd.length > 60 ? "text-red-600" : ""}>
                {tituloEd.length}/60
              </span>
            </span>
            <input
              value={tituloEd}
              maxLength={60}
              disabled={travado || !d.podeEditarTitulo}
              onChange={(e) => setTituloEd(e.target.value)}
              className={input}
            />
            {!d.podeEditarTitulo && (
              <span className="block mt-1 text-[11px] text-gray-500">
                O ML não deixa trocar o título de anúncio que já vendeu.
              </span>
            )}
          </label>
          {d.podeEditarTitulo && (
            <div className="-mt-1 space-y-2">
              <AvisosTitulo titulo={tituloEd} composicao={a.composicao} />
              <div className="flex flex-wrap items-start gap-2">
                <SugerirTitulos
                  productId={produto.id}
                  composicao={a.composicao}
                  anuncioId={a.id}
                  onUsar={setTituloEd}
                  disabled={travado}
                />
                <RevisarTexto
                  texto={tituloEd}
                  tipo="titulo"
                  onAplicar={setTituloEd}
                  disabled={travado}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="block w-40">
              <span className="block text-xs text-gray-500 mb-1">Preço (R$)</span>
              <input
                inputMode="decimal"
                value={precoEd}
                disabled={travado}
                onChange={(e) => setPrecoEd(e.target.value)}
                className={input}
              />
            </label>
            {produto.ehPeixe && (
              <button type="button" disabled={travado} onClick={sugerir} className={botao}>
                Preço que mantém o líquido do site
              </button>
            )}
            <button
              type="button"
              disabled={travado || (!mudouTitulo && !mudouPreco) || !(precoNum > 0)}
              onClick={() =>
                rodar(() =>
                  salvarAnuncioMl({
                    anuncioId: a.id,
                    ...(mudouTitulo ? { titulo: tituloEd } : {}),
                    ...(mudouPreco ? { preco: precoNum } : {}),
                  }),
                )
              }
              className="px-4 py-2 rounded-md bg-[#07366A] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-40"
            >
              Salvar título e preço
            </button>
          </div>
          {sugestao && (
            <ul className="text-[11px] text-gray-600 space-y-0.5">
              {sugestao.opcoes.map((o) => (
                <li key={o.tipoAnuncio}>
                  {o.tipoNome}: anunciar por <strong>{brl(o.precoSugerido)}</strong> para receber{" "}
                  {brl(sugestao.precoSite)} (comissão {(o.percentual * 100).toFixed(1)}%)
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Descrição */}
      {d && d.status !== "closed" && (
        <div>
          <button
            type="button"
            onClick={() => setDescAberta((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#07366A] hover:text-[#FF035C]"
          >
            <FileText size={13} aria-hidden="true" />
            {descAberta ? "Fechar descrição" : "Editar descrição"}
          </button>
          {descAberta && (
            <div className="mt-2 space-y-2">
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={10}
                disabled={travado}
                className={`${input} font-mono text-xs leading-relaxed`}
              />
              <div className="flex flex-wrap items-start gap-2">
                <MelhorarDescricao
                  productId={produto.id}
                  composicao={a.composicao}
                  atual={desc}
                  onUsar={setDesc}
                  disabled={travado}
                />
                <RevisarTexto
                  texto={desc}
                  tipo="descricao"
                  onAplicar={setDesc}
                  disabled={travado}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={travado} onClick={usarTextoDoSite} className={botao}>
                  Usar texto do site
                </button>
                <button
                  type="button"
                  disabled={travado || desc.trim() === (d.descricao ?? "").trim()}
                  onClick={() => rodar(() => descricaoAnuncioMl({ anuncioId: a.id, texto: desc }))}
                  className="px-3 py-1.5 rounded-md bg-[#07366A] text-white text-xs font-semibold hover:brightness-110 disabled:opacity-40"
                >
                  Salvar descrição
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                Só texto: o ML não aceita HTML nem link na descrição.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        {d?.status === "paused" && (
          <button
            type="button"
            disabled={travado}
            onClick={() => rodar(() => statusAnuncioMl({ anuncioId: a.id, status: "active" }))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-semibold hover:brightness-110 disabled:opacity-50"
          >
            <Play size={13} aria-hidden="true" />
            Ativar
          </button>
        )}
        {d?.status === "active" && (
          <button
            type="button"
            disabled={travado}
            onClick={() => rodar(() => statusAnuncioMl({ anuncioId: a.id, status: "paused" }))}
            className={botao}
          >
            <Pause size={13} aria-hidden="true" />
            Pausar
          </button>
        )}
        {d && d.status !== "closed" && (
          <button
            type="button"
            disabled={travado}
            onClick={() => rodar(() => atualizarAnuncioMl(a.id))}
            className={botao}
          >
            <RefreshCw size={13} aria-hidden="true" />
            Atualizar fotos e ficha
          </button>
        )}
        {d && d.status !== "closed" && (
          <button
            type="button"
            disabled={travado}
            onClick={() => {
              if (
                window.confirm(
                  "A descrição do anúncio no ML vai ser trocada pelo texto do site: apresentação da loja, texto do produto, envio, licença e garantia. O que foi editado à mão ou pela IA neste anúncio se perde. Continuar?",
                )
              ) {
                rodar(() => atualizarDescricaoDoSiteMl(a.id));
              }
            }}
            className={botao}
          >
            <FileText size={13} aria-hidden="true" />
            Atualizar descrição no ML
          </button>
        )}
        <button
          type="button"
          disabled={travado}
          onClick={() => {
            if (
              window.confirm(
                "Desligar só tira a ligação com este produto: o anúncio continua no ML, mas para de receber estoque daqui. Continuar?",
              )
            ) {
              rodar(() => desligarAnuncioMl(a.id));
            }
          }}
          className={botao}
        >
          <Unlink size={13} aria-hidden="true" />
          Desligar
        </button>
        {d && d.status !== "closed" && (
          <button
            type="button"
            disabled={travado}
            onClick={() => {
              if (
                window.confirm(
                  "Finalizar encerra o anúncio no Mercado Livre e não tem volta: para vender de novo, só publicando outro. Finalizar mesmo?",
                )
              ) {
                rodar(() => statusAnuncioMl({ anuncioId: a.id, status: "closed" }));
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle size={13} aria-hidden="true" />
            Finalizar
          </button>
        )}
      </div>
    </article>
  );
}

function Dado({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-md bg-gray-50 px-2.5 py-2">
      <dt className="text-gray-500">{rotulo}</dt>
      <dd className="text-sm font-semibold text-[#07366A]">{valor}</dd>
      {nota && <dd className="text-[11px] text-amber-700">{nota}</dd>}
    </div>
  );
}

// ── Publicar uma composição ──────────────────────────────────────────────────

function PublicarComposicao({
  productId,
  c,
  pending,
  rodar,
}: {
  productId: string;
  c: ComposicaoPainel;
  pending: boolean;
  rodar: (fn: () => Promise<Resp>) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("gold_special");
  const [preco, setPreco] = useState("");
  const [sugestao, setSugestao] = useState<PrecoSugerido | null>(null);
  const [previa, setPrevia] = useState<Awaited<ReturnType<typeof previaPublicacaoMl>> | null>(null);
  const [ocupado, startLocal] = useTransition();

  function carregar(tipoEscolhido: string) {
    startLocal(async () => {
      const [s, p] = await Promise.all([
        sugestao ? Promise.resolve(null) : sugerirPrecoMl({ productId, composicao: c.composicao }),
        previaPublicacaoMl({ productId, composicao: c.composicao, tipoAnuncio: tipoEscolhido }),
      ]);
      let sug = sugestao;
      if (s) {
        if (s.ok) {
          sug = s.dados;
          setSugestao(s.dados);
        } else {
          toast.error(s.erro);
        }
      }
      const op = sug?.opcoes.find((o) => o.tipoAnuncio === tipoEscolhido);
      setPreco(op ? op.precoSugerido.toFixed(2).replace(".", ",") : String(c.precoSite));
      setPrevia(p);
    });
  }

  const p = previa?.ok ? previa.dados : null;
  const precoNum = numero(preco);
  // Nulo = o texto que o site montou. Editado (à mão ou pela IA) fica guardado
  // mesmo trocando o tipo de anúncio, que remonta a prévia.
  const [tituloEd, setTituloEd] = useState<string | null>(null);
  const [descEd, setDescEd] = useState<string | null>(null);
  const tituloFinal = tituloEd ?? p?.titulo ?? "";
  const descFinal = descEd ?? p?.descricao ?? "";

  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-700">
          <strong className="text-[#07366A]">{c.rotulo}</strong> · site {brl(c.precoSite)} ·{" "}
          {c.disponivel} disponível(is)
        </p>
        {!aberto && (
          <button
            type="button"
            disabled={pending || c.disponivel === 0}
            onClick={() => {
              setAberto(true);
              carregar(tipo);
            }}
            className={botao}
          >
            <Upload size={13} aria-hidden="true" />
            {c.disponivel === 0 ? "Sem estoque" : "Preparar anúncio"}
          </button>
        )}
      </div>

      {aberto && (
        <div className="mt-3 space-y-3">
          {ocupado && !p && <p className="text-xs text-gray-500">Montando a prévia…</p>}
          {previa && !previa.ok && <Aviso>{previa.erro}</Aviso>}

          {sugestao && (
            <div className="space-y-1.5">
              {sugestao.opcoes.map((o) => (
                <label
                  key={o.tipoAnuncio}
                  className={`flex items-start gap-2 rounded-md border p-2.5 cursor-pointer ${
                    tipo === o.tipoAnuncio ? "border-[#FF035C] bg-[#FF035C]/5" : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name={`tipo-${c.composicao}`}
                    checked={tipo === o.tipoAnuncio}
                    onChange={() => {
                      setTipo(o.tipoAnuncio);
                      carregar(o.tipoAnuncio);
                    }}
                    className="mt-0.5 accent-[#FF035C]"
                  />
                  <span className="text-xs text-gray-700 leading-relaxed">
                    <strong className="text-[#07366A]">{o.tipoNome}</strong>: comissão{" "}
                    {(o.percentual * 100).toFixed(1)}%. Anunciar por{" "}
                    <strong>{brl(o.precoSugerido)}</strong> e receber {brl(sugestao.precoSite)}.
                    {o.tipoAnuncio === "gold_pro" && " Tem parcelamento sem juros, que conta na qualidade."}
                    {o.estoqueMax === 1 && " Só 1 unidade por anúncio e 60 dias de validade."}
                  </span>
                </label>
              ))}
            </div>
          )}

          <label className="block w-40">
            <span className="block text-xs text-gray-500 mb-1">Preço no ML (R$)</span>
            <input
              inputMode="decimal"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className={input}
            />
          </label>

          {p && (
            <div className="rounded-md bg-gray-50 p-3 space-y-3 text-xs text-gray-700">
              <div>
                <span className="flex justify-between text-gray-500 mb-1">
                  <span>Título</span>
                  <span className={tituloFinal.length > 60 ? "text-red-600" : ""}>
                    {tituloFinal.length}/60
                  </span>
                </span>
                <input
                  value={tituloFinal}
                  maxLength={60}
                  onChange={(e) => setTituloEd(e.target.value)}
                  className={input}
                />
                <AvisosTitulo titulo={tituloFinal} composicao={c.composicao} />
                <div className="mt-2 flex flex-wrap items-start gap-2">
                  <SugerirTitulos
                    productId={productId}
                    composicao={c.composicao}
                    onUsar={setTituloEd}
                    disabled={ocupado}
                  />
                  <RevisarTexto
                    texto={tituloFinal}
                    tipo="titulo"
                    onAplicar={setTituloEd}
                    disabled={ocupado}
                  />
                </div>
              </div>
              <p>
                <span className="text-gray-500">Quantidade: </span>
                {p.quantidade}
                {p.quantidade < p.disponivel && ` (de ${p.disponivel}; o tipo limita)`}
                <span className="text-gray-500"> · Fotos: </span>
                {p.fotos.length}
              </p>
              <div>
                <span className="text-gray-500">Ficha técnica:</span>
                <ul className="mt-0.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  {p.atributos.map((at) => (
                    <li key={at.id}>
                      {ATRIBUTO[at.id] ?? at.id}: {at.value_name ?? VALOR[at.value_id ?? ""] ?? at.value_id}
                    </li>
                  ))}
                </ul>
              </div>
              <details>
                <summary className="cursor-pointer text-gray-500">
                  Descrição{descEd !== null ? " (editada)" : ""}
                </summary>
                <textarea
                  value={descFinal}
                  onChange={(e) => setDescEd(e.target.value)}
                  rows={12}
                  className={`${input} mt-1 font-mono text-xs leading-relaxed`}
                />
                <div className="mt-2 flex flex-wrap items-start gap-2">
                  <MelhorarDescricao
                    productId={productId}
                    composicao={c.composicao}
                    atual={descFinal}
                    onUsar={setDescEd}
                    disabled={ocupado}
                  />
                  <RevisarTexto
                    texto={descFinal}
                    tipo="descricao"
                    onAplicar={setDescEd}
                    disabled={ocupado}
                  />
                  {descEd !== null && (
                    <button type="button" onClick={() => setDescEd(null)} className={botao}>
                      Voltar ao texto do site
                    </button>
                  )}
                </div>
              </details>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || ocupado || !p || !(precoNum > 0)}
              onClick={() =>
                rodar(() =>
                  publicarProdutoNoMl({
                    productId,
                    composicao: c.composicao,
                    preco: precoNum,
                    tipoAnuncio: tipo,
                    ...(tituloEd !== null ? { titulo: tituloEd } : {}),
                    ...(descEd !== null ? { descricao: descEd } : {}),
                  }),
                )
              }
              className="px-4 py-2 rounded-md bg-[#FF035C] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-40"
            >
              Publicar pausado
            </button>
            <button type="button" onClick={() => setAberto(false)} className={botao}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ligar um anúncio que já existe ───────────────────────────────────────────

function LigarPorNumero({
  productId,
  composicoes,
  pending,
  rodar,
}: {
  productId: string;
  composicoes: ComposicaoPainel[];
  pending: boolean;
  rodar: (fn: () => Promise<Resp>) => void;
}) {
  const [itemId, setItemId] = useState("");
  const [composicao, setComposicao] = useState("");

  return (
    <details className={cartao}>
      <summary className={`${titulo} cursor-pointer flex items-center gap-1.5`}>
        <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
        Ligar anúncio que já existe no ML
      </summary>
      <p className="mt-2 text-xs text-gray-600">
        Para anúncio criado no painel do ML. Ligado, ele passa a receber o estoque daqui e os
        pedidos dele dão baixa neste produto.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block flex-1 min-w-[180px]">
          <span className="block text-xs text-gray-500 mb-1">Número do anúncio</span>
          <input
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            placeholder="MLB7639105290"
            className={input}
          />
        </label>
        {composicoes.length > 0 && (
          <label className="block w-44">
            <span className="block text-xs text-gray-500 mb-1">Composição</span>
            <select
              value={composicao}
              onChange={(e) => setComposicao(e.target.value)}
              className={input}
            >
              <option value="">Escolha…</option>
              {composicoes.map((c) => (
                <option key={c.composicao} value={c.composicao}>
                  {COMPOSICAO_LABEL[c.composicao]}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          disabled={pending || !itemId.trim() || (composicoes.length > 0 && !composicao)}
          onClick={() =>
            rodar(() =>
              ligarAnuncioPorNumeroMl({
                productId,
                itemId,
                composicao: (composicao || null) as TipoComposicao | null,
              }),
            )
          }
          className="px-4 py-2 rounded-md bg-[#07366A] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-40"
        >
          Ligar
        </button>
      </div>
    </details>
  );
}
