import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "book_impression",
  "book_click",
  "preview_started",
  "preview_progress",
  "preview_completed",
  "checkout_started",
  "purchase_completed",
  "reader_started",
  "reader_25",
  "reader_50",
  "reader_75",
  "reader_completed",
  "wishlist",
  "share",
  "search",
]);

function text(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const serialized = JSON.stringify(value);
  if (serialized.length > 8_000) return {};
  return value as Record<string, unknown>;
}

async function resolveBookId(bookId: string, bookSlug: string) {
  if (bookId) {
    const { data } = await supabaseAdmin
      .from("books")
      .select("id")
      .eq("id", bookId)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  if (bookSlug) {
    const { data } = await supabaseAdmin
      .from("books")
      .select("id")
      .eq("slug", bookSlug)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const eventType = text(body.eventType, 64);

    if (!ALLOWED_EVENTS.has(eventType)) {
      return NextResponse.json({ error: "Evento no permitido." }, { status: 400 });
    }

    const bookId = await resolveBookId(
      text(body.bookId, 64),
      text(body.bookSlug, 180)
    );

    if (eventType !== "search" && !bookId) {
      return NextResponse.json({ error: "Libro no encontrado." }, { status: 404 });
    }

    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    const { error } = await supabaseAdmin.from("marketplace_events").insert({
      user_id: user?.id ?? null,
      anonymous_id: text(body.anonymousId, 128) || null,
      session_id: text(body.sessionId, 128) || null,
      book_id: bookId,
      event_type: eventType,
      surface: text(body.surface, 80) || null,
      referrer: text(request.headers.get("referer"), 500) || null,
      metadata: safeMetadata(body.metadata),
      occurred_at: new Date().toISOString(),
    });

    if (error) {
      console.error("MARKETPLACE EVENT INSERT:", error.message);
      return NextResponse.json(
        { error: "No se pudo registrar el evento." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/marketplace/events:", error);
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }
}
