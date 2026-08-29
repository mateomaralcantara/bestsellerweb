"use client";

import { useEffect } from "react";

const STYLE_ID = "libroseller-editorial-heading-center";

const HEADING_CSS = `
/*
 * Regla editorial LibroSeller:
 * los capítulos y títulos principales deben permanecer centrados aunque
 * el EPUB use clases editoriales en vez de etiquetas h1-h6.
 * No se altera tipografía, tamaño, peso, color ni contenido del libro.
 */
h1,
h2,
h3,
h4,
h5,
h6,
[role="heading"],
.title,
.book-title,
.book_title,
.bookTitle,
.main-title,
.main_title,
.mainTitle,
.chapter-title,
.chapter_title,
.chapterTitle,
.chapter-heading,
.chapter_heading,
.chapterHeading,
.titulo,
.titulo-principal,
.titulo_principal,
.titulo-capitulo,
.titulo_capitulo,
.capitulo-titulo,
.capitulo_titulo,
[epub\\:type~="title"],
[epub\\:type~="subtitle"],
[epub\\:type~="chapter"] > header,
[epub\\:type~="chapter"] > h1,
[epub\\:type~="chapter"] > h2,
[epub\\:type~="chapter"] > h3,
[epub\\:type~="part"] > header,
[epub\\:type~="part"] > h1,
[epub\\:type~="part"] > h2,
[epub\\:type~="volume"] > header,
header > .title,
header > [role="heading"] {
  text-align: center !important;
  text-indent: 0 !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
`;

function injectHeadingStyle(frame: HTMLIFrameElement) {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;

    const head = doc.head ?? doc.documentElement;
    if (!head || doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = HEADING_CSS;
    head.appendChild(style);
  } catch {
    // EPUB.js usa iframes same-origin; si una fuente futura no lo permite,
    // el lector continúa funcionando sin bloquear la lectura.
  }
}

function scanReaderFrames() {
  document
    .querySelectorAll<HTMLIFrameElement>(
      '[data-libroseller-epub-reader="true"] iframe'
    )
    .forEach((frame) => {
      injectHeadingStyle(frame);
      frame.addEventListener("load", () => injectHeadingStyle(frame), {
        once: true,
      });
    });
}

export default function EpubHeadingCenter() {
  useEffect(() => {
    scanReaderFrames();

    const observer = new MutationObserver(() => scanReaderFrames());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
