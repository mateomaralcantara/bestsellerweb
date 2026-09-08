import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const LIMIT = Number(process.argv[2] || 20);
const SITE = "https://www.libroseller.com";
const BUCKET = "book-previews";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url) {
  console.error("FALTA NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

if (!key) {
  console.error("FALTA SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function text(v) {
  return typeof v === "string" ? v.trim() : "";
}

async function testStorage(page) {
  const path = text(page?.image_path);
  const imageUrl = text(page?.image_url);

  try {
    if (path) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60);

      if (error || !data?.signedUrl) {
        return {
          ok: false,
          status: 0,
          error: error?.message || "No signed URL",
        };
      }

      const r = await fetch(data.signedUrl, {
        headers: { Range: "bytes=0-0" },
      });

      return {
        ok: r.ok || r.status === 206,
        status: r.status,
      };
    }

    if (imageUrl) {
      const r = await fetch(imageUrl, {
        headers: { Range: "bytes=0-0" },
      });

      return {
        ok: r.ok || r.status === 206,
        status: r.status,
      };
    }

    return {
      ok: false,
      status: 0,
      error: "Sin image_path/image_url",
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: String(e),
    };
  }
}

async function testProduction(slug) {
  try {
    const r = await fetch(
      `${SITE}/catalog/${encodeURIComponent(slug)}/preview`,
      { cache: "no-store" }
    );

    const html = await r.text();

    const count =
      html.match(/data-preview-page-count=["']?(\d+)/i)?.[1];

    return {
      http: r.status,
      visual:
        /data-libroseller-page-preview=["']true["']/i.test(html),
      epub:
        /data-libroseller-preview-fallback=["']epub["']/i.test(html),
      count: count ? Number(count) : null,
    };
  } catch {
    return {
      http: 0,
      visual: false,
      epub: false,
      count: null,
    };
  }
}

console.log("");
console.log("====================================================");
console.log(" LIBROSELLER - DIAGNOSTICO PREVIEW / SUPABASE");
console.log("====================================================");
console.log("");

const { data: books, error: booksError } = await supabase
  .from("books")
  .select(`
    id,
    title,
    slug,
    status,
    created_at,
    preview_mode,
    preview_status,
    preview_page_count,
    preview_error
  `)
  .order("created_at", { ascending: false })
  .limit(LIMIT);

if (booksError) {
  console.error("ERROR BOOKS:", booksError.message);
  process.exit(1);
}

const ids = books.map((b) => b.id);

const { data: pages, error: pagesError } = await supabase
  .from("book_preview_pages")
  .select(`
    id,
    book_id,
    page_index,
    source_page_number,
    image_path,
    image_url
  `)
  .in("book_id", ids)
  .order("page_index", { ascending: true });

if (pagesError) {
  console.error(
    "ERROR book_preview_pages:",
    pagesError.message
  );
  process.exit(1);
}

const { data: assets, error: assetsError } = await supabase
  .from("book_assets")
  .select(`
    id,
    book_id,
    asset_type,
    storage_bucket,
    storage_path
  `)
  .in("book_id", ids);

if (assetsError) {
  console.error(
    "ERROR book_assets:",
    assetsError.message
  );
  process.exit(1);
}

const results = [];

for (const book of books) {
  const bp = pages.filter(
    (p) => p.book_id === book.id
  );

  const ba = assets.filter(
    (a) => a.book_id === book.id
  );

  const epubs = ba.filter(
    (a) => a.asset_type === "epub"
  );

  let storage = "-";

  if (bp.length > 0) {
    const checks = [];

    checks.push(await testStorage(bp[0]));

    if (bp.length > 1) {
      checks.push(
        await testStorage(bp[bp.length - 1])
      );
    }

    storage = checks.every((c) => c.ok)
      ? "OK"
      : "FALLA";
  }

  const prod = await testProduction(book.slug);

  let diagnosis = "";

  if (
    bp.length >= 25 &&
    storage === "OK" &&
    prod.visual &&
    prod.count === 25
  ) {
    diagnosis = "OK_VISUAL_25";
  }

  else if (
    Number(book.preview_page_count) === 25 &&
    bp.length === 0 &&
    epubs.length > 0
  ) {
    diagnosis = "FALSO_READY_25";
  }

  else if (
    bp.length > 0 &&
    bp.length < 25
  ) {
    diagnosis = "SOLO_" + bp.length + "_FILAS";
  }

  else if (
    bp.length >= 25 &&
    storage === "FALLA"
  ) {
    diagnosis = "FALLA_STORAGE";
  }

  else if (
    bp.length >= 25 &&
    prod.epub
  ) {
    diagnosis = "SUPABASE_OK_FRONTEND_FALLA";
  }

  else if (
    bp.length === 0 &&
    epubs.length > 0 &&
    prod.epub
  ) {
    diagnosis = "EPUB_SIN_PREVIEW_VISUAL";
  }

  else {
    diagnosis = "REVISAR";
  }

  results.push({
    Libro:
      book.title.length > 30
        ? book.title.slice(0, 27) + "..."
        : book.title,

    Meta25:
      Number(book.preview_page_count || 0),

    Rows:
      bp.length,

    EPUB:
      epubs.length,

    Storage:
      storage,

    Produccion:
      prod.visual
        ? "VISUAL"
        : prod.epub
          ? "EPUB"
          : "OTRO",

    ProdCount:
      prod.count ?? "-",

    Diagnostico:
      diagnosis,

    slug:
      book.slug,
  });
}

console.table(
  results.map(({ slug, ...r }) => r)
);

console.log("");
console.log("============== DETALLE DE PROBLEMAS ==============");

for (const r of results) {
  if (r.Diagnostico === "OK_VISUAL_25") {
    continue;
  }

  console.log("");
  console.log("--------------------------------------------------");
  console.log(r.Libro);
  console.log("slug:", r.slug);
  console.log("Metadata 25:", r.Meta25);
  console.log("book_preview_pages:", r.Rows);
  console.log("EPUB:", r.EPUB);
  console.log("Storage:", r.Storage);
  console.log("Produccion:", r.Produccion);
  console.log("Conteo produccion:", r.ProdCount);
  console.log("DIAGNOSTICO:", r.Diagnostico);

  if (r.Diagnostico === "FALSO_READY_25") {
    console.log(
      "CAUSA: Supabase dice que hay 25 paginas, pero realmente book_preview_pages tiene 0."
    );
  }

  if (
    r.Diagnostico.startsWith("SOLO_")
  ) {
    console.log(
      "CAUSA: El generador solo creó parte de las 25 paginas."
    );
  }

  if (r.Diagnostico === "FALLA_STORAGE") {
    console.log(
      "CAUSA: Las filas existen, pero las imagenes de Supabase Storage no responden."
    );
  }

  if (
    r.Diagnostico ===
    "SUPABASE_OK_FRONTEND_FALLA"
  ) {
    console.log(
      "CAUSA: Supabase tiene las paginas, pero el frontend entra incorrectamente al EPUB."
    );
  }

  if (
    r.Diagnostico ===
    "EPUB_SIN_PREVIEW_VISUAL"
  ) {
    console.log(
      "CAUSA: El libro tiene EPUB pero nunca se generaron las 25 filas visuales."
    );
  }
}

console.log("");
console.log("============== RESUMEN ==============");

const summary = {};

for (const r of results) {
  summary[r.Diagnostico] =
    (summary[r.Diagnostico] || 0) + 1;
}

console.table(
  Object.entries(summary).map(
    ([Diagnostico, Cantidad]) => ({
      Diagnostico,
      Cantidad,
    })
  )
);

console.log("");
console.log("FIN DEL DIAGNOSTICO.");
console.log("");