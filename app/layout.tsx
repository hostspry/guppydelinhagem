import type { Metadata } from "next";
import { Signika, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const signika = Signika({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-signika",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Guppy de Linhagem | Guppys Premiados",
  description:
    "Guppys de linhagem selecionados, saudáveis e com genética apurada. Campeões mundiais World Guppy Contest.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={cn("font-sans", geist.variable)}>
      <body className={`${signika.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
