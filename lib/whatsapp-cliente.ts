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

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "");

const digitos = (s: string) => s.replace(/\D/g, "");

/** A linha começa com algum rótulo conhecido? Devolve qual, e o que sobra. */
function lerRotulo(linha: string): { campo: CampoWhatsapp; resto: string } | null {
  const normal = semAcento(linha).toLowerCase().trim();
  for (const { campo, nomes } of ROTULOS) {
    for (const nome of nomes) {
      // Aceita espaço antes dos dois pontos ("Rua :") e ausência depois.
      const re = new RegExp(`^${nome}\\s*[:\\-–]\\s*(.*)$`, "i");
      const m = normal.match(re);
      if (m) {
        // Recorta do texto ORIGINAL para não perder acento nem maiúscula.
        const corte = linha.length - m[1].length;
        return { campo, resto: linha.slice(corte).trim() };
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

/**
 * Interpreta o bloco colado.
 *
 * Depois dos rótulos, faz uma segunda passada procurando CEP, CPF, e-mail e
 * telefone soltos em qualquer lugar do texto: gente manda "meu cep é 14701470"
 * no meio de uma frase, e recusar isso seria perder um dado que está ali.
 */
export function lerDadosWhatsapp(texto: string): ResultadoLeitura {
  const dados: DadosWhatsapp = { ...VAZIO };
  const encontrados = new Set<CampoWhatsapp>();

  const linhas = texto.split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    const achado = lerRotulo(linhas[i]);
    if (!achado) continue;

    let valor = achado.resto;
    // Rótulo sozinho na linha: o valor costuma vir na próxima, desde que ela
    // já não seja outro rótulo ("Complemento:" seguido de "Bairro: X").
    if (!valor) {
      const proxima = linhas[i + 1];
      if (proxima && !lerRotulo(proxima) && proxima.trim()) {
        valor = proxima.trim();
        i++; // consome a linha usada
      }
    }
    if (!valor) continue;

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
      default: {
        dados[achado.campo] = valor;
        encontrados.add(achado.campo);
      }
    }
  }

  // ── Segunda passada: dado solto, sem rótulo ──
  if (!dados.email) {
    const m = texto.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i);
    if (m) { dados.email = m[0].toLowerCase(); encontrados.add("email"); }
  }
  if (!dados.cep) {
    const m = texto.match(/\b\d{2}\.?\d{3}-?\d{3}\b/);
    if (m) {
      const v = normalizarCep(m[0]);
      if (v) { dados.cep = v; encontrados.add("cep"); }
    }
  }
  if (!dados.cpfCnpj) {
    const m = texto.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
    if (m) {
      const v = normalizarDoc(m[0]);
      if (v) { dados.cpfCnpj = v; encontrados.add("cpfCnpj"); }
    }
  }
  if (!dados.telefone) {
    const m = texto.match(/\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/);
    if (m) {
      const v = normalizarTelefone(m[0]);
      if (v) { dados.telefone = v; encontrados.add("telefone"); }
    }
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
