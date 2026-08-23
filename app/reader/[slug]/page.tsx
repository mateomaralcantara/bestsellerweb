import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPublishedBookBySlug,
  userCanReadBook,
} from "@/lib/book-access";
import BookReaderClient from "./BookReaderClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function getLoginUrl(slug: string) {
  return `/auth?next=${encodeURIComponent(`/reader/${slug}`)}`;
}

function getCheckoutUrl(slug: string) {
  return `/catalog/${slug}?paywall=1`;
}

export default async function ReaderPage({ params }: PageProps) {
  const slug = decodeURIComponent((await params).slug || "").trim();

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
    <div className="h-[100dvh] overflow-hidden bg-[#ececea]">
      <BookReaderClient
        title={book.title}
        coverUrl={book.cover_url}
        pdfUrl={`/api/books/${encodeURIComponent(book.slug)}/read`}
        progressUrl={`/api/books/${encodeURIComponent(book.slug)}/progress`}
      />
    </div>
  );
}
