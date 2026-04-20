import type { Metadata } from "next";
import { Signika } from "next/font/google";
import "./globals.css";

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
    <html lang="pt-BR">
      <body className={`${signika.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
