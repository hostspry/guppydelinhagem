// Otimiza as imagens que já estão no servidor de mídia com a mesma regra do
// upload (lib/imagem): site até 100 KB sem perda visível, alta para o ML.
//
// Regra do dono: se a versão otimizada NÃO ficar menor que a original, fica a
// original. Nada é apagado do servidor: só a URL no banco muda, e um registro
// de antes/depois vai para backups/ no próprio servidor, para desfazer.
//
// Uso:
//   pnpm exec tsx --conditions=react-server scripts/otimizar-imagens-existentes.mts            (simula)
//   pnpm exec tsx --conditions=react-server scripts/otimizar-imagens-existentes.mts --aplicar  (grava)
// Precisa do DATABASE_URL apontando para o banco (túnel) e das variáveis S3_*.

import { readFileSync } from "node:fs";

for (const l of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
if (process.env.DATABASE_URL_TUNEL) process.env.DATABASE_URL = process.env.DATABASE_URL_TUNEL;

const APLICAR = process.argv.includes("--aplicar");
const { prisma } = await import("../lib/prisma");
const { otimizarImagemProduto, LIMITE_SITE_BYTES } = await import("../lib/imagem");
const { uploadImage, uploadArquivo } = await import("../lib/s3");

const MEU = process.env.S3_PUBLIC_URL!;
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

type Registro = { tabela: string; id: string; campo: string; antes: string | null; depois: string | null };
const registro: Registro[] = [];
let bytesAntes = 0;
let bytesDepois = 0;

async function baixar(url: string): Promise<Buffer | null> {
  const r = await fetch(url);
  if (!r.ok) {
    console.log(`  ! não baixou (${r.status}): ${url}`);
    return null;
  }
  return Buffer.from(await r.arrayBuffer());
}

/**
 * Otimiza uma URL. Devolve a URL que deve ficar no banco para o site e, se
 * pedido, a da versão alta. Original menor ou igual: mantém a original.
 */
async function otimizar(url: string, querAlta: boolean) {
  const original = await baixar(url);
  if (!original) return null;

  // Já dentro do limite (5% de folga): fica como está. Recomprimir WebP que já
  // foi comprimido só piora, e a simulação mostrou o custo: 2 KB a menos
  // custavam metade da resolução numa foto da criadeira.
  if (original.length <= LIMITE_SITE_BYTES * 1.05) {
    bytesAntes += original.length;
    bytesDepois += original.length;
    console.log(`  original ${kb(original.length)} | já está dentro do limite, fica como está`);
    return { novaSite: url, novaAlta: querAlta ? url : null, siteMenor: false };
  }

  const r = await otimizarImagemProduto(original);
  const sharp = (await import("sharp")).default;
  const meta = await sharp(original).metadata();
  const ladoOriginal = Math.max(meta.width ?? 0, meta.height ?? 0);
  const perdeResolucao = Math.max(r.site.largura, r.site.altura) < ladoOriginal;
  const economia = 1 - r.site.bytes / original.length;

  // Qualidade antes do limite: reduzir resolução para economizar pouco não vale.
  // Foi o caso do peixe do banner da home: 1800 px viraria 1200 px para 6% a menos.
  const siteMenor = r.site.bytes < original.length && (!perdeResolucao || economia >= 0.2);
  const altaMenor = r.alta.bytes < original.length;
  bytesAntes += original.length;
  bytesDepois += siteMenor ? r.site.bytes : original.length;

  console.log(
    `  original ${meta.width}x${meta.height} ${kb(original.length)} | site ${r.site.largura}x${r.site.altura} q${r.site.qualidade} ${kb(r.site.bytes)} ${siteMenor ? "USA" : r.site.bytes < original.length ? "economia pequena demais para perder resolução, fica a original" : "maior, fica a original"}` +
      (querAlta ? ` | alta ${r.alta.largura}x${r.alta.altura} ${kb(r.alta.bytes)} ${altaMenor ? "USA" : "maior, fica a original"}` : ""),
  );

  let novaSite = url;
  let novaAlta: string | null = null;
  if (APLICAR) {
    if (siteMenor) novaSite = await uploadImage(r.site.buffer, r.contentType, r.ext);
    if (querAlta) novaAlta = altaMenor ? await uploadImage(r.alta.buffer, r.contentType, r.ext) : url;
  }
  return { novaSite, novaAlta, siteMenor };
}

console.log(APLICAR ? "== APLICANDO ==" : "== SIMULAÇÃO (nada é gravado) ==");

// ── Fotos de produto: site + alta ─────────────────────────────────────────────
const fotos = await prisma.productImage.findMany({
  where: { url: { startsWith: MEU } },
  select: { id: true, url: true, urlAlta: true, product: { select: { nome: true } } },
  orderBy: [{ productId: "asc" }, { ordem: "asc" }],
});
console.log(`\nFotos de produto: ${fotos.length}`);
for (const f of fotos) {
  // Já passou pela otimização (tem alta): não recomprime o que já foi comprimido.
  if (f.urlAlta) {
    console.log(`- ${f.product.nome}: já otimizada, pulando`);
    continue;
  }
  console.log(`- ${f.product.nome}: ${f.url.split("/").pop()}`);
  const r = await otimizar(f.url, true);
  if (!r || !APLICAR) continue;
  // Mesmo mantendo a original, grava urlAlta: marca a foto como já tratada e o
  // ML passa a usar a própria original, que é a maior que existe.
  await prisma.productImage.update({
    where: { id: f.id },
    data: { url: r.novaSite, urlAlta: r.novaAlta },
  });
  registro.push({ tabela: "ProductImage", id: f.id, campo: "url", antes: f.url, depois: r.novaSite });
  registro.push({ tabela: "ProductImage", id: f.id, campo: "urlAlta", antes: null, depois: r.novaAlta });
}

// ── Capas de vídeo enviadas à mão (as do YouTube não são nossas) ─────────────
const capas = await prisma.productVideo.findMany({
  where: { thumbnailUrl: { startsWith: MEU } },
  select: { id: true, thumbnailUrl: true },
});
console.log(`\nCapas de vídeo: ${capas.length}`);
for (const c of capas) {
  console.log(`- ${c.thumbnailUrl!.split("/").pop()}`);
  const r = await otimizar(c.thumbnailUrl!, false);
  if (!r || !APLICAR || !r.siteMenor) continue;
  await prisma.productVideo.update({ where: { id: c.id }, data: { thumbnailUrl: r.novaSite } });
  registro.push({ tabela: "ProductVideo", id: c.id, campo: "thumbnailUrl", antes: c.thumbnailUrl, depois: r.novaSite });
}

// ── Peixe do banner da home (transparente: o WebP guarda a transparência) ───
const slides = await prisma.heroSlide.findMany({
  where: { fishImageUrl: { startsWith: MEU } },
  select: { id: true, fishImageUrl: true },
});
console.log(`\nBanner da home: ${slides.length}`);
for (const s of slides) {
  console.log(`- ${s.fishImageUrl.split("/").pop()}`);
  const r = await otimizar(s.fishImageUrl, false);
  if (!r || !APLICAR || !r.siteMenor) continue;
  await prisma.heroSlide.update({ where: { id: s.id }, data: { fishImageUrl: r.novaSite } });
  registro.push({ tabela: "HeroSlide", id: s.id, campo: "fishImageUrl", antes: s.fishImageUrl, depois: r.novaSite });
}

console.log(`\nTotal servido pelo site: ${kb(bytesAntes)} -> ${kb(bytesDepois)}`);

if (APLICAR && registro.length > 0) {
  const nome = `otimizacao-imagens-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const url = await uploadArquivo(
    Buffer.from(JSON.stringify(registro, null, 1)),
    "application/json",
    "json",
    `backups/${nome}`,
  );
  console.log(`Registro para desfazer: ${url}`);
}
await prisma.$disconnect();
