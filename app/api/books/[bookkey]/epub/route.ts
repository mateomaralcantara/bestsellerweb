// ============================================
// ARCHIVO: app/api/books/[bookkey]/epub/route.ts
// ============================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    bookkey: string;
  }>;
};

type ReadMode = "preview" | "full";

type BookRecord = {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  owner_user_id: string | null;
};

type BookAsset = {
  id: string;
  asset_type: string;
  storage_bucket: string | null;
  storage_path: string | null;
  file_url: string | null;
  mime_type: string | null;
  sort_order: number | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status }
  );
}

function safeBookKey(value: string) {
  return decodeURIComponent(value || "").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getReadMode(request: Request): ReadMode {
  const url = new URL(request.url);
  return url.searchParams.get("mode") === "full" ? "full" : "preview";
}

function safeFileName(title: string | null) {
  const clean =
    String(title || "libro")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "libro";

  return `${clean}.epub`;
}

async function getBookByKey(bookkey: string) {
  const query = supabaseAdmin
    .from("books")
    .select("id, title, slug, status, owner_user_id")
    .limit(1);

  const { data, error } = isUuid(bookkey)
    ? await query.eq("id", bookkey).maybeSingle<BookRecord>()
    : await query.eq("slug", bookkey).maybeSingle<BookRecord>();

  if (error) {
    throw new Error(`Error buscando libro: ${error.message}`);
  }

  return data;
}

async function getEpubAsset(bookId: string, mode: ReadMode) {
  const assetType = mode === "preview" ? "epub_preview" : "epub";

  const { data, error } = await supabaseAdmin
    .from("book_assets")
    .select(
      "id, asset_type, storage_bucket, storage_path, file_url, mime_type, sort_order"
    )
    .eq("book_id", bookId)
    .eq("asset_type", assetType)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<BookAsset>();

  if (error) {
    throw new Error(`Error buscando asset EPUB: ${error.message}`);
  }

  return data;
}

async function userCanReadFullBook(book: BookRecord) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return false;
  }

  if (book.owner_user_id === user.id) {
    return true;
  }

  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from("book_purchases")
    .select("id, status")
    .eq("book_id", book.id)
    .eq("user_id", user.id)
    .in("status", ["paid", "completed", "approved", "succeeded"])
    .limit(1)
    .maybeSingle();

  if (purchaseError) {
    console.error("Error verificando compra EPUB full:", purchaseError);
    return false;
  }

  return Boolean(purchase);
}

async function downloadEpubAsset(asset: BookAsset) {
  if (!asset.storage_bucket || !asset.storage_path) {
    return {
      ok: false as const,
      error: "El asset EPUB no tiene bucket o ruta de Storage.",
      arrayBuffer: null,
    };
  }

  const { data: file, error } = await supabaseAdmin.storage
    .from(asset.storage_bucket)
    .download(asset.storage_path);

  if (error || !file) {
    return {
      ok: false as const,
      error: error?.message || "No se pudo descargar el EPUB desde Storage.",
      arrayBuffer: null,
    };
  }

  const arrayBuffer = await file.arrayBuffer();

  if (!arrayBuffer || arrayBuffer.byteLength <= 0) {
    return {
      ok: false as const,
      error: "El EPUB descargado está vacío.",
      arrayBuffer: null,
    };
  }

  return {
    ok: true as const,
    error: "",
    arrayBuffer,
  };
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const bookkey = safeBookKey((await params).bookkey);

    if (!bookkey) {
      return jsonError("Identificador de libro inválido.", 400);
    }

    const mode = getReadMode(request);
    const book = await getBookByKey(bookkey);

    if (!book) {
      return jsonError("Libro no encontrado.", 404);
    }

    /*
      IMPORTANTE:
      - mode=preview es público.
      - mode=full exige login/compra.
    */
    if (mode === "full") {
      const canRead = await userCanReadFullBook(book);

      if (!canRead) {
        return jsonError("Debes comprar este libro para leerlo completo.", 403);
      }
    }

    const asset = await getEpubAsset(book.id, mode);

    if (!asset) {
      return jsonError(
        mode === "preview"
          ? "Este libro no tiene EPUB preview registrado."
          : "Este libro no tiene EPUB completo registrado.",
        404
      );
    }

    const downloaded = await downloadEpubAsset(asset);

    if (!downloaded.ok || !downloaded.arrayBuffer) {
      return jsonError(downloaded.error, 500);
    }

    const contentType = asset.mime_type || "application/epub+zip";
    const fileName = safeFileName(book.title);

    return new NextResponse(downloaded.arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(downloaded.arrayBuffer.byteLength),
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control":
          mode === "preview"
            ? "no-store, max-age=0"
            : "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("GET /api/books/[bookkey]/epub error:", error);

    return jsonError("Error interno cargando EPUB.", 500);
  }
}
