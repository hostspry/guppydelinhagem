import { permanentRedirect } from "next/navigation";

// Cadastro de cliente é social-only por enquanto (sem fluxo de senha). Redireciona
// permanente (308) para o /login, que oferece Google/Facebook.
export default function CadastroPage() {
  permanentRedirect("/login");
}
