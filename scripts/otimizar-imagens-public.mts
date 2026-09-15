// Otimiza as imagens do repositório (public/) com a regra do site: até 100 KB
// sem perda visível. Mesmas travas do script das imagens do servidor:
// - já dentro do limite (até 105 KB): fica;
// - otimizada não menor: fica a original;
// - reduzir resolução para economizar menos de 20%: fica a original.
//
// WebP é regravado no mesmo caminho. PNG/JPG viram .webp e as referências no
// código são trocadas; o arquivo antigo sai (o git guarda). Ficam de fora os
// arquivos que PRECISAM do formato: ícones do app e favicons (PNG) e os
// cartões de compartilhamento og-*.jpg (JPEG, que é o que o WhatsApp lê bem).
//
// Uso: pnpm exec tsx scripts/otimizar-imagens-public.mts [--aplicar]

import { readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from "node:fs";
import { join, extname, basename, relative } from "node:path";
import sharp from "sharp";

const APLICAR = process.argv.includes("--aplicar");
const LIMITE = 100 * 1024;
// "Qualidade sem alteração" (regra do dono): piso de 78 aqui, e quem não cabe
// em 100 KB grava a 86 em vez de descer mais.
const QUALIDADES = [86, 82, 78];
const QUALIDADE_SEM_LIMITE = 86;

/**
 * Largura que a imagem precisa ter para não perder nitidez onde aparece.
 * 1200 cobre a largura inteira de celular com tela de alta densidade (o caso
 * mais exigente das páginas: sizes "100vw" até 768 px). Exceções pelo uso
 * real, conferido no sizes de cada <Image>.
 */
const LARGURA_PADRAO = 1200;
const LARGURA_POR_ARQUIVO: Record<string, number> = {
  // Aparece com 640 px no computador: o dobro para tela de alta densidade.
  "marchezi-lucas03.webp": 1280,
};

const FORA = [
  /icon-.*\.png$/i,
  /favicon/i,
  /apple-touch/i,
  /^og-.*\.jpg$/i,
  // Matéria-prima do scripts/gerar-og.mjs: precisa da resolução cheia.
  /^peixe-og\.webp$/i,
];
const PASTAS_CODIGO = ["app", "components", "lib", "scripts", "prisma"];

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : [p];
  });
}

const codigo = PASTAS_CODIGO.flatMap((d) => listar(d)).filter((f) =>
  /\.(tsx?|mts|mjs|css|json|sql|prisma|md)$/.test(f) && !f.includes("generated"),
);

/**
 * WebP na largura mínima de nitidez, descendo a qualidade até caber em 100 KB.
 * Se nem no piso couber, devolve a do piso mesmo assim: aqui a nitidez vem
 * antes do limite, e quem decide se usa é a comparação com o original.
 */
async function webpNitida(buf: Buffer, larguraAlvo: number) {
  const gerar = async (q: number) => {
    const out = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({ width: larguraAlvo, withoutEnlargement: true })
      .webp({ quality: q, effort: 6, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
    return { ...out, q };
  };
  for (const q of QUALIDADES) {
    const v = await gerar(q);
    if (v.data.length <= LIMITE) return { ...v, coube: true };
  }
  return { ...(await gerar(QUALIDADE_SEM_LIMITE)), coube: false };
}

const kb = (n: number) => `${Math.round(n / 1024)} KB`;
let antes = 0;
let depois = 0;

for (const arq of listar("public").filter((f) => /\.(png|jpe?g|webp)$/i.test(f))) {
  const buf = readFileSync(arq);
  const nome = basename(arq);
  antes += buf.length;

  if (FORA.some((re) => re.test(nome))) {
    depois += buf.length;
    continue;
  }
  if (buf.length <= LIMITE * 1.05) {
    depois += buf.length;
    continue;
  }

  const meta = await sharp(buf).metadata();
  const larguraAlvo = Math.min(meta.width ?? 0, LARGURA_POR_ARQUIVO[nome] ?? LARGURA_PADRAO);

  // WebP já passou por compressão (o dono otimiza à mão). Comprimir de novo só
  // perde; a exceção é arquivo muito maior que o necessário, onde reduzir o
  // tamanho não custa nitidez nenhuma na página.
  if (extname(arq).toLowerCase() === ".webp" && (meta.width ?? 0) <= larguraAlvo * 1.5) {
    depois += buf.length;
    console.log(`/${relative("public", arq).replace(/\\/g, "/")} ${meta.width}x${meta.height} ${kb(buf.length)} | WebP já otimizado, fica`);
    continue;
  }
  const r = await webpNitida(buf, larguraAlvo);
  // Nunca abaixo da largura de nitidez, então só falta a regra do dono:
  // otimizada que não fica menor, fica a original.
  const usa = !!r && r.data.length < buf.length;

  const ext = extname(arq).toLowerCase();
  const destino = ext === ".webp" ? arq : arq.slice(0, -ext.length) + ".webp";
  const rota = "/" + relative("public", arq).replace(/\\/g, "/");
  const rotaNova = "/" + relative("public", destino).replace(/\\/g, "/");
  // Busca pelo NOME do arquivo: há página que monta o caminho com variável
  // (`${IMG}/tres-geracoes.jpg`), e a busca pelo caminho inteiro não acha.
  const nomeNovo = basename(destino);
  const refs = codigo.filter((f) => readFileSync(f, "utf8").includes(nome));

  console.log(
    `${rota} ${meta.width}x${meta.height} ${kb(buf.length)} -> ` +
      (r ? `${r.info.width}x${r.info.height} q${r.q} ${kb(r.data.length)}${r.coube ? "" : " (passa de 100 KB para não perder nitidez)"}` : "falhou") +
      ` | ${usa ? "USA" : "fica a original"} | refs: ${refs.length}${ext !== ".webp" && usa ? ` -> ${rotaNova}` : ""}`,
  );
  depois += usa && r ? r.data.length : buf.length;

  if (!APLICAR || !usa || !r) continue;
  if (ext !== ".webp" && statSync(destino, { throwIfNoEntry: false })) {
    console.log(`  ! já existe ${rotaNova}, pulando para não sobrescrever`);
    continue;
  }
  if (destino !== arq && refs.length === 0) {
    // Sem referência nenhuma: pode ser usada por caminho que não sei ler. Não
    // troco formato às cegas; quem decide é quem conhece o uso.
    console.log(`  ! nenhuma referência a ${nome}, mantendo o original`);
    continue;
  }
  writeFileSync(destino, r.data);
  if (destino !== arq) {
    for (const f of refs) writeFileSync(f, readFileSync(f, "utf8").split(nome).join(nomeNovo));
    unlinkSync(arq);
  }
}

console.log(`\nTOTAL public/: ${kb(antes)} -> ${kb(depois)}`);
