/**
 * Lê o bloco de dados que o cliente manda no WhatsApp e devolve campos.
 *
 * Módulo PURO: sem Prisma e sem rede, para poder ser exercitado com texto real
 * (é o que garante que a bagunça do mundo real não quebre o cadastro).
 *
 * O que o mundo real manda, e que o formato precisa aguentar:
 *
 *   Nome: Raul Moreira Castro Junior
 *   CPF:172.160.938-52          → sem espaço depois dos dois pontos
 *   Rua : Quintino Bocaiuva     → espaço ANTES dos dois pontos
 *   Número: 1203
 *   Complemento:                → rótulo sem valor nenhum
 *   Bairro:Jardim Paraíso
 *   Cidade: Bebedouro
 *   Estado: SP
 *   Cep : 14.701-470            → CEP pontuado
 *   Telefone com DDD:
 *   24 999277785                → valor na LINHA DE BAIXO do rótulo
 *
 * Por isso o parser não usa "uma linha = um campo": ele acha o rótulo, pega o
 * que vem depois na mesma linha e, se estiver vazio, olha a linha seguinte —
 * desde que ela já não seja outro rótulo.
 */

export type DadosWhatsapp = {
  nome: string;
  cpfCnpj: string; // só dígitos
  email: string;
  telefone: string; // só dígitos
  cep: string; // só dígitos
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type CampoWhatsapp = keyof DadosWhatsapp;

/**
 * Rótulos aceitos por campo, em minúsculas e sem acento. A ordem importa: o
 * texto é varrido rótulo a rótulo, e "numero" precisa vir depois de "cep" para
 * "Número" não capturar o número do CEP em textos mal formatados.
 */
const ROTULOS: { campo: CampoWhatsapp; nomes: string[] }[] = [
  { campo: "nome", nomes: ["nome completo", "nome"] },
  { campo: "cpfCnpj", nomes: ["cpf/cnpj", "cpf ou cnpj", "cnpj", "cpf"] },
  { campo: "email", nomes: ["e-mail", "email"] },
  {
    campo: "telefone",
    nomes: [
      "telefone com ddd",
      "celular com ddd",
      "whatsapp",
      "telefone",
      "celular",
      "fone",
      "tel",
    ],
  },
  { campo: "cep", nomes: ["cep"] },
  {
    campo: "logradouro",
    nomes: ["logradouro", "endereco", "rua", "avenida", "av"],
  },
  { campo: "numero", nomes: ["numero", "num", "n"] },
  { campo: "complemento", nomes: ["complemento", "compl"] },
  { campo: "bairro", nomes: ["bairro"] },
  { campo: "cidade", nomes: ["cidade", "municipio"] },
  { campo: "uf", nomes: ["estado", "uf"] },
];

/**
 * Tira acento para COMPARAR rótulo, sem encurtar a string.
 *
 * O comprimento importa: o valor é recortado da linha original por posição, e
 * se a versão sem acento encolhesse, o corte comeria as primeiras letras
 * ("São Paulo" virava "ão Paulo"). Compondo em NFC antes, cada letra acentuada
 * é UM caractere na entrada e vira UM caractere na saída.
 */
const semAcento = (s: string) =>
  s.normalize("NFC").normalize("NFD").replace(/[̀-ͯ]/g, "");

const digitos = (s: string) => s.replace(/\D/g, "");

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Rótulos que valem mesmo sem os dois pontos ("Nome Ana Beatriz", "Cidade Aguaí").
 *
 * Só entra aqui o rótulo que nunca faz parte do próprio valor. "Rua" fica de
 * fora de propósito: em "Rua Marieta Moro 458" a palavra É o endereço, e cortá-la
 * entregaria uma etiqueta de envio sem o tipo do logradouro.
 */
const ROTULOS_SEM_SINAL = new Set([
  "nome completo", "nome", "cpf/cnpj", "cpf ou cnpj", "cnpj", "cpf", "e-mail",
  "email", "telefone com ddd", "celular com ddd", "whatsapp", "telefone",
  "celular", "cep", "numero", "complemento", "bairro", "cidade", "municipio",
  "estado",
]);

/**
 * A linha começa com algum rótulo conhecido? Devolve qual, e o que sobra.
 *
 * O casamento acontece numa cópia sem acento e em minúsculas, mas o valor é
 * recortado da linha ORIGINAL pelo TAMANHO DO RÓTULO casado, não pelo tamanho
 * do que sobrou. A diferença não é acadêmica: linha vinda do WhatsApp costuma
 * ter espaço sobrando no fim ("Nome: Raul Castro "), e medir pelo resto fazia o
 * corte avançar demais e comer a primeira letra do valor ("aul Castro").
 */
function lerRotulo(
  linha: string,
): { campo: CampoWhatsapp; resto: string; separado: boolean } | null {
  // Sem trim aqui de propósito: o comprimento precisa bater com a linha real.
  const normal = semAcento(linha).toLowerCase();
  for (const { campo, nomes } of ROTULOS) {
    for (const nome of nomes) {
      // Aceita espaço antes dos dois pontos ("Rua :") e ausência depois.
      const re = new RegExp(`^\\s*${escaparRegex(nome)}\\s*[:\\-–]\\s*`, "i");
      const m = normal.match(re);
      if (m) {
        return { campo, resto: linha.slice(m[0].length).trim(), separado: true };
      }
    }
  }
  // Só depois de esgotar os dois pontos: "Bairro: Cidade Nova" tem que virar
  // bairro, não cidade.
  for (const { campo, nomes } of ROTULOS) {
    for (const nome of nomes) {
      if (!ROTULOS_SEM_SINAL.has(nome)) continue;
      const re = new RegExp(`^\\s*${escaparRegex(nome)}\\s+(?=\\S)`, "i");
      const m = normal.match(re);
      if (m) {
        return { campo, resto: linha.slice(m[0].length).trim(), separado: false };
      }
    }
  }
  return null;
}

const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE",
  "TO",
]);

