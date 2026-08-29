import { NextResponse } from "next/server";
import { POST as createBookLegacy } from "../route";
import { analyzeEpubFile } from "@/lib/epub-preflight";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fileFrom(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function POST(request: Request) {
  try {
    const inspectionRequest = request.clone();
    const formData = await inspectionRequest.formData();
    const fullEpub = fileFrom(formData, "epub_file") || fileFrom(formData, "book_file");
    const previewEpub = fileFrom(formData, "preview_epub");

    if (!fullEpub) {
      return NextResponse.json({ error: "El EPUB completo es obligatorio." }, { status: 400 });
    }

    const [preflight, previewPreflight] = await Promise.all([
      analyzeEpubFile(fullEpub),
      previewEpub ? analyzeEpubFile(previewEpub) : Promise.resolve(null),
    ]);

    if (preflight.status === "fail" || preflight.score < 60) {
      return NextResponse.json(
        {
          error: `El EPUB no supera el preflight editorial (${preflight.score}/100). Corrige los errores críticos antes de publicarlo.`,
          preflight,
          previewPreflight,
        },
        { status: 422 }
      );
    }

    const legacyResponse = await createBookLegacy(request);
    if (!legacyResponse.ok) return legacyResponse;

    let payload: Record<string, unknown> = {};
    try {
      payload = (await legacyResponse.clone().json()) as Record<string, unknown>;
    } catch {
      return legacyResponse;
    }

    const book = payload.book as { id?: string | number } | undefined;
    const edition = payload.edition as { id?: string | number } | undefined;
    const bookId = book?.id ? String(book.id) : "";
    const editionId = edition?.id ? String(edition.id) : null;

    let persisted = false;
    let preflightReportId: string | null = null;

    if (bookId) {
      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();

      const { data: report, error: reportError } = await supabaseAdmin
        .from("epub_preflight_reports")
        .insert({
          book_id: bookId,
          edition_id: editionId,
          source_sha256: preflight.checksumSha256,
          epub_version: preflight.epubVersion,
          layout: preflight.layout,
          score: preflight.score,
          status: preflight.status,
          summary: preflight.summary,
          findings: preflight.findings,
          created_by: auth.user?.id ?? null,
        })
        .select("id")
        .maybeSingle();

      if (!reportError && report?.id) {
        persisted = true;
        preflightReportId = String(report.id);

        const { data: latest } = await supabaseAdmin
          .from("book_editorial_versions")
          .select("version_number")
          .eq("book_id", bookId)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const versionNumber = Math.max(1, Number(latest?.version_number || 0) + 1);
        await supabaseAdmin.from("book_editorial_versions").insert({
          book_id: bookId,
          edition_id: editionId,
          version_number: versionNumber,
          checksum_sha256: preflight.checksumSha256,
          change_notes: "Versión inicial validada automáticamente por LibroSeller EPUB Preflight.",
          preflight_report_id: preflightReportId,
          is_current: true,
          created_by: auth.user?.id ?? null,
        });
      } else if (reportError) {
        console.warn("PREFLIGHT persistence unavailable:", reportError.message);
      }
    }

    return NextResponse.json(
      {
        ...payload,
        preflight: {
          ...preflight,
          persisted,
          reportId: preflightReportId,
          publicationGate: preflight.score >= 85 ? "ready" : "editorial_review",
        },
        previewPreflight,
      },
      { status: legacyResponse.status }
    );
  } catch (error) {
    console.error("POST /api/books/create-9x:", error);
    return NextResponse.json(
      { error: "No se pudo ejecutar el preflight del EPUB." },
      { status: 500 }
    );
  }
}
