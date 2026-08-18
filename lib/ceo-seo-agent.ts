import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

const SANTO_DOMINGO_TIME_ZONE = "America/Santo_Domingo";
const ACTIVE_PURCHASE_STATUSES = [
  "paid",
  "completed",
  "approved",
  "succeeded",
];
const SYNTHETIC_DISCLAIMER =
  "Grupo de enfoque sintético para planificación interna. No es una reseña ni un testimonio real y no debe publicarse como tal.";
const MAX_OPENAI_FILE_BYTES = 45 * 1024 * 1024;

type JsonRecord = Record<string, unknown>;

type BookRecord = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description_short: string | null;
  description_long: string | null;
  introduction: string | null;
  chapter_one_excerpt: string | null;
  primary_niche: string | null;
  primary_category: string | null;
  secondary_category: string | null;
  keywords: string[] | null;
  target_audience: string | null;
  reader_promise: string | null;
  sales_hook: string | null;
  marketing_angle: string | null;
  language_code: string | null;
  metadata: JsonRecord | null;
  created_at: string | null;
  updated_at: string | null;
};

type PurchaseRecord = {
  book_id: string;
  status: string;
  paid_at: string | null;
  created_at: string | null;
};

type ReadingProgressRecord = {
  user_id: string;
  book_id: string;
  progress_percent: number | null;
  last_opened_at: string | null;
  updated_at: string | null;
};

type InterestEventRecord = {
  book_id: string;
  event_type: string;
  event_date: string;
  created_at: string;
};

type BookAssetRecord = {
  asset_type: string;
  storage_bucket: string | null;
  storage_path: string | null;
  file_url: string | null;
  mime_type: string | null;
  is_public: boolean | null;
};

type DailyReportRecord = {
  id: string;
  report_date: string;
  status: "completed" | "demo" | "failed";
  source_mode: string;
  model: string | null;
  focus_book_id: string | null;
  summary: string;
  analysis: unknown;
  growth_snapshot: unknown;
  error_message: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
};

export type BookGrowthMetric = {
  bookId: string;
  title: string;
  views7Days: number;
  previewOpens7Days: number;
  addToCart7Days: number;
  checkoutStarts7Days: number;
  purchases7Days: number;
  activeReaders7Days: number;
  score: number;
};

export type GrowthSnapshot = {
  reportDate: string;
  publishedBooks: number;
  totalActivePurchases: number;
  purchasesToday: number;
  purchasesLast7Days: number;
  purchasesPrevious7Days: number;
  purchaseGrowthPercent: number;
  catalogViewsToday: number;
  catalogViewsYesterday: number;
  viewGrowthPercent: number;
  previewOpensToday: number;
  addToCartToday: number;
  checkoutStartsToday: number;
  activeReadersToday: number;
  activeReadersLast7Days: number;
  conversionPercentToday: number;
  topBooks: BookGrowthMetric[];
};

export type InterestInsight = {
  label: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
  recommendedAction: string;
};

export type SyntheticFocusGroupItem = {
  persona: string;
  email: string;
  rating: number;
  comment: string;
  disclaimer: string;
};

export type SocialPostSuggestion = {
  platform: "facebook" | "instagram" | "instagram_story" | "instagram_reel";
  publishTime: string;
  objective: string;
  caption: string;
  visualBrief: string;
  hashtags: string[];
  callToAction: string;
};

export type CeoSeoAnalysis = {
  executiveSummary: string;
  focusBook: {
    id: string;
    title: string;
    analysisMode: string;
    contentTakeaways: string[];
    audienceOpportunities: string[];
  };
  interestInsights: InterestInsight[];
  syntheticFocusGroup: SyntheticFocusGroupItem[];
  socialPlan: SocialPostSuggestion[];
  dailyPriorities: string[];
  risks: string[];
};

export type CeoSeoDailyReport = {
  id: string;
  reportDate: string;
  status: "completed" | "demo" | "failed";
  sourceMode: string;
  model: string | null;
  focusBookId: string | null;
  summary: string;
  analysis: CeoSeoAnalysis;
  growthSnapshot: GrowthSnapshot;
  errorMessage: string | null;
  generatedAt: string;
};

type DateBoundaries = {
  reportDate: string;
  dayStart: number;
  dayEnd: number;
  yesterdayStart: number;
  last7Start: number;
  previous7Start: number;
};

type AgentContext = {
  books: BookRecord[];
  purchases: PurchaseRecord[];
  progress: ReadingProgressRecord[];
  events: InterestEventRecord[];
  growth: GrowthSnapshot;
  focusBook: BookRecord | null;
};

type FullBookInput = {
  url: string | null;
  analysisMode: "pdf_complete" | "metadata_excerpt";
  note: string;
};

export type CeoSeoAgentConfiguration = {
  aiConfigured: boolean;
  cronConfigured: boolean;
  fullPdfEnabled: boolean;
  model: string;
};

