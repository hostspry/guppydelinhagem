/**
 * Ponte entre o telefone canônico dos leilões/sorteios (DDI + número, com o 9;
 * ver lib/sorteios/telefone.ts) e o jeito que o cadastro de clientes guarda.
 *
 * Módulo PURO. O cadastro guarda só dígitos e, no Brasil, sem o 55: é o que o
 * checkout, a venda pelo WhatsApp e a importação sempre gravaram. Para achar o
 * mesmo arrematante lá, a busca precisa tentar todas as grafias.
 */

/** Grafias possíveis de um telefone canônico em Cliente.telefone. */
export function variantesTelefone(chave: string): string[] {
  const out = new Set<string>([chave]);
  if (chave.startsWith("55")) {
    const local = chave.slice(2);
    out.add(local);
    // Celular antigo gravado sem o 9 ("27 9992-2649" no lugar de "27 99992-2649").
    if (local.length === 11 && local[2] === "9") {
      const sem9 = local.slice(0, 2) + local.slice(3);
      out.add(sem9);
      out.add(`55${sem9}`);
    }
  }
  return [...out];
}

/** Como gravar no cadastro: Brasil sem o 55; o resto com o DDI. */
export function telefoneDoCadastro(chave: string): string {
  return chave.startsWith("55") ? chave.slice(2) : chave;
}
