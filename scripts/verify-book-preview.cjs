const fs = require("node:fs");
const path = require("node:path");
const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

loadEnvConfig(process.cwd());

const root = process.cwd();

const REQUIRED_FILES = {
  preview: path.join(root, "lib", "book-preview.ts"),
  route: path.join(root, "app", "api", "books", "route.ts"),
  queries: path.join(root, "lib", "queries.ts"),
  types: path.join(root, "lib", "types.ts"),
  card: path.join(root, "components", "book-card.tsx"),
};

const REQUIRED_BOOK_FIELDS = [
  "description_short",
  "description_long",
  "introduction",
  "chapter_one_excerpt",
  "sample_url",
  "cover_url",
];

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

function exists(filePath) {
  return fs.existsSync(filePath);
}

function read(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function hasAll(code, fragments) {
  return fragments.every((fragment) => code.includes(fragment));
}

function isFilledText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function checkFiles() {
  section("ARCHIVOS");

  let hasError = false;

  for (const [label, filePath] of Object.entries(REQUIRED_FILES)) {
    if (exists(filePath)) {
      ok(`Existe ${label}: ${path.relative(root, filePath)}`);
    } else {
      fail(`No existe ${label}: ${path.relative(root, filePath)}`);
      hasError = true;
    }
  }

  return {
    files: REQUIRED_FILES,
    hasError,
  };
}

function inspectPreviewFile(filePath) {
  section("lib/book-preview.ts");

  const code = read(filePath);
  if (!code) {
    fail("No pude leer lib/book-preview.ts");
    return true;
  }

  let hasError = false;

  if (hasAll(code, ["extractBookPreviewFromFile", "extractPdfPreview"])) {
    ok("book-preview.ts exporta la extracción principal");
  } else {
    fail("book-preview.ts no parece exportar extractBookPreviewFromFile");
    hasError = true;
  }

  if (hasAll(code, ["argument", "introduction", "chapterOne"])) {
    ok("book-preview.ts trabaja con argument/introduction/chapterOne");
  } else {
    fail("book-preview.ts no contiene los campos esperados del preview");
    hasError = true;
  }

  return hasError;
}

function inspectRouteFile(filePath) {
  section("app/api/books/route.ts");

  const code = read(filePath);
  if (!code) {
    fail("No pude leer app/api/books/route.ts");
    return true;
  }

  let hasError = false;

  if (code.includes('from "@/lib/book-preview"')) {
    ok("route.ts importa lib/book-preview");
  } else {
    fail("route.ts no importa lib/book-preview");
    hasError = true;
  }

  if (code.includes("extractBookPreviewFromFile(bookFile)")) {
    ok("route.ts usa extractBookPreviewFromFile(bookFile)");
  } else {
    fail("route.ts no usa extractBookPreviewFromFile(bookFile)");
    hasError = true;
  }

  if (
    hasAll(code, [
      "description_long: finalDescription",
      "introduction: finalIntroduction",
      "chapter_one_excerpt: finalChapterOne",
      "sample_url: finalSampleUrl",
    ])
  ) {
    ok("route.ts guarda description_long/introduction/chapter_one_excerpt/sample_url");
  } else {
    fail("route.ts no guarda todos los campos del preview");
    hasError = true;
  }

  if (code.includes("extracted_preview")) {
    ok("route.ts devuelve extracted_preview en la respuesta");
  } else {
    warn("route.ts no devuelve extracted_preview");
  }

  return hasError;
}

function inspectQueriesFile(filePath) {
  section("lib/queries.ts");

  const code = read(filePath);
  if (!code) {
    fail("No pude leer lib/queries.ts");
    return true;
  }

  let hasError = false;

  if (
    hasAll(code, [
      "description_short",
      "description_long",
      "introduction",
      "chapter_one_excerpt",
      "sample_url",
      "cover_url",
    ])
  ) {
    ok("queries.ts selecciona los campos del preview");
  } else {
    fail("queries.ts no selecciona todos los campos del preview");
    hasError = true;
  }

  if (
    hasAll(code, [
      "short_description:",
      "long_description:",
      "introduction:",
      "chapter_one_excerpt:",
      "sample_url:",
    ])
  ) {
    ok("queries.ts normaliza los campos al objeto Book");
  } else {
    fail("queries.ts no normaliza bien los campos del preview");
    hasError = true;
  }

  return hasError;
}

function inspectTypesFile(filePath) {
  section("lib/types.ts");

  const code = read(filePath);
  if (!code) {
    fail("No pude leer lib/types.ts");
    return true;
  }

  let hasError = false;

  if (
    hasAll(code, [
      "short_description?:",
      "long_description?:",
      "introduction?:",
      "chapter_one_excerpt?:",
      "sample_url?:",
    ])
  ) {
    ok("types.ts define los campos del preview en Book");
  } else {
    fail("types.ts no define todos los campos del preview");
    hasError = true;
  }

  return hasError;
}

function inspectBookCardFile(filePath) {
  section("components/book-card.tsx");

  const code = read(filePath);
  if (!code) {
    fail("No pude leer components/book-card.tsx");
    return true;
  }

  let hasError = false;

  if (code.includes("Ver resumen")) {
    ok('BookCard tiene el botón "Ver resumen"');
  } else {
    fail('BookCard no tiene el botón "Ver resumen"');
    hasError = true;
  }

  if (
    hasAll(code, ["long_description", "introduction", "chapter_one_excerpt"])
  ) {
    ok("BookCard usa argumento completo + introducción + capítulo 1");
  } else {
    fail("BookCard no usa todos los campos del preview");
    hasError = true;
  }

  if (code.includes("Argumento completo")) {
    ok('BookCard muestra la sección "Argumento completo"');
  } else {
    warn('BookCard no muestra el título "Argumento completo"');
  }

  return hasError;
}

async function checkDatabase() {
  section("BASE DE DATOS");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    fail("Faltan credenciales de Supabase en .env");
    return true;
  }

  const supabase = createClient(url, key);
  let hasError = false;

  const { data: books, error } = await supabase
    .from("books")
    .select(
      "id,title,slug,status,description_short,description_long,introduction,chapter_one_excerpt,sample_url,cover_url,created_at"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    fail(`No pude consultar books: ${error.message}`);
    return true;
  }

  if (!books || books.length === 0) {
    fail("No hay libros publicados en books");
    return true;
  }

  ok(`Libros publicados encontrados: ${books.length}`);

  const firstBook = books[0];

  for (const field of REQUIRED_BOOK_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(firstBook, field)) {
      ok(`Campo presente en books: ${field}`);
    } else {
      fail(`Campo ausente en books: ${field}`);
      hasError = true;
    }
  }

  let withLong = 0;
  let withIntro = 0;
  let withChapterOne = 0;
  let withSampleUrl = 0;

  for (const book of books) {
    const longDescription = isFilledText(book.description_long)
      ? book.description_long.trim()
      : null;

    const introduction = isFilledText(book.introduction)
      ? book.introduction.trim()
      : null;

    const chapterOne = isFilledText(book.chapter_one_excerpt)
      ? book.chapter_one_excerpt.trim()
      : null;

    const sampleUrl = isFilledText(book.sample_url)
      ? book.sample_url.trim()
      : null;

    if (longDescription) withLong += 1;
    if (introduction) withIntro += 1;
    if (chapterOne) withChapterOne += 1;
    if (sampleUrl) withSampleUrl += 1;

    console.log(
      `- ${book.slug} | argumento=${Boolean(longDescription)} | introducción=${Boolean(
        introduction
      )} | capítulo1=${Boolean(chapterOne)} | sample_url=${Boolean(sampleUrl)}`
    );
  }

  if (withLong > 0) ok(`Hay ${withLong} libro(s) con argumento largo`);
  else warn("No hay libros con description_long");

  if (withIntro > 0) ok(`Hay ${withIntro} libro(s) con introducción`);
  else warn("No hay libros con introduction");

  if (withChapterOne > 0) ok(`Hay ${withChapterOne} libro(s) con primer capítulo`);
  else warn("No hay libros con chapter_one_excerpt");

  if (withSampleUrl > 0) ok(`Hay ${withSampleUrl} libro(s) con sample_url`);
  else warn("No hay libros con sample_url");

  return hasError;
}

async function main() {
  console.log("\n🔎 Verificación completa del preview editorial\n");

  const { files, hasError: fileError } = await checkFiles();
  let hasError = fileError;

  if (!fileError) {
    hasError = inspectPreviewFile(files.preview) || hasError;
    hasError = inspectRouteFile(files.route) || hasError;
    hasError = inspectQueriesFile(files.queries) || hasError;
    hasError = inspectTypesFile(files.types) || hasError;
    hasError = inspectBookCardFile(files.card) || hasError;
  }

  hasError = (await checkDatabase()) || hasError;

  section("RESULTADO");

  if (hasError) {
    fail("Hay piezas incompletas o inconsistentes en el flujo del preview");
    process.exitCode = 1;
  } else {
    ok("El flujo del preview editorial se ve bien armado");
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error("\n💥 Falló la verificación:", error);
  process.exitCode = 1;
});