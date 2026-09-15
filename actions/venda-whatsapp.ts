"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { checarDescontoDoPedido } from "@/lib/permissoes";
import { auditar } from "@/lib/auditoria";
import { ehSemCredito } from "@/lib/ai/credito";
import {
  lerConversa,
  MAX_BYTES_PRINTS,
  MAX_PRINTS,
  MIMES_PRINT,
  type ConversaLida,
} from "@/lib/ai/conversa-venda";
import { lerDadosWhatsapp, normalizarDadosCliente } from "@/lib/whatsapp-cliente";
import { getCatalogoPedido } from "@/lib/queries/pedidos";
import { getTaxaEmbalagemSeco } from "@/lib/queries/config";
import {
  carrinhoTemCargaViva,
  cotarFreteSeco,
  volumesDoCarrinhoSeco,
  type OpcaoFreteSeco,
} from "@/lib/shipping";
import { transicionarParaPago } from "@/lib/pedido-baixa";
import { empurrarEstoqueDoPedido } from "@/lib/shopee/estoque";
import { pedirConfirmacaoEnvioAereo } from "@/lib/gollog/confirmacao";
import { semanaDaChave } from "@/lib/semana-envio";
import { COMPOSICAO_LABEL } from "@/lib/composicoes";
import {
  vendaWhatsappSchema,
  type VendaWhatsappInput,
} from "@/lib/validations/venda-whatsapp";
import type { Prisma } from "@/lib/generated/prisma/client";

export type VendaResult =
  | { success: true; orderId: string; numero: string; clienteNovo: boolean }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/** Cliente parecido, para a tela perguntar antes de duplicar cadastro. */
export type ClienteParecido = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpfCnpj: string | null;
  cidade: string | null;
  uf: string | null;
  /** Por que casou — a tela mostra para o operador julgar. */
  motivo: "cpf" | "email" | "telefone";
  pedidos: number;
};

/** Cadastro completo, para a tela preencher o formulário ao escolher um cliente. */
export type ClienteCompleto = {
  id: string;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  pedidos: number;
};

const soDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Procura o cliente pelos dados colados, na ordem de confiança.
 *
 * CPF primeiro porque é único de verdade; e-mail depois; telefone por último,
 * que é o mais frágil (casal que divide número, número reciclado pela operadora).
 * Devolve TODOS os candidatos em vez de decidir sozinho: juntar dois clientes
 * por engano é bem pior do que perguntar.
 */
export async function procurarCliente(dados: {
  cpfCnpj?: string;
  email?: string;
  telefone?: string;
}): Promise<ClienteParecido[]> {
  await assertPermissao("clientes.ver");

  const cpf = soDigitos(dados.cpfCnpj);
  const email = (dados.email ?? "").trim().toLowerCase();
  const tel = soDigitos(dados.telefone);

  const ors: Prisma.ClienteWhereInput[] = [];
  if (cpf) ors.push({ cpfCnpj: cpf });
  if (email) ors.push({ email: { equals: email, mode: "insensitive" } });
  if (tel) {
    // Cadastro que veio de outro canal pode ter guardado o número com o 55.
    ors.push({ telefone: { in: [tel, `55${tel}`] } });
  }
  if (ors.length === 0) return [];

  const achados = await prisma.cliente.findMany({
    where: { OR: ors },
    select: {
      id: true,
      nome: true,
      telefone: true,
      email: true,
      cpfCnpj: true,
      cidade: true,
      uf: true,
      _count: { select: { pedidos: true } },
    },
    take: 5,
  });

  return achados.map((c) => ({
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    email: c.email,
    cpfCnpj: c.cpfCnpj,
    cidade: c.cidade,
    uf: c.uf,
    motivo:
      cpf && c.cpfCnpj === cpf
        ? ("cpf" as const)
        : email && (c.email ?? "").toLowerCase() === email
          ? ("email" as const)
          : ("telefone" as const),
    pedidos: c._count.pedidos,
  }));
}

