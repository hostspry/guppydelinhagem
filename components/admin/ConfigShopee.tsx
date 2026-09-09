"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Copy,
  Link2,
  Loader2,
  Package,
  RefreshCw,
  ShoppingBag,
  Unlink,
} from "lucide-react";
import { FormField } from "@/components/admin/FormField";
import {
  salvarCredenciaisShopee,
  linkAutorizacaoShopee,
  testarConexaoShopee,
  renovarTokenShopee,
  importarAgoraShopee,
  sincronizarEstoqueAgora,
  listarAnunciosShopee,
  ligarAnuncio,
  desligarAnuncio,
  type AnuncioShopee,
} from "@/actions/shopee";

type Inicial = {
  ativo: boolean;
  ambiente: "SANDBOX" | "PRODUCAO";
  partnerId: string;
  temChave: boolean;
  shopId: string | null;
  tokenExpiraEm: Date | null;
  diasParaExpirar: number | null;
  ultimaSincronizacaoEm: Date | null;
  ultimoErro: string | null;
};

type Ligacao = {
  id: string;
  itemId: string;
  modelId: string | null;
  titulo: string | null;
  estoqueEnviado: number | null;
  sincronizadoEm: Date | null;
  ultimoErro: string | null;
  produtoNome: string;
  produtoEstoque: number;
};

type Produto = { id: string; nome: string; estoque: number };

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";
const botao =
  "inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-3 py-2 rounded-md hover:border-[#07366A] transition-all disabled:opacity-60";

