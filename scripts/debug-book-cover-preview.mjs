import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const COVER_BUCKET = "book-covers";
const PREVIEW_BUCKET = "book-previews";

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

function printHeader(title) {
  console.log("");
  console.log("=".repeat(90));
  console.log(title);
  console.log("=".repeat(90));
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getExtension(fileName) {
  const cleanName = String(fileName ?? "").split("?")[0];
  const parts = cleanName.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function getPublicUrl(supabase, bucket, storagePath) {
  if (!bucket || !storagePath) return null;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return publicUrl || null;
}

async function checkUrl(label, url) {
  if (!url) {
    return {
      label,
      url,
      ok: false,
      status: null,
      message: "URL vacía",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      label,
      url,
      ok: response.ok,
      status: response.status,
      message: response.ok ? "OK" : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      label,
      url,
      ok: false,
      status: null,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getSupabase() {
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

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function findBook(supabase, { bookId, slug }) {
  let query = supabase
    .from("books")
    .select(
      [
        "id",
        "title",
        "slug",
        "status",
        "cover_url",
        "preview_status",
        "preview_error",
        "preview_generated_at",
        "updated_at",
      ].join(", ")
    )
    .limit(1);

  if (bookId) {
    query = query.eq("id", bookId);
  } else if (slug) {
    query = query.eq("slug", slug);
  } else {
    throw new Error("Debes pasar --book-id UUID o --slug SLUG_DEL_LIBRO.");
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

async function getBucketInfo(supabase, bucket) {
  const { data, error } = await supabase.storage.getBucket(bucket);

  if (error) {
    return {
      exists: false,
      public: false,
      error: error.message,
    };
  }

  return {
    exists: true,
    public: Boolean(data?.public),
    error: null,
  };
}

async function getCoverAssets(supabase, bookId) {
  const { data, error } = await supabase
    .from("book_assets")
    .select(
      [
        "id",
        "asset_type",
        "file_url",
        "storage_bucket",
        "storage_path",
        "mime_type",
        "is_public",
        "sort_order",
      ].join(", ")
    )
    .eq("book_id", bookId)
    .eq("asset_type", "cover")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Error cargando assets de portada: ${error.message}`);
  }

  return data ?? [];
}

async function getPreviewPages(supabase, bookId) {
  const { data, error } = await supabase
    .from("book_preview_pages")
    .select(
      [
        "id",
        "page_index",
        "source_page_number",
        "kind",
        "image_path",
        "image_url",
        "width",
        "height",
        "created_at",
      ].join(", ")
    )
    .eq("book_id", bookId)
    .order("page_index", { ascending: true });

  if (error) {
    throw new Error(`Error cargando book_preview_pages: ${error.message}`);
  }

  return data ?? [];
}

function getPreviewFolderFromPages(previewPages) {
  const firstPath = previewPages.find((page) => clean(page.image_path))?.image_path;

  if (!firstPath) return null;

  const parts = firstPath.split("/");
  parts.pop();

  return parts.join("/");
}

async function listStorageFolder(supabase, bucket, folder) {
  if (!folder) return [];

  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 300,
    sortBy: {
      column: "name",
      order: "asc",
    },
  });

  if (error) {
    return {
      error: error.message,
      files: [],
    };
  }

  return {
    error: null,
    files: data ?? [],
  };
}

function resolveCoverAssetUrl(supabase, asset) {
  if (!asset) return null;

  const fileUrl = clean(asset.file_url);

  if (fileUrl) return fileUrl;

  if (asset.storage_bucket && asset.storage_path) {
    return getPublicUrl(supabase, asset.storage_bucket, asset.storage_path);
  }

  return null;
}

function resolvePreviewPageUrl(supabase, page) {
  if (!page) return null;

  const imageUrl = clean(page.image_url);

  if (imageUrl) return imageUrl;

  if (page.image_path) {
    return getPublicUrl(supabase, PREVIEW_BUCKET, page.image_path);
  }

  return null;
}

async function printUrlChecks(urlChecks) {
  printHeader("5) Probando URLs públicas");

  for (const item of urlChecks) {
    const result = await checkUrl(item.label, item.url);

    console.log("");
    console.log(`${result.ok ? "✅" : "❌"} ${result.label}`);
    console.log(`Status: ${result.status ?? "sin status"}`);
    console.log(`Mensaje: ${result.message}`);
    console.log(`URL: ${result.url || "vacía"}`);
  }
}

async function main() {
  const bookId = getArg("book-id");
  const slug = getArg("slug");

  const supabase = await getSupabase();

  printHeader("1) Libro");

  const book = await findBook(supabase, {
    bookId,
    slug,
  });

  console.log(JSON.stringify(book, null, 2));

  printHeader("2) Buckets");

  const coverBucket = await getBucketInfo(supabase, COVER_BUCKET);
  const previewBucket = await getBucketInfo(supabase, PREVIEW_BUCKET);

  console.log(`${COVER_BUCKET}:`, coverBucket);
  console.log(`${PREVIEW_BUCKET}:`, previewBucket);

  if (!coverBucket.exists) {
    console.log(`❌ Falta el bucket ${COVER_BUCKET}.`);
  }

  if (!previewBucket.exists) {
    console.log(`❌ Falta el bucket ${PREVIEW_BUCKET}.`);
  }

  if (coverBucket.exists && !coverBucket.public) {
    console.log(`⚠️ ${COVER_BUCKET} no es público. La portada pública puede no verse.`);
  }

  if (previewBucket.exists && !previewBucket.public) {
    console.log(`⚠️ ${PREVIEW_BUCKET} no es público. El preview tipo Amazon no se verá.`);
  }

  printHeader("3) book_assets tipo cover");

  const coverAssets = await getCoverAssets(supabase, book.id);

  if (coverAssets.length === 0) {
    console.log("❌ No existe ningún asset tipo cover para este libro.");
  } else {
    coverAssets.forEach((asset, index) => {
      const resolvedUrl = resolveCoverAssetUrl(supabase, asset);

      console.log("");
      console.log(`Cover asset #${index + 1}`);
      console.log(JSON.stringify(asset, null, 2));
      console.log("URL resuelta:", resolvedUrl || "sin URL");
    });
  }

  printHeader("4) book_preview_pages");

  const previewPages = await getPreviewPages(supabase, book.id);
  const previewCoverRows = previewPages.filter((page) => page.kind === "cover");
  const previewPdfRows = previewPages.filter((page) => page.kind === "pdf_page");
  const previewFolder = getPreviewFolderFromPages(previewPages);

  console.log(`Total filas preview: ${previewPages.length}`);
  console.log(`Filas cover: ${previewCoverRows.length}`);
  console.log(`Filas pdf_page: ${previewPdfRows.length}`);
  console.log(`Preview folder detectado: ${previewFolder || "ninguno"}`);

  if (previewPages.length === 0) {
    console.log("❌ No hay filas en book_preview_pages para este libro.");
    console.log(
      `Corre: npm run preview:book -- --slug ${book.slug} --pages 16 --scale 5200`
    );
  } else {
    console.log("");
    console.log("Primeras 5 filas:");
    console.log(JSON.stringify(previewPages.slice(0, 5), null, 2));
  }

  if (previewCoverRows.length === 0) {
    console.log("");
    console.log("⚠️ No hay fila kind='cover' en book_preview_pages.");
    console.log(
      "Si quieres portada dentro del preview, regenera SIN --no-cover."
    );
  }

  if (previewFolder) {
    const folderList = await listStorageFolder(
      supabase,
      PREVIEW_BUCKET,
      previewFolder
    );

    console.log("");
    console.log(`Archivos en ${PREVIEW_BUCKET}/${previewFolder}:`);

    if (folderList.error) {
      console.log("❌ Error listando carpeta:", folderList.error);
    } else {
      console.log(`Total archivos: ${folderList.files.length}`);
      console.log(
        folderList.files.slice(0, 20).map((file) => file.name).join("\n") ||
          "sin archivos"
      );
    }
  }

  const firstCoverAsset = coverAssets[0] ?? null;
  const firstPreviewCover = previewCoverRows[0] ?? null;
  const firstPreviewPage = previewPages[0] ?? null;

  const urlChecks = [
    {
      label: "books.cover_url",
      url: clean(book.cover_url),
    },
    {
      label: "book_assets cover URL resuelta",
      url: resolveCoverAssetUrl(supabase, firstCoverAsset),
    },
    {
      label: "book_preview_pages cover URL resuelta",
      url: resolvePreviewPageUrl(supabase, firstPreviewCover),
    },
    {
      label: "book_preview_pages primera página URL resuelta",
      url: resolvePreviewPageUrl(supabase, firstPreviewPage),
    },
  ];

  await printUrlChecks(urlChecks);

  printHeader("6) Diagnóstico");

  const bookCoverUrlWorks = await checkUrl("books.cover_url", clean(book.cover_url));
  const coverAssetUrl = resolveCoverAssetUrl(supabase, firstCoverAsset);
  const coverAssetWorks = await checkUrl("cover asset", coverAssetUrl);
  const previewCoverUrl = resolvePreviewPageUrl(supabase, firstPreviewCover);
  const previewCoverWorks = await checkUrl("preview cover", previewCoverUrl);
  const firstPreviewPageUrl = resolvePreviewPageUrl(supabase, firstPreviewPage);
  const firstPreviewPageWorks = await checkUrl("first preview page", firstPreviewPageUrl);

  if (!book.cover_url && coverAssetUrl) {
    console.log("⚠️ books.cover_url está vacío, pero sí existe portada en book_assets.");
    console.log("Solución SQL rápida:");
    console.log(`
update public.books
set cover_url = '${coverAssetUrl.replaceAll("'", "''")}',
    updated_at = now()
where id = '${book.id}';
`);
  }

  if (book.cover_url && !bookCoverUrlWorks.ok) {
    console.log("❌ books.cover_url existe pero no abre. Puede estar rota o apuntar a bucket privado.");
  }

  if (coverAssets.length === 0) {
    console.log("❌ Falta asset tipo cover. Sube portada nuevamente desde edición.");
  }

  if (coverAssets.length > 0 && !coverAssetWorks.ok) {
    console.log("❌ El asset de portada existe, pero su URL pública no abre.");
    console.log("Revisa que book-covers sea público o que storage_path exista.");
  }

  if (previewPages.length > 0 && !firstPreviewPageWorks.ok) {
    console.log("❌ Hay filas de preview, pero la primera imagen no abre.");
    console.log("Revisa que book-previews sea público y que image_path exista.");
  }

  if (previewPages.length > 0 && previewCoverRows.length === 0) {
    console.log("⚠️ Hay preview, pero no hay portada dentro del preview.");
    console.log(
      `Regenera: npm run preview:book -- --slug ${book.slug} --pages 16 --scale 5200`
    );
  }

  if (previewCoverRows.length > 0 && !previewCoverWorks.ok) {
    console.log("❌ Hay fila cover en preview, pero la imagen no abre.");
  }

  if (
    bookCoverUrlWorks.ok &&
    coverAssetWorks.ok &&
    previewPages.length > 0 &&
    firstPreviewPageWorks.ok
  ) {
    console.log("✅ Base de datos y Storage parecen bien.");
    console.log("Si no se ve en pantalla, el problema está en el frontend:");
    console.log("- app/catalog/[slug]/page.tsx no está leyendo cover_url.");
    console.log("- resolveCoverUrl no está usando book.cover_url o asset.file_url.");
    console.log("- LookInsidePreview no está recibiendo coverUrl o pages.");
    console.log("- El navegador tiene caché vieja. Haz Ctrl + Shift + R.");
  }

  console.log("");
  console.log("Listo.");
}

main().catch((error) => {
  console.error("");
  console.error("Error en debug de portada/preview:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});