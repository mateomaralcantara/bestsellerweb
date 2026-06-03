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
  preview?: {
    status?: string;
    error?: string | null;
    command?: string | null;
  };
};

type DraftValue = string | boolean;

const DRAFT_KEY = "dashboard:new-book:draft:v4";
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

function getExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() || "";
}

function hasAllowedExtension(file: File, extensions: string[]) {
  const extension = `.${getExtension(file)}`;
  return extensions.includes(extension);
}

function isValidImageFile(file: File) {
  const validType = !file.type || file.type.startsWith("image/");
  const validExtension = hasAllowedExtension(file, [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
  ]);

  return validType && validExtension;
}


function isPdfFile(file: FormDataEntryValue | null) {
  if (!(file instanceof File)) {
    return false;
  }

  const fileName = file.name.toLowerCase();

  return (
    file.type === "application/pdf" ||
    fileName.endsWith(".pdf")
  );
}

function validateFiles(formData: FormData) {
  const cover = formData.get("cover");
  const manuscriptPdf = formData.get("manuscript_pdf");
  // Preview automático: se genera desde el PDF principal.

  if (!isRealFile(cover)) {
    return "La portada es obligatoria.";
  }

  if (!isValidImageFile(cover)) {
    return "La portada debe ser JPG, PNG o WebP.";
  }

  if (sizeInMb(cover) > MAX_COVER_SIZE_MB) {
    return `La portada no debe superar ${MAX_COVER_SIZE_MB} MB.`;
  }

  if (!isRealFile(manuscriptPdf)) {
    return "El PDF principal es obligatorio.";
  }

  if (!isPdfFile(manuscriptPdf)) {
    return "El archivo principal debe ser PDF.";
  }

  if (sizeInMb(manuscriptPdf) > MAX_BOOK_SIZE_MB) {
    return `El PDF principal no debe superar ${MAX_BOOK_SIZE_MB} MB.`;
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
      try {
        const draft = collectDraft(form);
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // localStorage puede fallar en modo privado o por cuota llena.
      }
    }, 350);
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nada grave.
    }

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
    const affiliateCommission = readText(
      formData,
      "affiliate_commission_percentage"
    );

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

    if (affiliateCommission) {
      const commission = Number(affiliateCommission);

      if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
        return "La comisión de afiliado debe estar entre 0 y 100.";
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
    setStatus({
      type: "info",
      message: "Guardando portada, PDF principal y metadata...",
    });

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
          "Libro creado correctamente con PDF principal.",
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
              Nuevo libro EPUB
            </h1>

            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Crea la ficha tipo Amazon/KDP, sube portada, PDF principal y EPUB
              preview. El preview se leerá dentro de la plataforma sin entregar
              el archivo completo.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 text-sm shadow-sm">
            <p className="font-bold text-slate-900">Lectura interna EPUB</p>
            <p className="mt-1 text-slate-600">
              Un EPUB para muestra y otro EPUB privado para compradores.
            </p>
          </div>
        </div>
      </header>

      {draftRestored ? (
        <div className="flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:flex-row md:items-center md:justify-between">
          <p>
            Rescaté un borrador local. Los archivos no se restauran por
            seguridad del navegador; vuelve a seleccionarlos.
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
        <input type="hidden" name="preview_mode" value="pdf_images" />
        <input type="hidden" name="preview_page_count" value="1" />
        <input type="hidden" name="preview_include_cover" value="true" />
        <input type="hidden" name="preview_layout" value="epub_reader" />
        <input type="hidden" name="preview_progress_enabled" value="true" />

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
                Por seguridad, los libros entran como borrador o evaluación.
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
                <option value="ebook">Ebook / EPUB</option>
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
                placeholder="Ej: emprendedores, coaches, vendedores..."
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
              placeholder="Descripción completa tipo Amazon."
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
                placeholder="Ej: Hábitos Atómicos..."
                disabled={isSubmitting}
                className={inputClassName}
              />
            </label>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Vista previa EPUB</h2>

          <div className="grid gap-4 md:grid-cols-4">
            <PreviewInfoCard
              title="Preview"
              value="EPUB separado"
              text="No se usa el libro completo como muestra."
            />

            <PreviewInfoCard
              title="Completo"
              value="EPUB privado"
              text="Solo dueño o comprador."
            />

            <PreviewInfoCard
              title="Lector"
              value="Interno"
              text="Lectura dentro de la plataforma."
            />

            <PreviewInfoCard
              title="Seguridad"
              value="Backend protegido"
              text="El archivo no queda público."
            />
          </div>

          <div className="mt-4 rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
            Sube dos EPUB: uno completo y otro recortado para muestra. El EPUB
            preview debe incluir solo portada, introducción y primeros capítulos.
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
              <span>Páginas aproximadas</span>
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
              text="Úsalo solo si quieres entregar el EPUB."
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
              placeholder="Qué hace este libro diferente o vendible."
              disabled={isSubmitting}
              className={inputClassName}
            />
          </label>
        </section>

        <section className={sectionClassName}>
          <h2 className={sectionTitleClassName}>Archivos EPUB</h2>

          <div className="grid gap-5 md:grid-cols-3">
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
                JPG, PNG o WebP. Máximo {MAX_COVER_SIZE_MB} MB.
              </FieldHint>
            </label>

            <label className={labelClassName}>
              <span>PDF principal *</span>
              <input
                name="manuscript_pdf"
                type="file"
                accept="application/pdf,.pdf"
                required
                disabled={isSubmitting}
                className={inputClassName}
              />
              <FieldHint>Archivo completo. Solo dueño o comprador.</FieldHint>
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
                {isSubmitting ? "Guardando EPUB..." : "Guardar / enviar libro"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}






