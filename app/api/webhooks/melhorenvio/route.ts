import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // TODO: implementar webhook do Melhor Envio (etapa de frete)
  void request;
  return NextResponse.json({ received: true });
}