function quando(d: Date | null): string {
  if (!d) return "nunca";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ConfigShopee({
  inicial,
  enderecos,
  ligacoes,
  produtos,
}: {
  inicial: Inicial;
  enderecos: { callback: string; webhook: string };
  ligacoes: Ligacao[];
  produtos: Produto[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [ambiente, setAmbiente] = useState(inicial.ambiente);
  const [partnerId, setPartnerId] = useState(inicial.partnerId);
  const [partnerKey, setPartnerKey] = useState("");
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [copiado, setCopiado] = useState<string | null>(null);

  const [anuncios, setAnuncios] = useState<AnuncioShopee[] | null>(null);
  const [escolha, setEscolha] = useState<Record<string, string>>({});

  const conectado = !!inicial.shopId;
  const chave = (a: AnuncioShopee) => `${a.itemId}:${a.modelId ?? ""}`;

  /** Roda a ação e mostra o resultado, que é o mesmo em todos os botões daqui. */
  function acao(fn: () => Promise<{ ok: boolean; mensagem?: string; erro?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.mensagem ?? "Pronto.");
        router.refresh();
      } else {
        toast.error(r.erro ?? "Não deu certo.");
      }
    });
  }

  function copiar(texto: string, qual: string) {
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setCopiado(qual);
        toast.success("Copiado.");
        setTimeout(() => setCopiado(null), 2000);
      })
      .catch(() => toast.error(`Copie na mão: ${texto}`));
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* ── Como ligar ── */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold mb-2">Antes de preencher</p>
        <ol className="list-decimal ml-4 space-y-1 text-xs leading-relaxed">
          <li>
            Abra <strong>open.shopee.com</strong>, entre com a conta da sua loja e
            crie um app. Sai um <strong>partner ID</strong> e uma{" "}
            <strong>partner key</strong>.
          </li>
          <li>
            No app, cadastre estes dois endereços exatamente como estão aqui — a
            Shopee compara caractere a caractere:
          </li>
        </ol>
        <div className="mt-2 space-y-1.5">
          {[
            ["Redirect / callback", enderecos.callback, "callback"],
            ["Push / webhook", enderecos.webhook, "webhook"],
          ].map(([rotulo, valor, id]) => (
            <div key={id} className="flex items-center gap-2">
              <span className="text-xs w-36 shrink-0">{rotulo}</span>
              <code className="flex-1 min-w-0 truncate rounded bg-white px-2 py-1 text-[11px] text-[#07366A]">
                {valor}
              </code>
              <button type="button" onClick={() => copiar(valor, id)} className="shrink-0 text-blue-700 hover:text-blue-900">
                {copiado === id ? (
                  <Check className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Copy className="w-4 h-4" aria-hidden="true" />
                )}
                <span className="sr-only">Copiar {rotulo}</span>
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs">
          A Shopee não vende bicho vivo, então só produto seco (criadeira, ração,
          acessório) entra aqui. Peixe fica só no site.
        </p>
      </div>

      {/* ── Credenciais ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-4 flex items-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
          Credenciais
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <FormField label="Ambiente" name="ambiente">
            <select
              id="ambiente"
              value={ambiente}
              onChange={(e) => setAmbiente(e.target.value as "SANDBOX" | "PRODUCAO")}
              className={input}
            >
              <option value="SANDBOX">Sandbox (teste)</option>
              <option value="PRODUCAO">Produção (loja de verdade)</option>
            </select>
          </FormField>

          <FormField label="Partner ID" name="partnerId">
            <input
              id="partnerId"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className={input}
              inputMode="numeric"
              placeholder="1005678"
            />
          </FormField>

          <div className="sm:col-span-2">
            <FormField
              label="Partner key"
              name="partnerKey"
              hint={
                inicial.temChave
                  ? "Já salva. Deixe em branco para manter a que está guardada."
                  : "Some da tela depois de salva — guarde uma cópia com você."
              }
            >
              <input
                id="partnerKey"
                type="password"
                value={partnerKey}
                onChange={(e) => setPartnerKey(e.target.value)}
                className={input}
                placeholder={inicial.temChave ? "••••••••••••" : "cole aqui"}
                autoComplete="off"
              />
            </FormField>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 mt-1">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="w-4 h-4 accent-[#FF035C]"
          />
          Integração ligada (importa pedidos e sincroniza estoque)
        </label>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              acao(() =>
                salvarCredenciaisShopee({ ambiente, partnerId, partnerKey, ativo }),
              )
            }
            className="inline-flex items-center gap-1.5 bg-[#07366A] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-125 transition-all disabled:opacity-60"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            Salvar
          </button>

          <button
            type="button"
            disabled={isPending}
            className={botao}
            onClick={() =>
              startTransition(async () => {
                const r = await linkAutorizacaoShopee();
                if (!r.ok) {
                  toast.error(r.erro);
                  return;
                }
                // A autorização acontece no site da Shopee, com a conta do dono.
                if (r.url) window.location.href = r.url;
              })
            }
          >
            <Link2 className="w-4 h-4" aria-hidden="true" />
            {conectado ? "Autorizar de novo" : "Autorizar a loja"}
          </button>
        </div>
      </div>

      {/* ── Situação ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          Situação
        </h2>

        {inicial.ultimoErro && (
          <p className="mb-3 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            {inicial.ultimoErro}
          </p>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 text-xs text-gray-600">
          <div>
            <dt className="inline font-medium">Loja: </dt>
            <dd className="inline">{inicial.shopId ?? "não autorizada"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Token vence: </dt>
            <dd className="inline">{quando(inicial.tokenExpiraEm)}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Última importação: </dt>
            <dd className="inline">{quando(inicial.ultimaSincronizacaoEm)}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Autorização expira em: </dt>
            <dd className="inline">
              {inicial.diasParaExpirar == null
                ? "—"
                : `${inicial.diasParaExpirar} dia(s)`}
            </dd>
          </div>
        </dl>

        {inicial.diasParaExpirar != null && inicial.diasParaExpirar <= 5 && (
          <p className="mt-3 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            A Shopee derruba a autorização com 30 dias sem uso. Se o cron não
            estiver rodando, autorize a loja de novo antes que zere.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" disabled={isPending} className={botao} onClick={() => acao(testarConexaoShopee)}>
            <Check className="w-4 h-4" aria-hidden="true" />
            Testar conexão
          </button>
          <button type="button" disabled={isPending} className={botao} onClick={() => acao(renovarTokenShopee)}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Renovar token
          </button>
          <button type="button" disabled={isPending} className={botao} onClick={() => acao(importarAgoraShopee)}>
            <Package className="w-4 h-4" aria-hidden="true" />
            Importar pedidos
          </button>
          <button type="button" disabled={isPending} className={botao} onClick={() => acao(sincronizarEstoqueAgora)}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Sincronizar estoque
          </button>
        </div>
      </div>

      {/* ── Ligações ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-1">
          Anúncios ligados
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Anúncio ligado recebe o estoque do site e, quando vende lá, baixa o
          estoque aqui. O que não estiver ligado ainda entra como pedido, só não
          mexe no estoque.
        </p>

        {ligacoes.length === 0 ? (
          <p className="text-sm text-gray-500">Nada ligado ainda.</p>
        ) : (
          <ul className="space-y-1.5 mb-4">
            {ligacoes.map((l) => {
              const bate = l.estoqueEnviado === Math.max(0, l.produtoEstoque);
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <span className="min-w-0 text-sm text-gray-700">
                    <strong className="text-[#07366A]">{l.produtoNome}</strong>
                    <span className="block text-xs text-gray-500 truncate">
                      {l.titulo ?? l.itemId} · site {l.produtoEstoque} ·{" "}
                      {l.estoqueEnviado == null
                        ? "nunca enviado"
                        : `Shopee ${l.estoqueEnviado}`}
                      {!bate && l.estoqueEnviado != null && " · fora de sincronia"}
                    </span>
                    {l.ultimoErro && (
                      <span className="block text-xs text-red-600">{l.ultimoErro}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => acao(() => desligarAnuncio(l.id))}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600"
                  >
                    <Unlink className="w-3.5 h-3.5" aria-hidden="true" />
                    Desligar
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          disabled={isPending || !conectado}
          className={botao}
          title={conectado ? undefined : "Autorize a loja primeiro."}
          onClick={() =>
            startTransition(async () => {
              const r = await listarAnunciosShopee();
              if (!r.ok) {
                toast.error(r.erro);
                return;
              }
              setAnuncios(r.anuncios);
              if (r.anuncios.length === 0) toast.info("Nenhum anúncio ativo na loja.");
            })
          }
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Link2 className="w-4 h-4" aria-hidden="true" />
          )}
          Buscar anúncios da Shopee
        </button>

        {anuncios && anuncios.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {anuncios.map((a) => (
              <div
                key={chave(a)}
                className="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 px-3 py-2"
              >
                <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">
                  {a.titulo}
                  {a.jaLigado && (
                    <span className="ml-1.5 text-xs text-green-700">(já ligado)</span>
                  )}
                </span>
                <select
                  value={escolha[chave(a)] ?? ""}
                  onChange={(e) =>
                    setEscolha((x) => ({ ...x, [chave(a)]: e.target.value }))
                  }
                  className="w-48 px-2 py-1.5 border border-gray-300 rounded-md text-xs"
                >
                  <option value="">Escolha o produto…</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.estoque})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isPending || !escolha[chave(a)]}
                  onClick={() =>
                    acao(() =>
                      ligarAnuncio({
                        productId: escolha[chave(a)],
                        itemId: a.itemId,
                        modelId: a.modelId,
                        titulo: a.titulo,
                      }),
                    )
                  }
                  className="text-xs font-medium text-[#FF035C] hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  Ligar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
