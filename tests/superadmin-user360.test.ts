import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const root = process.cwd();
function read(file: string) { return fs.readFileSync(path.join(root, file), "utf8"); }
describe("SUPERADMIN USER 360", () => {
  it("instala control 360", () => {
    for (const file of ["app/admin/users/[id]/page.tsx","app/api/admin/users/[id]/control/route.ts","lib/admin/user-360.ts","components/admin/AdminUser360ExtraClient.tsx"]) expect(fs.existsSync(path.join(root,file)),file).toBe(true);
  });
  it("protege pagina y API", () => { expect(read("app/admin/users/[id]/page.tsx")).toContain('requireAdminPage("users.read")'); expect(read("app/api/admin/users/[id]/control/route.ts")).toContain('requireAdminApi("users.manage")'); });
  it("permite password metadata y acceso", () => { const route=read("app/api/admin/users/[id]/control/route.ts"); expect(route).toContain('"password.set"'); expect(route).toContain('"metadata.update"'); expect(route).toContain('"purchase.access"'); expect(route).toContain("totalmente reembolsada"); });
  it("no borra ledger ni audit", () => { const compact=read("app/api/admin/users/[id]/control/route.ts").replace(/\s+/g,""); expect(compact).not.toContain('.from("financial_ledger").delete('); expect(compact).not.toContain('.from("admin_audit_log").delete('); });
  it("agrega acceso desde usuarios", () => { const users=read("components/admin/AdminUsersClient.tsx"); expect(users).toContain("CONTROL 360"); expect(users).toContain("/admin/users/"); });
});