"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { GranularidadeSerie, PontoSerie } from "@/lib/queries/financeiro";
import { moedaBR } from "@/lib/financeiro/periodo";

/**
 * Entradas x saídas ao longo do tempo.
 *
 * SVG na mão, sem biblioteca de gráfico: o resto do painel já desenha barra com
 * div e uma lib de chart traria ~100kb para dois caminhos e um tooltip.
 *
 * Cores: teal (entrada) e o rosa da marca (saída). O verde que o painel usa em
 * texto NÃO serve aqui — verde x rosa fica com ΔE 2,7 em deuteranopia, ou seja,
 * quem tem daltonismo vermelho-verde (~8% dos homens) veria duas ondas da mesma
 * cor. O par teal/rosa passa em CVD, contraste e faixa de luminosidade.
 */

const ENTRADA = "#0d9488";
const SAIDA = "#FF035C";

const GRAOS: { valor: GranularidadeSerie; rotulo: string; janela: string }[] = [
  { valor: "dia", rotulo: "Dia", janela: "últimos 30 dias" },
  { valor: "semana", rotulo: "Semana", janela: "últimas 12 semanas" },
  { valor: "mes", rotulo: "Mês", janela: "últimos 12 meses" },
  { valor: "ano", rotulo: "Ano", janela: "últimos 5 anos" },
];

// Geometria em PIXELS reais: o viewBox acompanha a largura medida do container.
// Com viewBox fixo o SVG mantinha proporção e sobrava faixa vazia dos dois lados
// numa tela larga — o desenho ficava ilhado no meio do card.
const L = 52; // respiro à esquerda para os valores do eixo Y
const R = 14;
const TOPO = 14;
const BASE = 26; // espaço dos rótulos do eixo X

