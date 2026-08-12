// ============================================
// ARCHIVO: app/dashboard/books/[id]/edit/EditBookForm.tsx
// ============================================

"use client";

/* eslint-disable @next/next/no-img-element */

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type BookForEdit = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  publisher_name: string | null;
  cover_url: string | null;
  status: string;
  description_short: string | null;
  description_long: string | null;
  introduction: string | null;
  chapter_one_excerpt: string | null;
  sample_url: string | null;
  primary_niche: string | null;
  primary_category: string | null;
  secondary_category: string | null;
  keywords: string[] | null;
  target_audience: string | null;
  reader_promise: string | null;
  sales_hook: string | null;
  comparable_books: string | null;
  meta_title: string | null;
  meta_description: string | null;
  marketing_angle: string | null;
  language_code: string | null;
  featured?: boolean | null;
  is_featured?: boolean | null;
};

type EditionForEdit = {
  id: string;
  edition_name: string | null;
  price: number | null;
  currency: string | null;
  paypal_price?: number | null;
  paypal_currency?: string | null;
  format: string | null;
  compare_at_price: number | null;
  page_count: number | null;
  isbn: string | null;
  affiliate_enabled: boolean | null;
  affiliate_commission_percentage: number | null;
  download_allowed: boolean | null;
};

type EditBookFormProps = {
  book: BookForEdit;
  edition: EditionForEdit | null;
};

type SubmitState = {
  type: "idle" | "success" | "error" | "info";
  message: string;
};

const NICHES = [
  "Negocios y emprendimiento",
  "Finanzas personales",
  "Marketing y ventas",
  "Desarrollo personal",
  "Espiritualidad",
  "Salud y bienestar",
  "Educación",
  "Tecnología",
  "Inteligencia artificial",
  "Ficción",
  "Romance",
  "Misterio / Thriller",
  "Biografía / Memorias",
  "Infantil / Juvenil",
  "Cristiano / Fe",
  "Historia",
  "Política y sociedad",
  "Periodismo",
  "Psicología",
  "Derecho",
  "Migración",
  "Académico / Profesional",
];

