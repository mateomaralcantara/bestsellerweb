import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OG_WIDTH = 600;
const OG_HEIGHT = 315;

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type BookRow = {
  title: string;
  cover_url: string | null;
};

function safeSlug(value: string) {
  try {
    return decodeURIComponent(value || "").trim();
  } catch {
    return "";
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const slug = safeSlug((await params).slug);

  const { data } = slug
    ? await supabaseAdmin
        .from("books")
        .select("title, cover_url")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle<BookRow>()
    : { data: null };

  const title = data?.title || "LibroSeller";
  const coverUrl = data?.cover_url?.trim() || "";

  if (!coverUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#07111f",
            color: "white",
            fontSize: 34,
            fontWeight: 900,
            textAlign: "center",
            padding: "36px",
          }}
        >
          {title}
        </div>
      ),
      { width: OG_WIDTH, height: OG_HEIGHT }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: "#07111f",
        }}
      >
        <div
          style={{
            width: 194,
            height: 285,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            overflow: "hidden",
            background: "#ffffff",
            boxShadow: "0 14px 34px rgba(0,0,0,0.42)",
          }}
        >
          <img
            src={coverUrl}
            alt={`Portada completa de ${title}`}
            width={194}
            height={285}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            left: 18,
            bottom: 14,
            display: "flex",
            alignItems: "center",
            borderRadius: 999,
            background: "rgba(255,255,255,0.10)",
            color: "white",
            padding: "6px 11px",
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          LibroSeller
        </div>
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
