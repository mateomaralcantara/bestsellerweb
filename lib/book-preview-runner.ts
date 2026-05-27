import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);
const WORKER_FILE = path.join(process.cwd(), "scripts", "extract-book-preview.mjs");
const TEMP_DIR = path.join(tmpdir(), "bestseller-preview");
const MAX_STDOUT_BUFFER = 10 * 1024 * 1024;

export type ExtractedBookPreview = {
  argument: string | null;
  introduction: string | null;
  chapterOne: string | null;
  source: "pdf" | "epub" | "unsupported";
};

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function emptyPreview(): ExtractedBookPreview {
  return {
    argument: null,
    introduction: null,
    chapterOne: null,
    source: "unsupported",
  };
}

function normalizeNullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeSource(value: unknown): ExtractedBookPreview["source"] {
  return value === "pdf" || value === "epub" || value === "unsupported"
    ? value
    : "unsupported";
}

function safePreview(value: unknown): ExtractedBookPreview {
  if (!value || typeof value !== "object") {
    return emptyPreview();
  }

  const candidate = value as Partial<ExtractedBookPreview>;

  return {
    argument: normalizeNullableText(candidate.argument),
    introduction: normalizeNullableText(candidate.introduction),
    chapterOne: normalizeNullableText(candidate.chapterOne),
    source: normalizeSource(candidate.source),
  };
}

async function writeTempFile(file: File): Promise<string> {
  const extension = getExtension(file.name) || "bin";
  const tempFilePath = path.join(TEMP_DIR, `${randomUUID()}.${extension}`);
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(TEMP_DIR, { recursive: true });
  await writeFile(tempFilePath, buffer);

  return tempFilePath;
}

async function runPreviewWorker(filePath: string): Promise<ExtractedBookPreview> {
  const { stdout } = await execFileAsync(process.execPath, [WORKER_FILE, filePath], {
    maxBuffer: MAX_STDOUT_BUFFER,
  });

  return safePreview(JSON.parse(stdout));
}

export async function extractPreviewWithWorker(
  file: File
): Promise<ExtractedBookPreview> {
  let tempFilePath: string | null = null;

  try {
    tempFilePath = await writeTempFile(file);
    return await runPreviewWorker(tempFilePath);
  } catch (error) {
    console.error("Error ejecutando worker de preview:", error);
    return emptyPreview();
  } finally {
    if (tempFilePath) {
      await rm(tempFilePath, { force: true }).catch(() => {});
    }
  }
}