function isObject(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;

  const values = value
    .map((item) => cleanString(item))
    .filter(Boolean)
    .slice(0, 12);

  return values.length > 0 ? values : fallback;
}

function clampNumber(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function getSantoDomingoDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SANTO_DOMINGO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getDateBoundaries(date = new Date()): DateBoundaries {
  const reportDate = getSantoDomingoDate(date);
  const dayStart = new Date(`${reportDate}T00:00:00-04:00`).getTime();
  const day = 24 * 60 * 60 * 1000;

  return {
    reportDate,
    dayStart,
    dayEnd: dayStart + day,
    yesterdayStart: dayStart - day,
    last7Start: dayStart - 6 * day,
    previous7Start: dayStart - 13 * day,
  };
}

function timestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isInRange(value: string | null, start: number, end: number) {
  const time = timestamp(value);
  return time >= start && time < end;
}

function growthPercent(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function buildGrowthSnapshot(params: {
  books: BookRecord[];
  purchases: PurchaseRecord[];
  progress: ReadingProgressRecord[];
  events: InterestEventRecord[];
  boundaries: DateBoundaries;
}): GrowthSnapshot {
  const { books, purchases, progress, events, boundaries } = params;
  const bookTitles = new Map(books.map((book) => [book.id, book.title]));
  const metrics = new Map<string, BookGrowthMetric>();

  for (const book of books) {
    metrics.set(book.id, {
      bookId: book.id,
      title: book.title,
      views7Days: 0,
      previewOpens7Days: 0,
      addToCart7Days: 0,
      checkoutStarts7Days: 0,
      purchases7Days: 0,
      activeReaders7Days: 0,
      score: 0,
    });
  }

  const purchasesToday = purchases.filter((purchase) =>
    isInRange(
      purchase.paid_at || purchase.created_at,
      boundaries.dayStart,
      boundaries.dayEnd
    )
  ).length;
  const purchasesLast7Days = purchases.filter((purchase) =>
    isInRange(
      purchase.paid_at || purchase.created_at,
      boundaries.last7Start,
      boundaries.dayEnd
    )
  ).length;
  const purchasesPrevious7Days = purchases.filter((purchase) =>
    isInRange(
      purchase.paid_at || purchase.created_at,
      boundaries.previous7Start,
      boundaries.last7Start
    )
  ).length;

  for (const purchase of purchases) {
    if (
      isInRange(
        purchase.paid_at || purchase.created_at,
        boundaries.last7Start,
        boundaries.dayEnd
      )
    ) {
      const metric = metrics.get(purchase.book_id);
      if (metric) metric.purchases7Days += 1;
    }
  }

  const catalogViewsToday = events.filter(
    (event) =>
      event.event_type === "book_view" &&
      isInRange(event.created_at, boundaries.dayStart, boundaries.dayEnd)
  ).length;
  const catalogViewsYesterday = events.filter(
    (event) =>
      event.event_type === "book_view" &&
      isInRange(
        event.created_at,
        boundaries.yesterdayStart,
        boundaries.dayStart
      )
  ).length;
  const previewOpensToday = events.filter(
    (event) =>
      event.event_type === "preview_open" &&
      isInRange(event.created_at, boundaries.dayStart, boundaries.dayEnd)
  ).length;
  const addToCartToday = events.filter(
    (event) =>
      event.event_type === "add_to_cart" &&
      isInRange(event.created_at, boundaries.dayStart, boundaries.dayEnd)
  ).length;
  const checkoutStartsToday = events.filter(
    (event) =>
      event.event_type === "checkout_start" &&
      isInRange(event.created_at, boundaries.dayStart, boundaries.dayEnd)
  ).length;

  for (const event of events) {
    if (
      !isInRange(
        event.created_at,
        boundaries.last7Start,
        boundaries.dayEnd
      )
    ) {
      continue;
    }

    const metric = metrics.get(event.book_id);
    if (!metric) continue;

    if (event.event_type === "book_view") metric.views7Days += 1;
    if (event.event_type === "preview_open") metric.previewOpens7Days += 1;
    if (event.event_type === "add_to_cart") metric.addToCart7Days += 1;
    if (event.event_type === "checkout_start") metric.checkoutStarts7Days += 1;
  }

  const activeTodayUserIds = new Set<string>();
  const active7DaysUserIds = new Set<string>();

  for (const item of progress) {
    const openedAt = item.last_opened_at || item.updated_at;

    if (isInRange(openedAt, boundaries.dayStart, boundaries.dayEnd)) {
      activeTodayUserIds.add(item.user_id);
    }

    if (isInRange(openedAt, boundaries.last7Start, boundaries.dayEnd)) {
      active7DaysUserIds.add(item.user_id);
      const metric = metrics.get(item.book_id);
      if (metric) metric.activeReaders7Days += 1;
    }
  }

  for (const metric of metrics.values()) {
    metric.title = bookTitles.get(metric.bookId) || metric.title;
    metric.score =
      metric.views7Days +
      metric.previewOpens7Days * 2 +
      metric.addToCart7Days * 4 +
      metric.checkoutStarts7Days * 6 +
      metric.purchases7Days * 12 +
      metric.activeReaders7Days * 3;
  }

  const topBooks = [...metrics.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  return {
    reportDate: boundaries.reportDate,
    publishedBooks: books.length,
    totalActivePurchases: purchases.length,
    purchasesToday,
    purchasesLast7Days,
    purchasesPrevious7Days,
    purchaseGrowthPercent: growthPercent(
      purchasesLast7Days,
      purchasesPrevious7Days
    ),
    catalogViewsToday,
    catalogViewsYesterday,
    viewGrowthPercent: growthPercent(
      catalogViewsToday,
      catalogViewsYesterday
    ),
    previewOpensToday,
    addToCartToday,
    checkoutStartsToday,
    activeReadersToday: activeTodayUserIds.size,
    activeReadersLast7Days: active7DaysUserIds.size,
    conversionPercentToday:
      catalogViewsToday > 0
        ? Number(((purchasesToday / catalogViewsToday) * 100).toFixed(1))
        : 0,
    topBooks,
  };
}

function pickFocusBook(
  books: BookRecord[],
  growth: GrowthSnapshot
): BookRecord | null {
  if (books.length === 0) return null;

  const dayNumber = Math.floor(
    new Date(`${growth.reportDate}T00:00:00Z`).getTime() / 86_400_000
  );

  const rotation = [...books].sort((left, right) =>
    left.id.localeCompare(right.id)
  );

  return rotation[Math.abs(dayNumber) % rotation.length];
}

async function loadAgentContext(date = new Date()): Promise<AgentContext> {
  const boundaries = getDateBoundaries(date);
  const eventsSince = new Date(boundaries.previous7Start).toISOString();

  const [booksResult, purchasesResult, progressResult, eventsResult] =
    await Promise.all([
      supabaseAdmin
        .from("books")
        .select(
          "id, title, slug, subtitle, description_short, description_long, introduction, chapter_one_excerpt, primary_niche, primary_category, secondary_category, keywords, target_audience, reader_promise, sales_hook, marketing_angle, language_code, metadata, created_at, updated_at"
        )
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(100)
        .returns<BookRecord[]>(),
      supabaseAdmin
        .from("book_purchases")
        .select("book_id, status, paid_at, created_at")
        .in("status", ACTIVE_PURCHASE_STATUSES)
        .is("revoked_at", null)
        .limit(10000)
        .returns<PurchaseRecord[]>(),
      supabaseAdmin
        .from("book_reading_progress")
        .select(
          "user_id, book_id, progress_percent, last_opened_at, updated_at"
        )
        .limit(10000)
        .returns<ReadingProgressRecord[]>(),
      supabaseAdmin
        .from("book_interest_events")
        .select("book_id, event_type, event_date, created_at")
        .gte("created_at", eventsSince)
        .order("created_at", { ascending: false })
        .limit(50000)
        .returns<InterestEventRecord[]>(),
    ]);

  if (booksResult.error) {
    throw new Error(`No se pudieron cargar los libros: ${booksResult.error.message}`);
  }

  if (purchasesResult.error) {
    throw new Error(
      `No se pudieron cargar las compras: ${purchasesResult.error.message}`
    );
  }

  if (progressResult.error && progressResult.error.code !== "42P01") {
    throw new Error(
      `No se pudo cargar el progreso de lectura: ${progressResult.error.message}`
    );
  }

  if (eventsResult.error) {
    if (eventsResult.error.code === "42P01") {
      throw new Error(
        "CONFIGURACION_SUPABASE_PENDIENTE: ejecuta la migración 20260818_ceo_seo_daily_agent.sql."
      );
    }

    throw new Error(
      `No se pudieron cargar los intereses: ${eventsResult.error.message}`
    );
  }

  const books = booksResult.data ?? [];
  const purchases = purchasesResult.data ?? [];
  const progress = progressResult.data ?? [];
  const events = eventsResult.data ?? [];
  const growth = buildGrowthSnapshot({
    books,
    purchases,
    progress,
    events,
    boundaries,
  });

  return {
    books,
    purchases,
    progress,
    events,
    growth,
    focusBook: pickFocusBook(books, growth),
  };
}

async function getRemoteFileSize(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const contentLength = response.headers.get("content-length");
    if (!contentLength) return null;

    const size = Number(contentLength);
    return Number.isFinite(size) && size > 0 ? size : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getFullBookInput(book: BookRecord | null): Promise<FullBookInput> {
  if (!book) {
    return {
      url: null,
      analysisMode: "metadata_excerpt",
      note: "No hay libros publicados para analizar.",
    };
  }

  if (process.env.CEO_SEO_ANALYZE_FULL_PDF?.trim() === "false") {
    return {
      url: null,
      analysisMode: "metadata_excerpt",
      note: "El análisis del PDF completo está desactivado por configuración.",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("book_assets")
    .select(
      "asset_type, storage_bucket, storage_path, file_url, mime_type, is_public"
    )
    .eq("book_id", book.id)
    .order("sort_order", { ascending: true })
    .returns<BookAssetRecord[]>();

  if (error) {
    return {
      url: null,
      analysisMode: "metadata_excerpt",
      note: `No se pudo localizar el PDF: ${error.message}`,
    };
  }

  const asset = (data ?? []).find((item) => {
    const type = item.asset_type.toLowerCase();
    const mime = item.mime_type?.toLowerCase() || "";
    return mime === "application/pdf" || type === "pdf" || type.includes("manuscript");
  });

  if (!asset) {
    return {
      url: null,
      analysisMode: "metadata_excerpt",
      note: "El libro no tiene un PDF completo disponible.",
    };
  }

  let fileUrl = cleanString(asset.file_url);

  if (asset.storage_bucket && asset.storage_path) {
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(asset.storage_bucket)
      .createSignedUrl(asset.storage_path, 15 * 60);

    if (!signedError && signed?.signedUrl) {
      fileUrl = signed.signedUrl;
    }
  }

  if (!/^https:\/\//i.test(fileUrl)) {
    return {
      url: null,
      analysisMode: "metadata_excerpt",
      note: "No fue posible crear una URL temporal segura para el PDF.",
    };
  }

  const fileSize = await getRemoteFileSize(fileUrl);

  if (fileSize === null) {
    return {
      url: null,
      analysisMode: "metadata_excerpt",
      note: "No se pudo verificar el tamaño del PDF; se evitó enviarlo al modelo.",
    };
  }

  if (fileSize > MAX_OPENAI_FILE_BYTES) {
    return {
      url: null,
      analysisMode: "metadata_excerpt",
      note: "El PDF supera el límite seguro de 45 MB; se usaron metadatos y extractos.",
    };
  }

  return {
    url: fileUrl,
    analysisMode: "pdf_complete",
    note: `PDF completo analizado (${(fileSize / 1024 / 1024).toFixed(1)} MB).`,
  };
}

function buildBookContext(book: BookRecord, growth: GrowthSnapshot) {
  const metric = growth.topBooks.find((item) => item.bookId === book.id);

  function excerpt(value: string | null, limit: number) {
    const text = cleanString(value);
    return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
  }

  return {
    id: book.id,
    title: book.title,
    subtitle: excerpt(book.subtitle, 300),
    descriptionShort: excerpt(book.description_short, 600),
    descriptionLong: excerpt(book.description_long, 2000),
    introduction: excerpt(book.introduction, 2000),
    chapterOneExcerpt: excerpt(book.chapter_one_excerpt, 2500),
    niche: book.primary_niche,
    primaryCategory: book.primary_category,
    secondaryCategory: book.secondary_category,
    keywords: (book.keywords ?? []).slice(0, 15),
    targetAudience: excerpt(book.target_audience, 800),
    readerPromise: excerpt(book.reader_promise, 800),
    salesHook: excerpt(book.sales_hook, 800),
    marketingAngle: excerpt(book.marketing_angle, 800),
    signalsLast7Days: metric ?? null,
  };
}

function buildFallbackAnalysis(
  context: AgentContext,
  fullBook: FullBookInput,
  reason: string
): CeoSeoAnalysis {
  const focus = context.focusBook;
  const focusTitle = focus?.title || "Catálogo BestSeller";
  const top = context.growth.topBooks[0];
  const strongestInterest = top?.score
    ? `${top.title} lidera las señales de interés con ${top.views7Days} vistas y ${top.purchases7Days} compras en siete días.`
    : "Todavía no hay suficientes señales de comportamiento para declarar un interés dominante.";
  const category =
    focus?.primary_category || focus?.primary_niche || "lectura y desarrollo personal";

  return {
    executiveSummary: `${strongestInterest} El plan de hoy prioriza ${focusTitle}, medición del embudo y contenido social reutilizable.`,
    focusBook: {
      id: focus?.id || "",
      title: focusTitle,
      analysisMode: fullBook.analysisMode,
      contentTakeaways: [
        cleanString(focus?.reader_promise, `Promesa central: acercar al lector a ${category}.`),
        cleanString(focus?.sales_hook, `Ángulo comercial: convertir el tema de ${category} en una transformación concreta.`),
        cleanString(
          focus?.description_short,
          "Usar una idea concreta del libro para despertar curiosidad sin revelar todo el contenido."
        ),
      ],
      audienceOpportunities: [
        cleanString(focus?.target_audience, `Personas interesadas en ${category}.`),
        "Lectores que abrieron la ficha o la muestra, pero todavía no iniciaron el pago.",
        "Compradores activos que pueden recomendar el libro de forma auténtica.",
      ],
    },
    interestInsights: [
      {
        label: "Libro con mayor tracción",
        evidence: strongestInterest,
        confidence: top?.score ? "high" : "low",
        recommendedAction: top?.score
          ? `Crear hoy una pieza centrada en ${top.title}.`
          : "Acumular al menos siete días de visitas, muestras, carrito y compras.",
      },
      {
        label: "Intención de compra",
        evidence: `${context.growth.addToCartToday} agregados al carrito y ${context.growth.checkoutStartsToday} inicios de checkout hoy.`,
        confidence:
          context.growth.addToCartToday + context.growth.checkoutStartsToday > 0
            ? "medium"
            : "low",
        recommendedAction:
          "Comparar vistas, carrito y checkout para localizar el paso con mayor abandono.",
      },
      {
        label: "Interés de lectura",
        evidence: `${context.growth.activeReadersLast7Days} lectores activos durante los últimos siete días.`,
        confidence:
          context.growth.activeReadersLast7Days > 0 ? "high" : "low",
        recommendedAction:
          "Promover fragmentos relacionados con los libros que mantienen lectores activos.",
      },
    ],
    syntheticFocusGroup: [
      {
        persona: "Lector orientado a resultados",
        email: "lector.demo+01@libroseller.invalid",
        rating: 4.7,
        comment: `La promesa de ${focusTitle} se siente clara; me animaría a comprar si veo un resultado concreto que pueda aplicar esta semana.`,
        disclaimer: SYNTHETIC_DISCLAIMER,
      },
      {
        persona: "Lector curioso",
        email: "lector.demo+02@libroseller.invalid",
        rating: 4.6,
        comment: "El tema despierta curiosidad. Una frase potente del primer capítulo ayudaría a entender mejor el tono del autor.",
        disclaimer: SYNTHETIC_DISCLAIMER,
      },
      {
        persona: "Comprador digital",
        email: "lector.demo+03@libroseller.invalid",
        rating: 4.5,
        comment: "La lectura protegida y la posibilidad de continuar donde terminé aumentan mi confianza en la compra.",
        disclaimer: SYNTHETIC_DISCLAIMER,
      },
      {
        persona: "Seguidor de contenido social",
        email: "lector.demo+04@libroseller.invalid",
        rating: 4.6,
        comment: "Un video corto con una pregunta incómoda del libro sería una buena razón para visitar la ficha completa.",
        disclaimer: SYNTHETIC_DISCLAIMER,
      },
      {
        persona: "Lector comparador",
        email: "lector.demo+05@libroseller.invalid",
        rating: 4.6,
        comment: "Me ayudaría ver con claridad para quién es el libro, qué problema aborda y qué obtendré al terminarlo.",
        disclaimer: SYNTHETIC_DISCLAIMER,
      },
    ],
    socialPlan: [
      {
        platform: "facebook",
        publishTime: "09:30",
        objective: "Conversación y visitas al catálogo",
        caption: `¿Qué cambiaría en tu vida si comprendieras mejor ${category}? Hoy abrimos una idea de “${focusTitle}” para conversar, no para darte una respuesta prefabricada.`,
        visualBrief: "Portada del libro, una pregunta grande y fondo limpio con contraste alto.",
        hashtags: ["#LibroSeller", "#Lectura", "#Libros", "#AutoresLatinos"],
        callToAction: "Lee la muestra y cuéntanos qué idea te gustaría explorar.",
      },
      {
        platform: "instagram",
        publishTime: "13:00",
        objective: "Descubrimiento del libro",
        caption: `Tres razones para abrir “${focusTitle}”: una pregunta que te confronta, una idea que puedes aplicar y una lectura que continúa donde la dejaste.`,
        visualBrief: "Carrusel de 4 láminas: portada, problema, promesa y llamada a leer la muestra.",
        hashtags: ["#Bookstagram", "#LibroDelDía", "#Lectores", "#LibroSeller"],
        callToAction: "Guarda el carrusel y visita la ficha del libro.",
      },
      {
        platform: "instagram_story",
        publishTime: "17:30",
        objective: "Detectar preferencias",
        caption: `Encuesta: ¿qué te atrae más de ${focusTitle}: la transformación, el tema o la voz del autor?`,
        visualBrief: "Historia vertical con portada y encuesta de tres opciones.",
        hashtags: ["#ComunidadLectora"],
        callToAction: "Responde la encuesta; la respuesta alimentará el plan de mañana.",
      },
      {
        platform: "instagram_reel",
        publishTime: "20:00",
        objective: "Alcance y retención",
        caption: `Una idea de “${focusTitle}” en menos de 20 segundos: abre con el problema, presenta una tensión y termina invitando a leer la muestra.`,
        visualBrief: "Video de 15 a 20 segundos, subtítulos grandes, portada al final y música discreta.",
        hashtags: ["#ReelsDeLibros", "#LeerTransforma", "#LibroSeller"],
        callToAction: "Escribe LIBRO y visita el enlace de la biografía.",
      },
    ],
    dailyPriorities: [
      `Revisar y aprobar una publicación para ${focusTitle}.`,
      "Comparar vistas, muestras, carrito y checkout al final del día.",
      "Registrar una hipótesis clara para el contenido de mañana.",
    ],
    risks: [
      `${reason} El reporte actual funciona como demostración estructurada.`,
      fullBook.note,
      "Los comentarios y correos del grupo sintético no representan personas reales y no deben publicarse como testimonios.",
    ],
  };
}

const REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary",
    "focusBook",
    "interestInsights",
    "syntheticFocusGroup",
    "socialPlan",
    "dailyPriorities",
    "risks",
  ],
  properties: {
    executiveSummary: { type: "string" },
    focusBook: {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "title",
        "analysisMode",
        "contentTakeaways",
        "audienceOpportunities",
      ],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        analysisMode: { type: "string" },
        contentTakeaways: {
          type: "array",
          items: { type: "string" },
        },
        audienceOpportunities: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    interestInsights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "evidence", "confidence", "recommendedAction"],
        properties: {
          label: { type: "string" },
          evidence: { type: "string" },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          recommendedAction: { type: "string" },
        },
      },
    },
    syntheticFocusGroup: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["persona", "email", "rating", "comment", "disclaimer"],
        properties: {
          persona: { type: "string" },
          email: { type: "string" },
          rating: { type: "number", minimum: 1, maximum: 5 },
          comment: { type: "string" },
          disclaimer: { type: "string" },
        },
      },
    },
    socialPlan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "platform",
          "publishTime",
          "objective",
          "caption",
          "visualBrief",
          "hashtags",
          "callToAction",
        ],
        properties: {
          platform: {
            type: "string",
            enum: [
              "facebook",
              "instagram",
              "instagram_story",
              "instagram_reel",
            ],
          },
          publishTime: { type: "string" },
          objective: { type: "string" },
          caption: { type: "string" },
          visualBrief: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          callToAction: { type: "string" },
        },
      },
    },
    dailyPriorities: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
  },
} as const;

