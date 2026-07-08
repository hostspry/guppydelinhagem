import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import LoginClient from "@/components/site/LoginClient";

export const metadata: Metadata = {
  title: "Entrar | Guppy de Linhagem",
  robots: { index: false, follow: false }, // página de conta, fora do índice
};

type Props = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const callbackUrl =
    typeof sp.callbackUrl === "string" && sp.callbackUrl.startsWith("/")
      ? sp.callbackUrl
      : "/minha-conta";

  // Já logado → vai direto pro destino (evita re-login).
  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  return (
    <LoginClient
      facebookEnabled={!!process.env.AUTH_FACEBOOK_ID}
      error={typeof sp.error === "string" ? sp.error : null}
      callbackUrl={callbackUrl}
    />
  );
}
