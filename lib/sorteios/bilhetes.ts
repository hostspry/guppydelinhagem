/**
 * Bilhetes: numeração, lista congelada e escolha do vencedor.
 *
 * Módulo PURO. O sorteio é entre BILHETES, não entre pessoas: quem tem 26
 * chances ocupa 26 números. A escolha usa crypto.randomInt (gerador
 * criptográfico do Node, distribuição uniforme sem viés de módulo) e roda só no
 * servidor. A roleta recebe o número pronto e apenas anima.
 */
import { createHash, randomInt } from "node:crypto";

export const METODO_SORTEIO =
  "node:crypto.randomInt(1, total+1) — CSPRNG do sistema, uniforme entre os bilhetes da lista homologada";

export type ParticipanteBilhetes = {
  id: string;
  ordem: number;
  chances: number;
};

export type Faixa = { inicio: number; fim: number };

/**
 * Distribui os números de 1 a N na ordem da lista. Participante com 0 chance
 * fica sem faixa (null). A ordem é a da importação, desempatada pelo id para o
 * resultado não depender da ordem que o banco devolveu.
 */
export function atribuirFaixas<T extends ParticipanteBilhetes>(
  participantes: T[],
): { faixas: Map<string, Faixa | null>; total: number } {
  const ordenados = [...participantes].sort(
    (a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id),
  );
  const faixas = new Map<string, Faixa | null>();
  let proximo = 1;
  for (const p of ordenados) {
    if (p.chances <= 0) {
      faixas.set(p.id, null);
      continue;
    }
    faixas.set(p.id, { inicio: proximo, fim: proximo + p.chances - 1 });
    proximo += p.chances;
  }
  return { faixas, total: proximo - 1 };
}

/** "001", "026" — com a largura do maior bilhete (mínimo 3 dígitos). */
export function formatarBilhete(n: number, total: number): string {
  return String(n).padStart(Math.max(3, String(total).length), "0");
}

export function formatarFaixa(f: Faixa | null, total: number): string {
  if (!f) return "—";
  if (f.inicio === f.fim) return formatarBilhete(f.inicio, total);
  return `${formatarBilhete(f.inicio, total)} a ${formatarBilhete(f.fim, total)}`;
}

export type LinhaCanonica = {
  participanteId: string;
  chave: string;
  inicio: number;
  fim: number;
};

/**
 * Texto canônico da lista homologada. É ele que entra no hash: mudar uma
 * chance, trocar a ordem ou o dono de uma faixa muda o hash.
 */
export function listaCanonica(sorteioId: string, linhas: LinhaCanonica[]): string {
  const ordenadas = [...linhas].sort((a, b) => a.inicio - b.inicio);
  const total = ordenadas.length ? ordenadas[ordenadas.length - 1].fim : 0;
  const corpo = ordenadas
    .map((l) => `${l.inicio}-${l.fim};${l.participanteId};${l.chave}`)
    .join("\n");
  return `sorteio:${sorteioId}\ntotal:${total}\n${corpo}\n`;
}

export function sha256(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

/** Confere que as faixas cobrem 1..total sem buraco nem sobreposição. */
export function faixasContinuas(linhas: Pick<LinhaCanonica, "inicio" | "fim">[]): boolean {
  const ordenadas = [...linhas].sort((a, b) => a.inicio - b.inicio);
  let esperado = 1;
  for (const l of ordenadas) {
    if (l.inicio !== esperado || l.fim < l.inicio) return false;
    esperado = l.fim + 1;
  }
  return ordenadas.length > 0;
}

/** Sorteia um bilhete entre 1 e total (inclusive). Só no servidor. */
export function sortearBilhete(total: number, rng: (max: number) => number = randomInt): number {
  if (!Number.isInteger(total) || total < 1) {
    throw new Error("Não há bilhetes para sortear.");
  }
  // randomInt(max) devolve 0..max-1.
  return rng(total) + 1;
}

/** Dono de um bilhete pela lista congelada. */
export function donoDoBilhete<T extends Pick<LinhaCanonica, "inicio" | "fim">>(
  linhas: T[],
  bilhete: number,
): T | null {
  return linhas.find((l) => bilhete >= l.inicio && bilhete <= l.fim) ?? null;
}

/** Lê de volta a lista canônica (para conferir e para a roleta). */
export function lerListaCanonica(texto: string): LinhaCanonica[] {
  return texto
    .split("\n")
    .slice(2)
    .filter(Boolean)
    .map((linha) => {
      const [faixa, participanteId, ...resto] = linha.split(";");
      const [inicio, fim] = faixa.split("-").map(Number);
      return { participanteId, chave: resto.join(";"), inicio, fim };
    });
}

const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e"]);

/**
 * Nome que pode aparecer em público: primeiro nome + inicial do segundo.
 * O segundo e não o último: nome de contato do WhatsApp costuma vir com
 * apelido no fim ("Felipe Cesar Romera Lista Guppy" → "Felipe C.").
 * Sem nome, o telefone mascarado é montado por quem chama.
 */
export function nomePublico(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => /[a-zA-ZÀ-ÿ]/.test(p) && !PARTICULAS.has(p.toLowerCase()));
  if (partes.length === 0) return "Participante";
  const primeiro = partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase();
  if (partes.length === 1) return primeiro;
  return `${primeiro} ${partes[1].charAt(0).toUpperCase()}.`;
}

/**
 * Bilhete pela Loteria Federal.
 *
 * Regra (tem que ser a mesma do regulamento): percorre os 5 prêmios na ordem;
 * de cada um pega os últimos k algarismos, k = algarismos do total. O primeiro
 * que cair entre 1 e o total é o bilhete. Se nenhum servir, usa o 1º prêmio:
 * (número mod total) + 1. Determinístico: qualquer pessoa refaz a conta com o
 * resultado publicado pela Caixa.
 */
export function bilheteDaLoteria(
  premios: string[],
  total: number,
): { bilhete: number; criterio: string } {
  if (!Number.isInteger(total) || total < 1) {
    throw new Error("Não há bilhetes para sortear.");
  }
  const numeros = premios.map((p) => p.replace(/\D/g, "")).filter(Boolean);
  if (numeros.length === 0) throw new Error("Informe o resultado da Loteria Federal.");
  const k = String(total).length;
  for (let i = 0; i < numeros.length; i++) {
    const n = Number(numeros[i].slice(-k));
    if (n >= 1 && n <= total) {
      return {
        bilhete: n,
        criterio: `${i + 1}º prêmio ${numeros[i]}: últimos ${k} algarismos = ${n}`,
      };
    }
  }
  const n = (Number(numeros[0]) % total) + 1;
  return {
    bilhete: n,
    criterio: `nenhum prêmio caiu entre 1 e ${total}; 1º prêmio ${numeros[0]} mod ${total} + 1 = ${n}`,
  };
}