/** Nome de estado por extenso → sigla, porque muita gente escreve por extenso. */
const ESTADOS: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA",
  ceara: "CE", "distrito federal": "DF", "espirito santo": "ES", goias: "GO",
  maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
  "minas gerais": "MG", para: "PA", paraiba: "PB", parana: "PR",
  pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO",
  roraima: "RR", "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE",
  tocantins: "TO",
};

function normalizarUf(bruto: string): string {
  const s = semAcento(bruto).trim().toLowerCase();
  if (!s) return "";
  const sigla = s.toUpperCase();
  if (sigla.length === 2 && UFS.has(sigla)) return sigla;
  return ESTADOS[s] ?? "";
}

/**
 * Telefone brasileiro só vale com 10 ou 11 dígitos. Sem esse filtro, um "24"
 * solto numa linha viraria telefone.
 */
function normalizarTelefone(bruto: string): string {
  let d = digitos(bruto);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2); // veio com o país
  return d.length === 10 || d.length === 11 ? d : "";
}

function normalizarDoc(bruto: string): string {
  const d = digitos(bruto);
  return d.length === 11 || d.length === 14 ? d : "";
}

function normalizarCep(bruto: string): string {
  const d = digitos(bruto);
  return d.length === 8 ? d : "";
}

const VAZIO: DadosWhatsapp = {
  nome: "", cpfCnpj: "", email: "", telefone: "", cep: "", logradouro: "",
  numero: "", complemento: "", bairro: "", cidade: "", uf: "",
};

export type ResultadoLeitura = {
  dados: DadosWhatsapp;
  /** Campos que o texto realmente trouxe — a tela destaca o que faltou. */
  encontrados: CampoWhatsapp[];
};

