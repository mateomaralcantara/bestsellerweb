"use client";


/* Diagnostic component intentionally renders the exact raw image URL being inspected. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

type Props = {
  slug: string;
  title: string;
  coverUrl: string | null;
};

type Probe = {
  imageLoaded: boolean;
  imageError: boolean;
  naturalWidth: number;
  naturalHeight: number;
  currentSrc: string;
  headStatus: number | null;
  headContentType: string | null;
  errors: string[];
};

export default function CatalogCoverDebug({ slug, title, coverUrl }: Props) {
  const [probe, setProbe] = useState<Probe>({
    imageLoaded: false,
    imageError: false,
    naturalWidth: 0,
    naturalHeight: 0,
    currentSrc: "",
    headStatus: null,
    headContentType: null,
    errors: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!coverUrl) return;

      try {
        const res = await fetch(coverUrl, { method: "HEAD", cache: "no-store" });
        if (!cancelled) {
          setProbe((prev) => ({
            ...prev,
            headStatus: res.status,
            headContentType: res.headers.get("content-type"),
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setProbe((prev) => ({
            ...prev,
            errors: [
              ...prev.errors,
              `HEAD falló: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ],
          }));
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  if (!coverUrl) {
    return (
      <div className="rounded-2xl border p-6 text-sm">
        No hay cover_url para este libro.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <img
        src={coverUrl}
        alt={title}
        className="w-full rounded-2xl border shadow-lg"
        onLoad={(e) => {
          const img = e.currentTarget;

          console.log("CATALOG IMG LOAD OK", {
            slug,
            src: img.currentSrc,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          });

          setProbe((prev) => ({
            ...prev,
            imageLoaded: true,
            imageError: false,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            currentSrc: img.currentSrc,
          }));
        }}
        onError={(e) => {
          const img = e.currentTarget;

          console.error("CATALOG IMG LOAD ERROR", {
            slug,
            src: img.currentSrc || coverUrl,
          });

          setProbe((prev) => ({
            ...prev,
            imageLoaded: false,
            imageError: true,
            currentSrc: img.currentSrc || coverUrl,
            errors: [...prev.errors, "El navegador no pudo cargar la imagen."],
          }));
        }}
      />

      <pre className="overflow-x-auto rounded-2xl border bg-slate-50 p-4 text-xs">
        {JSON.stringify(
          {
            slug,
            title,
            coverUrl,
            probe,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}