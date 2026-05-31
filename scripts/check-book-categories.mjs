import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const categoryToTest = process.argv.slice(2).join(" ").trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Faltan variables de Supabase.");
  console.error("");
  console.error("Necesitas en .env.local:");
  console.error("NEXT_PUBLIC_SUPABASE_URL=...");
  console.error("SUPABASE_SERVICE_ROLE_KEY=...");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function bookMatchesCategory(book, category) {
  const selected = normalize(category);

  return [
    book.primary_niche,
    book.primary_category,
    book.secondary_category,
    ...(Array.isArray(book.categories) ? book.categories : []),
  ].some((item) => normalize(item) === selected);
}

function printBook(book) {
  console.log("");
  console.log(`📘 ${book.title}`);
  console.log(`   slug: ${book.slug}`);
  console.log(`   status: ${book.status}`);
  console.log(`   nicho: ${book.primary_niche || "SIN NICHO"}`);
  console.log(`   categoría: ${book.primary_category || "SIN CATEGORÍA"}`);
  console.log(`   subcategoría: ${book.secondary_category || "SIN SUBCATEGORÍA"}`);
  console.log(
    `   keywords: ${
      Array.isArray(book.keywords) && book.keywords.length
        ? book.keywords.join(", ")
        : "SIN KEYWORDS"
    }`
  );
}

async function main() {
  console.log("🔎 Probando conexión libros ↔ categorías...");
  console.log("");

  const { data: books, error } = await supabase
    .from("books")
    .select(
      `
      id,
      title,
      slug,
      status,
      primary_niche,
      primary_category,
      secondary_category,
      keywords,
      categories
    `
    )
    .limit(500);

  if (error) {
    console.error("❌ Error leyendo tabla books:");
    console.error(error.message);

    if (
      error.message.includes("primary_niche") ||
      error.message.includes("primary_category") ||
      error.message.includes("secondary_category") ||
      error.message.includes("keywords")
    ) {
      console.error("");
      console.error("⚠️ Parece que faltan columnas de categoría en books.");
    }

    process.exit(1);
  }

  const list = books || [];

  console.log(`✅ Supabase respondió correctamente.`);
  console.log(`📚 Libros encontrados: ${list.length}`);

  if (list.length === 0) {
    console.log("");
    console.log("⚠️ No hay libros en la tabla books todavía.");
    return;
  }

  const categorized = list.filter(
    (book) => book.primary_niche && book.primary_category
  );

  const uncategorized = list.filter(
    (book) => !book.primary_niche || !book.primary_category
  );

  console.log(`✅ Libros con nicho y categoría: ${categorized.length}`);
  console.log(`⚠️ Libros sin categoría completa: ${uncategorized.length}`);

  const categoryCounter = new Map();

  for (const book of list) {
    const category = book.primary_category || "SIN CATEGORÍA";
    categoryCounter.set(category, (categoryCounter.get(category) || 0) + 1);
  }

  console.log("");
  console.log("🏷️ Categorías detectadas:");

  [...categoryCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   - ${category}: ${count}`);
    });

  if (categoryToTest) {
    const matchedBooks = list.filter((book) =>
      bookMatchesCategory(book, categoryToTest)
    );

    console.log("");
    console.log(`🧪 Probando filtro por categoría: "${categoryToTest}"`);
    console.log(`✅ Libros que coinciden: ${matchedBooks.length}`);

    matchedBooks.slice(0, 20).forEach(printBook);

    if (matchedBooks.length === 0) {
      console.log("");
      console.log("❌ Ningún libro coincide con esa categoría.");
      console.log("Revisa que el libro tenga esa categoría exacta en:");
      console.log("   - primary_niche");
      console.log("   - primary_category");
      console.log("   - secondary_category");
    }

    return;
  }

  console.log("");
  console.log("📌 Últimos libros revisados:");
  list.slice(0, 10).forEach(printBook);

  console.log("");
  console.log("✅ Prueba terminada.");
  console.log("");
  console.log("Para probar una categoría específica:");
  console.log('node scripts/check-book-categories.mjs "Inteligencia artificial"');
}

main().catch((error) => {
  console.error("❌ Error inesperado:");
  console.error(error);
  process.exit(1);
});