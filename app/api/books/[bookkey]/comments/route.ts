import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    bookkey: string;
  }>;
};

type BookRow = {
  id: string;
  slug: string;
};

type CommentRow = {
  id: string;
  user_id: string;
  rating: number;
  comment_text: string;
  is_verified_purchase: boolean;
  created_at: string;
  updated_at: string;
};

type EditorialCommentRow = {
  id: string;
  display_order: number;
  comment_text: string;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type CommentPayload = {
  rating?: unknown;
  comment?: unknown;
  commentId?: unknown;
};

const ACTIVE_PURCHASE_STATUSES = [
  "paid",
  "completed",
  "approved",
  "succeeded",
] as const;

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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function getPublishedBook(bookkey: string) {
  const bySlug = await supabaseAdmin
    .from("books")
    .select("id, slug")
    .eq("slug", bookkey)
    .eq("status", "published")
    .maybeSingle<BookRow>();

  if (bySlug.error) {
    throw new Error(`No se pudo consultar el libro: ${bySlug.error.message}`);
  }

  if (bySlug.data || !isUuid(bookkey)) {
    return bySlug.data;
  }

  const byId = await supabaseAdmin
    .from("books")
    .select("id, slug")
    .eq("id", bookkey)
    .eq("status", "published")
    .maybeSingle<BookRow>();

  if (byId.error) {
    throw new Error(`No se pudo consultar el libro: ${byId.error.message}`);
  }

  return byId.data;
}

async function getViewer() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

function cleanComment(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function parseRating(value: unknown) {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null;
  }

  return rating;
}

function getAverageRating(comments: CommentRow[]) {
  if (comments.length === 0) return null;

  const total = comments.reduce(
    (sum, comment) => sum + Number(comment.rating),
    0
  );

  return Math.round((total / comments.length) * 10) / 10;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeBookKey((await params).bookkey);

    if (!bookkey) {
      return jsonResponse({ error: "Libro inválido." }, 400);
    }

    const [book, viewer] = await Promise.all([
      getPublishedBook(bookkey),
      getViewer(),
    ]);

    if (!book) {
      return jsonResponse({ error: "Libro no encontrado." }, 404);
    }

    const [commentsResult, editorialResult] = await Promise.all([
      supabaseAdmin
        .from("book_comments")
        .select(
          "id, user_id, rating, comment_text, is_verified_purchase, created_at, updated_at"
        )
        .eq("book_id", book.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .returns<CommentRow[]>(),
      supabaseAdmin
        .from("book_editorial_comments")
        .select("id, display_order, comment_text, created_at, updated_at")
        .eq("book_id", book.id)
        .order("display_order", { ascending: true })
        .returns<EditorialCommentRow[]>(),
    ]);

    if (commentsResult.error) {
      console.error(
        "Error cargando comentarios:",
        commentsResult.error.message
      );
      return jsonResponse({ error: "No se pudieron cargar las reseñas." }, 500);
    }

    if (editorialResult.error) {
      console.error(
        "Error cargando comentarios editoriales:",
        editorialResult.error.message
      );
      return jsonResponse(
        { error: "No se pudieron cargar los comentarios editoriales." },
        500
      );
    }

    const rows = commentsResult.data ?? [];
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const profilesById = new Map<string, ProfileRow>();

    if (userIds.length > 0) {
      const profileResult = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds)
        .returns<ProfileRow[]>();

      if (profileResult.error) {
        console.warn(
          "No se pudieron cargar nombres de comentarios:",
          profileResult.error.message
        );
      } else {
        for (const profile of profileResult.data ?? []) {
          profilesById.set(profile.id, profile);
        }
      }
    }

    return jsonResponse({
      ok: true,
      summary: {
        averageRating: getAverageRating(rows),
        totalComments: rows.length,
      },
      viewer: {
        authenticated: Boolean(viewer),
      },
      editorialComments: (editorialResult.data ?? []).map((row) => ({
        id: row.id,
        displayOrder: Number(row.display_order),
        comment: row.comment_text,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        label: "Comentario editorial automático",
        disclaimer: "No representa la opinión de un comprador.",
      })),
      comments: rows.map((row) => ({
        id: row.id,
        rating: Number(row.rating),
        comment: row.comment_text,
        authorName:
          profilesById.get(row.user_id)?.full_name?.trim() ||
          "Lector de BestSeller",
        isVerifiedPurchase: Boolean(row.is_verified_purchase),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        canManage: viewer?.id === row.user_id,
      })),
    });
  } catch (error) {
    console.error("GET /api/books/[bookkey]/comments error:", error);
    return jsonResponse({ error: "Error cargando las reseñas." }, 500);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeBookKey((await params).bookkey);

    if (!bookkey) {
      return jsonResponse({ error: "Libro inválido." }, 400);
    }

    const viewer = await getViewer();

    if (!viewer) {
      return jsonResponse(
        { error: "Debes iniciar sesión para publicar una reseña." },
        401
      );
    }

    let payload: CommentPayload;

    try {
      payload = (await request.json()) as CommentPayload;
    } catch {
      return jsonResponse({ error: "Datos de reseña inválidos." }, 400);
    }

    const rating = parseRating(payload.rating);
    const comment = cleanComment(payload.comment);

    if (!rating) {
      return jsonResponse({ error: "Selecciona entre 1 y 5 estrellas." }, 400);
    }

    if (comment.length < 10 || comment.length > 1500) {
      return jsonResponse(
        { error: "El comentario debe tener entre 10 y 1,500 caracteres." },
        400
      );
    }

    const book = await getPublishedBook(bookkey);

    if (!book) {
      return jsonResponse({ error: "Libro no encontrado." }, 404);
    }

    const purchaseResult = await supabaseAdmin
      .from("book_purchases")
      .select("id")
      .eq("user_id", viewer.id)
      .eq("book_id", book.id)
      .in("status", [...ACTIVE_PURCHASE_STATUSES])
      .limit(1)
      .maybeSingle();

    if (purchaseResult.error) {
      console.warn(
        "No se pudo verificar la compra del comentario:",
        purchaseResult.error.message
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("book_comments")
      .upsert(
        {
          book_id: book.id,
          user_id: viewer.id,
          rating,
          comment_text: comment,
          status: "published",
          is_verified_purchase: Boolean(purchaseResult.data),
          updated_at: now,
        },
        {
          onConflict: "book_id,user_id",
        }
      )
      .select("id")
      .single();

    if (error) {
      console.error("Error guardando comentario:", error.message);
      return jsonResponse({ error: "No se pudo guardar tu reseña." }, 500);
    }

    return jsonResponse(
      {
        ok: true,
        commentId: data.id,
        message: "Tu reseña fue publicada correctamente.",
      },
      201
    );
  } catch (error) {
    console.error("POST /api/books/[bookkey]/comments error:", error);
    return jsonResponse({ error: "Error publicando la reseña." }, 500);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeBookKey((await params).bookkey);
    const viewer = await getViewer();

    if (!viewer) {
      return jsonResponse({ error: "Debes iniciar sesión." }, 401);
    }

    let payload: CommentPayload;

    try {
      payload = (await request.json()) as CommentPayload;
    } catch {
      return jsonResponse({ error: "Solicitud inválida." }, 400);
    }

    const commentId =
      typeof payload.commentId === "string" ? payload.commentId.trim() : "";

    if (!bookkey || !isUuid(commentId)) {
      return jsonResponse({ error: "Comentario inválido." }, 400);
    }

    const book = await getPublishedBook(bookkey);

    if (!book) {
      return jsonResponse({ error: "Libro no encontrado." }, 404);
    }

    const { data, error } = await supabaseAdmin
      .from("book_comments")
      .delete()
      .eq("id", commentId)
      .eq("book_id", book.id)
      .eq("user_id", viewer.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Error eliminando comentario:", error.message);
      return jsonResponse({ error: "No se pudo eliminar la reseña." }, 500);
    }

    if (!data) {
      return jsonResponse({ error: "Reseña no encontrada." }, 404);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("DELETE /api/books/[bookkey]/comments error:", error);
    return jsonResponse({ error: "Error eliminando la reseña." }, 500);
  }
}
