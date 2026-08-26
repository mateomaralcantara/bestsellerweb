import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("SUPERADMIN security", () => {
  it("expone las rutas administrativas principales", () => {
    const routes = [
      "app/admin/page.tsx",
      "app/admin/users/page.tsx",
      "app/admin/finance/page.tsx",
      "app/admin/affiliates/page.tsx",
      "app/admin/authors/page.tsx",
      "app/admin/books/page.tsx",
      "app/admin/purchases/page.tsx",
      "app/admin/payouts/page.tsx",
      "app/admin/ledger/page.tsx",
      "app/admin/audit/page.tsx",
      "app/admin/security/page.tsx",
      "app/api/admin/control/route.ts",
    ];

    for (const route of routes) {
      expect(fs.existsSync(path.join(root, route)), route).toBe(true);
    }
  });

  it("protege las acciones con permisos administrativos", () => {
    const source = read("app/api/admin/control/route.ts");

    expect(source).toContain("requireAdminApi");
    expect(source).toContain("writeAdminAudit");
    expect(source).toContain('"finance.adjustment"');
    expect(source).toContain('"admin.permissions.set"');
    expect(source).toContain('"purchase.refund"');
  });

  it("mantiene el audit log append-only", () => {
    const sql = read(
      "supabase/migrations/20260826_superadmin_control_center.sql"
    ).toLowerCase();

    expect(sql).toContain("admin_audit_no_update");
    expect(sql).toContain("admin_audit_no_delete");
    expect(sql).toContain(
      "revoke update, delete on public.admin_audit_log from service_role"
    );
    expect(sql).toContain(
      "grant select, insert on public.admin_audit_log to service_role"
    );
  });

  it("mantiene el ledger como correccion por asientos", () => {
    const api = read("app/api/admin/control/route.ts");
    const normalizedApi = api.replace(/\s+/g, "");

    expect(api).toContain('.from("financial_ledger")');
    expect(api).toContain('event_type: "adjustment"');
    expect(api).toContain('source_type: "admin_adjustment"');
    expect(normalizedApi).not.toContain(
      '.from("financial_ledger").delete('
    );
  });

  it("conecta los bloqueos operativos a compras y retiros", () => {
    const purchase = read(
      "app/api/payments/paypal/create-order/route.ts"
    );
    const payout = read("app/api/finance/payouts/route.ts");

    expect(purchase).toContain('from "@/lib/user-controls"');
    expect(purchase).toContain("controls.purchaseBlocked");
    expect(payout).toContain('from "@/lib/user-controls"');
    expect(payout).toContain("controls.payoutBlocked");
  });

  it("usa un reembolso PayPal server-only", () => {
    const refund = read("lib/paypal/admin-refund.ts");

    expect(refund).toContain('import "server-only"');
    expect(refund).toContain("/v2/payments/captures/");
    expect(refund).toContain("PayPal-Request-Id");
    expect(refund).toContain("getPayPalClientSecret");
  });

  it("solo muestra SUPERADMIN a administradores", () => {
    const layout = read("app/dashboard/layout.tsx");

    expect(layout).toContain("access.isAdmin");
    expect(layout).toContain('href: "/admin"');
    expect(layout).toContain("linksForRender");
  });
});
