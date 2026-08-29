import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  normalizeFixedLayoutEpub,
  type FixedLayoutNormalizationReport,
} from "@/lib/fixed-layout-normalizer";

const FILE_BUCKET = "book-files";

type SourceAsset = {
  id: string;
  storage_bucket: string | null;
  storage_path: string | null;
  edition_id: string | null;
};

export type BookNormalizationResult = {
  bookId: string;
  sourceAssetId: string;
  status: "normalized" | "skipped" | "error";
  optimized: boolean;
  storagePath: string | null;
  report: FixedLayoutNormalizationReport | null;
  error?: string;
};

async function getSourceAsset(bookId: string) {
  const { data, error } = await supabaseAdmin
    .from("book_assets")
    .select("id, storage_bucket, storage_path, edition_id")
    .eq("book_id", bookId)
    .eq("asset_type", "epub")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<SourceAsset>();

  if (error) throw new Error(`No se pudo cargar el EPUB fuente: ${error.message}`);
  if (!data?.storage_bucket || !data.storage_path) {
    throw new Error("El libro no tiene un EPUB fuente privado disponible.");
  }
  return data;
}

async function clearCurrent(bookId: string) {
  const { error } = await supabaseAdmin
    .from("epub_normalizations")
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq("book_id", bookId)
    .eq("is_current", true);
  if (error) throw new Error(`No se pudo cerrar la normalización anterior: ${error.message}`);
}

export async function normalizeBookEpubById(bookId: string): Promise<BookNormalizationResult> {
  let source: SourceAsset | null = null;
  try {
    source = await getSourceAsset(bookId);
    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from(source.storage_bucket!)
      .download(source.storage_path!);

    if (downloadError || !blob) {
      throw new Error(downloadError?.message || "No se pudo descargar el EPUB fuente.");
    }

    const result = await normalizeFixedLayoutEpub(await blob.arrayBuffer());
    const now = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from("epub_normalizations")
      .select("id, status, storage_bucket, storage_path, normalized_sha256")
      .eq("book_id", bookId)
      .eq("source_sha256", result.report.sourceSha256)
      .maybeSingle();

    if (
      existing?.status === "normalized" &&
      existing.storage_bucket &&
      existing.storage_path &&
      existing.normalized_sha256 === result.report.normalizedSha256
    ) {
      await clearCurrent(bookId);
      await supabaseAdmin
        .from("epub_normalizations")
        .update({ is_current: true, updated_at: now })
        .eq("id", existing.id);
      return {
        bookId,
        sourceAssetId: source.id,
        status: "normalized",
        optimized: true,
        storagePath: existing.storage_path,
        report: result.report,
      };
    }

    await clearCurrent(bookId);

    if (!result.output || result.report.status === "skipped") {
      const payload = {
        book_id: bookId,
        source_asset_id: source.id,
        source_sha256: result.report.sourceSha256,
        normalized_sha256: null,
        storage_bucket: null,
        storage_path: null,
        status: "skipped",
        mode: "original",
        report: result.report,
        is_current: true,
        updated_at: now,
      };

      const { error } = await supabaseAdmin
        .from("epub_normalizations")
        .upsert(payload, { onConflict: "book_id,source_sha256" });
      if (error) throw new Error(`No se pudo guardar el resultado de normalización: ${error.message}`);

      return {
        bookId,
        sourceAssetId: source.id,
        status: "skipped",
        optimized: false,
        storagePath: null,
        report: result.report,
      };
    }

    const optimizedPath = `books/${bookId}/optimized/${result.report.sourceSha256.slice(0, 20)}-libroseller.epub`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(FILE_BUCKET)
      .upload(optimizedPath, result.output, {
        contentType: "application/epub+zip",
        upsert: true,
        cacheControl: "3600",
      });
    if (uploadError) throw new Error(`No se pudo guardar el EPUB optimizado: ${uploadError.message}`);

    const payload = {
      book_id: bookId,
      source_asset_id: source.id,
      source_sha256: result.report.sourceSha256,
      normalized_sha256: result.report.normalizedSha256,
      storage_bucket: FILE_BUCKET,
      storage_path: optimizedPath,
      status: "normalized",
      mode: "canonical-fixed-image",
      report: result.report,
      is_current: true,
      updated_at: now,
    };

    const { error: storeError } = await supabaseAdmin
      .from("epub_normalizations")
      .upsert(payload, { onConflict: "book_id,source_sha256" });
    if (storeError) throw new Error(`No se pudo registrar el EPUB optimizado: ${storeError.message}`);

    return {
      bookId,
      sourceAssetId: source.id,
      status: "normalized",
      optimized: true,
      storagePath: optimizedPath,
      report: result.report,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido normalizando EPUB.";
    if (source?.id) {
      try {
        await supabaseAdmin.from("epub_normalizations").insert({
          book_id: bookId,
          source_asset_id: source.id,
          source_sha256: `error:${source.id}:${Date.now()}`,
          status: "error",
          mode: "original",
          report: { error: message },
          is_current: false,
        });
      } catch {
        // La normalización nunca debe romper la carga original por un error de auditoría.
      }
    }
    return {
      bookId,
      sourceAssetId: source?.id || "",
      status: "error",
      optimized: false,
      storagePath: null,
      report: null,
      error: message,
    };
  }
}

export async function getCurrentBookNormalization(bookId: string) {
  const { data, error } = await supabaseAdmin
    .from("epub_normalizations")
    .select("id, status, mode, source_sha256, normalized_sha256, storage_bucket, storage_path, report, created_at, updated_at")
    .eq("book_id", bookId)
    .eq("is_current", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}