/** Busca manual por nome, telefone ou CPF — para quando a leitura não achou o cliente. */
export async function buscarClientes(q: string): Promise<ClienteCompleto[]> {
  await assertPermissao("clientes.ver");
  const termo = q.trim();
  if (termo.length < 2) return [];

  const dig = soDigitos(termo);
  const ors: Prisma.ClienteWhereInput[] = [
    { nome: { contains: termo, mode: "insensitive" } },
    { email: { contains: termo, mode: "insensitive" } },
  ];
  if (dig.length >= 4) {
    ors.push({ telefone: { contains: dig } }, { cpfCnpj: { contains: dig } });
  }

  const achados = await prisma.cliente.findMany({
    where: { OR: ors },
    orderBy: { nome: "asc" },
    take: 8,
    select: {
      id: true, nome: true, cpfCnpj: true, telefone: true, email: true,
      cep: true, logradouro: true, numero: true, complemento: true,
      bairro: true, cidade: true, uf: true,
      _count: { select: { pedidos: true } },
    },
  });

  return achados.map((c) => ({
    id: c.id,
    nome: c.nome,
    cpfCnpj: c.cpfCnpj ?? "",
    telefone: c.telefone ?? "",
    email: c.email ?? "",
    cep: c.cep ?? "",
    logradouro: c.logradouro ?? "",
    numero: c.numero ?? "",
    complemento: c.complemento ?? "",
    bairro: c.bairro ?? "",
    cidade: c.cidade ?? "",
    uf: c.uf ?? "",
    pedidos: c._count.pedidos,
  }));
}

export type CotacaoPedidoResult =
  | { ok: true; opcoes: OpcaoFreteSeco[]; semMedida: number }
  | { ok: false; error: string };

/**
 * Frete de produto seco (sem peixe) para o pedido manual: a mesma cotação do
 * checkout, em todas as transportadoras do Melhor Envio, já com a taxa de
 * embalagem. Volta a mais barata primeiro (e a mais rápida, quando é outra).
 *
 * Peso e medidas saem do cadastro do produto. Item avulso não tem cadastro:
 * entra com o pacote padrão, e a tela avisa para conferir.
 */
export async function cotarFretePedido(input: {
  cep: string;
  itens: { produtoId: string | null; quantidade: number }[];
}): Promise<CotacaoPedidoResult> {
  await assertPermissao("pedidos.editar");

  const ids = [...new Set(input.itens.map((i) => i.produtoId).filter((v): v is string => !!v))];
  const produtos = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          tipo: true,
          preco: true,
          peso: true,
          comprimento: true,
          largura: true,
          altura: true,
        },
      })
    : [];
  const pmap = new Map(produtos.map((p) => [p.id, p]));

  let semMedida = 0;
  let valor = 0;
  const itens = input.itens.map((it) => {
    const q = Math.max(1, Math.min(99, Math.round(Number(it.quantidade)) || 1));
    const p = it.produtoId ? pmap.get(it.produtoId) : undefined;
    if (!p) {
      semMedida++;
      return { tipo: "ACESSORIO" as const, quantidade: q, pesoGramas: null, comprimento: null, largura: null, altura: null };
    }
    valor += Number(p.preco) * q;
    if (p.peso == null || p.comprimento == null) semMedida++;
    return {
      tipo: p.tipo,
      quantidade: q,
      pesoGramas: p.peso == null ? null : Math.round(Number(p.peso) * 1000),
      comprimento: p.comprimento == null ? null : Number(p.comprimento),
      largura: p.largura == null ? null : Number(p.largura),
      altura: p.altura == null ? null : Number(p.altura),
    };
  });

  if (carrinhoTemCargaViva(itens)) {
    return { ok: false, error: "Pedido com peixe vai de Jadlog ou Gollog, sem cotação do Melhor Envio." };
  }
  const volumes = volumesDoCarrinhoSeco(itens);
  if (volumes.length === 0) return { ok: false, error: "Nenhum item para despachar." };

  const r = await cotarFreteSeco({
    cepDestino: input.cep,
    volumes,
    valorSegurado: valor,
    taxaEmbalagem: await getTaxaEmbalagemSeco(),
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, opcoes: r.data.opcoes, semMedida };
}

