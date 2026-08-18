import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "book_view",
  "preview_open",
  "add_to_cart",
  "checkout_start",
]);

type InterestPayload = {
  bookId?: unknown;
  eventType?: unknown;
  anonymousSessionId?: unknown;
};

function getSantoDomingoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(request: Request) {
  let payload: InterestPayload;

  try {
    payload = (await request.json()) as InterestPayload;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const bookId =
    typeof payload.bookId === "string" ? payload.bookId.trim() : "";
  const eventType =
    typeof payload.eventType === "string" ? payload.eventType.trim() : "";
  const anonymousSessionId =
    typeof payload.anonymousSessionId === "string"
      ? payload.anonymousSessionId.trim()
      : "";

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      bookId
    ) ||
    !ALLOWED_EVENTS.has(eventType) ||
    anonymousSessionId.length < 16 ||
    anonymousSessionId.length > 120
  ) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const { data: book, error: bookError } = await supabaseAdmin
    .from("books")
    .select("id")
    .eq("id", bookId)
    .eq("status", "published")
    .maybeSingle();

  if (bookError || !book) {
    return NextResponse.json({ error: "Libro no encontrado." }, { status: 404 });
  }

  let userId: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  const { error } = await supabaseAdmin.from("book_interest_events").upsert(
    {
      book_id: bookId,
      user_id: userId,
      anonymous_session_id: anonymousSessionId,
      event_type: eventType,
      source: "catalog",
      event_date: getSantoDomingoDate(),
    },
    {
      onConflict:
        "book_id,event_type,anonymous_session_id,event_date",
      ignoreDuplicates: true,
    }
  );

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json(
        { error: "La analítica todavía no está instalada." },
        { status: 503 }
      );
    }

    console.error("No se pudo guardar la señal de interés:", error.message);
    return NextResponse.json({ error: "No se pudo registrar." }, { status: 500 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
