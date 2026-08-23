// Gera public/images/og-home.jpg, o cartão que aparece quando alguém compartilha
// o link do site no WhatsApp, Facebook ou X.
//
// Rodar: node scripts/gerar-og.mjs
//
// Três coisas aqui não são estética, são requisito de quem consome o link:
//   1200x630   fora dessa proporção o WhatsApp mostra uma miniatura pequena
//              ao lado do texto, em vez do banner grande.
//   JPEG       WebP é o formato que as prévias de link menos suportam.
//   sem promo  a prévia fica em cache por dias do lado do WhatsApp; preço no
//              cartão significa promoção vencida aparecendo depois.
//
// O texto também não cita prêmio: o título de tricampeão é da criação, não dos
// peixes que aparecem na arte.
import { createRequire } from "node:module";
import { statSync, existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const L = 1200;
const A = 630;
const FUNDO = "public/images/hero/bg-aquario-plantado.webp";
const LOGO = "public/logo.png";
// Peixe do hero. Baixe o arquivo atual de HeroSlide.fishImageUrl e salve aqui.
const PEIXE = "public/images/hero/peixe-og.webp";
const SAIDA = "public/images/og-home.jpg";

for (const f of [FUNDO, LOGO, PEIXE]) {
  if (!existsSync(f)) {
    console.error(`falta ${f}`);
    process.exit(1);
  }
}

const fundo = await sharp(FUNDO)
  .resize(L, A, { fit: "cover", position: "centre" })
  .toBuffer();

// Escurece a esquerda para o logo e o texto lerem sobre a foto.
const veu = Buffer.from(`<svg width="${L}" height="${A}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#04203f" stop-opacity="0.88"/>
    <stop offset="45%" stop-color="#04203f" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="#04203f" stop-opacity="0.12"/>
  </linearGradient></defs><rect width="${L}" height="${A}" fill="url(#g)"/></svg>`);

const peixe = await sharp(PEIXE).resize({ width: 720 }).toBuffer();
const mp = await sharp(peixe).metadata();
const logo = await sharp(LOGO).resize({ width: 300 }).toBuffer();
const ml = await sharp(logo).metadata();

const texto = Buffer.from(`<svg width="640" height="200" xmlns="http://www.w3.org/2000/svg">
  <style>
    .t { font-family: 'Nunito','Trebuchet MS',sans-serif; font-weight:800; fill:#ffffff; font-size:44px }
    .s { font-family: 'Nunito','Trebuchet MS',sans-serif; font-weight:600; fill:#cfe3f7; font-size:26px }
  </style>
  <text x="0" y="46" class="t">Guppys de linhagem</text>
  <text x="0" y="96" class="t">criados em Guarapari/ES</text>
  <text x="0" y="146" class="s">Envio de peixe vivo para todo o Brasil</text>
</svg>`);

await sharp(fundo)
  .composite([
    { input: veu, top: 0, left: 0 },
    { input: peixe, top: Math.round((A - mp.height) / 2), left: L - 700 },
    { input: logo, top: 74, left: 72 },
    { input: texto, top: 74 + ml.height + 34, left: 72 },
  ])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(SAIDA);

const m = await sharp(SAIDA).metadata();
console.log(`${SAIDA}: ${m.width}x${m.height} ${m.format}, ${Math.round(statSync(SAIDA).size / 1024)} KB`);
