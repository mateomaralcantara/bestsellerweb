import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("PayPal security", () => {
  it("create-order authenticates user", () => {
    const text = fs.readFileSync(path.join(root, "app/api/payments/paypal/create-order/route.ts"), "utf8");
    expect(text).toMatch(/auth\.getUser/);
    expect(text).toMatch(/401/);
  });

  it("capture-order authenticates user", () => {
    const text = fs.readFileSync(path.join(root, "app/api/payments/paypal/capture-order/route.ts"), "utf8");
    expect(text).toMatch(/auth\.getUser/);
    expect(text).toMatch(/user_id/);
  });

  it("webhook has verification", () => {
    const text = fs.readFileSync(path.join(root, "app/api/payments/paypal/webhook/route.ts"), "utf8");
    const ok = /PAYPAL-TRANSMISSION-ID/i.test(text) || /paypal-transmission-id/i.test(text) || /verifyWebhookSignature/i.test(text) || /verify-webhook-signature/i.test(text);
    expect(ok).toBe(true);
    expect(text).toMatch(/WebhookRequestError/);
    expect(text).toMatch(/JSON de webhook inválido/);
    expect(text).toMatch(/status:\s*400/);
  });
});