const AGENT_INSTRUCTIONS = `
Eres el Agente CEO/SEO interno de LibroSeller. Escribe siempre en español claro,
comercial y responsable. Tu trabajo es analizar el contenido del libro y las
señales agregadas suministradas, detectar oportunidades, proponer borradores de
contenido y priorizar acciones. No inventes compradores, cifras, testimonios ni
resultados. Distingue evidencia observada de hipótesis.

El bloque syntheticFocusGroup es una simulación interna: usa perfiles variados,
correos terminados en @libroseller.invalid y comentarios útiles que incluyan
elogio y observaciones concretas. Nunca presentes estos comentarios como reseñas
reales. No sugieras publicarlos ni enviarlos. Las publicaciones sociales también
son borradores sujetos a aprobación humana; no afirmes que fueron publicadas.

Si se adjunta un PDF, extrae temas, tensiones, promesas y frases parafraseadas;
no reproduzcas pasajes extensos. Si solo hay metadatos, indica la limitación.
Devuelve exactamente el JSON solicitado por el esquema.
`;

function extractResponseText(response: unknown) {
  if (!isObject(response)) return "";

  const direct = cleanString(response.output_text);
  if (direct) return direct;

  if (!Array.isArray(response.output)) return "";

  for (const output of response.output) {
    if (!isObject(output) || !Array.isArray(output.content)) continue;

    for (const content of output.content) {
      if (!isObject(content)) continue;
      const text = cleanString(content.text);
      if (text) return text;
    }
  }

  return "";
}

