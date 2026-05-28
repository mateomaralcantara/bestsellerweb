"use client";

import type { FormEvent, ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type SubmitState = {
  type: "idle" | "info" | "success" | "error";
  message: string;
};

type CreateBookResponse = {
  message?: string;
  error?: string;
  view_url?: string;
  book?: {
    id: string | number;
    slug?: string;
    title?: string;
  };
};

type DraftValue = string | boolean;

const DRAFT_KEY = "dashboard:new-book:draft:v2";
const PREVIEW_PAGE_COUNT = 17;
const MAX_COVER_SIZE_MB = 10;
const MAX_BOOK_SIZE_MB = 100;

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

const BOOK_FORMATS = [
  { value: "ebook", label: "Ebook" },
  { value: "paperback", label: "Impreso tapa blanda" },
  { value: "hardcover", label: "Impreso tapa dura" },
  { value: "audiobook", label: "Audiolibro" },
  { value: "bundle", label: "Bundle / paquete" },
];

const INITIAL_STATUSES = [
  { value: "under_review", label: "Enviar a evaluación" },
  { value: "draft", label: "Guardar como borrador" },
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
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function parsePrice(value: string) {
  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    return null;
  }

  return price;
}

function getResponseRedirect(data: CreateBookResponse) {
  if (data.view_url) return data.view_url;

  if (data.book?.id) {
    return `/dashboard/books/${data.book.id}/edit`;
  }

  if (data.book?.slug) {
    return `/catalog/${data.book.slug}`;
  }

  return "/dashboard/books/published";
}

function isRealFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

function sizeInMb(file: File) {
  return file.size / 1024 / 1024;
}

function hasAllowedExtension(file: File, extensions: string[]) {
  const name = file.name.toLowerCase();
  return extensions.some((extension) => name.endsWith(extension));
}

function validateFiles(formData: FormData) {
  const cover = formData.get("cover");
  const bookFile = formData.get("book_file");

  if (!isRealFile(cover)) {
    return "La portada es obligatoria.";
  }

  if (!cover.type.startsWith("image/")) {
    return "La portada debe ser una imagen JPG, PNG o WebP.";
  }

  if (sizeInMb(cover) > MAX_COVER_SIZE_MB) {
    return `La portada no debe superar ${MAX_COVER_SIZE_MB} MB.`;
  }

  if (!isRealFile(bookFile)) {
    return "El archivo del libro es obligatorio.";
  }

  const validBookFile =
    bookFile.type === "application/pdf" ||
    bookFile.type === "application/epub+zip" ||
    hasAllowedExtension(bookFile, [".pdf", ".epub"]);

  if (!validBookFile) {
    return "El archivo del libro debe ser PDF o EPUB.";
  }

  if (sizeInMb(bookFile) > MAX_BOOK_SIZE_MB) {
    return `El archivo del libro no debe superar ${MAX_BOOK_SIZE_MB} MB.`;
  }

  return null;
}

function collectDraft(form: HTMLFormElement) {
  const draft: Record<string, DraftValue> = {};

  const fields = Array.from(
    form.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input[name], textarea[name], select[name]")
  );

  for (const field of fields) {
    if (field instanceof HTMLInputElement && field.type === "file") continue;

    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      draft[field.name] = field.checked;
      continue;
    }

    draft[field.name] = field.value;
  }

  return draft;
}

function restoreDraft(form: HTMLFormElement, draft: Record<string, DraftValue>) {
  const fields = Array.from(
    form.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input[name], textarea[name], select[name]")
  );

  for (const field of fields) {
    const value = draft[field.name];

    if (value === undefined) continue;
    if (field instanceof HTMLInputElement && field.type === "file") continue;

    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      field.checked = Boolean(value);
      continue;
    }

    if (typeof value === "string") {
      field.value = value;
    }
  }
}

