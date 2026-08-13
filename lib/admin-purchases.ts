import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const ACTIVE_PURCHASE_STATUSES = [
  "paid",
  "completed",
  "approved",
  "succeeded",
] as const;

type PurchaseRecord = {
  id: string;
  user_id: string;
  book_id: string;
  status: string;
  payment_provider: string | null;
  payment_reference: string | null;
  provider_order_id: string | null;
  amount_paid: number | null;
  currency: string | null;
  paid_at: string | null;
  created_at: string | null;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
};

type BookRecord = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
};

type PayPalOrderRecord = {
  paypal_order_id: string | null;
  payer_email: string | null;
};

export type ActivePurchaseRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  bookId: string;
  bookTitle: string;
  bookSlug: string | null;
  coverUrl: string | null;
  status: string;
  paymentProvider: string | null;
  paymentReference: string | null;
  providerOrderId: string | null;
  amountPaid: number | null;
  currency: string;
  paidAt: string | null;
};

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function loadAuthEmails(userIds: string[]) {
  const emailsByUserId = new Map<string, string>();
  const batchSize = 10;

  for (let index = 0; index < userIds.length; index += batchSize) {
    const batch = userIds.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (userId) => {
        try {
          const { data, error } = await supabaseAdmin.auth.admin.getUserById(
            userId
          );

          if (error || !data.user?.email) return null;

          return {
            userId,
            email: data.user.email.trim(),
          };
        } catch {
          return null;
        }
      })
    );

    for (const result of results) {
      if (result) emailsByUserId.set(result.userId, result.email);
    }
  }

  return emailsByUserId;
}

export async function getActivePurchaseRows(options?: {
  userId?: string;
}): Promise<ActivePurchaseRow[]> {
  let purchaseQuery = supabaseAdmin
    .from("book_purchases")
    .select(
      "id, user_id, book_id, status, payment_provider, payment_reference, provider_order_id, amount_paid, currency, paid_at, created_at"
    )
    .in("status", [...ACTIVE_PURCHASE_STATUSES])
    .is("revoked_at", null)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(5000);

  if (options?.userId) {
    purchaseQuery = purchaseQuery.eq("user_id", options.userId);
  }

  const { data: purchases, error: purchaseError } =
    await purchaseQuery.returns<PurchaseRecord[]>();

  if (purchaseError) {
    throw new Error(`No se pudieron cargar las compras: ${purchaseError.message}`);
  }

  const purchaseList = purchases ?? [];

  if (purchaseList.length === 0) {
    return [];
  }

  const userIds = unique(purchaseList.map((purchase) => purchase.user_id));
  const bookIds = unique(purchaseList.map((purchase) => purchase.book_id));
  const orderIds = unique(
    purchaseList.map((purchase) => purchase.provider_order_id)
  );

  const [profilesResult, booksResult, paypalResult, authEmailsByUserId] =
    await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds)
      .returns<ProfileRecord[]>(),

    supabaseAdmin
      .from("books")
      .select("id, title, slug, cover_url")
      .in("id", bookIds)
      .returns<BookRecord[]>(),

    orderIds.length > 0
      ? supabaseAdmin
          .from("paypal_orders")
          .select("paypal_order_id, payer_email")
          .in("paypal_order_id", orderIds)
          .returns<PayPalOrderRecord[]>()
      : Promise.resolve({ data: [] as PayPalOrderRecord[], error: null }),

    loadAuthEmails(userIds),
  ]);

  if (profilesResult.error) {
    throw new Error(
      `No se pudieron cargar los usuarios: ${profilesResult.error.message}`
    );
  }

  if (booksResult.error) {
    throw new Error(`No se pudieron cargar los libros: ${booksResult.error.message}`);
  }

  if (paypalResult.error) {
    throw new Error(
      `No se pudieron cargar las referencias PayPal: ${paypalResult.error.message}`
    );
  }

  const profilesById = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile])
  );

  const booksById = new Map(
    (booksResult.data ?? []).map((book) => [book.id, book])
  );

  const payerEmailsByOrderId = new Map(
    (paypalResult.data ?? [])
      .filter((order) => order.paypal_order_id)
      .map((order) => [order.paypal_order_id as string, order.payer_email])
  );

  return purchaseList.map((purchase) => {
    const profile = profilesById.get(purchase.user_id);
    const book = booksById.get(purchase.book_id);
    const payerEmail = purchase.provider_order_id
      ? payerEmailsByOrderId.get(purchase.provider_order_id)
      : null;
    const email =
      authEmailsByUserId.get(purchase.user_id) ||
      payerEmail?.trim() ||
      null;

    return {
      id: purchase.id,
      userId: purchase.user_id,
      userName: profile?.full_name?.trim() || email || "Usuario sin perfil",
      userEmail: email,
      bookId: purchase.book_id,
      bookTitle: book?.title?.trim() || "Libro no encontrado",
      bookSlug: book?.slug ?? null,
      coverUrl: book?.cover_url ?? null,
      status: purchase.status,
      paymentProvider: purchase.payment_provider,
      paymentReference: purchase.payment_reference,
      providerOrderId: purchase.provider_order_id,
      amountPaid:
        purchase.amount_paid === null ? null : Number(purchase.amount_paid),
      currency: purchase.currency?.trim().toUpperCase() || "USD",
      paidAt: purchase.paid_at || purchase.created_at,
    };
  });
}
