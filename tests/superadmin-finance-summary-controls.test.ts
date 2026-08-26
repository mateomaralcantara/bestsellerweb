import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("SUPERADMIN financial summary controls", () => {
  it("expone la accion para fijar el resumen financiero", () => {
    const route = read("app/api/admin/users/[id]/control/route.ts");

    expect(route).toContain('"finance.summary.set"');
    expect(route).toContain('requireAdminApi("finance.adjust")');
    expect(route).toContain("admin_summary_set");
  });

  it("crea ajustes para los seis indicadores solicitados", () => {
    const route = read("app/api/admin/users/[id]/control/route.ts");

    for (const metric of [
      "benefits_total",
      "available_to_withdraw",
      "pending_earnings",
      "author_earnings_total",
      "affiliate_earnings_total",
      "paid_out_total",
    ]) {
      expect(route).toContain(metric);
    }
  });

  it("mantiene el ledger append-only", () => {
    const route = read("app/api/admin/users/[id]/control/route.ts");
    const compact = route.replace(/\s+/g, "");

    expect(compact).not.toContain('.from("financial_ledger").update(');
    expect(compact).not.toContain('.from("financial_ledger").delete(');
    expect(route).toContain('.from("financial_ledger").insert(rows)');
  });

  it("incluye un editor exacto de los seis valores en USER 360", () => {
    const ui = read("components/admin/AdminUser360ExtraClient.tsx");

    expect(ui).toContain("CONTROL FINANCIERO EXACTO");
    expect(ui).toContain("GUARDAR LOS 6 VALORES");
    expect(ui).toContain('name="benefitsTotal"');
    expect(ui).toContain('name="availableToWithdraw"');
    expect(ui).toContain('name="pendingEarnings"');
    expect(ui).toContain('name="authorEarningsTotal"');
    expect(ui).toContain('name="affiliateEarningsTotal"');
    expect(ui).toContain('name="paidOutTotal"');
  });

  it("incluye migracion para payout neto y ajustes independientes", () => {
    const sql = read(
      "supabase/migrations/20260826_admin_finance_summary_controls.sql"
    );

    expect(sql).toContain("summary_metric");
    expect(sql).toContain("available_to_withdraw");
    expect(sql).toContain("pending_earnings");
    expect(sql).toContain("paid_out_total");
    expect(sql).toContain("direction = 'debit'");
    expect(sql).toContain("direction = 'credit'");
  });
});