function FieldHint({ children }: { children: ReactNode }) {
  return (
    <span className="block text-xs font-normal leading-5 text-slate-500">
      {children}
    </span>
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

export default function NewBookForm() {
  const router = useRouter();

  const formRef = useRef<HTMLFormElement | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedNiche, setSelectedNiche] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [status, setStatus] = useState<SubmitState>({
    type: "idle",
    message: "",
  });

  const categoryOptions = useMemo(() => {
    return selectedNiche ? CATEGORIES_BY_NICHE[selectedNiche] ?? [] : [];
  }, [selectedNiche]);

  const saveDraft = useCallback(() => {
    const form = formRef.current;
    if (!form) return;

    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
    }

    draftTimerRef.current = setTimeout(() => {
      const draft = collectDraft(form);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 350);
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftRestored(false);
  }, []);

  const resetForm = useCallback(() => {
    formRef.current?.reset();
    setSelectedNiche("");
    setSelectedCategory("");
    clearDraft();
    setStatus({
      type: "info",
      message: "Formulario limpio. Borrador local eliminado.",
    });
  }, [clearDraft]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const rawDraft = localStorage.getItem(DRAFT_KEY);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as Record<string, DraftValue>;

      restoreDraft(form, draft);

      if (typeof draft.primary_niche === "string") {
        setSelectedNiche(draft.primary_niche);
      }

      if (typeof draft.primary_category === "string") {
        setSelectedCategory(draft.primary_category);
      }

      setDraftRestored(true);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, []);

  function validateForm(formData: FormData) {
    const title = readText(formData, "title");
    const description = readText(formData, "description");
    const primaryNiche = readText(formData, "primary_niche");
    const primaryCategory = readText(formData, "primary_category");
    const keywords = parseKeywords(readText(formData, "keywords"));
    const price = parsePrice(readText(formData, "price"));
    const compareAtPrice = readText(formData, "compare_at_price");
    const pageCount = readText(formData, "page_count");

    if (!title) return "El título es obligatorio.";
    if (!description) return "La descripción comercial es obligatoria.";

    if (!primaryNiche || !primaryCategory) {
      return "Selecciona nicho y categoría principal.";
    }

    if (keywords.length < 3) {
      return "Agrega mínimo 3 palabras clave separadas por coma.";
    }

    if (price === null) return "El precio no es válido.";

    if (compareAtPrice && parsePrice(compareAtPrice) === null) {
      return "El precio anterior no es válido.";
    }

    if (pageCount) {
      const pages = Number(pageCount);

      if (!Number.isInteger(pages) || pages < 1) {
        return "El número de páginas no es válido.";
      }
    }

    return validateFiles(formData);
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
          message: data.error || "No se pudo crear el libro.",
        });
        return;
      }

      if (!data.book?.id && !data.book?.slug && !data.view_url) {
        setStatus({
          type: "error",
          message: "El libro se guardó, pero no llegó una ruta válida.",
        });
        return;
      }

      clearDraft();

      setStatus({
        type: "success",
        message:
          data.message ||
          "Libro creado correctamente. La muestra visual se genera desde el PDF en el servidor.",
      });

      form.reset();
      setSelectedNiche("");
      setSelectedCategory("");

      router.push(getResponseRedirect(data));
    } catch (error) {
      console.error("Error al enviar el formulario:", error);

      setStatus({
        type: "error",
        message: "Ocurrió un error al crear el libro.",
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
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Nuevo libro
            </h1>

            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Crea la ficha tipo Amazon/KDP, sube portada y PDF. La muestra se
              genera automática con portada + primeras {PREVIEW_PAGE_COUNT}{" "}
              páginas del libro.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 text-sm shadow-sm">
            <p className="font-bold text-slate-900">Vista previa automática</p>
            <p className="mt-1 text-slate-600">
              Doble página horizontal, barra de progreso y PDF protegido.
            </p>
          </div>
        </div>
      </header>

      {draftRestored ? (
        <div className="flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:flex-row md:items-center md:justify-between">
          <p>
            Rescaté un borrador local de este formulario. Los archivos no se
            pueden restaurar por seguridad del navegador; vuelve a
            seleccionarlos.
          </p>

          <button
            type="button"
            onClick={resetForm}
            className="rounded-2xl border border-amber-300 bg-white px-4 py-2 font-bold text-amber-900 transition hover:bg-amber-100"
          >
            Limpiar borrador
          </button>
        </div>
      ) : null}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onInputCapture={saveDraft}
        onChangeCapture={saveDraft}
        encType="multipart/form-data"
        className="space-y-6"
        noValidate
      >
        <input type="hidden" name="preview_mode" value="first_pages" />
        <input
          type="hidden"
          name="preview_page_count"
          value={PREVIEW_PAGE_COUNT}
        />
        <input type="hidden" name="preview_include_cover" value="true" />
        <input
          type="hidden"
          name="preview_layout"
          value="two_page_horizontal"
        />
        <input
          type="hidden"
          name="preview_progress_enabled"
          value="true"
        />

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Identidad del libro</h2>

          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Título *</span>
              <input
                name="title"
                type="text"
                placeholder="Ej: Vende sin rogar"
                required
                disabled={isSubmitting}
                className={inputClassName}
                autoComplete="off"
              />
            </label>

            <label className={labelClassName}>
              <span>Subtítulo</span>
              <input
                name="subtitle"
                type="text"
                placeholder="Ej: Sistema práctico para cerrar clientes"
                disabled={isSubmitting}
                className={inputClassName}
                autoComplete="off"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Nombre editorial / sello</span>
              <input
                name="publisher_name"
                type="text"
                placeholder="Ej: Bestseller Editorial"
                disabled={isSubmitting}
                className={inputClassName}
                autoComplete="organization"
              />
            </label>

            <label className={labelClassName}>
              <span>Estado inicial</span>
              <select
                name="status"
                defaultValue="under_review"
                disabled={isSubmitting}
                className={inputClassName}
              >
                {INITIAL_STATUSES.map((bookStatus) => (
                  <option key={bookStatus.value} value={bookStatus.value}>
                    {bookStatus.label}
                  </option>
                ))}
              </select>
              <FieldHint>
                Los libros no se publican directo. Primero quedan como borrador
                o en evaluación.
              </FieldHint>
            </label>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Idioma</span>
              <select
                name="language_code"
                defaultValue="es"
                disabled={isSubmitting}
                className={inputClassName}
              >
                {LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClassName}>
              <span>Formato principal</span>
              <select
                name="format"
                defaultValue="ebook"
                disabled={isSubmitting}
                className={inputClassName}
              >
                {BOOK_FORMATS.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
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
                required
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
                required
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
                type="text"
                placeholder="Ej: cierre de ventas, hábitos financieros..."
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Palabras clave *</span>
              <input
                name="keywords"
                type="text"
                required
                placeholder="disciplina, riqueza, hábitos, finanzas personales"
                disabled={isSubmitting}
                className={inputClassName}
              />
              <FieldHint>
                Mínimo 3. Sepáralas por coma. Máximo recomendado: 12.
              </FieldHint>
            </label>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Audiencia objetivo</span>
              <textarea
                name="target_audience"
                rows={4}
                placeholder="Ej: emprendedores, coaches, vendedores y consultores..."
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Promesa al lector</span>
              <textarea
                name="reader_promise"
                rows={4}
                placeholder="Ej: al terminar este libro, el lector podrá..."
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
              placeholder="Resumen breve para cards, catálogo y resultados."
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>

          <label className={`${labelClassName} mt-5 block`}>
            <span>Descripción larga *</span>
            <textarea
              name="description"
              rows={8}
              required
              placeholder="Descripción completa tipo Amazon: problema, promesa, beneficios y para quién es."
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
                placeholder="Una frase fuerte que venda el libro rápido."
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Libros comparables</span>
              <textarea
                name="comparable_books"
                rows={4}
                placeholder="Ej: Hábitos Atómicos, Padre Rico Padre Pobre..."
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Vista previa del libro</h2>

          <div className="grid gap-4 md:grid-cols-4">
            <PreviewInfoCard
              title="Modo"
              value="Automática"
              text="No se pega introducción ni capítulo manual."
            />

            <PreviewInfoCard
              title="Páginas"
              value={`Portada + ${PREVIEW_PAGE_COUNT}`}
              text="Se toman desde el PDF en orden real."
            />

            <PreviewInfoCard
              title="Diseño"
              value="Doble página"
              text="Horizontal en escritorio, una página en móvil."
            />

            <PreviewInfoCard
              title="Seguridad"
              value="PDF protegido"
              text="El lector ve imágenes, no el archivo completo."
            />
          </div>

          <div className="mt-4 rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
            La muestra se genera después de subir el archivo. Si el API todavía
            no convierte PDF a imágenes, guarda estos campos y procesa la
            muestra en backend con la tabla <strong>book_preview_pages</strong>.
          </div>
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
                placeholder="499"
                required
                disabled={isSubmitting}
                className={inputClassName}
                inputMode="decimal"
              />
            </label>

            <label className={labelClassName}>
              <span>Moneda</span>
              <select
                name="currency"
                defaultValue="DOP"
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
                placeholder="799"
                disabled={isSubmitting}
                className={inputClassName}
                inputMode="decimal"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <label className={labelClassName}>
              <span>Páginas</span>
              <input
                name="page_count"
                type="number"
                step="1"
                min="1"
                placeholder="150"
                disabled={isSubmitting}
                className={inputClassName}
                inputMode="numeric"
              />
            </label>

            <label className={labelClassName}>
              <span>ISBN</span>
              <input
                name="isbn"
                type="text"
                placeholder="Opcional"
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>Comisión afiliado %</span>
              <input
                name="affiliate_commission_percentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="30"
                disabled={isSubmitting}
                className={inputClassName}
                inputMode="decimal"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <CheckboxCard
              name="affiliate_enabled"
              title="Activar afiliados"
              text="Permite comisión por recomendación."
              disabled={isSubmitting}
            />

            <CheckboxCard
              name="is_featured"
              title="Destacar en catálogo"
              text="Mejor visibilidad en listados."
              disabled={isSubmitting}
            />

            <CheckboxCard
              name="download_allowed"
              title="Permitir descarga"
              text="Úsalo solo si quieres entregar el PDF."
              disabled={isSubmitting}
            />
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>SEO y marketing</h2>

          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Meta title</span>
              <input
                name="meta_title"
                type="text"
                placeholder="Título para Google"
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>

            <label className={labelClassName}>
              <span>URL de muestra externa</span>
              <input
                name="sample_url"
                type="url"
                placeholder="https://..."
                disabled={isSubmitting}
                className={inputClassName}
              />
              <FieldHint>
                Opcional. La muestra interna se genera desde el PDF.
              </FieldHint>
            </label>
          </div>

          <label className={`${labelClassName} mt-5 block`}>
            <span>Meta description</span>
            <textarea
              name="meta_description"
              rows={3}
              placeholder="Descripción corta para SEO y redes."
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>

          <label className={`${labelClassName} mt-5 block`}>
            <span>Ángulo de marketing</span>
            <textarea
              name="marketing_angle"
              rows={4}
              placeholder="Qué hace este libro diferente, urgente o más vendible."
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Archivos</h2>

          <div className="grid gap-5 md:grid-cols-2">
            <label className={labelClassName}>
              <span>Portada *</span>
              <input
                name="cover"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required
                disabled={isSubmitting}
                className={inputClassName}
              />
              <FieldHint>
                JPG, PNG o WebP. Máximo {MAX_COVER_SIZE_MB} MB. Vertical,
                estilo portada editorial.
              </FieldHint>
            </label>

            <label className={labelClassName}>
              <span>Archivo del libro *</span>
              <input
                name="book_file"
                type="file"
                accept=".pdf,.epub,application/pdf,application/epub+zip"
                required
                disabled={isSubmitting}
                className={inputClassName}
              />
              <FieldHint>
                PDF o EPUB. Máximo {MAX_BOOK_SIZE_MB} MB. El archivo completo
                debe quedar protegido, no público.
              </FieldHint>
            </label>
          </div>
        </section>

        <div className="sticky bottom-4 z-10 rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-2xl shadow-slate-950/10 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <StatusMessage status={status} />

            <div className="flex flex-wrap items-center gap-3 md:ml-auto">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={resetForm}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Limpiar
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => router.push("/dashboard/books/published")}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Ver mis libros
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-2xl bg-black px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? "Guardando y generando..."
                  : "Guardar / enviar libro"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}

function PreviewInfoCard({
  title,
  value,
  text,
}: {
  title: string;
  value: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function CheckboxCard({
  name,
  title,
  text,
  disabled,
}: {
  name: string;
  title: string;
  text: string;
  disabled: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
      <input
        name={name}
        type="checkbox"
        value="true"
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-slate-300"
      />
      <span>
        <strong className="block text-slate-900">{title}</strong>
        {text}
      </span>
    </label>
  );
}