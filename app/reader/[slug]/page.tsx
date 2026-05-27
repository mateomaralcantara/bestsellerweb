import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BookReaderClient from "./BookReaderClient";

export const dynamic = "force-dynamic";

const PAID_ORDER_STATUSES = ["paid", "completed", "approved", "succeeded"];

type PageProps = {
  params: {
    slug: string;
  };
};

type BookRow = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  status: string;
  owner_user_id: string | null;
};

type OrderRow = {
  id: string;
};

type OrderItemRow = {
  id: string;
};

function getLoginUrl(slug: string) {
  return `/auth?next=${encodeURIComponent(`/reader/${slug}`)}`;
}

function getCheckoutUrl(slug: string) {
  return `/catalog/${slug}?paywall=1`;
}

async function userHasPaidBook(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  bookId: string;
  userEmail: string | null | undefined;
}) {
  const { supabase, bookId, userEmail } = params;

  if (!userEmail) return false;

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("email", userEmail)
    .in("status", PAID_ORDER_STATUSES)
    .limit(50)
    .returns<OrderRow[]>();

  if (ordersError) {
    console.error("Error verificando órdenes pagadas:", ordersError.message);
    return false;
  }

  const orderIds = (orders ?? [])
    .map((order) => order.id)
    .filter(Boolean);

  if (orderIds.length === 0) return false;

  const { data: orderItem, error: itemError } = await supabase
    .from("order_items")
    .select("id")
    .eq("book_id", bookId)
    .in("order_id", orderIds)
    .limit(1)
    .maybeSingle<OrderItemRow>();

  if (itemError) {
    console.error("Error verificando item comprado:", itemError.message);
    return false;
  }

  return Boolean(orderItem);
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

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, title, slug, cover_url, status, owner_user_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<BookRow>();

  if (bookError || !book) {
    notFound();
  }

  const isOwner = book.owner_user_id === user.id;

  const hasPaid = isOwner
    ? true
    : await userHasPaidBook({
        supabase,
        bookId: book.id,
        userEmail: user.email,
      });

  if (!hasPaid) {
    redirect(getCheckoutUrl(book.slug));
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto mb-4 flex max-w-6xl items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
            Lector
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
        pdfUrl={`/api/books/${book.slug}/read`}
      />
    </main>
  );
}