function normalizeAnalysis(
  raw: unknown,
  fallback: CeoSeoAnalysis,
  focusBook: BookRecord | null,
  analysisMode: string
): CeoSeoAnalysis {
  if (!isObject(raw)) return fallback;

  const focusRaw = isObject(raw.focusBook) ? raw.focusBook : {};
  const interestRaw = Array.isArray(raw.interestInsights)
    ? raw.interestInsights
    : [];
  const syntheticRaw = Array.isArray(raw.syntheticFocusGroup)
    ? raw.syntheticFocusGroup
    : [];
  const socialRaw = Array.isArray(raw.socialPlan) ? raw.socialPlan : [];
  const allowedPlatforms = new Set<SocialPostSuggestion["platform"]>([
    "facebook",
    "instagram",
    "instagram_story",
    "instagram_reel",
  ]);
  const allowedConfidence = new Set<InterestInsight["confidence"]>([
    "high",
    "medium",
    "low",
  ]);

  const interestInsights = interestRaw
    .map((item): InterestInsight | null => {
      if (!isObject(item)) return null;
      const confidenceValue = cleanString(item.confidence) as InterestInsight["confidence"];

      return {
        label: cleanString(item.label, "Oportunidad detectada"),
        evidence: cleanString(item.evidence, "Evidencia insuficiente."),
        confidence: allowedConfidence.has(confidenceValue)
          ? confidenceValue
          : "low",
        recommendedAction: cleanString(
          item.recommendedAction,
          "Validar la hipótesis antes de actuar."
        ),
      };
    })
    .filter((item): item is InterestInsight => Boolean(item))
    .slice(0, 8);

  const syntheticFocusGroup = syntheticRaw
    .map((item, index): SyntheticFocusGroupItem | null => {
      if (!isObject(item)) return null;

      return {
        persona: cleanString(item.persona, `Persona sintética ${index + 1}`),
        email: `lector.demo+${String(index + 1).padStart(2, "0")}@libroseller.invalid`,
        rating: Number(clampNumber(item.rating, 1, 5).toFixed(1)),
        comment: cleanString(
          item.comment,
          "Comentario sintético pendiente de contenido."
        ),
        disclaimer: SYNTHETIC_DISCLAIMER,
      };
    })
    .filter((item): item is SyntheticFocusGroupItem => Boolean(item))
    .slice(0, 8);

  const socialPlan = socialRaw
    .map((item): SocialPostSuggestion | null => {
      if (!isObject(item)) return null;
      const platform = cleanString(item.platform) as SocialPostSuggestion["platform"];
      if (!allowedPlatforms.has(platform)) return null;

      return {
        platform,
        publishTime: cleanString(item.publishTime, "12:00"),
        objective: cleanString(item.objective, "Descubrimiento"),
        caption: cleanString(item.caption, "Borrador pendiente."),
        visualBrief: cleanString(item.visualBrief, "Usar la portada del libro."),
        hashtags: cleanStringArray(item.hashtags, ["#LibroSeller"]),
        callToAction: cleanString(
          item.callToAction,
          "Visita la ficha del libro."
        ),
      };
    })
    .filter((item): item is SocialPostSuggestion => Boolean(item))
    .slice(0, 8);

  return {
    executiveSummary: cleanString(
      raw.executiveSummary,
      fallback.executiveSummary
    ),
    focusBook: {
      id: focusBook?.id || cleanString(focusRaw.id),
      title: focusBook?.title || cleanString(focusRaw.title, "Catálogo BestSeller"),
      analysisMode,
      contentTakeaways: cleanStringArray(
        focusRaw.contentTakeaways,
        fallback.focusBook.contentTakeaways
      ),
      audienceOpportunities: cleanStringArray(
        focusRaw.audienceOpportunities,
        fallback.focusBook.audienceOpportunities
      ),
    },
    interestInsights:
      interestInsights.length > 0
        ? interestInsights
        : fallback.interestInsights,
    syntheticFocusGroup:
      syntheticFocusGroup.length > 0
        ? syntheticFocusGroup
        : fallback.syntheticFocusGroup,
    socialPlan: socialPlan.length > 0 ? socialPlan : fallback.socialPlan,
    dailyPriorities: cleanStringArray(
      raw.dailyPriorities,
      fallback.dailyPriorities
    ),
    risks: [
      ...cleanStringArray(raw.risks, fallback.risks),
      "Los borradores requieren aprobación humana antes de publicarse.",
    ].slice(0, 12),
  };
}

