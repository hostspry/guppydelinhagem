"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import {
  comprarEtiquetas,
  gerarEtiquetas,
  imprimirEtiquetas,
  inserirNoCarrinho,
  melhorRastreioUrl,
  type MeEndereco,
} from "@/lib/melhorenvio";
import {
  cotarFreteSeco,
  volumesDoCarrinhoSeco,
  carrinhoTemCargaViva,
  calcularPesoECaixa,
  cotarFrete,
} from "@/lib/shipping";
import { getConfiguracaoLoja } from "@/lib/queries/config";
import { Transportadora } from "@/lib/generated/prisma/enums";

export type OpcaoEtiqueta = {
  servicoId: number;
  label: string;
  preco: number;
  prazoDias: number;
};

export type CotacaoResult =
  | { success: true; opcoes: OpcaoEtiqueta[]; aviso?: string }
  | { success: false; error: string };

export type CompraResult =
  | { success: true; etiquetaUrl: string | null; rastreio: string | null }
  | { success: false; error: string };

type EnderecoPedido = {
  nome?: string | null;
  cpfCnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
};

const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * Carrega o pedido com o que a etiqueta precisa e valida o básico.
 *
 * A checagem de PAGO é de propósito: etiqueta comprada é dinheiro gasto, e
 * comprar antes de receber é o erro que custa caro quando a venda não fecha.
 */
async function carregarPedido(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      numero: true,
      status: true,
      total: true,
      enderecoEntrega: true,
      etiquetaUrl: true,
      meShipmentId: true,
      servicoEnvioId: true,
      items: {
        select: {
          nomeProduto: true,
          quantidade: true,
          precoUnitario: true,
          qtdMachos: true,
          qtdFemeas: true,
          product: {
            select: {
              tipo: true,
              peso: true,
              comprimento: true,
              largura: true,
              altura: true,
            },
          },
        },
      },
    },
  });
  return order;
}

/** Itens no formato que lib/shipping entende, com o tipo de cada produto. */
function itensParaFrete(
  items: Awaited<ReturnType<typeof carregarPedido>> extends null
    ? never
    : NonNullable<Awaited<ReturnType<typeof carregarPedido>>>["items"],
) {
  return items.map((it) => ({
    // Item avulso (sem produto no catálogo) que tenha receita de peixe conta
    // como carga viva; sem receita, como acessório. É o palpite que erra menos.
    tipo:
      it.product?.tipo ??
      ((it.qtdMachos ?? 0) + (it.qtdFemeas ?? 0) > 0 ? "PEIXE" : "ACESSORIO"),
    quantidade: it.quantidade,
    pesoGramas:
      it.product?.peso == null ? null : Math.round(Number(it.product.peso) * 1000),
    comprimento:
      it.product?.comprimento == null ? null : Number(it.product.comprimento),
    largura: it.product?.largura == null ? null : Number(it.product.largura),
    altura: it.product?.altura == null ? null : Number(it.product.altura),
  }));
}

/**
 * Passo 1: cota. NÃO gasta saldo.
 *
 * Pedido com carga viva só oferece Jadlog .Com — é a única do catálogo que a
 * loja usa para peixe vivo, e deixar aparecer Correios aqui seria convidar o
 * erro de despachar bicho por quem não leva.
 */
export async function cotarEtiquetaDoPedido(
  orderId: string,
): Promise<CotacaoResult> {
  await assertPermissao("pedidos.envio");

  const order = await carregarPedido(orderId);
  if (!order) return { success: false, error: "Pedido não encontrado." };

  const dest = (order.enderecoEntrega ?? {}) as EnderecoPedido;
  const cep = digitos(dest.cep);
  if (cep.length !== 8) {
    return { success: false, error: "O pedido está sem CEP de entrega." };
  }
  if (order.items.length === 0) {
    return { success: false, error: "O pedido não tem itens." };
  }

  const itens = itensParaFrete(order.items);
  const valorSegurado = Number(order.total) || 0;

  if (carrinhoTemCargaViva(itens)) {
    const totalPeixes = order.items.reduce(
      (s, it) => s + ((it.qtdMachos ?? 0) + (it.qtdFemeas ?? 0)) * it.quantidade,
      0,
    );
    const { pesoGramas, caixa } = calcularPesoECaixa(Math.max(1, totalPeixes));
    const cot = await cotarFrete({ cepDestino: cep, pesoGramas, caixa });
    if (!cot.ok) return { success: false, error: cot.error };
    const jad = cot.data.jadlog[0];
    if (!jad) {
      return {
        success: false,
        error:
          "A Jadlog não atende esse CEP. Para peixe vivo, despache pelo aéreo (Gollog) e registre o rastreio à mão.",
      };
    }
    return {
      success: true,
      opcoes: [
        {
          servicoId: jad.id,
          label: "Jadlog .Com (carga viva)",
          preco: jad.price,
          prazoDias: jad.deliveryTime,
        },
      ],
      aviso:
        "Pedido com bicho vivo: só a Jadlog aparece aqui. O preço já inclui a caixa de isopor.",
    };
  }

  const volumes = volumesDoCarrinhoSeco(itens);
  const cfg = await getConfiguracaoLoja();
  const cot = await cotarFreteSeco({
    cepDestino: cep,
    volumes,
    valorSegurado,
    // Aqui o número é o CUSTO da etiqueta, não o preço ao cliente: a taxa de
    // embalagem não entra, senão o painel mostraria um valor que o Melhor
    // Envio não vai cobrar.
    taxaEmbalagem: 0,
  });
  void cfg;
  if (!cot.ok) return { success: false, error: cot.error };

  return {
    success: true,
    opcoes: cot.data.opcoes.map((o) => ({
      servicoId: o.servicoId,
      label: o.label,
      preco: o.preco,
      prazoDias: o.prazoDias,
    })),
  };
}

