# Software Structure Report

Generated at: 2026-05-11T04:15:41.031Z

Root: `C:\Users\martin\Desktop\APPSS\bestsellerweb`

## Project detected

- Next.js
- React
- Prisma
- Tailwind CSS
- TypeScript

## Package scripts

- `clean`: `powershell -Command "if (Test-Path .next) { Remove-Item -Recurse -Force .next }"`
- `dev`: `next dev`
- `dev:clean`: `npm run clean && next dev`
- `build`: `next build`
- `start`: `next start`
- `verify:book-preview`: `node scripts/verify-book-preview.cjs`
- `smoke:book-upload`: `node scripts/smoke-test-book-upload.cjs`
- `test:book-preview-direct`: `node scripts/test-book-preview-direct.mjs`
- `diagnose:catalog-route`: `node scripts/diagnose-catalog-route.cjs`
- `check:parallel-routes`: `node scripts/check-parallel-routes.cjs`
- `diagnose:routing`: `node scripts/diagnose-routing.cjs`
- `audit:project`: `node scripts/audit-project.mjs`

## Main dependencies

- @prisma/client: `^7.6.0` (dependency)
- @supabase/ssr: `^0.10.0` (dependency)
- @supabase/supabase-js: `^2.101.1` (dependency)
- @types/node: `^22.7.4` (devDependency)
- @types/react: `^18.3.3` (devDependency)
- @types/react-dom: `^18.3.0` (devDependency)
- autoprefixer: `^10.4.20` (devDependency)
- clsx: `^2.1.1` (dependency)
- lucide-react: `^0.511.0` (dependency)
- next: `14.2.35` (dependency)
- pdfjs-dist: `^5.6.205` (dependency)
- postcss: `^8.4.47` (devDependency)
- prisma: `^7.6.0` (devDependency)
- react: `^18.3.1` (dependency)
- react-dom: `^18.3.1` (dependency)
- tailwind-merge: `^2.5.2` (dependency)
- tailwindcss: `^3.4.13` (devDependency)
- typescript: `^5.6.2` (devDependency)

## Routes detected

- [app-page] `/` → `app/page.tsx`
- [app-page] `/affiliates` → `app/affiliates/page.tsx`
- [app-api-route] `/api/books` → `app/api/books/route.ts`
- [app-page] `/auth` → `app/auth/page.tsx`
- [app-page] `/catalog` → `app/catalog/page.tsx`
- [app-page] `/catalog/[slug]` → `app/catalog/[slug]/page.tsx`
- [app-page] `/checkout` → `app/checkout/page.tsx`
- [app-page] `/dashboard` → `app/dashboard/page.tsx`
- [app-page] `/dashboard/books/[id]` → `app/dashboard/books/[id]/page.tsx`
- [app-page] `/dashboard/books/new` → `app/dashboard/books/new/page.tsx`
- [app-page] `/dashboard/books/published` → `app/dashboard/books/published/page.tsx`
- [app-page] `/publish` → `app/publish/page.tsx`
- [app-page] `/reader/[slug]` → `app/reader/[slug]/page.tsx`

## Public private-like assets

No PDF/EPUB/video/zip files detected inside /public.

## Environment files

### .env

- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_DEFAULT_CURRENCY
- NEXT_PUBLIC_DEFAULT_COUNTRY
- NEXT_PUBLIC_PAYMENT_PROVIDER
- PAYMENT_AZUL_STORE_ID
- PAYMENT_AZUL_AUTH1
- PAYMENT_AZUL_AUTH2
- PAYMENT_CARDNET_MERCHANT_ID
- PAYMENT_CARDNET_API_KEY
- DEV_TEST_USER_ID
- SMOKE_TEST_AUTHOR_ID
- SMOKE_TEST_BASE_URL
- SMOKE_TEST_PDF_PATH
- SMOKE_TEST_COVER_PATH

## Possible risk areas

- **MEDIUM / auth:** No detecté una librería común de autenticación. Para vender libros necesitas identificar al usuario antes de autorizar lectura.
- **MEDIUM / payments:** No detecté integración común de pagos. Puede estar custom, pero conviene revisar cómo confirmas compras.
- **HIGH / pdf-access:** Detecté señales de PDF usado directamente en el frontend. Si el pdfUrl apunta a un archivo público, el libro no está protegido.

## Recommended update direction

- El resumen debe vivir en una página pública sin entregar `pdfUrl` real.
- El lector completo debe vivir en una ruta protegida.
- El PDF completo no debe estar en `/public`.
- El endpoint que entrega el PDF debe validar usuario + compra con estado pagado.
- El frontend nunca debe decidir si alguien pagó; eso va en servidor.

## Project tree

```txt
📁 app
  📁 affiliates
    📄 page.tsx
  📁 api
    📁 books
      📄 route.ts
  📁 auth
    📄 page.tsx
  📁 catalog
    📁 [slug]
      📄 page.tsx
    📄 page.tsx
  📁 checkout
    📄 page.tsx
  📁 dashboard
    📁 books
      📁 [id]
        📄 page.tsx
      📁 new
        📄 page.tsx
      📁 published
        📄 page.tsx
    📄 layout.tsx
    📄 page.tsx
  📁 publish
    📄 page.tsx
  📁 reader
    📁 [slug]
      📄 BookReaderClient.tsx
      📄 page.tsx
  📄 globals.css
  📄 layout.tsx
  📄 not-found.tsx
  📄 page.tsx
📁 components
  📁 dashboard
    📁 books
      📁 new
        📄 page.tsx
    📄 ManuscriptUploader.tsx
    📄 PublishedBookCard.tsx
  📁 debug
    📄 BookProbe.tsx
    📄 CatalogCoverDebug.tsx
  📁 forms
    📄 affiliate-form.tsx
    📄 auth-form.tsx
    📄 checkout-form.tsx
    📄 publishform.tsx
  📄 add-to-cart-button.tsx
  📄 book-card.tsx
  📄 cart-provider.tsx
  📄 section-heading.tsx
  📄 site-footer.tsx
  📄 site-header.tsx
📁 lib
  📁 supabase
    📄 admin.ts
    📄 browser-client.ts
    📄 client.ts
    📄 config.ts
    📄 server.ts
  📄 book-preview-runner.ts
  📄 book-preview.ts
  📄 data.ts
  📄 queries.ts
  📄 supabase-browser.ts
  📄 types.ts
  📄 utils.ts
📁 scripts
  📄 audit-project.mjs
  📄 check-parallel-routes.cjs
  📄 diagnose-catalog-route.cjs
  📄 diagnose-routing.cjs
  📄 extract-book-preview.mjs
  📄 smoke-test-book-upload.cjs
  📄 test-book-preview-direct.mjs
  📄 verify-book-preview.cjs
📁 supabase
  📄 bestseller_seed_lite.sql
  📄 bestseller_supabase_schema.sql
  📄 schema.sql
  📄 seed.sql
📁 tests
  📁 fixtures
    📄 sample-book.pdf
    📄 sample-cover.jpg
📄 .env
📄 .gitignore
📄 datos.txt
📄 next-env.d.ts
📄 next.config.mjs
📄 package.json
📄 postcss.config.js
📄 prisma.config.ts
📄 README.md
📄 tailwind.config.ts
📄 tsconfig.json
```

## High-signal file contents

Archivos clave para revisar arquitectura, rutas, pagos, auth, lector, base de datos y separación resumen/libro.

### app/affiliates/page.tsx

Size: 1709 bytes  
Score: 65  
SHA256 short: e0893ede1a5573f9

```tsx
import { BadgeDollarSign, Link2, Megaphone, Trophy } from "lucide-react";
import { AffiliateForm } from "@/components/forms/affiliate-form";
import { SectionHeading } from "@/components/section-heading";
const perks = [{ icon: BadgeDollarSign, title: "Comisiones claras", text: "Define porcentaje por libro o campaña." },{ icon: Link2, title: "Links por afiliado", text: "Genera enlaces y códigos únicos." },{ icon: Megaphone, title: "Creativos listos", text: "Copies, banners, reels scripts y assets." },{ icon: Trophy, title: "Leaderboard", text: "Gamificación para vendedores con hambre." }];
export default function AffiliatesPage() { return <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="grid gap-10 lg:grid-cols-[1fr_1fr]"><div className="space-y-8"><SectionHeading eyebrow="Afiliados" title="Convierte lectores y creadores en fuerza comercial real." description="Módulo inspirado en el músculo de afiliación de plataformas de infoproductos, pero aterrizado al negocio editorial." /><div className="grid gap-4 sm:grid-cols-2">{perks.map(({ icon: Icon, title, text }, index) => <div key={title} className={index === 0 || index === 3 ? "editorial-special rounded-[28px] p-5 shadow-panel" : "editorial-panel rounded-[28px] p-5"}><div className={index === 0 || index === 3 ? "flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-100 text-accent-700" : "flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"}><Icon className="h-5 w-5" /></div><h3 className="mt-4 text-xl font-semibold text-brand-800">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-700">{text}</p></div>)}</div></div><AffiliateForm /></div></div>; }

```

### app/api/books/route.ts

Size: 13881 bytes  
Score: 145  
SHA256 short: 1c33ef04f6fa25ec

