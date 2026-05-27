import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const ignored = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".vercel",
]);

const targetFile = path.join(root, "src", "data", "bookRepo.ts");

const supabaseDirs = [];
const clientCandidates = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.toLowerCase() === "supabase") {
        supabaseDirs.push(fullPath);
      }

      walk(fullPath);
      continue;
    }

    if (!entry.isFile()) continue;

    const validExt = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(
      path.extname(entry.name)
    );

    if (!validExt) continue;

    const content = fs.readFileSync(fullPath, "utf8");

    const looksLikeSupabaseClient =
      content.includes("@supabase/supabase-js") ||
      content.includes("createClient(") ||
      content.includes("export const supabase") ||
      content.includes("export default supabase");

    if (looksLikeSupabaseClient) {
      clientCandidates.push(fullPath);
    }
  }
}

function toRelativeImport(fromFile, toFile) {
  const fromDir = path.dirname(fromFile);
  let relativePath = path.relative(fromDir, toFile);

  relativePath = relativePath.replaceAll("\\", "/");
  relativePath = relativePath.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "");

  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }

  return relativePath;
}

walk(root);

console.log("\n📁 Carpetas llamadas supabase encontradas:\n");

if (supabaseDirs.length === 0) {
  console.log("No encontré carpetas llamadas supabase.");
} else {
  for (const dir of supabaseDirs) {
    console.log("-", path.relative(root, dir) || ".");
  }
}

console.log("\n🔎 Archivos que parecen cliente/configuración de Supabase:\n");

if (clientCandidates.length === 0) {
  console.log("No encontré archivos con createClient o @supabase/supabase-js.");
} else {
  for (const file of clientCandidates) {
    console.log("-", path.relative(root, file));

    if (fs.existsSync(targetFile)) {
      console.log(
        "  import desde src/data/bookRepo.ts:",
        `import { supabase } from "${toRelativeImport(targetFile, file)}";`
      );
    }
  }
}

console.log("\n✅ Archivo evaluado como origen:");
console.log(fs.existsSync(targetFile) ? path.relative(root, targetFile) : "No existe src/data/bookRepo.ts");

console.log("\n");