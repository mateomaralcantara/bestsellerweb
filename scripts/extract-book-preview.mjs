import { access, readFile } from "node:fs/promises";
import path from "node:path";

const PREVIEW_PAGE_SCAN_LIMIT = 40;
const MAX_ARGUMENT_CHARS = 4000;
const MAX_SECTION_CHARS = 120000;
const LETTERS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";

function getExtension(fileName) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function emptyPreview(source = "unsupported") {
  return {
    argument: null,
    introduction: null,
    chapterOne: null,
    source,
  };
}

function normalizeSearchText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanExtractedText(value) {
  if (!value) return null;

  const cleaned = value
    .replace(/\u00A0/g, " ")
    .replace(/\r\n?/g, "\n")

    // une palabras cortadas por guion y salto
    .replace(new RegExp(`([${LETTERS}])-\\n([${LETTERS}])`, "g"), "$1$2")

    // une líneas partidas que pertenecen al mismo párrafo
    .replace(new RegExp(`([${LETTERS},;:])\\n([${LETTERS}¿¡"“'(])`, "g"), "$1 $2")
    .replace(/([0-9])\n([0-9])/g, "$1 $2")

    // limpia espacios
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")

    // corrige espacios antes de puntuación
    .replace(/\s+([,.;:!?])/g, "$1")

    // compacta saltos excesivos
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

function clampText(value, max) {
  if (!value) return null;
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

function hasArgumentMarker(text) {
  const normalized = normalizeSearchText(text);

  return (
    /\bargumento\b/.test(normalized) ||
    /\bargumentos\b/.test(normalized) ||
    /\bsinopsis\b/.test(normalized) ||
    /\bresumen\b/.test(normalized)
  );
}

function hasIntroductionMarker(text) {
  const normalized = normalizeSearchText(text);

  return (
    /\bintroduccion\b/.test(normalized) ||
    /\bintroduction\b/.test(normalized)
  );
}

function hasChapterOneMarker(text) {
  const normalized = normalizeSearchText(text);

  return (
    /\bcapitulo\s*1\b/.test(normalized) ||
    /\bcapitulo\s*i\b/.test(normalized) ||
    /\bchapter\s*1\b/.test(normalized) ||
    /\bchapter\s*i\b/.test(normalized)
  );
}

function hasChapterTwoMarker(text) {
  const normalized = normalizeSearchText(text);

  return (
    /\bcapitulo\s*2\b/.test(normalized) ||
    /\bcapitulo\s*ii\b/.test(normalized) ||
    /\bchapter\s*2\b/.test(normalized) ||
    /\bchapter\s*ii\b/.test(normalized)
  );
}

function joinPageRange(pages, startIndex, endExclusive) {
  if (startIndex < 0 || startIndex >= pages.length) return null;
  if (endExclusive <= startIndex) return null;

  const merged = pages
    .slice(startIndex, Math.min(endExclusive, pages.length))
    .map((page) => page.text)
    .join("\n\n");

  return cleanExtractedText(merged);
}

function findFirstNonTrivialPage(pages) {
  return pages.findIndex((page) => page.searchable.length > 80);
}

function getNextSectionEnd(startIndex, candidateIndexes, fallbackIndex) {
  const nextIndex = candidateIndexes
    .filter((index) => Number.isInteger(index) && index > startIndex)
    .sort((a, b) => a - b)[0];

  return nextIndex ?? fallbackIndex;
}

function buildAutoArgument(pages, introStart, chapterOneStart) {
  const firstContentPage = findFirstNonTrivialPage(pages);
  const startIndex = firstContentPage >= 0 ? firstContentPage : 0;

  const endIndex =
    introStart > startIndex
      ? introStart
      : chapterOneStart > startIndex
        ? chapterOneStart
        : Math.min(pages.length, startIndex + 2);

  return clampText(joinPageRange(pages, startIndex, endIndex), MAX_ARGUMENT_CHARS);
}

function detectFileKind(filePath, bytes) {
  const ext = getExtension(path.basename(filePath));
  const header = Array.from(bytes.subarray(0, 5))
    .map((byte) => String.fromCharCode(byte))
    .join("");

  if (header === "%PDF-" || ext === "pdf") {
    return "pdf";
  }

  if (ext === "epub") {
    return "epub";
  }

  return "unsupported";
}

async function extractPdfPreview(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const pages = [];

  try {
    const maxPages = Math.min(pdfDoc.numPages, PREVIEW_PAGE_SCAN_LIMIT);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await pdfDoc.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const rawPageText = textContent.items
        .map((item) =>
          "str" in item && typeof item.str === "string" ? item.str : ""
        )
        .join(" ");

      page.cleanup();

      const cleaned = cleanExtractedText(rawPageText) || "";

      pages.push({
        text: cleaned,
        searchable: normalizeSearchText(cleaned),
      });
    }
  } finally {
    try {
      await pdfDoc.destroy();
    } catch {
      // noop
    }
  }

  if (pages.length === 0) {
    return emptyPreview("pdf");
  }

  const argumentStart = pages.findIndex((page) =>
    hasArgumentMarker(page.searchable)
  );

  const introductionStart = pages.findIndex((page) =>
    hasIntroductionMarker(page.searchable)
  );

  const chapterOneStart = pages.findIndex((page) =>
    hasChapterOneMarker(page.searchable)
  );

  const chapterTwoStart =
    chapterOneStart >= 0
      ? pages.findIndex(
          (page, index) =>
            index > chapterOneStart && hasChapterTwoMarker(page.searchable)
        )
      : -1;

  const argumentEnd = getNextSectionEnd(
    argumentStart,
    [introductionStart, chapterOneStart],
    pages.length
  );

  const introductionEnd = getNextSectionEnd(
    introductionStart,
    [chapterOneStart],
    pages.length
  );

  const chapterOneEnd = getNextSectionEnd(
    chapterOneStart,
    [chapterTwoStart],
    pages.length
  );

  const argument =
    argumentStart >= 0
      ? clampText(
          joinPageRange(pages, argumentStart, argumentEnd),
          MAX_SECTION_CHARS
        )
      : buildAutoArgument(pages, introductionStart, chapterOneStart);

  const introduction =
    introductionStart >= 0
      ? clampText(
          joinPageRange(pages, introductionStart, introductionEnd),
          MAX_SECTION_CHARS
        )
      : null;

  const chapterOne =
    chapterOneStart >= 0
      ? clampText(
          joinPageRange(pages, chapterOneStart, chapterOneEnd),
          MAX_SECTION_CHARS
        )
      : null;

  return {
    argument,
    introduction,
    chapterOne,
    source: "pdf",
  };
}

async function extractEpubPreview() {
  return emptyPreview("epub");
}

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    throw new Error("Falta la ruta del archivo");
  }

  await access(filePath);

  const bytes = await readFile(filePath);
  const kind = detectFileKind(filePath, bytes);

  let result = emptyPreview();

  if (kind === "pdf") {
    result = await extractPdfPreview(bytes);
  } else if (kind === "epub") {
    result = await extractEpubPreview();
  }

  process.stdout.write(JSON.stringify(result));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Error desconocido";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});