/* ──────────────────────────────────────────────────────────────────────────
 * Bloco SEM rótulo nenhum
 *
 * Metade dos clientes não usa "Nome:", "Rua:", "Bairro:". Manda o endereço do
 * jeito que escreveria num envelope:
 *
 *   Alexandre Queiroz Emygdio
 *   CPF 106.264.798-00
 *   Rua Marieta Moro 458      → rua e número na mesma linha
 *   Jd.Santa Úrsula           → bairro, reconhecido pelo "Jd."
 *   Aguaí SP                  → cidade e UF na mesma linha
 *   CEP: 13863-048
 *   xanbill@hotmail.com
 *   19 99939-5362
 *
 * Aqui cada linha que sobrou dos rótulos é classificada pelo FORMATO dela, e
 * depois pela POSIÇÃO: o que vem antes da rua é o nome, o que vem entre a rua
 * e a cidade é o bairro. É como uma pessoa lê o envelope.
 * ────────────────────────────────────────────────────────────────────────── */

/** Começos de logradouro. Só servem para RECONHECER a linha: o valor fica inteiro. */
const PREFIXOS_RUA = [
  "rua", "r", "avenida", "av", "alameda", "al", "travessa", "tv", "trav",
  "estrada", "estr", "rodovia", "rod", "praca", "pca", "largo", "via",
  "servidao", "marginal", "ladeira", "beco", "passagem", "viela", "quadra",
  "linha", "colonia", "chacara", "sitio",
];

/** Começos de bairro. "Centro" entra sozinho, que é bairro inteiro. */
const PREFIXOS_BAIRRO = [
  "jardim", "jd", "vila", "vl", "parque", "pq", "residencial", "res",
  "conjunto", "cj", "cjto", "distrito", "setor", "nucleo", "cohab",
  "loteamento", "lot", "gleba", "bairro", "centro", "balneario", "recanto",
];

const RE_RUA = new RegExp(`^(?:${PREFIXOS_RUA.join("|")})\\b\\.?\\s*\\S`, "i");
const RE_BAIRRO = new RegExp(`^(?:${PREFIXOS_BAIRRO.join("|")})\\b`, "i");
const RE_COMPLEMENTO =
  /\b(apto?|apart(?:amento)?|bloco|bl|casa|cs|fundos|lote|sala|andar|torre|sobrado|barracao|conj)\b/i;

/** Tira a palavra que a pessoa escreve antes do dado ("CPF 123...", "Tel 19 9..."). */
const tirarPalavras = (linha: string, palavras: RegExp) =>
  semAcento(linha).replace(palavras, " ").trim();

/** A linha é só um dado (com ou sem a palavra na frente) desse formato? */
function soDado(linha: string, palavras: RegExp): string | null {
  const resto = tirarPalavras(linha, palavras);
  // Sobrou letra? Então a linha diz outra coisa além do número.
  return /[a-z]/i.test(resto) ? null : resto;
}

const RE_PAL_CPF = /\b(cpf|cnpj|documento|doc|rg)\b[.:]?/gi;
const RE_PAL_CEP = /\b(cep|codigo postal)\b[.:]?/gi;
const RE_PAL_TEL =
  /\b(telefone|celular|whatsapp|whats|zap|fone|tel|cel|contato|com ddd|ddd)\b[.:]?/gi;

