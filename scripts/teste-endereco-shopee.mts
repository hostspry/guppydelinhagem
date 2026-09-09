/**
 * Confere a leitura do endereço que a Shopee manda no pedido.
 *
 * A Shopee entrega o endereço quase todo numa string só e repete dentro dela o
 * bairro, a cidade e o CEP que já vêm em campo próprio. Sem limpar, o
 * "logradouro" do pedido viraria o endereço inteiro — o painel fica ilegível e
 * a conferência com a etiqueta dela não fecha.
 *
 *   npx tsx scripts/teste-endereco-shopee.mts
 *
 * Sem banco e sem rede. Os endereços abaixo são inventados, no formato que a
 * Shopee do Brasil usa.
 */
import { lerEnderecoShopee } from "../lib/shopee/pedidos";

type Caso = {
  nome: string;
  entrada: Parameters<typeof lerEnderecoShopee>[0];
  espera: Partial<ReturnType<typeof lerEnderecoShopee>>;
};

const CASOS: Caso[] = [
  {
    nome: "endereço completo, com tudo repetido no full_address",
    entrada: {
      name: "Alexandre Queiroz Emygdio",
      phone: "5519999395362",
      full_address: "Rua Marieta Moro, 458, Jd. Santa Úrsula, Aguaí, SP, 13863-048",
      district: "Jd. Santa Úrsula",
      city: "Aguaí",
      state: "SP",
      zipcode: "13863048",
    },
    espera: {
      nome: "Alexandre Queiroz Emygdio",
      telefone: "5519999395362",
      cep: "13863048",
      logradouro: "Rua Marieta Moro",
      numero: "458",
      bairro: "Jd. Santa Úrsula",
      cidade: "Aguaí",
      uf: "SP",
    },
  },
  {
    nome: "sem número na rua",
    entrada: {
      name: "Maria Souza",
      phone: "(11) 98888-7777",
      full_address: "Estrada do Coco, Zona Rural, Camaçari, BA",
      district: "Zona Rural",
      city: "Camaçari",
      state: "BA",
      zipcode: "42800-000",
    },
    espera: {
      logradouro: "Estrada do Coco",
      numero: null,
      bairro: "Zona Rural",
      cidade: "Camaçari",
      uf: "BA",
      cep: "42800000",
      telefone: "11988887777",
    },
  },
  {
    nome: "estado por extenso é cortado para a sigla",
    entrada: {
      name: "João Alves",
      full_address: "Av Brasil 1500, Centro, Ribeirão Preto, SP",
      district: "Centro",
      city: "Ribeirão Preto",
      state: "SP",
      zipcode: "14015000",
    },
    espera: {
      logradouro: "Av Brasil",
      numero: "1500",
      cidade: "Ribeirão Preto",
      uf: "SP",
    },
  },
  {
    nome: "pedido sem endereço nenhum não quebra",
    entrada: undefined,
    espera: {
      nome: "Comprador da Shopee",
      telefone: null,
      cep: null,
      logradouro: null,
      cidade: null,
      uf: null,
    },
  },
  {
    nome: "comprador sem nome ganha rótulo, nunca vazio",
    entrada: { full_address: "Rua A 10", city: "Aguaí", state: "SP", zipcode: "13860000" },
    espera: { nome: "Comprador da Shopee", logradouro: "Rua A", numero: "10" },
  },
];

let falhas = 0;
for (const caso of CASOS) {
  const veio = lerEnderecoShopee(caso.entrada);
  const erros = Object.entries(caso.espera).filter(
    ([campo, valor]) => veio[campo as keyof typeof veio] !== valor,
  );
  if (erros.length === 0) {
    console.log(`ok    ${caso.nome}`);
    continue;
  }
  falhas++;
  console.log(`FALHA ${caso.nome}`);
  for (const [campo, valor] of erros) {
    console.log(
      `        ${campo}: esperava ${JSON.stringify(valor)}, veio ${JSON.stringify(
        veio[campo as keyof typeof veio],
      )}`,
    );
  }
}

console.log(`\n${CASOS.length - falhas}/${CASOS.length} casos passaram.`);
process.exit(falhas > 0 ? 1 : 0);