const CATEGORIES_BY_NICHE: Record<string, string[]> = {
  "Negocios y emprendimiento": [
    "Startups",
    "Liderazgo",
    "Productividad",
    "Gestión empresarial",
    "Marca personal",
    "Emprendimiento digital",
    "Negocios familiares",
    "Estrategia empresarial",
  ],
  "Finanzas personales": [
    "Inversión",
    "Ahorro",
    "Crédito",
    "Educación financiera",
    "Libertad financiera",
    "Presupuesto personal",
    "Deudas",
    "Riqueza",
  ],
  "Marketing y ventas": [
    "Ventas",
    "Copywriting",
    "Publicidad digital",
    "Redes sociales",
    "Embudo de ventas",
    "Marca personal",
    "Marketing de contenidos",
    "Ecommerce",
  ],
  "Desarrollo personal": [
    "Hábitos",
    "Mentalidad",
    "Motivación",
    "Disciplina",
    "Autoayuda",
    "Propósito",
    "Productividad personal",
    "Superación",
  ],
  Espiritualidad: [
    "Meditación",
    "Propósito",
    "Crecimiento espiritual",
    "Reflexiones",
    "Fe práctica",
    "Oración",
    "Vida interior",
  ],
  "Salud y bienestar": [
    "Nutrición",
    "Fitness",
    "Salud mental",
    "Bienestar integral",
    "Hábitos saludables",
    "Sueño",
    "Estrés",
  ],
  Educación: [
    "Métodos de estudio",
    "Docencia",
    "Aprendizaje",
    "Guías prácticas",
    "Formación profesional",
    "Educación digital",
    "Pedagogía",
  ],
  Tecnología: [
    "Programación",
    "Ciberseguridad",
    "Software",
    "Transformación digital",
    "Automatización",
    "SaaS",
    "Apps",
  ],
  "Inteligencia artificial": [
    "IA generativa",
    "Prompt engineering",
    "Automatización con IA",
    "Ética de la IA",
    "IA y sociedad",
    "IA para negocios",
    "IA educativa",
  ],
  Ficción: [
    "Drama",
    "Aventura",
    "Ciencia ficción",
    "Fantasía",
    "Realismo contemporáneo",
    "Cuento",
    "Novela corta",
  ],
  Romance: [
    "Romance contemporáneo",
    "Romance histórico",
    "Drama romántico",
    "Comedia romántica",
    "Romance juvenil",
    "Romance espiritual",
  ],
  "Misterio / Thriller": [
    "Suspenso",
    "Crimen",
    "Thriller psicológico",
    "Detectives",
    "Misterio paranormal",
    "Conspiración",
  ],
  "Biografía / Memorias": [
    "Historia personal",
    "Superación",
    "Testimonio",
    "Carrera profesional",
    "Legado familiar",
    "Memorias políticas",
  ],
  "Infantil / Juvenil": [
    "Cuentos infantiles",
    "Aventura juvenil",
    "Educativo infantil",
    "Valores",
    "Fantasía juvenil",
    "Lectura temprana",
  ],
  "Cristiano / Fe": [
    "Devocional",
    "Vida cristiana",
    "Testimonio",
    "Familia y fe",
    "Estudio bíblico",
    "Liderazgo cristiano",
    "Consejería cristiana",
  ],
  Historia: [
    "Historia dominicana",
    "Historia mundial",
    "Historia política",
    "Historia social",
    "Memoria histórica",
    "Biografías históricas",
  ],
  "Política y sociedad": [
    "Geopolítica",
    "Opinión política",
    "Ensayo social",
    "Gobierno",
    "Campañas electorales",
    "Liderazgo público",
  ],
  Periodismo: [
    "Historia del periodismo",
    "Libertad de expresión",
    "Crónica",
    "Investigación periodística",
    "Comunicación",
    "Medios digitales",
  ],
  Psicología: [
    "Conducta humana",
    "Relaciones",
    "Trauma",
    "Sueño",
    "Autoestima",
    "Psicología práctica",
  ],
  Derecho: [
    "Derecho migratorio",
    "Derecho civil",
    "Derecho laboral",
    "Derecho empresarial",
    "Guías legales",
    "Trámites",
  ],
  Migración: [
    "Visas",
    "Residencia",
    "Ciudadanía",
    "Asilo",
    "Reunificación familiar",
    "Guías migratorias",
  ],
  "Académico / Profesional": [
    "Manual técnico",
    "Investigación",
    "Administración",
    "Medicina",
    "Negocios",
    "Tesis",
    "Formación profesional",
  ],
};

const STATUSES = [
  { value: "draft", label: "Borrador" },
  { value: "under_review", label: "En evaluación" },
  { value: "changes_requested", label: "Cambios solicitados" },
  { value: "approved", label: "Aprobado" },
  { value: "published", label: "Publicado" },
  { value: "unlisted", label: "Oculto / solo con enlace" },
  { value: "archived", label: "Archivado" },
  { value: "rejected", label: "Rechazado" },
];

const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "pt", label: "Portugués" },
  { value: "fr", label: "Francés" },
];

const CURRENCIES = ["DOP", "USD", "EUR"];

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60";

const labelClassName = "space-y-2 text-sm font-medium text-slate-800";

const sectionClassName =
  "rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm";

const sectionTitleClassName =
  "mb-5 border-b border-slate-200 pb-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-500";

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseKeywords(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePrice(value: string) {
  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    return null;
  }

  return price;
}

function resolveFeatured(book: BookForEdit) {
  return Boolean(book.is_featured ?? book.featured ?? false);
}

function FieldHint({ children }: { children: ReactNode }) {
  return (
    <span className="block text-xs font-normal leading-5 text-slate-500">
      {children}
    </span>
  );
}

function CheckboxCard({
  name,
  title,
  text,
  defaultChecked,
  disabled,
}: {
  name: string;
  title: string;
  text: string;
  defaultChecked: boolean;
  disabled: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
      <input
        name={name}
        type="checkbox"
        value="true"
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-slate-300"
      />

      <input type="hidden" name={name} value="false" />

      <span>
        <strong className="block text-slate-900">{title}</strong>
        {text}
      </span>
    </label>
  );
}

