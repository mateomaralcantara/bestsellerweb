import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("PayPal browser mutations require origin, marker and rate limits", async () => {
  for (const route of ["create-order", "capture-order"]) {
    const content = await source(
      `app/api/payments/paypal/${route}/route.ts`
    );
    assert.match(content, /requireTrustedMutation\(request\)/);
    assert.match(content, /consumeRateLimit\(request/);
    assert.match(content, /readJsonBody/);
  }
});

test("webhooks verify signatures before claiming the event", async () => {
  const content = await source("app/api/payments/paypal/webhook/route.ts");
  const verification = content.indexOf("verifyPayPalWebhookSignature({");
  const claim = content.indexOf("const claim = await claimWebhookEvent(");

  assert.ok(verification > -1, "falta verificación de firma");
  assert.ok(claim > verification, "el evento se reclama antes de verificar la firma");
  assert.match(content, /MAX_TRANSMISSION_AGE_MS/);
  assert.match(content, /MAX_WEBHOOK_BYTES/);
});

test("purchase access is granted through an atomic database function", async () => {
  const code = await source("lib/paypal/purchases.ts");
  const migration = await source(
    "supabase/migrations/20260820_total_security_hardening.sql"
  );

  assert.match(code, /grant_book_purchase_atomic/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /book_purchases_one_active_access_uidx/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /revoke all on function/i);
});

test("CSP blocks framing and uses per-request nonces", async () => {
  const content = await source("proxy.ts");

  assert.match(content, /'nonce-\$\{nonce\}'/);
  assert.match(content, /frame-ancestors 'none'/);
  assert.match(content, /object-src 'none'/);
  assert.match(content, /same-origin-allow-popups/);
});

test("private PDF responses stream instead of creating a second full buffer", async () => {
  const content = await source("app/api/books/[bookkey]/read/route.ts");

  assert.match(content, /file\.stream\(\)/);
  assert.match(content, /asset\?\.storage_bucket !== FILE_BUCKET/);
  assert.match(content, /file\.slice\(0, 5\)\.arrayBuffer\(\)/);
  assert.match(content, /"Content-Type": "application\/pdf"/);
  assert.doesNotMatch(content, /Buffer\.from\(await file\.arrayBuffer\(\)\)/);
});

test("public EPUB preview refuses unpublished books", async () => {
  const content = await source("app/api/books/[bookkey]/epub/route.ts");
  assert.match(content, /mode === "preview" && book\.status !== "published"/);
  assert.match(content, /\.is\("revoked_at", null\)/);
  assert.match(content, /asset\.storage_bucket !== FILE_BUCKET/);
  assert.match(content, /"Content-Type": "application\/epub\+zip"/);
  assert.match(content, /"Content-Disposition": `attachment/);
});

test("request bodies are bounded while they stream", async () => {
  const content = await source("lib/security/http.ts");

  assert.match(content, /request\.body\.getReader\(\)/);
  assert.match(content, /totalBytes > maxBytes/);
  assert.match(content, /requireKnownLength/);
});

test("legacy orders cannot be created directly from the browser", async () => {
  const migration = await source(
    "supabase/migrations/20260820_total_security_hardening.sql"
  );

  assert.match(
    migration,
    /revoke insert, update, delete, truncate, references, trigger\s+on table public\.orders from authenticated/i
  );
  assert.match(
    migration,
    /revoke insert, update, delete, truncate, references, trigger\s+on table public\.order_items from authenticated/i
  );
});

test("authors cannot self-publish or feature their own books", async () => {
  const createRoute = await source("app/api/books/route.ts");
  const updateRoute = await source("app/api/books/[bookkey]/route.ts");

  assert.match(createRoute, /allowFeatured: isAdmin/);
  assert.match(updateRoute, /requestedStatus === "draft"/);
  assert.match(updateRoute, /: "under_review"/);
  assert.match(updateRoute, /if \(isAdmin\) \{\s*assignBooleanIfPresent/);
});

test("the 25-page preview is private and only serves published books", async () => {
  const previewPage = await source("app/catalog/[slug]/preview/page.tsx");
  const previewRoute = await source(
    "app/api/books/[bookkey]/preview/[page]/route.ts"
  );
  const migration = await source(
    "supabase/migrations/20260820_total_security_hardening.sql"
  );

  assert.match(previewPage, /\.eq\("status", "published"\)/);
  assert.match(previewPage, /\/api\/books\/\$\{encodeURIComponent\(book\.slug\)\}\/preview/);
  assert.doesNotMatch(previewPage, /getPublicUrl/);
  assert.match(previewRoute, /\.eq\("status", "published"\)/);
  assert.match(previewRoute, /\.from\(PREVIEW_BUCKET\)\s*\.download\(storagePath\)/);
  assert.match(previewRoute, /detectImageType\(bytes\)/);
  assert.match(migration, /where id in \('book-files', 'book-previews'\)/);
  assert.match(
    migration,
    /drop policy if exists "Public can read book previews" on storage\.objects/
  );
});

test("affiliate applications cannot write directly from the browser", async () => {
  const form = await source("components/forms/affiliate-form.tsx");
  const route = await source("app/api/applications/affiliate/route.ts");
  const migration = await source(
    "supabase/migrations/20260820_total_security_hardening.sql"
  );

  assert.match(form, /fetch\("\/api\/applications\/affiliate"/);
  assert.doesNotMatch(form, /\.from\("affiliate_applications"\)\.insert/);
  assert.match(route, /requireTrustedMutation\(request\)/);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /consumeRateLimit\(request/);
  assert.match(route, /email !== accountEmail/);
  assert.match(
    migration,
    /revoke all on table public\.affiliate_applications from anon, authenticated/i
  );
});

test("authentication supports Turnstile tokens without exposing its secret", async () => {
  const authForm = await source("components/forms/auth-form.tsx");
  const proxy = await source("proxy.ts");
  const envExample = await source(".env.example");

  assert.match(authForm, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(authForm, /captchaToken: captchaToken \|\| undefined/);
  assert.match(authForm, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(proxy, /https:\/\/challenges\.cloudflare\.com/);
  assert.match(envExample, /NEXT_PUBLIC_TURNSTILE_SITE_KEY=REEMPLAZAR/);
  assert.doesNotMatch(envExample, /TURNSTILE_SECRET/);
});

test("production rate limiting requires a dedicated strong secret", async () => {
  const content = await source("lib/security/rate-limit.ts");

  assert.match(content, /configured\.length >= 32/);
  assert.match(content, /process\.env\.NODE_ENV === "production"/);
  assert.match(content, /randomBytes\(32\)/);
  assert.doesNotMatch(content, /development-rate-limit-secret/);
  assert.doesNotMatch(content, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(content, /CRON_SECRET/);
});

test("the protected deep health check verifies provider credentials", async () => {
  const content = await source("app/api/health/route.ts");

  assert.match(content, /timingSafeEqual/);
  assert.match(content, /\/auth\/v1\/settings/);
  assert.match(content, /\/v1\/oauth2\/token/);
  assert.match(content, /AbortSignal\.timeout\(8_000\)/);
  assert.match(content, /supabasePublishableKey/);
  assert.match(content, /paypalCredentials/);
});
