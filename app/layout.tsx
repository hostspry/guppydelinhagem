import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Guppy de Linhagem | Guppys Premiados",
  description:
    "Guppys de linhagem selecionados, saudáveis e com genética apurada. Campeões mundiais World Guppy Contest.",
  // Ícones de aba (navegador) e de dispositivo. O /favicon.ico vem da convenção
  // app/favicon.ico; aqui declaramos os PNG (navegadores modernos) e o ícone de
  // toque do iOS, servidos de /images.
  icons: {
    icon: [
      { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: {
      url: "/images/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${nunito.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
