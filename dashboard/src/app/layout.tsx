import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Pill, Search, Heart, Menu } from "lucide-react";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Quanto Custa? - Compare precos de medicamentos no Brasil",
    template: "%s | Quanto Custa?",
  },
  description:
    "Compare precos de medicamentos no Brasil. Encontre genericos ate 80% mais baratos e descubra se seu remedio esta no Farmacia Popular.",
  keywords: [
    "preco medicamento",
    "remedio barato",
    "generico",
    "farmacia popular",
    "comparar precos remedios",
    "ANVISA",
    "PMC",
  ],
  openGraph: {
    title: "Quanto Custa? - Compare precos de medicamentos",
    description:
      "Encontre o preco justo do seu remedio. Genericos ate 80% mais baratos.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased`}>
        <header className="sticky top-0 z-40 border-b border-gray-100 bg-white">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <Pill className="h-6 w-6 text-teal-600" />
              <span className="text-lg font-bold text-gray-900">
                Quanto Custa?
              </span>
            </Link>

            <nav className="hidden items-center gap-6 md:flex">
              <Link
                href="/buscar"
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
              >
                <Search className="h-4 w-4" />
                Buscar
              </Link>
              <Link
                href="/farmacia-popular"
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
              >
                <Heart className="h-4 w-4" />
                Farmacia Popular
              </Link>
            </nav>

            <button className="text-gray-600 md:hidden">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="min-h-[calc(100vh-8rem)]">{children}</main>

        <footer className="border-t border-gray-100 bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <div className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-teal-600" />
                  <span className="font-bold text-gray-900">
                    Quanto Custa?
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Compare precos de medicamentos no Brasil com dados oficiais da
                  ANVISA.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900">
                  Navegacao
                </h4>
                <ul className="mt-3 space-y-2">
                  <li>
                    <Link
                      href="/buscar"
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Buscar medicamentos
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/farmacia-popular"
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Farmacia Popular
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900">
                  Informacoes
                </h4>
                <ul className="mt-3 space-y-2">
                  <li className="text-sm text-gray-500">
                    Dados da CMED/ANVISA
                  </li>
                  <li className="text-sm text-gray-500">
                    Precos atualizados periodicamente
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-8 border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
              Quanto Custa? nao vende medicamentos. Os precos sao informativos,
              baseados na tabela CMED/ANVISA.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