```ts
import { randomUUID } from "crypto";
import {
  extractPreviewWithWorker,
  type ExtractedBookPreview,
} from "@/lib/book-preview-runner";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const COVER_BUCKET = "book-covers";
const FILE_BUCKET = "book-files";
const SHORT_DESCRIPTION_LIMIT = 180;
const ALLOWED_BOOK_EXTENSIONS = new Set(["pdf", "epub"]);

const DEV_MODE = process.env.NODE_ENV !== "production";
const DEV_TEST_USER_ID = process.env.DEV_TEST_USER_ID?.trim() || "";

const BOOK_SELECT =
  "id, owner_user_id, author_id, title, slug, cover_url, status, description_short, description_long, introduction, chapter_one_excerpt, sample_url";

type BookAssetType = "pdf" | "epub";
type RecordId = string | number;

type RollbackState = {
  bookId: RecordId | null;
  editionId: RecordId | null;
  coverPath: string | null;
  filePath: string | null;
};

type UploadBookForm = {
  title: string;
  descriptionInput: string;
  introductionInput: string;
  chapterOneInput: string;
  sampleUrlInput: string;
  price: number;
  authorId: string;
  cover: File;
  bookFile: File;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function getBookAssetType(fileName: string): BookAssetType {
  return getExtension(fileName) === "epub" ? "epub" : "pdf";
}

function getDescriptionShort(description: string | null): string | null {
  if (!description) return null;

  const value = description.trim();
  if (!value) return null;

  return value.slice(0, SHORT_DESCRIPTION_LIMIT);
}

function isValidImageFile(file: File): boolean {
  return !file.type || file.type.startsWith("image/");
}

function isAllowedBookExtension(fileName: string): boolean {
  return ALLOWED_BOOK_EXTENSIONS.has(getExtension(fileName));
}

function parsePositivePrice(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function emptyPreview(): ExtractedBookPreview {
  return {
    argument: null,
    introduction: null,
    chapterOne: null,
    source: "unsupported",
  };
}

function readTextField(formData: FormData, key: string): string {
  return formData.get(key)?.toString().trim() || "";
}

function requireFileField(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

function resolveErrorStatus(message: string): number {
  if (message === "No autorizado") return 401;

  const isBadRequest =
    message.includes("obligatorio") ||
    message.includes("válida") ||
    message.includes("válido") ||
    message.includes("seleccionar") ||
    message.includes("no existe");

  return isBadRequest ? 400 : 500;
}

async function getEffectiveUser() {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Cliente de Supabase no disponible");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const devBypassUser =
    DEV_MODE && !user && DEV_TEST_USER_ID ? { id: DEV_TEST_USER_ID } : null;

  const effectiveUser = user ?? devBypassUser;

  if (error && !effectiveUser) {
    throw new Error("No autorizado");
  }

  if (!effectiveUser) {
    throw new Error("No autorizado");
  }

  return effectiveUser;
}

async function validateAuthor(authorId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("author_profiles")
    .select("id")
    .eq("id", authorId)
    .maybeSingle();

  if (error) {
    throw new Error(`Error validando autor: ${error.message}`);
  }

  if (!data) {
    throw new Error("El autor seleccionado no existe");
  }
}

async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = slugify(title) || `libro-${randomUUID().slice(0, 8)}`;
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("books")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new Error(`Error validando slug: ${error.message}`);
    }

    if (!data) return slug;

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

async function uploadBuffer(
  bucket: string,
  storagePath: string,
  file: File
): Promise<void> {
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage.from(bucket).upload(storagePath, buffer, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (error) {
    throw new Error(`Error subiendo archivo a ${bucket}: ${error.message}`);
  }
}

function getPublicUrl(bucket: string, storagePath: string): string {
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);

  return publicUrl;
}

async function rollback(state: RollbackState): Promise<void> {
  try {
    if (state.bookId) {
      await supabaseAdmin.from("book_assets").delete().eq("book_id", state.bookId);
    }

    if (state.editionId) {
      await supabaseAdmin.from("book_editions").delete().eq("id", state.editionId);
    }

    if (state.bookId) {
      await supabaseAdmin.from("books").delete().eq("id", state.bookId);
    }

    if (state.coverPath) {
      await supabaseAdmin.storage.from(COVER_BUCKET).remove([state.coverPath]);
    }

    if (state.filePath) {
      await supabaseAdmin.storage.from(FILE_BUCKET).remove([state.filePath]);
    }
  } catch (rollbackError) {
    console.error("ROLLBACK ERROR:", rollbackError);
  }
}

function parseAndValidateForm(formData: FormData): UploadBookForm {
  const title = readTextField(formData, "title");
  const descriptionInput = readTextField(formData, "description");
  const introductionInput = readTextField(formData, "introduction");
  const chapterOneInput = readTextField(formData, "chapter_one_excerpt");
  const sampleUrlInput = readTextField(formData, "sample_url");
  const priceRaw = readTextField(formData, "price");
  const authorId = readTextField(formData, "author_id");

  const cover = requireFileField(formData, "cover");
  const bookFile = requireFileField(formData, "book_file");

  if (!title) {
    throw new Error("El título es obligatorio");
  }

  if (!authorId) {
    throw new Error("Debes seleccionar un autor");
  }

  if (!cover) {
    throw new Error("La portada es obligatoria");
  }

  if (!bookFile) {
    throw new Error("El archivo del libro es obligatorio");
  }

  if (!isValidImageFile(cover)) {
    throw new Error("La portada debe ser una imagen válida");
  }

  if (!isAllowedBookExtension(bookFile.name)) {
    throw new Error("El archivo del libro debe ser PDF o EPUB");
  }

  const price = parsePositivePrice(priceRaw);
  if (price === null) {
    throw new Error("El precio no es válido");
  }

  return {
    title,
    descriptionInput,
    introductionInput,
    chapterOneInput,
    sampleUrlInput,
    price,
    authorId,
    cover,
    bookFile,
  };
}

async function createBookRecord(params: {
  ownerUserId: string;
  authorId: string;
  title: string;
  slug: string;
  coverUrl: string;
  descriptionLong: string | null;
  introduction: string | null;
  chapterOne: string | null;
  sampleUrl: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("books")
    .insert({
      owner_user_id: params.ownerUserId,
      author_id: params.authorId,
      title: params.title,
      slug: params.slug,
      description_short: getDescriptionShort(params.descriptionLong),
      description_long: params.descriptionLong,
      introduction: params.introduction,
      chapter_one_excerpt: params.chapterOne,
      sample_url: params.sampleUrl,
      status: "published",
      cover_url: params.coverUrl,
    })
    .select(BOOK_SELECT)
    .single();

  if (error) {
    throw new Error(`Error guardando libro: ${error.message}`);
  }

  return data;
}

async function createEditionRecord(params: {
  bookId: RecordId;
  price: number;
  fileUrl: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("book_editions")
    .insert({
      book_id: params.bookId,
      format: "ebook",
      edition_name: "Edición digital",
      price: params.price,
      currency: "DOP",
      file_url: params.fileUrl,
      is_active: true,
      sort_order: 0,
    })
    .select("id, book_id, format, edition_name, price, currency, file_url")
    .single();

  if (error) {
    throw new Error(`Error guardando edición: ${error.message}`);
  }

  return data;
}

async function createAssetRecords(params: {
  bookId: RecordId;
  editionId: RecordId;
  coverPath: string;
  filePath: string;
  coverUrl: string;
  fileUrl: string;
  coverMimeType: string | null;
  fileMimeType: string | null;
  bookAssetType: BookAssetType;
}) {
  const { error } = await supabaseAdmin.from("book_assets").insert([
    {
      book_id: params.bookId,
      edition_id: null,
      asset_type: "cover",
      storage_bucket: COVER_BUCKET,
      storage_path: params.coverPath,
      file_url: params.coverUrl,
      mime_type: params.coverMimeType,
      is_public: true,
      sort_order: 0,
    },
    {
      book_id: params.bookId,
      edition_id: params.editionId,
      asset_type: params.bookAssetType,
      storage_bucket: FILE_BUCKET,
      storage_path: params.filePath,
      file_url: params.fileUrl,
      mime_type: params.fileMimeType,
      is_public: true,
      sort_order: 1,
    },
  ]);

  if (error) {
    throw new Error(`Error guardando assets: ${error.message}`);
  }
}

export async function POST(request: Request) {
  const rollbackState: RollbackState = {
    bookId: null,
    editionId: null,
    coverPath: null,
    filePath: null,
  };

  try {
    const effectiveUser = await getEffectiveUser();
    const formData = await request.formData();

    const {
      title,
      descriptionInput,
      introductionInput,
      chapterOneInput,
      sampleUrlInput,
      price,
      authorId,
      cover,
      bookFile,
    } = parseAndValidateForm(formData);

    await validateAuthor(authorId);

    const slug = await generateUniqueSlug(title);
    const coverExt = getExtension(cover.name) || "jpg";
    const bookExt = getExtension(bookFile.name) || "pdf";
    const bookAssetType = getBookAssetType(bookFile.name);

    const coverPath = `covers/${slug}-${randomUUID()}.${coverExt}`;
    const filePath = `books/${slug}-${randomUUID()}.${bookExt}`;

    rollbackState.coverPath = coverPath;
    rollbackState.filePath = filePath;

    await Promise.all([
      uploadBuffer(COVER_BUCKET, coverPath, cover),
      uploadBuffer(FILE_BUCKET, filePath, bookFile),
    ]);

    const coverUrl = getPublicUrl(COVER_BUCKET, coverPath);
    const bookFileUrl = getPublicUrl(FILE_BUCKET, filePath);

    let extractedPreview = emptyPreview();

    try {
      extractedPreview = await extractPreviewWithWorker(bookFile);
    } catch (previewError) {
      console.error("Error extrayendo preview del archivo:", previewError);
    }

    const finalDescription = descriptionInput || extractedPreview.argument || null;
    const finalIntroduction =
      introductionInput || extractedPreview.introduction || null;
    const finalChapterOne =
      chapterOneInput || extractedPreview.chapterOne || null;
    const finalSampleUrl = sampleUrlInput || null;

    const insertedBook = await createBookRecord({
      ownerUserId: effectiveUser.id,
      authorId,
      title,
      slug,
      coverUrl,
      descriptionLong: finalDescription,
      introduction: finalIntroduction,
      chapterOne: finalChapterOne,
      sampleUrl: finalSampleUrl,
    });

    rollbackState.bookId = insertedBook.id;

    const insertedEdition = await createEditionRecord({
      bookId: insertedBook.id,
      price,
      fileUrl: bookFileUrl,
    });

    rollbackState.editionId = insertedEdition.id;

    await createAssetRecords({
      bookId: insertedBook.id,
      editionId: insertedEdition.id,
      coverPath,
      filePath,
      coverUrl,
      fileUrl: bookFileUrl,
      coverMimeType: cover.type || null,
      fileMimeType: bookFile.type || null,
      bookAssetType,
    });

    return Response.json(
      {
        message: "Libro publicado correctamente",
        book: insertedBook,
        edition: insertedEdition,
        storage: {
          cover_path: coverPath,
          file_path: filePath,
          cover_url: coverUrl,
          file_url: bookFileUrl,
        },
        extracted_preview: extractedPreview,
        view_url: `/catalog/${insertedBook.slug}`,
        dev_mode: DEV_MODE,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/books error:", error);

    await rollback(rollbackState);

    const message =
      error instanceof Error ? error.message : "Error interno del servidor";

    return jsonError(message, resolveErrorStatus(message));
  }
}
```

### app/auth/page.tsx

Size: 1128 bytes  
Score: 75  
SHA256 short: 3046841e3e33e5db

```tsx
import { AuthForm } from "@/components/forms/auth-form";
import { SectionHeading } from "@/components/section-heading";
export default function AuthPage() { return <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[0.9fr_1.1fr]"><div className="space-y-6"><SectionHeading eyebrow="Acceso" title="Una sola cuenta para lectores, autores y afiliados." description="Supabase Auth arranca rápido y luego puedes meter roles, permisos y RLS sin montar una novela paralela." /><div className="editorial-special rounded-[32px] p-6 shadow-panel"><p className="text-sm uppercase tracking-[0.24em] text-accent-700">Roles base</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{["Reader: compra y lee","Author: publica y vende","Affiliate: promociona y cobra","Admin: opera la plataforma"].map((role, index) => <div key={role} className={index === 2 ? "rounded-2xl border border-accent-200 bg-accent-50 p-4 text-sm text-slate-800" : "rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800"}>{role}</div>)}</div></div></div><AuthForm /></div></div>; }

```

### app/catalog/[slug]/page.tsx

Size: 7983 bytes  
Score: 65  
SHA256 short: 6fcccc638279aeab

```tsx
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

type PageProps = {
  params: {
    slug: string;
  };
};

type BookRecord = {
  id: string;
  title: string;
  slug: string;
  description_short: string | null;
  description_long: string | null;
  status: string;
};

type BookEdition = {
  id: string;
  edition_name: string | null;
  price: number | null;
  currency: string | null;
  format: string | null;
  file_url: string | null;
  is_active: boolean;
  sort_order: number | null;
};

type BookAsset = {
  asset_type: string;
  file_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  is_public: boolean | null;
};

function formatMoney(price: number | null, currencyCode: string | null) {
  if (typeof price !== "number") return null;

  const safeCurrency = currencyCode?.trim() || "DOP";

  try {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${safeCurrency} ${price}`;
  }
}

function getSummary(book: Pick<BookRecord, "description_short" | "description_long">) {
  return (
    book.description_short?.trim() ||
    book.description_long?.trim() ||
    "Este libro todavía no tiene resumen disponible."
  );
}

function getLongDescription(
  book: Pick<BookRecord, "description_short" | "description_long">
) {
  const shortText = book.description_short?.trim() || "";
  const longText = book.description_long?.trim() || "";

  if (!longText) return null;
  if (longText === shortText) return null;

  return longText;
}

async function resolveAssetUrl(asset: BookAsset | null): Promise<string | null> {
  if (!asset) return null;

  if (asset.file_url) {
    return asset.file_url;
  }

  if (!asset.storage_bucket || !asset.storage_path) {
    return null;
  }

  if (asset.is_public) {
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage
      .from(asset.storage_bucket)
      .getPublicUrl(asset.storage_path);

    return publicUrl || null;
  }

  const { data, error } = await supabaseAdmin.storage
    .from(asset.storage_bucket)
    .createSignedUrl(asset.storage_path, 60 * 60);

  if (error) {
    console.error("Error creando signed URL:", error.message);
    return null;
  }

  return data?.signedUrl || null;
}

async function getPublishedBookBySlug(slug: string): Promise<BookRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("books")
    .select("id, title, slug, description_short, description_long, status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(`Error cargando libro: ${error.message}`);
  }

  return (data as BookRecord | null) ?? null;
}

