import "server-only";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { getConfiguracaoLoja } from "@/lib/queries/config";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import {
  situacaoDoArremate,
  type SituacaoArremate,
} from "@/lib/leiloes/situacao";

/**
 * Leilões — leitura.
 *
 * A cobrança de cada arrematante é um Order de origem LEILAO (ver o comentário
 * do model Leilao). Os lotes ficam em LoteLeilao, ligados ao pedido que os
 * cobrou; os itens do pedido são o retrato do que foi cobrado.
 */

/** Link que vai para o arrematante. */
export function linkDoArremate(token: string): string {
  return `${SITE_URL}/leilao/${token}`;
}

const STATUS_PAGO = ["PAGO", "ENVIADO", "ENTREGUE"] as const;
const pago = (s: string) => (STATUS_PAGO as readonly string[]).includes(s);

// ── Lista (/admin/leiloes) ───────────────────────────────────────────────────
export async function listLeiloes() {
  const rows = await prisma.leilao.findMany({
    orderBy: { dataLeilao: "desc" },
    select: {
      id: true,
      nome: true,
      dataLeilao: true,
      lotes: { select: { valor: true, orderId: true } },
      pedidos: { select: { status: true, total: true } },
    },
  });

  return rows.map((l) => {
    const totalArrematado = l.lotes.reduce((a, x) => a + Number(x.valor), 0);
    const pagas = l.pedidos.filter((p) => pago(p.status));
    return {
      id: l.id,
      nome: l.nome,
      dataLeilao: l.dataLeilao,
      qtdLotes: l.lotes.length,
      lotesSemCobranca: l.lotes.filter((x) => !x.orderId).length,
      totalArrematado,
      cobrancas: l.pedidos.filter((p) => p.status !== "CANCELADO").length,
      pagas: pagas.length,
      recebido: pagas.reduce((a, p) => a + Number(p.total), 0),
    };
  });
}

export type LeilaoListItem = Awaited<ReturnType<typeof listLeiloes>>[number];

// ── Detalhe (/admin/leiloes/[id]) ────────────────────────────────────────────
export async function getLeilaoAdmin(id: string) {
  const l = await prisma.leilao.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      dataLeilao: true,
      prazoPagamentoDias: true,
      maxParcelas: true,
      observacoes: true,
      lotes: {
        orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
        select: {
          id: true,
          numero: true,
          nome: true,
          qtdPeixes: true,
          valor: true,
          orderId: true,
          cliente: { select: { id: true, nome: true, telefone: true } },
          order: {
            select: {
              numero: true,
              status: true,
              expiraEm: true,
              entregaEscolhidaEm: true,
            },
          },
        },
      },
      pedidos: {
        orderBy: { criadoEm: "asc" },
        select: {
          id: true,
          numero: true,
          status: true,
          subtotal: true,
          frete: true,
          total: true,
          criadoEm: true,
          expiraEm: true,
          entregaEscolhidaEm: true,
          publicToken: true,
          tipoEntrega: true,
          modalidadeFrete: true,
          enderecoEntrega: true,
          observacoes: true,
          cliente: {
            select: { id: true, nome: true, telefone: true, email: true },
          },
          items: {
            orderBy: { id: "asc" },
            select: { nomeProduto: true, precoUnitario: true },
          },
          pagamentos: {
            orderBy: { criadoEm: "desc" },
            take: 1,
            select: {
              metodo: true,
              status: true,
              valor: true,
              parcelas: true,
              criadoEm: true,
            },
          },
        },
      },
    },
  });
  if (!l) return null;

  const lotes = l.lotes.map((x) => ({
    id: x.id,
    numero: x.numero,
    nome: x.nome,
    qtdPeixes: x.qtdPeixes,
    valor: Number(x.valor),
    cliente: x.cliente,
    orderId: x.orderId,
    cobranca: x.order
      ? { numero: x.order.numero, situacao: situacaoDoArremate(x.order) }
      : null,
  }));

  const cobrancas = l.pedidos.map((p) => {
    const end = (p.enderecoEntrega ?? {}) as Partial<EnderecoEntrega>;
    const ult = p.pagamentos[0];
    return {
      id: p.id,
      numero: p.numero,
      situacao: situacaoDoArremate(p),
      subtotal: Number(p.subtotal),
      frete: Number(p.frete),
      total: Number(p.total),
      criadoEm: p.criadoEm,
      expiraEm: p.expiraEm,
      entregaEscolhidaEm: p.entregaEscolhidaEm,
      link: p.publicToken ? linkDoArremate(p.publicToken) : null,
      tipoEntrega: p.tipoEntrega,
      modalidadeFrete: p.modalidadeFrete,
      destino: end.cidade ? `${end.cidade}/${end.uf ?? ""}` : null,
      cliente: p.cliente,
      itens: p.items.map((i) => ({
        nome: i.nomeProduto,
        valor: Number(i.precoUnitario),
      })),
      ultimoPagamento: ult ? { ...ult, valor: Number(ult.valor) } : null,
      // Nota gravada por registrarPagamentoForaLeilao: "Pago por fora (PicPay)…".
      pagoForaCom: /Pago por fora \(([^)]+)\)/.exec(p.observacoes ?? "")?.[1] ?? null,
    };
  });

  const ativas = cobrancas.filter((c) => c.situacao !== "CANCELADA");
  const resumo = {
    totalArrematado: lotes.reduce((a, x) => a + x.valor, 0),
    lotesSemCobranca: lotes.filter((x) => !x.orderId).length,
    arrematantes: new Set(lotes.map((x) => x.cliente.id)).size,
    recebido: ativas
      .filter((c) => c.situacao === "PAGA")
      .reduce((a, c) => a + c.total, 0),
    aReceber: ativas
      .filter((c) => c.situacao !== "PAGA")
      .reduce((a, c) => a + c.total, 0),
    pagas: ativas.filter((c) => c.situacao === "PAGA").length,
    abertas: ativas.filter((c) => c.situacao !== "PAGA").length,
  };

  return {
    id: l.id,
    nome: l.nome,
    dataLeilao: l.dataLeilao,
    prazoPagamentoDias: l.prazoPagamentoDias,
    maxParcelas: l.maxParcelas,
    observacoes: l.observacoes,
    lotes,
    cobrancas,
    resumo,
  };
}

