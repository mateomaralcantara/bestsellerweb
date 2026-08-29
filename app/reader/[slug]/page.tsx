import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPreferredReaderAsset,
  getPublishedBookBySlug,
  userCanReadBook,
} from "@/lib/book-access";
import BookReaderClient from "./BookReaderClient";
import EpubReaderClient from "./EpubReaderClient";
import EpubAnnotationsLayer from "./EpubAnnotationsLayer";

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

  const readerAsset = await getPreferredReaderAsset(book.id);

  if (!readerAsset) {
    notFound();
  }

  const encodedSlug = encodeURIComponent(book.slug);
  const progressUrl = `/api/books/${encodedSlug}/progress`;
  const annotationsUrl = `/api/books/${encodedSlug}/annotations`;

  if (readerAsset.readerFormat === "epub") {
    const progressKey = `full:${book.slug}:epub`;

    return (
      <div className="h-[100dvh] overflow-hidden bg-[#071018]">
        <EpubReaderClient
          title={book.title}
          epubUrl={`/api/books/${encodedSlug}/epub?mode=full`}
          progressUrl={progressUrl}
          progressKey={progressKey}
          exitUrl="/dashboard/books/purchased"
          exitLabel="Volver a mi biblioteca"
          mode="full"
        />
        <EpubAnnotationsLayer
          progressKey={progressKey}
          annotationsUrl={annotationsUrl}
        />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#ececea]">
      <BookReaderClient
        title={book.title}
        coverUrl={book.cover_url}
        pdfUrl={`/api/books/${encodedSlug}/read`}
        progressUrl={progressUrl}
        progressKey={`full:${book.slug}:pdf`}
      />
    </div>
  );
}
