import { PayPalCatalogAutoButton } from "@/components/payments/paypal-catalog-auto-button";
import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartProvider } from "@/components/cart-provider";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "BestSeller | Publica, vende y escala libros",
    template: "%s | BestSeller",
  },

  description:
    "Marketplace editorial y plataforma de publicación para autores, lectores y afiliados. Publica, vende y escala libros digitales e impresos.",

  applicationName: "BestSeller",

  keywords: [
    "BestSeller",
    "publicar libros",
    "vender libros",
    "marketplace editorial",
    "libros digitales",
    "autores",
    "ebook",
    "publicación editorial",
  ],

  authors: [
    {
      name: "BestSeller",
    },
  ],

  creator: "BestSeller",
  publisher: "BestSeller",

  icons: {
    icon: [
      {
        url: "/favicon.ico",
      },
      {
        url: "/bestseller-icon-1024.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  openGraph: {
    title: "BestSeller | Publica, vende y escala libros",
    description:
      "Crea, publica, vende y escala libros digitales e impresos con una plataforma editorial moderna.",
    url: siteUrl,
    siteName: "BestSeller",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BestSeller - Publica, vende y escala tus libros",
      },
    ],
    locale: "es_DO",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "BestSeller | Publica, vende y escala libros",
    description:
      "Marketplace editorial para publicar, vender y escalar libros digitales e impresos.",
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <CartProvider>
          <div className="relative min-h-screen">
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
          </div>
        </CartProvider>
              <PayPalCatalogAutoButton />
      </body>
    </html>
  );
}