import { redirect } from "next/navigation";

// O cadastro com formulário fica em /criar-conta. Aqui é redirect TEMPORÁRIO:
// este endereço já respondeu com 308 (permanente) e não deve voltar a responder.
export default function CadastroPage() {
  redirect("/criar-conta");
}
