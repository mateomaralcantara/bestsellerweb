import { supabaseAdmin } from "@/lib/supabase/admin";

export const PAID_ACCESS_STATUSES = [
  "paid",
  "completed",
  "approved",
  "succeeded",
] as const;

const READABLE_ASSET_TYPES = ["pdf", "manuscript"] as const;

export type BookAccessUser = {
  id: string;
  email?: string | null;
};

export type ReadableBook = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  status: string;
  owner_user_id: string | null;
};

export type ReadableBookAsset = {
  asset_type: string;
  storage_bucket: string | null;
  storage_path: string | null;
  file_url: string | null;
  mime_type: string | null;
  is_public: boolean | null;
  sort_order: number | null;
};

export async function getPublishedBookBySlug(
  slug: string
): Promise<ReadableBook | null> {
  const { data, error } = await supabaseAdmin
    .from("books")
    .select("id, title, slug, cover_url, status, owner_user_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(`Error cargando libro: ${error.message}`);
  }

  return (data as ReadableBook | null) ?? null;
}

export async function getReadableBookAsset(
  bookId: string
): Promise<ReadableBookAsset | null> {
  const { data, error } = await supabaseAdmin
    .from("book_assets")
    .select(
      "asset_type, storage_bucket, storage_path, file_url, mime_type, is_public, sort_order"
    )
    .eq("book_id", bookId)
    .in("asset_type", [...READABLE_ASSET_TYPES])
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error cargando archivo del libro: ${error.message}`);
  }

  return (data as ReadableBookAsset | null) ?? null;
}

export async function userHasDirectPurchase(params: {
  userId: string;
  bookId: string;
}): Promise<boolean> {
  const { userId, bookId } = params;

  const { data, error } = await supabaseAdmin
    .from("book_purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .in("status", [...PAID_ACCESS_STATUSES])
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error verificando book_purchases:", error.message);
    return false;
  }

  return Boolean(data);
}

export async function userHasPaidOrderFallback(params: {
  userEmail: string | null | undefined;
  bookId: string;
}): Promise<boolean> {
  const { userEmail, bookId } = params;

  if (!userEmail) return false;

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("email", userEmail)
    .in("status", [...PAID_ACCESS_STATUSES])
    .limit(50);

  if (ordersError) {
    console.error("Error verificando orders:", ordersError.message);
    return false;
  }

  const orderIds = (orders ?? [])
    .map((order) => String(order.id))
    .filter(Boolean);

  if (orderIds.length === 0) return false;

  const { data: item, error: itemError } = await supabaseAdmin
    .from("order_items")
    .select("id")
    .eq("book_id", bookId)
    .in("order_id", orderIds)
    .limit(1)
    .maybeSingle();

  if (itemError) {
    console.error("Error verificando order_items:", itemError.message);
    return false;
  }

  return Boolean(item);
}

export async function userCanReadBook(params: {
  user: BookAccessUser;
  book: ReadableBook;
}): Promise<boolean> {
  const { user, book } = params;

  if (book.owner_user_id === user.id) {
    return true;
  }

  const hasDirectPurchase = await userHasDirectPurchase({
    userId: user.id,
    bookId: book.id,
  });

  if (hasDirectPurchase) {
    return true;
  }

  return userHasPaidOrderFallback({
    userEmail: user.email,
    bookId: book.id,
  });
}