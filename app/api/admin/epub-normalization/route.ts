import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminAccessError, requireAdminApi, writeAdminAudit } from "@/lib/admin/superadmin";
import { normalizeBookEpubById } from "@/lib/epub-normalization-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AssetRow = { book_id: string };
type Body = { limit?: unknown; offset?: unknown; force?: unknown; reason?: unknown };

function asInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

async function fleetSnapshot() {
  const [{ count: epubBooks }, { data: rows, error }] = await Promise.all([
    supabaseAdmin.from("book_assets").select("book_id", { count: "exact", head: true }).eq("asset_type", "epub"),
    supabaseAdmin
      .from("epub_normalizations")
      .select("book_id,status,mode,is_current,report,updated_at")
      .eq("is_current", true)
      .order("updated_at", { ascending: false }),
  ]);

  if (error) {
    return {
      ready: false,
      epubBooks: epubBooks ?? 0,
      normalized: 0,
      skipped: 0,
      errors: 0,
      pending: epubBooks ?? 0,
      rows: [],
      error: error.message,
    };
  }

  const normalized = (rows ?? []).filter((row) => row.status === "normalized").length;
  const skipped = (rows ?? []).filter((row) => row.status === "skipped").length;
  const errors = (rows ?? []).filter((row) => row.status === "error").length;
  const covered = new Set((rows ?? []).map((row) => row.book_id)).size;

  return {
    ready: true,
    epubBooks: epubBooks ?? 0,
    normalized,
    skipped,
    errors,
    pending: Math.max(0, (epubBooks ?? 0) - covered),
    rows: rows ?? [],
    error: null,
  };
}

export async function GET() {
  try {
    await requireAdminApi("books.manage");
    return NextResponse.json({ ok: true, fleet: await fleetSnapshot() });
  } catch (error) {
    const status = error instanceof AdminAccessError ? error.status : 500;
    const message = error instanceof Error ? error.message : "No se pudo cargar el estado del normalizador.";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminApi("books.manage");
    const body = (await request.json().catch(() => ({}))) as Body;
    const limit = asInt(body.limit, 8, 1, 20);
    const offset = asInt(body.offset, 0, 0, 1000000);
    const force = body.force === true;
    const reason = typeof body.reason === "string" && body.reason.trim().length >= 3
      ? body.reason.trim()
      : "Normalización editorial masiva LibroSeller";

    const { data: assets, error: assetError } = await supabaseAdmin
      .from("book_assets")
      .select("book_id")
      .eq("asset_type", "epub")
      .order("book_id", { ascending: true })
      .range(offset, offset + limit - 1)
      .returns<AssetRow[]>();

    if (assetError) throw new Error(assetError.message);

    const uniqueBookIds = Array.from(new Set((assets ?? []).map((row) => row.book_id).filter(Boolean)));
    const results = [] as Array<Record<string, unknown>>;

    for (const bookId of uniqueBookIds) {
      if (!force) {
        const { data: current } = await supabaseAdmin
          .from("epub_normalizations")
          .select("id,status")
          .eq("book_id", bookId)
          .eq("is_current", true)
          .maybeSingle();
        if (current?.status === "normalized" || current?.status === "skipped") {
          results.push({ bookId, status: "already-current" });
          continue;
        }
      }

      const result = await normalizeBookEpubById(bookId);
      results.push({
        bookId,
        status: result.status,
        optimized: result.optimized,
        error: result.error ?? null,
        report: result.report,
      });
    }

    const counts = results.reduce(
      (acc, item) => {
        const status = String(item.status || "");
        if (status === "normalized") acc.normalized += 1;
        else if (status === "skipped") acc.skipped += 1;
        else if (status === "error") acc.errors += 1;
        else if (status === "already-current") acc.alreadyCurrent += 1;
        return acc;
      },
      { normalized: 0, skipped: 0, errors: 0, alreadyCurrent: 0 }
    );

    await writeAdminAudit({
      actor,
      action: "epub.normalization.batch",
      module: "books",
      targetType: "epub_fleet",
      targetId: `offset:${offset}`,
      reason,
      before: null,
      after: { limit, offset, force, processed: results.length, counts },
    });

    return NextResponse.json({
      ok: true,
      batch: { offset, limit, processed: results.length, nextOffset: offset + limit, counts },
      results,
      fleet: await fleetSnapshot(),
    });
  } catch (error) {
    const status = error instanceof AdminAccessError ? error.status : 500;
    const message = error instanceof Error ? error.message : "No se pudo ejecutar la normalización masiva.";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
