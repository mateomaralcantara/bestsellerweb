import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const routePath = path.join(ROOT_DIR, "app", "api", "books", "route.ts");

if (!fs.existsSync(routePath)) {
  console.error("");
  console.error("No encontré el archivo:");
  console.error(routePath);
  process.exit(1);
}

const original = fs.readFileSync(routePath, "utf8");

const backupPath = `${routePath}.backup-no-native-preview-${Date.now()}`;
fs.writeFileSync(backupPath, original, "utf8");

let next = original;

next = next.replace(/\nconst PDF_RENDER_SCALE = 1\.55;\n/g, "\n");

const dangerousBlockPattern =
  /async function canvasToPngBuffer[\s\S]*?\nexport async function POST/;

const safePreviewBlock = `async function generateVisualPreview(params: {
  bookId: RecordId;
  slug: string;
  form: UploadBookForm;
}): Promise<PreviewGenerationResult> {
  /*
    Importante:
    No generamos imágenes PDF dentro del Route Handler.

    Motivo:
    pdfjs-dist + @napi-rs/canvas cargan binarios nativos que Next/Webpack
    intenta empaquetar cuando compila app/api/books/route.ts. En Windows eso
    rompe el endpoint con skia.win32-x64-msvc.node.

    Flujo correcto:
    1. POST /api/books guarda libro, portada, archivo y assets.
    2. El libro queda con preview_status = "pending".
    3. Luego se genera el preview visual con:
       npm run preview:book -- --slug ${'${params.slug}'} --pages 16 --scale 5200
  */

  try {
    await clearPreviewPages(params.bookId);
  } catch (error) {
    console.warn("No se pudieron limpiar páginas de preview:", getErrorMessage(error));
  }

  await tryUpdatePreviewStatus(params.bookId, "pending");

  if (params.form.previewMode === "disabled") {
    return {
      status: "unsupported",
      pageCount: 0,
      paths: [],
      error: "La muestra visual está desactivada para este libro.",
    };
  }

  return {
    status: "unsupported",
    pageCount: 0,
    paths: [],
    error:
      "Muestra visual pendiente. Ejecuta: npm run preview:book -- --slug " +
      params.slug +
      " --pages " +
      Math.min(params.form.previewPageCount || 16, 16) +
      " --scale 5200",
  };
}

export async function POST`;

if (!dangerousBlockPattern.test(next)) {
  console.error("");
  console.error("No pude encontrar el bloque peligroso completo.");
  console.error("");
  console.error("Busqué desde:");
  console.error("async function canvasToPngBuffer");
  console.error("");
  console.error("hasta:");
  console.error("export async function POST");
  console.error("");
  console.error("No modifiqué el archivo principal.");
  console.error("Backup creado:");
  console.error(path.relative(ROOT_DIR, backupPath));
  process.exit(1);
}

next = next.replace(dangerousBlockPattern, safePreviewBlock);

const forbiddenPatterns = [
  "@napi-rs/canvas",
  "pdfjs-dist/legacy/build/pdf.mjs",
  "createCanvas",
  "getDocument",
  "canvasToPngBuffer",
];

const remaining = forbiddenPatterns.filter((pattern) => next.includes(pattern));

if (remaining.length > 0) {
  console.error("");
  console.error("Todavía quedan patrones peligrosos en route.ts:");
  for (const pattern of remaining) {
    console.error(`- ${pattern}`);
  }
  console.error("");
  console.error("No escribí el archivo corregido para evitar dejarlo a medias.");
  console.error("Backup creado:");
  console.error(path.relative(ROOT_DIR, backupPath));
  process.exit(1);
}

fs.writeFileSync(routePath, next, "utf8");

console.log("");
console.log("✅ app/api/books/route.ts corregido.");
console.log("");
console.log("Se eliminó del API route:");
console.log("- @napi-rs/canvas");
console.log("- pdfjs-dist");
console.log("- createCanvas");
console.log("- getDocument");
console.log("- renderPdfPreviewPages con canvas nativo");
console.log("");
console.log("Backup creado:");
console.log(path.relative(ROOT_DIR, backupPath));
console.log("");
console.log("Ahora ejecuta:");
console.log("Remove-Item -Recurse -Force .next");
console.log("npm run dev");
console.log("");