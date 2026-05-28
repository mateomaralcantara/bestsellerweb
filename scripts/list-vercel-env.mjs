import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const ENV_FILES = [".env.local", ".env"];

const REQUIRED_FOR_VERCEL = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const OPTIONAL_LEGACY = ["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

function readEnvFile(fileName) {
  const filePath = path.join(ROOT, fileName);

  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const clean = line.trim();

    if (!clean || clean.startsWith("#")) continue;

    const index = clean.indexOf("=");

    if (index === -1) continue;

    const key = clean.slice(0, index).trim();
    const value = clean.slice(index + 1).trim();

    env[key] = value;
  }

  return env;
}

function maskValue(value) {
  if (!value) return "❌ NO ENCONTRADA";

  const clean = value.replace(/^["']|["']$/g, "");

  if (!clean) return "❌ VACÍA";

  if (clean.length <= 10) return "✅ CONFIGURADA";

  return `✅ ${clean.slice(0, 8)}...${clean.slice(-5)}`;
}

const mergedEnv = {};

for (const fileName of ENV_FILES) {
  Object.assign(mergedEnv, readEnvFile(fileName));
}

console.log("");
console.log("========================================");
console.log("VARIABLES PARA CONFIGURAR EN VERCEL");
console.log("========================================");
console.log("");

console.log("REQUERIDAS:");
console.log("----------------------------------------");

for (const key of REQUIRED_FOR_VERCEL) {
  console.log(`${key}=${maskValue(mergedEnv[key])}`);
}

console.log("");
console.log("LEGACY / OPCIONAL:");
console.log("----------------------------------------");

for (const key of OPTIONAL_LEGACY) {
  console.log(`${key}=${maskValue(mergedEnv[key])}`);
}

console.log("");
console.log("VARIABLES QUE DEBES PONER EN VERCEL:");
console.log("----------------------------------------");
console.log("NEXT_PUBLIC_SUPABASE_URL");
console.log("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
console.log("SUPABASE_SERVICE_ROLE_KEY");

console.log("");
console.log("NO subas estos archivos a GitHub:");
console.log("----------------------------------------");
console.log("- .env");
console.log("- .env.local");

console.log("");
console.log("IMPORTANTE:");
console.log("----------------------------------------");
console.log("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY puede estar en el navegador.");
console.log("SUPABASE_SERVICE_ROLE_KEY es privada. Solo va en Vercel/server.");
console.log("");