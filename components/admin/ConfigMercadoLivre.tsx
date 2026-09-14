"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Copy,
  Check,
  Link2,
  RefreshCw,
  Unlink,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  salvarCredenciaisMl,
  linkAutorizacaoMl,
  testarConexaoMl,
  renovarTokenMl,
  sincronizarEstoqueMlAgora,
  listarAnunciosMl,
  ligarAnuncioMl,
  desligarAnuncioMl,
  type AnuncioMl,
} from "@/actions/mercadolivre";

/**
 * Tela da integração com o Mercado Livre.
 *
 * Diferente da Shopee, aqui PEIXE entra: o ML aceita peixe ornamental vivo desde
 * que o anúncio traga o número da licença do IBAMA. Por isso a lista de produtos
 * não filtra por tipo — só avisa o que é peixe, porque o estoque dele vem do
 * pool de machos e fêmeas.
 */

type Ligacao = {
  id: string;
  itemId: string;
  variationId: string | null;
  titulo: string | null;
  estoqueEnviado: number | null;
  sincronizadoEm: Date | null;
  ultimoErro: string | null;
  produtoNome: string;
  produtoEstoque: number;
};

type Produto = { id: string; nome: string; estoque: number; ehPeixe: boolean };

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export function ConfigMercadoLivre({
  inicial,
  enderecos,
  ligacoes,
  produtos,
}: {
  inicial: {
    ativo: boolean;
    clientId: string;
    temSecret: boolean;
    sellerId: string | null;
    apelido: string | null;
    tokenExpiraEm: Date | null;
    diasParaExpirar: number | null;
    ultimaSincronizacaoEm: Date | null;
    ultimoErro: string | null;
  };
  enderecos: { redirect: string; notificacoes: string };
  ligacoes: Ligacao[];
  produtos: Produto[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(inicial.clientId);
  const [clientSecret, setClientSecret] = useState("");
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [anuncios, setAnuncios] = useState<AnuncioMl[] | null>(null);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const conectado = !!inicial.sellerId;

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

  function rodar(fn: () => Promise<{ ok: boolean; mensagem?: string; erro?: string; url?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.erro ?? "Não deu certo.");
        return;
      }
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      toast.success(r.mensagem ?? "Pronto.");
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* ── Como ligar ── */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold mb-2">Antes de preencher</p>
        <ol className="list-decimal ml-4 space-y-1 text-xs leading-relaxed">
          <li>
            Abra <strong>developers.mercadolivre.com.br</strong> com a conta da
            loja e crie uma aplicação. Saem um <strong>App ID</strong> (só
            números) e um <strong>Secret Key</strong>.
          </li>
          <li>
            Na aplicação, cadastre estes dois endereços exatamente como estão
            aqui:
          </li>
        </ol>
        <div className="mt-2 space-y-1.5">
          {[
            ["Redirect URI", enderecos.redirect, "redirect"],
            ["Notificações (webhook)", enderecos.notificacoes, "webhook"],
          ].map(([rotulo, valor, id]) => (
            <div key={id} className="flex items-center gap-2">
              <span className="text-xs w-40 shrink-0">{rotulo}</span>
              <code className="flex-1 min-w-0 truncate rounded bg-white px-2 py-1 text-[11px] text-[#07366A]">
                {valor}
              </code>
              <button
                type="button"
                onClick={() => copiar(valor, id)}
                className="shrink-0 text-blue-700 hover:text-blue-900"
              >
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
          Nas notificações, marque os tópicos <strong>orders_v2</strong> e{" "}
          <strong>items</strong>. E lembre: anúncio de peixe vivo no ML precisa
          do número da licença do IBAMA, senão o anúncio cai.
        </p>
      </div>

      {/* ── Credenciais ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-4 flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5" aria-hidden="true" />
          Credenciais
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm text-gray-700 mb-1">App ID</span>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="1234567890123456"
              className={input}
            />
          </label>
          <label className="block">
            <span className="block text-sm text-gray-700 mb-1">
              Secret Key{" "}
              {inicial.temSecret && (
                <span className="text-xs text-gray-400">(salvo, só preencha para trocar)</span>
              )}
            </span>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={inicial.temSecret ? "••••••••" : "cole aqui"}
              className={input}
            />
          </label>
        </div>

        <label className="mt-3 flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#FF035C]"
          />
          <span className="text-sm text-gray-700">
            <span className="font-medium text-[#07366A]">Integração ligada</span>{" "}
            — desligada, o estoque para de ser enviado e os pedidos param de ser
            importados.
          </span>
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              rodar(() => salvarCredenciaisMl({ clientId, clientSecret, ativo }))
            }
            className="px-4 py-2 rounded-md bg-[#07366A] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-60"
          >
            Salvar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => rodar(linkAutorizacaoMl)}
            className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:border-[#07366A] disabled:opacity-60"
          >
            {conectado ? "Autorizar de novo" : "Autorizar a conta"}
          </button>
        </div>
      </div>

      {/* ── Situação ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-2 text-sm">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-2">
          Situação
        </h2>
        <p>
          <span className="font-medium">Conta: </span>
          {conectado ? (
            <span className="text-green-700">
              {inicial.apelido ?? "conectada"} ({inicial.sellerId})
            </span>
          ) : (
            <span className="text-gray-500">não autorizada</span>
          )}
        </p>
        {inicial.tokenExpiraEm && (
          <p className="text-gray-600">
            <span className="font-medium">Token vence: </span>
            {new Date(inicial.tokenExpiraEm).toLocaleString("pt-BR")}
          </p>
        )}
        {inicial.diasParaExpirar != null && (
          <p
            className={
              inicial.diasParaExpirar < 15 ? "text-amber-700" : "text-gray-600"
            }
          >
            <span className="font-medium">Autorização expira em: </span>
            {inicial.diasParaExpirar} dia(s)
          </p>
        )}
        {inicial.ultimaSincronizacaoEm && (
          <p className="text-gray-600">
            <span className="font-medium">Última importação: </span>
            {new Date(inicial.ultimaSincronizacaoEm).toLocaleString("pt-BR")}
          </p>
        )}
        {inicial.ultimoErro && (
          <p className="flex items-start gap-1.5 text-red-700 text-xs bg-red-50 border border-red-200 rounded p-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
            {inicial.ultimoErro}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => rodar(testarConexaoMl)}
            className="px-3 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:border-[#07366A] disabled:opacity-60"
          >
            Testar conexão
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => rodar(renovarTokenMl)}
            className="px-3 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:border-[#07366A] disabled:opacity-60"
          >
            Renovar token
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => rodar(sincronizarEstoqueMlAgora)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:border-[#07366A] disabled:opacity-60"
          >
            <RefreshCw size={13} aria-hidden="true" />
            Sincronizar estoque
          </button>
        </div>
      </div>

      {/* ── Anúncios ligados ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
            Anúncios ligados
          </h2>
          <button
            type="button"
            disabled={pending || !conectado}
            onClick={() =>
              startTransition(async () => {
                const r = await listarAnunciosMl();
                if (!r.ok) {
                  toast.error(r.erro);
                  return;
                }
                setAnuncios(r.anuncios);
                if (r.anuncios.length === 0) {
                  toast.info("Nenhum anúncio ativo na conta.");
                }
              })
            }
            className="text-xs font-medium text-[#07366A] hover:text-[#FF035C] disabled:opacity-50"
          >
            Buscar anúncios do ML
          </button>
        </div>

        {ligacoes.length === 0 ? (
          <p className="text-sm text-gray-500">Nada ligado ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {ligacoes.map((l) => (
              <li key={l.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-[#07366A] truncate">
                    {l.titulo ?? l.itemId}
                  </p>
                  <p className="text-xs text-gray-500">
                    {l.itemId}
                    {l.variationId ? ` · var ${l.variationId}` : ""} →{" "}
                    <span className="text-gray-700">{l.produtoNome}</span> (site:{" "}
                    {l.produtoEstoque}
                    {l.estoqueEnviado != null ? `, enviado: ${l.estoqueEnviado}` : ""})
                  </p>
                  {l.ultimoErro && (
                    <p className="text-xs text-red-700 mt-0.5">{l.ultimoErro}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => rodar(() => desligarAnuncioMl(l.id))}
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-700 disabled:opacity-50"
                >
                  <Unlink size={13} aria-hidden="true" />
                  Desligar
                </button>
              </li>
            ))}
          </ul>
        )}

        {anuncios && anuncios.length > 0 && (
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-medium text-gray-700">
              Escolha o produto do site para cada anúncio
            </p>
            {anuncios.map((a) => {
              const chave = `${a.itemId}:${a.variationId ?? ""}`;
              return (
                <div key={chave} className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 min-w-[200px] text-xs text-gray-700 truncate">
                    {a.titulo}{" "}
                    <span className="text-gray-400">
                      ({a.estoque} no ML{a.jaLigado ? ", já ligado" : ""})
                    </span>
                  </span>
                  <select
                    value={escolha[chave] ?? ""}
                    onChange={(e) =>
                      setEscolha((s) => ({ ...s, [chave]: e.target.value }))
                    }
                    className="min-w-[180px] px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white"
                  >
                    <option value="">Escolha o produto…</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.estoque}){p.ehPeixe ? " · peixe" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pending || !escolha[chave]}
                    onClick={() =>
                      rodar(() =>
                        ligarAnuncioMl({
                          productId: escolha[chave],
                          itemId: a.itemId,
                          variationId: a.variationId,
                          titulo: a.titulo,
                        }),
                      )
                    }
                    className="px-3 py-1.5 rounded-md bg-[#FF035C] text-white text-xs font-semibold hover:brightness-110 disabled:opacity-40"
                  >
                    Ligar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
