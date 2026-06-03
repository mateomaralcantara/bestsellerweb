

import fs from "fs";
import path from "path";
import process from "process";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = 30000;
const MIN_EPUB_SIZE_BYTES = 1000;

const ENV_FILES = [
  ".env.local",
  ".env.development.local",
  ".env",
  ".env.production.local",
];

const report = {
  startedAt: new Date().toISOString(),
  root: ROOT,
  args: {},
  checks: [],
  warnings: [],
  errors: [],
  urls: {},
  book: null,
  assets: [],
};

loadEnvFiles();

const ENV = getEnvConfig();

function loadEnvFiles() {
  for (const fileName of ENV_FILES) {
    loadEnvFile(fileName);
  }
}

function loadEnvFile(fileName) {
  const filePath = path.join(ROOT, fileName);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const cleanLine = line.trim();

    if (!cleanLine || cleanLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = cleanLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = cleanLine.slice(0, separatorIndex).trim();
    let value = cleanLine.slice(separatorIndex + 1).trim();

    if (!key || process.env[key]) {
      continue;
    }

    value = value.replace(/^["']|["']$/g, "");

    process.env[key] = value;
  }
}

function getEnvConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    "";

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  const key = serviceRoleKey || anonKey;

  const keySource = serviceRoleKey
    ? "SERVICE_ROLE"
    : anonKey
      ? "ANON_KEY"
      : "MISSING";

  return {
    supabaseUrl,
    serviceRoleKey,
    anonKey,
    key,
    keySource,
  };
}

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] || fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function printHelp() {
  console.log("");
  console.log("VERIFICADOR EPUB PREVIEW");
  console.log("");
  console.log("Uso:");
  console.log('  node scripts/verify-epub-preview.mjs --slug "slug-del-libro"');
  console.log('  node scripts/verify-epub-preview.mjs --book-id "uuid-del-libro"');
  console.log("");
  console.log("Opciones:");
  console.log("  --slug       Slug público del libro.");
  console.log("  --book-id    ID UUID del libro.");
  console.log("  --base-url   URL local o producción. Default: http://localhost:3000");
  console.log("  --fix        Intenta marcar preview_status como ready si todo está bien.");
  console.log("  --skip-api   No prueba el endpoint /api/books/[slug]/epub?mode=preview.");
  console.log("  --skip-page  No prueba la página /catalog/[slug]/preview.");
  console.log("  --json       Imprime reporte JSON al final.");
  console.log("  --timeout    Timeout en milisegundos. Default: 30000.");
  console.log("  --help       Muestra esta ayuda.");
  console.log("");
}

function printSection(title) {
  console.log("");
  console.log("============================================================");
  console.log(` ${title}`);
  console.log("============================================================");
}

function pass(message, details = {}) {
  report.checks.push({
    type: "pass",
    message,
    details,
  });

  console.log(`✅ ${message}`);
}

function warn(message, details = {}) {
  report.warnings.push({
    message,
    details,
  });

  report.checks.push({
    type: "warn",
    message,
    details,
  });

  console.log(`⚠️  ${message}`);
}

function fail(message, details = {}) {
  report.errors.push({
    message,
    details,
  });

  report.checks.push({
    type: "fail",
    message,
    details,
  });

  console.log(`❌ ${message}`);
}

function info(message) {
  console.log(`ℹ️  ${message}`);
}

