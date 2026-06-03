// ============================================
// ARCHIVO: scripts/verify-fragment-preview.mjs
// ============================================
//
// Verificador avanzado del fragmento/preview del libro.
// Revisa:
// - books
// - book_assets
// - book_preview_pages
// - book_revisions
// - URL de catálogo local
// - estado del preview PDF/tabla
//
// USO:
// node scripts/verify-fragment-preview.mjs --slug "slug-del-libro"
// node scripts/verify-fragment-preview.mjs --book-id "uuid-del-libro"
// node scripts/verify-fragment-preview.mjs --slug "descifrando-las-senales-de-los-tiempos-del-fin" --base-url "http://localhost:3000"
// node scripts/verify-fragment-preview.mjs --slug "descifrando-las-senales-de-los-tiempos-del-fin" --fix
// node scripts/verify-fragment-preview.mjs --slug "descifrando-las-senales-de-los-tiempos-del-fin" --json
//
// REQUISITOS:
// npm install @supabase/supabase-js
//
// VARIABLES:
// NEXT_PUBLIC_SUPABASE_URL=...
// SUPABASE_SERVICE_ROLE_KEY=...
//
// ============================================

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_BASE_URL = "http://localhost:3000";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");

    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

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

function parseArgs(argv) {
  const args = {
    slug: "",
    bookId: "",
    baseUrl: DEFAULT_BASE_URL,
    fix: false,
    json: false,
    skipApi: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const current = argv[i];

    if (current === "--slug") {
      args.slug = argv[++i] || "";
      continue;
    }

    if (current === "--book-id") {
      args.bookId = argv[++i] || "";
      continue;
    }

    if (current === "--base-url") {
      args.baseUrl = argv[++i] || DEFAULT_BASE_URL;
      continue;
    }

    if (current === "--fix") {
      args.fix = true;
      continue;
    }

    if (current === "--json") {
      args.json = true;
      continue;
    }

    if (current === "--skip-api") {
      args.skipApi = true;
      continue;
    }
  }

  return args;
}

function log(message = "", data = undefined) {
  if (data === undefined) {
    console.log(message);
    return;
  }

  console.log(message, data);
}

function printSection(title) {
  console.log("");
  console.log("============================================================");
  console.log(title);
  console.log("============================================================");
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function safeText(value) {
  if (value === null || value === undefined || value === "") return "NO";
  return String(value);
}

function hasStoragePointer(row) {
  return Boolean(row?.storage_bucket && row?.storage_path);
}

function getPublicOrStorageUrl(row) {
  return (
    row?.image_url ||
    row?.file_url ||
    row?.public_url ||
    row?.url ||
    row?.storage_path ||
    ""
  );
}

async function safeSelect({ supabase, table, select, column, value, orderBy }) {
  let query = supabase.from(table).select(select).eq(column, value);

  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending });
  }

  let result = await query;

  if (!result.error) {
    return result;
  }

  const fallbackQuery = supabase.from(table).select("*").eq(column, value);

  let fallback = fallbackQuery;

  if (orderBy) {
    fallback = fallback.order(orderBy.column, { ascending: orderBy.ascending });
  }

  const fallbackResult = await fallback;

  return fallbackResult;
}

async function tryFetch(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "bestseller-preview-verifier/1.0",
      },
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      url,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText: error instanceof Error ? error.message : String(error),
      contentType: null,
      url,
    };
  }
}