/** Remetente completo? Sem isso o ME recusa e o dinheiro nem chega a sair. */
function montarRemetente(cfg: {
  remetenteNome: string | null;
  remetenteDocumento: string | null;
  remetenteEmail: string | null;
  remetenteTelefone: string | null;
  remetenteCep: string | null;
  remetenteLogradouro: string | null;
  remetenteNumero: string | null;
  remetenteComplemento: string | null;
  remetenteBairro: string | null;
  remetenteCidade: string | null;
  remetenteUf: string | null;
}): { ok: true; de: MeEndereco } | { ok: false; faltando: string[] } {
  const doc = digitos(cfg.remetenteDocumento);
  const faltando: string[] = [];
  if (!cfg.remetenteNome) faltando.push("nome");
  if (doc.length !== 11 && doc.length !== 14) faltando.push("CPF ou CNPJ");
  if (!cfg.remetenteEmail) faltando.push("e-mail");
  if (digitos(cfg.remetenteTelefone).length < 10) faltando.push("telefone");
  if (digitos(cfg.remetenteCep).length !== 8) faltando.push("CEP");
  if (!cfg.remetenteLogradouro) faltando.push("rua");
  if (!cfg.remetenteNumero) faltando.push("número");
  if (!cfg.remetenteBairro) faltando.push("bairro");
  if (!cfg.remetenteCidade) faltando.push("cidade");
  if (!cfg.remetenteUf) faltando.push("UF");
  if (faltando.length > 0) return { ok: false, faltando };

  return {
    ok: true,
    de: {
      name: cfg.remetenteNome!,
      email: cfg.remetenteEmail!,
      phone: digitos(cfg.remetenteTelefone),
      ...(doc.length === 11 ? { document: doc } : { company_document: doc }),
      address: cfg.remetenteLogradouro!,
      number: cfg.remetenteNumero!,
      complement: cfg.remetenteComplemento ?? undefined,
      district: cfg.remetenteBairro!,
      city: cfg.remetenteCidade!,
      state_abbr: cfg.remetenteUf!,
      postal_code: digitos(cfg.remetenteCep),
      country_id: "BR",
    },
  };
}

/**
 * Passo 2: COMPRA a etiqueta. DEBITA o saldo do Melhor Envio.
 *
 * Sequência do ME: carrinho (grátis) → checkout (debita) → generate (emite o
 * rastreio) → print (PDF). Se o débito passa mas o generate falha, o pedido
 * guarda o id assim mesmo: o dinheiro já saiu, e perder o id significaria
 * pagar duas vezes pela mesma etiqueta.
 */
