import "server-only";
import { prisma } from "@/lib/prisma";
import { enviarEmail } from "@/lib/email";
import { getConfiguracaoLoja } from "@/lib/queries/config";
import { linkDoArremate } from "@/lib/queries/leiloes";
import { dataLeilaoBR, situacaoDoArremate } from "@/lib/leiloes/situacao";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import { montarEmail } from "./render";
import { botao, listaLotes, moeda } from "./layout";

/**
 * E-mail de cobrança do leilão: os lotes, o total, a promoção pelo menor
 * arremate e o link onde o arrematante escolhe o frete e paga (Pix ou cartão).
 *
 * Só sai para cobrança em aberto. Com peixe demais para o frete automático e o
 * frete ainda não combinado, NÃO sai: a página mandaria o cliente chamar no
 * WhatsApp, e o e-mail prometeria uma coisa que o link não faz.
 */

export type ResultadoEmailLeilao =
  | { ok: true; para: string; assunto: string; html: string }
  | { ok: false; motivo: string };

const PAGAMENTO = "O pagamento pode ser no Pix, que confirma na hora, ou no cartão em até 12x.";

/**
 * `simular`: monta o e-mail e devolve, sem enviar nem marcar como enviado.
 * `nome`: como chamar a pessoa, quando o primeiro nome do cadastro não é o que
 * ela usa (ex.: "Carlos Frederico" atende por Frederico).
 * `testePara`: manda para outro endereço (teste do dono), com "[Teste]" no
 * assunto e sem marcar a cobrança como enviada.
 */
export async function emailCobrancaLeilao(
  orderId: string,
  opts: { simular?: boolean; nome?: string; testePara?: string } = {},
): Promise<ResultadoEmailLeilao> {
  const o = await prisma.order.findFirst({
    where: { id: orderId, origem: "LEILAO" },
    select: {
      id: true,
      numero: true,
      status: true,
      expiraEm: true,
      entregaEscolhidaEm: true,
      publicToken: true,
      subtotal: true,
      frete: true,
      total: true,
      tipoEntrega: true,
      modalidadeFrete: true,
      enderecoEntrega: true,
      cliente: { select: { nome: true, email: true } },
      leilao: { select: { nome: true, dataLeilao: true } },
      unidadeGollogId: true,
      lotesLeilao: {
        orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
        select: { numero: true, valor: true, qtdPeixes: true },
      },
      items: { orderBy: { id: "asc" }, select: { nomeProduto: true, precoUnitario: true } },
    },
  });
  if (!o || !o.leilao) return { ok: false, motivo: "Cobrança de leilão não encontrada." };

  const situacao = situacaoDoArremate(o);
  if (situacao !== "ESCOLHER_ENTREGA" && situacao !== "AGUARDANDO_PAGAMENTO") {
    return { ok: false, motivo: "Esta cobrança não está em aberto." };
  }
  if (!o.publicToken) return { ok: false, motivo: "Cobrança sem link." };

  const end = (o.enderecoEntrega ?? {}) as Partial<EnderecoEntrega>;
  const email = (o.cliente.email ?? end.email ?? "").trim();
  if (!email) return { ok: false, motivo: "O arrematante não tem e-mail. Mande pelo WhatsApp." };

  const peixes = o.lotesLeilao.reduce((a, l) => a + l.qtdPeixes, 0);
  const { maxPeixesFreteAuto } = await getConfiguracaoLoja();
  if (!o.entregaEscolhidaEm && peixes > maxPeixesFreteAuto) {
    return {
      ok: false,
      motivo: `São ${peixes} peixes, acima do frete automático (${maxPeixesFreteAuto}). Combine o frete antes de mandar.`,
    };
  }

  // Preço da promoção: o menor arremate dele. Linhagem extra da promoção (lote
  // sem número) não conta, ela já é o preço da promoção.
  const arremates = o.lotesLeilao.filter((l) => l.numero).map((l) => Number(l.valor));
  const menor = arremates.length ? Math.min(...arremates) : Number(o.subtotal);

  const link = linkDoArremate(o.publicToken);
  const subtotal = Number(o.subtotal);
  const frete = Number(o.frete);
  let textoFrete: string;
  let rotuloBotao: string;
  if (!o.entregaEscolhidaEm) {
    textoFrete = `No link você coloca seu CEP e escolhe o frete: terrestre pela Jadlog, que entrega no seu endereço, ou aéreo pela Gollog, com retirada no aeroporto. ${PAGAMENTO}`;
    rotuloBotao = "Escolher o frete e pagar";
  } else if (o.tipoEntrega === "RETIRADA") {
    textoFrete = `Combinamos a retirada aqui em Guarapari, sem frete. Total a pagar: ${moeda(Number(o.total))}. ${PAGAMENTO}`;
    rotuloBotao = "Conferir e pagar";
  } else if (o.modalidadeFrete === "AEREO") {
    const unidade = o.unidadeGollogId
      ? await prisma.unidadeGollog.findUnique({ where: { id: o.unidadeGollogId }, select: { titulo: true } })
      : null;
    const onde = unidade?.titulo ? `, com retirada em ${unidade.titulo}` : ", com retirada no aeroporto";
    textoFrete = `O frete já está combinado: aéreo pela Gollog, ${moeda(frete)}${onde}. Total com frete: ${moeda(Number(o.total))}. ${PAGAMENTO}`;
    rotuloBotao = "Conferir e pagar";
  } else {
    textoFrete = `O frete já está combinado: terrestre pela Jadlog, ${moeda(frete)}, com entrega no seu endereço. Total com frete: ${moeda(Number(o.total))}. ${PAGAMENTO}`;
    rotuloBotao = "Conferir e pagar";
  }

  const nome = (opts.nome || o.cliente.nome || end.nome || "").trim().split(/\s+/)[0] ?? "";
  const primeiroNome = /^\+?\d/.test(nome) ? "" : nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
  const montado = await montarEmail(
    "leilao-cobranca",
    {
      nome: primeiroNome,
      leilao: o.leilao.nome,
      data_leilao: dataLeilaoBR(o.leilao.dataLeilao),
      lotes: listaLotes(o.items.map((i) => ({ nome: i.nomeProduto, valor: Number(i.precoUnitario) }))),
      subtotal: moeda(subtotal),
      menor_lance: moeda(menor),
      frete: textoFrete,
      botao_pagar: botao(rotuloBotao, link),
      link,
    },
    o.entregaEscolhidaEm
      ? `Lotes arrematados: ${moeda(subtotal)}. O frete já está combinado, falta só pagar.`
      : `Lotes arrematados: ${moeda(subtotal)}. Escolha o frete e pague no Pix ou no cartão.`,
  );
  if (!montado) {
    return { ok: false, motivo: "O e-mail de cobrança do leilão está desligado em Configurações → Mensagens." };
  }

  if (opts.simular) return { ok: true, para: email, ...montado };

  const teste = opts.testePara?.trim();
  const para = teste || email;
  const assunto = teste ? `[Teste] ${montado.assunto}` : montado.assunto;
  const enviado = await enviarEmail({ para, assunto, html: montado.html });
  if (!enviado) return { ok: false, motivo: "Não consegui enviar o e-mail. Mande pelo WhatsApp." };

  if (!teste) await prisma.order.update({ where: { id: o.id }, data: { cobrancaEmailEm: new Date() } });
  return { ok: true, para, assunto, html: montado.html };
}
