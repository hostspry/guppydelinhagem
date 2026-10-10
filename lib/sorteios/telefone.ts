/**
 * Telefone dos sorteios: normalização, comparação e máscara.
 *
 * Módulo PURO (sem Prisma), para o teste rodar com os números reais do leilão.
 *
 * O mesmo WhatsApp aparece escrito de jeitos diferentes, e casar errado aqui é
 * dar bilhete para a pessoa errada. Os dois casos que pegam:
 *
 *  - Brasil: celular antigo sem o 9 ("+55 99 8111-4155"). O WhatsApp ainda
 *    identifica muita conta antiga assim. A chave canônica põe o 9, então
 *    "99 8111-4155" e "99 98111-4155" são o mesmo número.
 *  - México: o WhatsApp mostra "+52 1 844 …", com o 1 de celular que a
 *    telefonia mexicana aboliu em 2019. A chave tira o 1.
 *
 * Qualquer outro DDI é guardado como veio (só dígitos). O DDI não define se a
 * pessoa pode participar; isso é regra do sorteio, não do telefone.
 */

/** Só dígitos. "+55 (21) 96642-9563" → "5521966429563". */
export function soDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Parece telefone? Usado na importação para separar "Vinicius Auch" (nome) de
 * "+55 21 96642-9563" (número). Exige ao menos 10 dígitos e quase nada de letra.
 */
export function pareceTelefone(s: string): boolean {
  const digitos = soDigitos(s);
  if (digitos.length < 10 || digitos.length > 15) return false;
  return !/[a-zA-ZÀ-ÿ]/.test(s);
}

/**
 * Chave canônica para comparar e guardar: DDI + número, só dígitos.
 *
 * Número sem DDI (10 ou 11 dígitos) é tratado como brasileiro, que é o caso do
 * formulário da conta. Devolve null quando não dá para confiar no número.
 */
export function chaveTelefone(entrada: string): string | null {
  let d = soDigitos(entrada);
  if (d.startsWith("00")) d = d.slice(2); // discagem internacional "0055…"
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 11 || d.length > 15) return null;

  if (d.startsWith("55")) {
    const local = d.slice(2);
    // Fixo/celular sem o 9 (8 dígitos depois do DDD). Celular começa com 6–9.
    if (local.length === 10 && /^[1-9]{2}[6-9]/.test(local)) {
      return `55${local.slice(0, 2)}9${local.slice(2)}`;
    }
    if (local.length === 11 || local.length === 10) return d;
    return null;
  }

  if (d.startsWith("521") && d.length === 13) return `52${d.slice(3)}`;

  return d;
}

/** Formata para leitura humana. Brasil no padrão nacional; resto com DDI. */
export function formatarTelefone(chave: string | null | undefined): string {
  if (!chave) return "—";
  if (chave.startsWith("55") && chave.length === 13) {
    return `+55 ${chave.slice(2, 4)} ${chave.slice(4, 9)}-${chave.slice(9)}`;
  }
  if (chave.startsWith("55") && chave.length === 12) {
    return `+55 ${chave.slice(2, 4)} ${chave.slice(4, 8)}-${chave.slice(8)}`;
  }
  if (chave.startsWith("52") && chave.length === 12) {
    return `+52 ${chave.slice(2, 5)} ${chave.slice(5, 8)} ${chave.slice(8)}`;
  }
  return `+${chave}`;
}

/**
 * Máscara para tela pública: mostra DDD e os 4 últimos.
 * "5521966429563" → "(21) •••••-9563".
 */
export function mascararTelefone(chave: string | null | undefined): string {
  if (!chave) return "—";
  const fim = chave.slice(-4);
  if (chave.startsWith("55") && chave.length >= 12) {
    return `(${chave.slice(2, 4)}) •••••-${fim}`;
  }
  return `+${chave.slice(0, 2)} ••• ${fim}`;
}

/** Link do WhatsApp para um telefone canônico. */
export function linkWhatsapp(chave: string, texto?: string): string {
  const base = `https://wa.me/${chave}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
