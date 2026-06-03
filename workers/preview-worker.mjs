import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

function loadEnvFile(fileName) {
  const filePath = path.join(PROJECT_ROOT, fileName);

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

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL) {
  throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL.");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function extractPageNumber(fileName) {
  const match = fileName.match(/(\d+)\.png$/i);

  if (!match) {
    return 0;
  }

  return Number(match[1]);
}

function assertPopplerAvailable() {
  const result = spawnSync("pdftoppm", ["-v"], {
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.error) {
    throw new Error(
      "Poppler no está disponible. Instala con: winget install -e --id oschwartz10612.Poppler"
    );
  }
}

async function getNextPendingJob() {
  const { data, error } = await supabase
    .from("book_preview_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Error buscando trabajos pendientes: ${error.message}`);
  }

  return data?.[0] || null;
}

async function lockJob(job) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("book_preview_jobs")
    .update({
      status: "processing",
      attempts: Number(job.attempts || 0) + 1,
      locked_at: now,
      updated_at: now,
      error_message: null
    })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Error bloqueando job: ${error.message}`);
  }

  return data;
}

async function updateBookStatus(bookId, status, pageCount = null) {
  const payload = {
    preview_status: status,
    preview_mode: "pdf_images",
    updated_at: new Date().toISOString()
  };

  if (pageCount !== null) {
    payload.preview_page_count = pageCount;
  }

  const { error } = await supabase
    .from("books")
    .update(payload)
    .eq("id", bookId);

  if (error) {
    throw new Error(`Error actualizando books: ${error.message}`);
  }
}

async function markJobReady(job, pageCount) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("book_preview_jobs")
    .update({
      status: "ready",
      processed_at: now,
      updated_at: now,
      error_message: null
    })
    .eq("id", job.id);

  if (error) {
    throw new Error(`Error marcando job ready: ${error.message}`);
  }

  await updateBookStatus(job.book_id, "ready", pageCount);
}

async function markJobFailed(job, message) {
  const now = new Date().toISOString();

  await supabase
    .from("book_preview_jobs")
    .update({
      status: "failed",
      error_message: String(message || "Error desconocido").slice(0, 2000),
      updated_at: now
    })
    .eq("id", job.id);

  await supabase
    .from("books")
    .update({
      preview_status: "failed",
      preview_mode: "pdf_images",
      updated_at: now
    })
    .eq("id", job.book_id);
}

async function getBook(bookId) {
  const { data, error } = await supabase
    .from("books")
    .select("id, title, slug")
    .eq("id", bookId)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando libro: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Libro no encontrado: ${bookId}`);
  }

  return data;
}

async function downloadPdf(job, workDir) {
  console.log(`Descargando PDF: ${job.pdf_bucket}/${job.pdf_path}`);

  const { data, error } = await supabase.storage
    .from(job.pdf_bucket)
    .download(job.pdf_path);

  if (error) {
    throw new Error(`No se pudo descargar PDF: ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const pdfPath = path.join(workDir, "source.pdf");

  fs.writeFileSync(pdfPath, buffer);

  return pdfPath;
}

function convertPdfToImages({ pdfPath, outputDir, pages, dpi }) {
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPrefix = path.join(outputDir, "page");

  console.log(`Convirtiendo PDF con Poppler. Páginas: ${pages}. DPI: ${dpi}.`);

  const result = spawnSync(
    "pdftoppm",
    [
      "-png",
      "-f",
      "1",
      "-l",
      String(pages),
      "-r",
      String(dpi),
      pdfPath,
      outputPrefix
    ],
    {
      encoding: "utf8",
      stdio: "pipe"
    }
  );

  if (result.error) {
    throw new Error(`Error ejecutando pdftoppm: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      [
        "Poppler falló convirtiendo el PDF.",
        result.stdout || "",
        result.stderr || ""
      ].join("\n")
    );
  }

  const images = fs
    .readdirSync(outputDir)
    .filter((file) => file.toLowerCase().endsWith(".png"))
    .sort((a, b) => extractPageNumber(a) - extractPageNumber(b));

  if (images.length === 0) {
    throw new Error("Poppler no generó imágenes PNG.");
  }

  return images;
}

async function uploadPreviewImages({ book, outputDir, images }) {
  const previewBucket = "book-previews";
  const previewFolder = `previews/${safeSlug(book.slug || book.id)}-${book.id}-${Date.now()}`;
  const now = new Date().toISOString();

  console.log("Borrando preview anterior...");

  const { error: deleteError } = await supabase
    .from("book_preview_pages")
    .delete()
    .eq("book_id", book.id);

  if (deleteError) {
    throw new Error(`No se pudo limpiar preview anterior: ${deleteError.message}`);
  }

  const rows = [];

  for (let index = 0; index < images.length; index++) {
    const pageNumber = index + 1;
    const imageFile = images[index];
    const localImagePath = path.join(outputDir, imageFile);
    const imageBuffer = fs.readFileSync(localImagePath);
    const storagePath = `${previewFolder}/page-${String(pageNumber).padStart(3, "0")}.png`;

    console.log(`Subiendo página ${pageNumber}/${images.length}`);

    const { error: uploadError } = await supabase.storage
      .from(previewBucket)
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Error subiendo página ${pageNumber}: ${uploadError.message}`);
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
      updated_at: now
    });
  }

  console.log("Insertando filas en book_preview_pages...");

  const { error: insertError } = await supabase
    .from("book_preview_pages")
    .upsert(rows, {
      onConflict: "book_id,page_index"
    });

  if (insertError) {
    throw new Error(`Error insertando páginas: ${insertError.message}`);
  }

  return rows.length;
}

async function processJob(job) {
  console.log("");
  console.log("============================================");
  console.log(`Procesando job: ${job.id}`);
  console.log(`Book ID: ${job.book_id}`);
  console.log(`PDF: ${job.pdf_bucket}/${job.pdf_path}`);
  console.log("============================================");

  const lockedJob = await lockJob(job);

  if (!lockedJob) {
    console.log("Job ya fue tomado por otro proceso. Saltando...");
    return;
  }

  await updateBookStatus(lockedJob.book_id, "processing");

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "book-preview-"));
  const outputDir = path.join(workDir, "pages");

  try {
    const book = await getBook(lockedJob.book_id);
    const pdfPath = await downloadPdf(lockedJob, workDir);

    const images = convertPdfToImages({
      pdfPath,
      outputDir,
      pages: lockedJob.pages || 25,
      dpi: lockedJob.dpi || 120
    });

    const pageCount = await uploadPreviewImages({
      book,
      outputDir,
      images
    });

    await markJobReady(lockedJob, pageCount);

    console.log("");
    console.log("PREVIEW LISTO");
    console.log(`Libro: ${book.title}`);
    console.log(`Páginas generadas: ${pageCount}`);
  } catch (error) {
    await markJobFailed(lockedJob, error.message || error);
    throw error;
  } finally {
    fs.rmSync(workDir, {
      recursive: true,
      force: true
    });
  }
}

async function mainLoop() {
  assertPopplerAvailable();

  console.log("");
  console.log("Worker de previews iniciado.");
  console.log("Esperando trabajos pendientes...");
  console.log("");

  while (true) {
    try {
      const job = await getNextPendingJob();

      if (!job) {
        await sleep(5000);
        continue;
      }

      await processJob(job);
    } catch (error) {
      console.error("");
      console.error("ERROR EN WORKER:");
      console.error(error.message || error);
      await sleep(5000);
    }
  }
}

mainLoop();