async function getBookResources(bookId: string) {
  const [
    { data: edition, error: editionError },
    { data: coverAsset, error: coverError },
    { data: fileAsset, error: fileError },
  ] = await Promise.all([
    supabaseAdmin
      .from("book_editions")
      .select(
        "id, edition_name, price, currency, format, file_url, is_active, sort_order"
      )
      .eq("book_id", bookId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("book_assets")
      .select("asset_type, file_url, storage_bucket, storage_path, is_public")
      .eq("book_id", bookId)
      .eq("asset_type", "cover")
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("book_assets")
      .select("asset_type, file_url, storage_bucket, storage_path, is_public")
      .eq("book_id", bookId)
      .in("asset_type", ["pdf", "epub"])
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (editionError) {
    throw new Error(`Error cargando edición: ${editionError.message}`);
  }

  if (coverError) {
    throw new Error(`Error cargando portada: ${coverError.message}`);
  }

  if (fileError) {
    throw new Error(`Error cargando archivo del libro: ${fileError.message}`);
  }

  return {
    edition: (edition as BookEdition | null) ?? null,
    coverAsset: (coverAsset as BookAsset | null) ?? null,
    fileAsset: (fileAsset as BookAsset | null) ?? null,
  };
}

export default async function BookPublicPage({ params }: PageProps) {
  const slug = decodeURIComponent(params.slug);
  const book = await getPublishedBookBySlug(slug);

  if (!book) {
    notFound();
  }

  const { edition, coverAsset, fileAsset } = await getBookResources(book.id);

  const [coverUrl, fallbackFileUrl] = await Promise.all([
    resolveAssetUrl(coverAsset),
    resolveAssetUrl(fileAsset),
  ]);

  const fileUrl = edition?.file_url?.trim() || fallbackFileUrl;
  const summary = getSummary(book);
  const longDescription = getLongDescription(book);
  const formattedPrice = formatMoney(edition?.price ?? null, edition?.currency ?? null);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-10 md:grid-cols-[320px_1fr] md:items-start">
        <section>
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`Portada de ${book.title}`}
              className="w-full rounded-2xl border border-slate-200 bg-white object-cover shadow-sm"
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
              Sin portada
            </div>
          )}
        </section>

        <section className="space-y-6">
          <header className="space-y-3">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
              Libro publicado
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
              {book.title}
            </h1>

            {(edition?.edition_name || edition?.format || formattedPrice) ? (
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                {edition?.edition_name ? <span>{edition.edition_name}</span> : null}
                {edition?.format ? <span>• {edition.format}</span> : null}
                {formattedPrice ? <span>• {formattedPrice}</span> : null}
              </div>
            ) : null}
          </header>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-950">Resumen</h2>
            <p className="whitespace-pre-line leading-7 text-slate-700">
              {summary}
            </p>
          </section>

          {longDescription ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-950">
                Sinopsis completa
              </h2>
              <p className="whitespace-pre-line leading-7 text-slate-700">
                {longDescription}
              </p>
            </section>
          ) : null}

          {fileUrl ? (
            <div className="flex flex-wrap gap-3">
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-black px-4 py-2 font-medium text-white transition hover:opacity-90"
              >
                Abrir libro
              </a>

              <a
                href={fileUrl}
                download
                className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-800 transition hover:bg-slate-50"
              >
                Descargar
              </a>
            </div>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              El libro fue publicado, pero no se encontró un archivo válido para abrir.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
```

### app/catalog/page.tsx

Size: 2843 bytes  
Score: 65  
SHA256 short: e159d415b217ec92

```tsx
import Link from "next/link";
import { BookCard } from "@/components/book-card";
import { SectionHeading } from "@/components/section-heading";
import { getBookCategories, getBooks } from "@/lib/queries";

type CatalogPageProps = {
  searchParams?: {
    category?: string;
  };
};

export default async function CatalogPage({
  searchParams,
}: CatalogPageProps) {
  const [books, categories] = await Promise.all([
    getBooks(),
    getBookCategories(),
  ]);

  const selectedCategory = searchParams?.category?.trim() || "";

  const filteredBooks = selectedCategory
    ? books.filter((book) => (book.categories ?? []).includes(selectedCategory))
    : books;

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Catálogo"
        title="Libros listos para vender en serio"
        description="Página de colección con filtros base, cards premium y espacio para bundles, preventas y promociones por campaña."
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/catalog"
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
            !selectedCategory
              ? "border-accent-200 bg-accent-50 text-accent-700"
              : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
          }`}
        >
          Todo
        </Link>

        {categories.map((category) => {
          const active = selectedCategory === category;

          return (
            <Link
              key={category}
              href={`/catalog?category=${encodeURIComponent(category)}`}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-accent-200 bg-accent-50 text-accent-700"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              }`}
            >
              {category}
            </Link>
          );
        })}
      </div>

      {filteredBooks.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-panel">
          <h2 className="text-xl font-semibold text-slate-900">
            No hay libros para mostrar
          </h2>
          <p className="mt-2 text-slate-600">
            {selectedCategory
              ? `No hay libros en la categoría "${selectedCategory}".`
              : "Todavía no hay libros publicados en el catálogo."}
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### app/checkout/page.tsx

Size: 1973 bytes  
Score: 75  
SHA256 short: be1f140c557079ad

```tsx
"use client";
import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { CheckoutForm } from "@/components/forms/checkout-form";
import { currency } from "@/lib/utils";
export default function CheckoutPage() { const { items, removeItem, total } = useCart(); return <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr]"><div className="space-y-6"><div><p className="text-sm uppercase tracking-[0.24em] text-accent-700">Checkout</p><h1 className="mt-3 font-display text-4xl font-bold text-brand-800">Tu pedido</h1><p className="mt-3 text-slate-700">Carrito listo para evolucionar a pago real con AZUL o CardNET. Ahora guarda el pedido en Supabase.</p></div><div className="space-y-4">{items.length ? items.map((item, index) => <div key={`${item.id}-${item.format}`} className={index === 0 ? "editorial-special rounded-[28px] p-5 shadow-panel" : "editorial-panel rounded-[28px] p-5"}><div className="flex items-center justify-between gap-4"><div><p className="text-lg font-semibold text-brand-800">{item.title}</p><p className="text-sm text-slate-600">{item.authorName} · {item.format}</p></div><div className="text-right"><p className="text-lg font-bold text-slate-950">{currency(item.price * item.quantity)}</p><button onClick={() => removeItem(item.id, item.format)} className="mt-2 text-sm font-medium text-accent-700">Quitar</button></div></div></div>) : <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-6 text-slate-700">Tu carrito está vacío. <Link href="/catalog" className="font-medium text-brand-700">Ve al catálogo</Link> y arreglemos eso.</div>}</div><div className="rounded-[28px] border border-slate-200 bg-white p-5"><div className="flex items-center justify-between text-lg text-slate-800"><span>Total</span><span className="font-bold text-slate-950">{currency(total)}</span></div></div></div><CheckoutForm /></div></div>; }

```

### app/dashboard/books/[id]/page.tsx

Size: 1181 bytes  
Score: 85  
SHA256 short: 6c9a6ff2163fb81f

```tsx
// app/dashboard/books/[id]/page.tsx
import { createClient } from "@/lib/supabase/server";
import ManuscriptUploader from "@/components/dashboard/ManuscriptUploader";

export const dynamic = "force-dynamic";

export default async function DashboardBookPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return <div className="p-6">Debes iniciar sesión para ver este libro.</div>;
  }

  const { data: book, error } = await supabase
    .from("books")
    .select("id, slug, title, owner_user_id")
    .eq("id", params.id)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error || !book) {
    return <div className="p-6">No se pudo cargar el libro.</div>;
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{book.title}</h1>
        <p className="text-sm opacity-70">slug: {book.slug}</p>
      </div>

      <ManuscriptUploader bookId={book.id} slug={book.slug} />
    </main>
  );
}
```

### app/dashboard/books/new/page.tsx

Size: 5416 bytes  
Score: 85  
SHA256 short: 37eb83a799b4cd5c

```tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type SubmitState = {
  type: "idle" | "success" | "error";
  message: string;
};

type CreateBookResponse = {
  message?: string;
  error?: string;
  book?: {
    id: string | number;
    slug: string;
    title: string;
  };
};

export default function NewBookPage() {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<SubmitState>({
    type: "idle",
    message: "",
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (isSubmitting) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    const title = formData.get("title")?.toString().trim() || "";
    const authorId = formData.get("author_id")?.toString().trim() || "";
    const price = Number(formData.get("price"));

    if (!title) {
      setStatus({
        type: "error",
        message: "El título es obligatorio.",
      });
      return;
    }

    if (!authorId) {
      setStatus({
        type: "error",
        message: "Debes colocar el author_id.",
      });
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setStatus({
        type: "error",
        message: "El precio no es válido.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/books", {
        method: "POST",
        body: formData,
      });

      let data: CreateBookResponse = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        setStatus({
          type: "error",
          message: data.error || "No se pudo subir el libro.",
        });
        return;
      }

      if (!data.book?.slug) {
        setStatus({
          type: "error",
          message: "El libro se guardó, pero no llegó el slug.",
        });
        return;
      }

      setStatus({
        type: "success",
        message: data.message || "Libro publicado correctamente.",
      });

      form.reset();
      router.push(`/catalog/${data.book.slug}`);
    } catch (error) {
      console.error("Error al enviar el formulario:", error);

      setStatus({
        type: "error",
        message: "Ocurrió un error al subir el libro.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Nuevo libro</h1>

      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="space-y-4 rounded-xl border p-5"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">Título</label>
          <input
            name="title"
            type="text"
            placeholder="Título"
            required
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Author ID</label>
          <input
            name="author_id"
            type="text"
            placeholder="UUID de author_profiles.id"
            required
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Descripción</label>
          <textarea
            name="description"
            placeholder="Resumen del libro"
            rows={5}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Precio</label>
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            placeholder="Precio"
            required
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Portada</label>
          <input
            name="cover"
            type="file"
            accept="image/*"
            required
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Archivo del libro
          </label>
          <input
            name="book_file"
            type="file"
            accept=".pdf,.epub"
            required
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Publicando..." : "Publicar libro"}
        </button>
      </form>

      {status.message && (
        <p
          className={
            status.type === "error"
              ? "text-sm text-red-600"
              : "text-sm text-green-600"
          }
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
```

### app/dashboard/books/published/page.tsx

Size: 2581 bytes  
Score: 85  
SHA256 short: 43ea1bf772a73096

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PublishedBookCard from "@/components/dashboard/PublishedBookCard";

export const dynamic = "force-dynamic";

type PublishedBook = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  status: string;
  created_at: string | null;
};

export default async function PublishedBooksPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">Libros publicados</h1>
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Debes iniciar sesión para ver tus libros publicados.
        </p>
      </main>
    );
  }

  const { data: booksData, error: booksError } = await supabase
    .from("books")
    .select("id, title, slug, cover_url, status, created_at")
    .eq("status", "published")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (booksError) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">Libros publicados</h1>
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          Error cargando libros: {booksError.message}
        </p>
      </main>
    );
  }

  const books: PublishedBook[] = booksData ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tus libros publicados</h1>
          <p className="mt-1 text-sm text-gray-500">
            Aquí ves únicamente los libros publicados de tu cuenta.
          </p>
        </div>

        <Link
          href="/dashboard/books/new"
          className="rounded-xl bg-black px-4 py-2 text-white"
        >
          Subir nuevo libro
        </Link>
      </div>

      {books.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
          No tienes libros publicados todavía.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <PublishedBookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </main>
  );
}
```

### app/dashboard/layout.tsx

Size: 1033 bytes  
Score: 45  
SHA256 short: 7630a1538468430e

```tsx
import React from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-600">
          Administra tus libros, publicaciones y métricas.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border p-4">
          <nav className="space-y-2">
            <a href="/dashboard" className="block rounded px-3 py-2 hover:bg-gray-100">
              Resumen
            </a>
            <a
              href="/dashboard/books/new"
              className="block rounded px-3 py-2 hover:bg-gray-100"
            >
              Nuevo libro
            </a>
          </nav>
        </aside>

        <main className="rounded-xl border p-6">{children}</main>
      </div>
    </section>
  );
}
```

### app/dashboard/page.tsx

Size: 4685 bytes  
Score: 65  
SHA256 short: 254b4690dd2b61e1

```tsx
import Link from "next/link";
import { BookText, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PublishedBookCard from "@/components/dashboard/PublishedBookCard";

export const dynamic = "force-dynamic";

type SimpleProfile = {
  id: string;
  full_name: string;
  role: string;
};

type PublishedBook = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  status: string;
  created_at: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          No hay sesión activa. Inicia sesión para entrar al dashboard.
        </div>
      </main>
    );
  }

  const [profileResult, booksResult] = await Promise.all([
    supabase
      .from("profiles_with_roles")
      .select("id, full_name, roles")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("books")
      .select("id, title, slug, cover_url, status, created_at")
      .eq("status", "published")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const { data: profileData } = profileResult;
  const { data: booksData, error: booksError } = booksResult;

  if (booksError) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          No se pudieron cargar tus libros: {booksError.message}
        </div>
      </main>
    );
  }

  const profile: SimpleProfile = {
    id: user.id,
    full_name:
      profileData?.full_name ||
      (user.user_metadata?.full_name as string) ||
      user.email ||
      "Usuario",
    role: profileData?.roles?.[0] || "customer",
  };

  const books: PublishedBook[] = booksData ?? [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-accent-700">
            Dashboard
          </p>

          <h1 className="mt-3 text-4xl font-bold text-brand-800">
            {profile.full_name}
          </h1>

          <p className="mt-3 text-slate-700">
            Estos son tus libros publicados.
          </p>
        </div>

        <div className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">
          Rol: {profile.role}
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="rounded-[28px] border bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <BookText className="h-5 w-5" />
          </div>
          <p className="mt-5 text-sm uppercase tracking-[0.18em] text-slate-500">
            Libros publicados
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {books.length}
          </p>
        </div>

        <div className="rounded-[28px] border bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <UserRound className="h-5 w-5" />
          </div>
          <p className="mt-5 text-sm uppercase tracking-[0.18em] text-slate-500">
            Usuario
          </p>
          <p className="mt-2 text-lg font-bold text-slate-950">
            {profile.full_name}
          </p>
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-slate-950">
            Tus libros publicados
          </h2>

          <Link
            href="/dashboard/books/new"
            className="rounded-xl bg-black px-4 py-2 text-sm text-white"
          >
            Subir nuevo libro
          </Link>
        </div>

        {books.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-slate-600">
            No tienes libros publicados todavía.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {books.map((book) => (
              <PublishedBookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

### app/globals.css

Size: 1637 bytes  
Score: 30  
SHA256 short: 1b6b08e8bd2eccda

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }

body {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.10), transparent 24%),
    radial-gradient(circle at 88% 18%, rgba(220, 38, 38, 0.08), transparent 22%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  color: #0f172a;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.03) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(circle at center, black 34%, transparent 88%);
  opacity: 0.45;
}

::selection { background: rgba(37, 99, 235, 0.18); color: #0f172a; }
::-webkit-scrollbar { width: 11px; }
::-webkit-scrollbar-track { background: #e2e8f0; }
::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.85), rgba(220, 38, 38, 0.75));
  border: 2px solid #e2e8f0;
}

.glass {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.22);
}

.editorial-panel {
  background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.94));
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08);
}

.editorial-special {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(37, 99, 235, 0.08));
  border: 1px solid rgba(248, 113, 113, 0.18);
}

```

### app/layout.tsx

Size: 796 bytes  
Score: 45  
SHA256 short: 76619b00fe712a8b

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartProvider } from "@/components/cart-provider";
export const metadata: Metadata = { title: "BestSeller | Publica, vende y escala libros", description: "Marketplace editorial y plataforma de publicación con Supabase + Next.js.", metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000") };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body className="font-sans antialiased"><CartProvider><div className="relative min-h-screen"><SiteHeader /><main>{children}</main><SiteFooter /></div></CartProvider></body></html>; }

```

### app/not-found.tsx

Size: 632 bytes  
Score: 30  
SHA256 short: 4a6f3156b8efe125

```tsx
import Link from "next/link";
export default function NotFound() { return <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 text-center"><div className="rounded-full border border-accent-200 bg-accent-50 px-4 py-2 text-sm text-accent-700">404</div><h1 className="mt-6 font-display text-5xl font-bold text-brand-800">Esa página no apareció.</h1><p className="mt-4 max-w-xl text-slate-700">Quizá la URL se fue a escribir otra novela. Vuelve al inicio y seguimos.</p><Link href="/" className="mt-8 rounded-full bg-accent-600 px-5 py-3 font-semibold text-white">Ir al home</Link></div>; }

```

### app/page.tsx

Size: 6153 bytes  
Score: 65  
SHA256 short: b025f45ae523c66b

