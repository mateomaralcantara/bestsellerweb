"use client";

import { useEffect } from "react";

const STYLE_ID = "libroseller-fixed-layout-runtime-guard";

function hasNumericViewport(doc: Document) {
  const content = doc
    .querySelector('meta[name="viewport"]')
    ?.getAttribute("content");

  if (!content) return false;

  const width = Number(
    content.match(/(?:^|[,;]\s*)width\s*=\s*([0-9.]+)/i)?.[1]
  );
  const height = Number(
    content.match(/(?:^|[,;]\s*)height\s*=\s*([0-9.]+)/i)?.[1]
  );

  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
}

function normalizeSingleImagePage(doc: Document) {
  const body = doc.body;
  if (!body || !hasNumericViewport(doc)) return;

  const images = Array.from(body.querySelectorAll("img"));
  if (images.length !== 1) return;

  const meaningfulText = (body.textContent || "").replace(/\s+/g, " ").trim();
  if (meaningfulText) return;

  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html,
      body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        max-height: none !important;
        overflow: hidden !important;
      }

      body {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  const image = images[0];
  let ancestor = image.parentElement;

  while (ancestor && ancestor !== body) {
    ancestor.style.setProperty("margin", "0", "important");
    ancestor.style.setProperty("padding", "0", "important");
    ancestor.style.setProperty("border", "0", "important");
    ancestor.style.setProperty("width", "100%", "important");
    ancestor.style.setProperty("height", "100%", "important");
    ancestor.style.setProperty("max-width", "none", "important");
    ancestor.style.setProperty("max-height", "none", "important");
    ancestor.style.setProperty("position", "static", "important");
    ancestor.style.setProperty("inset", "auto", "important");
    ancestor.style.setProperty("transform", "none", "important");
    ancestor.style.setProperty("overflow", "visible", "important");
    ancestor.style.setProperty("display", "block", "important");
    ancestor = ancestor.parentElement;
  }

  image.style.setProperty("display", "block", "important");
  image.style.setProperty("margin", "0", "important");
  image.style.setProperty("padding", "0", "important");
  image.style.setProperty("border", "0", "important");
  image.style.setProperty("width", "100%", "important");
  image.style.setProperty("height", "100%", "important");
  image.style.setProperty("max-width", "none", "important");
  image.style.setProperty("max-height", "none", "important");
  image.style.setProperty("object-fit", "contain", "important");
  image.style.setProperty("object-position", "center center", "important");

  body.dataset.librosellerFixedLayoutNormalized = "true";
}

export default function EpubFixedLayoutGuard() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      '[data-libroseller-epub-reader="true"]'
    );
    if (!root) return;

    const knownIframes = new WeakSet<HTMLIFrameElement>();
    const cleanup = new Map<HTMLIFrameElement, () => void>();

    const applyToIframe = (iframe: HTMLIFrameElement) => {
      try {
        const doc = iframe.contentDocument;
        if (!doc?.body) return;

        normalizeSingleImagePage(doc);

        const image = doc.body.querySelector<HTMLImageElement>("img");
        if (image && !image.complete) {
          image.addEventListener(
            "load",
            () => normalizeSingleImagePage(doc),
            { once: true }
          );
        }
      } catch {
        // El iframe puede estar entre navegaciones; se reintentará en load/mutación.
      }
    };

    const attachIframe = (iframe: HTMLIFrameElement) => {
      if (knownIframes.has(iframe)) {
        applyToIframe(iframe);
        return;
      }

      knownIframes.add(iframe);
      const onLoad = () => {
        window.requestAnimationFrame(() => applyToIframe(iframe));
      };

      iframe.addEventListener("load", onLoad);
      cleanup.set(iframe, () => iframe.removeEventListener("load", onLoad));
      applyToIframe(iframe);
    };

    const scan = () => {
      root.querySelectorAll<HTMLIFrameElement>("iframe").forEach(attachIframe);
    };

    scan();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(scan);
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanup.forEach((dispose) => dispose());
      cleanup.clear();
    };
  }, []);

  return null;
}
