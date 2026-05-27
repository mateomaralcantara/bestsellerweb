import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { extractBookPreviewFromFile } from "../lib/book-preview.ts";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const filePath =
  process.env.SMOKE_TEST_PDF_PATH ||
  path.join(process.cwd(), "tests", "fixtures", "sample-book.pdf");

function ensureFile(targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`No existe el archivo: ${targetPath}`);
  }
}

async function main() {
  console.log("\n🔎 Prueba directa de lib/book-preview.ts\n");

  ensureFile(filePath);

  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const file = new File([buffer], fileName, {
    type: "application/pdf",
  });

  console.log("file.name:", file.name);
  console.log("file.type:", file.type);
  console.log("file.size:", file.size);

  const result = await extractBookPreviewFromFile(file);

  console.log("\n=== RESULTADO ===");
  console.dir(result, { depth: null });

  console.log("\n=== BANDERAS ===");
  console.log("argument:", Boolean(result.argument));
  console.log("introduction:", Boolean(result.introduction));
  console.log("chapterOne:", Boolean(result.chapterOne));
  console.log("source:", result.source);
}

main().catch((error) => {
  console.error("\n💥 Falló la prueba directa:", error);
  process.exitCode = 1;
});