```tsx
import Link from "next/link";
import { ArrowRight, BookOpenText, ChartNoAxesCombined, Rocket, Sparkles, Users } from "lucide-react";
import { getFeaturedBooks } from "@/lib/queries";
import { SectionHeading } from "@/components/section-heading";
import { BookCard } from "@/components/book-card";
const pillars = [{ icon: BookOpenText, title: "Publicación multi-formato", description: "Libro impreso, eBook, lectura en nube y distribución tipo Kindle como canal externo." },{ icon: Users, title: "Red de afiliados", description: "Activa promotores, autores, microinfluencers y embajadores con comisiones y material listo para usar." },{ icon: ChartNoAxesCombined, title: "Motor de crecimiento", description: "Campañas, bundles, preventas, funnels y dashboard para que la venta no dependa solo del algoritmo." }];
export default async function HomePage() { const books = await getFeaturedBooks(); return <div><section className="relative overflow-hidden"><div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-28"><div className="relative z-10"><div className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-4 py-2 text-sm font-medium text-accent-700"><Sparkles className="h-4 w-4" />Plataforma editorial con músculo comercial</div><h1 className="mt-8 max-w-4xl font-display text-5xl font-bold tracking-tight text-brand-800 sm:text-6xl lg:text-7xl">Publica, vende y escala tus libros con blanco limpio, negro firme y azul que manda.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">BestSeller une lógica editorial, checkout, afiliados y lectura digital con una interfaz clara, moderna y lista para crecer sin parecer un panel de 2014.</p><div className="mt-10 flex flex-wrap gap-4"><Link href="/catalog" className="inline-flex items-center gap-2 rounded-full bg-accent-600 px-6 py-3 font-semibold text-white transition hover:scale-[1.01] hover:bg-accent-700">Explorar libros<ArrowRight className="h-4 w-4" /></Link><Link href="/publish" className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-6 py-3 font-semibold text-brand-700 transition hover:bg-brand-100">Publicar mi libro</Link></div><div className="mt-12 grid max-w-2xl gap-4 sm:grid-cols-3">{[["3x", "más claridad comercial"],["4", "formatos por libro"],["24/7", "biblioteca digital"]].map(([value, label], index) => <div key={label} className={index === 1 ? "editorial-special rounded-[28px] p-5 shadow-panel" : "editorial-panel rounded-[28px] p-5"}><p className="text-3xl font-bold text-slate-950">{value}</p><p className="mt-2 text-sm text-slate-600">{label}</p></div>)}</div></div><div className="relative min-h-[420px]"><div className="absolute inset-x-0 top-6 mx-auto h-72 w-72 rounded-full bg-brand-100 blur-3xl" /><div className="editorial-panel absolute left-0 top-10 w-[88%] rounded-[32px] p-6 shadow-glow"><div className="mb-6 flex items-center justify-between"><div><p className="text-sm text-accent-700">Launch OS</p><p className="font-display text-2xl font-bold text-brand-800">Panel de autor</p></div><Rocket className="h-6 w-6 text-brand-700" /></div><div className="grid gap-4 sm:grid-cols-2">{[["Ventas del mes", "$8,420"],["Afiliados activos", "36"],["Tasa de conversión", "4.8%"],["Pedidos pendientes", "12"]].map(([label, value], index) => <div key={label} className={index === 0 ? "rounded-3xl border border-accent-200 bg-accent-50 p-4" : "rounded-3xl border border-slate-200 bg-white p-4"}><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>)}</div></div></div></div></section><section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className="grid gap-6 lg:grid-cols-3">{pillars.map(({ icon: Icon, title, description }, index) => <div key={title} className={index === 1 ? "editorial-special rounded-[32px] p-6 shadow-panel" : "editorial-panel rounded-[32px] p-6"}><div className={index === 1 ? "flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-100 text-accent-700" : "flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"}><Icon className="h-6 w-6" /></div><h3 className="mt-6 text-2xl font-semibold text-brand-800">{title}</h3><p className="mt-4 text-sm leading-7 text-slate-700">{description}</p></div>)}</div></section><section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="mb-10 flex items-end justify-between gap-6"><SectionHeading eyebrow="Catálogo destacado" title="Libros que ya vienen con narrativa, oferta y presencia." description="El frontend está listo para fichas de producto que venden, no solo muestran texto." /><Link href="/catalog" className="hidden rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 lg:inline-flex">Ver todo</Link></div><div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{books.map((book) => <BookCard key={book.id} book={book} />)}</div></section><section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8"><div className="editorial-special overflow-hidden rounded-[40px] p-8 shadow-panel lg:p-12"><div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm uppercase tracking-[0.26em] text-accent-700">Listo para crecer</p><h2 className="mt-4 font-display text-3xl font-bold text-brand-800 sm:text-4xl">Empieza con Supabase hoy y escala a pagos, logística y membresías cuando quieras.</h2><p className="mt-5 max-w-3xl text-base leading-8 text-slate-700">Este starter trae estructura para catálogo, auth, solicitudes de autor, afiliados, dashboard y pedidos. No está improvisado; está puesto para expandirse sin dolor.</p></div><div className="flex flex-wrap gap-3"><Link href="/publish" className="rounded-full bg-accent-600 px-5 py-3 font-semibold text-white">Quiero publicar</Link><Link href="/affiliates" className="rounded-full border border-brand-200 bg-white px-5 py-3 font-semibold text-brand-700">Quiero vender</Link></div></div></div></section></div>; }

```

### app/publish/page.tsx

Size: 1591 bytes  
Score: 65  
SHA256 short: 5865778c23647cf2

```tsx
import { CheckCircle2 } from "lucide-react";
import { PublishForm } from "@/components/forms/publishform";
import { SectionHeading } from "@/components/section-heading";

const publishFeatures = [
  "Maquetación, portada, metadata e ISBN.",
  "Versión impresa, digital y reader privado.",
  "Activación comercial con campaña, afiliados y bundles.",
  "Panel para seguir ventas, regalías y solicitudes.",
];

export default function PublishPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="space-y-8">
          <SectionHeading
            eyebrow="Publicar"
            title="Tu libro merece sistema, no solo inspiración del lunes."
            description="Captura de autores, onboarding editorial y pipeline para publicación multi-formato."
          />

          <div className="space-y-4">
            {publishFeatures.map((item, index) => {
              const cardClassName =
                index === 2
                  ? "editorial-special flex items-center gap-4 rounded-[28px] p-5 shadow-panel"
                  : "glass flex items-center gap-4 rounded-[28px] p-5 shadow-panel";

              return (
                <div key={item} className={cardClassName}>
                  <CheckCircle2 className="h-5 w-5 text-brand-700" />
                  <p className="text-slate-800">{item}</p>
                </div>
              );
            })}
          </div>
        </section>

        <PublishForm />
      </div>
    </main>
  );
}
```

### app/reader/[slug]/BookReaderClient.tsx

Size: 28809 bytes  
Score: 60  
SHA256 short: 626b36124ca2c6e6

