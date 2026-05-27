const fs = require("node:fs");
const path = require("node:path");
const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

loadEnvConfig(process.cwd());

const BASE_URL = process.env.SMOKE_TEST_BASE_URL || "http://localhost:3000";
const AUTHOR_ID = process.env.SMOKE_TEST_AUTHOR_ID || "";
const TEST_PDF_PATH =
  process.env.SMOKE_TEST_PDF_PATH ||
  path.join(process.cwd(), "tests", "fixtures", "sample-book.pdf");
const TEST_COVER_PATH =
  process.env.SMOKE_TEST_COVER_PATH ||
  path.join(process.cwd(), "tests", "fixtures", "sample-cover.jpg");

function ok(message) {
  console.log(`✅ ${message}`);
}

function warn(message) {
  console.log(`⚠️ ${message}`);
}

function fail(message) {
  console.log(`❌ ${message}`);
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Falta ${label}: ${filePath}`);
  }
}

function makeFileFromPath(filePath, mimeType) {
  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  return new File([buffer], fileName, {
    type: mimeType,
  });
}

async function verifyInsertedBook(slug) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY para verificar la inserción"
    );
  }

  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("books")
    .select(
      "id,title,slug,status,description_short,description_long,introduction,chapter_one_excerpt,sample_url,cover_url,created_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Error verificando libro en DB: ${error.message}`);
  }

  if (!data) {
    throw new Error(`No apareció el libro en DB con slug: ${slug}`);
  }

  ok(`Libro insertado encontrado: ${data.slug}`);

  const longDescription =
    typeof data.description_long === "string" && data.description_long.trim()
      ? data.description_long.trim()
      : null;

  const introduction =
    typeof data.introduction === "string" && data.introduction.trim()
      ? data.introduction.trim()
      : null;

  const chapterOne =
    typeof data.chapter_one_excerpt === "string" &&
    data.chapter_one_excerpt.trim()
      ? data.chapter_one_excerpt.trim()
      : null;

  const sampleUrl =
    typeof data.sample_url === "string" && data.sample_url.trim()
      ? data.sample_url.trim()
      : null;

  console.log(`- description_long: ${Boolean(longDescription)}`);
  console.log(`- introduction: ${Boolean(introduction)}`);
  console.log(`- chapter_one_excerpt: ${Boolean(chapterOne)}`);
  console.log(`- sample_url: ${Boolean(sampleUrl)}`);

  if (longDescription) ok("description_long quedó poblado");
  else warn("description_long quedó vacío");

  if (introduction) ok("introduction quedó poblado");
  else warn("introduction quedó vacío");

  if (chapterOne) ok("chapter_one_excerpt quedó poblado");
  else warn("chapter_one_excerpt quedó vacío");

  return data;
}

async function main() {
  console.log("\n🔎 Smoke test de subida de libro + preview\n");

  if (!AUTHOR_ID) {
    throw new Error(
      "Falta SMOKE_TEST_AUTHOR_ID en .env o variables de entorno"
    );
  }

  if (typeof File === "undefined" || typeof FormData === "undefined") {
    throw new Error(
      "Tu versión de Node no expone File/FormData global. Usa Node 20+."
    );
  }

  ensureFile(TEST_PDF_PATH, "PDF de prueba");
  ensureFile(TEST_COVER_PATH, "portada de prueba");

  section("Preparación");

  const timestamp = Date.now();
  const title = `SMOKE TEST BOOK ${timestamp}`;

  const pdfFile = makeFileFromPath(TEST_PDF_PATH, "application/pdf");
  const coverFile = makeFileFromPath(TEST_COVER_PATH, "image/jpeg");

  ok(`Título de prueba: ${title}`);
  ok(`PDF: ${TEST_PDF_PATH}`);
  ok(`Portada: ${TEST_COVER_PATH}`);

  section("POST /api/books");

  const formData = new FormData();
  formData.append("title", title);
  formData.append("description", "");
  formData.append("introduction", "");
  formData.append("chapter_one_excerpt", "");
  formData.append("sample_url", "");
  formData.append("price", "100");
  formData.append("author_id", AUTHOR_ID);
  formData.append("cover", coverFile);
  formData.append("book_file", pdfFile);

  const response = await fetch(`${BASE_URL}/api/books`, {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(payload);
    throw new Error(`POST /api/books falló con status ${response.status}`);
  }

  ok("POST /api/books respondió OK");

  const slug = payload?.book?.slug;
  if (!slug) {
    throw new Error("La respuesta no trajo book.slug");
  }

  ok(`Slug creado: ${slug}`);

  if (payload?.extracted_preview) {
    console.log("extracted_preview:", payload.extracted_preview);
  } else {
    warn("La respuesta no trajo extracted_preview");
  }

  section("Verificación en Supabase");

  await verifyInsertedBook(slug);

  section("Resultado");

  ok("El smoke test terminó");
  console.log(`\nAbre esto para revisar el libro:\n${BASE_URL}/catalog/${slug}`);
}

main().catch((error) => {
  console.error("\n💥 Falló el smoke test:", error.message || error);
  process.exitCode = 1;
});