function fatal(message) {
  throw new Error(message);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function encodePathPart(value) {
  return encodeURIComponent(String(value || ""));
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function readFile(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return "";
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function safeSnippet(text, maxLength = 900) {
  const cleanText = String(text || "").replace(/\0/g, "").trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  return `${cleanText.slice(0, maxLength)}...`;
}

function isProbablyZipOrEpub(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return false;
  }

  const signature = buffer.subarray(0, 4).toString("hex");

  return signature.startsWith("504b");
}

function inspectEpubStructure(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return {
      hasZipSignature: false,
      hasEpubMimeString: false,
      hasMimeTypeEntry: false,
      hasContainer: false,
      hasOpf: false,
      hasNav: false,
      hasXhtml: false,
      firstSignatureHex: "",
      size: 0,
    };
  }

  const firstSignatureHex =
    buffer.length >= 4 ? buffer.subarray(0, 4).toString("hex") : "";

  const text = buffer.toString("latin1");

  return {
    hasZipSignature: isProbablyZipOrEpub(buffer),
    hasEpubMimeString: text.includes("application/epub+zip"),
    hasMimeTypeEntry: text.includes("mimetype"),
    hasContainer: text.includes("META-INF/container.xml"),
    hasOpf:
      text.includes(".opf") ||
      text.includes("content.opf") ||
      text.includes("package.opf"),
    hasNav:
      text.includes("nav.xhtml") ||
      text.includes("toc.ncx") ||
      text.includes("toc.xhtml"),
    hasXhtml: text.includes(".xhtml") || text.includes(".html"),
    firstSignatureHex,
    size: buffer.length,
  };
}

function printStructure(prefix, structure) {
  if (!structure) {
    fail(`${prefix}: estructura no disponible`);
    return;
  }

  if (structure.hasZipSignature) {
    pass(`${prefix}: firma ZIP/EPUB detectada`);
  } else {
    fail(`${prefix}: no inicia como ZIP/EPUB`, {
      firstSignatureHex: structure.firstSignatureHex,
    });
  }

  if (structure.hasEpubMimeString) {
    pass(`${prefix}: contiene application/epub+zip`);
  } else {
    warn(`${prefix}: no se detectó application/epub+zip dentro del archivo`);
  }

  if (structure.hasMimeTypeEntry) {
    pass(`${prefix}: contiene entrada mimetype`);
  } else {
    warn(`${prefix}: no se detectó entrada mimetype`);
  }

  if (structure.hasContainer) {
    pass(`${prefix}: contiene META-INF/container.xml`);
  } else {
    warn(`${prefix}: no se detectó META-INF/container.xml`);
  }

  if (structure.hasOpf) {
    pass(`${prefix}: contiene archivo OPF`);
  } else {
    warn(`${prefix}: no se detectó archivo OPF`);
  }

  if (structure.hasNav) {
    pass(`${prefix}: contiene navegación EPUB`);
  } else {
    warn(`${prefix}: no se detectó nav.xhtml, toc.xhtml o toc.ncx`);
  }

  if (structure.hasXhtml) {
    pass(`${prefix}: contiene archivos HTML/XHTML`);
  } else {
    warn(`${prefix}: no se detectaron archivos HTML/XHTML`);
  }
}

function getLocalRouteStatus() {
  const paths = {
    apiRoute: "app/api/books/[bookkey]/epub/route.ts",
    previewPage: "app/catalog/[slug]/preview/page.tsx",
    readerClient: "components/readers/EpubReaderClient.tsx",

    wrongApiRoute: "app/api/books/epub/route.ts",
    conflictSlugRoute: "app/api/books/[slug]/epub/route.ts",
    conflictIdRoute: "app/api/books/[id]/epub/route.ts",
    editRoute: "app/api/books/[bookkey]/route.ts",
  };

  return Object.fromEntries(
    Object.entries(paths).map(([key, relativePath]) => [
      key,
      {
        relativePath,
        absolutePath: path.join(ROOT, relativePath),
        exists: fileExists(relativePath),
        content: readFile(relativePath),
      },
    ])
  );
}

function checkLocalFiles() {
  printSection("1) VERIFICANDO ARCHIVOS LOCALES");

  const routeStatus = getLocalRouteStatus();

  if (routeStatus.apiRoute.exists) {
    pass("Existe API correcta: app/api/books/[bookkey]/epub/route.ts");
  } else {
    fail("Falta API correcta: app/api/books/[bookkey]/epub/route.ts");
  }

  if (routeStatus.previewPage.exists) {
    pass("Existe página visual: app/catalog/[slug]/preview/page.tsx");
  } else {
    fail("Falta página visual: app/catalog/[slug]/preview/page.tsx");
  }

  if (routeStatus.readerClient.exists) {
    pass("Existe lector EPUB: components/readers/EpubReaderClient.tsx");
  } else {
    fail("Falta lector EPUB: components/readers/EpubReaderClient.tsx");
  }

  if (routeStatus.wrongApiRoute.exists) {
    fail("Existe ruta incorrecta: app/api/books/epub/route.ts");
  } else {
    pass("No existe ruta incorrecta: app/api/books/epub/route.ts");
  }

  if (routeStatus.conflictSlugRoute.exists) {
    warn("Existe ruta potencialmente conflictiva: app/api/books/[slug]/epub/route.ts");
  } else {
    pass("No existe ruta conflictiva: app/api/books/[slug]/epub/route.ts");
  }

  if (routeStatus.conflictIdRoute.exists) {
    warn("Existe ruta potencialmente conflictiva: app/api/books/[id]/epub/route.ts");
  } else {
    pass("No existe ruta conflictiva: app/api/books/[id]/epub/route.ts");
  }

  if (routeStatus.apiRoute.content) {
    checkApiRouteContent(routeStatus.apiRoute.content);
  }

  if (routeStatus.previewPage.content) {
    checkPreviewPageContent(routeStatus.previewPage.content);
  }

  if (routeStatus.readerClient.content) {
    checkReaderClientContent(routeStatus.readerClient.content);
  }

  return routeStatus;
}

function checkApiRouteContent(content) {
  printSection("2) ANALIZANDO API EPUB LOCAL");

  if (/export\s+async\s+function\s+GET/.test(content)) {
    pass("La API EPUB exporta GET");
  } else {
    fail("La API EPUB no exporta GET");
  }

  if (/mode/.test(content) && /preview/.test(content)) {
    pass("La API maneja mode=preview");
  } else {
    fail("La API no parece manejar mode=preview");
  }

  if (/epub_preview/.test(content)) {
    pass("La API busca asset_type epub_preview");
  } else {
    fail("La API no busca asset_type epub_preview");
  }

  if (/book_assets/.test(content)) {
    pass("La API consulta book_assets");
  } else {
    fail("La API no consulta book_assets");
  }

  if (/supabaseAdmin\.storage|storage\s*\./.test(content)) {
    pass("La API usa Supabase Storage");
  } else {
    fail("La API no parece usar Supabase Storage");
  }

  if (/\.download\s*\(/.test(content)) {
    pass("La API descarga el EPUB desde Storage");
  } else {
    fail("La API no descarga el EPUB con storage.download()");
  }

  if (/application\/epub\+zip|Content-Type/.test(content)) {
    pass("La API define Content-Type para EPUB");
  } else {
    warn("La API no define claramente Content-Type application/epub+zip");
  }

  if (/Content-Disposition/.test(content)) {
    pass("La API define Content-Disposition");
  } else {
    warn("La API no define Content-Disposition");
  }

  if (/Cache-Control/.test(content)) {
    pass("La API define Cache-Control");
  } else {
    warn("La API no define Cache-Control");
  }

  if (/X-Content-Type-Options/.test(content)) {
    pass("La API define X-Content-Type-Options");
  } else {
    warn("La API no define X-Content-Type-Options");
  }

  if (/userCanReadFullBook/.test(content) || /mode\s*===\s*["']full["']/.test(content)) {
    pass("La API parece proteger la lectura completa");
  } else {
    warn("La API no parece proteger la lectura completa");
  }
}

function checkPreviewPageContent(content) {
  printSection("3) ANALIZANDO PÁGINA VISUAL DEL PREVIEW");

  if (/EpubReaderClient/.test(content)) {
    pass("La página renderiza EpubReaderClient");
  } else {
    fail("La página no renderiza EpubReaderClient");
  }

  if (/epubUrl/.test(content)) {
    pass("La página envía epubUrl al lector");
  } else {
    fail("La página no envía epubUrl al lector");
  }

  if (/mode=preview/.test(content)) {
    pass("La página usa mode=preview");
  } else {
    fail("La página no usa mode=preview");
  }

  if (/book_assets/.test(content) && /epub_preview/.test(content)) {
    pass("La página verifica que exista asset epub_preview");
  } else {
    warn("La página no parece verificar asset epub_preview antes de renderizar");
  }

  if (/book\.slug|params\.slug|slug/.test(content)) {
    pass("La página trabaja con slug");
  } else {
    warn("La página no parece trabajar con slug");
  }
}

function checkReaderClientContent(content) {
  printSection("4) ANALIZANDO LECTOR EPUB CLIENT");

  if (/["']use client["']/.test(content)) {
    pass("EpubReaderClient es Client Component");
  } else {
    fail("EpubReaderClient no tiene use client");
  }

  if (/epubUrl/.test(content)) {
    pass("EpubReaderClient recibe epubUrl");
  } else {
    fail("EpubReaderClient no recibe epubUrl");
  }

  if (/epubjs|ePub\s*\(|Book\s*\(|rendition|renderTo/.test(content)) {
    pass("EpubReaderClient parece inicializar EPUB.js");
  } else {
    warn("No detecté inicialización clara de EPUB.js");
  }

  if (/catch\s*\(|try\s*{/.test(content)) {
    pass("EpubReaderClient tiene manejo de errores");
  } else {
    warn("EpubReaderClient no parece tener manejo de errores");
  }

  if (/timeout|setTimeout|tard|demasiado/.test(content)) {
    pass("EpubReaderClient tiene control de timeout/carga lenta");
  } else {
    warn("EpubReaderClient no parece tener timeout de carga");
  }

  if (/destroy\s*\(|book\.destroy|rendition\.destroy/.test(content)) {
    pass("EpubReaderClient limpia instancias al desmontar");
  } else {
    warn("EpubReaderClient no parece limpiar instancias del lector");
  }

  if (/META-INF\/container\.xml/.test(content)) {
    warn("EpubReaderClient contiene referencia directa a META-INF/container.xml");
  } else {
    pass("EpubReaderClient no referencia directamente META-INF/container.xml");
  }
}

function checkEnvironment() {
  printSection("5) VERIFICANDO VARIABLES DE ENTORNO");

  if (ENV.supabaseUrl) {
    pass("Supabase URL encontrada");
  } else {
    fail("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL");
  }

  if (ENV.serviceRoleKey) {
    pass("SUPABASE_SERVICE_ROLE_KEY encontrada");
  } else if (ENV.anonKey) {
    warn("Solo encontré ANON KEY. Puede fallar si Storage o tablas tienen RLS privado");
  } else {
    fail("Falta SUPABASE_SERVICE_ROLE_KEY");
  }

  if (ENV.keySource === "ANON_KEY") {
    warn("El script usará ANON KEY. Para diagnóstico real usa SERVICE ROLE KEY");
  }

  return Boolean(ENV.supabaseUrl && ENV.key);
}

function createSupabaseClient() {
  return createClient(ENV.supabaseUrl, ENV.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "verify-epub-preview-script",
      },
    },
  });
}

async function findBook({ supabase, slug, bookId }) {
  printSection("6) BUSCANDO LIBRO EN SUPABASE");

  let query = supabase.from("books").select("*").limit(1);

  if (bookId) {
    query = query.eq("id", bookId);
  } else {
    query = query.eq("slug", slug);
  }

  const { data, error } = await query;

  if (error) {
    fatal(`Error buscando libro: ${error.message}`);
  }

  const book = data?.[0] || null;

  if (!book) {
    fatal("Libro no encontrado en la tabla books");
  }

  report.book = {
    id: book.id,
    title: book.title,
    slug: book.slug,
    status: book.status,
    preview_mode: book.preview_mode,
    preview_status: book.preview_status,
    preview_layout: book.preview_layout,
    preview_error: book.preview_error,
    preview_generated_at: book.preview_generated_at,
  };

  pass("Libro encontrado en books");
  console.log(`Título: ${book.title || "SIN_TITULO"}`);
  console.log(`ID: ${book.id}`);
  console.log(`Slug: ${book.slug}`);
  console.log(`Status: ${book.status || "SIN_STATUS"}`);
  console.log(`preview_mode: ${book.preview_mode || "SIN_PREVIEW_MODE"}`);
  console.log(`preview_status: ${book.preview_status || "SIN_PREVIEW_STATUS"}`);
  console.log(`preview_layout: ${book.preview_layout || "SIN_PREVIEW_LAYOUT"}`);
  console.log(`preview_error: ${book.preview_error || "ninguno"}`);
  console.log(`preview_generated_at: ${book.preview_generated_at || "no"}`);

  if (book.preview_status && book.preview_status !== "ready") {
    warn("preview_status no está en ready");
  }

  if (book.preview_error) {
    warn("El libro tiene preview_error guardado", {
      preview_error: book.preview_error,
    });
  }

  return book;
}

async function getBookAssets({ supabase, bookId }) {
  printSection("7) VERIFICANDO ASSETS DEL LIBRO");

  const { data, error } = await supabase
    .from("book_assets")
    .select("*")
    .eq("book_id", bookId)
    .order("sort_order", { ascending: true });

  if (error) {
    fatal(`Error leyendo book_assets: ${error.message}`);
  }

  const assets = data || [];

  report.assets = assets.map((asset) => ({
    id: asset.id,
    asset_type: asset.asset_type,
    storage_bucket: asset.storage_bucket,
    storage_path: asset.storage_path,
    file_url: asset.file_url,
    mime_type: asset.mime_type,
    is_public: asset.is_public,
    sort_order: asset.sort_order,
  }));

  if (assets.length === 0) {
    fatal("Este libro no tiene assets guardados en book_assets");
  }

  for (const asset of assets) {
    console.log(
      `- ${asset.asset_type || "SIN_TYPE"}: ${asset.storage_bucket || "SIN_BUCKET"}/${asset.storage_path || "SIN_PATH"} | mime=${asset.mime_type || "SIN_MIME"} | public=${asset.is_public}`
    );
  }

  const coverAsset = findAsset(assets, ["cover"]);
  const epubAsset = findAsset(assets, ["epub"]);
  const previewAsset = findAsset(assets, ["epub_preview"]);
  const wrongPreviewAsset = findAsset(assets, ["preview_epub", "epub-preview", "preview"]);

  console.log("");
  console.log(`cover: ${coverAsset ? "✅" : "❌"}`);
  console.log(`epub completo: ${epubAsset ? "✅" : "❌"}`);
  console.log(`epub_preview: ${previewAsset ? "✅" : "❌"}`);

  if (coverAsset) {
    pass("Asset cover encontrado");
  } else {
    warn("No encontré asset cover");
  }

  if (epubAsset) {
    pass("Asset epub completo encontrado");
  } else {
    warn("No encontré asset epub completo");
  }

  if (previewAsset) {
    pass("Asset epub_preview encontrado");
  } else if (wrongPreviewAsset) {
    fail("No existe asset_type epub_preview, pero encontré un asset parecido mal nombrado", {
      found: wrongPreviewAsset.asset_type,
    });
  } else {
    fail("No existe asset_type epub_preview");
  }

  if (!previewAsset) {
    fatal("Debes subir o registrar el EPUB preview como asset_type='epub_preview'");
  }

  if (!previewAsset.storage_bucket) {
    fatal("El asset epub_preview no tiene storage_bucket");
  }

  if (!previewAsset.storage_path) {
    fatal("El asset epub_preview no tiene storage_path");
  }

  if (previewAsset.mime_type === "application/epub+zip") {
    pass("mime_type del preview correcto: application/epub+zip");
  } else {
    warn(`mime_type del preview no es application/epub+zip. Actual: ${previewAsset.mime_type || "SIN_MIME"}`);
  }

  return {
    assets,
    coverAsset,
    epubAsset,
    previewAsset,
  };
}

function findAsset(assets, assetTypes) {
  return assets.find((asset) => {
    return (
      assetTypes.includes(asset.asset_type) &&
      Boolean(asset.storage_bucket) &&
      Boolean(asset.storage_path)
    );
  });
}

async function downloadStorageAsset(supabase, asset) {
  printSection("8) DESCARGANDO EPUB PREVIEW DESDE SUPABASE STORAGE");

  const { data, error } = await supabase.storage
    .from(asset.storage_bucket)
    .download(asset.storage_path);

  if (error || !data) {
    return {
      ok: false,
      error: error?.message || "No se pudo descargar desde Storage",
      size: 0,
      buffer: Buffer.alloc(0),
      structure: null,
    };
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const structure = inspectEpubStructure(buffer);

  return {
    ok: true,
    error: "",
    size: buffer.length,
    buffer,
    structure,
  };
}

async function verifyStorage({ supabase, previewAsset }) {
  const storageResult = await downloadStorageAsset(supabase, previewAsset);

  console.log(`Storage OK: ${storageResult.ok ? "✅" : "❌"}`);
  console.log(`Tamaño: ${formatBytes(storageResult.size)}`);

  if (!storageResult.ok) {
    fatal(storageResult.error);
  }

  if (storageResult.size > 0) {
    pass("El archivo se descargó desde Storage");
  } else {
    fail("El archivo descargado desde Storage está vacío");
  }

  if (storageResult.size < MIN_EPUB_SIZE_BYTES) {
    fail("El EPUB preview pesa demasiado poco");
  } else {
    pass("El EPUB preview tiene tamaño razonable");
  }

  printStructure("Storage", storageResult.structure);

  if (!storageResult.structure?.hasZipSignature) {
    fatal("El archivo preview_epub no parece ser un EPUB válido. No inicia como ZIP/PK");
  }

  return storageResult;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function verifyApiRoute({ baseUrl, slug, timeoutMs }) {
  printSection("9) VERIFICANDO ENDPOINT API EPUB");

  const url = `${normalizeBaseUrl(baseUrl)}/api/books/${encodePathPart(slug)}/epub?mode=preview`;

  report.urls.api = url;

  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        accept: "application/epub+zip,*/*",
      },
    },
    timeoutMs
  );

  const contentType = response.headers.get("content-type") || "";
  const contentDisposition = response.headers.get("content-disposition") || "";
  const cacheControl = response.headers.get("cache-control") || "";

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const firstText = buffer.subarray(0, 900).toString("utf8");
  const structure = inspectEpubStructure(buffer);

  const looksLikeHtml =
    contentType.includes("text/html") ||
    firstText.includes("<!DOCTYPE html") ||
    firstText.includes("<html");

  const looksLikeJson =
    contentType.includes("application/json") ||
    firstText.trim().startsWith("{") ||
    firstText.trim().startsWith("[");

  console.log(`URL: ${url}`);
  console.log(`HTTP status: ${response.status}`);
  console.log(`Content-Type: ${contentType || "SIN_CONTENT_TYPE"}`);
  console.log(`Content-Disposition: ${contentDisposition || "SIN_CONTENT_DISPOSITION"}`);
  console.log(`Cache-Control: ${cacheControl || "SIN_CACHE_CONTROL"}`);
  console.log(`Tamaño respuesta: ${formatBytes(buffer.length)}`);

  if (response.ok) {
    pass("La API respondió con status OK");
  } else {
    fail(`La API respondió con status ${response.status}`);
  }

  if (looksLikeHtml) {
    fail("La API está devolviendo HTML");
  } else {
    pass("La API no parece devolver HTML");
  }

  if (looksLikeJson) {
    fail("La API está devolviendo JSON/error");
  } else {
    pass("La API no parece devolver JSON/error");
  }

  if (contentType.includes("application/epub+zip")) {
    pass("La API devuelve Content-Type application/epub+zip");
  } else {
    warn(`La API no devuelve Content-Type application/epub+zip. Actual: ${contentType || "SIN_CONTENT_TYPE"}`);
  }

  printStructure("API", structure);

  if (!response.ok || looksLikeHtml || looksLikeJson || !structure.hasZipSignature) {
    console.log("");
    console.log("Respuesta inicial de la API:");
    console.log(safeSnippet(firstText));

    fatal("La ruta API no está devolviendo un EPUB válido");
  }

  return {
    url,
    status: response.status,
    ok: response.ok,
    contentType,
    contentDisposition,
    cacheControl,
    size: buffer.length,
    firstText,
    looksLikeHtml,
    looksLikeJson,
    structure,
  };
}

async function verifyPreviewPage({ baseUrl, slug, timeoutMs }) {
  printSection("10) VERIFICANDO PÁGINA VISUAL DEL PREVIEW");

  const url = `${normalizeBaseUrl(baseUrl)}/catalog/${encodePathPart(slug)}/preview`;

  report.urls.page = url;

  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        accept: "text/html,*/*",
      },
    },
    timeoutMs
  );

  const html = await response.text();

  const hasReader =
    html.includes("Preview del libro") ||
    html.includes("Vista previa EPUB") ||
    html.includes("Cargando EPUB") ||
    html.includes("Lector EPUB") ||
    html.includes("epub?mode=preview") ||
    html.includes("/epub?mode=preview") ||
    html.includes("EpubReaderClient") ||
    html.includes("Preparando lectura interna");

  const hasKnownBookNotFound =
    html.includes("No se encontró el libro.") ||
    html.includes("Libro no encontrado") ||
    html.includes("Este libro no tiene EPUB preview guardado.") ||
    html.includes("Este libro no tiene EPUB preview.");

  const hasFrameworkNotFound =
    html.includes("This page could not be found") ||
    html.includes("Página no encontrada") ||
    html.includes("404") ||
    html.includes("not-found");

  const hasReal404 =
    response.status === 404 ||
    ((hasKnownBookNotFound || hasFrameworkNotFound) && !hasReader);

  console.log(`URL: ${url}`);
  console.log(`HTTP status: ${response.status}`);
  console.log(`Tamaño HTML: ${formatBytes(Buffer.byteLength(html, "utf8"))}`);

  if (response.ok) {
    pass("La página visual respondió OK");
  } else {
    fail(`La página visual respondió status ${response.status}`);
  }

  if (hasReader) {
    pass("La página parece contener el lector o el punto de montaje");
  } else {
    warn("La página responde, pero no detecté claramente el lector en HTML");
  }

  if (hasKnownBookNotFound) {
    fail("La página muestra error conocido de libro o preview faltante");
  } else {
    pass("La página no muestra error conocido de libro o preview faltante");
  }

  if (hasReal404) {
    fail("La página parece estar en 404 real o estado de error");
  } else {
    pass("La página no parece 404 real");
  }

  if (!response.ok || hasReal404) {
    console.log("");
    console.log("HTML inicial:");
    console.log(safeSnippet(html));

    fatal("La página visual del preview no está funcionando correctamente");
  }

  return {
    url,
    status: response.status,
    ok: response.ok,
    hasReader,
    hasKnownBookNotFound,
    hasFrameworkNotFound,
    has404: hasReal404,
    htmlSize: html.length,
  };
}

async function applyPreviewFix({ supabase, book }) {
  printSection("11) APLICANDO FIX DE ESTADO PREVIEW");

  if (ENV.keySource !== "SERVICE_ROLE") {
    fatal("Para usar --fix necesitas SUPABASE_SERVICE_ROLE_KEY");
  }

  const now = new Date().toISOString();

  const updatePayload = {};

  if ("preview_mode" in book) {
    updatePayload.preview_mode = "epub_preview";
  }

  if ("preview_status" in book) {
    updatePayload.preview_status = "ready";
  }

  if ("preview_layout" in book) {
    updatePayload.preview_layout = "epub_reader";
  }

  if ("preview_error" in book) {
    updatePayload.preview_error = null;
  }

  if ("preview_generated_at" in book) {
    updatePayload.preview_generated_at = now;
  }

  if ("updated_at" in book) {
    updatePayload.updated_at = now;
  }

  if (Object.keys(updatePayload).length === 0) {
    warn("No encontré columnas de preview para actualizar");
    return;
  }

  const { error } = await supabase
    .from("books")
    .update(updatePayload)
    .eq("id", book.id);

  if (error) {
    fatal(`No se pudo aplicar el fix: ${error.message}`);
  }

  pass("Estado del preview actualizado correctamente");
}

function printFinalSummary() {
  printSection("RESULTADO FINAL");

  const passCount = report.checks.filter((check) => check.type === "pass").length;
  const warnCount = report.checks.filter((check) => check.type === "warn").length;
  const failCount = report.checks.filter((check) => check.type === "fail").length;
  const totalCount = report.checks.length;
  const score = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  console.log(`Checks OK: ${passCount}`);
  console.log(`Avisos: ${warnCount}`);
  console.log(`Errores: ${failCount}`);
  console.log(`Puntaje técnico: ${score}%`);
  console.log("");

  if (failCount === 0) {
    console.log("✅ EPUB preview verificado correctamente.");
    console.log("");
    console.log("Backend:");
    console.log("- Libro encontrado ✅");
    console.log("- Asset epub_preview encontrado ✅");
    console.log("- Storage OK ✅");
    console.log("- API EPUB OK ✅");
    console.log("- Página visual OK ✅");
    console.log("");
    console.log("Si en navegador todavía se ve atenuado, el problema probablemente está en:");
    console.log("- EpubReaderClient.tsx");
    console.log("- CSS/overlay/loading del lector");
    console.log("- EPUB válido pero pesado o mal estructurado internamente");
  } else {
    console.log("❌ EPUB preview todavía tiene problemas.");
    console.log("");
    console.log("Causas probables:");
    console.log("- Falta book_assets.asset_type = epub_preview");
    console.log("- storage_bucket o storage_path están vacíos o incorrectos");
    console.log("- El archivo no existe realmente en Supabase Storage");
    console.log("- La API devuelve JSON/HTML en vez de EPUB");
    console.log("- El EPUB está corrupto o no inicia como ZIP/PK");
    console.log("- La página visual no está apuntando al endpoint correcto");
    console.log("- El lector intenta resolver META-INF/container.xml contra localhost");
  }

  console.log("");

  if (report.urls.api) {
    console.log(`API útil: ${report.urls.api}`);
  }

  if (report.urls.page) {
    console.log(`Página útil: ${report.urls.page}`);
  }

  if (hasFlag("--json")) {
    console.log("");
    console.log("REPORTE JSON:");
    console.log(
      JSON.stringify(
        {
          ...report,
          finishedAt: new Date().toISOString(),
          summary: {
            passCount,
            warnCount,
            failCount,
            totalCount,
            score,
          },
        },
        null,
        2
      )
    );
  }

  process.exitCode = failCount > 0 ? 1 : 0;
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  const slug = getArg("--slug");
  const bookId = getArg("--book-id");
  const baseUrl = getArg("--base-url", DEFAULT_BASE_URL);
  const timeoutMs = Number(getArg("--timeout", String(DEFAULT_TIMEOUT_MS)));
  const fix = hasFlag("--fix");
  const skipApi = hasFlag("--skip-api");
  const skipPage = hasFlag("--skip-page");

  report.args = {
    slug,
    bookId,
    baseUrl,
    timeoutMs,
    fix,
    skipApi,
    skipPage,
  };

  printSection("VERIFICADOR AVANZADO EPUB PREVIEW");

  console.log(`Root: ${ROOT}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Timeout: ${timeoutMs} ms`);
  console.log(`Modo fix: ${fix ? "sí" : "no"}`);
  console.log("");

  if (!slug && !bookId) {
    fatal('Debes pasar --slug "slug-del-libro" o --book-id "uuid-del-libro"');
  }

  checkLocalFiles();

  const hasEnv = checkEnvironment();

  if (!hasEnv) {
    fatal("Faltan variables de entorno para consultar Supabase");
  }

  const supabase = createSupabaseClient();

  const book = await findBook({
    supabase,
    slug,
    bookId,
  });

  const { previewAsset } = await getBookAssets({
    supabase,
    bookId: book.id,
  });

  await verifyStorage({
    supabase,
    previewAsset,
  });

  if (!skipApi) {
    await verifyApiRoute({
      baseUrl,
      slug: book.slug,
      timeoutMs,
    });
  } else {
    warn("Saltando verificación de API por --skip-api");
  }

  if (!skipPage) {
    await verifyPreviewPage({
      baseUrl,
      slug: book.slug,
      timeoutMs,
    });
  } else {
    warn("Saltando verificación de página por --skip-page");
  }

  if (fix) {
    await applyPreviewFix({
      supabase,
      book,
    });
  }

  printFinalSummary();
}

main().catch((error) => {
  console.error("");
  console.error("❌ Verificación fallida:");
  console.error(error instanceof Error ? error.message : error);

  report.errors.push({
    message: error instanceof Error ? error.message : String(error),
    details: {},
  });

  if (hasFlag("--json")) {
    console.error("");
    console.error("REPORTE JSON:");
    console.error(
      JSON.stringify(
        {
          ...report,
          finishedAt: new Date().toISOString(),
          crashed: true,
        },
        null,
        2
      )
    );
  }

  process.exitCode = 1;
});