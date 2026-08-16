import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";

/**
 * Saída de emergência para quem perdeu o acesso com a sessão aberta.
 *
 * O middleware roda no Edge e só enxerga o JWT (1 dia de validade); o painel lê
 * o banco. Quando o dono remove alguém do time, os dois discordam: o token ainda
 * diz "admin", o banco já diz "cliente" — e um redirect do painel para o login
 * seria devolvido pelo middleware, em laço infinito.
 *
 * Aqui o cookie é apagado de verdade (route handler pode escrever cookie, layout
 * não pode), então o login volta a ser uma página normal. Fica fora de /admin de
 * propósito: o matcher do middleware não alcança /api.
 */
export async function GET() {
  await signOut({ redirect: false });
  redirect("/admin/login?motivo=sem-acesso");
}
