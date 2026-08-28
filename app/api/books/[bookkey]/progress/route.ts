import { NextResponse } from "next/server";
import {
  getPublishedBookBySlug,
  userCanReadBook,
} from "@/lib/book-access";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    bookkey: string;
  }>;
};

type ProgressPayload = {
  currentPage?: unknown;
  totalPages?: unknown;
  currentLocation?: unknown;
  progressPercent?: unknown;
  locationType?: unknown;
};

type ProgressRecord = {
  current_page: number;
  total_pages: number;
  progress_percent: number;
  current_location: string | null;
  location_type: string | null;
  last_opened_at: string;
  updated_at: string;
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

function safeBookKey(value: string) {
  try {
    return decodeURIComponent(value || "").trim();
  } catch {
    return "";
  }
}

function toPositiveInteger(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  const integer = Math.round(number);
  return integer >= 1 ? integer : null;
}

function toPercent(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(Math.min(100, Math.max(0, number)).toFixed(2));
}

function serializeProgress(progress: ProgressRecord | null) {
  if (!progress) return null;

  return {
    currentPage: Number(progress.current_page),
    totalPages: Number(progress.total_pages),
    progressPercent: Number(progress.progress_percent),
    currentLocation: progress.current_location,
    locationType: progress.location_type,
    lastOpenedAt: progress.last_opened_at,
    updatedAt: progress.updated_at,
  };
}

async function getAuthorizedReader(bookkey: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: jsonResponse({ error: "Debes iniciar sesión." }, 401),
      user: null,
      book: null,
    };
  }

  const book = await getPublishedBookBySlug(bookkey);

  if (!book) {
    return {
      error: jsonResponse({ error: "Libro no encontrado." }, 404),
      user: null,
      book: null,
    };
  }

  const canRead = await userCanReadBook({
    user: {
      id: user.id,
      email: user.email,
    },
    book,
  });

  if (!canRead) {
    return {
      error: jsonResponse(
        { error: "No tienes acceso de lectura a este libro." },
        403
      ),
      user: null,
      book: null,
    };
  }

  return {
    error: null,
    user,
    book,
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeBookKey((await params).bookkey);

    if (!bookkey) {
      return jsonResponse({ error: "Libro inválido." }, 400);
    }

    const access = await getAuthorizedReader(bookkey);

    if (access.error || !access.user || !access.book) {
      return access.error;
    }

    const { data, error } = await supabaseAdmin
      .from("book_reading_progress")
      .select(
        "current_page, total_pages, progress_percent, current_location, location_type, last_opened_at, updated_at"
      )
      .eq("user_id", access.user.id)
      .eq("book_id", access.book.id)
      .maybeSingle<ProgressRecord>();

    if (error) {
      console.error("Error cargando progreso de lectura:", error.message);
      return jsonResponse(
        { error: "No se pudo cargar el progreso de lectura." },
        500
      );
    }

    return jsonResponse({
      ok: true,
      progress: serializeProgress(data),
    });
  } catch (error) {
    console.error("GET /api/books/[bookkey]/progress error:", error);
    return jsonResponse({ error: "Error cargando el progreso." }, 500);
  }
}

async function saveProgress(request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeBookKey((await params).bookkey);

    if (!bookkey) {
      return jsonResponse({ error: "Libro inválido." }, 400);
    }

    let payload: ProgressPayload;

    try {
      payload = (await request.json()) as ProgressPayload;
    } catch {
      return jsonResponse({ error: "Datos de progreso inválidos." }, 400);
    }

    const access = await getAuthorizedReader(bookkey);

    if (access.error || !access.user || !access.book) {
      return access.error;
    }

    const requestedLocation =
      typeof payload.currentLocation === "string"
        ? payload.currentLocation.trim()
        : "";
    const requestedType =
      typeof payload.locationType === "string"
        ? payload.locationType.trim()
        : "";
    const requestedPercent = toPercent(payload.progressPercent);

    const isEpubProgress =
      requestedType === "epub_cfi" &&
      requestedLocation.startsWith("epubcfi(") &&
      requestedPercent !== null;

    const now = new Date().toISOString();

    if (isEpubProgress) {
      const virtualPage = Math.max(1, Math.round(requestedPercent || 1));

      const { data, error } = await supabaseAdmin
        .from("book_reading_progress")
        .upsert(
          {
            user_id: access.user.id,
            book_id: access.book.id,
            current_page: virtualPage,
            total_pages: 100,
            progress_percent: requestedPercent,
            location_type: "epub_cfi",
            current_location: requestedLocation,
            last_opened_at: now,
            updated_at: now,
          },
          {
            onConflict: "user_id,book_id",
          }
        )
        .select(
          "current_page, total_pages, progress_percent, current_location, location_type, last_opened_at, updated_at"
        )
        .single<ProgressRecord>();

      if (error) {
        console.error("Error guardando progreso EPUB:", error.message);
        return jsonResponse(
          { error: "No se pudo guardar el progreso EPUB." },
          500
        );
      }

      return jsonResponse({
        ok: true,
        progress: serializeProgress(data),
      });
    }

    const requestedPage = toPositiveInteger(payload.currentPage);
    const totalPages = toPositiveInteger(payload.totalPages);

    if (!requestedPage || !totalPages) {
      return jsonResponse(
        { error: "La página actual y el total deben ser números válidos." },
        400
      );
    }

    const currentPage = Math.min(requestedPage, totalPages);
    const progressPercent = Number(
      Math.min(100, (currentPage / totalPages) * 100).toFixed(2)
    );

    const { data, error } = await supabaseAdmin
      .from("book_reading_progress")
      .upsert(
        {
          user_id: access.user.id,
          book_id: access.book.id,
          current_page: currentPage,
          total_pages: totalPages,
          progress_percent: progressPercent,
          location_type: "pdf_page",
          current_location: `page:${currentPage}`,
          last_opened_at: now,
          updated_at: now,
        },
        {
          onConflict: "user_id,book_id",
        }
      )
      .select(
        "current_page, total_pages, progress_percent, current_location, location_type, last_opened_at, updated_at"
      )
      .single<ProgressRecord>();

    if (error) {
      console.error("Error guardando progreso de lectura:", error.message);
      return jsonResponse(
        { error: "No se pudo guardar el progreso de lectura." },
        500
      );
    }

    return jsonResponse({
      ok: true,
      progress: serializeProgress(data),
    });
  } catch (error) {
    console.error("PUT /api/books/[bookkey]/progress error:", error);
    return jsonResponse({ error: "Error guardando el progreso." }, 500);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  return saveProgress(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return saveProgress(request, context);
}
