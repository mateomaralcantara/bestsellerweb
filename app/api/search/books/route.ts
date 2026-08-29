import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim().slice(0, 200);
  const category = (url.searchParams.get("category") || "").trim().slice(0, 160);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 24, 100));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const { data, error } = await supabaseAdmin.rpc("search_marketplace_books", {
    p_query: query,
    p_category: category || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error("SEARCH 2.0:", error.message);
    return NextResponse.json(
      { error: "El motor de búsqueda 2.0 aún no está disponible." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    query,
    category: category || null,
    results: data ?? [],
    pagination: { limit, offset },
  });
}
