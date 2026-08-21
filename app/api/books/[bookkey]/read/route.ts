import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getPublishedBookBySlug,
  getReadableBookAsset,
  userCanReadBook,
} from "@/lib/book-access";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE_BUCKET = "book-files";
const MAX_PDF_BYTES = 250 * 1024 * 1024;

type RouteContext = {
  params: Promise<{
    bookkey: string;
  }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}

function getSafeSlug(value: string) {
  try {
    const slug = decodeURIComponent(value || "").trim();
    return /^[a-z0-9-]{1,160}$/i.test(slug) ? slug : "";
  } catch {
    return "";
  }
}

function isSafeStoragePath(value: string) {
  return (
    value.length <= 1_024 &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value.split("/").every((segment) => segment && segment !== "." && segment !== "..")
  );
}

function getFileName(title: string) {
  return `${title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "libro"}.pdf`;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { bookkey: rawBookkey } = await params;
    const slug = getSafeSlug(rawBookkey);

    if (!slug) {
      return jsonError("Slug inválido.", 400);
    }

    const rateLimit = await consumeRateLimit(request, {
      bucket: "books:read",
      identity: slug,
      limit: 30,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes de lectura." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonError("Debes iniciar sesión para leer este libro.", 401);
    }

    const book = await getPublishedBookBySlug(slug);

    if (!book) {
      return jsonError("Libro no encontrado.", 404);
    }

    const canRead = await userCanReadBook({
      user: {
        id: user.id,
        email: user.email,
      },
      book,
    });

    if (!canRead) {
      return jsonError("Debes comprar este libro para leerlo completo.", 403);
    }

    const asset = await getReadableBookAsset(book.id);

    if (
      asset?.storage_bucket !== FILE_BUCKET ||
      !asset.storage_path ||
      !isSafeStoragePath(asset.storage_path)
    ) {
      return jsonError("Este libro no tiene un PDF válido para lectura.", 404);
    }

    const { data: file, error: downloadError } = await supabaseAdmin.storage
      .from(asset.storage_bucket)
      .download(asset.storage_path);

    if (downloadError || !file) {
      if (downloadError) {
        console.error("No se pudo descargar el PDF protegido:", downloadError.message);
      }
      return jsonError("No se pudo descargar el archivo del libro.", 500);
    }

    if (file.size < 5 || file.size > MAX_PDF_BYTES) {
      return jsonError("El archivo del libro no tiene un tamaño válido.", 422);
    }

    const prefix = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const isPdf =
      prefix[0] === 0x25 &&
      prefix[1] === 0x50 &&
      prefix[2] === 0x44 &&
      prefix[3] === 0x46 &&
      prefix[4] === 0x2d;

    if (!isPdf) {
      console.error("El manuscrito protegido no tiene firma PDF válida.");
      return jsonError("El archivo del libro no es un PDF válido.", 422);
    }

    const fileName = getFileName(book.title);

    return new NextResponse(file.stream(), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(file.size),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/books/[bookkey]/read error:", error);

    return jsonError("Error interno cargando el libro.", 500);
  }
}
