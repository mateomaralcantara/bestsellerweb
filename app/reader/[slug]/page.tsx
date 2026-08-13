import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getPublishedBookBySlug,
  userCanReadBook,
} from "@/lib/book-access";
import BookReaderClient from "./BookReaderClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    slug: string;
  };
};

function getLoginUrl(slug: string) {
  return `/auth?next=${encodeURIComponent(`/reader/${slug}`)}`;
}

function getCheckoutUrl(slug: string) {
  return `/catalog/${slug}?paywall=1`;
}

export default async function ReaderPage({ params }: PageProps) {
  const slug = decodeURIComponent(params.slug || "").trim();

  if (!slug) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(getLoginUrl(slug));
  }

  const book = await getPublishedBookBySlug(slug);

  if (!book) {
    notFound();
  }

  const canRead = await userCanReadBook({
    user: {
      id: user.id,
      email: user.email,
    },
    book,
  });

  if (!canRead) {
    redirect(getCheckoutUrl(book.slug));
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto mb-4 flex max-w-6xl items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
            Libro adquirido
          </p>

          <h1 className="mt-1 truncate text-2xl font-bold text-slate-950">
            {book.title}
          </h1>
        </div>

        <Link
          href="/dashboard"
          className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Volver al dashboard
        </Link>
      </div>

      <BookReaderClient
        title={book.title}
        coverUrl={book.cover_url}
        pdfUrl={`/api/books/${encodeURIComponent(book.slug)}/read`}
      />
    </main>
  );
}