```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";

type BookReaderClientProps = {
  title: string;
  coverUrl: string | null;
  pdfUrl: string;
};

type SpreadData = {
  leftNumber: number | null;
  rightNumber: number | null;
  left: string | null;
  right: string | null;
};

type FlipState =
  | null
  | {
      direction: "next" | "prev" | "open-cover" | "close-cover";
      front: string | null;
      back: string | null;
      baseLeft: string | null;
      baseRight: string | null;
    };

type OutlineNodeLike = {
  title?: string;
  dest?: string | unknown[] | null;
  items?: OutlineNodeLike[];
};

const FLIP_MS = 700;
const MIN_SWIPE = 60;
const RESIZE_BUCKET = 140;
const FALLBACK_END_PAGE = 15;
const TEXT_SCAN_LIMIT = 40;

function isPageNumber(value: number | null): value is number {
  return typeof value === "number";
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", 0.92);
  });
}

function revokeAllObjectUrls(map: Map<number, string>) {
  for (const url of map.values()) {
    URL.revokeObjectURL(url);
  }
  map.clear();
}

function isEditableTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;

  const tag = el.tagName;
  return (
    el.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT"
  );
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function flattenOutline(items: OutlineNodeLike[] = []): OutlineNodeLike[] {
  return items.flatMap((item) => [item, ...flattenOutline(item.items ?? [])]);
}

function isChapterTwoTitle(title: string) {
  const text = normalizeText(title);

  return (
    /^capitulo\s*2\b/.test(text) ||
    /^capitulo\s*ii\b/.test(text) ||
    /^chapter\s*2\b/.test(text) ||
    /^chapter\s*ii\b/.test(text)
  );
}

function hasChapterTwoText(text: string) {
  const normalized = normalizeText(text);

  return (
    /\bcapitulo\s*2\b/.test(normalized) ||
    /\bcapitulo\s*ii\b/.test(normalized) ||
    /\bchapter\s*2\b/.test(normalized) ||
    /\bchapter\s*ii\b/.test(normalized)
  );
}

async function resolveOutlinePageNumber(
  pdfDoc: PDFDocumentProxy,
  item: OutlineNodeLike
): Promise<number | null> {
  if (!item.dest) return null;

  const destination =
    typeof item.dest === "string"
      ? await pdfDoc.getDestination(item.dest)
      : item.dest;

  if (!destination || !Array.isArray(destination) || !destination[0]) {
    return null;
  }

  const firstTarget = destination[0];

  if (typeof firstTarget === "number") {
    return firstTarget + 1;
  }

  try {
    const pageIndex = await pdfDoc.getPageIndex(firstTarget as never);
    return pageIndex + 1;
  } catch {
    return null;
  }
}

async function detectChapterOneEndPage(
  pdfDoc: PDFDocumentProxy
): Promise<number> {
  const hardFallback = Math.min(pdfDoc.numPages, FALLBACK_END_PAGE);

  try {
    const outline = (await pdfDoc.getOutline()) as OutlineNodeLike[] | null;

    if (outline && outline.length > 0) {
      const allItems = flattenOutline(outline);
      const chapterTwoItem = allItems.find((item) =>
        isChapterTwoTitle(item.title ?? "")
      );

      if (chapterTwoItem) {
        const chapterTwoPage = await resolveOutlinePageNumber(
          pdfDoc,
          chapterTwoItem
        );

        if (chapterTwoPage && chapterTwoPage > 1) {
          return Math.min(pdfDoc.numPages, chapterTwoPage - 1);
        }
      }
    }
  } catch {
    // seguimos con fallback por texto
  }

  try {
    const maxScanPage = Math.min(pdfDoc.numPages, TEXT_SCAN_LIMIT);

    for (let pageNumber = 1; pageNumber <= maxScanPage; pageNumber += 1) {
      let page: PDFPageProxy | null = null;

      try {
        page = await pdfDoc.getPage(pageNumber);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
          .map((item) =>
            "str" in item && typeof item.str === "string" ? item.str : ""
          )
          .join(" ");

        page.cleanup();

        if (hasChapterTwoText(pageText)) {
          return Math.max(1, pageNumber - 1);
        }
      } catch {
        page?.cleanup();
      }
    }
  } catch {
    // seguimos con fallback duro
  }

  return hardFallback;
}

function PageSurface({
  src,
  side,
  label,
}: {
  src: string | null;
  side: "left" | "right";
  label: string;
}) {
  const isLeft = side === "left";

  return (
    <div
      className={[
        "relative h-full overflow-hidden border border-slate-300 bg-white",
        "shadow-[0_18px_40px_rgba(15,23,42,0.12)]",
        isLeft
          ? "rounded-l-[28px] rounded-r-[10px] border-r-0"
          : "rounded-r-[28px] rounded-l-[10px] border-l-0",
      ].join(" ")}
    >
      <div
        className={[
          "pointer-events-none absolute inset-0 z-[2]",
          isLeft
            ? "bg-[linear-gradient(to_right,rgba(15,23,42,0.12),transparent_18%)]"
            : "bg-[linear-gradient(to_left,rgba(15,23,42,0.12),transparent_18%)]",
        ].join(" ")}
      />

      <div className="relative z-[1] flex h-full items-center justify-center p-3">
        {src ? (
          <img
            src={src}
            alt={label}
            draggable={false}
            loading="eager"
            className="h-full w-full select-none object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
            Página vacía
          </div>
        )}
      </div>
    </div>
  );
}

function FlipLeaf({
  flip,
  active,
}: {
  flip: NonNullable<FlipState>;
  active: boolean;
}) {
  const forward = flip.direction === "next" || flip.direction === "open-cover";

  const transform = forward
    ? active
      ? "rotateY(-180deg)"
      : "rotateY(0deg)"
    : active
      ? "rotateY(180deg)"
      : "rotateY(0deg)";

  return (
    <div
      className="pointer-events-none absolute bottom-6 top-6 z-20"
      style={{
        left: forward ? "50%" : "0%",
        width: "50%",
        transformStyle: "preserve-3d",
        transformOrigin: forward ? "left center" : "right center",
        transform,
        transition: `transform ${FLIP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        willChange: "transform",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <PageSurface
          src={flip.front}
          side={forward ? "right" : "left"}
          label="Hoja frontal"
        />
        <div
          className={[
            "absolute inset-0",
            forward
              ? "bg-[linear-gradient(to_left,rgba(15,23,42,0.22),transparent_28%)]"
              : "bg-[linear-gradient(to_right,rgba(15,23,42,0.22),transparent_28%)]",
          ].join(" ")}
        />
      </div>

      <div
        className="absolute inset-0"
        style={{
          transform: "rotateY(180deg)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <PageSurface
          src={flip.back}
          side={forward ? "left" : "right"}
          label="Hoja trasera"
        />
        <div
          className={[
            "absolute inset-0",
            forward
              ? "bg-[linear-gradient(to_right,rgba(15,23,42,0.18),transparent_24%)]"
              : "bg-[linear-gradient(to_left,rgba(15,23,42,0.18),transparent_24%)]",
          ].join(" ")}
        />
      </div>
    </div>
  );
}

export default function BookReaderClient({
  title,
  coverUrl,
  pdfUrl,
}: BookReaderClientProps) {
  const hasCover = Boolean(coverUrl);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dynamicEndPage, setDynamicEndPage] = useState(FALLBACK_END_PAGE);

  const [currentSpread, setCurrentSpread] = useState<number>(hasCover ? -1 : 0);
  const [flip, setFlip] = useState<FlipState>(null);
  const [flipActive, setFlipActive] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [bookWidth, setBookWidth] = useState(0);
  const [renderTick, setRenderTick] = useState(0);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const cacheRef = useRef<Map<number, string>>(new Map());
  const pendingRef = useRef<Map<number, Promise<string | null>>>(new Map());

  const timerRef = useRef<number | null>(null);
  const raf1Ref = useRef<number | null>(null);
  const raf2Ref = useRef<number | null>(null);

  const generationRef = useRef(0);
  const resizeBucketRef = useRef<number | null>(null);
  const navLockRef = useRef(false);

  const totalPdfPages = pdfDoc?.numPages ?? 0;

  const visibleRange = useMemo(
    () => ({
      start: 1,
      end: dynamicEndPage,
    }),
    [dynamicEndPage]
  );

  const visiblePageCount = useMemo(() => {
    if (totalPdfPages === 0) return 0;

    const safeStart = Math.max(1, visibleRange.start);
    const safeEnd = Math.min(totalPdfPages, visibleRange.end);

    if (safeEnd < safeStart) return 0;

    return safeEnd - safeStart + 1;
  }, [totalPdfPages, visibleRange.end, visibleRange.start]);

  const spreadCount = useMemo(() => {
    if (visiblePageCount === 0) return 0;
    return Math.ceil((visiblePageCount + 1) / 2);
  }, [visiblePageCount]);

  const toRealPageNumber = useCallback(
    (visiblePageNumber: number) => visibleRange.start + visiblePageNumber - 1,
    [visibleRange.start]
  );

  const bumpRender = useCallback(() => {
    setRenderTick((value) => value + 1);
  }, []);

  const clearAnimationHandles = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (raf1Ref.current !== null) {
      window.cancelAnimationFrame(raf1Ref.current);
      raf1Ref.current = null;
    }

    if (raf2Ref.current !== null) {
      window.cancelAnimationFrame(raf2Ref.current);
      raf2Ref.current = null;
    }
  }, []);

  const clearCache = useCallback(
    (refresh = true) => {
      pendingRef.current.clear();
      revokeAllObjectUrls(cacheRef.current);

      if (refresh) {
        bumpRender();
      }
    },
    [bumpRender]
  );

  const getSpreadPages = useCallback(
    (spreadIndex: number): SpreadData => {
      if (spreadIndex < 0 || visiblePageCount === 0) {
        return {
          leftNumber: null,
          rightNumber: null,
          left: null,
          right: null,
        };
      }

      const leftVisibleNumber = spreadIndex === 0 ? null : spreadIndex * 2;
      const rawRightVisibleNumber = spreadIndex === 0 ? 1 : spreadIndex * 2 + 1;

      const rightVisibleNumber =
        rawRightVisibleNumber <= visiblePageCount ? rawRightVisibleNumber : null;

      const leftRealNumber = leftVisibleNumber
        ? toRealPageNumber(leftVisibleNumber)
        : null;

      const rightRealNumber = rightVisibleNumber
        ? toRealPageNumber(rightVisibleNumber)
        : null;

      return {
        leftNumber: leftRealNumber,
        rightNumber: rightRealNumber,
        left: leftRealNumber ? cacheRef.current.get(leftRealNumber) ?? null : null,
        right: rightRealNumber
          ? cacheRef.current.get(rightRealNumber) ?? null
          : null,
      };
    },
    [toRealPageNumber, visiblePageCount]
  );

  const ensurePageImage = useCallback(
    async (pageNumber: number): Promise<string | null> => {
      const minPage = Math.max(1, visibleRange.start);
      const maxPage = Math.min(totalPdfPages, visibleRange.end);

      if (!pdfDoc || pageNumber < minPage || pageNumber > maxPage) {
        return null;
      }

      const cached = cacheRef.current.get(pageNumber);
      if (cached) return cached;

      const pending = pendingRef.current.get(pageNumber);
      if (pending) return pending;

      const generationAtStart = generationRef.current;

      const promise = (async () => {
        let page: PDFPageProxy | null = null;
        let objectUrl: string | null = null;

        try {
          page = await pdfDoc.getPage(pageNumber);

          if (generationAtStart !== generationRef.current) {
            page.cleanup();
            return null;
          }

          const baseViewport = page.getViewport({ scale: 1 });
          const dpr =
            typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

          const safeBookWidth = Math.max(bookWidth || 1100, 720);
          const targetPageWidth = Math.max(
            900,
            Math.min(1800, Math.floor((safeBookWidth / 2) * dpr * 1.2))
          );

          const scale = targetPageWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) {
            page.cleanup();
            return null;
          }

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({
            canvas,
            canvasContext: context,
            viewport,
          }).promise;

          const blob = await canvasToBlob(canvas);

          page.cleanup();
          canvas.width = 0;
          canvas.height = 0;

          if (!blob) return null;

          objectUrl = URL.createObjectURL(blob);

          if (generationAtStart !== generationRef.current) {
            URL.revokeObjectURL(objectUrl);
            return null;
          }

          cacheRef.current.set(pageNumber, objectUrl);
          bumpRender();

          return objectUrl;
        } catch {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
          }
          return null;
        } finally {
          pendingRef.current.delete(pageNumber);
        }
      })();

      pendingRef.current.set(pageNumber, promise);
      return promise;
    },
    [bookWidth, bumpRender, pdfDoc, totalPdfPages, visibleRange.end, visibleRange.start]
  );

  const startFlip = useCallback(
    (nextFlip: NonNullable<FlipState>, onDone: () => void) => {
      clearAnimationHandles();

      setFlip(nextFlip);
      setFlipActive(false);
      setIsFlipping(true);

      raf1Ref.current = window.requestAnimationFrame(() => {
        raf2Ref.current = window.requestAnimationFrame(() => {
          setFlipActive(true);
        });
      });

      timerRef.current = window.setTimeout(() => {
        onDone();
        setFlip(null);
        setFlipActive(false);
        setIsFlipping(false);
        navLockRef.current = false;
      }, FLIP_MS);
    },
    [clearAnimationHandles]
  );

  const currentSpreadData = useMemo(
    () => getSpreadPages(currentSpread),
    [currentSpread, getSpreadPages, renderTick]
  );

  const isCoverView = hasCover && currentSpread === -1;

  const canGoNext =
    !isFlipping &&
    !navLockRef.current &&
    ((hasCover && currentSpread === -1 && visiblePageCount > 0) ||
      currentSpread < spreadCount - 1);

  const canGoPrev =
    !isFlipping &&
    !navLockRef.current &&
    (currentSpread > 0 || (hasCover && currentSpread === 0));

  const goNext = useCallback(async () => {
    if (!canGoNext || navLockRef.current) return;

    navLockRef.current = true;

    try {
      if (hasCover && currentSpread === -1) {
        const firstSpread = getSpreadPages(0);
        const firstPage = isPageNumber(firstSpread.rightNumber)
          ? await ensurePageImage(firstSpread.rightNumber)
          : null;

        startFlip(
          {
            direction: "open-cover",
            front: coverUrl,
            back: firstPage,
            baseLeft: null,
            baseRight: firstPage,
          },
          () => setCurrentSpread(0)
        );

        return;
      }

      const current = getSpreadPages(currentSpread);
      const target = getSpreadPages(currentSpread + 1);

      const front = isPageNumber(current.rightNumber)
        ? await ensurePageImage(current.rightNumber)
        : null;

      const back = isPageNumber(target.leftNumber)
        ? await ensurePageImage(target.leftNumber)
        : null;

      const baseLeft = isPageNumber(target.leftNumber)
        ? await ensurePageImage(target.leftNumber)
        : null;

      const baseRight = isPageNumber(target.rightNumber)
        ? await ensurePageImage(target.rightNumber)
        : null;

      startFlip(
        {
          direction: "next",
          front,
          back,
          baseLeft,
          baseRight,
        },
        () => setCurrentSpread((prev) => Math.min(prev + 1, spreadCount - 1))
      );
    } catch {
      navLockRef.current = false;
      setIsFlipping(false);
    }
  }, [
    canGoNext,
    coverUrl,
    currentSpread,
    ensurePageImage,
    getSpreadPages,
    hasCover,
    spreadCount,
    startFlip,
  ]);

  const goPrev = useCallback(async () => {
    if (!canGoPrev || navLockRef.current) return;

    navLockRef.current = true;

    try {
      if (hasCover && currentSpread === 0) {
        const current = getSpreadPages(0);
        const firstPage = isPageNumber(current.rightNumber)
          ? await ensurePageImage(current.rightNumber)
          : null;

        startFlip(
          {
            direction: "close-cover",
            front: null,
            back: coverUrl,
            baseLeft: null,
            baseRight: firstPage,
          },
          () => setCurrentSpread(-1)
        );

        return;
      }

      const current = getSpreadPages(currentSpread);
      const target = getSpreadPages(currentSpread - 1);

      const front = isPageNumber(current.leftNumber)
        ? await ensurePageImage(current.leftNumber)
        : null;

      const back = isPageNumber(target.rightNumber)
        ? await ensurePageImage(target.rightNumber)
        : null;

      const baseLeft = isPageNumber(target.leftNumber)
        ? await ensurePageImage(target.leftNumber)
        : null;

      const baseRight = isPageNumber(target.rightNumber)
        ? await ensurePageImage(target.rightNumber)
        : null;

      startFlip(
        {
          direction: "prev",
          front,
          back,
          baseLeft,
          baseRight,
        },
        () => setCurrentSpread((prev) => Math.max(prev - 1, 0))
      );
    } catch {
      navLockRef.current = false;
      setIsFlipping(false);
    }
  }, [
    canGoPrev,
    coverUrl,
    currentSpread,
    ensurePageImage,
    getSpreadPages,
    hasCover,
    startFlip,
  ]);

  useEffect(() => {
    let cancelled = false;
    let localDoc: PDFDocumentProxy | null = null;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);
        setPdfDoc(null);
        setDynamicEndPage(FALLBACK_END_PAGE);

        generationRef.current += 1;
        navLockRef.current = false;
        clearAnimationHandles();
        clearCache();

        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjs.getDocument({
          url: pdfUrl,
          withCredentials: false,
        });

        const doc = await loadingTask.promise;

        if (cancelled) {
          await doc.destroy();
          return;
        }

        localDoc = doc;

        const detectedEndPage = await detectChapterOneEndPage(doc);

        if (cancelled) {
          await doc.destroy();
          return;
        }

        setDynamicEndPage(detectedEndPage);
        setPdfDoc(doc);
        setCurrentSpread(hasCover ? -1 : 0);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError("No se pudo abrir el PDF del libro.");
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      generationRef.current += 1;
      navLockRef.current = false;
      clearAnimationHandles();
      clearCache(false);
      void localDoc?.destroy();
    };
  }, [clearAnimationHandles, clearCache, hasCover, pdfUrl]);

  useEffect(() => {
    if (!viewportRef.current) return;

    const node = viewportRef.current;

    const updateWidth = (width: number) => {
      setBookWidth(width);

      const bucket = Math.max(1, Math.round(width / RESIZE_BUCKET));

      if (resizeBucketRef.current === null) {
        resizeBucketRef.current = bucket;
        return;
      }

      if (bucket !== resizeBucketRef.current) {
        resizeBucketRef.current = bucket;
        generationRef.current += 1;
        clearCache();
      }
    };

    updateWidth(node.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      updateWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [clearCache]);

  useEffect(() => {
    if (!pdfDoc || visiblePageCount === 0) return;

    const warmNearbyPages = async () => {
      const spreadsToWarm =
        currentSpread < 0
          ? [0, 1]
          : [currentSpread - 1, currentSpread, currentSpread + 1];

      const candidates = spreadsToWarm
        .flatMap((spreadIndex) => {
          const spread = getSpreadPages(spreadIndex);
          return [spread.leftNumber, spread.rightNumber];
        })
        .filter(isPageNumber);

      const unique = [...new Set(candidates)];

      await Promise.all(unique.map((page) => ensurePageImage(page)));
    };

    void warmNearbyPages();
  }, [currentSpread, ensurePageImage, getSpreadPages, visiblePageCount, pdfDoc]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        void goNext();
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void goPrev();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev]);

  useEffect(() => {
    return () => {
      clearAnimationHandles();
      clearCache(false);
    };
  }, [clearAnimationHandles, clearCache]);

  const progressLabel = isCoverView
    ? "Portada"
    : `Vista previa: Introducción + Capítulo 1 (hasta la página ${Math.min(
        dynamicEndPage,
        totalPdfPages || dynamicEndPage
      )})`;

  return (
    <section className="w-full px-4 py-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 pb-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-slate-900">
            {title}
          </h1>
          <p className="text-sm text-slate-500">{progressLabel}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void goPrev()}
            disabled={!canGoPrev}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => void goNext()}
            disabled={!canGoNext}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="mx-auto max-w-7xl touch-pan-y"
        onTouchStart={(event) => {
          touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const startX = touchStartXRef.current;
          const endX = event.changedTouches[0]?.clientX ?? null;

          touchStartXRef.current = null;

          if (startX === null || endX === null) return;

          const delta = endX - startX;

          if (delta <= -MIN_SWIPE) {
            void goNext();
          } else if (delta >= MIN_SWIPE) {
            void goPrev();
          }
        }}
      >
        {loading ? (
          <div className="flex min-h-[62vh] items-center justify-center">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-500 shadow-sm">
              Cargando libro...
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-[62vh] items-center justify-center">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          </div>
        ) : isCoverView ? (
          <div className="flex min-h-[62vh] items-center justify-center">
            <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-slate-300 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-[linear-gradient(to_right,rgba(15,23,42,0.18),transparent)]" />
              <div className="relative aspect-[3/4]">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={`Portada de ${title}`}
                    draggable={false}
                    className="h-full w-full select-none object-cover"
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="relative mx-auto h-[72vh] max-h-[920px] min-h-[460px] w-full max-w-7xl"
            style={{ perspective: "2400px" }}
          >
            <div className="absolute inset-x-6 inset-y-6">
              <div className="absolute inset-y-0 left-1/2 z-[1] w-px -translate-x-1/2 bg-slate-300 shadow-[0_0_30px_rgba(15,23,42,0.18)]" />

              <div className="grid h-full w-full grid-cols-2">
                <PageSurface
                  src={flip ? flip.baseLeft : currentSpreadData.left}
                  side="left"
                  label="Página izquierda"
                />
                <PageSurface
                  src={flip ? flip.baseRight : currentSpreadData.right}
                  side="right"
                  label="Página derecha"
                />
              </div>

              {flip ? <FlipLeaf flip={flip} active={flipActive} /> : null}

              {isFlipping ? (
                <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-xs font-medium text-slate-600 shadow">
                  Pasando hoja...
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
```

### app/reader/[slug]/page.tsx

Size: 3796 bytes  
Score: 85  
SHA256 short: e2af8799a72ee9fd

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BookReaderClient from "./BookReaderClient";

export const dynamic = "force-dynamic";

type BookRow = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  status: string;
};

type BookAssetRow = {
  asset_type: string;
  file_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  is_public: boolean | null;
  sort_order: number | null;
};

export default async function ReaderPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = await createClient();

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id, title, slug, cover_url, status")
    .eq("slug", params.slug)
    .eq("status", "published")
    .maybeSingle<BookRow>();

  if (bookError || !book) {
    notFound();
  }

  const { data: assets, error: assetsError } = await supabase
    .from("book_assets")
    .select(
      "asset_type, file_url, storage_bucket, storage_path, mime_type, is_public, sort_order"
    )
    .eq("book_id", book.id)
    .in("asset_type", ["manuscript", "pdf"])
    .order("sort_order", { ascending: true });

  if (assetsError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          No se pudo cargar el archivo del libro: {assetsError.message}
        </div>
      </main>
    );
  }

  const assetList = (assets ?? []) as BookAssetRow[];

  const preferredAsset =
    assetList.find((item) => item.asset_type === "manuscript") ??
    assetList.find((item) => item.asset_type === "pdf") ??
    null;

  let pdfUrl = preferredAsset?.file_url ?? null;

  if (!pdfUrl && preferredAsset?.storage_bucket && preferredAsset?.storage_path) {
    const { data } = supabase.storage
      .from(preferredAsset.storage_bucket)
      .getPublicUrl(preferredAsset.storage_path);

    pdfUrl = data.publicUrl;
  }

  if (!pdfUrl) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">{book.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              No se encontró un PDF válido para lectura.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Volver
          </Link>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
          El libro existe, pero no tiene un asset de tipo <strong>manuscript</strong> o <strong>pdf</strong> con URL válida.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto mb-4 flex max-w-6xl items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
            Lector
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">{book.title}</h1>
        </div>

        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Volver al dashboard
        </Link>
      </div>

      <BookReaderClient
        title={book.title}
        coverUrl={book.cover_url}
        pdfUrl={pdfUrl}
      />
    </main>
  );
}
```

### components/book-card.tsx

Size: 11180 bytes  
Score: 25  
SHA256 short: 196561fb648afa32

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star, X } from "lucide-react";
import { Book } from "@/lib/types";
import { currency } from "@/lib/utils";

type BookCardProps = {
  book: Book;
};

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function truncateText(value: string, max = 160) {
  const clean = value.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}…`;
}

function Cover({
  title,
  coverUrl,
  compact = false,
}: {
  title: string;
  coverUrl?: string | null;
  compact?: boolean;
}) {
  const heightClass = compact ? "h-56" : "h-72";

  if (coverUrl) {
    return (
      <div
        className={`relative ${heightClass} overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-panel`}
      >
        <img
          src={coverUrl}
          alt={`Portada de ${title}`}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative ${heightClass} overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(220,38,38,0.12),transparent_30%),linear-gradient(145deg,#ffffff,#eff6ff)] p-6 shadow-panel`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(130deg,transparent,rgba(255,255,255,0.7),transparent)]" />
      <div className="relative flex h-full flex-col justify-between rounded-[22px] border border-slate-200 bg-white/85 p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-accent-700">
          BestSeller Edition
        </div>

        <div>
          <h3 className="font-display text-2xl font-bold leading-tight text-brand-800">
            {title}
          </h3>
        </div>
      </div>
    </div>
  );
}

