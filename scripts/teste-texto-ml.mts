// Regras de título/descrição do ML que filtram a sugestão da IA.
// Uso: pnpm exec tsx scripts/teste-texto-ml.mts
import {
  problemasTitulo,
  problemasDescricao,
  termosNoTitulo,
  diffPalavras,
  semTravessao,
  palavrasReescritas,
} from "../lib/mercadolivre/texto-ml";

let falhas = 0;
function conferir(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "ok " : "ERRO"} ${nome}${detalhe ? `  → ${detalhe}` : ""}`);
}

const trio = { composicao: "TRIO" as const };
const macho = { composicao: "MACHO" as const };

const bom = "Peixe Guppy Albino Red Silverado Trio Lebiste Vivo Aquário";
conferir("título atual do trio passa", problemasTitulo(bom, trio).length === 0, problemasTitulo(bom, trio).join(", "));
conferir("trio com 1 macho e 2 fêmeas passa", problemasTitulo("Guppy Albino Red Silverado Trio 1 Macho 2 Fêmeas Lebiste", trio).length === 0, problemasTitulo("Guppy Albino Red Silverado Trio 1 Macho 2 Fêmeas Lebiste", trio).join(", "));
conferir("sem composição reprova", problemasTitulo("Peixe Guppy Albino Red Silverado Lebiste Vivo Aquário", trio).includes("não diz a composição"));
conferir("macho citando fêmea reprova", problemasTitulo("Peixe Guppy Albino Red Macho e Fêmea Lebiste Vivo", macho).includes("cita outra composição"));
conferir("frete grátis reprova", problemasTitulo("Peixe Guppy Trio Lebiste Frete Grátis Aquário", trio).some((e) => e.includes("frete")));
conferir("premium reprova", problemasTitulo("Peixe Guppy Premium Trio Lebiste Vivo Aquário", trio).some((e) => e.includes("inflada")));
conferir("61 caracteres reprova", problemasTitulo("Peixe Guppy Albino Red Silverado Trio Lebiste Vivo Aquário Top", trio).some((e) => e.includes("60")));
conferir("MAIÚSCULAS reprova", problemasTitulo("Peixe GUPPY ALBINO Silverado Trio Lebiste Vivo", trio).some((e) => e.includes("maiúsculas")));
conferir("igual a outro anúncio reprova", problemasTitulo(bom, { ...trio, outrosTitulos: [bom.toLowerCase()] }).some((e) => e.includes("igual")));
conferir("sem guppy/lebiste reprova", problemasTitulo("Peixe Albino Red Silverado Trio Vivo Aquário", trio).some((e) => e.includes("guppy")));

conferir("termos cobertos", termosNoTitulo(bom).includes("peixe guppy") && termosNoTitulo(bom).includes("lebiste"), termosNoTitulo(bom).join(" | "));

const desc = "O Guppy Albino Red Silverado tem corpo prateado e cauda vermelha. ".repeat(5);
conferir("descrição limpa passa", problemasDescricao(desc).length === 0, problemasDescricao(desc).join(", "));
conferir("whatsapp reprova", problemasDescricao(desc + " Chama no WhatsApp 28 99917-9747").length >= 2, problemasDescricao(desc + " Chama no WhatsApp 28 99917-9747").join(", "));
conferir("link reprova", problemasDescricao(desc + " Veja em www.guppydelinhagem.com.br").includes("tem link"));
conferir("licença IBAMA (7 dígitos) não é telefone", !problemasDescricao(desc + " Licença IBAMA: 6277283.").includes("tem telefone"));

conferir(
  "parágrafo em maiúsculas reprova",
  problemasDescricao(desc + "\n\nGARANTIA DE PEIXE CHEGANDO VIVO OU ENVIAREMOS NOVAMENTE!").includes("tem parágrafo todo em maiúsculas"),
);
conferir(
  "sigla curta em maiúsculas passa",
  !problemasDescricao(desc + "\n\nLicença IBAMA: 6277283.").includes("tem parágrafo todo em maiúsculas"),
);

conferir("travessão vira vírgula", semTravessao("Guppy — de linhagem") === "Guppy, de linhagem", semTravessao("Guppy — de linhagem"));

const acentos = palavrasReescritas(
  "O guppy e um peixe resistente, os machos tem cores fortes e as femeas são maiores. Ele gosta de agua limpa",
  "O guppy é um peixe resistente, os machos têm cores fortes e as fêmeas são maiores. Ele gosta de água limpa.",
);
conferir("correção de acento não conta como reescrita", acentos.mudadas === 0, JSON.stringify(acentos));
const reescrita = palavrasReescritas(
  "O guppy e um peixe resistente e fácil de criar em casa",
  "Este lebiste é robusto e simples de manter no aquário doméstico",
);
conferir("troca de palavras conta", reescrita.mudadas >= 6, JSON.stringify(reescrita));

const d = diffPalavras("O peixe e bonito", "O peixe é bonito");
conferir("diff marca só a palavra trocada", d.filter((p) => p.tipo !== "igual").map((p) => p.texto).join("|") === "e|é", JSON.stringify(d));

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OK");
process.exit(falhas ? 1 : 0);
