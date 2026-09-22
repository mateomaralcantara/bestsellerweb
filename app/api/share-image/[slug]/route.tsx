import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const revalidate = 86400;

const WIDTH = 1200;
const HEIGHT = 630;

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
            color: "#ffffff",
            padding: "48px",
            fontSize: 52,
            fontWeight: 900,
            textAlign: "center",
          }}
        >
          {title}
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
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
          width={WIDTH}
          height={HEIGHT}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.3,
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "rgba(7,17,31,0.48)",
          }}
        />

        <img
          src={coverUrl}
          alt={`Portada completa de ${title}`}
          width={WIDTH}
          height={HEIGHT}
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
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