export type LeituraConversaResult =
  | { ok: true; dados: ConversaLida; parecidos: ClienteParecido[] }
  | { ok: false; error: string };

/**
 * Lê a conversa (texto colado e/ou prints) e devolve um RASCUNHO do pedido.
 * Nada é gravado aqui: o operador confere na tela e só então registra a venda.
 */
export async function lerConversaVenda(
  formData: FormData,
): Promise<LeituraConversaResult> {
  await assertPermissao("pedidos.editar");

  const texto = String(formData.get("texto") ?? "").trim();
  const arquivos = formData
    .getAll("prints")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (arquivos.length > MAX_PRINTS) {
    return { ok: false, error: `Mande no máximo ${MAX_PRINTS} prints por vez.` };
  }
  for (const f of arquivos) {
    if (!(MIMES_PRINT as readonly string[]).includes(f.type)) {
      return { ok: false, error: "Os prints precisam ser imagem (JPG, PNG ou WEBP)." };
    }
  }
  if (arquivos.reduce((s, f) => s + f.size, 0) > MAX_BYTES_PRINTS) {
    return { ok: false, error: "Os prints passaram de 9 MB juntos. Mande menos de cada vez." };
  }
  if (arquivos.length === 0 && texto.length < 10) {
    return { ok: false, error: "Cole a conversa ou escolha os prints." };
  }

  const imagens = await Promise.all(
    arquivos.map(async (f) => ({
      base64: Buffer.from(await f.arrayBuffer()).toString("base64"),
      mimeType: f.type,
    })),
  );

  try {
    const catalogo = await getCatalogoPedido();
    const lido = await lerConversa({ texto, imagens }, catalogo);

    // O parser por regras continua valendo para texto colado: bloco com rótulo
    // ("CPF: ...") ele lê sem errar. Completa o que a IA deixou em branco.
    let cliente = normalizarDadosCliente(lido.cliente);
    if (texto) {
      const { dados: regras } = lerDadosWhatsapp(texto);
      cliente = Object.fromEntries(
        Object.entries(cliente).map(([k, v]) => [
          k,
          v || regras[k as keyof typeof regras] || "",
        ]),
      ) as typeof cliente;
    }

    const parecidos = await procurarCliente({
      cpfCnpj: cliente.cpfCnpj,
      email: cliente.email,
      telefone: cliente.telefone,
    });

    return { ok: true, dados: { ...lido, cliente }, parecidos };
  } catch (e) {
    console.error("[venda-whatsapp] leitura", e);
    const erro = e instanceof Error ? e.message : "";
    return {
      ok: false,
      error: ehSemCredito(erro)
        ? erro
        : /GEMINI_API_KEY/.test(erro)
          ? "A leitura por IA não está configurada (falta a chave do Gemini)."
          : "Não consegui ler a conversa com a IA. Use a leitura sem IA ou preencha à mão.",
    };
  }
}

/** Preenche só o que está vazio: dado antigo do cadastro não é sobrescrito à toa. */
function completar<T extends Record<string, string | null>>(
  atual: T,
  novo: Record<string, string>,
): Partial<T> {
  const saida: Record<string, string> = {};
  for (const [k, v] of Object.entries(novo)) {
    if (!v) continue;
    if (!atual[k as keyof T]) saida[k] = v;
  }
  return saida as Partial<T>;
}

