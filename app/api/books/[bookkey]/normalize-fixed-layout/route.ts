import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthorPublishingAccess } from "@/lib/author-publishing-access";
import {
  getCurrentBookNormalization,
  normalizeBookEpubById,
} from "@/lib/epub-normalization-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ bookkey: string }> };

function safeKey(value: string) {
  try {
    return decodeURIComponent(value || "").trim();
  } catch {
    return "";
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getBook(bookkey: string) {
  let query = supabaseAdmin
    .from("books")
    .select("id, slug, title, owner_user_id, author_id")
    .limit(1);
  query = isUuid(bookkey) ? query.eq("id", bookkey) : query.eq("slug", bookkey);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function authorize(bookkey: string) {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return { error: "Debes iniciar sesión.", status: 401, book: null };

  const book = await getBook(bookkey);
  if (!book) return { error: "Libro no encontrado.", status: 404, book: null };
  if (book.owner_user_id === auth.user.id) return { error: null, status: 200, book };

  const access = await getAuthorPublishingAccess(auth.user.id);
  if (access.authorId && access.authorId === book.author_id) {
    return { error: null, status: 200, book };
  }
  return { error: "No tienes permiso para normalizar este libro.", status: 403, book: null };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeKey((await params).bookkey);
    const access = await authorize(bookkey);
    if (access.error || !access.book) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const normalization = await getCurrentBookNormalization(access.book.id);
    return NextResponse.json({ book: access.book, normalization });
  } catch (error) {
    console.error("GET normalize fixed layout:", error);
    return NextResponse.json({ error: "No se pudo consultar la normalización." }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeKey((await params).bookkey);
    const access = await authorize(bookkey);
    if (access.error || !access.book) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const result = await normalizeBookEpubById(access.book.id);
    const status = result.status === "error" ? 500 : 200;
    return NextResponse.json({ book: access.book, normalization: result }, { status });
  } catch (error) {
    console.error("POST normalize fixed layout:", error);
    return NextResponse.json({ error: "No se pudo normalizar el EPUB." }, { status: 500 });
  }
}