function PreviewSection({
  title,
  content,
}: {
  title: string;
  content: string | null;
}) {
  if (!content) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <div className="whitespace-pre-line leading-7 text-slate-700">
        {content}
      </div>
    </section>
  );
}

export function BookCard({ book }: BookCardProps) {
  const [showPreview, setShowPreview] = useState(false);

  const authorName = normalizeText(book.author?.name) || "Autor independiente";
  const coverUrl = normalizeText(book.cover_url);
  const sampleUrl = normalizeText(book.sample_url);

  const shortDescription =
    normalizeText(book.short_description) || "Sin resumen disponible.";

  const longDescription = normalizeText(book.long_description) || shortDescription;
  const introduction = normalizeText(book.introduction);
  const chapterOneExcerpt = normalizeText(book.chapter_one_excerpt);

  const formats = Array.isArray(book.formats)
    ? book.formats.filter(Boolean).map(String)
    : [];

  const rating =
    typeof book.rating === "number" ? Number(book.rating.toFixed(1)) : null;

  const reviewCount =
    typeof book.review_count === "number" ? book.review_count : 0;

  const price = typeof book.price === "number" ? book.price : null;
  const compareAtPrice =
    typeof book.compare_at_price === "number" ? book.compare_at_price : null;

  const cardSummary = useMemo(
    () => truncateText(shortDescription),
    [shortDescription]
  );

  const hasPreviewContent = Boolean(
    longDescription || introduction || chapterOneExcerpt || sampleUrl
  );

  useEffect(() => {
    if (!showPreview) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowPreview(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPreview]);

  return (
    <>
      <article className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-panel transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-glow">
        <Link href={`/catalog/${book.slug}`} className="group block">
          <div className="relative">
            <Cover title={book.title} coverUrl={coverUrl} />

            {book.badge ? (
              <span className="absolute left-4 top-4 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-700">
                {book.badge}
              </span>
            ) : null}
          </div>

          <div className="space-y-4 px-1 pt-5">
            <div>
              <p className="text-sm font-medium text-accent-700">{authorName}</p>

              <h3 className="mt-1 text-xl font-semibold text-brand-800">
                {book.title}
              </h3>

              <p className="mt-2 text-sm leading-7 text-slate-700">
                {cardSummary}
              </p>
            </div>

            {formats.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {formats.map((format, index) => (
                  <span
                    key={`${format}-${index}`}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {format}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </Link>

        <div className="mt-4 flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            {rating !== null ? (
              <>
                <Star className="h-4 w-4 fill-current text-accent-600" />
                <span>{rating}</span>
                <span className="text-slate-400">({reviewCount})</span>
              </>
            ) : (
              <span className="text-slate-400">Sin reseñas todavía</span>
            )}
          </div>

          <div className="text-right">
            {compareAtPrice !== null ? (
              <p className="text-xs text-slate-400 line-through">
                {currency(compareAtPrice)}
              </p>
            ) : null}

            <p className="text-lg font-bold text-slate-950">
              {price !== null ? currency(price) : "Consultar"}
            </p>
          </div>
        </div>

        <div className="mt-4 px-1">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            Ver resumen
          </button>
        </div>
      </article>

      {showPreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="absolute right-4 top-4 z-10 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
              aria-label="Cerrar muestra"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="grid max-h-[92vh] gap-0 overflow-y-auto md:grid-cols-[280px_1fr]">
              <aside className="border-b border-slate-200 p-6 md:border-b-0 md:border-r">
                <Cover title={book.title} coverUrl={coverUrl} compact />

                <div className="mt-5 space-y-2">
                  <p className="text-sm font-medium text-accent-700">
                    {authorName}
                  </p>

                  <h2 className="text-2xl font-bold text-brand-800">
                    {book.title}
                  </h2>

                  {formats.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {formats.map((format, index) => (
                        <span
                          key={`preview-${format}-${index}`}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {format}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </aside>

              <section className="space-y-6 p-6">
                <PreviewSection
                  title="Argumento completo"
                  content={longDescription}
                />

                <PreviewSection
                  title="Introducción completa"
                  content={introduction}
                />

                <PreviewSection
                  title="Primer capítulo completo"
                  content={chapterOneExcerpt}
                />

                {sampleUrl ? (
                  <section className="space-y-3">
                    <h3 className="text-base font-semibold text-slate-950">
                      Muestra del libro
                    </h3>

                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <iframe
                        src={sampleUrl}
                        title={`Muestra de ${book.title}`}
                        className="h-[60vh] w-full"
                      />
                    </div>
                  </section>
                ) : null}

                {!hasPreviewContent ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Este libro todavía no tiene contenido de muestra suficiente.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPreview(false)}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cerrar
                  </button>

                  <Link
                    href={`/catalog/${book.slug}`}
                    className="rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-700"
                  >
                    Abrir libro completo
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
```

### components/dashboard/books/new/page.tsx

Size: 1266 bytes  
Score: 70  
SHA256 short: 67d86795e8941d4f

```tsx
<div className="grid gap-5">
  <label className="space-y-2 text-sm text-slate-800">
    <span>Introducción</span>
    <textarea
      name="introduction"
      rows={6}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-200"
      placeholder="Pega aquí la introducción del libro"
    />
  </label>

  <label className="space-y-2 text-sm text-slate-800">
    <span>Primer capítulo / extracto</span>
    <textarea
      name="chapter_one_excerpt"
      rows={10}
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-200"
      placeholder="Pega aquí el capítulo 1 o un extracto"
    />
  </label>

  <label className="space-y-2 text-sm text-slate-800">
    <span>URL de muestra PDF (opcional)</span>
    <input
      name="sample_url"
      type="url"
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-200"
      placeholder="https://..."
    />
  </label>
</div>
```

### components/dashboard/PublishedBookCard.tsx

Size: 2185 bytes  
Score: 35  
SHA256 short: 521384a412586e4f

```tsx
import Link from "next/link";

type PublishedBookCardProps = {
  book: {
    id: string;
    title: string;
    slug: string;
    cover_url: string | null;
    status: string;
  };
};

export default function PublishedBookCard({
  book,
}: PublishedBookCardProps) {
  return (
    <article className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Sin portada
          </div>
        )}

        <div className="absolute left-3 top-3">
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow">
            {book.status}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h3 className="line-clamp-2 text-lg font-bold text-slate-900">
            {book.title}
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Publicado y listo para gestión desde tu panel.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/catalog/${book.slug}`}
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Ver libro
          </Link>

          <Link
            href={`/dashboard/books/${book.id}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Administrar
          </Link>
        </div>
      </div>
    </article>
  );
}
```

### components/debug/BookProbe.tsx

Size: 3895 bytes  
Score: 25  
SHA256 short: 97badec2dffff5db

```tsx
"use client";

import { useEffect, useState } from "react";

type ProbeResult = {
  slug: string;
  title: string;
  coverUrl: string | null;
  pageUrl: string;
  usingNextImageGuess: boolean;
  head?: {
    ok: boolean;
    status: number;
    contentType: string | null;
    contentLength: string | null;
  };
  image?: {
    loaded: boolean;
    naturalWidth: number;
    naturalHeight: number;
    currentSrc: string;
  };
  errors: string[];
};

export default function BookProbe({
  slug,
  title,
  coverUrl,
}: {
  slug: string;
  title: string;
  coverUrl: string | null;
}) {
  const [result, setResult] = useState<ProbeResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function runProbe() {
      const nextResult: ProbeResult = {
        slug,
        title,
        coverUrl,
        pageUrl: window.location.href,
        usingNextImageGuess: !!document.querySelector('img[src*="_next/image"]'),
        errors: [],
      };

      if (!coverUrl) {
        nextResult.errors.push("El libro no tiene coverUrl.");
        if (!cancelled) setResult(nextResult);
        console.log("BOOK PROBE", nextResult);
        return;
      }

      try {
        const res = await fetch(coverUrl, {
          method: "HEAD",
          cache: "no-store",
        });

        nextResult.head = {
          ok: res.ok,
          status: res.status,
          contentType: res.headers.get("content-type"),
          contentLength: res.headers.get("content-length"),
        };
      } catch (error) {
        nextResult.errors.push(
          `HEAD falló: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      try {
        const imageInfo = await new Promise<ProbeResult["image"]>((resolve, reject) => {
          const img = new window.Image();

          img.onload = () => {
            resolve({
              loaded: true,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              currentSrc: img.currentSrc,
            });
          };

          img.onerror = () => {
            reject(new Error("El navegador disparó onerror al cargar la imagen."));
          };

          const separator = coverUrl.includes("?") ? "&" : "?";
          img.src = `${coverUrl}${separator}probe=${Date.now()}`;
        });

        nextResult.image = imageInfo;
      } catch (error) {
        nextResult.errors.push(
          `Image load falló: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      if (!cancelled) {
        setResult(nextResult);
      }

      console.log("BOOK PROBE", nextResult);
    }

    runProbe();

    return () => {
      cancelled = true;
    };
  }, [slug, title, coverUrl]);

  return (
    <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="font-semibold text-amber-900">BookProbe</p>

      <p className="mt-1 text-sm text-amber-900">
        Revisa este bloque y también la consola con <code>BOOK PROBE</code>.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {coverUrl ? (
          <a
            href={coverUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-black px-3 py-2 text-sm text-white"
          >
            Abrir portada directa
          </a>
        ) : null}

        <button
          type="button"
          onClick={() => console.log("BOOK PROBE STATE", result)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          Log otra vez
        </button>
      </div>

      <pre className="mt-4 overflow-x-auto rounded-xl bg-white p-4 text-xs">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}
```

### components/forms/auth-form.tsx

Size: 3126 bytes  
Score: 25  
SHA256 short: cd63264ccc4d98fa

```tsx
"use client";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
export function AuthForm() { const supabase = useMemo(() => createClient(), []); const [mode, setMode] = useState<"login" | "register">("login"); const [message, setMessage] = useState<string | null>(null); const [loading, setLoading] = useState(false); async function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!supabase) { setMessage("Conecta Supabase para activar autenticación real."); return; } const formData = new FormData(event.currentTarget); const email = String(formData.get("email") || ""); const password = [REDACTED]password") || ""); const full_name = String(formData.get("full_name") || ""); setLoading(true); if (mode === "register") { const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name } } }); setLoading(false); setMessage(error ? error.message : "Cuenta creada. Revisa tu correo si tienes confirmación activada."); return; } const { error } = await supabase.auth.signInWithPassword({ email, password }); setLoading(false); setMessage(error ? error.message : "Sesión iniciada. Ya puedes entrar al dashboard."); } return <div className="editorial-panel rounded-[32px] p-6"><div className="mb-6 flex gap-2 rounded-full border border-slate-200 bg-slate-50 p-1"><button type="button" onClick={() => setMode("login")} className={mode === "login" ? "flex-1 rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white" : "flex-1 rounded-full px-4 py-2 text-sm text-slate-600"}>Entrar</button><button type="button" onClick={() => setMode("register")} className={mode === "register" ? "flex-1 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white" : "flex-1 rounded-full px-4 py-2 text-sm text-slate-600"}>Crear cuenta</button></div><form onSubmit={handleSubmit} className="space-y-5">{mode === "register" ? <label className="block space-y-2 text-sm text-slate-800"><span>Nombre completo</span><input name="full_name" required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60" /></label> : null}<label className="block space-y-2 text-sm text-slate-800"><span>Email</span><input type="email" name="email" required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60" /></label><label className="block space-y-2 text-sm text-slate-800"><span>Contraseña</span><input type="password" name="password" required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60" /></label><button disabled={loading} className="rounded-full bg-accent-600 px-5 py-3 font-semibold text-white transition hover:scale-[1.01] hover:bg-accent-700 disabled:opacity-60">{loading ? "Procesando..." : mode === "login" ? "Entrar ahora" : "Crear cuenta"}</button>{message ? <p className="text-sm text-accent-700">{message}</p> : null}</form></div>; }

```

### components/forms/checkout-form.tsx

Size: 3841 bytes  
Score: 25  
SHA256 short: 8b7ca6bb7b492535

```tsx
"use client";
import { FormEvent, useMemo, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { createClient } from "@/lib/supabase/client";
import { currency } from "@/lib/utils";
export function CheckoutForm() { const { items, total, clearCart } = useCart(); const supabase = useMemo(() => createClient(), []); const [loading, setLoading] = useState(false); const [message, setMessage] = useState<string | null>(null); async function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!items.length) { setMessage("Tu carrito está vacío. No hagamos teatro."); return; } if (!supabase) { setMessage("Conecta Supabase para registrar pedidos reales."); return; } const formData = new FormData(event.currentTarget); setLoading(true); const { data: order, error } = await supabase.from("orders").insert({ email: formData.get("email"), status: "pending", subtotal: total, total, payment_provider: process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || "manual", shipping_address: { full_name: formData.get("full_name"), phone: formData.get("phone"), address: formData.get("address"), city: formData.get("city"), country: formData.get("country") } }).select("id").single(); if (error || !order) { setLoading(false); setMessage(error?.message || "No se pudo crear el pedido."); return; } const itemsResult = await supabase.from("order_items").insert(items.map((item) => ({ order_id: order.id, book_id: item.id, format: item.format, quantity: item.quantity, unit_price: item.price }))); setLoading(false); if (itemsResult.error) { setMessage(itemsResult.error.message); return; } clearCart(); (event.currentTarget as HTMLFormElement).reset(); setMessage(`Pedido creado por ${currency(total)}. Conecta tu pasarela y ya tienes la máquina lista.`); } return <form onSubmit={handleSubmit} className="editorial-panel space-y-5 rounded-[32px] p-6"><div className="grid gap-5 md:grid-cols-2"><label className="space-y-2 text-sm text-slate-800"><span>Nombre completo</span><input name="full_name" required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60" /></label><label className="space-y-2 text-sm text-slate-800"><span>Email</span><input type="email" name="email" required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60" /></label></div><div className="grid gap-5 md:grid-cols-2"><label className="space-y-2 text-sm text-slate-800"><span>Teléfono</span><input name="phone" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60" /></label><label className="space-y-2 text-sm text-slate-800"><span>Ciudad</span><input name="city" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60" /></label></div><label className="block space-y-2 text-sm text-slate-800"><span>Dirección</span><input name="address" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60" /></label><label className="block space-y-2 text-sm text-slate-800"><span>País</span><input name="country" defaultValue="República Dominicana" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60" /></label><button disabled={loading} className="rounded-full bg-accent-600 px-5 py-3 font-semibold text-white transition hover:scale-[1.01] hover:bg-accent-700 disabled:opacity-60">{loading ? "Creando pedido..." : "Confirmar pedido"}</button>{message ? <p className="text-sm text-accent-700">{message}</p> : null}</form>; }

```

### lib/book-preview-runner.ts

Size: 2927 bytes  
Score: 30  
SHA256 short: 1c64c3bec7b0653b

```ts
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);
const WORKER_FILE = path.join(process.cwd(), "scripts", "extract-book-preview.mjs");
const TEMP_DIR = path.join(tmpdir(), "bestseller-preview");
const MAX_STDOUT_BUFFER = 10 * 1024 * 1024;

export type ExtractedBookPreview = {
  argument: string | null;
  introduction: string | null;
  chapterOne: string | null;
  source: "pdf" | "epub" | "unsupported";
};

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function emptyPreview(): ExtractedBookPreview {
  return {
    argument: null,
    introduction: null,
    chapterOne: null,
    source: "unsupported",
  };
}

function normalizeNullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeSource(value: unknown): ExtractedBookPreview["source"] {
  return value === "pdf" || value === "epub" || value === "unsupported"
    ? value
    : "unsupported";
}

function safePreview(value: unknown): ExtractedBookPreview {
  if (!value || typeof value !== "object") {
    return emptyPreview();
  }

  const candidate = value as Partial<ExtractedBookPreview>;

  return {
    argument: normalizeNullableText(candidate.argument),
    introduction: normalizeNullableText(candidate.introduction),
    chapterOne: normalizeNullableText(candidate.chapterOne),
    source: normalizeSource(candidate.source),
  };
}

async function writeTempFile(file: File): Promise<string> {
  const extension = getExtension(file.name) || "bin";
  const tempFilePath = path.join(TEMP_DIR, `${randomUUID()}.${extension}`);
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(TEMP_DIR, { recursive: true });
  await writeFile(tempFilePath, buffer);

  return tempFilePath;
}

async function runPreviewWorker(filePath: string): Promise<ExtractedBookPreview> {
  const { stdout } = await execFileAsync(process.execPath, [WORKER_FILE, filePath], {
    maxBuffer: MAX_STDOUT_BUFFER,
  });

  return safePreview(JSON.parse(stdout));
}

export async function extractPreviewWithWorker(
  file: File
): Promise<ExtractedBookPreview> {
  let tempFilePath: string | null = null;

  try {
    tempFilePath = await writeTempFile(file);
    return await runPreviewWorker(tempFilePath);
  } catch (error) {
    console.error("Error ejecutando worker de preview:", error);
    return emptyPreview();
  } finally {
    if (tempFilePath) {
      await rm(tempFilePath, { force: true }).catch(() => {});
    }
  }
}
```

### lib/book-preview.ts

Size: 8245 bytes  
Score: 30  
SHA256 short: 0b0be84cc54792cd

```ts
const PREVIEW_PAGE_SCAN_LIMIT = 40;
const MAX_ARGUMENT_CHARS = 4000;
const MAX_SECTION_CHARS = 120000;

export type ExtractedBookPreview = {
  argument: string | null;
  introduction: string | null;
  chapterOne: string | null;
  source: "pdf" | "epub" | "unsupported";
};

type PdfJsModule = {
  getDocument: (options: Record<string, unknown>) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{
          items: Array<{ str?: string }>;
        }>;
        cleanup: () => void;
      }>;
      destroy: () => Promise<void> | void;
    }>;
  };
};

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

async function detectFileKind(
  file: File
): Promise<"pdf" | "epub" | "unsupported"> {
  const fileName = typeof file.name === "string" ? file.name.trim() : "";
  const ext = getExtension(fileName);
  const mime =
    typeof file.type === "string" ? file.type.toLowerCase().trim() : "";

  let header = "";
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    header = Array.from(head)
      .map((byte) => String.fromCharCode(byte))
      .join("");
  } catch {
    header = "";
  }

  if (header === "%PDF-" || ext === "pdf" || mime === "application/pdf") {
    return "pdf";
  }

  if (ext === "epub" || mime === "application/epub+zip") {
    return "epub";
  }

  return "unsupported";
}

async function loadPdfJs(): Promise<PdfJsModule> {
  return (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfJsModule;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanExtractedText(value: string | null | undefined): string | null {
  if (!value) return null;

  const cleaned = value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

function clampText(value: string | null, max: number): string | null {
  if (!value) return null;
  if (value.length <= max) return value;
  return value.slice(0, max).trimEnd();
}

function hasArgumentMarker(text: string): boolean {
  const normalized = normalizeSearchText(text);

  return (
    /\bargumento\b/.test(normalized) ||
    /\bargumentos\b/.test(normalized) ||
    /\bsinopsis\b/.test(normalized) ||
    /\bresumen\b/.test(normalized)
  );
}

function hasIntroductionMarker(text: string): boolean {
  const normalized = normalizeSearchText(text);

  return (
    /\bintroduccion\b/.test(normalized) ||
    /\bintroduction\b/.test(normalized)
  );
}

function hasChapterOneMarker(text: string): boolean {
  const normalized = normalizeSearchText(text);

  return (
    /\bcapitulo\s*1\b/.test(normalized) ||
    /\bcapitulo\s*i\b/.test(normalized) ||
    /\bchapter\s*1\b/.test(normalized) ||
    /\bchapter\s*i\b/.test(normalized)
  );
}

function hasChapterTwoMarker(text: string): boolean {
  const normalized = normalizeSearchText(text);

  return (
    /\bcapitulo\s*2\b/.test(normalized) ||
    /\bcapitulo\s*ii\b/.test(normalized) ||
    /\bchapter\s*2\b/.test(normalized) ||
    /\bchapter\s*ii\b/.test(normalized)
  );
}

function joinPageRange(
  pages: Array<{ text: string }>,
  startIndex: number,
  endExclusive: number
): string | null {
  if (startIndex < 0 || startIndex >= pages.length) return null;
  if (endExclusive <= startIndex) return null;

  return cleanExtractedText(
    pages
      .slice(startIndex, Math.min(endExclusive, pages.length))
      .map((page) => page.text)
      .join("\n\n")
  );
}

function findFirstNonTrivialPage(
  pages: Array<{ searchable: string }>
): number {
  return pages.findIndex((page) => page.searchable.length > 80);
}

function buildAutoArgument(
  pages: Array<{ text: string; searchable: string }>,
  introStart: number,
  chapterOneStart: number
): string | null {
  const firstContentPage = findFirstNonTrivialPage(pages);
  const startIndex = firstContentPage >= 0 ? firstContentPage : 0;

  const endIndex =
    introStart > startIndex
      ? introStart
      : chapterOneStart > startIndex
        ? chapterOneStart
        : Math.min(pages.length, startIndex + 2);

  return clampText(joinPageRange(pages, startIndex, endIndex), MAX_ARGUMENT_CHARS);
}

async function extractPdfPreview(file: File): Promise<ExtractedBookPreview> {
  const pdfjs = await loadPdfJs();
  const bytes = new Uint8Array(await file.arrayBuffer());

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const pages: Array<{ text: string; searchable: string }> = [];

  try {
    const maxPages = Math.min(pdfDoc.numPages, PREVIEW_PAGE_SCAN_LIMIT);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await pdfDoc.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) =>
          "str" in item && typeof item.str === "string" ? item.str : ""
        )
        .join(" ");

      page.cleanup();

      const cleaned = cleanExtractedText(pageText) || "";

      pages.push({
        text: cleaned,
        searchable: normalizeSearchText(cleaned),
      });
    }
  } finally {
    try {
      await pdfDoc.destroy();
    } catch {
      // noop
    }
  }

  if (pages.length === 0) {
    return {
      argument: null,
      introduction: null,
      chapterOne: null,
      source: "pdf",
    };
  }

  const argumentStart = pages.findIndex((page) =>
    hasArgumentMarker(page.searchable)
  );

  const introductionStart = pages.findIndex((page) =>
    hasIntroductionMarker(page.searchable)
  );

  const chapterOneStart = pages.findIndex((page) =>
    hasChapterOneMarker(page.searchable)
  );

  const chapterTwoStart =
    chapterOneStart >= 0
      ? pages.findIndex(
          (page, index) =>
            index > chapterOneStart && hasChapterTwoMarker(page.searchable)
        )
      : -1;

  const argument =
    argumentStart >= 0
      ? clampText(
          joinPageRange(
            pages,
            argumentStart,
            introductionStart > argumentStart
              ? introductionStart
              : chapterOneStart > argumentStart
                ? chapterOneStart
                : pages.length
          ),
          MAX_SECTION_CHARS
        )
      : buildAutoArgument(pages, introductionStart, chapterOneStart);

  const introduction =
    introductionStart >= 0
      ? clampText(
          joinPageRange(
            pages,
            introductionStart,
            chapterOneStart > introductionStart ? chapterOneStart : pages.length
          ),
          MAX_SECTION_CHARS
        )
      : null;

  const chapterOne =
    chapterOneStart >= 0
      ? clampText(
          joinPageRange(
            pages,
            chapterOneStart,
            chapterTwoStart > chapterOneStart ? chapterTwoStart : pages.length
          ),
          MAX_SECTION_CHARS
        )
      : null;

  return {
    argument,
    introduction,
    chapterOne,
    source: "pdf",
  };
}

async function extractEpubPreview(_file: File): Promise<ExtractedBookPreview> {
  return {
    argument: null,
    introduction: null,
    chapterOne: null,
    source: "epub",
  };
}

export async function extractBookPreviewFromFile(
  file: File
): Promise<ExtractedBookPreview> {
  const kind = await detectFileKind(file);

  if (kind === "pdf") {
    return extractPdfPreview(file);
  }

  if (kind === "epub") {
    return extractEpubPreview(file);
  }

  return {
    argument: null,
    introduction: null,
    chapterOne: null,
    source: "unsupported",
  };
}
```

### lib/data.ts

Size: 4171 bytes  
Score: 20  
SHA256 short: 3822667672b377c4

```ts
import { Book } from "@/lib/types";
export const sampleBooks: Book[] = [
  { id: "book-1", author_id: "author-1", slug: "escribe-vende-escala", title: "Escribe, Vende, Escala", subtitle: "Sistema moderno para autores que quieren negocio, no solo aplausos", short_description: "Manual táctico para publicar, vender y crecer una marca editorial desde Latinoamérica.", description: "Una guía práctica para autores que quieren convertir su libro en un activo comercial. Incluye posicionamiento, validación, funnel, afiliados y estructura de lanzamiento.", excerpt: "Tu libro no es solo contenido: es producto, autoridad y canal de adquisición.", price: 24.9, compare_at_price: 39.9, rating: 4.9, review_count: 128, page_count: 244, language: "Español", isbn: "978-99999-000-01", formats: ["print", "ebook", "reader", "kindle"], categories: ["Negocios", "Marketing", "Autores"], badge: "Top seller", is_featured: true, publication_date: "2026-01-18", author: { id: "author-1", name: "Valeria Montes", slug: "valeria-montes", headline: "Editora estratégica y consultora de lanzamientos", bio: "Ayuda a autores y marcas personales a construir productos editoriales rentables." } },
  { id: "book-2", author_id: "author-2", slug: "marca-de-autor-360", title: "Marca de Autor 360", subtitle: "Cómo verte premium aunque estés empezando", short_description: "Branding, oferta, narrativa y presencia para autores con hambre de posicionamiento.", description: "Un framework claro para convertir un manuscrito en una marca editorial atractiva. Incluye identidad, página de autor, ventas directas y contenido para redes.", excerpt: "La portada atrae. La promesa vende. El sistema retiene.", price: 19.9, compare_at_price: 29.9, rating: 4.8, review_count: 92, page_count: 196, language: "Español", isbn: "978-99999-000-02", formats: ["print", "ebook", "reader"], categories: ["Branding", "Marketing", "Creatividad"], badge: "Nuevo", is_featured: true, publication_date: "2026-02-02", author: { id: "author-2", name: "Adrián Vega", slug: "adrian-vega", headline: "Estratega de marca y storytelling", bio: "Combina diseño, posicionamiento y ventas para autores independientes." } },
  { id: "book-3", author_id: "author-3", slug: "funnels-para-libros", title: "Funnels para Libros", subtitle: "De lector curioso a cliente recurrente", short_description: "Embudo, checkout, automatizaciones y ofertas que convierten sin sonar desesperado.", description: "Ideal para autores, editoriales pequeñas y vendedores afiliados. Incluye secuencias, lead magnets, bundles y activación de referidos.", excerpt: "No necesitas más tráfico. Necesitas mejor diseño comercial.", price: 29.9, compare_at_price: 44.9, rating: 4.7, review_count: 74, page_count: 318, language: "Español", isbn: "978-99999-000-03", formats: ["print", "ebook", "reader", "kindle"], categories: ["Ventas", "Automatización", "Negocios"], badge: "Afiliable", is_featured: false, publication_date: "2025-11-14", author: { id: "author-3", name: "Noelia Rojas", slug: "noelia-rojas", headline: "Growth marketer para infoproductos y publicaciones", bio: "Diseña sistemas de venta directa y programas de afiliados para marcas de contenido." } },
  { id: "book-4", author_id: "author-4", slug: "biblioteca-digital-premium", title: "Biblioteca Digital Premium", subtitle: "Experiencia de lectura que engancha y retiene", short_description: "Crea una experiencia digital memorable para tus lectores y miembros.", description: "Aborda UX de lectura, suscripciones, bibliotecas privadas, notas, progreso y activación de comunidad para plataformas editoriales.", excerpt: "Leer en pantalla no tiene que sentirse barato.", price: 17.9, compare_at_price: 27.0, rating: 4.6, review_count: 51, page_count: 162, language: "Español", isbn: "978-99999-000-04", formats: ["ebook", "reader"], categories: ["UX", "Producto digital", "Lectura"], badge: "Digital", is_featured: false, publication_date: "2025-10-10", author: { id: "author-4", name: "Samuel Báez", slug: "samuel-baez", headline: "Product designer enfocado en plataformas de contenidos", bio: "Ayuda a negocios editoriales a elevar su experiencia digital." } }
];

```

### lib/queries.ts

Size: 4011 bytes  
Score: 20  
SHA256 short: 08f25aac417ee597

```ts
import { cache } from "react";
import { Book, BookStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

const BOOK_SELECT = `
  id,
  author_id,
  title,
  subtitle,
  slug,
  description_short,
  description_long,
  introduction,
  chapter_one_excerpt,
  sample_url,
  cover_url,
  status,
  featured,
  language_code,
  isbn_13,
  page_count,
  publication_date,
  created_at,
  updated_at
`;

type BookRow = {
  id: string;
  author_id: string | null;
  title: string;
  subtitle?: string | null;
  slug: string;
  description_short?: string | null;
  description_long?: string | null;
  introduction?: string | null;
  chapter_one_excerpt?: string | null;
  sample_url?: string | null;
  cover_url?: string | null;
  status?: string | null;
  featured?: boolean | null;
  language_code?: string | null;
  isbn_13?: string | null;
  page_count?: number | null;
  publication_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeStatus(value: unknown): BookStatus | null {
  const normalized = normalizeText(value);

  if (
    normalized === "draft" ||
    normalized === "published" ||
    normalized === "archived"
  ) {
    return normalized;
  }

  return null;
}

function normalizeBook(row: BookRow): Book {
  const longDescription = normalizeText(row.description_long);

  const shortDescription =
    normalizeText(row.description_short) ||
    longDescription ||
    "Sin resumen disponible.";

  return {
    id: row.id,
    author_id: row.author_id ?? "",
    slug: row.slug,
    title: row.title,
    subtitle: normalizeText(row.subtitle),

    short_description: shortDescription,
    long_description: longDescription,
    introduction: normalizeText(row.introduction),
    chapter_one_excerpt: normalizeText(row.chapter_one_excerpt),
    sample_url: normalizeText(row.sample_url),

    cover_url: normalizeText(row.cover_url),
    status: normalizeStatus(row.status),
    is_featured: Boolean(row.featured),

    language: normalizeText(row.language_code),
    isbn: normalizeText(row.isbn_13),
    page_count: typeof row.page_count === "number" ? row.page_count : null,
    publication_date: row.publication_date ?? null,

    price: null,
    compare_at_price: null,
    currency: null,
    rating: null,
    review_count: 0,
    formats: [],
    categories: [],
    badge: null,
    kindle_url: null,

    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,

    author: null,
  };
}

export const getBooks = cache(async (): Promise<Book[]> => {
  const supabase = await createClient();

  if (!supabase) {
    console.error("GETBOOKS: Supabase client no disponible");
    return [];
  }

  const { data, error } = await supabase
    .from("books")
    .select(BOOK_SELECT)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GETBOOKS ERROR:", error.message);
    return [];
  }

  return ((data ?? []) as BookRow[]).map(normalizeBook);
});

export const getFeaturedBooks = cache(async (): Promise<Book[]> => {
  const books = await getBooks();
  return books.filter((book) => book.is_featured).slice(0, 3);
});

export const getBookBySlug = cache(async (slug: string): Promise<Book | null> => {
  const supabase = await createClient();

  if (!supabase) {
    console.error("GETBOOKBYSLUG: Supabase client no disponible");
    return null;
  }

  const { data, error } = await supabase
    .from("books")
    .select(BOOK_SELECT)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("GETBOOKBYSLUG ERROR:", error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  return normalizeBook(data as BookRow);
});

export const getBookCategories = cache(async (): Promise<string[]> => {
  return [];
});
```

### lib/supabase-browser.ts

Size: 258 bytes  
Score: 20  
SHA256 short: 30dd784eaf41b7d7

```ts
// lib/supabase-browser.ts
import { createClient } from "@supabase/supabase-js";

export function createBrowserSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

### lib/supabase/admin.ts

Size: 772 bytes  
Score: 20  
SHA256 short: 0ffba4ee27f6547e

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("SUPABASE DEBUG", {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: !!process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: [REDACTED],
    persistSession: false,
  },
});
```

### lib/supabase/browser-client.ts

Size: 362 bytes  
Score: 20  
SHA256 short: b840eefeb585f06a

```ts
"use client";

import { createClient } from "@/lib/supabase/client";

type BrowserSupabaseClient = ReturnType<typeof createClient>;

let browserClient: BrowserSupabaseClient | null = null;

export function getBrowserSupabaseClient(): BrowserSupabaseClient {
  if (!browserClient) {
    browserClient = createClient();
  }

  return browserClient;
}
```

### lib/supabase/client.ts

Size: 352 bytes  
Score: 20  
SHA256 short: 2a065066b91d92e3

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  return client;
}
```

### lib/supabase/config.ts

Size: 207 bytes  
Score: 20  
SHA256 short: 3eb3ec65ce10e2f3

```ts
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);

```

### lib/supabase/server.ts

Size: 699 bytes  
Score: 20  
SHA256 short: e02e6f6fc999f1ec

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // En algunos Server Components esto puede lanzar.
          }
        },
      },
    }
  );
}
```

### lib/types.ts

Size: 4554 bytes  
Score: 20  
SHA256 short: e615b2243539aece

```ts
export type Role = "customer" | "author" | "affiliate" | "admin";