/** Telefone como gente escreve: (19) 99939-5362, 19 99939 5362, 1999395362. */
const RE_FORMA_TEL = /^\+?(?:55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?[\s.-]?\d{4}[\s.-]?\d{4}$/;
/** CPF/CNPJ pontuado — é o que separa o documento de um telefone de 11 dígitos. */
const RE_FORMA_DOC = /^(?:\d{3}\.\d{3}\.\d{3}-?\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-?\d{2})$/;

const temPalavra = (linha: string, re: RegExp) => {
  re.lastIndex = 0;
  const achou = re.test(semAcento(linha));
  re.lastIndex = 0;
  return achou;
};

/**
 * Tem tamanho de linha de endereço, e não de frase?
 *
 * Serve de freio nos palpites: sem isso, "oi, sou o Fernando, moro na rua tal,
 * meu telefone é 19..." vira logradouro "oi" e bairro "sou o Fernando". Campo
 * vazio o admin preenche; campo errado ele nem percebe.
 */
const pareceLinhaDeEndereco = (t: string) =>
  t.length <= 60 && t.split(/\s+/).length <= 8 && !t.includes("@");

/** "Aguaí SP", "Aguaí - SP", "Aguaí/SP", "Aguaí, São Paulo". */
function lerCidadeUf(linha: string): { cidade: string; uf: string } | null {
  const limpa = linha.trim().replace(/[.,;]+$/, "");
  const m = limpa.match(/^(.*?)[\s,\-–/]+([A-Za-zÀ-ÿ]{2}|[A-Za-zÀ-ÿ\s]{4,20})\.?$/);
  if (!m) return null;
  const uf = normalizarUf(m[2]);
  const cidade = m[1].trim().replace(/[,\-–/]+$/, "").trim();
  if (!uf || !cidade || /\d/.test(cidade)) return null;
  return { cidade, uf };
}

/** Separa "Rua Marieta Moro 458 apto 2" em rua, número e complemento. */
function lerLogradouro(bruto: string): {
  logradouro: string;
  numero: string;
  complemento: string;
} {
  let resto = bruto.trim().replace(/[.,;]+$/, "");
  let complemento = "";
  let numero = "";

  // O complemento vem depois do número, então sai primeiro: senão o "2" de
  // "apto 2" seria lido como o número da casa.
  const mc = semAcento(resto).match(RE_COMPLEMENTO);
  if (mc && mc.index !== undefined && mc.index > 0) {
    complemento = resto.slice(mc.index).replace(/^[\s,\-–]+/, "").trim();
    resto = resto.slice(0, mc.index).replace(/[\s,\-–]+$/, "");
  }

  const msn = resto.match(/[\s,]+s\/?\s?n[º°.]*\s*$/i);
  if (msn && msn.index !== undefined) {
    numero = "S/N";
    resto = resto.slice(0, msn.index).trim();
  } else {
    const mn = resto.match(
      /[\s,]+(?:n[º°o.]{0,2}|num(?:ero)?[.:]?)?\s*(\d{1,6}\s*[a-zA-Z]?)$/,
    );
    if (mn && mn.index !== undefined) {
      numero = mn[1].replace(/\s+/g, "").toUpperCase();
      resto = resto.slice(0, mn.index).trim();
    }
  }

  return {
    logradouro: resto.replace(/[,\-–]+$/, "").trim(),
    numero,
    complemento,
  };
}

/**
 * Lê as linhas que os rótulos não pegaram.
 *
 * Só preenche campo ainda vazio: o que veio com rótulo é mais confiável que
 * palpite de formato, e não pode ser sobrescrito.
 */
function lerLinhasSoltas(
  linhas: string[],
  usada: boolean[],
  dados: DadosWhatsapp,
  encontrados: Set<CampoWhatsapp>,
) {
  const por = (campo: CampoWhatsapp, valor: string) => {
    if (valor && !dados[campo]) {
      dados[campo] = valor;
      encontrados.add(campo);
    }
  };

  const sobrou = () =>
    linhas
      .map((t, i) => ({ i, t: t.trim() }))
      .filter((l) => !usada[l.i] && l.t.length > 1);

  // ── 1ª volta: linhas que são puro dado (e-mail, CEP, CPF, telefone) ──
  for (const { i, t } of sobrou()) {
    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(t)) {
      por("email", t.toLowerCase());
      usada[i] = true;
      continue;
    }

    const soCep = soDado(t, RE_PAL_CEP);
    if (soCep && normalizarCep(soCep)) {
      por("cep", normalizarCep(soCep));
      usada[i] = true;
      continue;
    }

    const soDoc = soDado(t, RE_PAL_CPF);
    const comPalavraDoc = temPalavra(t, RE_PAL_CPF);
    if (soDoc && (comPalavraDoc || RE_FORMA_DOC.test(soDoc)) && normalizarDoc(soDoc)) {
      por("cpfCnpj", normalizarDoc(soDoc));
      usada[i] = true;
      continue;
    }

    const soTel = soDado(t, RE_PAL_TEL);
    const comPalavraTel = temPalavra(t, RE_PAL_TEL);
    if (soTel && (comPalavraTel || RE_FORMA_TEL.test(soTel)) && normalizarTelefone(soTel)) {
      // 11 dígitos crus servem para os dois. Se ninguém disse o que é e os
      // dígitos fecham como CPF, é CPF; senão é celular.
      const cru = digitos(t);
      if (!comPalavraTel && !dados.cpfCnpj && cru.length === 11 && cpfValido(cru)) {
        por("cpfCnpj", cru);
      } else {
        por("telefone", normalizarTelefone(soTel));
      }
      usada[i] = true;
    }
  }

  // ── 2ª volta: a linha do endereço ──
  let iRua = -1;
  if (!dados.logradouro) {
    const comPrefixo = sobrou().find((l) => RE_RUA.test(semAcento(l.t)));
    // Sem "Rua"/"Av" na frente, aceita uma linha com letras que acaba em número
    // — mas só se ela tiver tamanho de endereço. Frase corrida ("moro na rua
    // tal, meu telefone é 19...") não é endereço, é conversa.
    const semPrefixo = sobrou().find(
      (l) =>
        pareceLinhaDeEndereco(l.t) &&
        /[a-zà-ÿ]{3}/i.test(l.t) &&
        /\d\s*[a-zA-Z]?$/.test(l.t),
    );
    const linhaRua = comPrefixo ?? semPrefixo;
    if (linhaRua) {
      iRua = linhaRua.i;
      usada[linhaRua.i] = true;
      // Endereço numa linha só: "Rua X, 458, Jd Santa Úrsula, Aguaí - SP".
      const partes = linhaRua.t.split(/\s*[,;]\s*/).filter(Boolean);
      const primeira = lerLogradouro(partes[0]);
      por("logradouro", primeira.logradouro || partes[0]);
      por("numero", primeira.numero);
      por("complemento", primeira.complemento);

      for (const parte of partes.slice(1)) {
        if (/^\d{1,6}\s*[a-zA-Z]?$/.test(parte) && !dados.numero) {
          por("numero", parte.replace(/\s+/g, "").toUpperCase());
          continue;
        }
        if (!/[a-z]/i.test(parte) && normalizarCep(parte)) {
          por("cep", normalizarCep(parte));
          continue;
        }
        if (RE_COMPLEMENTO.test(semAcento(parte)) && !dados.complemento) {
          por("complemento", parte);
          continue;
        }
        const cu = lerCidadeUf(parte);
        if (cu && !dados.cidade) {
          por("cidade", cu.cidade);
          por("uf", cu.uf);
          continue;
        }
        if (!dados.bairro && !/\d/.test(parte)) por("bairro", parte);
      }
    }
  }

  // Nenhuma linha era o endereço: procura "rua tal, 123" dentro do texto, que é
  // como sai quando a pessoa escreve tudo em uma frase só.
  if (!dados.logradouro) {
    const alvo = linhas.filter((_, i) => !usada[i]).join("\n");
    const m = semAcento(alvo).match(
      new RegExp(`\\b(?:${PREFIXOS_RUA.join("|")})\\b\\.?\\s+[^,;.\\n]{3,60}`, "i"),
    );
    if (m && m.index !== undefined) {
      const trecho = alvo.slice(m.index, m.index + m[0].length);
      const { logradouro, numero, complemento } = lerLogradouro(trecho);
      por("logradouro", logradouro);
      por("numero", numero);
      por("complemento", complemento);
    }
  }

  // ── 3ª volta: cidade e UF na mesma linha ──
  let iCidade = -1;
  if (!dados.cidade) {
    for (const { i, t } of sobrou()) {
      const cu = lerCidadeUf(t);
      if (!cu) continue;
      por("cidade", cu.cidade);
      por("uf", cu.uf);
      usada[i] = true;
      iCidade = i;
      break;
    }
  }

  // ── 4ª volta: bairro pelo começo ("Jd.", "Vila", "Centro") ──
  if (!dados.bairro) {
    const b = sobrou().find((l) => RE_BAIRRO.test(semAcento(l.t)));
    if (b) {
      por("bairro", b.t.replace(/[.,;]+$/, ""));
      usada[b.i] = true;
    }
  }

  // ── 5ª volta: o nome, pela posição ──
  // Num envelope o nome vem antes do endereço. Duas palavras no mínimo, sem
  // número e sem @, para não confundir com um pedaço do endereço.
  const pareceNome = (t: string) => {
    const palavras = t.split(/\s+/);
    return (
      !/[\d@]/.test(t) &&
      palavras.length >= 2 &&
      palavras.length <= 6 &&
      t.length <= 70 &&
      !RE_RUA.test(semAcento(t)) &&
      !RE_BAIRRO.test(semAcento(t))
    );
  };
  if (!dados.nome) {
    const antes = sobrou().filter((l) => iRua < 0 || l.i < iRua);
    const n = antes.find((l) => pareceNome(l.t)) ?? sobrou().find((l) => pareceNome(l.t));
    if (n) {
      por("nome", n.t.replace(/[.,;]+$/, ""));
      usada[n.i] = true;
    }
  }

  // ── 6ª volta: o que sobrou entre a rua e a cidade é bairro ──
  if (!dados.bairro && iRua >= 0) {
    const b = sobrou().find(
      (l) =>
        l.i > iRua &&
        (iCidade < 0 || l.i < iCidade) &&
        !/[\d@]/.test(l.t) &&
        pareceLinhaDeEndereco(l.t),
    );
    if (b) {
      por("bairro", b.t.replace(/[.,;]+$/, ""));
      usada[b.i] = true;
    }
  }

  // Uma palavra só, antes do endereço, ainda é melhor nome que nada.
  if (!dados.nome) {
    const n = sobrou().find(
      (l) => !/[\d@]/.test(l.t) && l.t.length <= 70 && (iRua < 0 || l.i < iRua),
    );
    if (n) {
      por("nome", n.t.replace(/[.,;]+$/, ""));
      usada[n.i] = true;
    }
  }
}

