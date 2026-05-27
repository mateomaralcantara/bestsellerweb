import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

function loadEnvFile(fileName) {
  const filePath = path.join(ROOT_DIR, fileName);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function getSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL.");
  if (!serviceKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function print(title) {
  console.log("");
  console.log("=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

async function fileExistsInStorage(supabase, bucket, storagePath) {
  if (!bucket || !storagePath) return false;

  const folder = storagePath.split("/").slice(0, -1).join("/");
  const fileName = storagePath.split("/").pop();

  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 1000,
  });

  if (error) return false;

  return (data ?? []).some((item) => item.name === fileName);
}

async function main() {
  const slug = getArg("slug");

  if (!slug) {
    throw new Error("Uso: node scripts/debug-preview-readiness.mjs --slug SLUG");
  }

  const supabase = getSupabase();

  print("1) Libro");

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, title, slug, status, preview_status, preview_error, preview_generated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (bookError) throw new Error(bookError.message);
  if (!book) throw new Error(`No existe libro con slug: ${slug}`);

  console.log(book);

  print("2) Assets del libro");

  const { data: assets, error: assetsError } = await supabase
    .from("book_assets")
    .select("id, asset_type, file_url, storage_bucket, storage_path, mime_type, is_public, sort_order")
    .eq("book_id", book.id)
    .order("sort_order", { ascending: true });

  if (assetsError) throw new Error(assetsError.message);

  console.table(assets ?? []);

  const readableAsset = (assets ?? []).find((asset) =>
    ["pdf", "manuscript"].includes(asset.asset_type)
  );

  print("3) Asset PDF/manuscript");

  if (!readableAsset) {
    console.log("❌ No hay asset tipo pdf o manuscript.");
    console.log("Solución: sube un PDF en edición o verifica book_assets.asset_type.");
    return;
  }

  console.log(readableAsset);

  if (!readableAsset.storage_bucket || !readableAsset.storage_path) {
    console.log("❌ El asset no tiene storage_bucket/storage_path.");
    console.log("Solución: el PDF debe estar en Storage privado, no solo como file_url.");
    return;
  }

  const extension = readableAsset.storage_path.split("?")[0].split(".").pop()?.toLowerCase();

  if (extension !== "pdf") {
    console.log(`❌ El asset no parece PDF. Extensión detectada: ${extension}`);
    console.log("El generador de páginas solo funciona con PDF.");
    return;
  }

  const exists = await fileExistsInStorage(
    supabase,
    readableAsset.storage_bucket,
    readableAsset.storage_path
  );

  console.log(exists ? "✅ El archivo PDF existe en Storage." : "❌ El PDF no aparece en Storage.");

  print("4) Preview pages actuales");

  const { count, error: countError } = await supabase
    .from("book_preview_pages")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("book_id", book.id);

  if (countError) throw new Error(countError.message);

  console.log(`preview_pages = ${count ?? 0}`);

  print("5) Comando recomendado");

  console.log(`npm run preview:book -- --slug ${book.slug} --pages 16 --scale 5200`);
}

main().catch((error) => {
  console.error("");
  console.error("Error:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});