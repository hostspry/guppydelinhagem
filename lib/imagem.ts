import "server-only";

/**
 * Otimiza a foto de produto antes de guardar. É o "TinyPNG" da casa.
 *
 * Regra do dono: imagem do site com NO MÁXIMO 100 KB e sem perda de qualidade
 * visível. Os dois juntos só cabem se o ajuste for no tamanho, não na
 * compressão: foto que a página mostra com 600 px não precisa de 1920.
 *
 * Por isso saem DUAS versões, as duas a partir do arquivo original, numa única
 * compressão (comprimir o que já foi comprimido soma defeito):
 * - SITE: até 100 KB. Começa em 1200 px e qualidade 86 e desce a qualidade
 *   até 72, que é o piso. Se ainda não couber, reduz o tamanho e tenta de novo.
 * - ALTA: até 1920 px, qualidade 90. Vai para o Mercado Livre, que precisa de
 *   foto grande para ligar o zoom e rebaixa o que passar de 1920.
 *
 * Nas duas: gira pela orientação da câmera e descarta os metadados (GPS da
 * estufa, modelo do celular). Não corta nem amplia.
 */

export const LIMITE_SITE_BYTES = 100 * 1024;
const QUALIDADE_MIN = 72;
const QUALIDADES = [86, 82, 78, 75, QUALIDADE_MIN];
/** 1200 cobre a página do produto em tela de alta densidade; o resto é reserva. */
const LADOS_SITE = [1200, 1080, 960, 840, 720, 600];
const LADO_ALTA = 1920;
const QUALIDADE_ALTA = 90;
/** O ML só liga o zoom com largura acima disto. */
const ZOOM_ML = 800;

export type VersaoImagem = { buffer: Buffer; largura: number; altura: number; bytes: number };

export type ImagemOtimizada = {
  site: VersaoImagem & { qualidade: number };
  alta: VersaoImagem;
  contentType: "image/webp";
  ext: "webp";
  bytesAntes: number;
  /** Avisos para quem subiu: sem zoom no ML, foto vertical etc. */
  avisos: string[];
};

export async function otimizarImagemProduto(entrada: Buffer): Promise<ImagemOtimizada> {
  // Import sob demanda: se o binário nativo faltar no servidor, o erro nasce
  // aqui dentro e quem chama sobe a foto original, em vez de o módulo inteiro
  // de upload deixar de carregar.
  const sharp = (await import("sharp")).default;

  // Decodifica e gira uma vez só; as tentativas partem daqui, sem recomprimir.
  const { data: base, info: baseInfo } = await sharp(entrada, { failOn: "none" })
    .rotate()
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bruto = { raw: { width: baseInfo.width, height: baseInfo.height, channels: baseInfo.channels } };

  const webp = async (lado: number, qualidade: number, effort: number): Promise<VersaoImagem> => {
    const { data, info } = await sharp(base, bruto)
      .resize({ width: lado, height: lado, fit: "inside", withoutEnlargement: true })
      .webp({ quality: qualidade, effort, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, largura: info.width, altura: info.height, bytes: data.length };
  };

  // As tentativas usam a compressão rápida (effort 4) só para achar tamanho e
  // qualidade; a versão gravada sai na mais caprichada (effort 6), que dá o
  // mesmo aspecto com arquivo igual ou menor.
  // A rápida sai uns 5% maior que a caprichada: o que passa do limite por
  // pouco ganha a chance de ser gravada caprichada antes de a qualidade descer.
  let site: (VersaoImagem & { qualidade: number }) | null = null;
  procura: for (const lado of LADOS_SITE) {
    // Se a foto já é menor que este lado, os próximos dariam o mesmo tamanho.
    const efetivo = Math.min(lado, Math.max(baseInfo.width, baseInfo.height));
    for (const q of QUALIDADES) {
      const rapida = await webp(efetivo, q, 4);
      if (rapida.bytes > LIMITE_SITE_BYTES * 1.1) continue;
      const final = await webp(efetivo, q, 6);
      if (final.bytes <= LIMITE_SITE_BYTES) {
        site = { ...final, qualidade: q };
        break procura;
      }
    }
  }
  // Foto muito carregada de detalhe: fica no menor tamanho, no piso de
  // qualidade, mesmo passando um pouco. Qualidade vem antes do limite.
  site ??= {
    ...(await webp(LADOS_SITE[LADOS_SITE.length - 1], QUALIDADE_MIN, 6)),
    qualidade: QUALIDADE_MIN,
  };
  const alta = await webp(LADO_ALTA, QUALIDADE_ALTA, 6);

  const avisos: string[] = [];
  if (site.bytes > LIMITE_SITE_BYTES) {
    avisos.push(`não coube em 100 KB sem perder qualidade (ficou ${Math.round(site.bytes / 1024)} KB)`);
  }
  if (alta.largura <= ZOOM_ML) {
    avisos.push(`tem ${alta.largura} px de largura, e o ML só dá zoom acima de ${ZOOM_ML}`);
  }
  const proporcao = alta.largura / alta.altura;
  if (proporcao < 0.8) {
    avisos.push("é vertical: no ML aparece estreita, com faixas dos lados; foto quadrada rende mais");
  } else if (proporcao > 1.25) {
    avisos.push("é horizontal: no ML aparece baixa; foto quadrada rende mais");
  }

  return {
    site,
    alta,
    contentType: "image/webp",
    ext: "webp",
    bytesAntes: entrada.length,
    avisos,
  };
}
