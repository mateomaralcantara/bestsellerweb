"use client";

import { FormEvent, useMemo, useState } from "react";
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
};

type EditionForEdit = {
  id: string;
  edition_name: string | null;
  price: number | null;
  currency: string | null;
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
  type: "idle" | "success" | "error";
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
  "Ficción",
  "Romance",
  "Misterio / Thriller",
  "Biografía / Memorias",
  "Infantil / Juvenil",
  "Cristiano / Fe",
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
  ],
  "Finanzas personales": [
    "Inversión",
    "Ahorro",
    "Crédito",
    "Educación financiera",
    "Libertad financiera",
  ],
  "Marketing y ventas": [
    "Ventas",
    "Copywriting",
    "Publicidad digital",
    "Redes sociales",
    "Embudo de ventas",
    "Marca personal",
  ],
  "Desarrollo personal": [
    "Hábitos",
    "Mentalidad",
    "Motivación",
    "Disciplina",
    "Autoayuda",
    "Propósito",
  ],
  Espiritualidad: [
    "Meditación",
    "Propósito",
    "Crecimiento espiritual",
    "Reflexiones",
    "Fe práctica",
  ],
  "Salud y bienestar": [
    "Nutrición",
    "Fitness",
    "Salud mental",
    "Bienestar integral",
    "Hábitos saludables",
  ],
  Educación: [
    "Métodos de estudio",
    "Docencia",
    "Aprendizaje",
    "Guías prácticas",
    "Formación profesional",
  ],
  Tecnología: [
    "Inteligencia artificial",
    "Programación",
    "Ciberseguridad",
    "Software",
    "Transformación digital",
  ],
  Ficción: [
    "Drama",
    "Aventura",
    "Ciencia ficción",
    "Fantasía",
    "Realismo contemporáneo",
  ],
  Romance: [
    "Romance contemporáneo",
    "Romance histórico",
    "Drama romántico",
    "Comedia romántica",
    "Romance juvenil",
  ],
  "Misterio / Thriller": [
    "Suspenso",
    "Crimen",
    "Thriller psicológico",
    "Detectives",
    "Misterio paranormal",
  ],
  "Biografía / Memorias": [
    "Historia personal",
    "Superación",
    "Testimonio",
    "Carrera profesional",
    "Legado familiar",
  ],
  "Infantil / Juvenil": [
    "Cuentos infantiles",
    "Aventura juvenil",
    "Educativo infantil",
    "Valores",
    "Fantasía juvenil",
  ],
  "Cristiano / Fe": [
    "Devocional",
    "Vida cristiana",
    "Testimonio",
    "Familia y fe",
    "Estudio bíblico",
  ],
  "Académico / Profesional": [
    "Manual técnico",
    "Investigación",
    "Derecho",
    "Medicina",
    "Administración",
  ],
};

const STATUSES = [
  { value: "draft", label: "Borrador" },
  { value: "under_review", label: "En evaluación" },
  { value: "changes_requested", label: "Cambios solicitados" },
  { value: "published", label: "Publicado" },
  { value: "unlisted", label: "Oculto / solo con enlace" },
  { value: "archived", label: "Archivado" },
];

const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "pt", label: "Portugués" },
  { value: "fr", label: "Francés" },
];

const CURRENCIES = ["DOP", "USD", "EUR"];

export default function EditBookForm({ book, edition }: EditBookFormProps) {
  const router = useRouter();

  const [selectedNiche, setSelectedNiche] = useState(book.primary_niche ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<SubmitState>({
    type: "idle",
    message: "",
  });

  const categoryOptions = useMemo(() => {
    return selectedNiche ? CATEGORIES_BY_NICHE[selectedNiche] ?? [] : [];
  }, [selectedNiche]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    setIsSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch(`/api/books/${book.id}`, {
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
        message: data.message || "Libro actualizado correctamente.",
      });

      router.refresh();
    } catch (error) {
      console.error("Error actualizando libro:", error);

      setStatus({
        type: "error",
        message: "Ocurrió un error actualizando el libro.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60";

  const labelClassName = "space-y-2 text-sm font-medium text-slate-800";

  const sectionClassName =
    "rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm";

  const sectionTitleClassName =
    "mb-5 border-b border-slate-200 pb-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-500";

  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
            Editar libro
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            {book.title}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Slug público: <span className="font-medium">{book.slug}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/catalog/${book.slug}`}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
      </header>

      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="space-y-6"
      >
        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Identidad</h2>

          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Título</span>
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
              <span>Estado</span>
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
              <span>Sello editorial</span>
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
          <h2 className={sectionTitleClassName}>Categoría y búsqueda</h2>

          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Nicho</span>
              <select
                name="primary_niche"
                value={selectedNiche}
                onChange={(event) => setSelectedNiche(event.target.value)}
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
              <span>Categoría principal</span>
              <select
                name="primary_category"
                defaultValue={book.primary_category ?? ""}
                disabled={isSubmitting || !selectedNiche}
                className={inputClassName}
              >
                <option value="">
                  {selectedNiche ? "Selecciona categoría" : "Elige nicho primero"}
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
            <span>Descripción larga</span>
            <textarea
              name="description"
              rows={7}
              defaultValue={book.description_long ?? ""}
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>

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
            <span>URL de muestra</span>
            <input
              name="sample_url"
              type="url"
              defaultValue={book.sample_url ?? ""}
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Precio y edición</h2>

          <div className="grid gap-5 md:grid-cols-3">
            <label className={labelClassName}>
              <span>Precio</span>
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

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <label className={labelClassName}>
              <span>Formato</span>
              <input
                name="format"
                defaultValue={edition?.format ?? "ebook"}
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Páginas</span>
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
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>SEO</h2>

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
          <h2 className={sectionTitleClassName}>Archivos y cambios menores</h2>

          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              className="mb-5 max-w-[180px] rounded-2xl border border-slate-200"
            />
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Cambiar portada</span>
              <input
                name="cover"
                type="file"
                accept="image/*"
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Subir nueva versión del libro</span>
              <input
                name="book_file"
                type="file"
                accept=".pdf,.epub"
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>
          </div>

          <label className={`${labelClassName} mt-5 block`}>
            <span>Nota del cambio</span>
            <textarea
              name="change_note"
              rows={3}
              placeholder="Ej: corregí errores menores, actualicé portada, agregué nueva edición..."
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

        {status.message ? (
          <p
            role="status"
            aria-live="polite"
            className={`rounded-2xl p-4 text-sm ${
              status.type === "error"
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {status.message}
          </p>
        ) : null}
      </form>
    </main>
  );
}