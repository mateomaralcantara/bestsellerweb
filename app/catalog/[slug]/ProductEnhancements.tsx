"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Metrics = {
  verified_rating: number;
  review_count: number;
  verified_sales_count: number;
  bestseller_score: number;
};

type Preflight = {
  score: number;
  status: string;
  epub_version: string | null;
  layout: string | null;
  created_at: string;
} | null;

type Recommendation = {
  book_id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  reason: string;
  score: number;
};

type Review = {
  id: string;
  rating: number;
  title: string | null;
  review: string;
  verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
};

async function emit(bookSlug: string, eventType: string, metadata: Record<string, unknown> = {}) {
  try {
    await fetch("/api/marketplace/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ bookSlug, eventType, surface: "product", metadata }),
    });
  } catch {
    // Telemetría no bloqueante.
  }
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="tracking-[0.08em] text-amber-500" aria-label={`${rating.toFixed(1)} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, index) => (index < Math.round(rating) ? "★" : "☆")).join("")}
    </span>
  );
}

function ReviewsPanel({ bookSlug }: { bookSlug: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [review, setReview] = useState("");

  async function load() {
    try {
      const response = await fetch(`/api/books/${encodeURIComponent(bookSlug)}/reviews?limit=20`, { cache: "no-store" });
      const data = (await response.json()) as { reviews?: Review[] };
      if (response.ok) setReviews(data.reviews ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [bookSlug]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("Guardando reseña…");
    const response = await fetch(`/api/books/${encodeURIComponent(bookSlug)}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, title, review }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error || "No se pudo publicar la reseña.");
      return;
    }
    setMessage("Reseña publicada como compra verificada.");
    setTitle("");
    setReview("");
    await load();
  }

  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#155eef]">Confianza verificable</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Reseñas de compradores</h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Compra verificada</span>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <select value={rating} onChange={(event) => setRating(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            {[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} estrellas</option>)}
          </select>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título de tu reseña (opcional)" maxLength={120} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        </div>
        <textarea value={review} onChange={(event) => setReview(event.target.value)} placeholder="Cuenta qué te aportó el libro…" minLength={10} maxLength={4000} rows={3} required className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">Solo una compra pagada puede publicar aquí.</p>
          <button type="submit" className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Publicar reseña</button>
        </div>
        {message ? <p className="text-xs font-bold text-slate-600">{message}</p> : null}
      </form>

      <div className="mt-5 space-y-3">
        {loading ? <p className="text-sm text-slate-500">Cargando reseñas…</p> : null}
        {!loading && !reviews.length ? <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">Todavía no hay reseñas verificadas. La primera aparecerá después de una compra real.</p> : null}
        {reviews.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Stars rating={Number(item.rating) || 0} />
              {item.verified_purchase ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">Compra verificada</span> : null}
            </div>
            {item.title ? <h3 className="mt-2 font-black text-slate-950">{item.title}</h3> : null}
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{item.review}</p>
            <p className="mt-2 text-[11px] text-slate-400">{new Date(item.created_at).toLocaleDateString("es-DO")}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function ProductEnhancements({
  bookSlug,
  metrics,
  preflight,
  recommendations,
}: {
  bookSlug: string;
  metrics: Metrics;
  preflight: Preflight;
  recommendations: Recommendation[];
}) {
  const pathname = usePathname();
  const isPreview = pathname.endsWith("/preview");

  useEffect(() => {
    if (!isPreview) void emit(bookSlug, "book_impression");
  }, [bookSlug, isPreview]);

  if (isPreview) return null;

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 pb-14 sm:px-6 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Ventas verificadas</p><p className="mt-2 text-3xl font-black text-slate-950">{metrics.verified_sales_count}</p></div>
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Rating real</p><p className="mt-2 text-3xl font-black text-slate-950">{metrics.verified_rating > 0 ? metrics.verified_rating.toFixed(2) : "Nuevo"}</p></div>
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Reseñas</p><p className="mt-2 text-3xl font-black text-slate-950">{metrics.review_count}</p></div>
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Bestseller Score</p><p className="mt-2 text-3xl font-black text-slate-950">{metrics.bestseller_score.toFixed(2)}</p></div>
      </div>

      {preflight ? (
        <section className="rounded-[30px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Calidad editorial LibroSeller</p><h2 className="mt-1 text-2xl font-black text-slate-950">EPUB {preflight.score}/100</h2></div>
            <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-emerald-700 shadow-sm">{preflight.status === "pass" ? "Optimizado" : "Revisión editorial"}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
            <span className="rounded-full bg-white px-3 py-2">EPUB {preflight.epub_version || "detectado"}</span>
            <span className="rounded-full bg-white px-3 py-2">{preflight.layout || "layout detectado"}</span>
            <span className="rounded-full bg-white px-3 py-2">Quality Gate automático</span>
          </div>
        </section>
      ) : null}

      <ReviewsPanel bookSlug={bookSlug} />

      {recommendations.length ? (
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#155eef]">Descubrimiento inteligente</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">También te puede interesar</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recommendations.slice(0, 4).map((item) => (
              <Link key={item.book_id} href={`/catalog/${item.slug}`} onClick={() => void emit(bookSlug, "book_click", { targetBookId: item.book_id, source: "recommendation" })} className="group rounded-2xl border border-slate-200 p-3 transition hover:-translate-y-0.5 hover:shadow-lg">
                {item.cover_url ? <Image src={item.cover_url} alt="" width={240} height={360} className="aspect-[2/3] w-full rounded-xl object-cover" /> : <div className="aspect-[2/3] rounded-xl bg-slate-100" />}
                <p className="mt-3 line-clamp-2 font-black text-slate-950 group-hover:text-[#155eef]">{item.title}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{item.reason}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
