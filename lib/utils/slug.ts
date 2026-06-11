export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9\s-]/g, "")    // remove especiais
    .trim()
    .replace(/\s+/g, "-")             // espaços → hífen
    .replace(/-+/g, "-");             // múltiplos hífens → um
}
