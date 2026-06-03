// components/dashboard/ManuscriptUploader.tsx
"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase-browser";

type Props = {
  bookId: string;
  slug: string;
};

export default function ManuscriptUploader({ bookId, slug }: Props) {
  const supabase = createBrowserSupabase();

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleUpload() {
    setMessage("");
    setError("");

    if (!file) {
      setError("Selecciona un archivo primero.");
      return;
    }

    setBusy(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const cleanSlug = slug.trim().toLowerCase();
      const storagePath = `manuscripts/${cleanSlug}.${ext}`;
      const bucket = "book-files";

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) {
        throw new Error(`Error subiendo a Storage: ${uploadError.message}`);
      }

      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);

      const assetType =
        ext === "pdf"
          ? "manuscript"
          : ext === "epub"
          ? "epub"
          : "manuscript";

      const payload = {
        book_id: bookId,
        asset_type: assetType,
        storage_bucket: bucket,
        storage_path: storagePath,
        file_url: publicData.publicUrl,
        mime_type: file.type || null,
        is_public: true,
        sort_order: 0,
      };

      const { data: existing, error: existingError } = await supabase
        .from("book_assets")
        .select("id")
        .eq("book_id", bookId)
        .eq("asset_type", "manuscript")
        .maybeSingle();

      if (existingError) {
        throw new Error(`Error buscando asset existente: ${existingError.message}`);
      }

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("book_assets")
          .update(payload)
          .eq("id", existing.id);

        if (updateError) {
          throw new Error(`Error actualizando book_assets: ${updateError.message}`);
        }
      } else {
        const { error: insertError } = await supabase
          .from("book_assets")
          .insert(payload);

        if (insertError) {
          throw new Error(`Error insertando book_assets: ${insertError.message}`);
        }
      }

      setMessage("Manuscrito subido y registrado correctamente.");
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Subir manuscrito</h3>
        <p className="text-sm opacity-70">
          Sube el archivo al bucket <strong>book-files</strong> y guarda su
          registro en <strong>book_assets</strong>.
        </p>
      </div>

      <input
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          const nextFile = e.target.files?.[0] || null;
          setFile(nextFile);
          setError("");
          setMessage("");
        }}
      />

      {file && (
        <div className="text-sm rounded-xl border p-3">
          <p><strong>Archivo:</strong> {file.name}</p>
          <p><strong>Tipo:</strong> {file.type || "desconocido"}</p>
          <p><strong>Tamaño:</strong> {file.size.toLocaleString()} bytes</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleUpload}
        disabled={busy || !file}
        className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Subiendo..." : "Subir manuscrito"}
      </button>

      {message ? (
        <div className="rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
