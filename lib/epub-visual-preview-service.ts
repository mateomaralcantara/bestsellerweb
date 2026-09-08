import "server-only";

import path from "node:path";
import JSZip from "jszip";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PREVIEW_BUCKET = "book-previews";
const PAGE_LIMIT = 25;

type SourceAsset = {
  storage_bucket: string | null;
  storage_path: string | null;
};

type BookRow = {
  id: string;
  slug: string;
};

type PreviewPage = {
  bytes: Uint8Array;
  width: number;
  height: number;
  extension: "png" | "jpg";
  contentType: "image/png" | "image/jpeg";
};

type InspectionResult =
  | {
      ok: true;
      layout: "fixed" | "fixed-like";
      reason: string;
      pages: PreviewPage[];
    }
  | {
      ok: false;
      layout: "reflowable" | "unknown" | "fixed";
      reason: string;
      pages: PreviewPage[];
    };

export type EpubVisualPreviewResult = {
  mode: "visual" | "epub";
  pageCount: number | null;
  reason: string;
};

function attr(source: string, name: string) {
  return (
    source.match(
      new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i")
    )?.[2]?.trim() || ""
  );
}

function dirname(filePath: string) {
  const value = path.posix.dirname(filePath);
  return value === "." ? "" : value;
}

function normalizeZipPath(baseDir: string, href: string) {
  let clean = String(href || "")
    .split("#")[0]
    .replace(/^\//, "");

  try {
    clean = decodeURIComponent(clean);
  } catch {
    // Conserva la ruta original si viene con escapes inválidos.
  }

  return path.posix
    .normalize(path.posix.join(baseDir, clean))
    .replace(/^\.\//, "");
}

function parseManifest(opf: string) {
  return Array.from(
    opf.matchAll(/<item\b([^>]*)\/?>/gi)
  )
    .map((match) => ({
      id: attr(match[1] || "", "id"),
      href: attr(match[1] || "", "href"),
      mediaType: attr(
        match[1] || "",
        "media-type"
      ).toLowerCase(),
      properties: attr(
        match[1] || "",
        "properties"
      ).toLowerCase(),
    }))
    .filter((item) => item.id && item.href);
}

function resolveLayout(
  opf: string
): "fixed" | "reflowable" | "unknown" {
  const rendition = opf.match(
    /<meta\b[^>]*property=["']rendition:layout["'][^>]*>([\s\S]*?)<\/meta>/i
  )?.[1];

  const legacy =
    /<meta\b[^>]*name=["']fixed-layout["'][^>]*content=["'](?:true|yes)["']/i.test(
      opf
    );

  const value = String(rendition || "")
    .trim()
    .toLowerCase();

  if (
    legacy ||
    value.includes("pre-paginated") ||
    value.includes("fixed")
  ) {
    return "fixed";
  }

  if (value.includes("reflowable")) {
    return "reflowable";
  }

  return "unknown";
}

function decodeText(value: string) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function meaningfulBodyText(html: string) {
  const body =
    html.match(
      /<body\b[^>]*>([\s\S]*?)<\/body>/i
    )?.[1] || "";

  return decodeText(
    body
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<img\b[^>]*\/?>/gi, " ")
      .replace(/<br\b[^>]*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function pngInfo(bytes: Uint8Array) {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  );

  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
    extension: "png" as const,
    contentType: "image/png" as const,
  };
}

function jpegInfo(bytes: Uint8Array) {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8
  ) {
    return null;
  }

  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];

    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const length =
      (bytes[offset + 2] << 8) +
      bytes[offset + 3];

    if (length < 2) return null;

    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height:
          (bytes[offset + 5] << 8) +
          bytes[offset + 6],
        width:
          (bytes[offset + 7] << 8) +
          bytes[offset + 8],
        extension: "jpg" as const,
        contentType: "image/jpeg" as const,
      };
    }

    offset += 2 + length;
  }

  return null;
}

function imageInfo(bytes: Uint8Array) {
  return pngInfo(bytes) || jpegInfo(bytes);
}