export type LeilaoAdmin = NonNullable<Awaited<ReturnType<typeof getLeilaoAdmin>>>;
export type LoteAdmin = LeilaoAdmin["lotes"][number];
export type CobrancaLeilaoAdmin = LeilaoAdmin["cobrancas"][number];

// ── Página do link (/leilao/[token]) e área do cliente ──────────────────────

/** Pix já emitido e ainda válido, para não gerar um QR novo a cada visita. */
export type PixArremate = {
  valor: number;
  qrCodeBase64: string | null;
  copiaECola: string | null;
  ticketUrl: string | null;
  expiraEm: string | null; // ISO
};

export async function getArrematePorToken(token: string) {
  const o = await prisma.order.findFirst({
    where: { origem: "LEILAO", publicToken: token },
    select: {
      id: true,
      numero: true,
      status: true,
      subtotal: true,
      frete: true,
      total: true,
      expiraEm: true,
      maxParcelas: true,
      entregaEscolhidaEm: true,
      tipoEntrega: true,
      modalidadeFrete: true,
      enderecoEntrega: true,
      leilao: { select: { nome: true, dataLeilao: true } },
      items: {
        orderBy: { id: "asc" },
        select: { nomeProduto: true, precoUnitario: true },
      },
      lotesLeilao: { select: { qtdPeixes: true } },
      cliente: {
        select: {
          nome: true,
          email: true,
          telefone: true,
          cpfCnpj: true,
          cep: true,
          logradouro: true,
          numero: true,
          complemento: true,
          bairro: true,
          cidade: true,
          uf: true,
        },
      },
      pagamentos: {
        orderBy: { criadoEm: "desc" },
        select: {
          metodo: true,
          status: true,
          valor: true,
          qrCode: true,
          linkPagamento: true,
          payloadRaw: true,
        },
      },
    },
  });
  if (!o) return null;

  const config = await getConfiguracaoLoja();
  const total = Number(o.total);
  const situacao = situacaoDoArremate(o);
  const snap = (o.enderecoEntrega ?? {}) as Partial<EnderecoEntrega>;
  const c = o.cliente;

  // Pix pendente do MESMO valor e com folga de validade: reaproveita o QR.
  const pixPendente: PixArremate | null = (() => {
    const p = o.pagamentos.find(
      (x) => x.metodo === "PIX" && x.status === "PENDENTE",
    );
    if (!p || Math.abs(Number(p.valor) - total) > 0.009) return null;
    const raw = (p.payloadRaw ?? {}) as {
      qrCodeBase64?: string | null;
      ticketUrl?: string | null;
      expiraEm?: string | null;
    };
    if (!raw.expiraEm || new Date(raw.expiraEm).getTime() < Date.now() + 5 * 60_000) {
      return null;
    }
    return {
      valor: Number(p.valor),
      qrCodeBase64: raw.qrCodeBase64 ?? null,
      copiaECola: p.qrCode,
      ticketUrl: raw.ticketUrl ?? p.linkPagamento,
      expiraEm: raw.expiraEm,
    };
  })();

  return {
    numero: o.numero,
    situacao,
    emAnalise: o.pagamentos.some((p) => p.status === "EM_ANALISE"),
    leilao: o.leilao,
    lotes: o.items.map((i) => ({
      nome: i.nomeProduto,
      valor: Number(i.precoUnitario),
    })),
    qtdPeixes: o.lotesLeilao.reduce((a, l) => a + l.qtdPeixes, 0),
    subtotal: Number(o.subtotal),
    frete: Number(o.frete),
    total,
    expiraEm: o.expiraEm,
    maxParcelas: o.maxParcelas ?? 12,
    entrega: o.entregaEscolhidaEm
      ? {
          tipo: o.tipoEntrega,
          modalidade: o.modalidadeFrete as "TERRESTRE" | "AEREO" | null,
          cidade: snap.cidade ?? null,
          uf: snap.uf ?? null,
        }
      : null,
    // Pré-preenchimento: o que o cliente já informou nesta cobrança vale mais
    // que o cadastro (que pode ter sido digitado pela loja).
    pagador: {
      nome: snap.nome || c.nome,
      email: snap.email || c.email || "",
      telefone: snap.telefone || c.telefone || "",
      cpfCnpj: snap.cpfCnpj || c.cpfCnpj || "",
      cep: snap.cep || c.cep || "",
      logradouro: snap.logradouro || c.logradouro || "",
      numero: snap.numero || c.numero || "",
      complemento: snap.complemento || c.complemento || "",
      bairro: snap.bairro || c.bairro || "",
      cidade: snap.cidade || c.cidade || "",
      uf: snap.uf || c.uf || "",
    },
    retirada: {
      ativa: config.retiradaLocalAtiva,
      instrucoes: config.retiradaInstrucoes,
    },
    maxPeixesPorCaixa: config.maxPeixesFreteAuto,
    pixPendente,
  };
}

export type ArrematePublico = NonNullable<
  Awaited<ReturnType<typeof getArrematePorToken>>
>;

export type { SituacaoArremate };
