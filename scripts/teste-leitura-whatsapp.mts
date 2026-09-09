/**
 * Confere a leitura do bloco de dados que o cliente manda no WhatsApp.
 *
 * Cada caso é um texto que chegou de verdade (ou uma variação plausível dele) e
 * o que a tela precisa mostrar depois de "Interpretar". Campo esperado vazio
 * significa "melhor em branco do que chutado": no cadastro do cliente, campo
 * vazio o operador preenche, campo errado ele não percebe.
 *
 * Rodar depois de qualquer mexida em lib/whatsapp-cliente.ts:
 *   npx tsx scripts/teste-leitura-whatsapp.mts
 *
 * Não usa banco nem rede: o parser é um módulo puro de propósito.
 */
import { lerDadosWhatsapp, type DadosWhatsapp } from "../lib/whatsapp-cliente";

type Caso = { nome: string; texto: string; espera: Partial<DadosWhatsapp> };

const CASOS: Caso[] = [
  {
    nome: "sem rótulo nenhum, um dado por linha",
    texto: `Alexandre Queiroz Emygdio
CPF 106.264.798-00
Rua Marieta Moro 458
Jd.Santa Úrsula
Aguaí SP
CEP: 13863-048
xanbill@hotmail.com
19 99939-5362`,
    espera: {
      nome: "Alexandre Queiroz Emygdio",
      cpfCnpj: "10626479800",
      email: "xanbill@hotmail.com",
      telefone: "19999395362",
      cep: "13863048",
      logradouro: "Rua Marieta Moro",
      numero: "458",
      bairro: "Jd.Santa Úrsula",
      cidade: "Aguaí",
      uf: "SP",
    },
  },
  {
    nome: "rótulos bagunçados, valor na linha de baixo",
    texto: `Nome: Raul Moreira Castro Junior
CPF:172.160.938-52
Rua : Quintino Bocaiuva
Número: 1203
Complemento:
Bairro:Jardim Paraíso
Cidade: Bebedouro
Estado: SP
Cep : 14.701-470
Telefone com DDD:
24 999277785`,
    espera: {
      nome: "Raul Moreira Castro Junior",
      cpfCnpj: "17216093852",
      telefone: "24999277785",
      cep: "14701470",
      logradouro: "Quintino Bocaiuva",
      numero: "1203",
      complemento: "",
      bairro: "Jardim Paraíso",
      cidade: "Bebedouro",
      uf: "SP",
    },
  },
  {
    nome: "endereço inteiro numa linha só",
    texto: `Maria da Silva Souza
Rua das Flores, 120, apto 31, Vila Mariana, São Paulo - SP, 04101-000
maria.souza@gmail.com
(11) 98888-7777
CPF 111.444.777-35`,
    espera: {
      nome: "Maria da Silva Souza",
      cpfCnpj: "11144477735",
      email: "maria.souza@gmail.com",
      telefone: "11988887777",
      cep: "04101000",
      logradouro: "Rua das Flores",
      numero: "120",
      complemento: "apto 31",
      bairro: "Vila Mariana",
      cidade: "São Paulo",
      uf: "SP",
    },
  },
  {
    nome: "sem pontuação, telefone não pode virar CPF",
    texto: `João Pedro Alves
Av Brasil 1500 casa 2
Centro
Ribeirão Preto/SP
14015-000
16988776655
joao@teste.com.br`,
    espera: {
      nome: "João Pedro Alves",
      cpfCnpj: "", // 11 dígitos, mas não fecha como CPF: é o celular
      telefone: "16988776655",
      cep: "14015000",
      logradouro: "Av Brasil",
      numero: "1500",
      complemento: "casa 2",
      bairro: "Centro",
      cidade: "Ribeirão Preto",
      uf: "SP",
    },
  },
  {
    nome: "rótulo sem os dois pontos",
    texto: `Nome Ana Beatriz Ramos
Endereço: Travessa São Jorge, nº 45
Bairro Cohab II
Cidade Aguaí
CEP 13860000
Tel (19) 3653-1122`,
    espera: {
      nome: "Ana Beatriz Ramos",
      telefone: "1936531122",
      cep: "13860000",
      logradouro: "Travessa São Jorge",
      numero: "45",
      bairro: "Cohab II",
      cidade: "Aguaí",
    },
  },
  {
    nome: "sem número, estado por extenso",
    texto: `Carlos Eduardo Lima
Estrada do Coco s/n
Zona Rural
Camaçari - Bahia
42800-000
71 99123-4567
carlos.lima@uol.com.br`,
    espera: {
      nome: "Carlos Eduardo Lima",
      email: "carlos.lima@uol.com.br",
      telefone: "71991234567",
      cep: "42800000",
      logradouro: "Estrada do Coco",
      numero: "S/N",
      bairro: "Zona Rural",
      cidade: "Camaçari",
      uf: "BA",
    },
  },
  {
    nome: "tudo numa frase só",
    texto: `oi, sou o Fernando Costa Prado, meu cep é 13863-048, moro na Rua Marieta Moro 458, Aguaí SP. meu cpf 106.264.798-00, telefone 19999395362`,
    espera: {
      // Nome no meio da frase não dá para separar com segurança: melhor vazio.
      nome: "",
      bairro: "",
      cpfCnpj: "10626479800",
      telefone: "19999395362",
      cep: "13863048",
      logradouro: "Rua Marieta Moro",
      numero: "458",
    },
  },
  {
    nome: "CPF cru sem rótulo, junto do celular",
    texto: `Roberto Nunes
11144477735
Rua A 10
Centro
Aguaí SP
13860-000
19988887777`,
    espera: {
      nome: "Roberto Nunes",
      cpfCnpj: "11144477735",
      telefone: "19988887777",
      cep: "13860000",
      logradouro: "Rua A",
      numero: "10",
      bairro: "Centro",
      cidade: "Aguaí",
      uf: "SP",
    },
  },
];

let falhas = 0;
for (const caso of CASOS) {
  const { dados } = lerDadosWhatsapp(caso.texto);
  const erros = Object.entries(caso.espera).filter(
    ([campo, valor]) => dados[campo as keyof DadosWhatsapp] !== valor,
  );
  if (erros.length === 0) {
    console.log(`ok    ${caso.nome}`);
    continue;
  }
  falhas++;
  console.log(`FALHA ${caso.nome}`);
  for (const [campo, valor] of erros) {
    const veio = dados[campo as keyof DadosWhatsapp];
    console.log(`        ${campo}: esperava "${valor}", veio "${veio}"`);
  }
}

console.log(`\n${CASOS.length - falhas}/${CASOS.length} casos passaram.`);
process.exit(falhas > 0 ? 1 : 0);