/**
 * Registra uma venda feita no WhatsApp (ou qualquer venda lançada no painel).
 *
 * Cliente: usa o que o operador confirmou (clienteId) ou cria um novo. Quando
 * reusa, completa os campos que faltavam no cadastro sem apagar o que já havia
 * — endereço novo costuma ser mais atual, mas quem decide trocar é o operador,
 * na tela de clientes.
 *
 * Preço: sempre o que o cliente pagou, digitado na tela. O catálogo só liga o
 * item ao produto (nome, foto, receita do peixe para o estoque).
 *
 * Pago: o pedido nasce aguardando e passa, na mesma transação, pela confirmação
 * de pagamento que o site e o botão de status usam — baixa o estoque e põe a
 * venda no caixa para conferência. Não pago: fica AGUARDANDO_PAGAMENTO.
 */
export async function criarVendaWhatsapp(input: unknown): Promise<VendaResult> {
  const membro = await assertPermissao("pedidos.editar");

  const parsed = vendaWhatsappSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const d: VendaWhatsappInput = parsed.data;

  // Confirmar pagamento é mudar status: mesma permissão do botão no detalhe.
  if (d.jaPago && !membro.permissoes.includes("pedidos.status")) {
    return {
      success: false,
      error: "Seu cargo não pode confirmar pagamento. Registre sem marcar como pago.",
    };
  }

  // ── Itens: nome e receita do catálogo; preço é o pago ──
  const idsCatalogo = d.itens
    .map((i) => i.produtoId)
    .filter((v): v is string => !!v);
  const produtos = idsCatalogo.length
    ? await prisma.product.findMany({
        where: { id: { in: idsCatalogo } },
        select: {
          id: true,
          nome: true,
          videos: { where: { principal: true }, take: 1, select: { thumbnailUrl: true } },
          imagens: { orderBy: { ordem: "asc" }, take: 1, select: { url: true } },
          variantes: {
            where: { ativo: true },
            select: { composicao: true, qtdMachos: true, qtdFemeas: true },
          },
        },
      })
    : [];
  const pmap = new Map(produtos.map((p) => [p.id, p]));

  const itensData = d.itens.map((it) => {
    const prod = it.produtoId ? pmap.get(it.produtoId) : null;
    const variante = prod?.variantes.find((v) => v.composicao === it.composicao);
    return {
      productId: prod?.id ?? null,
      // Mesmo formato do pedido manual: a composição no nome é o que aparece
      // na separação e na etiqueta.
      nomeProduto: prod
        ? variante
          ? `${prod.nome} — ${COMPOSICAO_LABEL[variante.composicao]}`
          : prod.nome
        : it.nomeProduto.trim(),
      precoUnitario: it.precoUnitario,
      quantidade: it.quantidade,
      imagemSnapshot:
        prod?.videos[0]?.thumbnailUrl ?? prod?.imagens[0]?.url ?? null,
      composicao: variante ? variante.composicao : null,
      qtdMachos: variante ? variante.qtdMachos : null,
      qtdFemeas: variante ? variante.qtdFemeas : null,
    };
  });

  const subtotal = round2(
    itensData.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0),
  );
  const total = round2(Math.max(0, subtotal + d.frete - d.desconto));

  const foraDoLimite = checarDescontoDoPedido(membro, subtotal, d.desconto);
  if (foraDoLimite) return { success: false, error: foraDoLimite };

  const dadosCliente = {
    nome: d.nome,
    cpfCnpj: d.cpfCnpj,
    email: d.email,
    telefone: d.telefone,
    cep: d.cep,
    logradouro: d.logradouro,
    numero: d.numero,
    complemento: d.complemento,
    bairro: d.bairro,
    cidade: d.cidade,
    uf: d.uf,
  };

  let clienteNovo = false;
  let orderId = "";
  let numero = "";

  try {
    const criado = await prisma.$transaction(async (tx) => {
      // ── Cliente ──
      let clienteId = d.clienteId ?? null;
      if (clienteId) {
        const atual = await tx.cliente.findUnique({
          where: { id: clienteId },
          select: {
            id: true, nome: true, cpfCnpj: true, email: true, telefone: true,
            cep: true, logradouro: true, numero: true, complemento: true,
            bairro: true, cidade: true, uf: true,
          },
        });
        if (!atual) throw new Error("Cliente selecionado não existe mais.");
        const faltando = completar(atual, dadosCliente);
        if (Object.keys(faltando).length > 0) {
          await tx.cliente.update({ where: { id: clienteId }, data: faltando });
        }
      } else {
        const novo = await tx.cliente.create({
          data: {
            ...dadosCliente,
            cpfCnpj: d.cpfCnpj || null,
            email: d.email || null,
            telefone: d.telefone || null,
          },
          select: { id: true },
        });
        clienteId = novo.id;
        clienteNovo = true;
      }

      // ── Endereço do pedido: snapshot do que foi combinado nesta venda ──
      const endereco = {
        nome: d.nome,
        cpfCnpj: d.cpfCnpj || null,
        telefone: d.telefone || null,
        email: d.email || null,
        cep: d.cep,
        logradouro: d.logradouro || null,
        numero: d.numero || null,
        complemento: d.complemento || null,
        bairro: d.bairro || null,
        cidade: d.cidade || null,
        uf: d.uf || null,
      };

      const ano = new Date().getFullYear();
      const ultimo = await tx.order.findFirst({
        where: { ano },
        orderBy: { sequencia: "desc" },
        select: { sequencia: true },
      });
      const sequencia = (ultimo?.sequencia ?? 0) + 1;
      const num = `#${ano}-${String(sequencia).padStart(4, "0")}`;

      const order = await tx.order.create({
        data: {
          numero: num,
          ano,
          sequencia,
          clienteId,
          origem: "WHATSAPP",
          status: "AGUARDANDO_PAGAMENTO",
          formaPagamento: d.formaPagamento ?? null,
          transportadora: d.transportadora ?? (d.servicoEnvioId ? "OUTRO" : null),
          // Produto seco com serviço cotado: mesmo formato do checkout, para a
          // etiqueta e o painel tratarem igual.
          ...(d.servicoEnvioId
            ? {
                modalidadeFrete: "SECO",
                servicoEnvioId: d.servicoEnvioId,
                servicoEnvioNome: d.servicoEnvioNome || null,
              }
            : {}),
          semanaEnvio: semanaDaChave(d.semanaEnvio),
          observacoes: d.observacoes || null,
          enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
          subtotal,
          frete: d.frete,
          desconto: d.desconto,
          total,
          items: { create: itensData },
        },
        select: { id: true, numero: true },
      });

      if (d.jaPago) await transicionarParaPago(tx, order.id);
      return order;
    });
    orderId = criado.id;
    numero = criado.numero;
  } catch (e) {
    console.error("[venda-whatsapp] criar", e);
    return {
      success: false,
      error:
        e instanceof Error && e.message.includes("não existe")
          ? e.message
          : "Não foi possível registrar a venda.",
    };
  }

  // Estoque baixou: reflete na Shopee, sem o painel esperar o marketplace.
  if (d.jaPago) {
    void empurrarEstoqueDoPedido(orderId);
    // Aéreo: o cliente recebe o link para confirmar aeroporto e quem retira.
    void pedirConfirmacaoEnvioAereo(orderId);
  }

  await auditar(membro, {
    acao: "pedido.criar",
    entidade: "Order",
    entidadeId: orderId,
    descricao: `Registrou venda do WhatsApp ${numero} de ${total.toFixed(2)}${clienteNovo ? " (cliente novo)" : ""}`,
    depois: { total, itens: itensData.length, jaPago: d.jaPago },
  });

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/produtos");
  if (d.jaPago) revalidatePath("/admin/financeiro");
  return { success: true, orderId, numero, clienteNovo };
}
