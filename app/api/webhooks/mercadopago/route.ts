import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // TODO: implementar webhook do Mercado Pago (etapa de pagamento)
  void request;
  return NextResponse.json({ received: true });
}