export type BookFormat =
  | "print"
  | "ebook"
  | "audiobook"
  | "kindle_external";

export type BookStatus = "draft" | "published" | "archived";

export type AssetType = "cover" | "pdf" | "epub";

export type CurrencyCode = "DOP" | "USD" | string;

export interface Author {
  id: string;
  name: string;
  slug: string;
  headline?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
}

export interface BookBase {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  cover_url?: string | null;
  badge?: string | null;
  status?: BookStatus | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BookPricing {
  price?: number | null;
  compare_at_price?: number | null;
  currency?: CurrencyCode | null;
}

export interface BookStats {
  rating?: number | null;
  review_count?: number | null;
}

export interface BookMetadata {
  page_count?: number | null;
  language?: string | null;
  isbn?: string | null;
  publication_date?: string | null;
  formats?: BookFormat[];
  categories?: string[];
  kindle_url?: string | null;
  is_featured?: boolean | null;
}

export interface BookPreviewContent {
  short_description?: string | null;
  long_description?: string | null;
  excerpt?: string | null;
  introduction?: string | null;
  chapter_one_excerpt?: string | null;
  sample_url?: string | null;
}

export interface Book
  extends BookBase,
    BookPricing,
    BookStats,
    BookMetadata,
    BookPreviewContent {
  author_id: string;
  author?: Author | null;
}

export interface DashboardBook
  extends Pick<
    Book,
    "id" | "author_id" | "slug" | "title" | "cover_url" | "status" | "created_at"
  > {}

export interface CartItem {
  id: string;
  slug: string;
  title: string;
  authorName: string;
  price: number;
  format: BookFormat;
  cover_url?: string | null;
  quantity: number;
}

/**
 * DB MODELS
 * Estos representan la forma cruda de Supabase / Postgres.
 */

export interface DbBook {
  id: string;
  author_id: string | null;
  owner_user_id?: string | null;
  slug: string;
  title: string;
  subtitle?: string | null;
  description_short?: string | null;
  description_long?: string | null;
  summary?: string | null;
  introduction?: string | null;
  chapter_one_excerpt?: string | null;
  excerpt?: string | null;
  sample_url?: string | null;
  cover_url?: string | null;
  status?: BookStatus | null;
  featured?: boolean | null;
  language_code?: string | null;
  isbn_13?: string | null;
  page_count?: number | null;
  publication_date?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DbBookInsert {
  author_id: string;
  owner_user_id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  description_short?: string | null;
  description_long?: string | null;
  summary?: string | null;
  introduction?: string | null;
  chapter_one_excerpt?: string | null;
  excerpt?: string | null;
  sample_url?: string | null;
  cover_url?: string | null;
  status?: BookStatus;
  featured?: boolean;
  language_code?: string | null;
  isbn_13?: string | null;
  page_count?: number | null;
  publication_date?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface DbBookEdition {
  id: string;
  book_id: string;
  format: BookFormat | string;
  edition_name: string;
  price: number;
  currency: CurrencyCode;
  file_url?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
}

export interface DbBookEditionInsert {
  book_id: string;
  format: BookFormat | string;
  edition_name: string;
  price: number;
  currency: CurrencyCode;
  file_url?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
}

export interface DbBookAsset {
  id?: string;
  book_id: string;
  edition_id?: string | null;
  asset_type: AssetType;
  storage_bucket?: string | null;
  storage_path?: string | null;
  file_url?: string | null;
  mime_type?: string | null;
  is_public?: boolean | null;
  sort_order?: number | null;
}

export interface DbBookAssetInsert {
  book_id: string;
  edition_id?: string | null;
  asset_type: AssetType;
  storage_bucket?: string | null;
  storage_path?: string | null;
  file_url?: string | null;
  mime_type?: string | null;
  is_public?: boolean | null;
  sort_order?: number | null;
}
```

### lib/utils.ts

Size: 388 bytes  
Score: 20  
SHA256 short: eccb57e5ae1a5d81

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function currency(value: number, code = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || "USD") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(value);
}

```

### next.config.mjs

Size: 304 bytes  
Score: 100  
SHA256 short: d28da546f9952822

```mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kbfxtdtvusisxvlmglzp.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
```

### package.json

Size: 1373 bytes  
Score: 100  
SHA256 short: e0961d5bfc5c6c62

```json
{
  "name": "bestseller-platform",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "clean": "powershell -Command \"if (Test-Path .next) { Remove-Item -Recurse -Force .next }\"",
    "dev": "next dev",
    "dev:clean": "npm run clean && next dev",
    "build": "next build",
    "start": "next start",

    "verify:book-preview": "node scripts/verify-book-preview.cjs",
    "smoke:book-upload": "node scripts/smoke-test-book-upload.cjs",
    "test:book-preview-direct": "node scripts/test-book-preview-direct.mjs",
    "diagnose:catalog-route": "node scripts/diagnose-catalog-route.cjs",
    "check:parallel-routes": "node scripts/check-parallel-routes.cjs",
    "diagnose:routing": "node scripts/diagnose-routing.cjs",
    "audit:project": "node scripts/audit-project.mjs"
  },
  "dependencies": {
    "@prisma/client": "^7.6.0",
    "@supabase/ssr": "^0.10.0",
    "@supabase/supabase-js": "^2.101.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.511.0",
    "next": "14.2.35",
    "pdfjs-dist": "^5.6.205",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "@types/node": "^22.7.4",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "prisma": "^7.6.0",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2"
  }
}
```

### postcss.config.js

Size: 69 bytes  
Score: 100  
SHA256 short: fe0d5cf3cb8c1922

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };

```

### README.md

Size: 638 bytes  
Score: 110  
SHA256 short: 0967fe20f4af4e0d

```md
# BestSeller
Starter premium para una plataforma editorial y tienda de libros con Next.js + TypeScript + Tailwind + Supabase.

## Incluye
- Home moderna
- Catálogo y detalle de libro
- Carrito y checkout que guarda pedidos en Supabase
- Formularios para autores y afiliados
- Auth base con Supabase
- Dashboard demo
- SQL de schema + seed

## Pasos
1. `npm install`
2. Copia `.env.example` a `.env.local`
3. Ejecuta `supabase/schema.sql` y luego `supabase/seed.sql` en Supabase SQL Editor
4. `npm run dev`

## Nota
La pasarela de pago no viene conectada. El checkout guarda pedidos y deja el proyecto listo para integrar AZUL o CardNET.

```

### tailwind.config.ts

Size: 847 bytes  
Score: 100  
SHA256 short: d8e48c64efaa0502

```ts
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}","./components/**/*.{ts,tsx}","./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        fog: "#64748B",
        brand: { 50: "#EFF6FF", 100: "#DBEAFE", 200: "#BFDBFE", 300: "#93C5FD", 400: "#60A5FA", 500: "#2563EB", 700: "#1D4ED8", 800: "#1E3A8A" },
        accent: { 50: "#FEF2F2", 100: "#FEE2E2", 200: "#FECACA", 500: "#EF4444", 600: "#DC2626", 700: "#B91C1C" }
      },
      boxShadow: {
        glow: "0 22px 60px rgba(37, 99, 235, 0.16)",
        panel: "0 24px 80px rgba(15, 23, 42, 0.08)"
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
        display: ["ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;

```

### tsconfig.json

Size: 563 bytes  
Score: 100  
SHA256 short: f9231e4c2e6c7857

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}

```

