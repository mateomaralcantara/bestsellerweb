import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 12, 50));
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (auth.user) {
    const { data, error } = await supabaseAdmin.rpc("recommend_marketplace_books", {
      p_user_id: auth.user.id,
      p_limit: limit,
    });

    if (!error) {
      return NextResponse.json({ personalized: true, recommendations: data ?? [] });
    }

    console.warn("RECOMMENDATIONS RPC:", error.message);
  }

  const { data, error } = await supabaseAdmin
    .from("book_bestseller_scores")
    .select("book_id, bestseller_score")
    .order("bestseller_score", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ personalized: false, recommendations: [] });
  }

  const scores = data ?? [];
  const ids = scores.map((item) => item.book_id).filter(Boolean);
  if (!ids.length) {
    return NextResponse.json({ personalized: false, recommendations: [] });
  }

  const { data: books } = await supabaseAdmin
    .from("books")
    .select("id, slug, title, cover_url")
    .in("id", ids)
    .eq("status", "published");

  const scoreMap = new Map(scores.map((item) => [item.book_id, Number(item.bestseller_score) || 0]));
  const recommendations = (books ?? [])
    .map((book) => ({
      book_id: book.id,
      slug: book.slug,
      title: book.title,
      cover_url: book.cover_url,
      reason: "Tendencia en LibroSeller",
      score: scoreMap.get(book.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ personalized: false, recommendations });
}
