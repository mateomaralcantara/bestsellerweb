import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeBookEpubById } from "@/lib/epub-normalization-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "LS-FXL-20260829-P7m9N4x2Q8v6";

function safeInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== KEY) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const offset = safeInt(url.searchParams.get("offset"), 0);
  const limit = Math.min(2, Math.max(1, safeInt(url.searchParams.get("limit"), 2)));

  const { error: tableError } = await supabaseAdmin
    .from("epub_normalizations")
    .select("id", { count: "exact", head: true });

  if (tableError) {
    return NextResponse.json({ ok: false, stage: "migration", error: tableError.message }, { status: 503 });
  }

  const { data: assets, error } = await supabaseAdmin
    .from("book_assets")
    .select("book_id")
    .eq("asset_type", "epub")
    .order("book_id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ ok: false, stage: "assets", error: error.message }, { status: 500 });
  }

  const bookIds = Array.from(new Set((assets ?? []).map((row) => String(row.book_id || "")).filter(Boolean)));
  const results = [];
  for (const bookId of bookIds) {
    results.push(await normalizeBookEpubById(bookId));
  }

  const nextOffset = (assets?.length ?? 0) === limit ? offset + limit : null;
  return NextResponse.json({
    ok: true,
    offset,
    limit,
    processed: results.length,
    nextOffset,
    results,
  }, { headers: { "Cache-Control": "no-store" } });
}
