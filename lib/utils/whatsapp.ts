// Validação/normalização de número de WhatsApp brasileiro.
// Aceita com ou sem código do país (55), com máscara ou só dígitos.
// Normaliza para DDD + número (10 ou 11 dígitos) — formato estável para dedup.

export function normalizeWhatsappBR(raw: string): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2); // remove país
  // 10 dígitos = fixo (DDD + 8); 11 = celular (DDD + 9 + 8).
  if (d.length === 10 || d.length === 11) return d;
  return null;
}

export function isValidWhatsappBR(raw: string): boolean {
  return normalizeWhatsappBR(raw) !== null;
}
