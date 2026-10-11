"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Maximize2, Minimize2, Volume2, VolumeX, Timer, Accessibility } from "lucide-react";

/**
 * Roleta de apresentação.
 *
 * Ela NÃO sorteia. Recebe o bilhete já escolhido no servidor e só anima até
 * ele. Cada participante é uma fatia do tamanho exato dos seus bilhetes, e
 * cada bilhete ocupa 360°/total dentro da fatia: o ponteiro para no arco do
 * bilhete sorteado, e o contador embaixo mostra, quadro a quadro, qual bilhete
 * está sob o ponteiro. É assim que 226 bilhetes cabem numa roleta legível sem
 * perder a correspondência com o resultado.
 */

export type Fatia = { inicio: number; fim: number; rotulo: string };
export type ResultadoApresentado = { bilhete: number; vencedorPublico: string; ensaio?: boolean };

const CORES = [
  { fundo: "#07366A", texto: "#FFFFFF" },
  { fundo: "#FF035C", texto: "#FFFFFF" },
  { fundo: "#FAB82A", texto: "#302F2F" },
  { fundo: "#0E4C8F", texto: "#FFFFFF" },
  { fundo: "#C8024A", texto: "#FFFFFF" },
  { fundo: "#FFD873", texto: "#302F2F" },
];
const CONFETE = ["#FF035C", "#FAB82A", "#07366A", "#FFFFFF", "#3B82F6"];

const TAM = 1000;
const C = TAM / 2;
const R = 470;
// Duas fases: o giro, que desacelera até quase parar no vizinho do vencedor, e
// o rastejo final, em que a roda escorrega devagar até o bilhete sorteado. O
// movimento nunca para no meio: velocidade contínua, só zera no fim.
const GIRO_MS = 13_000;
const RASTEJO_MIN_MS = 5_000;
const RASTEJO_MAX_MS = 8_000;
const PAUSA_REVELAR_MS = 1_100;
const VOLTAS = 8;

function ponto(angulo: number, raio: number) {
  const a = (angulo * Math.PI) / 180;
  // Arredonda: o Math.sin do Node e o do navegador diferem na última casa, e
  // isso quebrava a hidratação do SVG.
  return [Math.round((C + raio * Math.sin(a)) * 100) / 100, Math.round((C - raio * Math.cos(a)) * 100) / 100] as const;
}

