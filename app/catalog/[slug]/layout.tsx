import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import ProductEnhancements from "./ProductEnhancements";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

type ProductBook = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description_short: string | null;
  description_long: string | null;
  cover_url: string | null;
  author_id: string | null;
  language_code: string | null;
  isbn_13: string | null;
  primary_category: string | null;
};

type Recommendation = {
  book_id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  reason: string;
  score: number;
};

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.libroseller.com").replace(/\/$/, "");

function safeSlug(value: string) {
  try {
    return decodeURIComponent(value || "").trim();
  } catch {
    return "";
  }
}

async function getBook(slug: string): Promise<ProductBook | null> {
  const { data } = await supabaseAdmin
    .from("books")
    .select("id, slug, title, subtitle, description_short, description_long, cover_url, author_id, language_code, isbn_13, primary_category")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as ProductBook | null) ?? null;
}

async function getAuthorName(authorId: string | null) {
  if (!authorId) return "Autor independiente";
  const { data } = await supabaseAdmin
    .from("author_profiles")
    .select("display_name, pen_name")
    .eq("id", authorId)
    .maybeSingle();
  return data?.pen_name || data?.display_name || "Autor independiente";
}

async function getPricing(bookId: string) {
  const { data } = await supabaseAdmin
    .from("book_editions")
    .select("price, currency, paypal_price, paypal_currency")
    .eq("book_id", bookId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const price = Number(data?.price ?? data?.paypal_price);
  return {
    price: Number.isFinite(price) && price > 0 ? price : null,
    currency: data?.currency || data?.paypal_currency || "USD",
  };
}

async function getIntelligence(book: ProductBook) {
  const [{ data: metric }, { data: bestseller }, { data: preflight }] = await Promise.all([
    supabaseAdmin
      .from("book_verified_metrics")
      .select("verified_rating, review_count, verified_sales_count")
      .eq("book_id", book.id)
      .maybeSingle(),
    supabaseAdmin
      .from("book_bestseller_scores")
      .select("bestseller_score")
      .eq("book_id", book.id)
      .maybeSingle(),
    supabaseAdmin
      .from("epub_preflight_reports")
      .select("score, status, epub_version, layout, created_at")
      .eq("book_id", book.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const metrics = {
    verified_rating: Number(metric?.verified_rating) || 0,
    review_count: Number(metric?.review_count) || 0,
    verified_sales_count: Number(metric?.verified_sales_count) || 0,
    bestseller_score: Number(bestseller?.bestseller_score) || 0,
  };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  let recommendations: Recommendation[] = [];

  if (auth.user) {
    const result = await supabaseAdmin.rpc("recommend_marketplace_books", {
      p_user_id: auth.user.id,
      p_limit: 8,
    });
    if (!result.error) recommendations = (result.data ?? []) as Recommendation[];
  }

  if (!recommendations.length) {
    const { data: scoreRows } = await supabaseAdmin
      .from("book_bestseller_scores")
      .select("book_id, bestseller_score")
      .neq("book_id", book.id)
      .order("bestseller_score", { ascending: false })
      .limit(8);
    const ids = (scoreRows ?? []).map((row) => row.book_id);
    if (ids.length) {
      const { data: books } = await supabaseAdmin
        .from("books")
        .select("id, slug, title, cover_url")
        .in("id", ids)
        .eq("status", "published");
      const scoreMap = new Map((scoreRows ?? []).map((row) => [row.book_id, Number(row.bestseller_score) || 0]));
      recommendations = (books ?? []).map((item) => ({
        book_id: item.id,
        slug: item.slug,
        title: item.title,
        cover_url: item.cover_url,
        reason: "Tendencia en LibroSeller",
        score: scoreMap.get(item.id) || 0,
      }));
    }
  }

  recommendations = recommendations
    .filter((item) => item.book_id !== book.id)
    .sort((a, b) => Number(b.score) - Number(a.score));

  return { metrics, preflight: preflight ?? null, recommendations };
}

export async function generateMetadata({ params }: Omit<LayoutProps, "children">): Promise<Metadata> {
  const slug = safeSlug((await params).slug);
  const book = slug ? await getBook(slug) : null;
  if (!book) return {};

  const description = (book.description_short || book.description_long || book.subtitle || `Compra y lee ${book.title} en LibroSeller.`).slice(0, 160);
  const canonical = `${SITE_URL}/catalog/${encodeURIComponent(book.slug)}`;

  return {
    title: `${book.title} | LibroSeller`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "book",
      title: book.title,
      description,
      url: canonical,
      siteName: "LibroSeller",
      images: book.cover_url ? [{ url: book.cover_url, alt: `Portada de ${book.title}` }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: book.title,
      description,
      images: book.cover_url ? [book.cover_url] : undefined,
    },
  };
}

export default async function BookProductLayout({ children, params }: LayoutProps) {
  const slug = safeSlug((await params).slug);
  const book = slug ? await getBook(slug) : null;

  if (!book) return children;

  const [{ metrics, preflight, recommendations }, authorName, pricing] = await Promise.all([
    getIntelligence(book),
    getAuthorName(book.author_id),
    getPricing(book.id),
  ]);

  const canonical = `${SITE_URL}/catalog/${encodeURIComponent(book.slug)}`;
  const description = book.description_short || book.description_long || book.subtitle || `Libro ${book.title}`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["Book", "Product"],
    "@id": `${canonical}#book`,
    name: book.title,
    description,
    url: canonical,
    image: book.cover_url || undefined,
    inLanguage: book.language_code || "es",
    isbn: book.isbn_13 || undefined,
    genre: book.primary_category || undefined,
    author: { "@type": "Person", name: authorName },
    brand: { "@type": "Brand", name: "LibroSeller" },
    offers: pricing.price
      ? {
          "@type": "Offer",
          url: canonical,
          price: pricing.price,
          priceCurrency: pricing.currency,
          availability: "https://schema.org/InStock",
        }
      : undefined,
    aggregateRating:
      metrics.verified_rating > 0 && metrics.review_count > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: metrics.verified_rating,
            reviewCount: metrics.review_count,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Catálogo", item: `${SITE_URL}/catalog` },
      { "@type": "ListItem", position: 3, name: book.title, item: canonical },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
      {children}
      <ProductEnhancements
        bookSlug={book.slug}
        metrics={metrics}
        preflight={preflight}
        recommendations={recommendations}
      />
    </>
  );
}
