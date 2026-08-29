import { NextResponse } from "next/server";
import {
  AdminAccessError,
  requireAdminApi,
  writeAdminAudit,
} from "@/lib/admin/superadmin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeBookEpubById } from "@/lib/epub-normalization-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { limit?: unknown; offset?: unknown; force?: unknown; reason?: unknown };

type FleetRow = {
  book_id: string;
  status: string;
  mode: string;
  is_current: boolean;
  updated_at: string | null;
  report: Record<string, unknown> | null;
};

function safeInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function fleetSnapshot() {
  const [{ count: epubAssets, error: assetError }, { data: rows, error: normalizationError }] = await Promise.all([
    supabaseAdmin
      .from("book_assets")
      .select("book_id", { count: "exact", head: true })
      .eq("asset_type", "epub"),
    supabaseAdmin
      .from("epub_normalizations")
      .select("book_id,status,mode,is_current,updated_at,report")
      .eq("is_current", true)
      .order("updated_at", { ascending: false })
      .returns<FleetRow[]>(),
  ]);

  if (assetError) throw new Error(assetError.message);

  if (normalizationError) {
    return {
      ready: false,
      epubBooks: epubAssets ?? 0,
      normalized: 0,
      skipped: 0,
      errors: 0,
      pending: epubAssets ?? 0,
      error: normalizationError.message,
      recent: [],
    };
  }

  const currentRows = rows ?? [];
  const covered = new Set(currentRows.map((row) => row.book_id)).size;

  return {
    ready: true,
    epubBooks: epubAssets ?? 0,
    normalized: currentRows.filter((row) => row.status === "normalized").length,
    skipped: currentRows.filter((row) => row.status === "skipped").length,
    errors: currentRows.filter((row) => row.status === "error").length,
    pending: Math.max(0, (epubAssets ?? 0) - covered),
    error: null,
    recent: currentRows.slice(0, 20),
  };
}

export async function GET() {
  try {
    await requireAdminApi("*");
    return NextResponse.json({ ok: true, fleet: await fleetSnapshot() });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "No se pudo cargar el estado del normalizador.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminApi("*");
    const body = (await request.json().catch(() => ({}))) as Body;
    const limit = safeInteger(body.limit, 8, 1, 20);
    const offset = safeInteger(body.offset, 0, 0, 1000000);
    const force = body.force === true;
    const reason =
      typeof body.reason === "string" && body.reason.trim().length >= 3
        ? body.reason.trim()
        : force
          ? "Re-normalización canónica fixed-layout de plataforma."
          : "Backfill canónico fixed-layout de plataforma.";

    const { data: assets, error } = await supabaseAdmin
      .from("book_assets")
      .select("book_id")
      .eq("asset_type", "epub")
      .order("book_id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const bookIds = Array.from(
      new Set((assets ?? []).map((row) => String(row.book_id || "")).filter(Boolean))
    );

    const results: Array<Record<string, unknown>> = [];
    for (const bookId of bookIds) {
      if (!force) {
        const { data: current } = await supabaseAdmin
          .from("epub_normalizations")
          .select("id,status,source_sha256")
          .eq("book_id", bookId)
          .eq("is_current", true)
          .maybeSingle();

        if (current?.status === "normalized" || current?.status === "skipped") {
          results.push({ bookId, status: "already-current", optimized: current.status === "normalized" });
          continue;
        }
      }

      const result = await normalizeBookEpubById(bookId);
      results.push(result);
    }

    const counts = {
      normalized: results.filter((item) => item.status === "normalized").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      errors: results.filter((item) => item.status === "error").length,
      alreadyCurrent: results.filter((item) => item.status === "already-current").length,
    };

    await writeAdminAudit({
      actor,
      action: "epub.normalization.batch",
      module: "books",
      targetType: "book_batch",
      reason,
      after: {
        offset,
        limit,
        force,
        processed: results.length,
        ...counts,
      },
    });

    return NextResponse.json({
      ok: true,
      offset,
      limit,
      processed: results.length,
      nextOffset: assets?.length === limit ? offset + limit : null,
      counts,
      results,
      fleet: await fleetSnapshot(),
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("POST /api/admin/epub-normalize:", error);
    const message = error instanceof Error ? error.message : "No se pudo ejecutar la normalización masiva.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
