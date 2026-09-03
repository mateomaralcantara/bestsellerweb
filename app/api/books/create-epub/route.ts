import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthorPublishingAccess } from "@/lib/author-publishing-access";
import {
  DEFAULT_BOOK_DISPLAY_RATING,
  DEFAULT_BOOK_DISPLAY_SALES_COUNT,
  mergeBookSocialProofMetadata,
} from "@/lib/book-social-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CREATE_STATUSES = new Set(["draft", "under_review"]);
const SHORT_DESCRIPTION_LIMIT = 180;
const PREVIEW_PAGE_COUNT = 25;

type RecordId = string | number;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string) {
  const value = readText(formData, key);
  return value || null;
}

function parseBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "true" || value === "on" || value === "1" || value === "yes";
}

function parseNullableNumber(formData: FormData, key: string) {
  const raw = readText(formData, key).replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`El campo ${key} no es válido.`);
  }
  return value;
}

function parseRequiredPrice(formData: FormData) {
  const value = Number(readText(formData, "price").replace(",", "."));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("El precio no es válido.");
  }
  return value;
}

function parseDisplayRating(formData: FormData) {
  const raw = readText(formData, "display_rating") || String(DEFAULT_BOOK_DISPLAY_RATING);
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 5) {
    throw new Error("La valoración debe estar entre 0 y 5.");
  }
  return Math.round(value * 10) / 10;
}

function parseDisplaySalesCount(formData: FormData) {
  const raw = readText(formData, "display_sales_count") || String(DEFAULT_BOOK_DISPLAY_SALES_COUNT);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 999_999_999) {
    throw new Error("El contador de lectores debe ser un número entero válido.");
  }
  return value;
}

function parseKeywords(value: string) {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateUniqueSlug(title: string) {
  const base = slugify(title) || `libro-${randomUUID().slice(0, 8)}`;
  let slug = base;
  let suffix = 1;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("books")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (error) throw new Error(`Error validando slug: ${error.message}`);
    if (!data?.length) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

function getMissingColumn(message: string) {
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" of relation/i,
    /column "([^"]+)" does not exist/i,
    /schema cache.*'([^']+)'/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

async function insertWithFallback<T>(table: string, payloadInput: Record<string, unknown>) {
  let payload = { ...payloadInput };

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(payload)
      .select("*")
      .single();

    if (!error) return data as T;

    const missing = getMissingColumn(error.message);
    if (!missing || !(missing in payload)) {
      throw new Error(`Error insertando en ${table}: ${error.message}`);
    }

    const next = { ...payload };
    delete next[missing];
    payload = next;
  }

  throw new Error(`No se pudo insertar en ${table}.`);
}

function shortDescription(explicitValue: string | null, longValue: string) {
  return (explicitValue || longValue || "").trim().slice(0, SHORT_DESCRIPTION_LIMIT) || null;
}

function normalizeEditionFormat(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "audiobook") return "audiobook";
  if (["paperback", "hardcover", "print"].includes(normalized)) return "print";
  if (normalized === "kindle_external") return "kindle_external";
  if (normalized === "bundle") return "bundle";
  return "ebook";
}

