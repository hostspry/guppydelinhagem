/**
 * Confere se a IA acerta ENTRADA vs SAIDA em comprovante escrito na perspectiva
 * do CLIENTE ("Pix enviado" para um dinheiro que, para nós, entrou). Cada caso
 * roda duas vezes: sem a lista de titulares (regra antiga, pelo verbo) e com ela
 * (regra por lado da transação), para a diferença ficar visível.
 *
 * Rodar depois de qualquer mexida no prompt de lib/ai/comprovante.ts:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/teste-sinal-comprovante.mts
 *
 * A condição react-server é o que faz o import de "server-only" não estourar
 * fora do Next. Gasta chamadas do Gemini: são 8 requisições por execução.
 */
import fs from "fs";
import { lerComprovante, type CategoriaDisponivel } from "../lib/ai/comprovante";

// Carrega .env na mão (script solto, sem o loader do Next).
for (const l of fs.readFileSync(".env", "utf8").split("\n")) {
  if (!l.includes("=") || l.trim().startsWith("#")) continue;
  const k = l.slice(0, l.indexOf("=")).trim();
  const v = l.slice(l.indexOf("=") + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

const CATEGORIAS: CategoriaDisponivel[] = [
  { slug: "venda-whatsapp", nome: "Venda pelo WhatsApp", tipo: "ENTRADA" },
  { slug: "racao-insumos", nome: "Ração e insumos", tipo: "SAIDA" },
  { slug: "energia", nome: "Energia elétrica", tipo: "SAIDA" },
];

const TITULARES = ["Manasses Marchezi", "Guppy de Linhagem"];

// Os dois primeiros são o caso que quebra hoje: o comprovante foi tirado pelo
// CLIENTE, então o documento diz "enviado" para um dinheiro que, para nós, entrou.
const CASOS = [
  {
    nome: "Pix do cliente, perspectiva dele (print encaminhado)",
    esperado: "ENTRADA",
    texto: `Comprovante de transferência
Pix enviado
Valor: R$ 250,00
Data: 26/08/2026
Quem enviou: Maria Silva Souza  CPF ***.456.789-**
Quem recebeu: Manasses Marchezi  CPF ***.123.456-**
Instituição: Banco do Brasil
ID: E00360305202608261`,
  },
  {
    nome: "Pix do cliente, banco fala em 2a pessoa",
    esperado: "ENTRADA",
    texto: `Você transferiu R$ 1.180,00
para GUPPY DE LINHAGEM LTDA
em 26 de agosto de 2026 as 14h32
Tipo: Pix
Origem: conta corrente de Joao Pedro Almeida
Autenticacao: 4f2a9c`,
  },
  {
    nome: "Conta paga por nós",
    esperado: "SAIDA",
    texto: `Comprovante de pagamento
Pix enviado
Valor: R$ 380,45
Data: 20/08/2026
Pagador: Guppy de Linhagem LTDA
Beneficiario: Casa das Racoes Aquaville ME
Descricao: racao e insumos`,
  },
  {
    nome: "Nenhum lado identificado",
    esperado: "(confianca BAIXA)",
    texto: `Pix enviado
R$ 90,00
De: Carlos Souza
Para: Ana Beatriz Lima
15/08/2026`,
  },
];

async function main() {
  for (const caso of CASOS) {
    const semTitulares = await lerComprovante({ texto: caso.texto }, CATEGORIAS, []);
    const comTitulares = await lerComprovante({ texto: caso.texto }, CATEGORIAS, TITULARES);

    const ok = comTitulares.tipo === caso.esperado;
    const marca = caso.esperado.startsWith("(") ? "?" : ok ? "OK" : "FALHOU";

    console.log(`\n[${marca}] ${caso.nome}`);
    console.log(`   esperado ......... ${caso.esperado}`);
    console.log(`   antes (sem lista)  ${semTitulares.tipo}  conf=${semTitulares.confianca}`);
    console.log(`   depois (com lista) ${comTitulares.tipo}  conf=${comTitulares.confianca}`);
    console.log(`   valor=${comTitulares.valor}  data=${comTitulares.data}  cat=${comTitulares.categoriaSlug}`);
    console.log(`   descricao: ${comTitulares.descricao}`);
    if (comTitulares.aviso) console.log(`   aviso: ${comTitulares.aviso}`);
  }
}

main().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
