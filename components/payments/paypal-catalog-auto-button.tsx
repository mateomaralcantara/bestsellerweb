"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type LookupResponse = {
  ok?: boolean;
  bookId?: string;
  error?: string;
};

function getCatalogSlug(pathname: string) {
  const match = pathname.match(/^\/catalog\/([^/?#]+)\/?$/i);

  if (!match?.[1]) return "";

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function PayPalCatalogAutoButton() {
  const pathname = usePathname();
  const slug = getCatalogSlug(pathname || "");

  const [bookId, setBookId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function resolveBook() {
      setBookId(null);

      if (!slug) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await fetch(
          `/api/payments/paypal/book-by-slug?slug=${encodeURIComponent(slug)}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const payload = (await response.json()) as LookupResponse;

        if (!cancelled && response.ok && payload.bookId) {
          setBookId(payload.bookId);
        }
      } catch (error) {
        if (
          !cancelled &&
          error instanceof Error &&
          error.name !== "AbortError"
        ) {
          console.error("PayPal book lookup:", error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void resolveBook();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [slug]);

  if (!slug || loading || !bookId) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[90] max-w-[calc(100vw-2.5rem)]">
      <Link
        href={`/checkout/paypal?bookId=${encodeURIComponent(bookId)}`}
        aria-label="Comprar este libro con PayPal"
        className="flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-[#e5b900] bg-[#ffd140] px-6 py-4 font-black text-[#142c8e] shadow-2xl transition hover:-translate-y-1 hover:bg-[#f7c928] focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#142c8e] text-lg font-black text-white">
          P
        </span>

        <span>
          Comprar con PayPal
        </span>
      </Link>

      <p className="mt-2 text-center text-[11px] font-semibold text-slate-600">
        Pago seguro · Acceso inmediato
      </p>
    </div>
  );
}