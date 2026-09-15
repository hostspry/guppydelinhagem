import "server-only";
import {
  PDFDocument,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
} from "pdf-lib";
import { prisma } from "@/lib/prisma";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import { MINUTA_GOLLOG_BASE64 } from "./minuta-template";
import { aeroportoDaMinuta } from "./bases";
import { REMETENTE_GOLLOG } from "./remetente";

/**
 * Preenche a Minuta de Despacho Eletrônica da Gollog de um pedido.
 *
 * O PDF é o formulário oficial, com campos. Aqui só se escreve nos campos: nada
 * de desenhar por cima, para o layout sair igual ao que a Gollog entrega. Os
 * campos continuam editáveis, então dá para corrigir no leitor de PDF antes de
 * imprimir.
 */

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

function doc(v: string | null | undefined): string {
  const d = digitos(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v ?? "";
}

function cep(v: string | null | undefined): string {
  const d = digitos(v);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (v ?? "");
}

function telefone(v: string | null | undefined): string {
  let d = digitos(v);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v ?? "";
}

/**
 * A fonte padrão do formulário (Helvetica) só escreve o alfabeto latino. Letra
 * de fora dele derrubaria a geração inteira, então vira a letra sem acento, e o
 * que ainda assim não couber some.
 */
function latino(s: string): string {
  return s
    .normalize("NFC")
    .split("")
    .map((c) => {
      const cod = c.charCodeAt(0);
      if ((cod >= 0x20 && cod <= 0x7e) || (cod >= 0xa0 && cod <= 0xff)) return c;
      const base = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return /^[\x20-\x7e]$/.test(base) ? base : "";
    })
    .join("");
}

const endereco = (logradouro?: string | null, numero?: string | null) =>
  [logradouro, numero].filter((x) => x && x.trim()).join(", ");

const INSTRUCOES =
  "Peixes ornamentais vivos. Produto perecível - manuseio cuidadoso; não expor ao calor/sol.";

export type OpcoesMinuta = {
  /** Texto do campo "Documentos da remessa", ex.: "NF-e nº 106 - Série 1". */
  notaFiscal?: string;
  /** Número de caixas (padrão 1). */
  volumes?: number;
};

export async function gerarMinutaGollog(
  orderId: string,
  opcoes: OpcoesMinuta = {},
): Promise<{ pdf: Uint8Array; nomeArquivo: string } | null> {
  const loja = REMETENTE_GOLLOG;
  const pedido = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      numero: true,
      enderecoEntrega: true,
      aeroportoDestino: true,
      recebedorNome: true,
      recebedorCpf: true,
      recebedorTelefone: true,
      cliente: { select: { nome: true, email: true, telefone: true, cpfCnpj: true } },
    },
  });
  if (!pedido) return null;

  const end = (pedido.enderecoEntrega ?? {}) as Partial<EnderecoEntrega>;
  const destino = aeroportoDaMinuta(pedido.aeroportoDestino, end.cidade, end.uf);

  const pdf = await PDFDocument.load(Buffer.from(MINUTA_GOLLOG_BASE64, "base64"));
  const form = pdf.getForm();
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);

  /**
   * Escreve no campo com o tamanho de letra do formulário (11). Sem tamanho
   * fixo, o leitor usa o automático e o endereço sai com letra gigante. Texto
   * que não cabe na largura do campo diminui até 7, em vez de ser cortado.
   * O mesmo nome aparece nas duas páginas (remetente e destinatário no topo
   * da página 2): todos os campos com o nome recebem o valor.
   */
  const texto = (nome: string, valor: string | null | undefined) => {
    const v = latino(valor ?? "");
    for (const campo of form.getFields().filter((f) => f.getName() === nome)) {
      if (campo instanceof PDFTextField) {
        const largura = Math.min(
          ...campo.acroField.getWidgets().map((w) => w.getRectangle().width),
        );
        let tamanho = 11;
        if (!campo.isMultiline()) {
          while (tamanho > 7 && helvetica.widthOfTextAtSize(v, tamanho) > largura - 6) tamanho -= 0.5;
        }
        campo.setText(v);
        campo.setFontSize(tamanho);
      } else if (campo instanceof PDFDropdown) {
        campo.select(v, true);
        campo.setFontSize(11);
      }
    }
  };

  // ── Remetente: quem despacha no aeroporto (não muda por pedido) ──
  texto("Nome_Remetente", loja.nome);
  texto("CPF_CNPJ_Remetente", doc(loja.documento));
  texto("Endereco_Remetente", endereco(loja.logradouro, loja.numero));
  texto("Complemento_Remetente", loja.complemento);
  texto("Bairro_Remetente", loja.bairro);
  texto("CEP_Remetente", cep(loja.cep));
  texto("Cidade_Remetente", loja.cidade);
  texto("Estado_Remetente", loja.uf);
  texto("Telefone_Remetente", telefone(loja.telefone));
  texto("Email_Remetente", loja.email);

  // ── Destinatário: o cliente, com o endereço combinado neste pedido ──
  texto("Nome_Destinatario", end.nome || pedido.cliente.nome);
  texto("CPF_CNPJ_Destinatario", doc(end.cpfCnpj || pedido.cliente.cpfCnpj));
  texto("Endereco_Destinatario", endereco(end.logradouro, end.numero));
  texto("Complemento_Destinatario", end.complemento);
  texto("Bairro_Destinatario", end.bairro);
  texto("CEP_Destinatario", cep(end.cep));
  texto("Cidade_Destinatario", end.cidade);
  texto("Estado_Destinatario", end.uf);
  texto("Telefone_Destinatario", telefone(end.telefone || pedido.cliente.telefone));
  texto("Email_Destinatario", end.email || pedido.cliente.email);

  // ── Serviço ──
  texto("Aeroporto_origem", loja.aeroportoOrigem);
  texto("Aeroporto_destino", destino ?? "");
  texto("Forma_Pagamento", "PIX");
  texto("Tipo_Entrega", "Retirada na base");
  const seguro = form.getFieldMaybe("Seguro_1");
  if (seguro instanceof PDFRadioGroup) seguro.select("3"); // Sem seguro

  // ── Remessa ──
  const volumes = Math.max(1, Math.round(opcoes.volumes ?? 1));
  texto("Unidades_1", String(volumes).padStart(2, "0"));
  texto("Embalagem_1", "Isopor");
  texto("Descricao_1", "Poecília reticulada (Guppy)");
  texto("Notas_fiscais", opcoes.notaFiscal?.trim() ?? "");

  // Quem retira, quando não é o destinatário: a minuta não tem campo próprio, e
  // a base só libera a caixa para quem estiver escrito aqui.
  const recebedor = pedido.recebedorNome?.trim()
    ? ` Retirada autorizada para ${pedido.recebedorNome.trim()}` +
      (pedido.recebedorCpf ? `, CPF ${doc(pedido.recebedorCpf)}` : "") +
      (pedido.recebedorTelefone ? `, tel. ${telefone(pedido.recebedorTelefone)}` : "") +
      "."
    : "";
  texto("Instrucoes_Especiais", INSTRUCOES + recebedor);

  // ── Autorização ──
  const autorizo = form.getFieldMaybe("Autorizacao");
  if (autorizo instanceof PDFCheckBox) autorizo.check();
  // A data fica em branco: é preenchida no dia do despacho, no aeroporto.
  texto("Local_data", `${loja.localAssinatura},`);
  texto("Nome_Responsavel", loja.nome);

  const primeiroNome = (end.nome || pedido.cliente.nome).split(/\s+/)[0] ?? "cliente";
  const nomeArquivo = latino(
    `Minuta_${pedido.numero.replace(/\W/g, "")}_${primeiroNome}_${loja.aeroportoOrigem}_${destino ?? "SEM-DESTINO"}.pdf`,
  ).replace(/\s+/g, "_");

  return { pdf: await pdf.save(), nomeArquivo };
}
