import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function hasValidSecret(request: Request) {
  const expected = process.env.HEALTHCHECK_SECRET?.trim() || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

  if (!expected || !supplied) return false;

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

function validHttpsUrl(value: string | undefined) {
  try {
    return new URL(value || "").protocol === "https:";
  } catch {
    return false;
  }
}

async function checkSupabasePublicKey() {
  const startedAt = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "";

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: {
        apikey: publishableKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    await response.body?.cancel().catch(() => undefined);

    return { ok: response.ok, latencyMs: Date.now() - startedAt };
  } catch {
    return { ok: false, latencyMs: Date.now() - startedAt };
  }
}

async function checkPayPalCredentials() {
  const startedAt = Date.now();
  const environment = process.env.PAYPAL_ENV?.trim().toLowerCase();
  const baseUrl =
    environment === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim() || "";
  const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  try {
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authorization}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    await response.body?.cancel().catch(() => undefined);

    return {
      ok: response.ok,
      environment: environment === "live" ? "live" : "sandbox",
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      ok: false,
      environment: environment === "live" ? "live" : "sandbox",
      latencyMs: Date.now() - startedAt,
    };
  }
}

async function checkDatabase() {
  const startedAt = Date.now();
  const { error } = await supabaseAdmin
    .from("books")
    .select("id", { count: "exact", head: true })
    .limit(1);

  return { ok: !error, latencyMs: Date.now() - startedAt };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const base = {
    ok: true,
    service: "bestsellerweb",
    timestamp: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || null,
  };

  if (!deep) return noStore(base);

  if (!hasValidSecret(request)) {
    return noStore({ ok: false, error: "No autorizado." }, 401);
  }

  const requiredEnvironment = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_WEBHOOK_ID",
    "PAYPAL_ENV",
    "PAYPAL_DEFAULT_CURRENCY",
    "NEXT_PUBLIC_SITE_URL",
    "RATE_LIMIT_SECRET",
    "HEALTHCHECK_SECRET",
  ];
  const missingEnvironment = requiredEnvironment.filter(
    (name) => !process.env[name]?.trim()
  );
  const invalidEnvironment = [
    ...(validHttpsUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
      ? []
      : ["NEXT_PUBLIC_SUPABASE_URL"]),
    ...(validHttpsUrl(process.env.NEXT_PUBLIC_SITE_URL)
      ? []
      : ["NEXT_PUBLIC_SITE_URL"]),
    ...((process.env.RATE_LIMIT_SECRET?.trim().length || 0) >= 32
      ? []
      : ["RATE_LIMIT_SECRET"]),
    ...((process.env.HEALTHCHECK_SECRET?.trim().length || 0) >= 32
      ? []
      : ["HEALTHCHECK_SECRET"]),
    ...(["live", "sandbox"].includes(
      process.env.PAYPAL_ENV?.trim().toLowerCase() || ""
    )
      ? []
      : ["PAYPAL_ENV"]),
    ...(/^[A-Z]{3}$/.test(
      process.env.PAYPAL_DEFAULT_CURRENCY?.trim() || ""
    )
      ? []
      : ["PAYPAL_DEFAULT_CURRENCY"]),
  ];

  const [databaseCheck, publicKeyCheck, paypalCheck] = await Promise.all([
    checkDatabase(),
    checkSupabasePublicKey(),
    checkPayPalCredentials(),
  ]);

  const checks = {
    environment: {
      ok: missingEnvironment.length === 0 && invalidEnvironment.length === 0,
      missing: missingEnvironment,
      invalid: [...new Set(invalidEnvironment)],
    },
    database: databaseCheck,
    supabasePublishableKey: publicKeyCheck,
    paypalCredentials: paypalCheck,
  };
  const healthy =
    checks.environment.ok &&
    checks.database.ok &&
    checks.supabasePublishableKey.ok &&
    checks.paypalCredentials.ok;

  return noStore(
    {
      ...base,
      ok: healthy,
      checks,
    },
    healthy ? 200 : 503
  );
}
