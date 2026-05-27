import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const filePath = path.join(ROOT_DIR, "app", "catalog", "[slug]", "page.tsx");

if (!fs.existsSync(filePath)) {
  console.error("No encontré:", filePath);
  process.exit(1);
}

const original = fs.readFileSync(filePath, "utf8");

const backupPath = `${filePath}.backup-escaped-${Date.now()}`;
fs.writeFileSync(backupPath, original, "utf8");

const repaired = original
  // Corrige backticks escapados: \` -> `
  .replace(/\\`/g, "`")
  // Corrige interpolaciones escapadas: \${ -> ${
  .replace(/\\\$\{/g, "${");

fs.writeFileSync(filePath, repaired, "utf8");

console.log("");
console.log("Listo. Archivo reparado:");
console.log(path.relative(ROOT_DIR, filePath));
console.log("");
console.log("Backup creado:");
console.log(path.relative(ROOT_DIR, backupPath));
console.log("");
console.log("Ahora ejecuta:");
console.log("npm run dev");
console.log("");