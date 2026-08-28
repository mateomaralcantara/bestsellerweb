"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DirectEpubUploadBridgeProps = {
  bookId: string;
};

type UploadTicket = {
  ok?: boolean;
  bucket?: string;
  path?: string;
  token?: string;
  error?: string;
};

const MAX_EPUB_SIZE_MB = 100;
const MAX_EPUB_SIZE_BYTES = MAX_EPUB_SIZE_MB * 1024 * 1024;

function isEpubFile(file: File) {
  const mime = file.type || "";
  return (
    file.name.toLowerCase().endsWith(".epub") &&
    (!mime ||
      mime === "application/epub+zip" ||
      mime === "application/octet-stream" ||
      mime === "application/zip" ||
      mime === "application/x-zip-compressed")
  );
}

export default function DirectEpubUploadBridge({
  bookId,
}: DirectEpubUploadBridgeProps) {
  const bypassNextSubmitRef = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);

  useEffect(() => {
    async function interceptSubmit(event: SubmitEvent) {
      if (bypassNextSubmitRef.current) {
        bypassNextSubmitRef.current = false;
        return;
      }

      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const epubInput = form.querySelector<HTMLInputElement>(
        'input[type="file"][name="epub_file"], input[type="file"][name="epub"]'
      );

      const file = epubInput?.files?.[0];
      if (!epubInput || !file) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      setError("");
      setActive(true);

      try {
        if (!isEpubFile(file)) {
          throw new Error("El archivo seleccionado debe ser un EPUB válido.");
        }

        if (file.size > MAX_EPUB_SIZE_BYTES) {
          throw new Error(`El EPUB no debe superar ${MAX_EPUB_SIZE_MB} MB.`);
        }

        setMessage(
          `Preparando carga directa (${(file.size / 1024 / 1024).toFixed(2)} MB)...`
        );

        const ticketResponse = await fetch(
          `/api/books/${encodeURIComponent(bookId)}/epub-upload`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
            }),
          }
        );

        const ticket = (await ticketResponse.json().catch(() => ({}))) as UploadTicket;

        if (
          !ticketResponse.ok ||
          !ticket.bucket ||
          !ticket.path ||
          !ticket.token
        ) {
          throw new Error(ticket.error || "No se pudo preparar la carga del EPUB.");
        }

        setMessage("Subiendo EPUB directamente a Storage. No cierres esta ventana...");

        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(ticket.bucket)
          .uploadToSignedUrl(ticket.path, ticket.token, file, {
            contentType: file.type || "application/epub+zip",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Falló la carga directa: ${uploadError.message}`);
        }

        setMessage("Registrando EPUB nuevo y actualizando preview de 25 páginas...");

        const finalizeResponse = await fetch(
          `/api/books/${encodeURIComponent(bookId)}/epub-upload`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: ticket.path,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
            }),
          }
        );

        const finalized = (await finalizeResponse.json().catch(() => ({}))) as {
          error?: string;
        };

        if (!finalizeResponse.ok) {
          throw new Error(finalized.error || "No se pudo registrar el EPUB subido.");
        }

        // Evita que el PATCH normal vuelva a enviar los ~20-100 MB por Vercel.
        epubInput.value = "";

        const oldPreviewInput = form.querySelector<HTMLInputElement>(
          'input[type="file"][name="preview_epub"]'
        );
        if (oldPreviewInput) {
          oldPreviewInput.value = "";
        }

        bypassNextSubmitRef.current = true;
        setMessage("EPUB cargado. Guardando los demás datos del libro...");

        const submitter = event.submitter;
        if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
          form.requestSubmit(submitter);
        } else {
          form.requestSubmit();
        }
      } catch (uploadFailure) {
        console.error("Carga EPUB directa:", uploadFailure);
        setError(
          uploadFailure instanceof Error
            ? uploadFailure.message
            : "No se pudo subir el EPUB."
        );
        setMessage("");
      } finally {
        setActive(false);
      }
    }

    document.addEventListener("submit", interceptSubmit, true);
    return () => document.removeEventListener("submit", interceptSubmit, true);
  }, [bookId]);

  if (!message && !error) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[120] w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
      {message ? (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <div>
            <p className="font-semibold text-slate-950">Carga EPUB directa</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">{message}</p>
            {active ? (
              <p className="mt-2 text-xs text-slate-400">
                El archivo no está pasando por Vercel, por lo que evita el error 413.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div>
          <p className="font-semibold text-red-700">No se pudo subir el EPUB</p>
          <p className="mt-1 text-sm leading-5 text-red-600">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
