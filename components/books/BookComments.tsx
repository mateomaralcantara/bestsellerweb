"use client";

import Link from "next/link";
import {
  Loader2,
  MessageCircle,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type BookComment = {
  id: string;
  rating: number;
  comment: string;
  authorName: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
  canManage: boolean;
};

type EditorialComment = {
  id: string;
  displayOrder: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
  label: string;
  disclaimer: string;
};

type CommentsResponse = {
  ok?: boolean;
  error?: string;
  summary?: {
    averageRating: number | null;
    totalComments: number;
  };
  viewer?: {
    authenticated: boolean;
  };
  editorialComments?: EditorialComment[];
  comments?: BookComment[];
};

type BookCommentsProps = {
  bookSlug: string;
  bookTitle: string;
};

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("es-DO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Fecha no disponible";
  }
}

function ReadOnlyStars({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${value} de 5 estrellas`}
    >
      {STAR_VALUES.map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`h-4 w-4 ${
            star <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "fill-slate-200 text-slate-200"
          }`}
        />
      ))}
    </span>
  );
}

export function BookComments({ bookSlug, bookTitle }: BookCommentsProps) {
  const endpoint = useMemo(
    () => `/api/books/${encodeURIComponent(bookSlug)}/comments`,
    [bookSlug]
  );
  const signInUrl = `/auth?next=${encodeURIComponent(`/catalog/${bookSlug}`)}`;

  const [comments, setComments] = useState<BookComment[]>([]);
  const [editorialComments, setEditorialComments] = useState<
    EditorialComment[]
  >([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [totalComments, setTotalComments] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = (await response.json()) as CommentsResponse;

      if (!response.ok) {
        throw new Error(payload.error || "No se pudieron cargar las reseñas.");
      }

      const nextComments = payload.comments ?? [];
      const ownComment = nextComments.find((item) => item.canManage);

      setComments(nextComments);
      setEditorialComments(payload.editorialComments ?? []);
      setAverageRating(payload.summary?.averageRating ?? null);
      setTotalComments(payload.summary?.totalComments ?? nextComments.length);
      setAuthenticated(Boolean(payload.viewer?.authenticated));

      if (ownComment) {
        setRating(ownComment.rating);
        setComment(ownComment.comment);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudieron cargar las reseñas."
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadComments();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadComments]);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rating, comment }),
      });
      const payload = (await response.json()) as CommentsResponse & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "No se pudo publicar tu reseña.");
      }

      setSuccess(payload.message || "Reseña publicada correctamente.");
      await loadComments();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo publicar tu reseña."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm("¿Deseas eliminar tu reseña de este libro?")) {
      return;
    }

    setDeletingId(commentId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ commentId }),
      });
      const payload = (await response.json()) as CommentsResponse;

      if (!response.ok) {
        throw new Error(payload.error || "No se pudo eliminar tu reseña.");
      }

      setComment("");
      setRating(5);
      setSuccess("Tu reseña fue eliminada.");
      await loadComments();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo eliminar tu reseña."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section
      id="opiniones"
      className="commercial-card overflow-hidden rounded-[28px]"
    >
      <header className="border-b border-slate-200 bg-gradient-to-br from-amber-50 via-white to-blue-50 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">
              Comunidad lectora
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#07111f]">
              Opiniones sobre {bookTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Comparte una valoración útil y respetuosa para orientar a otros
              lectores.
            </p>
          </div>

          <div className="min-w-[150px] rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-sm">
            {averageRating !== null ? (
              <>
                <div className="flex items-end gap-2">
                  <strong className="text-3xl font-black text-slate-950">
                    {averageRating.toFixed(1)}
                  </strong>
                  <span className="pb-1 text-sm font-bold text-slate-500">
                    / 5
                  </span>
                </div>
                <ReadOnlyStars value={averageRating} />
              </>
            ) : (
              <strong className="text-sm font-black text-slate-700">
                Sin valoraciones aún
              </strong>
            )}
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {totalComments} {totalComments === 1 ? "opinión" : "opiniones"}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-7 p-6 sm:p-7">
        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando opiniones...
          </div>
        ) : null}

        {!loading && !authenticated ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="font-bold text-blue-950">
              Inicia sesión para valorar este libro.
            </p>
            <p className="mt-1 text-sm leading-6 text-blue-800">
              Las opiniones se vinculan a una cuenta para evitar comentarios
              duplicados y proteger la comunidad.
            </p>
            <Link
              href={signInUrl}
              className="mt-4 inline-flex rounded-xl bg-[#155eef] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#2b78ff]"
            >
              Iniciar sesión
            </Link>
          </div>
        ) : null}

        {!loading && authenticated ? (
          <form
            onSubmit={submitComment}
            className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-950">Tu valoración</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Puedes actualizarla cuando quieras.
                </p>
              </div>

              <div className="flex items-center gap-1" role="radiogroup">
                {STAR_VALUES.map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`${star} ${star === 1 ? "estrella" : "estrellas"}`}
                    onClick={() => setRating(star)}
                    className="rounded-lg p-1 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <Star
                      className={`h-7 w-7 ${
                        star <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "fill-white text-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-bold text-slate-700">
                Tu comentario
              </span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                minLength={10}
                maxLength={1500}
                required
                rows={5}
                placeholder="¿Qué te pareció el contenido y a qué tipo de lector se lo recomendarías?"
                className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-400">
                {comment.length}/1,500 caracteres
              </span>
              <button
                disabled={saving || comment.trim().length < 10}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#155eef] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Publicando..." : "Publicar o actualizar"}
              </button>
            </div>
          </form>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {success}
          </p>
        ) : null}

        {!loading && comments.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center">
            <MessageCircle className="mx-auto h-9 w-9 text-slate-300" />
            <h3 className="mt-3 font-black text-slate-900">
              Sé el primero en compartir una opinión
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Una reseña honesta ayuda a otros lectores a elegir mejor.
            </p>
          </div>
        ) : null}

        {comments.length > 0 ? (
          <div className="space-y-4">
            {comments.map((item) => (
              <article
                key={item.id}
                className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-slate-950">
                        {item.authorName}
                      </strong>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ReadOnlyStars value={item.rating} />
                      <span className="text-xs text-slate-400">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  {item.canManage ? (
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => void deleteComment(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Eliminar
                    </button>
                  ) : null}
                </div>

                <p className="mt-4 whitespace-pre-line break-words leading-7 text-slate-700">
                  {item.comment}
                </p>
              </article>
            ))}
          </div>
        ) : null}

        {!loading && editorialComments.length > 0 ? (
          <section
            aria-labelledby="comentarios-editoriales-title"
            className="rounded-[24px] border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="rounded-2xl bg-indigo-100 p-2.5 text-indigo-700">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3
                  id="comentarios-editoriales-title"
                  className="font-black text-slate-950"
                >
                  Comentarios editoriales automáticos
                </h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  Estos textos presentan el enfoque del libro. No son reseñas
                  de compradores y no afectan su puntuación pública.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {editorialComments.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-indigo-700">
                      Editorial automático
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {item.displayOrder} de {editorialComments.length}
                    </span>
                  </div>
                  <p className="mt-3 leading-7 text-slate-700">
                    {item.comment}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-slate-400">
                    {item.disclaimer}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}