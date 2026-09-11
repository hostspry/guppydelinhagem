/**
 * Erros que somem sozinhos ao recarregar a página.
 *
 * O site é reconstruído a cada deploy, e cada build gera nomes novos para os
 * arquivos de JavaScript e identificadores novos para as Server Actions. Quem
 * estava com a aba aberta (o painel do admin fica aberto o dia inteiro) continua
 * com a página velha na tela: o próximo clique pede um arquivo que não existe
 * mais, ou chama uma action que o servidor novo não reconhece. O erro sobe até a
 * borda e o cliente vê "This page couldn't load", em inglês, sem saber que
 * bastava recarregar.
 *
 * Nada disso é defeito de código: é a página velha conversando com o servidor
 * novo. Por isso vale recarregar sozinho uma vez — e só uma.
 */

const NOMES = new Set(["UnrecognizedActionError", "ChunkLoadError"]);

const PADROES = [
  /Loading chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  // Mensagem do Next quando a action da página velha sumiu no build novo.
  /Server Action "[^"]*" was not found on the server/i,
  /failed to find server action/i,
];

export function ehErroDeVersaoVelha(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const e = erro as { name?: unknown; message?: unknown };
  // `name` é atribuído com string literal no Next, então sobrevive à minificação.
  if (typeof e.name === "string" && NOMES.has(e.name)) return true;
  const msg = typeof e.message === "string" ? e.message : "";
  return PADROES.some((p) => p.test(msg));
}

const CHAVE = "recarga-por-versao-velha";
const ESPERA_MS = 30_000;

/**
 * Recarrega a página uma única vez. A trava fica no sessionStorage: se o erro
 * voltar logo depois da recarga, não era versão velha — aí é melhor mostrar a
 * tela de erro do que entrar em laço de recarregamento.
 */
export function recarregarUmaVez(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ultima = Number(window.sessionStorage.getItem(CHAVE) ?? 0);
    if (Date.now() - ultima < ESPERA_MS) return false;
    window.sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // Navegador sem sessionStorage (aba anônima travada): sem trava, não arrisca
    // o laço — deixa a pessoa clicar em "Tentar de novo".
    return false;
  }
  window.location.reload();
  return true;
}
