import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const clean = line.trim();

    if (!clean || clean.startsWith("#")) {
      continue;
    }

    const index = clean.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = clean.slice(0, index).trim();
    let value = clean.slice(index + 1).trim();

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

  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function requireArg(name) {
  const value = getArg(name);

  if (!value) {
    throw new Error(`Falta el argumento obligatorio --${name}`);
  }

  return value;
}

function safeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function extractPageNumber(fileName) {
  const match = fileName.match(/(\d+)\.png$/i);

  if (!match) {
    return 0;
  }

  return Number(match[1]);
}

async function findBook(supabase, bookkey) {
  const query = supabase
    .from("books")
    .select("id, title, slug, preview_status, preview_mode, preview_page_count");

  if (isUuid(bookkey)) {
    const { data, error } = await query.eq("id", bookkey).maybeSingle();

    if (error) {
      throw new Error(`Error buscando libro por id: ${error.message}`);
    }

    return data;
  }

  const { data, error } = await query.eq("slug", bookkey).maybeSingle();

  if (error) {
    throw new Error(`Error buscando libro por slug: ${error.message}`);
  }

  return data;
}

async function main() {
  const bookkey = requireArg("slug");
  const imagesDir = path.resolve(requireArg("images-dir"));
  const pagesLimit = 25;

  if (!fs.existsSync(imagesDir)) {
    throw new Error(`No existe la carpeta de imagenes: ${imagesDir}`);
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL en .env.local");
  }

  if (!supabaseServiceKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  console.log("");
  console.log("Buscando libro en Supabase...");

  const book = await findBook(supabase, bookkey);

  if (!book) {
    throw new Error(`No existe libro con slug/id: ${bookkey}`);
  }

  console.log(`Libro encontrado: ${book.title || book.slug}`);
  console.log(`Book ID: ${book.id}`);

  const imageFiles = fs
    .readdirSync(imagesDir)
    .filter((file) => file.toLowerCase().endsWith(".png"))
    .sort((a, b) => extractPageNumber(a) - extractPageNumber(b))
    .slice(0, pagesLimit);

  if (imageFiles.length === 0) {
    throw new Error(`No encontre imagenes PNG en: ${imagesDir}`);
  }

  console.log("");
  console.log(`Imagenes encontradas: ${imageFiles.length}`);

  const previewBucket = "book-previews";
  const previewFolder = `previews/${safeSlug(book.slug || bookkey)}-${book.id}-${Date.now()}`;

  console.log("");
  console.log("Marcando libro como processing...");

  await supabase
    .from("books")
    .update({
      preview_status: "processing",
      preview_mode: "pdf_images",
      updated_at: new Date().toISOString()
    })
    .eq("id", book.id);

  console.log("");
  console.log("Borrando preview anterior...");

  const { error: deleteError } = await supabase
    .from("book_preview_pages")
    .delete()
    .eq("book_id", book.id);

  if (deleteError) {
    throw new Error(`No pude borrar preview anterior: ${deleteError.message}`);
  }

  const rows = [];

  for (let index = 0; index < imageFiles.length; index++) {
    const fileName = imageFiles[index];
    const pageNumber = index + 1;
    const localImagePath = path.join(imagesDir, fileName);
    const imageBuffer = fs.readFileSync(localImagePath);

    const storagePath = `${previewFolder}/page-${String(pageNumber).padStart(3, "0")}.png`;

    console.log(`Subiendo pagina ${pageNumber}/${imageFiles.length}: ${storagePath}`);

    const { error: uploadError } = await supabase.storage
      .from(previewBucket)
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Error subiendo pagina ${pageNumber}: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(previewBucket)
      .getPublicUrl(storagePath);

    rows.push({
      book_id: book.id,
      page_index: index,
      source_page_number: pageNumber,
      page_number: pageNumber,
      kind: "pdf_page",
      image_path: storagePath,
      image_url: publicUrlData.publicUrl,
      storage_bucket: previewBucket,
      storage_path: storagePath,
      width: null,
      height: null,
      updated_at: new Date().toISOString()
    });
  }

  console.log("");
  console.log("Insertando filas en book_preview_pages...");

  const { error: insertError } = await supabase
    .from("book_preview_pages")
    .upsert(rows, {
      onConflict: "book_id,page_index"
    });

  if (insertError) {
    throw new Error(`Error insertando paginas: ${insertError.message}`);
  }

  console.log("");
  console.log("Actualizando estado del libro...");

  const { error: updateError } = await supabase
    .from("books")
    .update({
      preview_status: "ready",
      preview_mode: "pdf_images",
      preview_page_count: imageFiles.length,
      updated_at: new Date().toISOString()
    })
    .eq("id", book.id);

  if (updateError) {
    throw new Error(`Error actualizando books: ${updateError.message}`);
  }

  console.log("");
  console.log("============================================");
  console.log("PREVIEW SUBIDO CORRECTAMENTE");
  console.log("============================================");
  console.log(`Libro: ${book.title || book.slug}`);
  console.log(`Paginas subidas: ${imageFiles.length}`);
  console.log(`Bucket: ${previewBucket}`);
  console.log(`Carpeta: ${previewFolder}`);
  console.log("");
}

main().catch(async (error) => {
  console.error("");
  console.error("ERROR:");
  console.error(error.message || error);
  process.exit(1);
});
