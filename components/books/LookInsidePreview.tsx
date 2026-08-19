import Link from "next/link";
import { BookOpen } from "lucide-react";

export type LookInsidePreviewPage = {
  pageIndex: number;
  sourcePageNumber: number | null;
  kind: "cover" | "pdf_page";
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
};

type LookInsidePreviewProps = {
  title: string;
  subtitle?: string | null;
  authorName: string;
  coverUrl?: string | null;
  checkoutUrl: string;
  previewUrl: string;
  pages: LookInsidePreviewPage[];
  introduction?: string | null;
  chapterOneExcerpt?: string | null;
};

const PREVIEW_PAGE_LIMIT = 25;

export function LookInsidePreview({
  title,
  previewUrl,
  pages,
}: LookInsidePreviewProps) {
  const pageCount = pages
    .filter((page) => Boolean(page.imageUrl))
    .slice(0, PREVIEW_PAGE_LIMIT).length;

  if (pageCount === 0) {
    return (
      <button
        type="button"
        disabled
        title={`La muestra de ${title} todavía se está preparando`}
        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-slate-100 px-5 py-3 font-semibold text-slate-500 opacity-75"
      >
        <BookOpen className="h-5 w-5" />
        Muestra en preparación
      </button>
    );
  }

  return (
    <Link
      href={previewUrl}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
      aria-label={`Leer una muestra de ${pageCount} páginas de ${title}`}
    >
      <BookOpen className="h-5 w-5" />
      Leer muestra de {pageCount} páginas
    </Link>
  );
}
