import { NextResponse } from "next/server";
import { getPublishedBookBySlug } from "@/lib/book-access";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ bookkey: string }>;
};

function safeKey(value: string) {
  try {
    return decodeURIComponent(value || "").trim();
  } catch {
    return "";
  }
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function resolveBook(bookkey: string) {
  return getPublishedBookBySlug(bookkey);
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeKey((await params).bookkey);
    const book = bookkey ? await resolveBook(bookkey) : null;
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado." }, { status: 404 });
    }

    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 20, 100));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

    const [{ data: reviews, error }, { data: metrics }] = await Promise.all([
      supabaseAdmin
        .from("book_reviews")
        .select("id, rating, title, review, verified_purchase, helpful_count, created_at")
        .eq("book_id", book.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
      supabaseAdmin
        .from("book_verified_metrics")
        .select("verified_rating, review_count, verified_sales_count")
        .eq("book_id", book.id)
        .maybeSingle(),
    ]);

    if (error) {
      console.error("REVIEWS GET:", error.message);
      return NextResponse.json({ error: "No se pudieron cargar las reseñas." }, { status: 500 });
    }

    return NextResponse.json({
      reviews: reviews ?? [],
      metrics: metrics ?? {
        verified_rating: 0,
        review_count: 0,
        verified_sales_count: 0,
      },
      pagination: { limit, offset },
    });
  } catch (error) {
    console.error("GET reviews:", error);
    return NextResponse.json({ error: "Error cargando reseñas." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeKey((await params).bookkey);
    const book = bookkey ? await resolveBook(bookkey) : null;
    if (!book) {
      return NextResponse.json({ error: "Libro no encontrado." }, { status: 404 });
    }

    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("book_purchases")
      .select("id, status")
      .eq("book_id", book.id)
      .eq("user_id", auth.user.id)
      .in("status", ["paid", "completed", "approved", "succeeded"])
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (purchaseError) {
      console.error("REVIEW PURCHASE CHECK:", purchaseError.message);
      return NextResponse.json({ error: "No se pudo verificar la compra." }, { status: 500 });
    }

    if (!purchase) {
      return NextResponse.json(
        { error: "Solo compradores verificados pueden publicar una reseña." },
        { status: 403 }
      );
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const rating = Number(payload.rating);
    const title = cleanText(payload.title, 120);
    const review = cleanText(payload.review, 4000);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "La valoración debe estar entre 1 y 5." }, { status: 400 });
    }
    if (review.length < 10) {
      return NextResponse.json({ error: "La reseña debe tener al menos 10 caracteres." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("book_reviews")
      .upsert(
        {
          book_id: book.id,
          user_id: auth.user.id,
          purchase_id: purchase.id,
          rating,
          title: title || null,
          review,
          verified_purchase: true,
          status: "published",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "book_id,user_id" }
      )
      .select("id, rating, title, review, verified_purchase, helpful_count, created_at, updated_at")
      .single();

    if (error) {
      console.error("REVIEW UPSERT:", error.message);
      return NextResponse.json({ error: "No se pudo guardar la reseña." }, { status: 500 });
    }

    return NextResponse.json({ review: data }, { status: 201 });
  } catch (error) {
    console.error("POST reviews:", error);
    return NextResponse.json({ error: "Reseña inválida." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeKey((await params).bookkey);
    const book = bookkey ? await resolveBook(bookkey) : null;
    if (!book) return NextResponse.json({ error: "Libro no encontrado." }, { status: 404 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

    const { error } = await supabaseAdmin
      .from("book_reviews")
      .delete()
      .eq("book_id", book.id)
      .eq("user_id", auth.user.id);

    if (error) {
      return NextResponse.json({ error: "No se pudo eliminar la reseña." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE reviews:", error);
    return NextResponse.json({ error: "Error eliminando reseña." }, { status: 500 });
  }
}
