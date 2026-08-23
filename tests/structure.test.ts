import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("LibroSeller structure", () => {
  const files = [
    "app/api/payments/paypal/create-order/route.ts",
    "app/api/payments/paypal/capture-order/route.ts",
    "app/api/payments/paypal/webhook/route.ts",
    "lib/paypal/client.ts",
    "lib/paypal/config.ts",
    "lib/supabase/server.ts",
    "lib/supabase/admin.ts",
  ];

  for (const file of files) {
    it(`contains ${file}`, () => {
      expect(fs.existsSync(path.join(root, file))).toBe(true);
    });
  }
});
