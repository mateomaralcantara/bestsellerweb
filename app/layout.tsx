import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartProvider } from "@/components/cart-provider";
export const metadata: Metadata = { title: "BestSeller | Publica, vende y escala libros", description: "Marketplace editorial y plataforma de publicación con Supabase + Next.js.", metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000") };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body className="font-sans antialiased"><CartProvider><div className="relative min-h-screen"><SiteHeader /><main>{children}</main><SiteFooter /></div></CartProvider></body></html>; }
