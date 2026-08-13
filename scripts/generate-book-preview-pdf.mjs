import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import pdfPoppler from "pdf-poppler";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const PREVIEW_BUCKET = "book-previews";
const PREVIEW_PAGE_COUNT = 25;
const DEFAULT_SCALE = 5200;

const pdfConvert =
  pdfPoppler?.convert ?? pdfPoppler?.default?.convert ?? null;

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

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function getExtension(fileName) {
  const cleanName = String(fileName ?? "").split("?")[0];
  const parts = cleanName.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function getImageContentTypeFromExtension(extension) {
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

function getCoverExtension(coverAsset) {
  const fromPath = getExtension(coverAsset?.storage_path);

  if (["jpg", "jpeg", "png", "webp"].includes(fromPath)) {
    return fromPath;
  }

  const mime = String(coverAsset?.mime_type ?? "").toLowerCase();

  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";

  return "jpg";
}

function getPublicUrl(supabase, bucket, storagePath) {
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return publicUrl;
}

async function ensurePreviewBucket(supabase) {
  const { data, error } = await supabase.storage.getBucket(PREVIEW_BUCKET);

  if (!error && data) {
    if (!data.public) {
      const { error: updateError } = await supabase.storage.updateBucket(
        PREVIEW_BUCKET,
        {
          public: true,
          fileSizeLimit: 60 * 1024 * 1024,
          allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
        }
      );

      if (updateError) {
        console.warn(
          `No se pudo marcar ${PREVIEW_BUCKET} como público:`,
          updateError.message
        );
      }
    }

    return;
  }

  const { error: createError } = await supabase.storage.createBucket(
    PREVIEW_BUCKET,
    {
      public: true,
      fileSizeLimit: 60 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    }
  );

  if (createError) {
    throw new Error(
      `No se pudo crear/verificar el bucket ${PREVIEW_BUCKET}: ${createError.message}`
    );
  }
}

async function findBook(supabase, { bookId, slug }) {
  let query = supabase
    .from("books")
    .select("id, title, slug, cover_url, status")
    .limit(1);

  if (bookId) {
    query = query.eq("id", bookId);
  } else if (slug) {
    query = query.eq("slug", slug);
  } else {
    throw new Error("Debes pasar --slug SLUG_DEL_LIBRO o --book-id UUID");
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Error buscando libro: ${error.message}`);
  }

  if (!data) {
    throw new Error("No se encontró el libro.");
  }

  return data;
}

async function findPdfAsset(supabase, bookId) {
  const { data, error } = await supabase
    .from("book_assets")
    .select(
      "id, asset_type, storage_bucket, storage_path, file_url, mime_type, sort_order"
    )
    .eq("book_id", bookId)
    .in("asset_type", ["pdf", "manuscript", "manuscript_pdf"])
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error buscando PDF del libro: ${error.message}`);
  }

  if (!data?.storage_bucket || !data?.storage_path) {
    throw new Error(
      "El libro no tiene asset PDF privado con storage_bucket/storage_path."
    );
  }

  const extension = getExtension(data.storage_path || data.file_url);

  if (extension !== "pdf") {
    throw new Error("El asset encontrado no parece ser PDF.");
  }

  return data;
}

async function findCoverAsset(supabase, bookId) {
  const { data, error } = await supabase
    .from("book_assets")
    .select("asset_type, storage_bucket, storage_path, file_url, mime_type")
    .eq("book_id", bookId)
    .eq("asset_type", "cover")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("No se pudo buscar portada:", error.message);
    return null;
  }

  return data ?? null;
}

async function downloadStorageFile(supabase, bucket, storagePath) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(storagePath);

  if (error || !data) {
    throw new Error(
      `No se pudo descargar ${bucket}/${storagePath}: ${
        error?.message ?? "sin archivo"
      }`
    );
  }

  return Buffer.from(await data.arrayBuffer());
}

async function clearPreviewRows(supabase, bookId) {
  const { error } = await supabase
    .from("book_preview_pages")
    .delete()
    .eq("book_id", bookId);

  if (error) {
    throw new Error(`No se pudieron borrar previews anteriores: ${error.message}`);
  }
}

