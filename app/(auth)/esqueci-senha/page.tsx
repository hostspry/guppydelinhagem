import type { Metadata } from "next";
import EsqueciSenhaClient from "@/components/site/EsqueciSenhaClient";

export const metadata: Metadata = {
  title: "Esqueci minha senha | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

export default function EsqueciSenhaPage() {
  return <EsqueciSenhaClient />;
}
