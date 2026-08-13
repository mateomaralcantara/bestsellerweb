"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BookOpen, Star } from "lucide-react";
import { Book } from "@/lib/types";
import { currency } from "@/lib/utils";

type BookCardProps = {
  book: Book;
};

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function truncateText(value: string, max = 160) {
  const clean = value.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}…`;
}

function Cover({
  title,
  coverUrl,
}: {
  title: string;
  coverUrl?: string | null;
}) {
  if (coverUrl) {
    return (
      <div className="relative h-72 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-panel">
        <img
          src={coverUrl}
          alt={`Portada de ${title}`}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className="relative h-72 overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(220,38,38,0.12),transparent_30%),linear-gradient(145deg,#ffffff,#eff6ff)] p-6 shadow-panel">
      <div className="absolute inset-0 bg-[linear-gradient(130deg,transparent,rgba(255,255,255,0.7),transparent)]" />
      <div className="relative flex h-full flex-col justify-between rounded-[22px] border border-slate-200 bg-white/85 p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-accent-700">
          BestSeller Edition
        </div>

        <div>
          <h3 className="font-display text-2xl font-bold leading-tight text-brand-800">
            {title}
          </h3>
        </div>
      </div>
    </div>
  );
}

export function BookCard({ book }: BookCardProps) {
  const authorName = normalizeText(book.author?.name) || "Autor independiente";
  const coverUrl = normalizeText(book.cover_url);
  const shortDescription = normalizeText(book.short_description) || "Sin resumen disponible.";

  const formats = Array.isArray(book.formats)
    ? book.formats.filter(Boolean).map(String)
    : [];

  const rating = typeof book.rating === "number" ? Number(book.rating.toFixed(1)) : null;
  const reviewCount = typeof book.review_count === "number" ? book.review_count : 0;
  const price = typeof book.price === "number" ? book.price : null;
  const compareAtPrice = typeof book.compare_at_price === "number" ? book.compare_at_price : null;
  const priceCurrency = book.currency || "USD";
  const catalogUrl = `/catalog/${book.slug}`;

  const cardSummary = useMemo(() => truncateText(shortDescription), [shortDescription]);

  return (
    <article className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-panel transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-glow">
      <Link href={catalogUrl} className="group block">
        <div className="relative">
          <Cover title={book.title} coverUrl={coverUrl} />

          {book.badge ? (
            <span className="absolute left-4 top-4 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-700">
              {book.badge}
            </span>
          ) : null}
        </div>

        <div className="space-y-4 px-1 pt-5">
          <div>
            <p className="text-sm font-medium text-accent-700">{authorName}</p>

            <h3 className="mt-1 text-xl font-semibold text-brand-800">
              {book.title}
            </h3>

            <p className="mt-2 text-sm leading-7 text-slate-700">{cardSummary}</p>
          </div>

          {formats.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {formats.map((format, index) => (
                <span
                  key={`${format}-${index}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {format}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          {rating !== null ? (
            <>
              <Star className="h-4 w-4 fill-current text-accent-600" />
              <span>{rating}</span>
              <span className="text-slate-400">({reviewCount})</span>
            </>
          ) : (
            <span className="text-slate-400">Sin reseñas todavía</span>
          )}
        </div>

        <div className="text-right">
          {compareAtPrice !== null ? (
            <p className="text-xs text-slate-400 line-through">
              {currency(compareAtPrice, priceCurrency)}
            </p>
          ) : null}

          <p className="text-lg font-bold text-slate-950">
            {price !== null
              ? currency(price, priceCurrency)
              : "Precio no disponible"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 px-1">
        <Link
          href={catalogUrl}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
        >
          <BookOpen className="h-4 w-4" />
          Ver muestra
        </Link>

        <Link
          href={catalogUrl}
          className="inline-flex items-center justify-center rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-700"
        >
          Ver ficha
        </Link>
      </div>
    </article>
  );
}
