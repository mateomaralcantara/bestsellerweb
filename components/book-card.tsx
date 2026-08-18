import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { Book } from "@/lib/types";
import { currency } from "@/lib/utils";

type BookCardProps = {
  book: Book;
};

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function truncateText(value: string, max = 145) {
  const clean = value.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}…`;
}

export function BookCard({ book }: BookCardProps) {
  const authorName = normalizeText(book.author?.name) || "Autor independiente";
  const coverUrl = normalizeText(book.cover_url);
  const description = truncateText(
    normalizeText(book.short_description) || "Descubre la historia, revisa la muestra y comienza a leer."
  );
  const formats = Array.isArray(book.formats)
    ? book.formats.filter(Boolean).map(String).slice(0, 2)
    : [];
  const rating =
    typeof book.rating === "number" ? Number(book.rating.toFixed(1)) : null;
  const price = typeof book.price === "number" ? book.price : null;
  const compareAtPrice =
    typeof book.compare_at_price === "number" ? book.compare_at_price : null;
  const priceCurrency = book.currency || "USD";
  const href = `/catalog/${book.slug}`;

  return (
    <article className="group commercial-card flex h-full flex-col overflow-hidden rounded-[30px] transition duration-300 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-[0_32px_80px_rgba(21,94,239,0.14)]">
      <Link href={href} className="relative block overflow-hidden bg-gradient-to-br from-[#e9f2ff] via-white to-[#e8fbff] p-6">
        <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_20%_20%,rgba(21,94,239,.16),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(19,184,232,.14),transparent_30%)]" />

        <div className="relative mx-auto w-[64%] max-w-[210px] transition duration-500 group-hover:-translate-y-1 group-hover:rotate-1 group-hover:scale-[1.03]">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`Portada de ${book.title}`}
              className="book-cover-shadow aspect-[2/3] w-full rounded-r-lg rounded-l-sm object-cover"
              draggable={false}
            />
          ) : (
            <div className="book-cover-shadow flex aspect-[2/3] w-full flex-col justify-between rounded-r-lg rounded-l-sm bg-gradient-to-br from-[#155eef] to-[#07111f] p-5 text-white">
              <BookOpen className="h-7 w-7 text-cyan-200" />
              <p className="text-lg font-black leading-tight">{book.title}</p>
            </div>
          )}
        </div>

        <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
          {book.badge ? (
            <span className="rounded-full bg-[#07111f] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-lg">
              {book.badge}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#155eef] shadow-lg backdrop-blur">
              <Sparkles className="h-3 w-3" />
              Recomendado
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center justify-between gap-3 text-xs font-bold">
          <span className="text-[#155eef]">{authorName}</span>
          {rating !== null ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
              <Star className="h-3.5 w-3.5 fill-current" />
              {rating}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Compra segura
            </span>
          )}
        </div>

        <Link href={href}>
          <h3 className="mt-3 line-clamp-2 text-2xl font-black leading-tight tracking-[-0.025em] text-[#07111f] group-hover:text-[#155eef]">
            {book.title}
          </h3>
        </Link>

        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
          {description}
        </p>

        {formats.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {formats.map((format) => (
              <span
                key={format}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500"
              >
                {format}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-slate-100 pt-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Precio
            </p>
            {compareAtPrice !== null && price !== null && compareAtPrice > price ? (
              <p className="mt-1 text-xs text-slate-400 line-through">
                {currency(compareAtPrice, priceCurrency)}
              </p>
            ) : null}
            <p className="mt-0.5 text-xl font-black text-[#07111f]">
              {price !== null
                ? currency(price, priceCurrency)
                : "Precio pendiente"}
            </p>
          </div>

          <Link
            href={href}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#155eef] text-white shadow-[0_12px_26px_rgba(21,94,239,0.3)] hover:-translate-y-1 hover:bg-[#2b78ff]"
            aria-label={`Ver ${book.title}`}
          >
            <ArrowUpRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
