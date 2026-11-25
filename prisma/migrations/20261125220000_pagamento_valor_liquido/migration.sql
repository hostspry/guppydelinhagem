-- Quanto caiu na conta depois da taxa do gateway. A diferença para o valor pago
-- vira a saída de taxa no caixa (lib/financeiro/venda-no-caixa.ts).
ALTER TABLE "Pagamento" ADD COLUMN "valorLiquido" DECIMAL(10,2);