function arco(a0: number, a1: number, raio: number) {
  if (a1 - a0 >= 359.999) {
    return `M ${C} ${C - raio} A ${raio} ${raio} 0 1 1 ${C - 0.01} ${C - raio} Z`;
  }
  const [x0, y0] = ponto(a0, raio);
  const [x1, y1] = ponto(a1, raio);
  const grande = a1 - a0 > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x0} ${y0} A ${raio} ${raio} 0 ${grande} 1 ${x1} ${y1} Z`;
}

/**
 * Desaceleração do giro que termina com a inclinação `a` (velocidade final
 * normalizada), para emendar no rastejo sem tranco.
 */
function suavizar(u: number, a: number) {
  return (1 - a) * (1 - Math.pow(1 - u, 3.4)) + a * u;
}

function largura(total: number) {
  return Math.max(3, String(total).length);
}

export function Roleta({
  fatias,
  total,
  premio,
  imagemUrl,
  resultadoInicial,
  apresentar,
  onConcluir,
  rodape,
}: {
  fatias: Fatia[];
  total: number;
  premio: string;
  imagemUrl?: string | null;
  /** Resultado já existente: a roleta abre parada nele. */
  resultadoInicial?: ResultadoApresentado | null;
  /** Muda para disparar a animação até este resultado. */
  apresentar?: (ResultadoApresentado & { chave: number }) | null;
  onConcluir?: (r: ResultadoApresentado) => void;
  rodape?: React.ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const giro = useRef<SVGGElement>(null);
  const contador = useRef<HTMLSpanElement>(null);
  const donoAoVivo = useRef<HTMLSpanElement>(null);
  const confete = useRef<HTMLCanvasElement>(null);
  const anguloAtual = useRef(0);
  const audio = useRef<AudioContext | null>(null);
  const ultimoTique = useRef({ bilhete: -1, t: 0 });
  const realce = useRef<SVGPathElement>(null);
  const pararRufar = useRef<(() => void) | null>(null);

  const [girando, setGirando] = useState(false);
  // Últimos segundos: zoom no ponteiro, bordas escuras, rufar.
  const [final, setFinal] = useState(false);
  const [clarao, setClarao] = useState(false);
  const [contagem, setContagem] = useState<number | null>(null);
  const [vencedor, setVencedor] = useState<ResultadoApresentado | null>(resultadoInicial ?? null);
  const [som, setSom] = useState(false);
  const [usarContagem, setUsarContagem] = useState(true);
  // Preferência do sistema (prefers-reduced-motion), que o botão pode trocar.
  const movimentoSistema = useSyncExternalStore(assinarMovimento, lerMovimento, () => false);
  const [escolhaMovimento, setEscolhaMovimento] = useState<boolean | null>(null);
  const poucoMovimento = escolhaMovimento ?? movimentoSistema;
  const [telaCheia, setTelaCheia] = useState(false);

  useEffect(() => {
    const f = () => setTelaCheia(document.fullscreenElement === caixa.current);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  const passo = 360 / Math.max(total, 1);
  const segmentos = useMemo(
    () =>
      fatias.map((f, i) => {
        const a0 = (f.inicio - 1) * passo;
        const a1 = f.fim * passo;
        // Evita duas fatias vizinhas da mesma cor (inclusive a última com a primeira).
        let cor = CORES[i % CORES.length];
        if (i === fatias.length - 1 && i % CORES.length === 0 && i > 0) cor = CORES[2];
        return { ...f, a0, a1, cor };
      }),
    [fatias, passo],
  );

  const bilheteSobPonteiro = useCallback(
    (rot: number) => {
      const phi = (((360 - (rot % 360)) % 360) + 360) % 360;
      return Math.min(total, Math.floor(phi / passo) + 1);
    },
    [passo, total],
  );

  const pintar = useCallback(
    (rot: number) => {
      if (giro.current) giro.current.style.transform = `rotate(${rot}deg)`;
      const b = bilheteSobPonteiro(rot);
      if (contador.current) contador.current.textContent = String(b).padStart(largura(total), "0");
      const idx = segmentos.findIndex((s) => b >= s.inicio && b <= s.fim);
      if (donoAoVivo.current) donoAoVivo.current.textContent = segmentos[idx]?.rotulo ?? "";
      const seg = segmentos[idx];
      if (realce.current && seg && realce.current.dataset.idx !== String(idx)) {
        realce.current.dataset.idx = String(idx);
        realce.current.setAttribute("d", arco(seg.a0, seg.a1, R));
      }
      return { idx, b };
    },
    [bilheteSobPonteiro, segmentos, total],
  );

  /** Ângulo de parada: dentro do arco do bilhete, nunca na borda. */
  const anguloAlvo = useCallback(
    (bilhete: number) => {
      const centro = (bilhete - 0.5) * passo;
      const folga = passo * 0.3 * (Math.random() * 2 - 1);
      return -(centro + folga);
    },
    [passo],
  );

  // Abre parado no resultado já existente.
  useEffect(() => {
    const rot = resultadoInicial ? anguloAlvo(resultadoInicial.bilhete) : 0;
    anguloAtual.current = rot;
    pintar(rot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Um tique por bilhete que passa no ponteiro (limitado no giro rápido). */
  const tique = useCallback(
    ({ b }: { b: number }) => {
      if (!som || !audio.current) return;
      const agora = performance.now();
      if (b === ultimoTique.current.bilhete || agora - ultimoTique.current.t < 45) return;
      ultimoTique.current = { bilhete: b, t: agora };
      const ctx = audio.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = 1400;
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.06);
    },
    [som],
  );

  /** Rufar de tambor: ruído grave com tremido, subindo até a revelação. */
  const rufar = useCallback((duracaoMs: number) => {
    if (!som || !audio.current) return () => {};
    const ctx = audio.current;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const dados = buf.getChannelData(0);
    for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
    const ruido = ctx.createBufferSource();
    ruido.buffer = buf;
    ruido.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.frequency.value = 220;
    filtro.Q.value = 0.9;
    const tremido = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGanho = ctx.createGain();
    lfo.frequency.value = 17;
    lfoGanho.gain.value = 0.5;
    tremido.gain.value = 0.5;
    lfo.connect(lfoGanho).connect(tremido.gain);
    const volume = ctx.createGain();
    volume.gain.setValueAtTime(0.0001, ctx.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + duracaoMs / 1000);
    ruido.connect(filtro).connect(tremido).connect(volume).connect(ctx.destination);
    ruido.start();
    lfo.start();
    return () => {
      const t = ctx.currentTime;
      volume.gain.cancelScheduledValues(t);
      volume.gain.setValueAtTime(volume.gain.value, t);
      volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      ruido.stop(t + 0.1);
      lfo.stop(t + 0.1);
    };
  }, [som]);

  const fanfarra = useCallback(() => {
    if (!som || !audio.current) return;
    const ctx = audio.current;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t0 = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 1);
    });
  }, [som]);

  const soltarConfete = useCallback(() => {
    const cv = confete.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const { width, height } = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    const pecas = Array.from({ length: 260 }, () => ({
      x: width / 2 + (Math.random() - 0.5) * width * 0.3,
      y: height * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 15 - 5,
      r: Math.random() * 360,
      vr: (Math.random() - 0.5) * 18,
      w: 6 + Math.random() * 7,
      h: 8 + Math.random() * 10,
      cor: CONFETE[Math.floor(Math.random() * CONFETE.length)],
    }));
    const inicio = performance.now();
    const quadro = (agora: number) => {
      const t = agora - inicio;
      ctx.clearRect(0, 0, width, height);
      for (const p of pecas) {
        p.vy += 0.38;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 5200);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.r * Math.PI) / 180);
        ctx.fillStyle = p.cor;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos((p.r * Math.PI) / 90)));
        ctx.restore();
      }
      if (t < 5200) requestAnimationFrame(quadro);
      else ctx.clearRect(0, 0, width, height);
    };
    requestAnimationFrame(quadro);
  }, []);

  const girarAte = useCallback(
    async (r: ResultadoApresentado) => {
      setVencedor(null);
      setGirando(true);

      if (usarContagem && !poucoMovimento) {
        for (const n of [3, 2, 1]) {
          setContagem(n);
          await new Promise((ok) => setTimeout(ok, 900));
        }
        setContagem(null);
      }

      const alvoBase = anguloAlvo(r.bilhete);
      const de = anguloAtual.current;

      if (poucoMovimento) {
        anguloAtual.current = alvoBase;
        pintar(alvoBase);
      } else {
        // Sempre para a frente (horário), com VOLTAS voltas completas.
        const base = de - (de % 360);
        let ate = base + 360 * VOLTAS + (((alvoBase % 360) + 360) % 360);
        if (ate - de < 360 * VOLTAS) ate += 360;

        // Girando no horário, o ponteiro passa dos bilhetes maiores para os
        // menores: antes do vencedor vem a fatia seguinte a ele. O giro termina
        // dentro dela, perto da divisa, e o rastejo atravessa a divisa.
        const phiAlvo = (((-ate) % 360) + 360) % 360;
        const seg = segmentos.find((s) => r.bilhete >= s.inicio && r.bilhete <= s.fim);
        const divisa = seg ? seg.fim * passo : phiAlvo;
        const proximo = seg ? (seg.fim % total) + 1 : 1;
        const vizinho = segmentos.find((s) => proximo >= s.inicio && proximo <= s.fim);
        const larguraVizinho = vizinho && vizinho !== seg ? vizinho.a1 - vizinho.a0 : 20;
        const entrada = Math.min(Math.max(larguraVizinho * 0.6, passo * 0.6), 14);
        // Fatia grande do vencedor: o rastejo fica mais longo (e mais lento por
        // grau não), para começar sempre no vizinho e o nome não sair cedo.
        const rastejo = Math.min(divisa - phiAlvo + entrada, 75);
        const RASTEJO_MS = Math.min(RASTEJO_MAX_MS, Math.max(RASTEJO_MIN_MS, 3_400 + rastejo * 62));

        const fimGiro = ate - rastejo;
        const vFinal = (2 * rastejo) / RASTEJO_MS; // graus/ms na emenda
        const inclinacao = Math.min(0.9, (vFinal * GIRO_MS) / (fimGiro - de));

        await new Promise<void>((ok) => {
          const t0 = performance.now();
          let entrouNoFinal = false;
          const quadro = (agora: number) => {
            const dt = agora - t0;
            let rot: number;
            if (dt < GIRO_MS) {
              const u = dt / GIRO_MS;
              rot = de + (fimGiro - de) * suavizar(u, inclinacao);
              if (!entrouNoFinal && u > 0.86) {
                entrouNoFinal = true;
                setFinal(true);
                pararRufar.current = rufar(RASTEJO_MS + GIRO_MS * 0.14);
              }
            } else {
              // Rastejo: desaceleração constante até zerar exatamente no alvo.
              const s = Math.min(dt - GIRO_MS, RASTEJO_MS);
              rot = fimGiro + vFinal * s - (0.5 * vFinal * s * s) / RASTEJO_MS;
            }
            anguloAtual.current = rot;
            tique(pintar(rot));
            if (dt < GIRO_MS + RASTEJO_MS) requestAnimationFrame(quadro);
            else ok();
          };
          requestAnimationFrame(quadro);
        });

        anguloAtual.current = ate;
        pintar(ate);
        // Parou. Um instante de silêncio antes de revelar.
        pararRufar.current?.();
        pararRufar.current = null;
        await new Promise((ok) => setTimeout(ok, PAUSA_REVELAR_MS));
        setClarao(true);
        setTimeout(() => setClarao(false), 450);
      }

      // Conferência final: o bilhete sob o ponteiro tem que ser o do servidor.
      const sob = bilheteSobPonteiro(anguloAtual.current);
      if (sob !== r.bilhete) {
        anguloAtual.current = alvoBase;
        pintar(alvoBase);
      }

      setGirando(false);
      setVencedor(r);
      if (!poucoMovimento) soltarConfete();
      fanfarra();
      setTimeout(() => setFinal(false), 1800);
      onConcluir?.(r);
    },
    [anguloAlvo, bilheteSobPonteiro, fanfarra, onConcluir, passo, pintar, poucoMovimento, rufar, segmentos, soltarConfete, tique, total, usarContagem],
  );

  useEffect(() => () => pararRufar.current?.(), []);

  const ultimaChave = useRef<number | null>(null);
  useEffect(() => {
    if (!apresentar || apresentar.chave === ultimaChave.current) return;
    ultimaChave.current = apresentar.chave;
    void girarAte(apresentar);
  }, [apresentar, girarAte]);

  function alternarSom() {
    if (!audio.current) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audio.current = new Ctx();
    }
    void audio.current.resume();
    setSom((s) => !s);
  }

  async function alternarTelaCheia() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await caixa.current?.requestFullscreen?.();
  }

  const fonte = (graus: number) => Math.max(14, Math.min(30, graus * 1.5));
  const marcas = total <= 600;

  return (
    <div
      ref={caixa}
      className={`relative overflow-hidden rounded-2xl text-white ${telaCheia ? "h-screen w-screen rounded-none flex flex-col justify-center" : ""}`}
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #0E4C8F 0%, #07366A 45%, #041E3D 100%)" }}
    >
      {/* Controles */}
      <div className="absolute right-3 top-3 z-20 flex gap-1.5">
        <BotaoIcone rotulo={usarContagem ? "Contagem regressiva ligada" : "Contagem regressiva desligada"} ativo={usarContagem} onClick={() => setUsarContagem((v) => !v)} disabled={girando}>
          <Timer size={18} />
        </BotaoIcone>
        <BotaoIcone rotulo={som ? "Desligar som" : "Ligar som"} ativo={som} onClick={alternarSom}>
          {som ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </BotaoIcone>
        <BotaoIcone rotulo={poucoMovimento ? "Animações reduzidas" : "Reduzir animações"} ativo={poucoMovimento} onClick={() => setEscolhaMovimento(!poucoMovimento)} disabled={girando}>
          <Accessibility size={18} />
        </BotaoIcone>
        <BotaoIcone rotulo={telaCheia ? "Sair da tela cheia" : "Tela cheia"} onClick={alternarTelaCheia}>
          {telaCheia ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </BotaoIcone>
      </div>

      <div className={`mx-auto grid items-center gap-6 px-4 pb-8 pt-16 sm:px-8 sm:py-8 ${telaCheia ? "max-w-[1400px] lg:grid-cols-[minmax(0,1fr)_420px]" : "max-w-5xl lg:grid-cols-[minmax(0,1fr)_340px]"}`}>
        {/* Roda */}
        <div
          className="relative mx-auto w-full transition-transform duration-[1600ms] ease-in-out"
          style={{
            maxWidth: telaCheia ? "min(82vh, 820px)" : 560,
            transformOrigin: "50% 8%",
            transform: final && !poucoMovimento ? "scale(1.16)" : "none",
          }}
        >
          <svg viewBox={`0 0 ${TAM} ${TAM}`} className="w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]" role="img" aria-label={`Roleta com ${total} bilhetes`}>
            <defs>
              <radialGradient id="brilho" cx="50%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
                <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx={C} cy={C} r={R + 22} fill="#FAB82A" />
            <circle cx={C} cy={C} r={R + 10} fill="#041E3D" />
            {/* Lâmpadas da borda */}
            {Array.from({ length: 36 }, (_, i) => {
              const [x, y] = ponto(i * 10, R + 16);
              return <circle key={i} cx={x} cy={y} r={5} fill={i % 2 ? "#FFFFFF" : "#FFE3A3"} className={final ? "animate-[piscar_0.35s_steps(2)_infinite]" : girando ? "animate-pulse" : ""} />;
            })}
            <g ref={giro} style={{ transformOrigin: `${C}px ${C}px`, willChange: "transform" }}>
              {segmentos.map((s, i) => (
                <path key={i} d={arco(s.a0, s.a1, R)} fill={s.cor.fundo} stroke="#041E3D" strokeWidth={2} />
              ))}
              {/* Fatia sob o ponteiro, acesa no final */}
              <path
                ref={realce}
                d=""
                fill="#FFFFFF"
                stroke="#FFFFFF"
                strokeWidth={6}
                className="transition-opacity duration-500"
                style={{ opacity: final ? 0.28 : 0 }}
                pointerEvents="none"
              />
              {marcas &&
                Array.from({ length: total }, (_, i) => {
                  const [x0, y0] = ponto(i * passo, R);
                  const [x1, y1] = ponto(i * passo, R - (total > 300 ? 10 : 16));
                  return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.5} />;
                })}
              {segmentos.map((s, i) => {
                const graus = s.a1 - s.a0;
                if (graus < 7) return null;
                const meio = (s.a0 + s.a1) / 2;
                const tam = fonte(graus);
                const max = Math.floor((R * 0.62) / (tam * 0.55));
                const texto = s.rotulo.length > max ? `${s.rotulo.slice(0, max - 1)}…` : s.rotulo;
                // Metade direita lê do centro para a borda; a esquerda, da
                // borda para o centro. Assim nenhum nome fica de cabeça para baixo.
                const direita = meio < 180;
                return (
                  <g key={`t${i}`} transform={`rotate(${meio} ${C} ${C})`}>
                    <text
                      x={C}
                      y={C - R + 34}
                      transform={`rotate(${direita ? -90 : 90} ${C} ${C - R + 34})`}
                      textAnchor={direita ? "end" : "start"}
                      fill={s.cor.texto}
                      fontSize={tam}
                      fontWeight={600}
                      dominantBaseline="middle"
                      style={{ fontFamily: "inherit" }}
                    >
                      {texto}
                    </text>
                  </g>
                );
              })}
            </g>
            <circle cx={C} cy={C} r={R} fill="url(#brilho)" pointerEvents="none" />
            {/* Miolo */}
            <circle cx={C} cy={C} r={112} fill="#FAB82A" />
            <circle cx={C} cy={C} r={100} fill="#07366A" />
            {imagemUrl ? (
              <>
                <clipPath id="miolo">
                  <circle cx={C} cy={C} r={94} />
                </clipPath>
                <image href={imagemUrl} x={C - 94} y={C - 94} width={188} height={188} clipPath="url(#miolo)" preserveAspectRatio="xMidYMid slice" />
              </>
            ) : (
              <text x={C} y={C + 4} textAnchor="middle" dominantBaseline="middle" fill="#FFFFFF" fontSize={34} fontWeight={700}>
                {total} bilhetes
              </text>
            )}
            {/* Ponteiro */}
            <g filter="drop-shadow(0 6px 6px rgba(0,0,0,.45))">
              <path d={`M ${C - 34} 8 L ${C + 34} 8 L ${C} 92 Z`} fill="#FF035C" stroke="#FFFFFF" strokeWidth={6} strokeLinejoin="round" />
              <circle cx={C} cy={22} r={9} fill="#FFFFFF" />
            </g>
          </svg>

          {contagem != null && (
            <div className="absolute inset-0 grid place-items-center" aria-live="assertive">
              <span key={contagem} className="text-[9rem] font-bold leading-none text-[#FAB82A] drop-shadow-[0_6px_0_#041E3D] animate-[contagem_0.9s_ease-out]">
                {contagem}
              </span>
            </div>
          )}
        </div>

        {/* Painel lateral */}
        <div className="space-y-4 text-center lg:text-left">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FAB82A]">Prêmio</p>
            <p className="text-2xl font-semibold leading-tight">{premio}</p>
            <p className="mt-1 text-sm text-white/65">{total} bilhetes na roleta · cada lance válido é um bilhete</p>
          </div>

          <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">
              {final && girando ? <span className="animate-pulse text-[#FAB82A]">Devagar… quem leva?</span> : "Bilhete no ponteiro"}
            </p>
            <span ref={contador} className="block font-mono text-6xl font-bold tabular-nums tracking-wider text-white sm:text-7xl" aria-live="off">
              {"0".repeat(largura(total))}
            </span>
            <span ref={donoAoVivo} className="block truncate text-sm text-white/70" />
          </div>

          <div aria-live="polite">
            {vencedor && !girando && (
              <div className={`rounded-xl p-5 shadow-2xl ${vencedor.ensaio ? "bg-white/15 border-2 border-dashed border-white/50" : "bg-gradient-to-b from-[#FF035C] to-[#87002F]"} ${poucoMovimento ? "" : "animate-[vencedor_0.6s_cubic-bezier(.2,1.4,.4,1)]"}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                  {vencedor.ensaio ? "Ensaio · sem valor" : "Bilhete vencedor"}
                </p>
                <p className="font-mono text-5xl font-bold tabular-nums">{String(vencedor.bilhete).padStart(largura(total), "0")}</p>
                <p className="mt-1 text-xl font-semibold">{vencedor.vencedorPublico}</p>
              </div>
            )}
          </div>

          {rodape}
        </div>
      </div>

      {/* Bordas escurecem no final; clarão na revelação */}
      <div
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-1000"
        style={{ opacity: final && !poucoMovimento ? 1 : 0, background: "radial-gradient(70% 60% at 50% 40%, transparent 40%, rgba(2,10,24,0.82) 100%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 z-30 bg-white transition-opacity duration-300"
        style={{ opacity: clarao ? 0.85 : 0 }}
        aria-hidden="true"
      />

      <canvas ref={confete} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />

      <style>{`
        @keyframes contagem { from { transform: scale(1.8); opacity: 0 } 40% { opacity: 1 } to { transform: scale(1); opacity: 1 } }
        @keyframes vencedor { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes piscar { 0% { opacity: 1 } 100% { opacity: .25 } }
      `}</style>
    </div>
  );
}

const MQ_MOVIMENTO = "(prefers-reduced-motion: reduce)";
function assinarMovimento(aviso: () => void) {
  const mq = window.matchMedia(MQ_MOVIMENTO);
  mq.addEventListener("change", aviso);
  return () => mq.removeEventListener("change", aviso);
}
function lerMovimento() {
  return window.matchMedia(MQ_MOVIMENTO).matches;
}

function BotaoIcone({
  children,
  rotulo,
  ativo,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string; ativo?: boolean }) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      aria-pressed={ativo}
      className={`grid h-10 w-10 place-items-center rounded-full ring-1 ring-white/25 transition-colors disabled:opacity-40 ${ativo ? "bg-[#FAB82A] text-[#302F2F]" : "bg-white/10 text-white hover:bg-white/20"}`}
      {...props}
    >
      {children}
    </button>
  );
}

