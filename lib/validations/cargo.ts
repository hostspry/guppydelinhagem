import { z } from "zod";
import { PERMISSOES_TODAS } from "@/lib/permissoes";

/**
 * Cargo montado no painel.
 *
 * `permissoes` chega como texto porque é isso que o banco guarda (a lista de
 * permissões cresce a cada funcionalidade nova, e migrar enum toda vez sairia
 * caro sem ganho). O `refine` é o portão: só entra permissão que existe de fato,
 * então um POST forjado não cria uma permissão inventada.
 */
export const cargoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Dê um nome ao cargo")
    .max(40, "Máx 40 caracteres"),
  descricao: z
    .string()
    .trim()
    .max(200, "Máx 200 caracteres")
    .optional()
    .or(z.literal("")),
  permissoes: z
    .array(z.string())
    .default([])
    .refine(
      (lista) => lista.every((p) => (PERMISSOES_TODAS as readonly string[]).includes(p)),
      "Permissão desconhecida.",
    ),
  /** Caixas do financeiro. Vazio = enxerga todas. */
  segmentosFinanceiros: z
    .array(z.enum(["PEIXES_VIVOS", "PRODUTOS"]))
    .default([]),
});

export type CargoInput = z.output<typeof cargoSchema>;