export async function POST(request: Request) {
  let insertedBookId: RecordId | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return jsonError("No autorizado.", 401);

    const access = await getAuthorPublishingAccess(user.id);
    if (!access.allowed || !access.authorId) {
      return jsonError(access.message || "No tienes permiso para publicar libros.", 403);
    }

    const formData = await request.formData();
    const title = readText(formData, "title");
    const description = readText(formData, "description");
    const primaryNiche = readText(formData, "primary_niche");
    const primaryCategory = readText(formData, "primary_category");
    const keywords = parseKeywords(readText(formData, "keywords"));

    if (!title) throw new Error("El título es obligatorio.");
    if (!description) throw new Error("La descripción comercial es obligatoria.");
    if (!primaryNiche || !primaryCategory) {
      throw new Error("Debes seleccionar nicho y categoría principal.");
    }
    if (keywords.length < 3) throw new Error("Debes agregar mínimo 3 palabras clave.");

    const price = parseRequiredPrice(formData);
    const paypalPrice = parseNullableNumber(formData, "paypal_price");
    const paypalCurrency = (readText(formData, "paypal_currency") || "USD").toUpperCase();
    if (paypalPrice !== null && paypalPrice <= 0) {
      throw new Error("El precio PayPal debe ser mayor que cero.");
    }
    if (paypalCurrency !== "USD") throw new Error("La moneda PayPal debe ser USD.");

    const affiliateCommission = parseNullableNumber(formData, "affiliate_commission_percentage");
    if (affiliateCommission !== null && affiliateCommission > 100) {
      throw new Error("La comisión de afiliado no puede superar 100%.");
    }

    const requestedStatus = readText(formData, "status") || "under_review";
    const status = ALLOWED_CREATE_STATUSES.has(requestedStatus) ? requestedStatus : "under_review";
    const slug = await generateUniqueSlug(title);
    const now = new Date().toISOString();

    const bookPayload: Record<string, unknown> = {
      owner_user_id: user.id,
      author_id: access.authorId,
      title,
      subtitle: nullableText(formData, "subtitle"),
      publisher_name: nullableText(formData, "publisher_name"),
      slug,
      cover_url: "",
      status,
      featured: parseBoolean(formData, "is_featured"),
      description_short: shortDescription(nullableText(formData, "description_short"), description),
      description_long: description,
      introduction: nullableText(formData, "introduction"),
      chapter_one_excerpt: nullableText(formData, "chapter_one_excerpt"),
      sample_url: nullableText(formData, "sample_url"),
      primary_niche: primaryNiche,
      primary_category: primaryCategory,
      secondary_category: nullableText(formData, "secondary_category"),
      keywords,
      target_audience: nullableText(formData, "target_audience"),
      reader_promise: nullableText(formData, "reader_promise"),
      sales_hook: nullableText(formData, "sales_hook"),
      comparable_books: nullableText(formData, "comparable_books"),
      meta_title: nullableText(formData, "meta_title"),
      meta_description: nullableText(formData, "meta_description"),
      marketing_angle: nullableText(formData, "marketing_angle"),
      language_code: readText(formData, "language_code") || "es",
      preview_mode: "epub_preview",
      preview_page_count: PREVIEW_PAGE_COUNT,
      preview_include_cover: false,
      preview_layout: "epub_reader",
      preview_progress_enabled: true,
      preview_status: "pending",
      preview_error: null,
      preview_generated_at: null,
      metadata: mergeBookSocialProofMetadata(null, {
        rating: parseDisplayRating(formData),
        salesCount: parseDisplaySalesCount(formData),
      }),
      created_at: now,
      updated_at: now,
    };

    const book = await insertWithFallback<Record<string, unknown> & { id: RecordId }>("books", bookPayload);
    insertedBookId = book.id;

    const editionPayload: Record<string, unknown> = {
      book_id: book.id,
      format: normalizeEditionFormat(readText(formData, "format") || "ebook"),
      edition_name: "Edición digital",
      price,
      currency: readText(formData, "currency") || "DOP",
      paypal_price: paypalPrice,
      paypal_currency: paypalCurrency,
      compare_at_price: parseNullableNumber(formData, "compare_at_price"),
      page_count: parseNullableNumber(formData, "page_count"),
      isbn: nullableText(formData, "isbn"),
      affiliate_enabled: parseBoolean(formData, "affiliate_enabled"),
      affiliate_commission_percentage: affiliateCommission,
      download_allowed: parseBoolean(formData, "download_allowed"),
      file_url: null,
      is_active: true,
      sort_order: 0,
      updated_at: now,
    };

    const edition = await insertWithFallback<Record<string, unknown> & { id: RecordId }>("book_editions", editionPayload);

    return NextResponse.json(
      {
        ok: true,
        message: "Ficha creada. Continúa la carga directa de portada y EPUB.",
        book,
        edition,
        view_url: `/dashboard/books/${book.id}/edit`,
        catalog_url: `/catalog/${slug}`,
        preview: {
          mode: "derived_from_current_epub",
          page_count: PREVIEW_PAGE_COUNT,
          status: "pending",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (insertedBookId !== null) {
      try {
        await supabaseAdmin.from("book_editions").delete().eq("book_id", insertedBookId);
        await supabaseAdmin.from("books").delete().eq("id", insertedBookId);
      } catch (rollbackError) {
        console.error("ROLLBACK create-epub error:", rollbackError);
      }
    }

    const message = error instanceof Error ? error.message : "No se pudo crear el libro.";
    const status = /obligatori|válid|mínimo|seleccionar|superar|mayor que cero/i.test(message) ? 400 : 500;
    console.error("POST /api/books/create-epub error:", error);
    return jsonError(message, status);
  }
}