async function createSignedUrlIfPossible(supabase, row) {
  if (!hasStoragePointer(row)) return null;

  const { data, error } = await supabase.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env"));
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));

  const args = parseArgs(process.argv);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("ERROR: faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
    process.exitCode = 1;
    return;
  }

  if (!args.slug && !args.bookId) {
    console.error('ERROR: usa --slug "slug-del-libro" o --book-id "uuid-del-libro".');
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const baseUrl = normalizeBaseUrl(args.baseUrl);

  const report = {
    input: args,
    book: null,
    assets: [],
    previewPages: [],
    revisions: [],
    api: {},
    diagnosis: {
      ok: false,
      warnings: [],
      errors: [],
      recommendations: [],
    },
    fixed: false,
  };

  printSection("1) BUSCANDO LIBRO");

  let bookQuery = supabase
    .from("books")
    .select(
      [
        "id",
        "title",
        "slug",
        "preview_mode",
        "preview_status",
        "preview_error",
        "preview_page_count",
        "preview_include_cover",
        "cover_url",
        "status",
        "created_at",
        "updated_at",
      ].join(", ")
    )
    .limit(1);

  if (args.bookId) {
    bookQuery = bookQuery.eq("id", args.bookId);
  } else {
    bookQuery = bookQuery.eq("slug", args.slug);
  }

  const { data: books, error: bookError } = await bookQuery;

  if (bookError) {
    report.diagnosis.errors.push(`Error consultando books: ${bookError.message}`);
    console.error("ERROR consultando books:", bookError.message);
    process.exitCode = 1;
    return;
  }

  const book = books?.[0] || null;

  if (!book) {
    report.diagnosis.errors.push("No se encontró el libro.");
    console.error("ERROR: No se encontró el libro.");
    process.exitCode = 1;
    return;
  }

  report.book = book;

  log("Libro:", {
    id: book.id,
    title: book.title,
    slug: book.slug,
    preview_mode: book.preview_mode,
    preview_status: book.preview_status,
    preview_error: book.preview_error,
    status: book.status,
  });

  printSection("2) REVISANDO book_assets");

  const assetsResult = await safeSelect({
    supabase,
    table: "book_assets",
    select:
      "id, book_id, asset_type, storage_bucket, storage_path, file_url, mime_type, sort_order, created_at",
    column: "book_id",
    value: book.id,
    orderBy: {
      column: "sort_order",
      ascending: true,
    },
  });

  if (assetsResult.error) {
    report.diagnosis.warnings.push(`No se pudo consultar book_assets: ${assetsResult.error.message}`);
    log("ADVERTENCIA book_assets:", assetsResult.error.message);
  } else {
    report.assets = assetsResult.data || [];

    if (report.assets.length === 0) {
      report.diagnosis.warnings.push("No hay registros en book_assets.");
      log("ADVERTENCIA: no hay assets.");
    } else {
      for (const asset of report.assets) {
        log("-", {
          asset_type: asset.asset_type,
          mime_type: asset.mime_type,
          bucket: asset.storage_bucket,
          path: asset.storage_path,
          sort_order: asset.sort_order,
        });
      }
    }
  }

  printSection("3) REVISANDO book_preview_pages");

  const pagesResult = await safeSelect({
    supabase,
    table: "book_preview_pages",
    select:
      "id, book_id, page_number, image_url, storage_bucket, storage_path, width, height, created_at",
    column: "book_id",
    value: book.id,
    orderBy: {
      column: "page_number",
      ascending: true,
    },
  });

  if (pagesResult.error) {
    report.diagnosis.warnings.push(`No se pudo consultar book_preview_pages: ${pagesResult.error.message}`);
    log("ADVERTENCIA book_preview_pages:", pagesResult.error.message);
  } else {
    report.previewPages = pagesResult.data || [];

    if (report.previewPages.length === 0) {
      report.diagnosis.warnings.push("No hay páginas de preview en book_preview_pages.");
      log("ADVERTENCIA: no hay páginas de fragmento.");
    } else {
      for (const page of report.previewPages) {
        log("-", {
          page_number: page.page_number,
          image_url: safeText(page.image_url),
          bucket: page.storage_bucket,
          path: page.storage_path,
          width: page.width,
          height: page.height,
        });
      }
    }
  }

  printSection("4) REVISANDO book_revisions");

  const revisionsResult = await safeSelect({
    supabase,
    table: "book_revisions",
    select:
      "id, book_id, revision_type, storage_bucket, storage_path, file_name, mime_type, created_at",
    column: "book_id",
    value: book.id,
    orderBy: {
      column: "created_at",
      ascending: false,
    },
  });

  if (revisionsResult.error) {
    report.diagnosis.warnings.push(`No se pudo consultar book_revisions: ${revisionsResult.error.message}`);
    log("ADVERTENCIA book_revisions:", revisionsResult.error.message);
  } else {
    report.revisions = revisionsResult.data || [];

    if (report.revisions.length === 0) {
      report.diagnosis.warnings.push("No hay revisiones registradas en book_revisions.");
      log("ADVERTENCIA: no hay revisiones.");
    } else {
      for (const revision of report.revisions.slice(0, 10)) {
        log("-", {
          revision_type: revision.revision_type,
          file_name: revision.file_name,
          mime_type: revision.mime_type,
          created_at: revision.created_at,
        });
      }
    }
  }

  printSection("5) PROBANDO URLs / STORAGE");

  const firstPreviewPage = report.previewPages[0] || null;

  if (firstPreviewPage) {
    const directUrl = getPublicOrStorageUrl(firstPreviewPage);

    if (directUrl && String(directUrl).startsWith("http")) {
      const urlCheck = await tryFetch(directUrl);
      report.api.firstPreviewPageUrl = urlCheck;
      log("Primera página preview URL:", urlCheck);
    } else {
      const signedUrl = await createSignedUrlIfPossible(supabase, firstPreviewPage);

      if (signedUrl) {
        const signedCheck = await tryFetch(signedUrl);
        report.api.firstPreviewPageSignedUrl = signedCheck;
        log("Primera página preview signed URL:", signedCheck);
      } else {
        report.diagnosis.warnings.push("La primera página de preview no tiene URL pública ni signed URL disponible.");
        log("ADVERTENCIA: no se pudo probar URL de primera página.");
      }
    }
  }

  if (!args.skipApi) {
    printSection("6) PROBANDO PÁGINA CATÁLOGO LOCAL");

    const catalogUrl = `${baseUrl}/catalog/${encodeURIComponent(book.slug)}`;
    const catalogCheck = await tryFetch(catalogUrl);

    report.api.catalog = catalogCheck;

    log("Catálogo:", catalogCheck);

    const previewUrl = `${baseUrl}/catalog/${encodeURIComponent(book.slug)}/preview`;
    const previewCheck = await tryFetch(previewUrl);

    report.api.previewPage = previewCheck;

    log("Preview page:", previewCheck);
  }

  printSection("7) DIAGNÓSTICO");

  const hasPdfAsset = report.assets.some((asset) =>
    ["manuscript_pdf", "pdf", "book_pdf"].includes(String(asset.asset_type))
  );

  const hasEpubAsset = report.assets.some((asset) =>
    ["epub", "epub_preview"].includes(String(asset.asset_type))
  );

  const hasPreviewPages = report.previewPages.length > 0;

  if (!hasPdfAsset) {
    report.diagnosis.errors.push("No hay asset PDF principal en book_assets.");
  }

  if (book.preview_mode !== "pdf_images") {
    report.diagnosis.warnings.push(`preview_mode actual es "${book.preview_mode}", recomendado: "pdf_images".`);
  }

  if (hasPreviewPages && book.preview_status !== "ready") {
    report.diagnosis.warnings.push(`Hay páginas en book_preview_pages, pero preview_status es "${book.preview_status}".`);
  }

  if (!hasPreviewPages && hasPdfAsset) {
    report.diagnosis.warnings.push("Hay PDF principal, pero todavía no hay páginas generadas en book_preview_pages.");
    report.diagnosis.recommendations.push("Ejecuta el generador/conversor de PDF a imágenes para poblar book_preview_pages.");
  }

  if (!hasEpubAsset) {
    report.diagnosis.recommendations.push("EPUB no existe. Esto está bien si tu flujo actual es PDF principal + preview por imágenes.");
  }

  if (report.revisions.length === 0) {
    report.diagnosis.recommendations.push("Corrige el constraint book_revisions_revision_type_check si falla al insertar revisiones.");
  }

  report.diagnosis.ok = report.diagnosis.errors.length === 0;

  if (args.fix) {
    printSection("8) FIX AUTOMÁTICO");

    const nextPreviewStatus = hasPreviewPages ? "ready" : "pending";

    const { error: fixError } = await supabase
      .from("books")
      .update({
        preview_mode: "pdf_images",
        preview_status: nextPreviewStatus,
        preview_error: hasPreviewPages
          ? null
          : "Pendiente generar páginas del fragmento desde el PDF principal.",
      })
      .eq("id", book.id);

    if (fixError) {
      report.diagnosis.errors.push(`Error aplicando fix en books: ${fixError.message}`);
      log("ERROR aplicando fix:", fixError.message);
    } else {
      report.fixed = true;
      log("OK: books actualizado.", {
        preview_mode: "pdf_images",
        preview_status: nextPreviewStatus,
      });
    }
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  log("");
  log("Resultado:");
  log({
    ok: report.diagnosis.ok,
    errors: report.diagnosis.errors,
    warnings: report.diagnosis.warnings,
    recommendations: report.diagnosis.recommendations,
    fixed: report.fixed,
  });
}

main().catch((error) => {
  console.error("ERROR FATAL:", error);
  process.exitCode = 1;
});