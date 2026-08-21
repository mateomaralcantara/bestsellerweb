const PREVIEW_PAGE_SCAN_LIMIT = 40;
const MAX_ARGUMENT_CHARS = 4000;
const MAX_SECTION_CHARS = 120000;

export type ExtractedBookPreview = {
  argument: string | null;
  introduction: string | null;
  chapterOne: string | null;
  source: "pdf" | "epub" | "unsupported";
};

type PdfJsModule = {
  getDocument: (options: Record<string, unknown>) => {
    destroy: () => Promise<void>;
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{
          items: Array<{ str?: string }>;
        }>;
        cleanup: () => void;
      }>;
    }>;
  };
};

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

async function detectFileKind(
  file: File
): Promise<"pdf" | "epub" | "unsupported"> {
  const fileName = typeof file.name === "string" ? file.name.trim() : "";
  const ext = getExtension(fileName);
  const mime =
    typeof file.type === "string" ? file.type.toLowerCase().trim() : "";

  let header = "";
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    header = Array.from(head)
      .map((byte) => String.fromCharCode(byte))
      .join("");
  } catch {
    header = "";
  }

  if (header === "%PDF-" || ext === "pdf" || mime === "application/pdf") {
    return "pdf";
  }

  if (ext === "epub" || mime === "application/epub+zip") {
    return "epub";
  }

  return "unsupported";
}

async function loadPdfJs(): Promise<PdfJsModule> {
  return (await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  )) as unknown as PdfJsModule;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanExtractedText(value: string | null | undefined): string | null {
  if (!value) return null;

  const cleaned = value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

function clampText(value: string | null, max: number): string | null {
  if (!value) return null;
  if (value.length <= max) return value;
  return value.slice(0, max).trimEnd();
}

function hasArgumentMarker(text: string): boolean {
  const normalized = normalizeSearchText(text);

  return (
    /\bargumento\b/.test(normalized) ||
    /\bargumentos\b/.test(normalized) ||
    /\bsinopsis\b/.test(normalized) ||
    /\bresumen\b/.test(normalized)
  );
}

function hasIntroductionMarker(text: string): boolean {
  const normalized = normalizeSearchText(text);

  return (
    /\bintroduccion\b/.test(normalized) ||
    /\bintroduction\b/.test(normalized)
  );
}

function hasChapterOneMarker(text: string): boolean {
  const normalized = normalizeSearchText(text);

  return (
    /\bcapitulo\s*1\b/.test(normalized) ||
    /\bcapitulo\s*i\b/.test(normalized) ||
    /\bchapter\s*1\b/.test(normalized) ||
    /\bchapter\s*i\b/.test(normalized)
  );
}

function hasChapterTwoMarker(text: string): boolean {
  const normalized = normalizeSearchText(text);

  return (
    /\bcapitulo\s*2\b/.test(normalized) ||
    /\bcapitulo\s*ii\b/.test(normalized) ||
    /\bchapter\s*2\b/.test(normalized) ||
    /\bchapter\s*ii\b/.test(normalized)
  );
}

function joinPageRange(
  pages: Array<{ text: string }>,
  startIndex: number,
  endExclusive: number
): string | null {
  if (startIndex < 0 || startIndex >= pages.length) return null;
  if (endExclusive <= startIndex) return null;

  return cleanExtractedText(
    pages
      .slice(startIndex, Math.min(endExclusive, pages.length))
      .map((page) => page.text)
      .join("\n\n")
  );
}

function findFirstNonTrivialPage(
  pages: Array<{ searchable: string }>
): number {
  return pages.findIndex((page) => page.searchable.length > 80);
}

function buildAutoArgument(
  pages: Array<{ text: string; searchable: string }>,
  introStart: number,
  chapterOneStart: number
): string | null {
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

async function extractPdfPreview(file: File): Promise<ExtractedBookPreview> {
  const pdfjs = await loadPdfJs();
  const bytes = new Uint8Array(await file.arrayBuffer());

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    disableFontFace: true,
    enableXfa: false,
    maxImageSize: 16_777_216,
  });

  const pdfDoc = await loadingTask.promise;
  const pages: Array<{ text: string; searchable: string }> = [];

  try {
    const maxPages = Math.min(pdfDoc.numPages, PREVIEW_PAGE_SCAN_LIMIT);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await pdfDoc.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) =>
          "str" in item && typeof item.str === "string" ? item.str : ""
        )
        .join(" ");

      page.cleanup();

      const cleaned = cleanExtractedText(pageText) || "";

      pages.push({
        text: cleaned,
        searchable: normalizeSearchText(cleaned),
      });
    }
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      // noop
    }
  }

  if (pages.length === 0) {
    return {
      argument: null,
      introduction: null,
      chapterOne: null,
      source: "pdf",
    };
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

  const argument =
    argumentStart >= 0
      ? clampText(
          joinPageRange(
            pages,
            argumentStart,
            introductionStart > argumentStart
              ? introductionStart
              : chapterOneStart > argumentStart
                ? chapterOneStart
                : pages.length
          ),
          MAX_SECTION_CHARS
        )
      : buildAutoArgument(pages, introductionStart, chapterOneStart);

  const introduction =
    introductionStart >= 0
      ? clampText(
          joinPageRange(
            pages,
            introductionStart,
            chapterOneStart > introductionStart ? chapterOneStart : pages.length
          ),
          MAX_SECTION_CHARS
        )
      : null;

  const chapterOne =
    chapterOneStart >= 0
      ? clampText(
          joinPageRange(
            pages,
            chapterOneStart,
            chapterTwoStart > chapterOneStart ? chapterTwoStart : pages.length
          ),
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

async function extractEpubPreview(_file: File): Promise<ExtractedBookPreview> {
  return {
    argument: null,
    introduction: null,
    chapterOne: null,
    source: "epub",
  };
}

export async function extractBookPreviewFromFile(
  file: File
): Promise<ExtractedBookPreview> {
  const kind = await detectFileKind(file);

  if (kind === "pdf") {
    return extractPdfPreview(file);
  }

  if (kind === "epub") {
    return extractEpubPreview(file);
  }

  return {
    argument: null,
    introduction: null,
    chapterOne: null,
    source: "unsupported",
  };
}
