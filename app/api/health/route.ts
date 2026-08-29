import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  const checks: Record<string, { ok: boolean; latencyMs?: number; detail?: string }> = {};

  const dbStarted = performance.now();
  const { error: dbError } = await supabaseAdmin
    .from("books")
    .select("id", { count: "exact", head: true })
    .limit(1);
  checks.database = {
    ok: !dbError,
    latencyMs: Math.round(performance.now() - dbStarted),
    ...(dbError ? { detail: "Database query failed" } : {}),
  };

  const marketplaceStarted = performance.now();
  const { error: marketplaceError } = await supabaseAdmin
    .from("book_verified_metrics")
    .select("book_id", { count: "exact", head: true })
    .limit(1);
  checks.marketplace9x = {
    ok: !marketplaceError,
    latencyMs: Math.round(performance.now() - marketplaceStarted),
    ...(marketplaceError ? { detail: "Marketplace 9.x migration not ready" } : {}),
  };

  const criticalOk = checks.database.ok;
  const body = {
    status: criticalOk ? (checks.marketplace9x.ok ? "healthy" : "degraded") : "unhealthy",
    service: "libroseller-web",
    timestamp: new Date().toISOString(),
    latencyMs: Math.round(performance.now() - startedAt),
    checks,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
  };

  return NextResponse.json(body, {
    status: criticalOk ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