async function loadBook(bookId: string) {
  const { data, error } = await supabaseAdmin
    .from("books")
    .select("id,slug")
    .eq("id", bookId)
    .maybeSingle<BookRow>();

  if (error) {
    throw new Error(
      `No se pudo cargar el libro: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(`Libro inexistente: ${bookId}`);
  }

  return data;
}

async function loadSourceAsset(bookId: string) {
  const { data, error } = await supabaseAdmin
    .from("book_assets")
    .select("storage_bucket,storage_path")
    .eq("book_id", bookId)
    .eq("asset_type", "epub")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<SourceAsset>();

  if (error) {
    throw new Error(
      `No se pudo cargar el EPUB: ${error.message}`
    );
  }

  if (!data?.storage_bucket || !data.storage_path) {
    throw new Error(
      "El libro no tiene EPUB fuente privado."
    );
  }

  return data;
}

async function markEpubFallback(
  bookId: string,
  errorMessage: string | null = null
) {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("books")
    .update({
      preview_mode: "epub_preview",
      preview_status: "ready",
      preview_page_count: null,
      preview_error: errorMessage,
      preview_generated_at: now,
      updated_at: now,
    })
    .eq("id", bookId);

  if (error) {
    throw new Error(
      `No se pudo marcar fallback EPUB: ${error.message}`
    );
  }
}

export async function clearBookVisualPreviewById(
  bookId: string
) {
  const { data: rows, error: rowsError } =
    await supabaseAdmin
      .from("book_preview_pages")
      .select("image_path,storage_path")
      .eq("book_id", bookId);

  if (rowsError) {
    throw new Error(
      `No se pudo cargar preview anterior: ${rowsError.message}`
    );
  }

  const paths = Array.from(
    new Set(
      (rows || [])
        .flatMap((row) => [
          typeof row.image_path === "string"
            ? row.image_path
            : "",
          typeof row.storage_path === "string"
            ? row.storage_path
            : "",
        ])
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  const { error: deleteError } =
    await supabaseAdmin
      .from("book_preview_pages")
      .delete()
      .eq("book_id", bookId);

  if (deleteError) {
    throw new Error(
      `No se pudo borrar preview anterior: ${deleteError.message}`
    );
  }

  if (paths.length) {
    const { error: storageError } =
      await supabaseAdmin.storage
        .from(PREVIEW_BUCKET)
        .remove(paths);

    if (storageError) {
      console.warn(
        "No se pudieron limpiar objetos antiguos de preview:",
        storageError.message
      );
    }
  }
}

async function inspectEpub(
  asset: SourceAsset
): Promise<InspectionResult> {
  const { data: blob, error } =
    await supabaseAdmin.storage
      .from(asset.storage_bucket!)
      .download(asset.storage_path!);

  if (error || !blob) {
    throw new Error(
      error?.message ||
        "No se pudo descargar el EPUB."
    );
  }

  const bytes = new Uint8Array(
    await blob.arrayBuffer()
  );

  const zip = await JSZip.loadAsync(bytes);

  const container =
    await zip
      .file("META-INF/container.xml")
      ?.async("string");

  if (!container) {
    return {
      ok: false,
      layout: "unknown",
      reason: "Falta META-INF/container.xml.",
      pages: [],
    };
  }

  const opfPath =
    container.match(
      /full-path\s*=\s*["']([^"']+)["']/i
    )?.[1]?.trim() || "";

  if (!opfPath) {
    return {
      ok: false,
      layout: "unknown",
      reason: "No se encontró paquete OPF.",
      pages: [],
    };
  }

  const opf =
    await zip.file(opfPath)?.async("string");

  if (!opf) {
    return {
      ok: false,
      layout: "unknown",
      reason: "No se pudo leer el OPF.",
      pages: [],
    };
  }

  const layout = resolveLayout(opf);

  if (layout === "reflowable") {
    return {
      ok: false,
      layout,
      reason:
        "EPUB declarado reflowable; usa lector EPUB.",
      pages: [],
    };
  }

  const manifest = parseManifest(opf);

  const byId = new Map(
    manifest.map((item) => [item.id, item])
  );

  const opfDir = dirname(opfPath);

  const spineIds = Array.from(
    opf.matchAll(/<itemref\b([^>]*)\/?>/gi)
  )
    .map((match) =>
      attr(match[1] || "", "idref")
    )
    .filter(Boolean);

  const pages: PreviewPage[] = [];

  for (const idref of spineIds) {
    if (pages.length >= PAGE_LIMIT) break;

    const item = byId.get(idref);

    if (!item) continue;

    if (
      item.properties
        .split(/\s+/)
        .includes("nav")
    ) {
      continue;
    }

    if (
      ![
        "application/xhtml+xml",
        "text/html",
      ].includes(item.mediaType)
    ) {
      return {
        ok: false,
        layout,
        reason:
          `Spine no XHTML: ${item.mediaType}`,
        pages: [],
      };
    }

    const htmlPath =
      normalizeZipPath(opfDir, item.href);

    const html =
      await zip.file(htmlPath)?.async("string");

    if (!html) {
      return {
        ok: false,
        layout,
        reason:
          `No se pudo leer ${item.href}.`,
        pages: [],
      };
    }

    if (
      /<(?:svg|video|audio|canvas|object|iframe|script|form|input)\b/i.test(
        html
      )
    ) {
      return {
        ok: false,
        layout,
        reason:
          "EPUB con capas complejas; usa lector EPUB.",
        pages: [],
      };
    }

    const images = Array.from(
      html.matchAll(/<img\b([^>]*)\/?>/gi)
    );

    if (images.length !== 1) {
      return {
        ok: false,
        layout,
        reason:
          "La página no contiene exactamente una imagen.",
        pages: [],
      };
    }

    if (meaningfulBodyText(html)) {
      return {
        ok: false,
        layout,
        reason:
          "EPUB con texto XHTML real; usa lector EPUB.",
        pages: [],
      };
    }

    const src =
      attr(images[0][1] || "", "src");

    if (
      !src ||
      /^(?:data:|https?:)/i.test(src)
    ) {
      return {
        ok: false,
        layout,
        reason:
          "Imagen externa o embebida no materializable.",
        pages: [],
      };
    }

    const imagePath =
      normalizeZipPath(
        dirname(htmlPath),
        src
      );

    const imageBytes =
      await zip
        .file(imagePath)
        ?.async("uint8array");

    if (!imageBytes) {
      return {
        ok: false,
        layout,
        reason:
          `No existe imagen ${imagePath}.`,
        pages: [],
      };
    }

    const info = imageInfo(imageBytes);

    if (!info) {
      return {
        ok: false,
        layout,
        reason:
          "Imagen no PNG/JPEG.",
        pages: [],
      };
    }

    pages.push({
      bytes: imageBytes,
      width: info.width,
      height: info.height,
      extension: info.extension,
      contentType: info.contentType,
    });
  }

  if (pages.length < PAGE_LIMIT) {
    return {
      ok: false,
      layout,
      reason:
        `Solo ${pages.length}/${PAGE_LIMIT} páginas visuales compatibles.`,
      pages,
    };
  }

  return {
    ok: true,
    layout:
      layout === "fixed"
        ? "fixed"
        : "fixed-like",
    reason:
      layout === "fixed"
        ? "25 páginas fixed-layout materializables."
        : "25 páginas fixed-like materializables.",
    pages: pages.slice(0, PAGE_LIMIT),
  };
}

export async function materializeEpubVisualPreviewByBookId(
  bookId: string
): Promise<EpubVisualPreviewResult> {
  const book = await loadBook(bookId);
  const asset = await loadSourceAsset(bookId);

  const inspection = await inspectEpub(asset);

  if (!inspection.ok) {
    await clearBookVisualPreviewById(bookId);
    await markEpubFallback(bookId);

    return {
      mode: "epub",
      pageCount: null,
      reason: inspection.reason,
    };
  }

  await clearBookVisualPreviewById(bookId);

  const now = new Date().toISOString();

  const folder =
    `previews/${book.slug}-${book.id}/epub-${Date.now()}`;

  const uploaded: string[] = [];

  try {
    const rows = [];

    for (
      let index = 0;
      index < PAGE_LIMIT;
      index += 1
    ) {
      const page = inspection.pages[index];
      const pageNumber = index + 1;

      const storagePath =
        `${folder}/page-${String(pageNumber)
          .padStart(3, "0")}.${page.extension}`;

      const { error: uploadError } =
        await supabaseAdmin.storage
          .from(PREVIEW_BUCKET)
          .upload(
            storagePath,
            page.bytes,
            {
              contentType:
                page.contentType,
              upsert: true,
              cacheControl: "3600",
            }
          );

      if (uploadError) {
        throw new Error(
          `Página ${pageNumber}: ${uploadError.message}`
        );
      }

      uploaded.push(storagePath);

      rows.push({
        book_id: book.id,
        page_index: index,
        source_page_number: pageNumber,

        // Valor actualmente permitido por
        // book_preview_pages_kind_check.
        kind: "pdf_page",

        image_path: storagePath,
        image_url: null,
        width: page.width,
        height: page.height,
        updated_at: now,
      });
    }

    const { error: rowsError } =
      await supabaseAdmin
        .from("book_preview_pages")
        .upsert(rows, {
          onConflict: "book_id,page_index",
        });

    if (rowsError) {
      throw new Error(
        `No se pudieron registrar páginas: ${rowsError.message}`
      );
    }

    const { count, error: countError } =
      await supabaseAdmin
        .from("book_preview_pages")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("book_id", book.id);

    if (countError) {
      throw new Error(
        `No se pudo verificar preview: ${countError.message}`
      );
    }

    if ((count || 0) !== PAGE_LIMIT) {
      throw new Error(
        `Preview incompleto: ${count || 0}/${PAGE_LIMIT}.`
      );
    }

    const { error: updateError } =
      await supabaseAdmin
        .from("books")
        .update({
          preview_mode: "pdf_images",
          preview_status: "ready",
          preview_page_count: PAGE_LIMIT,
          preview_error: null,
          preview_generated_at: now,
          updated_at: now,
        })
        .eq("id", book.id);

    if (updateError) {
      throw new Error(
        `No se pudo activar preview visual: ${updateError.message}`
      );
    }

    return {
      mode: "visual",
      pageCount: PAGE_LIMIT,
      reason: inspection.reason,
    };
  } catch (error) {
    await supabaseAdmin
      .from("book_preview_pages")
      .delete()
      .eq("book_id", book.id);

    if (uploaded.length) {
      await supabaseAdmin.storage
        .from(PREVIEW_BUCKET)
        .remove(uploaded)
        .catch(() => {});
    }

    const message =
      error instanceof Error
        ? error.message
        : "Error materializando preview EPUB.";

    try {
      await markEpubFallback(
        book.id,
        message.slice(0, 1000)
      );
    } catch {
      // Preserva el error original.
    }

    throw error;
  }
}