export async function comprarEtiquetaDoPedido(
  orderId: string,
  servicoId: number,
): Promise<CompraResult> {
  const membro = await assertPermissao("pedidos.envio");

  const order = await carregarPedido(orderId);
  if (!order) return { success: false, error: "Pedido não encontrado." };
  if (order.etiquetaUrl || order.meShipmentId) {
    return {
      success: false,
      error: "Este pedido já tem etiqueta. Veja o PDF no card de envio.",
    };
  }
  // ENVIADO também passa: às vezes o envio é registrado à mão antes e a
  // etiqueta é comprada em seguida.
  if (order.status !== "PAGO" && order.status !== "ENVIADO") {
    return {
      success: false,
      error:
        "Só compro etiqueta de pedido pago. Confirme o pagamento antes — etiqueta comprada não volta.",
    };
  }

  const cfg = await prisma.configuracaoLoja.findUnique({
    where: { id: "default" },
    select: {
      remetenteNome: true, remetenteDocumento: true, remetenteEmail: true,
      remetenteTelefone: true, remetenteCep: true, remetenteLogradouro: true,
      remetenteNumero: true, remetenteComplemento: true, remetenteBairro: true,
      remetenteCidade: true, remetenteUf: true,
    },
  });
  if (!cfg) return { success: false, error: "Configuração da loja não encontrada." };

  const rem = montarRemetente(cfg);
  if (!rem.ok) {
    return {
      success: false,
      error: `Complete os dados do remetente em Configurações → Entrega (falta: ${rem.faltando.join(", ")}).`,
    };
  }

  const dest = (order.enderecoEntrega ?? {}) as EnderecoPedido;
  const cepDest = digitos(dest.cep);
  if (cepDest.length !== 8 || !dest.nome || !dest.logradouro || !dest.bairro) {
    return {
      success: false,
      error: "O endereço de entrega está incompleto (nome, rua, bairro e CEP).",
    };
  }

  const itens = itensParaFrete(order.items);
  const vivo = carrinhoTemCargaViva(itens);
  const volumes = vivo
    ? (() => {
        const totalPeixes = order.items.reduce(
          (s, it) =>
            s + ((it.qtdMachos ?? 0) + (it.qtdFemeas ?? 0)) * it.quantidade,
          0,
        );
        const { pesoGramas, caixa } = calcularPesoECaixa(Math.max(1, totalPeixes));
        return [
          {
            height: caixa.altura,
            width: caixa.largura,
            length: caixa.comprimento,
            weight: pesoGramas / 1000,
          },
        ];
      })()
    : volumesDoCarrinhoSeco(itens).map((v) => ({
        height: v.height,
        width: v.width,
        length: v.length,
        weight: v.weight,
      }));

  const entrada = {
    service: servicoId,
    from: rem.de,
    to: {
      name: dest.nome!,
      email: dest.email ?? "",
      phone: digitos(dest.telefone),
      document: digitos(dest.cpfCnpj) || undefined,
      address: dest.logradouro!,
      number: dest.numero ?? "s/n",
      complement: dest.complemento ?? undefined,
      district: dest.bairro!,
      city: dest.cidade ?? "",
      state_abbr: (dest.uf ?? "").toUpperCase(),
      postal_code: cepDest,
      country_id: "BR",
    } satisfies MeEndereco,
    products: order.items.map((it) => ({
      name: it.nomeProduto.slice(0, 60),
      quantity: it.quantidade,
      unitary_value: Number(it.precoUnitario),
    })),
    volumes,
    options: {
      insurance_value: Number(order.total) || 0,
      receipt: false,
      own_hand: false,
      non_commercial: true,
    },
  };

  // ── 1. Carrinho (grátis) ──
  const carrinho = await inserirNoCarrinho(entrada);
  if (!carrinho.ok) {
    return { success: false, error: `Melhor Envio: ${carrinho.error}` };
  }
  const meId = carrinho.data.id;

  // ── 2. Compra (DEBITA) ──
  const compra = await comprarEtiquetas([meId]);
  if (!compra.ok) {
    return {
      success: false,
      error: `Não foi possível comprar: ${compra.error}. Confira o saldo no Melhor Envio.`,
    };
  }

  // Grava o id ANTES de gerar/imprimir: o dinheiro já saiu, e perder essa
  // referência faria comprar de novo a mesma etiqueta.
  await prisma.order.update({
    where: { id: orderId },
    data: { meShipmentId: meId, servicoEnvioId: servicoId },
  });

  // ── 3. Gera o rastreio e pega o PDF ──
  const gerou = await gerarEtiquetas([meId]);
  const impresso = gerou.ok ? await imprimirEtiquetas([meId]) : null;
  const etiquetaUrl =
    impresso && impresso.ok
      ? ((impresso.data as { url?: string })?.url ?? null)
      : null;

  // O código de rastreio vem do próprio ME (padrão ME…BR do Melhor Rastreio).
  const rastreio = meId;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      etiquetaUrl,
      selfTracking: rastreio,
      transportadora: Transportadora.OUTRO,
    },
  });

  await auditar(membro, {
    acao: "pedido.envio",
    entidade: "Order",
    entidadeId: orderId,
    descricao: `Comprou etiqueta do pedido ${order.numero} (serviço ${servicoId})`,
    depois: { meShipmentId: meId, etiquetaUrl },
  });

  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");

  return {
    success: true,
    etiquetaUrl,
    rastreio: rastreio ? melhorRastreioUrl(rastreio) : null,
  };
}
