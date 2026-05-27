import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const ignoredDirs = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".vercel",
]);

const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const patterns = [
  "Nuevo libro",
  "Dashboard editorial",
  "Crea una ficha completa tipo Amazon/KDP",
  "Identidad del libro",
  "Descripción comercial",
  "Archivo del libro",
  "chapter_one_excerpt",
  "primary_niche",
  "book_file",
];

const results = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!exts.has(path.extname(entry.name))) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of patterns) {
        if (line.includes(pattern)) {
          results.push({
            file: fullPath,
            line: i + 1,
            pattern,
            text: line.trim(),
          });
        }
      }
    }
  }
}

walk(root);

if (!results.length) {
  console.log("\n❌ No encontré la página de Nuevo libro.\n");
  process.exit(0);
}

const grouped = new Map();

for (const result of results) {
  const rel = path.relative(root, result.file);
  if (!grouped.has(rel)) grouped.set(rel, []);
  grouped.get(rel).push(result);
}

console.log("\n✅ Posibles archivos donde se presenta “Nuevo libro”:\n");

for (const [file, matches] of grouped.entries()) {
  console.log(`📄 ${file}`);

  for (const match of matches.slice(0, 12)) {
    console.log(
      `   Línea ${match.line} | ${match.pattern} | ${match.text}`
    );
  }

  if (matches.length > 12) {
    console.log(`   ... ${matches.length - 12} coincidencias más`);
  }

  console.log("");
}

console.log("👉 El archivo correcto normalmente será algo como:");
console.log("   app/dashboard/books/new/page.tsx");
console.log("   app/dashboard/books/create/page.tsx");
console.log("   app/dashboard/books/page.tsx");
console.log("");