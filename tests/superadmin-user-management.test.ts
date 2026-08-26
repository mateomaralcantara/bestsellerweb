import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("SUPERADMIN user directory and creation", () => {
  it("usa un directorio clicable que abre solo un usuario", () => {
    const page = read("app/admin/users/page.tsx");
    const directory = read("components/admin/AdminUserDirectoryClient.tsx");

    expect(page).toContain("AdminUserDirectoryClient");
    expect(directory).toContain('href={`/admin/users/${row.id}`}');
    expect(directory).toContain("ABRIR TODO DEL USUARIO");
  });

  it("permite crear usuarios desde una API administrativa protegida", () => {
    const route = read("app/api/admin/users/create/route.ts");

    expect(route).toContain('requireAdminApi("users.manage")');
    expect(route).toContain("auth.admin.createUser");
    expect(route).toContain("auth.admin.deleteUser");
    expect(route).toContain('action: "user.create"');
  });

  it("permite asignar roles especiales en la creación", () => {
    const route = read("app/api/admin/users/create/route.ts");
    const directory = read("components/admin/AdminUserDirectoryClient.tsx");

    expect(route).toContain('"author", "affiliate", "admin"');
    expect(route).toContain('"user_roles"');
    expect(route).toContain('"admin_permissions"');
    expect(directory).toContain('name="role_author"');
    expect(directory).toContain('name="role_affiliate"');
    expect(directory).toContain('name="role_admin"');
  });

  it("permite asignar los seis montos al crear una cuenta", () => {
    const directory = read("components/admin/AdminUserDirectoryClient.tsx");

    for (const field of [
      "benefitsTotal",
      "availableToWithdraw",
      "pendingEarnings",
      "authorEarningsTotal",
      "affiliateEarningsTotal",
      "paidOutTotal",
    ]) {
      expect(directory).toContain(field);
    }

    expect(directory).toContain('"finance.summary.set"');
  });

  it("administra autor y afiliado sin salir del usuario 360", () => {
    const page = read("app/admin/users/[id]/page.tsx");
    const client = read("components/admin/AdminUserProfilesClient.tsx");
    const route = read("app/api/admin/users/[id]/control/route.ts");

    expect(page).toContain("AdminUserProfilesClient");
    expect(page).not.toContain('href="/admin/authors"');
    expect(page).not.toContain('href="/admin/affiliates"');
    expect(client).toContain('"author.profile.upsert"');
    expect(client).toContain('"affiliate.profile.upsert"');
    expect(route).toContain('case "author.profile.upsert"');
    expect(route).toContain('case "affiliate.profile.upsert"');
  });

  it("mantiene el ledger financiero sin update/delete directo", () => {
    const route = read("app/api/admin/users/[id]/control/route.ts");
    const compact = route.replace(/\s+/g, "");

    expect(compact).not.toContain('.from("financial_ledger").update(');
    expect(compact).not.toContain('.from("financial_ledger").delete(');
  });
});