async function uploadBufferToPreviewBucket(
  supabase,
  { buffer, storagePath, contentType }
) {
  const { error } = await supabase.storage
    .from(PREVIEW_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Error subiendo preview ${storagePath}: ${error.message}`);
  }

  return getPublicUrl(supabase, PREVIEW_BUCKET, storagePath);
}

async function insertPreviewPage(
  supabase,
  {
    bookId,
    pageIndex,
    sourcePageNumber,
    kind,
    imagePath,
    imageUrl,
    width,
    height,
  }
) {
  const payload = {
    book_id: bookId,
    page_index: pageIndex,
    source_page_number: sourcePageNumber,
    kind,
    image_path: imagePath,
    image_url: imageUrl,
    width,
    height,
  };

  const { error } = await supabase.from("book_preview_pages").upsert(payload, {
    onConflict: "book_id,page_index",
  });

  if (error) {
    throw new Error(`Error insertando página preview: ${error.message}`);
  }
}

async function uploadCoverPreview(supabase, { book, coverAsset, previewFolder }) {
  if (!coverAsset?.storage_bucket || !coverAsset?.storage_path) {
    return null;
  }

  const coverBuffer = await downloadStorageFile(
    supabase,
    coverAsset.storage_bucket,
    coverAsset.storage_path
  );

  const extension = getCoverExtension(coverAsset);
  const contentType =
    coverAsset.mime_type || getImageContentTypeFromExtension(extension);

  const imagePath = `${previewFolder}/page-000-cover.${extension}`;

  const imageUrl = await uploadBufferToPreviewBucket(supabase, {
    buffer: coverBuffer,
    storagePath: imagePath,
    contentType,
  });

  await insertPreviewPage(supabase, {
    bookId: book.id,
    pageIndex: 0,
    sourcePageNumber: null,
    kind: "cover",
    imagePath,
    imageUrl,
    width: null,
    height: null,
  });

  return imagePath;
}

async function writeTempPdf(pdfBuffer, book) {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), `bestseller-preview-${book.slug}-`)
  );

  const pdfPath = path.join(tempDir, `${book.slug}.pdf`);
  const outputDir = path.join(tempDir, "pages");

  await fs.promises.mkdir(outputDir, { recursive: true });
  await fs.promises.writeFile(pdfPath, pdfBuffer);

  return {
    tempDir,
    pdfPath,
    outputDir,
  };
}

async function removeTempDir(tempDir) {
  if (!tempDir) return;

  try {
    await fs.promises.rm(tempDir, {
      recursive: true,
      force: true,
    });
  } catch {
    // No bloquear por limpieza temporal.
  }
}

async function findConvertedImage(outputDir, prefix) {
  const files = await fs.promises.readdir(outputDir);

  const candidates = files
    .filter((file) => file.startsWith(prefix))
    .filter((file) => /\.(png)$/i.test(file))
    .sort();

  if (candidates.length === 0) {
    throw new Error(`Poppler no generó imagen PNG para ${prefix}`);
  }

  return path.join(outputDir, candidates[0]);
}

async function convertSinglePdfPageToImage({
  pdfPath,
  outputDir,
  sourcePageNumber,
  scale,
}) {
  if (!pdfConvert) {
    throw new Error(
      "No se pudo cargar pdf-poppler. Ejecuta: npm install pdf-poppler"
    );
  }

  const prefix = `page-${String(sourcePageNumber).padStart(3, "0")}`;

  await pdfConvert(pdfPath, {
    format: "png",
    out_dir: outputDir,
    out_prefix: prefix,
    page: sourcePageNumber,
    scale,
  });

  return findConvertedImage(outputDir, prefix);
}

async function renderPdfPagesWithPoppler(
  supabase,
  { book, pdfBuffer, previewFolder, pages, scale, startPageIndex }
) {
  let tempInfo = null;

  try {
    tempInfo = await writeTempPdf(pdfBuffer, book);

    const uploadedPaths = [];

    for (
      let sourcePageNumber = 1;
      sourcePageNumber <= pages;
      sourcePageNumber += 1
    ) {
      let localImagePath;

      try {
        localImagePath = await convertSinglePdfPageToImage({
          pdfPath: tempInfo.pdfPath,
          outputDir: tempInfo.outputDir,
          sourcePageNumber,
          scale,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (
          message.toLowerCase().includes("out of range") ||
          message.toLowerCase().includes("page") ||
          message.toLowerCase().includes("not generated")
        ) {
          console.warn(
            `No se pudo generar la página ${sourcePageNumber}. Posiblemente el PDF tiene menos páginas.`
          );
          break;
        }

        throw error;
      }

      const imageBuffer = await fs.promises.readFile(localImagePath);

      const pageIndex = startPageIndex + sourcePageNumber - 1;
      const imagePath = `${previewFolder}/page-${String(pageIndex).padStart(
        3,
        "0"
      )}.png`;

      const imageUrl = await uploadBufferToPreviewBucket(supabase, {
        buffer: imageBuffer,
        storagePath: imagePath,
        contentType: "image/png",
      });

      await insertPreviewPage(supabase, {
        bookId: book.id,
        pageIndex,
        sourcePageNumber,
        kind: "pdf_page",
        imagePath,
        imageUrl,
        width: null,
        height: null,
      });

      uploadedPaths.push(imagePath);

      console.log(
        `✓ Página ${sourcePageNumber}/${pages} generada -> ${imagePath}`
      );
    }

    return uploadedPaths;
  } finally {
    await removeTempDir(tempInfo?.tempDir);
  }
}

async function updateBookPreviewStatus(
  supabase,
  { bookId, status, errorMessage = null, pageCount = null }
) {
  const patch = {
    preview_status: status,
    preview_error: errorMessage,
    preview_generated_at: status === "ready" ? new Date().toISOString() : null,
  };

  if (pageCount !== null) {
    patch.preview_page_count = pageCount;
  }

  const { error } = await supabase.from("books").update(patch).eq("id", bookId);

  if (error) {
    console.warn("No se pudo actualizar books.preview_status:", error.message);
  }
}

function parseCliOptions() {
  const slug = getArg("slug");
  const bookId = getArg("book-id");

  const rawScale = Number(getArg("scale", String(DEFAULT_SCALE)));
  const pages = PREVIEW_PAGE_COUNT;

  const scale =
    Number.isFinite(rawScale) && rawScale > 0 ? rawScale : DEFAULT_SCALE;

  const includeCover = false;

  return {
    slug,
    bookId,
    pages,
    scale,
    includeCover,
  };
}

async function main() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL.");
  }

  if (!serviceKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY.");
  }

  const supabase = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { slug, bookId, pages, scale, includeCover } = parseCliOptions();

  await ensurePreviewBucket(supabase);

  const book = await findBook(supabase, {
    slug,
    bookId,
  });

  console.log("");
  console.log(`Libro: ${book.title}`);
  console.log(`ID: ${book.id}`);
  console.log(`Slug: ${book.slug}`);
  console.log(`Páginas PDF a generar: ${pages}`);
  console.log(`Escala Poppler: ${scale}`);
  console.log(`Incluir portada: ${includeCover ? "sí" : "no"}`);
  console.log("");

  const pdfAsset = await findPdfAsset(supabase, book.id);
  const coverAsset = await findCoverAsset(supabase, book.id);

  const previewVersion = Date.now();
  const previewFolder = `previews/${book.slug}-${book.id}-${previewVersion}`;

  await updateBookPreviewStatus(supabase, {
    bookId: book.id,
    status: "generating",
    errorMessage: null,
  });

  await clearPreviewRows(supabase, book.id);

  const uploadedPaths = [];
  let startPageIndex = 0;

  if (includeCover) {
    try {
      const coverPath = await uploadCoverPreview(supabase, {
        book,
        coverAsset,
        previewFolder,
      });

      if (coverPath) {
        uploadedPaths.push(coverPath);
        startPageIndex = 1;
        console.log(`✓ Portada agregada como preview -> ${coverPath}`);
      }
    } catch (coverError) {
      console.warn(
        "No se pudo agregar portada al preview:",
        coverError instanceof Error ? coverError.message : coverError
      );
    }
  }

  const pdfBuffer = await downloadStorageFile(
    supabase,
    pdfAsset.storage_bucket,
    pdfAsset.storage_path
  );

  const renderedPaths = await renderPdfPagesWithPoppler(supabase, {
    book,
    pdfBuffer,
    previewFolder,
    pages,
    scale,
    startPageIndex,
  });

  uploadedPaths.push(...renderedPaths);

  await updateBookPreviewStatus(supabase, {
    bookId: book.id,
    status: "ready",
    errorMessage: null,
    pageCount: renderedPaths.length,
  });

  console.log("");
  console.log("Listo. Preview generado correctamente.");
  console.log(`Páginas PDF generadas: ${renderedPaths.length}`);
  console.log(`Total imágenes preview: ${uploadedPaths.length}`);
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("Error generando preview:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});