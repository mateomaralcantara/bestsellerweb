import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
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

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
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

async function getPreviewCount(supabase, bookId) {
  const { count, error } = await supabase
    .from("book_preview_pages")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("book_id", bookId);

  if (error) throw new Error(`Error contando previews: ${error.message}`);

  return count ?? 0;
}

async function getReadableAsset(supabase, bookId) {
  const { data, error } = await supabase
    .from("book_assets")
    .select("asset_type, storage_bucket, storage_path, file_url, mime_type, sort_order")
    .eq("book_id", bookId)
    .in("asset_type", ["pdf", "manuscript"])
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Error cargando asset: ${error.message}`);

  return data ?? null;
}

async function getBooks(supabase) {
  const includeUnderReview = hasFlag("include-under-review");

  const statuses = includeUnderReview
    ? ["published", "under_review"]
    : ["published"];

  const { data, error } = await supabase
    .from("books")
    .select("id, title, slug, status, preview_status, updated_at")
    .in("status", statuses)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Error cargando libros: ${error.message}`);

  return data ?? [];
}

function runPreviewCommand({ slug, pages, scale }) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

  const args = [
    "run",
    "preview:book",
    "--",
    "--slug",
    slug,
    "--pages",
    String(pages),
    "--scale",
    String(scale),
  ];

  console.log("");
  console.log(`Generando preview para: ${slug}`);
  console.log(`${npmCommand} ${args.join(" ")}`);
  console.log("");

  const result = spawnSync(npmCommand, args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    shell: false,
    windowsHide: false,
  });

  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);

  if (result.error) {
    return {
      ok: false,
      error: result.error.message,
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      error: `preview:book terminó con código ${result.status}`,
    };
  }

  return {
    ok: true,
    error: null,
  };
}

async function main() {
  const supabase = getSupabase();

  const pages = Number(getArg("pages", "16"));
  const scale = Number(getArg("scale", "5200"));
  const force = hasFlag("force");

  const books = await getBooks(supabase);

  console.log("");
  console.log(`Libros encontrados: ${books.length}`);
  console.log(`Páginas PDF por libro: ${pages}`);
  console.log(`Escala: ${scale}`);
  console.log(`Forzar regeneración: ${force ? "sí" : "no"}`);
  console.log("");

  const failed = [];
  let generated = 0;
  let skipped = 0;

  for (const book of books) {
    const previewCount = await getPreviewCount(supabase, book.id);
    const asset = await getReadableAsset(supabase, book.id);

    console.log(
      `${book.title} | ${book.slug} | status=${book.status} | preview_pages=${previewCount}`
    );

    if (!force && previewCount > 0) {
      skipped += 1;
      continue;
    }

    if (!asset) {
      failed.push({
        slug: book.slug,
        reason: "No tiene asset tipo pdf/manuscript.",
      });
      console.log("❌ Saltado: no tiene asset PDF/manuscript.");
      continue;
    }

    if (!asset.storage_bucket || !asset.storage_path) {
      failed.push({
        slug: book.slug,
        reason: "El asset no tiene storage_bucket/storage_path.",
      });
      console.log("❌ Saltado: asset sin storage_bucket/storage_path.");
      continue;
    }

    if (!asset.storage_path.toLowerCase().endsWith(".pdf")) {
      failed.push({
        slug: book.slug,
        reason: `El asset no es PDF: ${asset.storage_path}`,
      });
      console.log("❌ Saltado: el asset no es PDF.");
      continue;
    }

    const result = runPreviewCommand({
      slug: book.slug,
      pages,
      scale,
    });

    if (!result.ok) {
      failed.push({
        slug: book.slug,
        reason: result.error,
      });
      console.log(`❌ Falló ${book.slug}: ${result.error}`);
      continue;
    }

    generated += 1;
  }

  console.log("");
  console.log("Resultado:");
  console.log(`Generados: ${generated}`);
  console.log(`Saltados: ${skipped}`);
  console.log(`Fallidos: ${failed.length}`);

  if (failed.length > 0) {
    console.log("");
    console.log("Fallidos:");
    for (const item of failed) {
      console.log(`- ${item.slug}: ${item.reason}`);
    }
  }

  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("Error generando previews faltantes:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});