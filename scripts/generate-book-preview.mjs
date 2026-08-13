import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

loadEnvFile(".env.local");
loadEnvFile(".env");

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE;

const PDF_SCRIPT = path.join(ROOT, "scripts", "generate-book-preview-pdf.mjs");

function loadEnvFile(fileName) {
  const filePath = path.join(ROOT, fileName);

  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const cleanLine = line.trim();

    if (!cleanLine || cleanLine.startsWith("#")) continue;

    const separatorIndex = cleanLine.indexOf("=");

    if (separatorIndex === -1) continue;

    const key = cleanLine.slice(0, separatorIndex).trim();
    const rawValue = cleanLine.slice(separatorIndex + 1).trim();

    if (!key || process.env[key]) continue;

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function getArg(name) {
  const index = process.argv.indexOf(name);

  if (index === -1) return "";

  return process.argv[index + 1] || "";
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function printUsage() {
  console.log("");
  console.log("Uso:");
  console.log("npm run preview:book -- --slug SLUG_DEL_LIBRO");
  console.log("npm run preview:book -- --book-id UUID");
  console.log("");
}

function runPdfPreviewScript() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(PDF_SCRIPT)) {
      reject(
        new Error(
          `No existe ${PDF_SCRIPT}. Renombra tu script viejo a generate-book-preview-pdf.mjs`
        )
      );
      return;
    }

    const child = spawn(process.execPath, [PDF_SCRIPT, ...process.argv.slice(2)], {
      stdio: "inherit",
      shell: false,
      windowsHide: false,
    });

    child.on("error", reject);

    child.on("close", (code) => {
      resolve(code ?? 0);
    });
  });
}

function getAsset(assets, ...types) {
  return assets.find(
    (asset) =>
      types.includes(asset.asset_type) &&
      asset.storage_bucket &&
      asset.storage_path
  );
}

async function main() {
  const slug = getArg("--slug");
  const bookId = getArg("--book-id");

  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  if (!slug && !bookId) {
    throw new Error("Debes pasar --slug SLUG_DEL_LIBRO o --book-id UUID");
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Faltan variables de Supabase: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let bookQuery = supabase
    .from("books")
    .select(
      `
      id,
      title,
      slug,
      preview_mode,
      preview_status,
      preview_layout
    `
    )
    .limit(1);

  if (bookId) {
    bookQuery = bookQuery.eq("id", bookId);
  } else {
    bookQuery = bookQuery.eq("slug", slug);
  }

  const { data: books, error: bookError } = await bookQuery;

  if (bookError) {
    throw new Error(`Error buscando libro: ${bookError.message}`);
  }

  const book = books?.[0];

  if (!book) {
    throw new Error("Libro no encontrado");
  }

  console.log("");
  console.log(`Libro: ${book.title}`);
  console.log(`ID: ${book.id}`);
  console.log(`Slug: ${book.slug}`);

  const { data: assets, error: assetsError } = await supabase
    .from("book_assets")
    .select(
      `
      id,
      asset_type,
      storage_bucket,
      storage_path,
      mime_type,
      is_public,
      sort_order
    `
    )
    .eq("book_id", book.id)
    .order("sort_order", { ascending: true });

  if (assetsError) {
    throw new Error(`Error buscando assets: ${assetsError.message}`);
  }

  const list = assets || [];

  const pdfAsset = getAsset(list, "pdf", "manuscript", "manuscript_pdf");
  const epubAsset = getAsset(list, "epub");
  const epubPreviewAsset = getAsset(list, "epub_preview");

  console.log("");
  console.log("Assets encontrados:");

  if (list.length === 0) {
    console.log(" - Ninguno");
  } else {
    for (const asset of list) {
      console.log(
        ` - ${asset.asset_type}: ${asset.storage_bucket || "SIN_BUCKET"}/${
          asset.storage_path || "SIN_PATH"
        }`
      );
    }
  }

  if (pdfAsset) {
    console.log("");
    console.log("Modo detectado: PDF");
    console.log("Ejecutando generador PDF...");
    console.log("");

    const exitCode = await runPdfPreviewScript();

    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }

    return;
  }

  if (epubPreviewAsset) {
    console.log("");
    console.log("Modo detectado: EPUB preview");
    console.log("No se genera preview por páginas porque EPUB no usa páginas fijas.");

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("books")
      .update({
        preview_mode: "epub_preview",
        preview_status: "ready",
        preview_layout: "epub_reader",
        preview_error: null,
        preview_generated_at: now,
        updated_at: now,
      })
      .eq("id", book.id);

    if (updateError) {
      throw new Error(`Error actualizando preview EPUB: ${updateError.message}`);
    }

    console.log("");
    console.log("✅ Preview EPUB listo.");
    console.log("");
    console.log("Prueba esta ruta:");
    console.log(
      `/api/books/${book.slug}/epub?mode=preview`
    );
    console.log("");

    return;
  }

  if (epubAsset && !epubPreviewAsset) {
    const message =
      "El libro tiene EPUB completo, pero no tiene EPUB preview. Debes subir un archivo preview_epub.";

    await supabase
      .from("books")
      .update({
        preview_mode: "epub_preview",
        preview_status: "unsupported",
        preview_layout: "epub_reader",
        preview_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", book.id);

    throw new Error(message);
  }

  throw new Error(
    "El libro no tiene PDF privado ni EPUB preview con storage_bucket/storage_path."
  );
}

main().catch((error) => {
  console.error("");
  console.error("Error generando preview:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});