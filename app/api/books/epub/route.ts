import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getPublishedBookBySlug,
  userCanReadBook,
} from "@/lib/book-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    slug: string;
  };
};

type EpubAsset = {
  asset_type: string;
  storage_bucket: string | null;
  storage_path: string | null;
  file_url: string | null;
  mime_type: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getSafeSlug(value: string) {
  return decodeURIComponent(value || "").trim();
}

function getFileName(title: string) {
  const safeTitle =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "libro";

  return `${safeTitle}.epub`;
}

async function getEpubAsset(bookId: string, mode: "preview" | "full") {
  const assetTypes =
    mode === "preview" ? ["epub_preview"] : ["epub", "manuscript"];

  const { data, error } = await supabaseAdmin
    .from("book_assets")
    .select("asset_type, storage_bucket, storage_path, file_url, mime_type")
    .eq("book_id", bookId)
    .in("asset_type", assetTypes)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<EpubAsset>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const slug = getSafeSlug(params.slug);

    if (!slug) {
      return jsonError("Slug inválido.", 400);
    }

    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") === "full" ? "full" : "preview";

    const book = await getPublishedBookBySlug(slug);

    if (!book) {
      return jsonError("Libro no encontrado.", 404);
    }

    if (mode === "full") {
      const supabase = await createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return jsonError("Debes iniciar sesión para leer este libro.", 401);
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
    }

    const asset = await getEpubAsset(book.id, mode);

    if (!asset?.storage_bucket || !asset.storage_path) {
      return jsonError(
        mode === "preview"
          ? "Este libro no tiene EPUB de muestra."
          : "Este libro no tiene EPUB completo.",
        404
      );
    }

    const { data: file, error: downloadError } = await supabaseAdmin.storage
      .from(asset.storage_bucket)
      .download(asset.storage_path);

    if (downloadError || !file) {
      return jsonError(
        downloadError?.message || "No se pudo cargar el EPUB.",
        500
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": asset.mime_type || "application/epub+zip",
        "Content-Disposition": `inline; filename="${getFileName(book.title)}"`,
        "Cache-Control": mode === "preview" ? "public, max-age=300" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/books/[slug]/epub error:", error);

    return jsonError("Error interno cargando EPUB.", 500);
  }
}