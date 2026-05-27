const fs = require("node:fs");
const path = require("node:path");
const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

loadEnvConfig(process.cwd());

const root = process.cwd();
const targetSlug = process.argv[2]?.trim() || null;

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function warn(msg) {
  console.log(`⚠️ ${msg}`);
}

function fail(msg) {
  console.log(`❌ ${msg}`);
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function read(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function findExisting(paths) {
  return paths.find(exists) || null;
}

async function checkFiles() {
  section("ARCHIVOS");

  const bookCardPath = path.join(root, "components", "book-card.tsx");
  const catalogPagePath = path.join(root, "app", "catalog", "page.tsx");
  const detailCandidates = [
    path.join(root, "app", "catalog", "[slug]", "page.tsx"),
    path.join(root, "app", "catalog", "[slug]", "page.ts"),
    path.join(root, "app", "catalog", "[slug]", "page.jsx"),
    path.join(root, "app", "catalog", "[slug]", "page.js"),
  ];

  const detailPagePath = findExisting(detailCandidates);

  if (!exists(bookCardPath)) {
    fail("No existe components/book-card.tsx");
  } else {
    ok("Existe components/book-card.tsx");
    const code = read(bookCardPath) || "";

    if (code.includes("href={`/catalog/${book.slug}`}")) {
      ok('BookCard apunta a "/catalog/${book.slug}"');
    } else {
      warn("BookCard no parece apuntar a /catalog/${book.slug}");
    }
  }

  if (!exists(catalogPagePath)) {
    warn("No existe app/catalog/page.tsx");
  } else {
    ok("Existe app/catalog/page.tsx");
  }

  if (!detailPagePath) {
    fail("No existe app/catalog/[slug]/page.tsx");
    return { detailPagePath: null };
  }

  ok(`Existe ruta detalle: ${path.relative(root, detailPagePath)}`);

  const detailCode = read(detailPagePath) || "";

  if (detailCode.includes('.eq("slug", slug)')) {
    ok('La página detalle filtra por slug con .eq("slug", slug)');
  } else {
    warn("No veo .eq(\"slug\", slug) en la página detalle");
  }

  if (detailCode.includes('.eq("status", "published")')) {
    ok('La página detalle filtra por status = "published"');
  } else {
    warn('La página detalle no filtra por status = "published"');
  }

  if (detailCode.includes("notFound()")) {
    ok("La página detalle usa notFound() cuando no encuentra libro");
  } else {
    warn("La página detalle no muestra uso claro de notFound()");
  }

  return { detailPagePath };
}

async function checkSupabase() {
  section("SUPABASE");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    fail("Falta NEXT_PUBLIC_SUPABASE_URL");
    return null;
  }

  if (!key) {
    fail(
      "Falta una key usable: SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
    return null;
  }

  ok("Variables de Supabase encontradas");

  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("books")
    .select("id, title, slug, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    fail(`Error leyendo books: ${error.message}`);
    return null;
  }

  if (!data || data.length === 0) {
    fail("No hay libros en la tabla books");
    return null;
  }

  ok(`Libros recuperados: ${data.length}`);

  for (const book of data) {
    console.log(
      `- ${book.title} | slug=${book.slug} | status=${book.status} | link=/catalog/${book.slug}`
    );
  }

  return { supabase, books: data };
}

async function checkSlug(supabase, slug) {
  section(`PRUEBA DE SLUG: ${slug}`);

  const { data: exactBook, error: exactError } = await supabase
    .from("books")
    .select("id, title, slug, status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (exactError) {
    fail(`Error consultando slug exacto: ${exactError.message}`);
    return;
  }

  if (exactBook) {
    ok(`La query exacta del detalle SÍ encuentra el libro: ${exactBook.title}`);
    console.log(`➡️ La ruta /catalog/${slug} debería abrir ese libro`);
  } else {
    fail(
      "La query exacta del detalle NO encuentra libro publicado con ese slug"
    );

    const { data: looseMatches, error: looseError } = await supabase
      .from("books")
      .select("id, title, slug, status")
      .ilike("slug", `%${slug}%`)
      .limit(10);

    if (looseError) {
      warn(`No pude hacer búsqueda flexible: ${looseError.message}`);
      return;
    }

    if (looseMatches && looseMatches.length > 0) {
      warn("Encontré posibles coincidencias parecidas:");
      for (const match of looseMatches) {
        console.log(
          `- ${match.title} | slug=${match.slug} | status=${match.status}`
        );
      }
    } else {
      warn("No encontré coincidencias parecidas en books.slug");
    }
  }
}

async function main() {
  console.log("\n🔎 Diagnóstico de /catalog/[slug]\n");

  await checkFiles();
  const supabaseInfo = await checkSupabase();

  if (!supabaseInfo) {
    process.exitCode = 1;
    return;
  }

  if (targetSlug) {
    await checkSlug(supabaseInfo.supabase, targetSlug);
  } else {
    const published = supabaseInfo.books.find((book) => book.status === "published");

    if (published?.slug) {
      warn(
        `No me pasaste slug. Voy a probar con el más reciente publicado: ${published.slug}`
      );
      await checkSlug(supabaseInfo.supabase, published.slug);
    } else {
      warn("No encontré un libro publicado reciente para probar");
    }
  }

  console.log("\n📌 Cómo usarlo con slug específico:");
  console.log("node scripts/diagnose-catalog-route.cjs tu-slug-aqui");

  console.log("\n📌 Ejemplo:");
  console.log("node scripts/diagnose-catalog-route.cjs la-arquitectura-de-la-disciplina");
}

main().catch((error) => {
  console.error("\n💥 Falló el diagnóstico:", error);
  process.exitCode = 1;
});