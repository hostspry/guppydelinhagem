import { NextResponse } from "next/server";
import { FRETE_CONFIG } from "@/lib/shipping";

export const dynamic = "force-dynamic";

const ME_ENDPOINT = "https://melhorenvio.com.br/api/v2/me/shipment/calculate";

type MeCompany = { name: string };
type MeQuoteOk = {
  id: number;
  name: string;
  price: string;
  delivery_time: number;
  company: MeCompany;
  error?: undefined;
};
type MeQuoteErr = { id: number; error: string; company?: MeCompany };
type MeQuote = MeQuoteOk | MeQuoteErr;

export async function POST(req: Request) {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Serviço de frete indisponível no momento." },
      { status: 502 },
    );
  }

  let body: { cepDestino?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const cepDestino = String(body.cepDestino ?? "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(cepDestino)) {
    return NextResponse.json(
      { error: "CEP de destino inválido. Use 8 dígitos." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(ME_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Guppy de Linhagem (contato@guppydelinhagem.com.br)",
      },
      body: JSON.stringify({
        from: { postal_code: FRETE_CONFIG.cepOrigem },
        to: { postal_code: cepDestino },
        volumes: [
          {
            ...FRETE_CONFIG.pacotePadrao,
            insurance_value: FRETE_CONFIG.insuranceValue,
          },
        ],
        options: { receipt: false, own_hand: false },
        services: "4", // Jadlog .Com
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Não foi possível calcular o frete agora." },
        { status: 502 },
      );
    }

    const rawResp = (await res.json()) as unknown;
    const raw: MeQuote[] = Array.isArray(rawResp)
      ? (rawResp as MeQuote[])
      : ([rawResp] as MeQuote[]);

    const jadlog = raw
      .filter(
        (q): q is MeQuoteOk =>
          !("error" in q && q.error) &&
          q.company?.name === "Jadlog" &&
          q.id === 4, // só .Com — defesa em profundidade caso ME retorne mais
      )
      .map((q) => {
        const bruto = parseFloat(q.price);
        const final =
          Math.round(
            (bruto * FRETE_CONFIG.jadlogMarkup + FRETE_CONFIG.caixaIsopor) * 100,
          ) / 100;
        return {
          id: q.id,
          name: FRETE_CONFIG.jadlogLabel,
          price: final,
          deliveryTime: q.delivery_time,
          requerAvaliacao: q.delivery_time > FRETE_CONFIG.prazoMaximoSeguro,
        };
      });

    return NextResponse.json({
      jadlog,
      gollog: FRETE_CONFIG.gollog,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível calcular o frete agora." },
      { status: 502 },
    );
  }
}