/** Valor curto para o eixo: 5000 → "5 mil", 1200 → "1,2 mil", 1.5e6 → "1,5 mi". */
function eixoY(v: number): string {
  const curto = (n: number) =>
    // Só mostra decimal quando ele existe: "5,0 mil" faz o olho parar à toa.
    (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace(".", ",");
  if (v >= 1_000_000) return `${curto(v / 1_000_000)} mi`;
  if (v >= 1_000) return `${curto(v / 1_000)} mil`;
  return String(Math.round(v));
}

/**
 * Escala do eixo Y com passo redondo. Dividir o maior valor em 4 dava marcas
 * como "3,8 mil" e "11 mil" — número quebrado no eixo faz o leitor calcular em
 * vez de ler. Aqui o passo é sempre 1/2/2,5/5/10 vezes uma potência de 10.
 */
function escalaY(max: number): { teto: number; marcas: number[] } {
  if (max <= 0) return { teto: 100, marcas: [0, 25, 50, 75, 100] };
  const bruto = max / 4;
  const base = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo =
    [1, 2, 2.5, 5, 10].map((m) => m * base).find((p) => p >= bruto) ?? 10 * base;
  const teto = Math.ceil(max / passo) * passo;
  const marcas: number[] = [];
  for (let v = 0; v <= teto + passo / 2; v += passo) marcas.push(v);
  return { teto, marcas };
}

/**
 * Curva monotônica (Fritsch–Carlson). Suaviza sem inventar picos: uma spline
 * comum passaria abaixo de zero entre dois dias de movimento parecido, o que num
 * gráfico de dinheiro seria mentira desenhada.
 */
function caminhoSuave(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M ${pts[0].x} ${pts[0].y}`;

  const dx: number[] = [];
  const dy: number[] = [];
  const decl: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    dy.push(pts[i + 1].y - pts[i].y);
    decl.push(dy[i] / (dx[i] || 1));
  }

  const m: number[] = [decl[0]];
  for (let i = 1; i < n - 1; i++) {
    if (decl[i - 1] * decl[i] <= 0) m.push(0);
    else m.push((decl[i - 1] + decl[i]) / 2);
  }
  m.push(decl[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    if (decl[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / decl[i];
    const b = m[i + 1] / decl[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      m[i] = ((3 / h) * a) * decl[i];
      m[i + 1] = ((3 / h) * b) * decl[i];
    }
  }

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const t = dx[i] / 3;
    d += ` C ${pts[i].x + t} ${pts[i].y + m[i] * t}, ${pts[i + 1].x - t} ${
      pts[i + 1].y - m[i + 1] * t
    }, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return d;
}

export function GraficoCaixa({
  pontos,
  granularidade,
  mes,
}: {
  pontos: PontoSerie[];
  granularidade: GranularidadeSerie;
  /** Mês aberto na tela — preservado ao trocar o grão do gráfico. */
  mes?: string;
}) {
  const idBase = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState<number | null>(null);
  // Largura real do container. O valor inicial só vale até a primeira medida.
  const [W, setW] = useState(720);

  useLayoutEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const medir = () => setW(Math.max(280, el.clientWidth));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const H = W < 520 ? 190 : 260;

  const grao = GRAOS.find((g) => g.valor === granularidade) ?? GRAOS[2];

  const { pts, linhas, totalEntradas, totalSaidas } = useMemo(() => {
    const maior = Math.max(0, ...pontos.map((p) => Math.max(p.entradas, p.saidas)));
    const { teto, marcas } = escalaY(maior);
    const larguraUtil = W - L - R;
    const alturaUtil = H - TOPO - BASE;
    const x = (i: number) =>
      pontos.length <= 1
        ? L + larguraUtil / 2
        : L + (i * larguraUtil) / (pontos.length - 1);
    const y = (v: number) => TOPO + alturaUtil - (v / teto) * alturaUtil;

    return {
      pts: pontos.map((p, i) => ({
        ...p,
        x: x(i),
        yEntrada: y(p.entradas),
        ySaida: y(p.saidas),
      })),
      linhas: marcas.map((v) => ({ v, y: y(v) })),
      totalEntradas: pontos.reduce((s, p) => s + p.entradas, 0),
      totalSaidas: pontos.reduce((s, p) => s + p.saidas, 0),
    };
  }, [pontos, W, H]);

  const baseY = TOPO + (H - TOPO - BASE);
  const linhaEntrada = caminhoSuave(pts.map((p) => ({ x: p.x, y: p.yEntrada })));
  const linhaSaida = caminhoSuave(pts.map((p) => ({ x: p.x, y: p.ySaida })));
  const area = (d: string) =>
    pts.length
      ? `${d} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`
      : "";

  // Rótulos do eixo X sem colisão: mostra no máximo ~8 e sempre o último.
  const cabem = Math.max(3, Math.floor((W - L - R) / 64));
  const passo = Math.max(1, Math.ceil(pts.length / cabem));
  const mostraRotulo = (i: number) =>
    i === pts.length - 1 || i % passo === 0;

  function mover(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || pts.length === 0) return;
    const caixa = svg.getBoundingClientRect();
    // Converte o pixel da tela para a coordenada do viewBox.
    const xv = ((e.clientX - caixa.left) / caixa.width) * W;
    let melhor = 0;
    let dist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - xv);
      if (d < dist) {
        dist = d;
        melhor = i;
      }
    });
    setAtivo(melhor);
  }

  const p = ativo != null ? pts[ativo] : null;
  const saldoPeriodo = totalEntradas - totalSaidas;
  const semMovimento = totalEntradas === 0 && totalSaidas === 0;

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide">
            Entradas e saídas
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{grao.janela}</p>
        </div>

        {/* Filtro de grão. Links de verdade: o grão entra na URL e no histórico. */}
        <div
          className="inline-flex rounded-md border border-gray-200 overflow-hidden"
          role="group"
          aria-label="Agrupar o gráfico por"
        >
          {GRAOS.map((g) => {
            const ativoGrao = g.valor === granularidade;
            const query = new URLSearchParams();
            if (mes) query.set("mes", mes);
            query.set("g", g.valor);
            return (
              <Link
                key={g.valor}
                href={`/admin/financeiro?${query.toString()}`}
                scroll={false}
                aria-current={ativoGrao ? "true" : undefined}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  ativoGrao
                    ? "bg-[#07366A] text-white"
                    : "text-gray-500 hover:text-[#07366A] hover:bg-gray-50"
                }`}
              >
                {g.rotulo}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Legenda: identidade nunca depende só da cor da onda. */}
      <div className="flex flex-wrap items-center gap-4 mb-1">
        {[
          { cor: ENTRADA, nome: "Entradas", total: totalEntradas },
          { cor: SAIDA, nome: "Saídas", total: totalSaidas },
        ].map((s) => (
          <span key={s.nome} className="inline-flex items-center gap-1.5">
            <svg width="14" height="4" aria-hidden="true">
              <rect width="14" height="4" rx="2" fill={s.cor} />
            </svg>
            <span className="text-xs text-gray-600">{s.nome}</span>
            <span className="text-xs font-medium text-[#07366A]">
              {moedaBR.format(s.total)}
            </span>
          </span>
        ))}
        <span className="text-xs text-gray-500">
          saldo{" "}
          <span
            className={`font-medium ${
              saldoPeriodo < 0 ? "text-[#FF035C]" : "text-[#07366A]"
            }`}
          >
            {moedaBR.format(saldoPeriodo)}
          </span>
        </span>
      </div>

      <div className="relative" ref={caixaRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block w-full touch-none"
          role="img"
          aria-label={`Entradas e saídas por ${grao.rotulo.toLowerCase()}, ${grao.janela}. Entradas ${moedaBR.format(totalEntradas)}, saídas ${moedaBR.format(totalSaidas)}.`}
          onPointerMove={mover}
          onPointerLeave={() => setAtivo(null)}
        >
          <defs>
            <linearGradient id={`${idBase}-e`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ENTRADA} stopOpacity="0.16" />
              <stop offset="100%" stopColor={ENTRADA} stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id={`${idBase}-s`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SAIDA} stopOpacity="0.16" />
              <stop offset="100%" stopColor={SAIDA} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grade: hairline sólida, um passo acima da superfície. */}
          {linhas.map((l) => (
            <g key={l.v}>
              <line
                x1={L}
                y1={l.y}
                x2={W - R}
                y2={l.y}
                stroke="#eceded"
                strokeWidth="1"
              />
              <text
                x={L - 8}
                y={l.y + 3.5}
                textAnchor="end"
                className="fill-gray-400"
                style={{ fontSize: 10 }}
              >
                {eixoY(l.v)}
              </text>
            </g>
          ))}

          {!semMovimento && (
            <>
              <path d={area(linhaSaida)} fill={`url(#${idBase}-s)`} />
              <path d={area(linhaEntrada)} fill={`url(#${idBase}-e)`} />
              <path
                d={linhaSaida}
                fill="none"
                stroke={SAIDA}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={linhaEntrada}
                fill="none"
                stroke={ENTRADA}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Rótulos do eixo X */}
          {pts.map((pt, i) =>
            mostraRotulo(i) ? (
              <text
                key={pt.chave}
                x={pt.x}
                y={H - 8}
                textAnchor={i === pts.length - 1 ? "end" : "middle"}
                className="fill-gray-400"
                style={{ fontSize: 10 }}
              >
                {pt.rotulo}
              </text>
            ) : null,
          )}

          {/* Crosshair + marcadores do ponto sob o cursor */}
          {p && !semMovimento && (
            <g>
              <line
                x1={p.x}
                y1={TOPO}
                x2={p.x}
                y2={baseY}
                stroke="#c9cccd"
                strokeWidth="1"
              />
              {[
                { y: p.ySaida, cor: SAIDA },
                { y: p.yEntrada, cor: ENTRADA },
              ].map((m) => (
                <circle
                  key={m.cor}
                  cx={p.x}
                  cy={m.y}
                  r="4"
                  fill={m.cor}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              ))}
            </g>
          )}
        </svg>

        {/* Tooltip: valor em destaque, nome da série em segundo plano. */}
        {p && (
          <div
            className="pointer-events-none absolute top-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 shadow-sm"
            style={{
              left: `${(p.x / W) * 100}%`,
              transform:
                p.x > W * 0.6 ? "translateX(-105%)" : "translateX(5%)",
            }}
          >
            <p className="text-[11px] text-gray-500 mb-1">{p.rotuloLongo}</p>
            {[
              { cor: ENTRADA, nome: "entradas", v: p.entradas },
              { cor: SAIDA, nome: "saídas", v: p.saidas },
            ].map((s) => (
              <p key={s.nome} className="flex items-center gap-1.5 text-xs">
                <svg width="10" height="3" aria-hidden="true">
                  <rect width="10" height="3" rx="1.5" fill={s.cor} />
                </svg>
                <span className="font-medium text-[#07366A]">
                  {moedaBR.format(s.v)}
                </span>
                <span className="text-gray-500">{s.nome}</span>
              </p>
            ))}
          </div>
        )}

        {semMovimento && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Nenhum lançamento confirmado neste período.
          </p>
        )}
      </div>

      {/* Os números também sem depender do hover. */}
      <details className="mt-2">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-[#07366A]">
          Ver os números em tabela
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500">
              <tr className="border-b border-gray-100">
                <th className="text-left font-medium py-1.5">Período</th>
                <th className="text-right font-medium py-1.5">Entradas</th>
                <th className="text-right font-medium py-1.5">Saídas</th>
                <th className="text-right font-medium py-1.5">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((pt) => (
                <tr key={pt.chave} className="border-b border-gray-50">
                  <td className="py-1.5 text-gray-600">{pt.rotuloLongo}</td>
                  <td className="py-1.5 text-right text-[#07366A]">
                    {moedaBR.format(pt.entradas)}
                  </td>
                  <td className="py-1.5 text-right text-[#07366A]">
                    {moedaBR.format(pt.saidas)}
                  </td>
                  <td className="py-1.5 text-right text-gray-600">
                    {moedaBR.format(pt.entradas - pt.saidas)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
