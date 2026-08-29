import Image from "next/image";
import Link from "next/link";
import { Search, Star, TrendingUp } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getBooks } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ q?: string; category?: string }>;
};

type SearchRow = {
  book_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  primary_category: string | null;
  primary_niche: string | null;
  verified_rating: number | string | null;
  verified_sales_count: number | string | null;
  bestseller_score: number | string | null;
  relevance: number | string | null;
};

type Edition = {
  book_id: string;
  price: number | string | null;
  currency: string | null;
  paypal_price: number | string | null;
  paypal_currency: string | null;
};

const CATEGORIES = [
  "Negocios y emprendimiento",
  "Finanzas personales",
  "Marketing y ventas",
  "Desarrollo personal",
  "Tecnología",
  "Inteligencia artificial",
  "Educación",
  "Salud y bienestar",
  "Espiritualidad",
  "Cristiano / Fe",
  "Biografía / Memorias",
  "Historia",
  "Política y sociedad",
  "Romance",
  "Ficción",
  "Misterio / Thriller",
  "Infantil / Juvenil",
  "Académico / Profesional",
  "Periodismo",
  "Derecho",
  "Migración",
  "Psicología",
];

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function priceLabel(edition: Edition | undefined) {
  if (!edition) return "Ver precio";
  const price = n(edition.price) || n(edition.paypal_price);
  const currency = edition.currency || edition.paypal_currency || "USD";
  if (!price) return "Ver precio";
  try {
    return new Intl.NumberFormat("es-DO", { style: "currency", currency, maximumFractionDigits: 2 }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

async function search2(query: string, category: string) {
  const { data, error } = await supabaseAdmin.rpc("search_marketplace_books", {
    p_query: query,
    p_category: category || null,
    p_limit: 60,
    p_offset: 0,
  });
  return { data: (data ?? []) as SearchRow[], error };
}

async function fallbackSearch(query: string, category: string): Promise<SearchRow[]> {
  const books = await getBooks();
  return books
    .filter((book) => {
      const haystack = normalize([book.title, book.subtitle, ...(book.categories ?? [])].filter(Boolean).join(" "));
      const qOk = !query || haystack.includes(normalize(query));
      const categoryOk = !category || (book.categories ?? []).some((item) => normalize(item) === normalize(category));
      return qOk && categoryOk;
    })
    .map((book) => ({
      book_id: book.id,
      slug: book.slug,
      title: book.title,
      subtitle: book.subtitle ?? null,
      cover_url: book.cover_url ?? null,
      primary_category: book.categories?.[0] ?? null,
      primary_niche: null,
      verified_rating: book.rating ?? 0,
      verified_sales_count: book.sales_count ?? 0,
      bestseller_score: 0,
      relevance: 0,
    }));
}

export default async function Catalog9x({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const query = (params.q || "").trim().slice(0, 200);
  const category = (params.category || "").trim().slice(0, 160);

  const result = await search2(query, category);
  const fallback = Boolean(result.error);
  const books = fallback ? await fallbackSearch(query, category) : result.data;
  const ids = books.map((book) => book.book_id);

  const editionMap = new Map<string, Edition>();
  if (ids.length) {
    const { data } = await supabaseAdmin
      .from("book_editions")
      .select("book_id, price, currency, paypal_price, paypal_currency")
      .in("book_id", ids)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    for (const edition of (data ?? []) as Edition[]) {
      if (!editionMap.has(edition.book_id)) editionMap.set(edition.book_id, edition);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#155eef]">LibroSeller Search 2.0</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Encuentra tu próxima lectura</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Búsqueda ponderada por título, metadata, similitud, relevancia y señales comerciales verificables.</p>

          <form action="/catalog" method="get" className="mt-6 grid gap-3 md:grid-cols-[1fr_260px_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={query} placeholder="Título, tema, palabra clave…" className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </label>
            <select name="category" defaultValue={category} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-400">
              <option value="">Todas las categorías</option>
              {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <button type="submit" className="rounded-2xl bg-[#07111f] px-6 py-3 font-black text-white">Buscar</button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2">
            {CATEGORIES.slice(0, 10).map((item) => (
              <Link key={item} href={`/catalog?category=${encodeURIComponent(item)}`} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${category === item ? "border-[#155eef] bg-blue-50 text-[#155eef]" : "border-slate-200 bg-white text-slate-600"}`}>{item}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-600">{books.length} resultado{books.length === 1 ? "" : "s"}{query ? ` para “${query}”` : ""}</p>
          {fallback ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Fallback compatible activo</span> : <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Search 2.0 activo</span>}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((book, index) => {
            const rating = n(book.verified_rating);
            const sales = n(book.verified_sales_count);
            const bestseller = n(book.bestseller_score);
            return (
              <Link key={book.book_id} href={`/catalog/${book.slug}`} className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="relative">
                  {book.cover_url ? <Image src={book.cover_url} alt={`Portada de ${book.title}`} width={480} height={720} className="aspect-[2/3] w-full rounded-2xl object-cover" /> : <div className="aspect-[2/3] rounded-2xl bg-slate-100" />}
                  {index < 3 && bestseller > 0 ? <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-950/90 px-2.5 py-1 text-[10px] font-black text-white"><TrendingUp className="h-3 w-3" /> Bestseller</span> : null}
                </div>
                <p className="mt-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#155eef]">{book.primary_category || book.primary_niche || "LibroSeller"}</p>
                <h2 className="mt-1 line-clamp-2 text-lg font-black leading-6 text-slate-950 group-hover:text-[#155eef]">{book.title}</h2>
                {book.subtitle ? <p className="mt-1 line-clamp-2 text-sm text-slate-500">{book.subtitle}</p> : null}
                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span className="font-black text-slate-950">{priceLabel(editionMap.get(book.book_id))}</span>
                  {rating > 0 ? <span className="inline-flex items-center gap-1 font-bold text-amber-700"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {rating.toFixed(1)}</span> : <span className="font-bold text-slate-400">Nuevo</span>}
                </div>
                {sales > 0 ? <p className="mt-1 text-[11px] font-bold text-emerald-700">{Math.round(sales)} compras verificadas</p> : null}
              </Link>
            );
          })}
        </div>

        {!books.length ? <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-12 text-center"><h2 className="text-xl font-black text-slate-950">No encontramos coincidencias</h2><p className="mt-2 text-sm text-slate-500">Prueba otra palabra, categoría o una búsqueda más amplia.</p></div> : null}
      </section>
    </main>
  );
}
