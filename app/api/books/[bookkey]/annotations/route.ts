import { NextResponse } from "next/server";
import {
  getPublishedBookBySlug,
  userCanReadBook,
} from "@/lib/book-access";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ANNOTATIONS = 500;
const MAX_SELECTED_TEXT = 5000;
const MAX_NOTE_LENGTH = 3000;
const MAX_ID_LENGTH = 128;
const MAX_SIGNATURE_LENGTH = 160;

type AnnotationKind = "highlight" | "underline" | "comment";

type RouteContext = {
  params: Promise<{
    bookkey: string;
  }>;
};

type AnnotationInput = {
  id?: unknown;
  kind?: unknown;
  sectionSignature?: unknown;
  start?: unknown;
  end?: unknown;
  text?: unknown;
  note?: unknown;
  createdAt?: unknown;
};

type AnnotationRecord = {
  id: string;
  kind: AnnotationKind;
  section_signature: string;
  start_offset: number;
  end_offset: number;
  selected_text: string;
  note: string;
  created_at: string;
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

function isAnnotationKind(value: unknown): value is AnnotationKind {
  return value === "highlight" || value === "underline" || value === "comment";
}

function asFiniteInteger(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.trunc(number);
}

function normalizeCreatedAt(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return new Date().toISOString();
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString();
}

function sanitizeAnnotation(value: unknown): AnnotationRecord | null {
  if (!value || typeof value !== "object") return null;

  const input = value as AnnotationInput;
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const sectionSignature =
    typeof input.sectionSignature === "string"
      ? input.sectionSignature.trim()
      : "";
  const selectedText = typeof input.text === "string" ? input.text.trim() : "";
  const note = typeof input.note === "string" ? input.note.trim() : "";
  const start = asFiniteInteger(input.start);
  const end = asFiniteInteger(input.end);

  if (
    !id ||
    id.length > MAX_ID_LENGTH ||
    !isAnnotationKind(input.kind) ||
    !sectionSignature ||
    sectionSignature.length > MAX_SIGNATURE_LENGTH ||
    start === null ||
    end === null ||
    start < 0 ||
    end <= start ||
    !selectedText ||
    selectedText.length > MAX_SELECTED_TEXT ||
    note.length > MAX_NOTE_LENGTH
  ) {
    return null;
  }

  return {
    id,
    kind: input.kind,
    section_signature: sectionSignature,
    start_offset: start,
    end_offset: end,
    selected_text: selectedText,
    note,
    created_at: normalizeCreatedAt(input.createdAt),
  };
}

function serializeAnnotation(annotation: AnnotationRecord) {
  return {
    id: annotation.id,
    kind: annotation.kind,
    sectionSignature: annotation.section_signature,
    start: Number(annotation.start_offset),
    end: Number(annotation.end_offset),
    text: annotation.selected_text,
    note: annotation.note || "",
    createdAt: annotation.created_at,
  };
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false;

  return (
    error.code === "42P01" ||
    /reader_annotations/i.test(error.message || "") &&
      /does not exist|schema cache|not found/i.test(error.message || "")
  );
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
    if (!bookkey) return jsonResponse({ error: "Libro inválido." }, 400);

    const access = await getAuthorizedReader(bookkey);
    if (access.error || !access.user || !access.book) return access.error;

    const { data, error } = await supabaseAdmin
      .from("reader_annotations")
      .select(
        "id, kind, section_signature, start_offset, end_offset, selected_text, note, created_at"
      )
      .eq("user_id", access.user.id)
      .eq("book_id", access.book.id)
      .order("created_at", { ascending: false })
      .limit(MAX_ANNOTATIONS);

    if (error) {
      if (isMissingTableError(error)) {
        return jsonResponse(
          {
            ok: false,
            storageUnavailable: true,
            annotations: [],
            error: "El almacenamiento remoto de anotaciones aún no está habilitado.",
          },
          503
        );
      }

      console.error("Error cargando anotaciones del lector:", error.message);
      return jsonResponse({ error: "No se pudieron cargar las anotaciones." }, 500);
    }

    return jsonResponse({
      ok: true,
      annotations: ((data || []) as AnnotationRecord[]).map(serializeAnnotation),
    });
  } catch (error) {
    console.error("GET /api/books/[bookkey]/annotations error:", error);
    return jsonResponse({ error: "Error cargando anotaciones." }, 500);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeBookKey((await params).bookkey);
    if (!bookkey) return jsonResponse({ error: "Libro inválido." }, 400);

    let payload: { annotations?: unknown };
    try {
      payload = (await request.json()) as { annotations?: unknown };
    } catch {
      return jsonResponse({ error: "Datos de anotaciones inválidos." }, 400);
    }

    if (!Array.isArray(payload.annotations)) {
      return jsonResponse({ error: "annotations debe ser una lista." }, 400);
    }

    if (payload.annotations.length > MAX_ANNOTATIONS) {
      return jsonResponse(
        { error: `Se permiten hasta ${MAX_ANNOTATIONS} anotaciones por libro.` },
        400
      );
    }

    const annotations = payload.annotations.map(sanitizeAnnotation);
    if (annotations.some((item) => item === null)) {
      return jsonResponse({ error: "Una o más anotaciones son inválidas." }, 400);
    }

    const cleanAnnotations = annotations as AnnotationRecord[];
    const access = await getAuthorizedReader(bookkey);
    if (access.error || !access.user || !access.book) return access.error;

    const scoped = supabaseAdmin
      .from("reader_annotations")
      .select("id")
      .eq("user_id", access.user.id)
      .eq("book_id", access.book.id);

    const { data: existing, error: existingError } = await scoped;

    if (existingError) {
      if (isMissingTableError(existingError)) {
        return jsonResponse(
          {
            ok: false,
            storageUnavailable: true,
            error: "El almacenamiento remoto de anotaciones aún no está habilitado.",
          },
          503
        );
      }

      console.error("Error leyendo anotaciones existentes:", existingError.message);
      return jsonResponse({ error: "No se pudieron sincronizar las anotaciones." }, 500);
    }

    if (cleanAnnotations.length > 0) {
      const rows = cleanAnnotations.map((annotation) => ({
        user_id: access.user.id,
        book_id: access.book.id,
        id: annotation.id,
        kind: annotation.kind,
        section_signature: annotation.section_signature,
        start_offset: annotation.start_offset,
        end_offset: annotation.end_offset,
        selected_text: annotation.selected_text,
        note: annotation.note,
        created_at: annotation.created_at,
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await supabaseAdmin
        .from("reader_annotations")
        .upsert(rows, { onConflict: "user_id,book_id,id" });

      if (upsertError) {
        console.error("Error guardando anotaciones:", upsertError.message);
        return jsonResponse({ error: "No se pudieron guardar las anotaciones." }, 500);
      }
    }

    const incomingIds = new Set(cleanAnnotations.map((item) => item.id));
    const staleIds = (existing || [])
      .map((item) => String(item.id || ""))
      .filter((id) => id && !incomingIds.has(id));

    if (staleIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("reader_annotations")
        .delete()
        .eq("user_id", access.user.id)
        .eq("book_id", access.book.id)
        .in("id", staleIds);

      if (deleteError) {
        console.error("Error eliminando anotaciones antiguas:", deleteError.message);
        return jsonResponse({ error: "No se pudieron sincronizar las eliminaciones." }, 500);
      }
    }

    return jsonResponse({
      ok: true,
      annotations: cleanAnnotations.map(serializeAnnotation),
    });
  } catch (error) {
    console.error("PUT /api/books/[bookkey]/annotations error:", error);
    return jsonResponse({ error: "Error guardando anotaciones." }, 500);
  }
}