async function generateWithOpenAI(params: {
  context: AgentContext;
  fullBook: FullBookInput;
  fallback: CeoSeoAnalysis;
  apiKey: string;
  model: string;
}) {
  const { context, fullBook, fallback, apiKey, model } = params;
  const inputContent: JsonRecord[] = [
    {
      type: "input_text",
      text: JSON.stringify(
        {
          reportDate: context.growth.reportDate,
          focusBookId: context.focusBook?.id ?? null,
          fullBookAnalysis: {
            mode: fullBook.analysisMode,
            note: fullBook.note,
          },
          growthSnapshot: context.growth,
          publishedBooks: context.books
            .slice(0, 30)
            .map((book) => buildBookContext(book, context.growth)),
          instructions:
            "Produce el informe ejecutivo y el plan de contenido de hoy. Usa exclusivamente la evidencia suministrada.",
        },
        null,
        2
      ),
    },
  ];

  if (fullBook.url) {
    inputContent.push({
      type: "input_file",
      file_url: fullBook.url,
      detail: "low",
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: AGENT_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: inputContent,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ceo_seo_daily_report",
          strict: true,
          schema: REPORT_JSON_SCHEMA,
        },
      },
      max_output_tokens: 6000,
      store: false,
    }),
    cache: "no-store",
  });

  const responseBody = (await response.json()) as unknown;

  if (!response.ok) {
    const message = isObject(responseBody)
      ? cleanString(
          isObject(responseBody.error) ? responseBody.error.message : "",
          `OpenAI respondió con estado ${response.status}.`
        )
      : `OpenAI respondió con estado ${response.status}.`;
    throw new Error(message);
  }

  const outputText = extractResponseText(responseBody);

  if (!outputText) {
    throw new Error("OpenAI no devolvió el reporte estructurado.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("El reporte de OpenAI no contenía JSON válido.");
  }

  return normalizeAnalysis(
    parsed,
    fallback,
    context.focusBook,
    fullBook.analysisMode
  );
}

