import type { Metadata } from "next";
import { PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { CadastroClienteForm } from "@/components/site/CadastroClienteForm";

export const metadata: Metadata = {
  title: "Seus dados para a entrega | Guppy de Linhagem",
  description:
    "Preencha nome, CPF e endereço para emitirmos a etiqueta do seu envio.",
  // Página de uso interno na conversa com o cliente: não é porta de entrada do
  // site e não deve competir com as páginas de produto na busca.
  robots: { index: false, follow: false },
};

/**
 * Link que mandamos no WhatsApp depois de fechar a venda: o cliente preenche o
 * endereço direto no sistema, em vez de ditar na conversa para a gente digitar.
 *
 * Sem login e sem token: quem acabou de pagar não vai criar conta para dizer
 * onde mora, e um link diferente por venda seria mais um passo em toda venda.
 * Abuso fica por conta do limite por IP na action.
 */
export default function MeusDadosPage() {
  return (
    <div className="bg-muted/30 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">
            Só falta o endereço
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
            Preencha aqui e a etiqueta do seu envio sai com tudo certo. Leva
            menos de um minuto — o CEP já traz rua, bairro e cidade.
          </p>
        </header>

        <ul className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
          <li className="flex items-center gap-2 rounded-lg border border-border bg-white p-3">
            <PackageCheck className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
            Endereço confere, caixa não volta
          </li>
          <li className="flex items-center gap-2 rounded-lg border border-border bg-white p-3">
            <Truck className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
            Rastreio no seu WhatsApp
          </li>
          <li className="flex items-center gap-2 rounded-lg border border-border bg-white p-3">
            <ShieldCheck className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
            Dados só para o envio
          </li>
        </ul>

        <CadastroClienteForm />
      </div>
    </div>
  );
}
