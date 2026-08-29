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

type Body = { limit?: unknown; offset?: unknown };

function safeInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminApi("*");
    const body = (await request.json().catch(() => ({}))) as Body;
    const limit = safeInteger(body.limit, 5, 1, 10);
    const offset = safeInteger(body.offset, 0, 0, 100000);

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

    const results = [];
    for (const bookId of bookIds) {
      results.push(await normalizeBookEpubById(bookId));
    }

    await writeAdminAudit({
      actor,
      action: "epub.normalization.batch",
      module: "books",
      targetType: "book_batch",
      reason: "Normalización canónica fixed-layout de plataforma.",
      after: {
        offset,
        limit,
        processed: results.length,
        normalized: results.filter((item) => item.status === "normalized").length,
        skipped: results.filter((item) => item.status === "skipped").length,
        errors: results.filter((item) => item.status === "error").length,
      },
    });

    return NextResponse.json({
      ok: true,
      offset,
      limit,
      processed: results.length,
      nextOffset: assets?.length === limit ? offset + limit : null,
      results,
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/admin/epub-normalize:", error);
    return NextResponse.json({ error: "No se pudo ejecutar la normalización masiva." }, { status: 500 });
  }
}