function mapReport(record: DailyReportRecord): CeoSeoDailyReport {
  return {
    id: record.id,
    reportDate: record.report_date,
    status: record.status,
    sourceMode: record.source_mode,
    model: record.model,
    focusBookId: record.focus_book_id,
    summary: record.summary,
    analysis: record.analysis as CeoSeoAnalysis,
    growthSnapshot: record.growth_snapshot as GrowthSnapshot,
    errorMessage: record.error_message,
    generatedAt: record.generated_at,
  };
}

export function getCeoSeoAgentConfiguration(): CeoSeoAgentConfiguration {
  return {
    aiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    cronConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    fullPdfEnabled:
      process.env.CEO_SEO_ANALYZE_FULL_PDF?.trim() !== "false",
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
  };
}

export function isCeoSeoSetupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("CONFIGURACION_SUPABASE_PENDIENTE") ||
    message.includes("ceo_seo_daily_reports") ||
    message.includes("book_interest_events")
  );
}

export async function getCeoSeoDailyReports(limit = 14) {
  const { data, error } = await supabaseAdmin
    .from("ceo_seo_daily_reports")
    .select(
      "id, report_date, status, source_mode, model, focus_book_id, summary, analysis, growth_snapshot, error_message, generated_at, created_at, updated_at"
    )
    .order("report_date", { ascending: false })
    .limit(Math.min(60, Math.max(1, limit)))
    .returns<DailyReportRecord[]>();

  if (error) {
    if (error.code === "42P01") {
      throw new Error(
        "CONFIGURACION_SUPABASE_PENDIENTE: ejecuta la migración 20260818_ceo_seo_daily_agent.sql."
      );
    }

    throw new Error(`No se pudieron cargar los reportes: ${error.message}`);
  }

  return (data ?? []).map(mapReport);
}

