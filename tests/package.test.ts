import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));

describe("npm scripts", () => {
  it("has build", () => expect(pkg.scripts?.build).toBeTruthy());
  it("has lint", () => expect(pkg.scripts?.lint).toBeTruthy());
  it("has test", () => expect(pkg.scripts?.test).toBeTruthy());
  it("does not use audit force", () => {
    expect(JSON.stringify(pkg.scripts || {})).not.toMatch(/audit\s+fix\s+--force/i);
  });
});
