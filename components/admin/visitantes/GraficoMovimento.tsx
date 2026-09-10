"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SERIE, CHROME } from "./paleta";

export type Ponto = { rotulo: string; completo: string; sessoes: number; pessoas: number };

/**
 * Movimento ao longo do tempo: visitas e pessoas distintas.
 *
 * SVG na mão, sem biblioteca de gráfico. São duas linhas e um eixo — uma
 * biblioteca traria 50 kB para o painel e um tema para brigar com o nosso.
 *
 * Duas séries, então a legenda é obrigatória: quem não distingue as duas cores
 * precisa de outro caminho para saber qual linha é qual. Além dela, cada linha
 * leva o valor no ponto final, e o tooltip mostra as duas juntas.
 */
export function GraficoMovimento({
  pontos,
  descricao,
}: {
  pontos: Ponto[];
  descricao: string;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState<number | null>(null);

  /**
   * A largura do viewBox acompanha a largura real do cartão.
   *
   * Com viewBox fixo, o SVG mantém proporção e centraliza: num cartão largo
   * sobrava metade em branco de cada lado. `preserveAspectRatio="none"` encheria
   * a largura, mas esticaria o texto e deixaria as pontas do traço ovais.
   * Medindo, 1 unidade do desenho = 1 pixel na tela, e nada distorce.
   */
  const [W, setW] = useState(720);
  useLayoutEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const medir = () => setW(Math.max(320, Math.round(el.getBoundingClientRect().width)));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const L = 44, R = 16, T = 14, B = 26;
  const H = 220;
  const largura = W - L - R;
  const altura = H - T - B;

  const { maxY, ticks } = useMemo(() => {
    const bruto = Math.max(1, ...pontos.map((p) => Math.max(p.sessoes, p.pessoas)));

    // Escala "redonda": o passo tem que ser 1, 2, 5 ou 10 vezes uma potência de
    // dez, e o topo um múltiplo dele. Dividir o máximo em quatro e arredondar
    // cada marca, que era o jeito antigo, produzia eixo 0-2-4-5-7 num máximo de
    // 7: as marcas ficam igualmente espaçadas na tela e desigualmente
    // espaçadas em valor, que é exatamente o que uma escala não pode fazer.
    const alvo = 5; // marcas acima do zero
    const cru = bruto / alvo;
    const grandeza = Math.pow(10, Math.floor(Math.log10(cru)));
    // Piso de 1: visita é coisa contada, não medida. Sem o piso, um dia de
    // máximo 1 gerava passo 0,5 e o eixo saa "0, 1, 1" — a mesma marca duas
    // vezes, porque 0,5 e 1 arredondam para o mesmo inteiro.
    const passo = Math.max(
      1,
      [1, 2, 2.5, 5, 10].map((m) => m * grandeza).find((v) => v >= cru) ?? 10 * grandeza,
    );
    const topo = Math.ceil(bruto / passo) * passo;

    const marcas: number[] = [];
    for (let v = 0; v <= topo + passo / 2; v += passo) marcas.push(Math.round(v));
    return { maxY: topo, ticks: marcas };
  }, [pontos]);

  const x = (i: number) =>
    pontos.length <= 1 ? L + largura / 2 : L + (i / (pontos.length - 1)) * largura;
  const y = (v: number) => T + altura - (v / maxY) * altura;

  const caminho = (chave: "sessoes" | "pessoas") =>
    pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[chave])}`).join(" ");

  /**
   * A faixa entre as duas linhas são as visitas repetidas.
   *
   * Existe por um motivo prático: visita nunca é menor que pessoa, e num dia em
   * que cada pessoa entrou uma vez só, as duas linhas ficam exatamente uma sobre
   * a outra — a de baixo some e o gráfico parece quebrado. Com a faixa, faixa
   * fina quer dizer "ninguém voltou" e faixa larga quer dizer "muita gente
   * voltou". O vazio passa a dizer alguma coisa.
   */
  const faixa =
    pontos.length < 2
      ? ""
      : [
          pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.sessoes)}`).join(" "),
          [...pontos]
            .map((p, i) => ({ p, i }))
            .reverse()
            .map(({ p, i }) => `L ${x(i)} ${y(p.pessoas)}`)
            .join(" "),
          "Z",
        ].join(" ");

  /** Acha o ponto mais perto do cursor: o leitor mira numa data, não num traço. */
  function mover(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || pontos.length === 0) return;
    const caixa = svg.getBoundingClientRect();
    const relativo = ((e.clientX - caixa.left) / caixa.width) * W;
    const passo = pontos.length <= 1 ? largura : largura / (pontos.length - 1);
    const i = Math.round((relativo - L) / passo);
    setAtivo(Math.min(pontos.length - 1, Math.max(0, i)));
  }

  const p = ativo == null ? null : pontos[ativo];
  const ultimo = pontos.at(-1);

  // Quantos rótulos cabem no eixo sem colidir. Medido pela largura do viewBox,
  // não chutado: 56 px por rótulo é o que "09/09" ocupa com folga.
  const passoRotulo = Math.max(1, Math.ceil(pontos.length / Math.floor(largura / 56)));

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{descricao}</figcaption>

      <div className="flex items-center gap-4 mb-2 text-xs" aria-hidden="true">
        {[
          { cor: SERIE.um, nome: "Visitas" },
          { cor: SERIE.dois, nome: "Pessoas" },
        ].map((s) => (
          <span key={s.nome} className="inline-flex items-center gap-1.5 text-gray-500">
            <svg width="14" height="4" aria-hidden="true">
              <line x1="0" y1="2" x2="14" y2="2" stroke={s.cor} strokeWidth="2" strokeLinecap="round" />
            </svg>
            {s.nome}
          </span>
        ))}
      </div>

      <div className="relative" ref={caixaRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[220px] touch-none"
          role="img"
          aria-label={descricao}
          onPointerMove={mover}
          onPointerLeave={() => setAtivo(null)}
        >
          {/* Grade recessiva: 1px, sólida, um passo fora da superfície. */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={CHROME.grade} strokeWidth="1" />
              <text
                x={L - 8}
                y={y(t) + 3.5}
                textAnchor="end"
                fontSize="10"
                fill={CHROME.textoFraco}
              >
                {t.toLocaleString("pt-BR")}
              </text>
            </g>
          ))}

          {pontos.map((pt, i) =>
            i % passoRotulo === 0 || i === pontos.length - 1 ? (
              <text
                key={`${id}-r-${i}`}
                x={x(i)}
                y={H - 8}
                textAnchor={i === 0 ? "start" : i === pontos.length - 1 ? "end" : "middle"}
                fontSize="10"
                fill={CHROME.textoFraco}
              >
                {pt.rotulo}
              </text>
            ) : null,
          )}

          {/* Crosshair antes das linhas, para não passar por cima do dado. */}
          {p && ativo != null && (
            <line
              x1={x(ativo)}
              x2={x(ativo)}
              y1={T}
              y2={T + altura}
              stroke={CHROME.eixo}
              strokeWidth="1"
            />
          )}

          {faixa && <path d={faixa} fill={SERIE.um} fillOpacity="0.1" stroke="none" />}

          <path d={caminho("sessoes")} fill="none" stroke={SERIE.um} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={caminho("pessoas")} fill="none" stroke={SERIE.dois} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* Ponto final rotulado: o valor de hoje sem precisar passar o mouse. */}
          {ultimo && pontos.length > 1 && (
            <>
              <circle cx={x(pontos.length - 1)} cy={y(ultimo.sessoes)} r="4" fill={SERIE.um} stroke={CHROME.superficie} strokeWidth="2" />
              <circle cx={x(pontos.length - 1)} cy={y(ultimo.pessoas)} r="4" fill={SERIE.dois} stroke={CHROME.superficie} strokeWidth="2" />
            </>
          )}

          {/* Marcador do ponto sob o cursor, com anel da superfície. */}
          {p && ativo != null && (
            <>
              <circle cx={x(ativo)} cy={y(p.sessoes)} r="4.5" fill={SERIE.um} stroke={CHROME.superficie} strokeWidth="2" />
              <circle cx={x(ativo)} cy={y(p.pessoas)} r="4.5" fill={SERIE.dois} stroke={CHROME.superficie} strokeWidth="2" />
            </>
          )}
        </svg>

        {/* Tooltip: valor em destaque, nome da série em segundo plano. */}
        {p && ativo != null && (
          <div
            className="pointer-events-none absolute top-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm"
            style={{
              left: `${(x(ativo) / W) * 100}%`,
              transform:
                ativo > pontos.length / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
            }}
          >
            <div className="font-medium text-[#07366A] mb-0.5">{p.completo}</div>
            {[
              { cor: SERIE.um, nome: "visitas", valor: p.sessoes },
              { cor: SERIE.dois, nome: "pessoas", valor: p.pessoas },
            ].map((s) => (
              <div key={s.nome} className="flex items-center gap-1.5 whitespace-nowrap">
                <svg width="10" height="3" aria-hidden="true">
                  <line x1="0" y1="1.5" x2="10" y2="1.5" stroke={s.cor} strokeWidth="2" strokeLinecap="round" />
                </svg>
                <strong className="text-gray-800">{s.valor.toLocaleString("pt-BR")}</strong>
                <span className="text-gray-400">{s.nome}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
