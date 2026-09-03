"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import NewBookForm from "./NewBookForm";

const MAX_COVER_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_EPUB_SIZE_BYTES = 100 * 1024 * 1024;
const DRAFT_KEY = "dashboard:new-book:draft:v4";

type TicketResponse = {
  ok?: boolean;
  error?: string;
  bucket?: string;
  path?: string;
  token?: string;
};

type CreateResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  view_url?: string;
  book?: {
    id?: string | number;
    slug?: string;
  };
};

function realFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

function validCover(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "webp"].includes(ext);
}

function validEpub(file: File) {
  return file.name.toLowerCase().endsWith(".epub");
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

async function getUploadTicket(params: {
  bookId: string;
  kind: "cover" | "epub";
  file: File;
}) {
  const response = await fetch(
    `/api/books/${encodeURIComponent(params.bookId)}/${params.kind}-upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: params.file.name,
        fileSize: params.file.size,
        mimeType: params.file.type || "application/octet-stream",
      }),
    }
  );

  const data = await readJson<TicketResponse>(response);
  if (!response.ok || !data.bucket || !data.path || !data.token) {
    throw new Error(data.error || `No se pudo preparar la carga de ${params.kind}.`);
  }

  return {
    bucket: data.bucket,
    path: data.path,
    token: data.token,
  };
}

async function finalizeUpload(params: {
  bookId: string;
  kind: "cover" | "epub";
  file: File;
  path: string;
}) {
  const response = await fetch(
    `/api/books/${encodeURIComponent(params.bookId)}/${params.kind}-upload`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: params.path,
        fileName: params.file.name,
        fileSize: params.file.size,
        mimeType: params.file.type || "application/octet-stream",
      }),
    }
  );

  const data = await readJson<{ error?: string }>(response);
  if (!response.ok) {
    throw new Error(data.error || `No se pudo registrar ${params.kind}.`);
  }
}

async function directUpload(params: {
  bookId: string;
  kind: "cover" | "epub";
  file: File;
}) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const ticket = await getUploadTicket(params);
      const supabase = createClient();
      const contentType =
        params.file.type ||
        (params.kind === "epub" ? "application/epub+zip" : "application/octet-stream");

      const { error } = await supabase.storage
        .from(ticket.bucket)
        .uploadToSignedUrl(ticket.path, ticket.token, params.file, {
          contentType,
          upsert: false,
        });

      if (error) throw new Error(error.message);

      await finalizeUpload({
        ...params,
        path: ticket.path,
      });

      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`No se pudo subir ${params.kind}.`);
}

export default function NewBookDirectUpload() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const applyDirectUploadUi = () => {
      const previewInput = root.querySelector<HTMLInputElement>('input[name="preview_epub"]');
      if (previewInput) {
        previewInput.required = false;
        previewInput.disabled = true;
      }

      const headings = Array.from(root.querySelectorAll("h2"));
      const previewHeading = headings.find(
        (node) => node.textContent?.trim() === "Vista previa EPUB"
      );
      if (previewHeading) {
        previewHeading.textContent = "Vista previa automática";
        const section = previewHeading.closest("section");
        if (section) {
          const info = section.querySelector("div.mt-4");
          if (info) {
            info.textContent =
              "No necesitas subir un segundo EPUB. LibroSeller genera automáticamente la muestra protegida desde el EPUB completo actual.";
          }
        }
      }

      for (const paragraph of Array.from(root.querySelectorAll("p"))) {
        const text = paragraph.textContent || "";
        if (text.includes("sube la portada, el EPUB completo y el EPUB de muestra")) {
          paragraph.textContent =
            "Crea la ficha y sube una portada y un único EPUB completo. LibroSeller deriva automáticamente la muestra protegida desde ese EPUB.";
        }
        if (text.includes("Un EPUB para muestra y otro EPUB privado")) {
          paragraph.textContent =
            "Un único EPUB privado; la muestra se genera automáticamente para el catálogo.";
        }
        if (text.includes("Arquitectura EPUB nativa: un archivo completo privado")) {
          paragraph.textContent =
            "Arquitectura EPUB nativa: subes un solo EPUB completo. La carga va directamente a Storage y la muestra se deriva automáticamente sin duplicar archivos.";
        }
      }
    };

    applyDirectUploadUi();
    const observer = new MutationObserver(applyDirectUploadUi);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  async function handleSubmitCapture(event: FormEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLFormElement)) return;

    event.preventDefault();
    event.stopPropagation();
    if (busy) return;

    const form = target;
    const previewInput = form.querySelector<HTMLInputElement>('input[name="preview_epub"]');
    if (previewInput) {
      previewInput.required = false;
      previewInput.disabled = true;
    }

    if (!form.reportValidity()) return;

    const fullData = new FormData(form);
    const cover = fullData.get("cover");
    const epub = fullData.get("epub_file");

    if (!realFile(cover)) {
      setErrorMessage("La portada es obligatoria.");
      return;
    }
    if (!validCover(cover)) {
      setErrorMessage("La portada debe ser JPG, PNG o WebP.");
      return;
    }
    if (cover.size > MAX_COVER_SIZE_BYTES) {
      setErrorMessage("La portada no debe superar 10 MB.");
      return;
    }
    if (!realFile(epub)) {
      setErrorMessage("El EPUB completo es obligatorio.");
      return;
    }
    if (!validEpub(epub)) {
      setErrorMessage("El libro debe ser un archivo .epub válido.");
      return;
    }
    if (epub.size > MAX_EPUB_SIZE_BYTES) {
      setErrorMessage("El EPUB no debe superar 100 MB.");
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      setMessage("Creando la ficha del libro…");

      const metadata = new FormData(form);
      metadata.delete("cover");
      metadata.delete("epub_file");
      metadata.delete("book_file");
      metadata.delete("preview_epub");
      metadata.set("preview_mode", "epub_preview");
      metadata.set("preview_page_count", "25");
      metadata.set("preview_include_cover", "false");
      metadata.set("preview_layout", "epub_reader");
      metadata.set("preview_progress_enabled", "true");

      const createResponse = await fetch("/api/books/create-epub", {
        method: "POST",
        body: metadata,
      });
      const created = await readJson<CreateResponse>(createResponse);

      if (!createResponse.ok || !created.book?.id) {
        throw new Error(created.error || "No se pudo crear el libro.");
      }

      const bookId = String(created.book.id);

      setMessage("Subiendo portada directamente a Storage…");
      await directUpload({ bookId, kind: "cover", file: cover });

      setMessage(
        `Subiendo EPUB directamente a Storage (${(epub.size / 1024 / 1024).toFixed(1)} MB)…`
      );
      await directUpload({ bookId, kind: "epub", file: epub });

      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // No impide completar la publicación.
      }

      setMessage("Libro creado. Vista previa automática preparada.");
      router.push(created.view_url || `/dashboard/books/${encodeURIComponent(bookId)}/edit`);
      router.refresh();
    } catch (error) {
      console.error("Error creando EPUB con carga directa:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear el libro."
      );
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={rootRef}
      data-direct-epub-create
      onSubmitCapture={handleSubmitCapture}
      className="relative"
    >
      <style jsx global>{`
        [data-direct-epub-create] label:has(input[name="preview_epub"]) {
          display: none !important;
        }
        @media (min-width: 768px) {
          [data-direct-epub-create] section:has(input[name="preview_epub"]) > div.grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>

      <NewBookForm />

      {errorMessage ? (
        <div className="fixed bottom-5 left-1/2 z-[100] w-[min(92vw,680px)] -translate-x-1/2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-2xl">
          {errorMessage}
        </div>
      ) : null}

      {busy ? (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/65 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white p-7 text-center shadow-2xl">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />
            <p className="mt-4 text-base font-black text-slate-950">Publicando EPUB</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
            <p className="mt-3 text-xs text-slate-400">
              El archivo grande no pasa por Vercel; se carga directamente a Supabase Storage.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
