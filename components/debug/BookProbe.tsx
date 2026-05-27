"use client";

import { useEffect, useState } from "react";

type ProbeResult = {
  slug: string;
  title: string;
  coverUrl: string | null;
  pageUrl: string;
  usingNextImageGuess: boolean;
  head?: {
    ok: boolean;
    status: number;
    contentType: string | null;
    contentLength: string | null;
  };
  image?: {
    loaded: boolean;
    naturalWidth: number;
    naturalHeight: number;
    currentSrc: string;
  };
  errors: string[];
};

export default function BookProbe({
  slug,
  title,
  coverUrl,
}: {
  slug: string;
  title: string;
  coverUrl: string | null;
}) {
  const [result, setResult] = useState<ProbeResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function runProbe() {
      const nextResult: ProbeResult = {
        slug,
        title,
        coverUrl,
        pageUrl: window.location.href,
        usingNextImageGuess: !!document.querySelector('img[src*="_next/image"]'),
        errors: [],
      };

      if (!coverUrl) {
        nextResult.errors.push("El libro no tiene coverUrl.");
        if (!cancelled) setResult(nextResult);
        console.log("BOOK PROBE", nextResult);
        return;
      }

      try {
        const res = await fetch(coverUrl, {
          method: "HEAD",
          cache: "no-store",
        });

        nextResult.head = {
          ok: res.ok,
          status: res.status,
          contentType: res.headers.get("content-type"),
          contentLength: res.headers.get("content-length"),
        };
      } catch (error) {
        nextResult.errors.push(
          `HEAD falló: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      try {
        const imageInfo = await new Promise<ProbeResult["image"]>((resolve, reject) => {
          const img = new window.Image();

          img.onload = () => {
            resolve({
              loaded: true,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              currentSrc: img.currentSrc,
            });
          };

          img.onerror = () => {
            reject(new Error("El navegador disparó onerror al cargar la imagen."));
          };

          const separator = coverUrl.includes("?") ? "&" : "?";
          img.src = `${coverUrl}${separator}probe=${Date.now()}`;
        });

        nextResult.image = imageInfo;
      } catch (error) {
        nextResult.errors.push(
          `Image load falló: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      if (!cancelled) {
        setResult(nextResult);
      }

      console.log("BOOK PROBE", nextResult);
    }

    runProbe();

    return () => {
      cancelled = true;
    };
  }, [slug, title, coverUrl]);

  return (
    <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="font-semibold text-amber-900">BookProbe</p>

      <p className="mt-1 text-sm text-amber-900">
        Revisa este bloque y también la consola con <code>BOOK PROBE</code>.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {coverUrl ? (
          <a
            href={coverUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-black px-3 py-2 text-sm text-white"
          >
            Abrir portada directa
          </a>
        ) : null}

        <button
          type="button"
          onClick={() => console.log("BOOK PROBE STATE", result)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          Log otra vez
        </button>
      </div>

      <pre className="mt-4 overflow-x-auto rounded-xl bg-white p-4 text-xs">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}