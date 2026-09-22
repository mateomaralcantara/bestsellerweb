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
        <img
          src={coverUrl}
          alt=""
          width={OG_WIDTH}
          height={OG_HEIGHT}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.72,
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "rgba(0,0,0,0.16)",
          }}
        />

        <img
          src={coverUrl}
          alt={`Portada completa de ${title}`}
          width={OG_WIDTH}
          height={OG_HEIGHT}
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
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