function StatusMessage({ status }: { status: SubmitState }) {
  if (!status.message) return null;

  const className =
    status.type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : status.type === "info"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <p
      role="status"
      aria-live="polite"
      className={`rounded-2xl border p-4 text-sm ${className}`}
    >
      {status.message}
    </p>
  );
}

export default function EditBookForm({ book, edition }: EditBookFormProps) {
  const router = useRouter();

  const [selectedNiche, setSelectedNiche] = useState(book.primary_niche ?? "");
  const [selectedCategory, setSelectedCategory] = useState(
    book.primary_category ?? ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<SubmitState>({
    type: "idle",
    message: "",
  });

  const categoryOptions = useMemo(() => {
    return selectedNiche ? CATEGORIES_BY_NICHE[selectedNiche] ?? [] : [];
  }, [selectedNiche]);

  function validateForm(formData: FormData) {
    const title = readText(formData, "title");
    const description = readText(formData, "description");
    const primaryNiche = readText(formData, "primary_niche");
    const primaryCategory = readText(formData, "primary_category");
    const keywords = parseKeywords(readText(formData, "keywords"));
    const price = parsePrice(readText(formData, "price"));
    const paypalPriceText = readText(formData, "paypal_price");
    const compareAtPrice = readText(formData, "compare_at_price");
    const pageCount = readText(formData, "page_count");
    const affiliateCommission = readText(
      formData,
      "affiliate_commission_percentage"
    );

    if (!title) return "El título es obligatorio.";
    if (!description) return "La descripción larga es obligatoria.";

    if (!primaryNiche || !primaryCategory) {
      return "Selecciona nicho y categoría principal.";
    }

    if (keywords.length > 0 && keywords.length < 3) {
      return "Agrega mínimo 3 palabras clave o deja el campo vacío.";
    }

    if (price === null) return "El precio no es válido.";

    if (paypalPriceText) {
      const paypalPrice = parsePrice(paypalPriceText);
      if (paypalPrice === null || paypalPrice <= 0) {
        return "El precio PayPal en USD debe ser mayor que cero.";
      }
    }

    if (compareAtPrice && parsePrice(compareAtPrice) === null) {
      return "El precio anterior no es válido.";
    }

    if (pageCount) {
      const pages = Number(pageCount);

      if (!Number.isInteger(pages) || pages < 1) {
        return "El número de páginas no es válido.";
      }
    }

    if (affiliateCommission) {
      const commission = Number(affiliateCommission);

      if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
        return "La comisión de afiliado debe estar entre 0 y 100.";
      }
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const validationError = validateForm(formData);

    if (validationError) {
      setStatus({
        type: "error",
        message: validationError,
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({
      type: "info",
      message: "Guardando cambios de publicación...",
    });

    try {
      const response = await fetch(`/api/books/${encodeURIComponent(book.id)}`, {
        method: "PATCH",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus({
          type: "error",
          message: data.error || "No se pudo actualizar el libro.",
        });
        return;
      }

      setStatus({
        type: "success",
        message: data.message || "Datos de publicación actualizados.",
      });

      router.refresh();
    } catch (error) {
      console.error("Error actualizando libro:", error);

      setStatus({
        type: "error",
        message: "Ocurrió un error actualizando los datos de publicación.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
          Dashboard editorial
        </p>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Editar datos de publicación
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Modifica los datos que llenaste al subir el libro: título,
              categoría, precio, SEO, portada, EPUB completo y Preview automático.
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Slug público: <span className="font-semibold">{book.slug}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/catalog/${book.slug}`}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Ver público
            </Link>

            <Link
              href="/dashboard/books/published"
              className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Volver
            </Link>
          </div>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="space-y-6"
        noValidate
      >
        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Identidad del libro</h2>

          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Título *</span>
              <input
                name="title"
                type="text"
                defaultValue={book.title}
                required
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Subtítulo</span>
              <input
                name="subtitle"
                type="text"
                defaultValue={book.subtitle ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <label className={labelClassName}>
              <span>Estado editorial</span>
              <select
                name="status"
                defaultValue={book.status || "under_review"}
                disabled={isSubmitting}
                className={inputClassName}
              >
                {STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClassName}>
              <span>Idioma</span>
              <select
                name="language_code"
                defaultValue={book.language_code ?? "es"}
                disabled={isSubmitting}
                className={inputClassName}
              >
                {LANGUAGES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClassName}>
              <span>Nombre editorial / sello</span>
              <input
                name="publisher_name"
                type="text"
                defaultValue={book.publisher_name ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Categoría y descubrimiento</h2>

          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Nicho principal *</span>
              <select
                name="primary_niche"
                value={selectedNiche}
                onChange={(event) => {
                  setSelectedNiche(event.target.value);
                  setSelectedCategory("");
                }}
                disabled={isSubmitting}
                className={inputClassName}
              >
                <option value="">Selecciona un nicho</option>

                {NICHES.map((niche) => (
                  <option key={niche} value={niche}>
                    {niche}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClassName}>
              <span>Categoría principal *</span>
              <select
                name="primary_category"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                disabled={isSubmitting || !selectedNiche}
                className={inputClassName}
              >
                <option value="">
                  {selectedNiche
                    ? "Selecciona una categoría"
                    : "Elige nicho primero"}
                </option>

                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Subcategoría</span>
              <input
                name="secondary_category"
                defaultValue={book.secondary_category ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Palabras clave</span>
              <input
                name="keywords"
                defaultValue={(book.keywords ?? []).join(", ")}
                placeholder="disciplina, riqueza, hábitos, finanzas personales"
                disabled={isSubmitting}
                className={inputClassName}
              />
              <FieldHint>
                Mínimo 3 si las usas. Sepáralas por coma. Máximo recomendado:
                12.
              </FieldHint>
            </label>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Audiencia objetivo</span>
              <textarea
                name="target_audience"
                rows={4}
                defaultValue={book.target_audience ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Promesa al lector</span>
              <textarea
                name="reader_promise"
                rows={4}
                defaultValue={book.reader_promise ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Descripción comercial</h2>

          <label className={labelClassName}>
            <span>Descripción corta</span>
            <textarea
              name="description_short"
              rows={3}
              defaultValue={book.description_short ?? ""}
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>

          <label className={`${labelClassName} mt-5 block`}>
            <span>Descripción larga *</span>
            <textarea
              name="description"
              rows={8}
              defaultValue={book.description_long ?? ""}
              required
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Gancho de venta</span>
              <textarea
                name="sales_hook"
                rows={4}
                defaultValue={book.sales_hook ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Libros comparables</span>
              <textarea
                name="comparable_books"
                rows={4}
                defaultValue={book.comparable_books ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Preview / contenido</h2>

          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Introducción</span>
              <textarea
                name="introduction"
                rows={5}
                defaultValue={book.introduction ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Primer capítulo / extracto</span>
              <textarea
                name="chapter_one_excerpt"
                rows={5}
                defaultValue={book.chapter_one_excerpt ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>
          </div>

          <label className={`${labelClassName} mt-5 block`}>
            <span>URL de muestra externa</span>
            <input
              name="sample_url"
              type="url"
              defaultValue={book.sample_url ?? ""}
              placeholder="https://..."
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Precio y venta</h2>

          <div className="grid gap-5 md:grid-cols-3">
            <label className={labelClassName}>
              <span>Precio *</span>
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={edition?.price ?? 0}
                required
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Moneda</span>
              <select
                name="currency"
                defaultValue={edition?.currency ?? "DOP"}
                disabled={isSubmitting}
                className={inputClassName}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClassName}>
              <span>Precio anterior</span>
              <input
                name="compare_at_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={edition?.compare_at_price ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>
          </div>

          <div className="mt-5 rounded-3xl border-2 border-blue-200 bg-blue-50 p-5">
            <div className="grid gap-4 md:grid-cols-[1fr_180px] md:items-end">
              <label className={labelClassName}>
                <span>Precio PayPal (USD)</span>
                <input
                  name="paypal_price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={edition?.paypal_price ?? ""}
                  placeholder="19.99"
                  disabled={isSubmitting}
                  className={inputClassName}
                  inputMode="decimal"
                />
              </label>

              <label className={labelClassName}>
                <span>Moneda PayPal</span>
                <input
                  name="paypal_currency"
                  value="USD"
                  readOnly
                  className={`${inputClassName} bg-white font-black`}
                />
              </label>
            </div>

            <p className="mt-3 text-xs leading-5 text-blue-900">
              Escribe el importe real que PayPal cobrará. No copies el precio
              en DOP ni cambies solamente el símbolo.
            </p>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <label className={labelClassName}>
              <span>Formato principal</span>
              <select
                name="format"
                defaultValue={edition?.format ?? "ebook"}
                disabled={isSubmitting}
                className={inputClassName}
              >
                <option value="ebook">Ebook / EPUB</option>
                <option value="print">Impreso</option>
                <option value="audiobook">Audiolibro</option>
                <option value="bundle">Bundle</option>
              </select>
            </label>

            <label className={labelClassName}>
              <span>Páginas aproximadas</span>
              <input
                name="page_count"
                type="number"
                min="1"
                defaultValue={edition?.page_count ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>ISBN</span>
              <input
                name="isbn"
                defaultValue={edition?.isbn ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <label className={labelClassName}>
              <span>Comisión afiliado %</span>
              <input
                name="affiliate_commission_percentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={edition?.affiliate_commission_percentage ?? ""}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
              <CheckboxCard
                name="affiliate_enabled"
                title="Activar afiliados"
                text="Permite comisión por recomendación."
                defaultChecked={Boolean(edition?.affiliate_enabled)}
                disabled={isSubmitting}
              />

              <CheckboxCard
                name="is_featured"
                title="Destacar en catálogo"
                text="Mejor visibilidad en listados."
                defaultChecked={resolveFeatured(book)}
                disabled={isSubmitting}
              />

              <CheckboxCard
                name="download_allowed"
                title="Permitir descarga"
                text="Úsalo solo si quieres entregar el archivo."
                defaultChecked={Boolean(edition?.download_allowed)}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>SEO y marketing</h2>

          <label className={labelClassName}>
            <span>Meta title</span>
            <input
              name="meta_title"
              defaultValue={book.meta_title ?? ""}
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>

          <label className={`${labelClassName} mt-5 block`}>
            <span>Meta description</span>
            <textarea
              name="meta_description"
              rows={3}
              defaultValue={book.meta_description ?? ""}
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>

          <label className={`${labelClassName} mt-5 block`}>
            <span>Ángulo de marketing</span>
            <textarea
              name="marketing_angle"
              rows={4}
              defaultValue={book.marketing_angle ?? ""}
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Archivos EPUB</h2>

          {book.cover_url ? (
            <div className="mb-5">
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Portada actual
              </p>

              <img
                src={book.cover_url}
                alt={book.title}
                className="max-w-[180px] rounded-2xl border border-slate-200"
              />
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-3">
            <label className={labelClassName}>
              <span>Cambiar portada</span>
              <input
                name="cover"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={isSubmitting}
                className={inputClassName}
              />
              <FieldHint>JPG, PNG o WebP. Máximo 10 MB.</FieldHint>
            </label>

            <label className={labelClassName}>
              <span>Cambiar PDF principal</span>
              <input
                name="manuscript_pdf"
                type="file"
                accept="application/pdf,.pdf"
                disabled={isSubmitting}
                className={inputClassName}
              />
              <FieldHint>Archivo completo. Solo dueño o comprador.</FieldHint>
            </label>
          </div>

          <label className={`${labelClassName} mt-5 block`}>
            <span>Nota del cambio</span>
            <textarea
              name="change_note"
              rows={3}
              placeholder="Ej: actualicé portada, corregí metadata, subí nuevo Preview automático..."
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-black px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </button>

          <Link
            href="/dashboard/books/published"
            className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>

        <StatusMessage status={status} />
      </form>
    </main>
  );
}


