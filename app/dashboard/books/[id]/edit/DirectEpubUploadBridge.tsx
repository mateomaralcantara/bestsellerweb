"use client";

import { useEffect, useState } from "react";
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

type JsonPayload = Record<string, unknown> & {
  error?: string;
  message?: string;
};

const MAX_EPUB_SIZE_MB = 100;
const MAX_EPUB_SIZE_BYTES = MAX_EPUB_SIZE_MB * 1024 * 1024;
const EPUB_FIELDS = new Set(["epub_file", "epub", "preview_epub"]);

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

function getFile(formData: FormData, keys: string[]) {
  for (const key of keys) {
    const value = formData.get(key);
    if (value instanceof File && value.size > 0) return value;
  }

  return null;
}

function cloneWithoutEpubFiles(formData: FormData) {
  const clean = new FormData();

  for (const [key, value] of formData.entries()) {
    if (EPUB_FIELDS.has(key)) continue;
    clean.append(key, value);
  }

  return clean;
}

function getRequestUrl(input: Parameters<typeof window.fetch>[0]) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getRequestMethod(
  input: Parameters<typeof window.fetch>[0],
  init?: Parameters<typeof window.fetch>[1]
) {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function jsonResponse(status: number, payload: JsonPayload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function readJson(response: Response): Promise<JsonPayload> {
  return (await response.clone().json().catch(() => ({}))) as JsonPayload;
}

export default function DirectEpubUploadBridge({
  bookId,
}: DirectEpubUploadBridgeProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);

  useEffect(() => {
    const previousFetch = window.fetch;
    const originalFetch = previousFetch.bind(window);
    const targetPath = `/api/books/${encodeURIComponent(bookId)}`;

    async function uploadEpubDirect(file: File) {
      setMessage(
        `Preparando EPUB (${(file.size / 1024 / 1024).toFixed(2)} MB)...`
      );

      const ticketResponse = await originalFetch(`${targetPath}/epub-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

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
        });

      if (uploadError) {
        throw new Error(`Falló la carga directa: ${uploadError.message}`);
      }

      setMessage("Registrando el EPUB nuevo y regenerando su preview...");

      const finalizeResponse = await originalFetch(`${targetPath}/epub-upload`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: ticket.path,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

      const finalized = (await finalizeResponse.json().catch(() => ({}))) as JsonPayload;

      if (!finalizeResponse.ok) {
        throw new Error(finalized.error || "No se pudo registrar el EPUB subido.");
      }

      return finalized;
    }

    const patchedFetch: typeof window.fetch = async (input, init) => {
      const method = getRequestMethod(input, init);
      const requestUrl = new URL(getRequestUrl(input), window.location.origin);
      const isBookPatch = method === "PATCH" && requestUrl.pathname === targetPath;
      const body = init?.body;

      if (!isBookPatch || !(body instanceof FormData)) {
        return originalFetch(input, init);
      }

      const fullEpub = getFile(body, ["epub_file", "epub"]);
      const previewEpub = getFile(body, ["preview_epub"]);

      if (fullEpub) {
        if (!isEpubFile(fullEpub)) {
          return jsonResponse(400, {
            ok: false,
            error: "El archivo seleccionado debe ser un EPUB válido.",
          });
        }

        if (fullEpub.size > MAX_EPUB_SIZE_BYTES) {
          return jsonResponse(413, {
            ok: false,
            error: `El EPUB no debe superar ${MAX_EPUB_SIZE_MB} MB.`,
          });
        }
      }

      const metadataBody = cloneWithoutEpubFiles(body);
      const requestedStatus = String(metadataBody.get("status") ?? "").trim();
      const forceEditorialReview = Boolean(fullEpub && requestedStatus === "published");

      // Un EPUB nuevo debe quedar en revisión hasta pasar Quality Gate.
      // Esto evita que el segundo paso de guardado choque contra el publication gate.
      if (forceEditorialReview) {
        metadataBody.set("status", "under_review");
      }

      setError("");
      setActive(Boolean(fullEpub));
      if (fullEpub) {
        setMessage("Guardando primero los datos del libro...");
      }

      try {
        // La API de metadatos recibe un cuerpo liviano: ningún EPUB pasa por Vercel.
        const metadataResponse = await originalFetch(input, {
          ...init,
          body: metadataBody,
        });

        if (!metadataResponse.ok) {
          setMessage("");
          return metadataResponse;
        }

        const metadataPayload = await readJson(metadataResponse);

        if (!fullEpub) {
          if (!previewEpub) {
            return metadataResponse;
          }

          // El preview ya se deriva automáticamente del EPUB completo actual.
          return jsonResponse(metadataResponse.status, {
            ...metadataPayload,
            ok: true,
            message:
              "Datos del libro guardados. La muestra se genera automáticamente desde el EPUB completo actual.",
          });
        }

        await uploadEpubDirect(fullEpub);

        if (forceEditorialReview) {
          const statusSelect = document.querySelector<HTMLSelectElement>(
            'form select[name="status"]'
          );
          if (statusSelect) statusSelect.value = "under_review";
        }

        setMessage("");

        return jsonResponse(200, {
          ...metadataPayload,
          ok: true,
          message:
            "Libro guardado correctamente. EPUB actualizado directamente en Storage y preview renovado.",
        });
      } catch (saveFailure) {
        const saveError =
          saveFailure instanceof Error
            ? saveFailure.message
            : "No se pudo completar la actualización del EPUB.";

        console.error("Guardado directo del libro:", saveFailure);
        setError(saveError);
        setMessage("");

        return jsonResponse(502, {
          ok: false,
          error: `Los datos del libro sí se guardaron, pero no se pudo completar el EPUB: ${saveError}`,
        });
      } finally {
        setActive(false);
      }
    };

    window.fetch = patchedFetch;

    return () => {
      if (window.fetch === patchedFetch) {
        window.fetch = previousFetch;
      }
    };
  }, [bookId]);

  if (!message && !error) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[120] w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
      {message ? (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <div>
            <p className="font-semibold text-slate-950">Guardando libro</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">{message}</p>
            {active ? (
              <p className="mt-2 text-xs text-slate-400">
                El EPUB se sube directo a Storage y no atraviesa el límite de cuerpo de Vercel.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div>
          <p className="font-semibold text-red-700">El EPUB necesita atención</p>
          <p className="mt-1 text-sm leading-5 text-red-600">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
