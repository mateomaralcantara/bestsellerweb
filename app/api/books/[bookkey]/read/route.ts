import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getPublishedBookBySlug,
  getReadableBookAsset,
  userCanReadBook,
} from "@/lib/book-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    bookkey: string;
  }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getSafeSlug(value: string) {
  return decodeURIComponent(value || "").trim();
}

function getContentType(mimeType: string | null, assetType: string | null) {
  if (mimeType?.trim()) return mimeType;

  if (
    assetType === "pdf" ||
    assetType === "manuscript" ||
    assetType === "manuscript_pdf"
  ) {
    return "application/pdf";
  }

  return "application/octet-stream";
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

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const slug = getSafeSlug((await params).bookkey);

    if (!slug) {
      return jsonError("Slug inválido.", 400);
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

    if (!asset?.storage_bucket || !asset.storage_path) {
      return jsonError("Este libro no tiene un PDF válido para lectura.", 404);
    }

    const { data: file, error: downloadError } = await supabaseAdmin.storage
      .from(asset.storage_bucket)
      .download(asset.storage_path);

    if (downloadError || !file) {
      return jsonError(
        downloadError?.message || "No se pudo descargar el archivo del libro.",
        500
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const contentType = getContentType(asset.mime_type, asset.asset_type);
    const fileName = getFileName(book.title);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/books/[bookkey]/read error:", error);

    return jsonError("Error interno cargando el libro.", 500);
  }
}
