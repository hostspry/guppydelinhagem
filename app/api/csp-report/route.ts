// TEMP: CSP tuning — recebe os relatórios de violação da CSP (Report-Only) e
// loga de forma estruturada para o afinamento. NÃO persiste em banco. Some quando
// a CSP for para enforce e estabilizar.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    // report-uri envia { "csp-report": {...} } (kebab); report-to envia outro shape.
    const r = (body["csp-report"] as Record<string, unknown>) ?? body;
    console.warn(
      "[csp-report]",
      JSON.stringify({
        blockedURI: r["blocked-uri"] ?? r["blockedURL"] ?? r["blockedURI"],
        violatedDirective:
          r["violated-directive"] ?? r["effectiveDirective"] ?? r["violatedDirective"],
        documentURI: r["document-uri"] ?? r["documentURL"] ?? r["documentURI"],
      }),
    );
  } catch {
    // corpo ausente/ inválido — ignora (é só telemetria de tuning)
  }
  return new NextResponse(null, { status: 204 });
}
