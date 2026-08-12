import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDefaultPayPalCurrency } from "@/lib/paypal/config";

type Row = Record<string, unknown>;

const PAYPAL_LAUNCH_CURRENCIES = new Set(["USD"]);

export type BookCheckoutItem = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  amount: string;
  currency: string;
};

function text(row: Row | null, key: string) {
  const value = row?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(row: Row | null, key: string) {
  const value = row?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeCurrency(value: string | null, fallback: string) {
  return (value || fallback).trim().toUpperCase();
}

function validPrice(value: number | null): value is number {
  return value !== null && value > 0;
}

function resolvePayPalPrice(
  book: Row,
  edition: Row | null
): { price: number; currency: string } {
  const defaultCurrency = getDefaultPayPalCurrency();
  const editionPayPalPrice = number(edition, "paypal_price");
  const bookPayPalPrice = number(book, "paypal_price");

  if (validPrice(editionPayPalPrice)) {
    return {
      price: editionPayPalPrice,
      currency: normalizeCurrency(
        text(edition, "paypal_currency"),
        defaultCurrency
      ),
    };
  }

  if (validPrice(bookPayPalPrice)) {
    return {
      price: bookPayPalPrice,
      currency: normalizeCurrency(
        text(book, "paypal_currency"),
        defaultCurrency
      ),
    };
  }

  const editionPrice = number(edition, "price");
  const editionCurrency = normalizeCurrency(
    text(edition, "currency"),
    ""
  );

  if (
    validPrice(editionPrice) &&
    PAYPAL_LAUNCH_CURRENCIES.has(editionCurrency)
  ) {
    return { price: editionPrice, currency: editionCurrency };
  }

  const bookPrice = number(book, "price");
  const bookCurrency = normalizeCurrency(text(book, "currency"), "");

  if (
    validPrice(bookPrice) &&
    PAYPAL_LAUNCH_CURRENCIES.has(bookCurrency)
  ) {
    return { price: bookPrice, currency: bookCurrency };
  }

  throw new Error(
    "Configura paypal_price en USD. El precio local en DOP no puede enviarse a PayPal."
  );
}

export async function getBookCheckoutItem(
  bookId: string
): Promise<BookCheckoutItem> {
  const { data, error } = await supabaseAdmin
    .from("books")
    .select("*")
    .eq("id", bookId)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw new Error(`Error consultando libro: ${error.message}`);
  if (!data) throw new Error("Libro no encontrado o no publicado.");

  const book = data as Row;
  let edition: Row | null = null;

  const editionResult = await supabaseAdmin
    .from("book_editions")
    .select("*")
    .eq("book_id", bookId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!editionResult.error && editionResult.data) {
    edition = editionResult.data as Row;
  }

  const { price, currency } = resolvePayPalPrice(book, edition);

  if (!PAYPAL_LAUNCH_CURRENCIES.has(currency)) {
    throw new Error(
      `Esta versión de BestSeller cobra con PayPal solamente en USD, no en ${currency}.`
    );
  }

  const id = text(book, "id");
  const slug = text(book, "slug");
  const title = text(book, "title");

  if (!id || !slug || !title) {
    throw new Error("El libro no tiene id, slug o título válido.");
  }

  return {
    id,
    slug,
    title,
    subtitle: text(book, "subtitle"),
    coverUrl: text(book, "cover_url"),
    amount: price.toFixed(2),
    currency,
  };
}