export async function runDailyCeoSeoAgent(options?: {
  force?: boolean;
  date?: Date;
}): Promise<CeoSeoDailyReport> {
  const date = options?.date ?? new Date();
  const reportDate = getSantoDomingoDate(date);

  if (!options?.force) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("ceo_seo_daily_reports")
      .select(
        "id, report_date, status, source_mode, model, focus_book_id, summary, analysis, growth_snapshot, error_message, generated_at, created_at, updated_at"
      )
      .eq("report_date", reportDate)
      .maybeSingle<DailyReportRecord>();

    if (existingError) {
      if (existingError.code === "42P01") {
        throw new Error(
          "CONFIGURACION_SUPABASE_PENDIENTE: ejecuta la migración 20260818_ceo_seo_daily_agent.sql."
        );
      }

      throw new Error(
        `No se pudo comprobar el reporte de hoy: ${existingError.message}`
      );
    }

    if (existing) return mapReport(existing);
  }

  const configuration = getCeoSeoAgentConfiguration();
  const context = await loadAgentContext(date);
  const fullBook = await getFullBookInput(context.focusBook);
  const fallback = buildFallbackAnalysis(
    context,
    fullBook,
    configuration.aiConfigured
      ? "El modelo no pudo completar el análisis y se activó el respaldo local."
      : "OPENAI_API_KEY todavía no está configurada."
  );

  let analysis = fallback;
  let status: DailyReportRecord["status"] = "demo";
  let sourceMode = "demo";
  let errorMessage: string | null = null;

  if (configuration.aiConfigured) {
    try {
      analysis = await generateWithOpenAI({
        context,
        fullBook,
        fallback,
        apiKey: process.env.OPENAI_API_KEY!.trim(),
        model: configuration.model,
      });
      status = "completed";
      sourceMode =
        fullBook.analysisMode === "pdf_complete" ? "ai_pdf" : "ai_metadata";
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Error desconocido de OpenAI.";
      sourceMode = "demo_fallback";
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("ceo_seo_daily_reports")
    .upsert(
      {
        report_date: reportDate,
        status,
        source_mode: sourceMode,
        model: configuration.aiConfigured ? configuration.model : null,
        focus_book_id: context.focusBook?.id ?? null,
        summary: analysis.executiveSummary,
        analysis,
        growth_snapshot: context.growth,
        error_message: errorMessage,
        generated_at: now,
        updated_at: now,
      },
      {
        onConflict: "report_date",
      }
    )
    .select(
      "id, report_date, status, source_mode, model, focus_book_id, summary, analysis, growth_snapshot, error_message, generated_at, created_at, updated_at"
    )
    .single<DailyReportRecord>();

  if (error || !data) {
    if (error?.code === "42P01") {
      throw new Error(
        "CONFIGURACION_SUPABASE_PENDIENTE: ejecuta la migración 20260818_ceo_seo_daily_agent.sql."
      );
    }

    throw new Error(
      `No se pudo guardar el reporte diario: ${error?.message || "sin respuesta"}`
    );
  }

  return mapReport(data);
}
