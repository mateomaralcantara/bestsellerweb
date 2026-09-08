import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const PAGE_LIMIT = 25;
const PREVIEW_BUCKET = "book-previews";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim();

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SECRET_KEY?.trim();

if (!SUPABASE_URL) {
  throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL.");
}

if (!SERVICE_KEY) {
  throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function attr(source, name) {
  return (
    source.match(
      new RegExp(
        `${name}\\s*=\\s*(["'])(.*?)\\1`,
        "i"
      )
    )?.[2]?.trim() || ""
  );
}

function dirname(filePath) {
  const value = path.posix.dirname(filePath);
  return value === "." ? "" : value;
}

function normalizeZipPath(baseDir, href) {
  let clean = String(href || "")
    .split("#")[0]
    .replace(/^\//, "");

  try {
    clean = decodeURIComponent(clean);
  } catch {}

  return path.posix
    .normalize(
      path.posix.join(baseDir, clean)
    )
    .replace(/^\.\//, "");
}

function parseManifest(opf) {
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

function resolveLayout(opf) {
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

function decodeText(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function meaningfulBodyText(html) {
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

function pngInfo(bytes) {
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
    extension: "png",
    contentType: "image/png",
  };
}

function jpegInfo(bytes) {
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

    if (
      marker === 0xd8 ||
      marker === 0xd9
    ) {
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
        extension: "jpg",
        contentType: "image/jpeg",
      };
    }

    offset += 2 + length;
  }

  return null;
}

function getImageInfo(bytes) {
  return pngInfo(bytes) || jpegInfo(bytes);
}

async function getCandidates() {
  const { data: books, error } =
    await supabase
      .from("books")
      .select(
        "id,title,slug,status,preview_mode,preview_status,preview_page_count,created_at"
      )
      .in("status", [
        "published",
        "under_review",
        "draft",
      ])
      .order("created_at", {
        ascending: false,
      });

  if (error) {
    throw new Error(
      `Error cargando books: ${error.message}`
    );
  }

  const result = [];

  for (const book of books || []) {
    const { count, error: countError } =
      await supabase
        .from("book_preview_pages")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("book_id", book.id);

    if (countError) {
      throw new Error(
        `Error contando previews de ${book.slug}: ${countError.message}`
      );
    }

    if ((count || 0) >= PAGE_LIMIT) {
      continue;
    }

    const { data: asset, error: assetError } =
      await supabase
        .from("book_assets")
        .select(
          "id,storage_bucket,storage_path,mime_type"
        )
        .eq("book_id", book.id)
        .eq("asset_type", "epub")
        .order("sort_order", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

    if (assetError) {
      throw new Error(
        `Error buscando EPUB de ${book.slug}: ${assetError.message}`
      );
    }

    if (!asset?.storage_bucket ||
        !asset?.storage_path) {
      continue;
    }

    result.push({
      ...book,
      currentRows: count || 0,
      asset,
    });
  }

  return result;
}

async function inspectEpub(book) {
  const { data: blob, error } =
    await supabase.storage
      .from(book.asset.storage_bucket)
      .download(book.asset.storage_path);

  if (error || !blob) {
    return {
      ok: false,
      reason:
        error?.message ||
        "No se pudo descargar EPUB.",
      layout: "unknown",
      pages: [],
    };
  }

  const bytes = new Uint8Array(
    await blob.arrayBuffer()
  );

  let zip;

  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (error) {
    return {
      ok: false,
      reason:
        "El EPUB no es un ZIP válido: " +
        String(error),
      layout: "unknown",
      pages: [],
    };
  }

  const container =
    await zip
      .file("META-INF/container.xml")
      ?.async("string");

  if (!container) {
    return {
      ok: false,
      reason:
        "Falta META-INF/container.xml.",
      layout: "unknown",
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
      reason:
        "No se encontró ruta OPF.",
      layout: "unknown",
      pages: [],
    };
  }

  const opf =
    await zip.file(opfPath)?.async("string");

  if (!opf) {
    return {
      ok: false,
      reason:
        "No se pudo leer el OPF.",
      layout: "unknown",
      pages: [],
    };
  }

  const layout = resolveLayout(opf);

  if (layout === "reflowable") {
    return {
      ok: false,
      reason:
        "EPUB declarado reflowable; se conserva como lector EPUB.",
      layout,
      pages: [],
    };
  }

  // fixed y unknown continúan a inspección estructural.
  // Un EPUB unknown puede ser fixed-image aunque no declare
  // rendition:layout en su OPF.

  const manifest = parseManifest(opf);
  const byId = new Map(
    manifest.map((item) => [
      item.id,
      item,
    ])
  );

  const opfDir = dirname(opfPath);

  const spineIds = Array.from(
    opf.matchAll(
      /<itemref\b([^>]*)\/?>/gi
    )
  )
    .map((match) =>
      attr(match[1] || "", "idref")
    )
    .filter(Boolean);

  const pages = [];

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
        reason:
          `Spine no XHTML: ${item.mediaType}`,
        layout,
        pages: [],
      };
    }

    const htmlPath =
      normalizeZipPath(
        opfDir,
        item.href
      );

    const html =
      await zip
        .file(htmlPath)
        ?.async("string");

    if (!html) {
      return {
        ok: false,
        reason:
          `No se pudo leer ${item.href}.`,
        layout,
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
        reason:
          "El EPUB tiene capas complejas.",
        layout,
        pages: [],
      };
    }

    const imgs = Array.from(
      html.matchAll(
        /<img\b([^>]*)\/?>/gi
      )
    );

    if (imgs.length !== 1) {
      return {
        ok: false,
        reason:
          "No todas las páginas contienen exactamente una imagen.",
        layout,
        pages: [],
      };
    }

    if (meaningfulBodyText(html)) {
      return {
        ok: false,
        reason:
          "Se detectó texto XHTML real.",
        layout,
        pages: [],
      };
    }

    const src =
      attr(
        imgs[0][1] || "",
        "src"
      );

    if (
      !src ||
      /^(?:data:|https?:)/i.test(src)
    ) {
      return {
        ok: false,
        reason:
          "Página con imagen externa/embebida.",
        layout,
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
        reason:
          `No existe ${imagePath}.`,
        layout,
        pages: [],
      };
    }

    const info =
      getImageInfo(imageBytes);

    if (!info) {
      return {
        ok: false,
        reason:
          `Imagen no PNG/JPEG: ${imagePath}`,
        layout,
        pages: [],
      };
    }

    pages.push({
      imageBytes,
      sourcePath: imagePath,
      width: info.width,
      height: info.height,
      extension: info.extension,
      contentType: info.contentType,
    });
  }

  if (pages.length < PAGE_LIMIT) {
    return {
      ok: false,
      reason:
        `Solo se encontraron ${pages.length}/${PAGE_LIMIT} páginas fixed-image.`,
      layout,
      pages,
    };
  }

  return {
    ok: true,
    reason:
      layout === "fixed"
        ? "25 páginas fixed-layout disponibles."
        : "25 páginas fixed-like detectadas por estructura aunque el OPF no declare layout.",
    layout:
      layout === "fixed"
        ? "fixed"
        : "fixed-like",
    pages:
      pages.slice(0, PAGE_LIMIT),
  };
}

async function repairBook(book, inspection) {
  const now = new Date().toISOString();

  const folder =
    `previews/${book.slug}-${book.id}/epub-${Date.now()}`;

  const uploaded = [];
  const rows = [];

  try {
    for (
      let i = 0;
      i < PAGE_LIMIT;
      i++
    ) {
      const page = inspection.pages[i];
      const number = i + 1;

      const storagePath =
        `${folder}/page-${String(number)
          .padStart(3, "0")}.${page.extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from(PREVIEW_BUCKET)
          .upload(
            storagePath,
            page.imageBytes,
            {
              contentType:
                page.contentType,
              upsert: true,
              cacheControl: "3600",
            }
          );

      if (uploadError) {
        throw new Error(
          `Página ${number}: ${uploadError.message}`
        );
      }

      uploaded.push(storagePath);

      rows.push({
        book_id: book.id,
        page_index: i,
        source_page_number:
          number,
        kind: "pdf_page",
        image_path: storagePath,
        image_url: null,
        width: page.width,
        height: page.height,
        updated_at: now,
      });

      console.log(
        `  subida ${number}/${PAGE_LIMIT}`
      );
    }

    const { data: oldRows } =
      await supabase
        .from("book_preview_pages")
        .select("image_path")
        .eq("book_id", book.id);

    const { error: upsertError } =
      await supabase
        .from("book_preview_pages")
        .upsert(rows, {
          onConflict:
            "book_id,page_index",
        });

    if (upsertError) {
      throw new Error(
        `Insert preview rows: ${upsertError.message}`
      );
    }

    const { error: extraDeleteError } =
      await supabase
        .from("book_preview_pages")
        .delete()
        .eq("book_id", book.id)
        .gte(
          "page_index",
          PAGE_LIMIT
        );

    if (extraDeleteError) {
      console.warn(
        "No se limpiaron filas >25:",
        extraDeleteError.message
      );
    }

    const { error: updateError } =
      await supabase
        .from("books")
        .update({
          preview_mode:
            "pdf_images",
          preview_status:
            "ready",
          preview_page_count:
            PAGE_LIMIT,
          preview_error: null,
          preview_generated_at:
            now,
          updated_at: now,
        })
        .eq("id", book.id);

    if (updateError) {
      throw new Error(
        `Actualizar books: ${updateError.message}`
      );
    }

    const oldPaths = (
      oldRows || []
    )
      .map((row) =>
        String(
          row.image_path || ""
        ).trim()
      )
      .filter(Boolean)
      .filter(
        (oldPath) =>
          !uploaded.includes(oldPath)
      );

    if (oldPaths.length) {
      const { error: removeError } =
        await supabase.storage
          .from(PREVIEW_BUCKET)
          .remove(oldPaths);

      if (removeError) {
        console.warn(
          "No se pudieron limpiar imágenes antiguas:",
          removeError.message
        );
      }
    }

    return {
      ok: true,
      count: PAGE_LIMIT,
    };
  } catch (error) {
    if (uploaded.length) {
      await supabase.storage
        .from(PREVIEW_BUCKET)
        .remove(uploaded)
        .catch(() => {});
    }

    throw error;
  }
}

async function markFallback(book, inspection) {
  const now = new Date().toISOString();

  const { error } =
    await supabase
      .from("books")
      .update({
        preview_mode:
          "epub_preview",
        preview_status:
          "ready",

        // NULL = no existe preview visual materializado.
        // El lector EPUB puede seguir teniendo su muestra lógica,
        // pero no fingimos que existen 25 filas visuales.
        preview_page_count: null,

        preview_error: null,
        preview_generated_at:
          now,
        updated_at: now,
      })
      .eq("id", book.id);

  if (error) {
    throw new Error(
      `No se pudo corregir metadata: ${error.message}`
    );
  }

  return {
    ok: true,
    fallback: true,
    reason: inspection.reason,
  };
}

async function verifyBook(book) {
  const { count, error } =
    await supabase
      .from("book_preview_pages")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("book_id", book.id);

  if (error) {
    return {
      rows: -1,
      error: error.message,
    };
  }

  return {
    rows: count || 0,
    error: null,
  };
}

async function main() {
  console.log("");
  console.log(
    "================================================"
  );
  console.log(
    " LIBROSELLER EPUB -> PREVIEW VISUAL 25"
  );
  console.log(
    "================================================"
  );

  console.log(
    APPLY
      ? "MODO: APPLY (MODIFICA SUPABASE)"
      : "MODO: DRY-RUN (NO MODIFICA NADA)"
  );

  console.log("");

  const books =
    await getCandidates();

  console.log(
    `Candidatos encontrados: ${books.length}`
  );

  const summary = [];

  for (const book of books) {
    console.log("");
    console.log(
      "------------------------------------------------"
    );
    console.log(book.title);
    console.log(
      `slug: ${book.slug}`
    );
    console.log(
      `rows actuales: ${book.currentRows}`
    );
    console.log(
      `metadata: ${book.preview_page_count}`
    );

    const inspection =
      await inspectEpub(book);

    console.log(
      `layout: ${inspection.layout}`
    );

    console.log(
      `resultado: ${inspection.reason}`
    );

    if (
      inspection.ok &&
      inspection.pages.length >=
        PAGE_LIMIT
    ) {
      console.log(
        "CONVERTIBLE: SI"
      );

      if (APPLY) {
        console.log(
          "Generando preview visual..."
        );

        await repairBook(
          book,
          inspection
        );

        const verification =
          await verifyBook(book);

        console.log(
          `VERIFICACION: ${verification.rows}/25 filas`
        );

        summary.push({
          Libro: book.title,
          Resultado:
            verification.rows === 25
              ? "REPARADO_25"
              : `ERROR_${verification.rows}`,
        });
      } else {
        summary.push({
          Libro: book.title,
          Resultado:
            "CONVERTIBLE_25",
        });
      }
    } else {
      console.log(
        "CONVERTIBLE: NO"
      );

      if (APPLY) {
        await markFallback(
          book,
          inspection
        );

        console.log(
          "Metadata corregida: preview_page_count=NULL; fallback EPUB."
        );

        summary.push({
          Libro: book.title,
          Resultado:
            "FALLBACK_EPUB",
        });
      } else {
        summary.push({
          Libro: book.title,
          Resultado:
            "FALLBACK_EPUB",
        });
      }
    }
  }

  console.log("");
  console.log(
    "================ RESUMEN ================"
  );

  console.table(summary);

  console.log("");

  if (!APPLY) {
    console.log(
      "DRY-RUN COMPLETO. NO SE MODIFICO SUPABASE."
    );
    console.log("");
    console.log(
      "Para aplicar:"
    );
    console.log(
      'node ".\\scripts\\repair-epub-visual-previews.mjs" --apply'
    );
  } else {
    console.log(
      "REPARACION TERMINADA."
    );
  }

  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error(
    "ERROR FATAL:"
  );
  console.error(
    error instanceof Error
      ? error.stack || error.message
      : error
  );

  process.exit(1);
});