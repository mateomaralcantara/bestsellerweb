import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("PayPal distributed rate limiting", () => {
  it("stores counters in a private Supabase schema", () => {
    const migration = read(
      "supabase/migrations/20260823_paypal_rate_limits.sql"
    );

    expect(migration).toContain("create schema if not exists private");
    expect(migration).toContain("private.paypal_rate_limits");
    expect(migration).toContain(
      "primary key (route, actor_hash, window_start)"
    );
  });

  it("protects the privileged rate-limit function", () => {
    const migration = read(
      "supabase/migrations/20260823_paypal_rate_limits.sql"
    );

    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("from authenticated");
    expect(migration).toContain("to service_role");
  });

  it("hashes user identifiers with HMAC before persistence", () => {
    const source = read("lib/security/paypal-rate-limit.ts");

    expect(source).toContain('createHmac("sha256"');
    expect(source).toContain("RATE_LIMIT_SECRET");
    expect(source).toContain("secret.length < 32");
    expect(source).toContain('digest("hex")');
  });

  it("rate limits PayPal create-order and returns 429", () => {
    const source = read(
      "app/api/payments/paypal/create-order/route.ts"
    );

    expect(source).toContain('route: "paypal:create-order"');
    expect(source).toContain("status: 429");
    expect(source).toContain("buildRateLimitHeaders");
  });

  it("rate limits PayPal capture-order and returns 429", () => {
    const source = read(
      "app/api/payments/paypal/capture-order/route.ts"
    );

    expect(source).toContain('route: "paypal:capture-order"');
    expect(source).toContain("status: 429");
    expect(source).toContain("buildRateLimitHeaders");
  });

  it("does not rate limit the PayPal webhook retry path", () => {
    const source = read(
      "app/api/payments/paypal/webhook/route.ts"
    );

    expect(source).not.toContain("consumePayPalRateLimit");
    expect(source).toContain("verifyPayPalWebhookSignature");
  });
});
