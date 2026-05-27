import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

function loadEnvFile(fileName) {
  const filePath = path.join(ROOT_DIR, fileName);

  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function walkFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === ".git"
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      walkFiles(fullPath, results);
      continue;
    }

    if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function findMatches(content, regex) {
  const matches = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    matches.push({
      text: match[0],
      index: match.index,
      line: getLineNumber(content, match.index),
    });
  }

  return matches;
}

function printHeader(title) {
  console.log("");
  console.log("=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

function relative(filePath) {
  return path.relative(ROOT_DIR, filePath).replaceAll("\\", "/");
}

function analyzeApiBookRoutes() {
  printHeader("1) Revisando rutas API de libros");

  const apiBooksDir = path.join(ROOT_DIR, "app", "api", "books");

  if (!fs.existsSync(apiBooksDir)) {
    console.log("❌ No existe app/api/books");
    return [];
  }

  const routeFiles = walkFiles(apiBooksDir).filter((file) =>
    file.endsWith("route.ts")
  );

  if (routeFiles.length === 0) {
    console.log("❌ No encontré archivos route.ts dentro de app/api/books");
    return [];
  }

  const dynamicRoutes = [];

  for (const file of routeFiles) {
    const rel = relative(file);
    const content = fs.readFileSync(file, "utf8");

    const dynamicSegmentMatch = rel.match(/app\/api\/books\/\[(.+?)\]\/route\.ts$/);
    const dynamicSegment = dynamicSegmentMatch?.[1] ?? null;

    const usesParamsId = content.includes("params.id");
    const usesParamsBookKey = content.includes("params.bookKey");
    const usesPatch = /export\s+async\s+function\s+PATCH/.test(content);
    const usesGet = /export\s+async\s+function\s+GET/.test(content);
    const idInvalid = content.includes("ID inválido");

    console.log("");
    console.log(`Archivo: ${rel}`);
    console.log(`- Segmento dinámico: ${dynamicSegment ?? "ninguno"}`);
    console.log(`- Tiene PATCH: ${usesPatch ? "sí" : "no"}`);
    console.log(`- Tiene GET: ${usesGet ? "sí" : "no"}`);
    console.log(`- Usa params.id: ${usesParamsId ? "sí" : "no"}`);
    console.log(`- Usa params.bookKey: ${usesParamsBookKey ? "sí" : "no"}`);
    console.log(`- Devuelve "ID inválido": ${idInvalid ? "sí" : "no"}`);

    if (dynamicSegment) {
      dynamicRoutes.push({
        file,
        rel,
        dynamicSegment,
        usesParamsId,
        usesParamsBookKey,
        usesPatch,
        idInvalid,
      });
    }

    if (dynamicSegment === "bookKey" && usesParamsId) {
      console.log("");
      console.log("🚨 PROBLEMA DETECTADO:");
      console.log("La carpeta es [bookKey], pero el código usa params.id.");
      console.log("Eso produce bookId vacío/undefined y termina en ID inválido.");
    }

    if (dynamicSegment === "id" && usesParamsBookKey) {
      console.log("");
      console.log("🚨 PROBLEMA DETECTADO:");
      console.log("La carpeta es [id], pero el código usa params.bookKey.");
    }
  }

  const dynamicNames = new Set(dynamicRoutes.map((route) => route.dynamicSegment));

  if (dynamicNames.size > 1) {
    console.log("");
    console.log("🚨 PROBLEMA GRAVE:");
    console.log(
      `Tienes rutas dinámicas distintas bajo app/api/books: ${[
        ...dynamicNames,
      ].join(", ")}`
    );
    console.log(
      "Next.js no quiere [id] y [bookKey] mezclados en el mismo nivel."
    );
  }

  return dynamicRoutes;
}

function analyzeFetchCalls() {
  printHeader("2) Buscando llamadas fetch a /api/books");

  const files = walkFiles(ROOT_DIR);
  const findings = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");

    if (!content.includes("/api/books")) continue;

    const matches = findMatches(
      content,
      /fetch\s*\(\s*([`'"])([\s\S]*?\/api\/books[\s\S]*?)\1/g
    );

    const rawMatches = findMatches(content, /\/api\/books[^\s"'`)]+/g);

    if (matches.length === 0 && rawMatches.length === 0) continue;

    findings.push({
      file,
      matches: [...matches, ...rawMatches],
    });
  }

  if (findings.length === 0) {
    console.log("⚠️ No encontré fetch directos a /api/books.");
    return;
  }

  for (const item of findings) {
    console.log("");
    console.log(`Archivo: ${relative(item.file)}`);

    for (const match of item.matches) {
      console.log(`- Línea ${match.line}: ${match.text.slice(0, 180)}`);
    }
  }

  console.log("");
  console.log("Revisa especialmente que el PATCH use algo así:");
  console.log(
    "fetch(`/api/books/${encodeURIComponent(book.id)}`, { method: 'PATCH', body: formData })"
  );
}

async function checkSupabaseBook(bookId) {
  printHeader("3) Verificando libro en Supabase");

  if (!bookId) {
    console.log("⚠️ No pasaste --book-id. Saltando verificación DB.");
    return;
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !serviceKey) {
    console.log("⚠️ Faltan variables de Supabase. Saltando verificación DB.");
    console.log("- NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL");
    console.log("- SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY");
    return;
  }

  const supabase = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase
    .from("books")
    .select("id, title, slug, status, owner_user_id, updated_at")
    .eq("id", bookId)
    .maybeSingle();

  if (error) {
    console.log("❌ Error consultando Supabase:");
    console.log(error.message);
    return;
  }

  if (!data) {
    console.log("❌ No existe libro con ese ID en public.books:");
    console.log(bookId);
    return;
  }

  console.log("✅ El libro existe en Supabase:");
  console.log(JSON.stringify(data, null, 2));
}

function printLikelyFix(dynamicRoutes) {
  printHeader("4) Diagnóstico probable");

  const patchRoute = dynamicRoutes.find((route) => route.usesPatch);

  if (!patchRoute) {
    console.log("❌ No encontré PATCH en rutas dinámicas de app/api/books.");
    return;
  }

  if (patchRoute.dynamicSegment === "bookKey" && patchRoute.usesParamsId) {
    console.log("✅ Causa encontrada:");
    console.log("Tu archivo está en:");
    console.log(`  ${patchRoute.rel}`);
    console.log("");
    console.log("Pero el código está usando:");
    console.log("  params.id");
    console.log("");
    console.log("Debe usar:");
    console.log("  params.bookKey");
    console.log("");
    console.log("Parche exacto:");
    console.log(`
type RouteContext = {
  params: {
    bookKey: string;
  };
};

const bookId = decodeURIComponent(params.bookKey || "").trim();
`);
    return;
  }

  if (patchRoute.dynamicSegment === "id" && patchRoute.usesParamsBookKey) {
    console.log("✅ Causa encontrada:");
    console.log("Tu archivo está en [id], pero usa params.bookKey.");
    console.log("O renombras carpeta a [bookKey], o cambias código a params.id.");
    return;
  }

  console.log("No veo mismatch obvio entre carpeta dinámica y params.");
  console.log("Si sigue saliendo ID inválido, revisa que el fetch no mande:");
  console.log("- undefined");
  console.log("- vacío");
  console.log("- book.slug cuando el route busca por id");
  console.log("- una variable diferente a book.id");
}

async function main() {
  const bookId = getArg("book-id");

  console.log("");
  console.log("Debug BestSeller API Books");
  console.log(`Proyecto: ${ROOT_DIR}`);
  console.log(`Book ID recibido: ${bookId || "no enviado"}`);

  const dynamicRoutes = analyzeApiBookRoutes();
  analyzeFetchCalls();
  await checkSupabaseBook(bookId);
  printLikelyFix(dynamicRoutes);

  console.log("");
  console.log("Listo.");
}

main().catch((error) => {
  console.error("");
  console.error("Error ejecutando debug:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});