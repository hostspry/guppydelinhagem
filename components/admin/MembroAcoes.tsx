"use client";

import { useState, useTransition } from "react";
import { KeyRound, UserMinus } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SenhaTemporaria } from "./SenhaTemporaria";
import { resetarSenhaMembro, removerAcesso } from "@/actions/equipe";

type Props = {
  id: string;
  nome: string;
  email: string;
  /** O próprio usuário logado não pode se remover nem se resetar por engano. */
  souEu: boolean;
};

export function MembroAcoes({ id, nome, email, souEu }: Props) {
  const [confirmando, setConfirmando] = useState<"senha" | "remover" | null>(null);
  const [senhaNova, setSenhaNova] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetar() {
    startTransition(async () => {
      const r = await resetarSenhaMembro(id);
      if (r.success && r.senhaTemporaria) {
        setSenhaNova(r.senhaTemporaria);
        setConfirmando(null);
      } else if (!r.success) {
        toast.error(r.error);
      }
    });
  }

  function remover() {
    startTransition(async () => {
      const r = await removerAcesso(id);
      if (r.success) {
        toast.success(r.message ?? "Acesso removido.");
        setConfirmando(null);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={() => setConfirmando("senha")}
          className="text-gray-400 hover:text-[#07366A] p-1"
          aria-label={`Gerar nova senha para ${nome}`}
          title="Gerar nova senha"
        >
          <KeyRound className="w-4 h-4" aria-hidden="true" />
        </button>
        {!souEu && (
          <button
            type="button"
            onClick={() => setConfirmando("remover")}
            className="text-gray-400 hover:text-[#FF035C] p-1"
            aria-label={`Remover acesso de ${nome}`}
            title="Remover acesso"
          >
            <UserMinus className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <AlertDialog
        open={confirmando === "senha"}
        onOpenChange={(o) => !o && setConfirmando(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar nova senha?</AlertDialogTitle>
            <AlertDialogDescription>
              A senha atual de <strong>{nome}</strong> para de funcionar na hora.
              A nova aparece aqui uma única vez, para você mandar para
              {" "}
              {nome.split(" ")[0]}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={resetar} disabled={isPending}>
              {isPending ? "Gerando..." : "Gerar nova senha"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmando === "remover"}
        onOpenChange={(o) => !o && setConfirmando(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o acesso de {nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa deixa de entrar no painel imediatamente. A conta não é
              apagada: se ela já comprou na loja, o histórico dela como cliente
              continua igual, e dá para trazê-la de volta ao time depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remover} disabled={isPending}>
              {isPending ? "Removendo..." : "Remover acesso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Senha nova: fica aberto até fechar no X, é a única chance de copiar. */}
      <AlertDialog
        open={senhaNova !== null}
        onOpenChange={(o) => !o && setSenhaNova(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nova senha de {nome}</AlertDialogTitle>
          </AlertDialogHeader>
          {senhaNova && (
            <SenhaTemporaria nome={nome} email={email} senha={senhaNova} />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Já copiei</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
