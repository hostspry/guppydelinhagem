"use client";

import { useState } from "react";
import { Copy, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Link da cobrança + os dois jeitos de entregar ao cliente: copiar e mandar no
 * WhatsApp. A mensagem já vai escrita para o dono só apertar enviar.
 */
export function CobrancaLink({
  link,
  clienteNome,
  clienteTelefone,
  descricao,
  valor,
  expiraEm,
  ativo,
}: {
  link: string;
  clienteNome: string;
  clienteTelefone: string | null;
  descricao: string;
  valor: number;
  expiraEm: Date | null;
  ativo: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  const valorBR = valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const primeiroNome = clienteNome.trim().split(/\s+/)[0] ?? "";
  const validade = expiraEm
    ? ` O link vale até ${expiraEm.toLocaleDateString("pt-BR")}.`
    : "";
  const mensagem =
    `Oi ${primeiroNome}, tudo bem? Segue o link para pagar ${descricao}, ` +
    `no valor de ${valorBR}. Você escolhe Pix ou cartão na própria tela.${validade}\n\n${link}`;

  const digitos = (clienteTelefone ?? "").replace(/\D/g, "");
  const comDdi = digitos ? (digitos.startsWith("55") ? digitos : `55${digitos}`) : "";
  const waHref = comDdi
    ? `https://wa.me/${comDdi}?text=${encodeURIComponent(mensagem)}`
    : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

  async function copiar(texto: string, aviso: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success(aviso);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie na mão.");
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h2 className="text-sm font-semibold text-[#07366A] mb-3">
        Link para o cliente
      </h2>

      <div className="flex items-center gap-2 mb-3">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono text-gray-700 bg-gray-50"
        />
        <button
          type="button"
          onClick={() => copiar(link, "Link copiado.")}
          className="inline-flex items-center gap-1.5 border border-gray-300 text-sm px-3 py-2 rounded-md hover:bg-gray-50"
        >
          {copiado ? (
            <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
          ) : (
            <Copy className="w-4 h-4" aria-hidden="true" />
          )}
          Copiar
        </button>
      </div>

      {!ativo && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-3">
          Esta cobrança não está mais aberta, então o link não aceita pagamento.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-[#25D366] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" />
          {comDdi ? "Mandar no WhatsApp" : "Abrir WhatsApp"}
        </a>
        <button
          type="button"
          onClick={() => copiar(mensagem, "Mensagem copiada.")}
          className="inline-flex items-center gap-1.5 border border-gray-300 text-sm px-4 py-2 rounded-md hover:bg-gray-50"
        >
          <Copy className="w-4 h-4" aria-hidden="true" />
          Copiar mensagem pronta
        </button>
      </div>

      {!comDdi && (
        <p className="text-xs text-gray-400 mt-2">
          Sem WhatsApp cadastrado neste cliente: o botão abre o WhatsApp com a
          mensagem pronta para você escolher o contato.
        </p>
      )}
    </div>
  );
}
