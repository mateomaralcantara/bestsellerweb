import { NextResponse } from "next/server";
import {
  getPublishedBookBySlug,
  userCanReadBook,
} from "@/lib/book-access";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  errorStatus,
  publicErrorMessage,
  readJsonBody,
  requireTrustedMutation,
} from "@/lib/security/http";
import { consumeRateLimit } from "@/lib/security/rate-limit";

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
};

type ProgressRecord = {
  current_page: number;
  total_pages: number;
  progress_percent: number;
  current_location: string | null;
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

function serializeProgress(progress: ProgressRecord | null) {
  if (!progress) return null;

  return {
    currentPage: Number(progress.current_page),
    totalPages: Number(progress.total_pages),
    progressPercent: Number(progress.progress_percent),
    currentLocation: progress.current_location,
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
    const { bookkey: rawBookkey } = await params;
    const bookkey = safeBookKey(rawBookkey);

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
        "current_page, total_pages, progress_percent, current_location, last_opened_at, updated_at"
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
    requireTrustedMutation(request);

    const { bookkey: rawBookkey } = await params;
    const bookkey = safeBookKey(rawBookkey);

    if (!bookkey) {
      return jsonResponse({ error: "Libro inválido." }, 400);
    }

    const payload = await readJsonBody<ProgressPayload>(request, 2_048);

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
    const access = await getAuthorizedReader(bookkey);

    if (access.error || !access.user || !access.book) {
      return access.error;
    }

    const rateLimit = await consumeRateLimit(request, {
      bucket: "reader:progress",
      identity: access.user.id,
      limit: 120,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Demasiadas actualizaciones de progreso." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const now = new Date().toISOString();
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
        "current_page, total_pages, progress_percent, current_location, last_opened_at, updated_at"
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
    return jsonResponse(
      { error: publicErrorMessage(error, "Error guardando el progreso.") },
      errorStatus(error)
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  return saveProgress(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return saveProgress(request, context);
}