/** Primeiro trecho do texto que sobrevive à normalização — e não o primeiro que casa. */
function acharSolto(texto: string, re: RegExp, normalizar: (s: string) => string): string {
  for (const m of texto.matchAll(re)) {
    const v = normalizar(m[0]);
    if (v) return v;
  }
  return "";
}

/**
 * Interpreta o bloco colado em três camadas, da mais confiável para a menos:
 *
 *   1. rótulos ("Nome: ...")        — o cliente disse o que é cada coisa;
 *   2. formato e posição das linhas — envelope sem rótulo nenhum;
 *   3. varredura do texto inteiro   — "meu cep é 14701470" no meio da frase.
 *
 * Camada de cima nunca é sobrescrita pela de baixo.
 */
export function lerDadosWhatsapp(texto: string): ResultadoLeitura {
  const dados: DadosWhatsapp = { ...VAZIO };
  const encontrados = new Set<CampoWhatsapp>();

  // Texto de iPhone/macOS chega com acento decomposto (letra + acento em dois
  // caracteres). Compondo aqui, o recorte por posição bate e o que vai para o
  // banco fica na forma normal.
  const linhas = texto.normalize("NFC").split(/\r?\n/);
  const usada: boolean[] = linhas.map(() => false);

  for (let i = 0; i < linhas.length; i++) {
    const achado = lerRotulo(linhas[i]);
    if (!achado) continue;
    // Com dois pontos, a linha é do rótulo mesmo que o valor não sirva. Sem
    // eles é palpite: a linha só se dá por lida se o valor for aceito, senão
    // ela volta para a leitura por formato.
    usada[i] = achado.separado;

    let valor = achado.resto;
    // Rótulo sozinho na linha: o valor costuma vir na próxima, desde que ela
    // já não seja outro rótulo ("Complemento:" seguido de "Bairro: X").
    if (!valor && achado.separado) {
      const proxima = linhas[i + 1];
      if (proxima && !lerRotulo(proxima) && proxima.trim()) {
        valor = proxima.trim();
        usada[i + 1] = true;
        i++; // consome a linha usada
      }
    }
    if (!valor) continue;

    const antes = { ...dados };

    switch (achado.campo) {
      case "cpfCnpj": {
        const v = normalizarDoc(valor);
        if (v) { dados.cpfCnpj = v; encontrados.add("cpfCnpj"); }
        break;
      }
      case "telefone": {
        const v = normalizarTelefone(valor);
        if (v) { dados.telefone = v; encontrados.add("telefone"); }
        break;
      }
      case "cep": {
        const v = normalizarCep(valor);
        if (v) { dados.cep = v; encontrados.add("cep"); }
        break;
      }
      case "uf": {
        const v = normalizarUf(valor);
        if (v) { dados.uf = v; encontrados.add("uf"); }
        break;
      }
      case "email": {
        const v = valor.trim().toLowerCase();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          dados.email = v;
          encontrados.add("email");
        }
        break;
      }
      case "logradouro": {
        // "Rua: Marieta Moro, 458" — o número vem junto mesmo com rótulo.
        const { logradouro, numero, complemento } = lerLogradouro(valor);
        dados.logradouro = logradouro || valor;
        encontrados.add("logradouro");
        if (numero && !dados.numero) {
          dados.numero = numero;
          encontrados.add("numero");
        }
        if (complemento && !dados.complemento) {
          dados.complemento = complemento;
          encontrados.add("complemento");
        }
        break;
      }
      default: {
        dados[achado.campo] = valor;
        encontrados.add(achado.campo);
      }
    }

    if (dados[achado.campo] !== antes[achado.campo]) usada[i] = true;
  }

  lerLinhasSoltas(linhas, usada, dados, encontrados);

  // ── Última camada: dado solto no meio de uma frase ──
  if (!dados.email) {
    const m = texto.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i);
    if (m) { dados.email = m[0].toLowerCase(); encontrados.add("email"); }
  }
  if (!dados.cep) {
    const v = acharSolto(texto, /\b\d{2}\.?\d{3}-?\d{3}\b/g, normalizarCep);
    if (v) { dados.cep = v; encontrados.add("cep"); }
  }
  if (!dados.cpfCnpj) {
    for (const m of texto.matchAll(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g)) {
      const v = normalizarDoc(m[0]);
      // Celular também tem 11 dígitos. Sem pontuação e sem ninguém dizer que é
      // CPF, só vale se os dígitos verificadores fecharem — senão o telefone do
      // cliente entra como documento dele.
      if (!v || v === dados.telefone) continue;
      if (!/[.-]/.test(m[0]) && !cpfValido(v)) continue;
      dados.cpfCnpj = v;
      encontrados.add("cpfCnpj");
      break;
    }
  }
  if (!dados.telefone) {
    const v = acharSolto(
      texto,
      /\(?\b\d{2}\)?[\s.-]?9?[\s.-]?\d{4}[\s.-]?\d{4}\b/g,
      (bruto) => {
        const d = normalizarTelefone(bruto);
        return d && d !== dados.cpfCnpj ? d : "";
      },
    );
    if (v) { dados.telefone = v; encontrados.add("telefone"); }
  }

  return { dados, encontrados: [...encontrados] };
}

/** Dígito verificador do CPF. Evita cadastrar cliente com documento digitado errado. */
export function cpfValido(cpf: string): boolean {
  const d = digitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export const somenteDigitos = digitos;
