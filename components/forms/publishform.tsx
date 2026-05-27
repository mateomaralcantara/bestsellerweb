"use client";

import { FormEvent, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";

type Status =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

type AuthorApplicationInsert = {
  user_id: string | null;
  legal_name: string;
  pen_name: string | null;
  email: string;
  phone: string | null;
  manuscript_title: string;
  genre: string | null;
  about: string | null;
  website_url: string | null;
  sample_link: string | null;

  primary_niche: string | null;
  primary_category: string | null;
  secondary_category: string | null;
  keywords: string[];
  target_audience: string | null;
  reader_promise: string | null;
  manuscript_status: string | null;
  book_format: string | null;
  language_code: string;
  estimated_pages: number | null;
  desired_price: number | null;
  marketing_angle: string | null;
  comparable_books: string | null;
  author_platform: string | null;
  publishing_goal: string | null;
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
  ],
  "Desarrollo personal": [
    "Hábitos",
    "Mentalidad",
    "Motivación",
    "Disciplina",
    "Autoayuda",
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

const MANUSCRIPT_STATUSES = [
  "Idea inicial",
  "Borrador en proceso",
  "Primer borrador terminado",
  "Manuscrito editado",
  "Listo para publicar",
];

const BOOK_FORMATS = [
  "Ebook",
  "Impreso",
  "Ebook + impreso",
  "Audiolibro",
  "Curso / libro híbrido",
];

const PUBLISHING_GOALS = [
  "Vender más",
  "Construir autoridad",
  "Captar clientes",
  "Lanzar marca personal",
  "Crear comunidad",
  "Dejar legado",
];

function getErrorMessage(error: unknown): string {
  if (!error) {
    return "Ocurrió un error inesperado al enviar la solicitud.";
  }

  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      typeof maybeError.message === "string" ? maybeError.message : null,
      typeof maybeError.details === "string" ? maybeError.details : null,
      typeof maybeError.hint === "string" ? `Sugerencia: ${maybeError.hint}` : null,
      typeof maybeError.code === "string" ? `Código: ${maybeError.code}` : null,
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" | ");
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrió un error inesperado al enviar la solicitud.";
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readNullableText(formData: FormData, key: string) {
  const value = readText(formData, key);
  return value || null;
}

function parseKeywords(value: string) {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function parsePositiveNumber(value: string) {
  if (!value) return null;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function PublishForm() {
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState("");

  const categoryOptions = useMemo(() => {
    return selectedNiche ? CATEGORIES_BY_NICHE[selectedNiche] ?? [] : [];
  }, [selectedNiche]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const legal_name = readText(formData, "legal_name");
    const pen_name = readNullableText(formData, "pen_name");
    const email = readText(formData, "email").toLowerCase();
    const phone = readNullableText(formData, "phone");

    const manuscript_title = readText(formData, "manuscript_title");
    const primary_niche = readNullableText(formData, "primary_niche");
    const primary_category = readNullableText(formData, "primary_category");
    const secondary_category = readNullableText(formData, "secondary_category");

    const keywords = parseKeywords(readText(formData, "keywords"));
    const desired_price = parsePositiveNumber(readText(formData, "desired_price"));
    const estimated_pages = parsePositiveNumber(readText(formData, "estimated_pages"));

    if (!legal_name || !email || !manuscript_title || !primary_niche || !primary_category) {
      setStatus({
        type: "error",
        message:
          "Completa nombre, email, título, nicho y categoría principal antes de enviar.",
      });
      return;
    }

    if (keywords.length < 3) {
      setStatus({
        type: "error",
        message: "Agrega mínimo 3 palabras clave separadas por coma.",
      });
      return;
    }

    const supabase = getBrowserSupabaseClient();

    if (!supabase) {
      setStatus({
        type: "error",
        message: "No se pudo inicializar Supabase.",
      });
      return;
    }

    try {
      setLoading(true);
      setStatus(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload: AuthorApplicationInsert = {
        user_id: user?.id ?? null,

        legal_name,
        pen_name,
        email,
        phone,

        manuscript_title,
        genre: primary_category,
        about: readNullableText(formData, "about"),
        website_url: readNullableText(formData, "website_url"),
        sample_link: readNullableText(formData, "sample_link"),

        primary_niche,
        primary_category,
        secondary_category,
        keywords,
        target_audience: readNullableText(formData, "target_audience"),
        reader_promise: readNullableText(formData, "reader_promise"),
        manuscript_status: readNullableText(formData, "manuscript_status"),
        book_format: readNullableText(formData, "book_format"),
        language_code: readText(formData, "language_code") || "es",
        estimated_pages,
        desired_price,
        marketing_angle: readNullableText(formData, "marketing_angle"),
        comparable_books: readNullableText(formData, "comparable_books"),
        author_platform: readNullableText(formData, "author_platform"),
        publishing_goal: readNullableText(formData, "publishing_goal"),
      };

      const { error } = await supabase
        .from("author_applications")
        .insert([payload]);

      if (error) {
        console.error("Error insertando author_applications:", error);
        setStatus({
          type: "error",
          message: getErrorMessage(error),
        });
        return;
      }

      form.reset();
      setSelectedNiche("");

      setStatus({
        type: "success",
        message:
          "Solicitud enviada correctamente. Ya tenemos metadata suficiente para evaluar, posicionar y preparar el lanzamiento.",
      });
    } catch (error) {
      console.error("Error inesperado en PublishForm:", error);

      setStatus({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }

  const inputClassName =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60";

  const labelClassName = "space-y-2 text-sm text-slate-800";

  const sectionTitleClassName =
    "border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-[0.22em] text-slate-500";

  return (
    <form
      onSubmit={handleSubmit}
      className="editorial-panel space-y-7 rounded-[32px] p-6"
      noValidate
    >
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent-700">
          Aplicación editorial
        </p>
        <h2 className="mt-2 text-2xl font-bold text-brand-800">
          Metadata tipo Amazon para vender mejor
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Mientras más precisa sea esta información, mejor podemos posicionar tu
          libro, crear el resumen comercial y preparar el lanzamiento.
        </p>
      </div>

      <section className="space-y-5">
        <h3 className={sectionTitleClassName}>Autor</h3>

        <div className="grid gap-5 md:grid-cols-2">
          <label className={labelClassName}>
            <span>Nombre legal *</span>
            <input
              name="legal_name"
              type="text"
              required
              autoComplete="name"
              disabled={loading}
              className={inputClassName}
            />
          </label>

          <label className={labelClassName}>
            <span>Nombre de autor / seudónimo</span>
            <input
              name="pen_name"
              type="text"
              disabled={loading}
              className={inputClassName}
            />
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className={labelClassName}>
            <span>Email *</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={loading}
              className={inputClassName}
            />
          </label>

          <label className={labelClassName}>
            <span>Teléfono / WhatsApp</span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              disabled={loading}
              className={inputClassName}
            />
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className={labelClassName}>
            <span>Web / landing / perfil principal</span>
            <input
              name="website_url"
              type="url"
              placeholder="https://..."
              disabled={loading}
              className={inputClassName}
            />
          </label>

          <label className={labelClassName}>
            <span>Plataforma del autor</span>
            <input
              name="author_platform"
              type="text"
              placeholder="Instagram, TikTok, YouTube, lista de correo..."
              disabled={loading}
              className={inputClassName}
            />
          </label>
        </div>
      </section>

      <section className="space-y-5">
        <h3 className={sectionTitleClassName}>Libro</h3>

        <label className={labelClassName}>
          <span>Título provisional *</span>
          <input
            name="manuscript_title"
            type="text"
            required
            disabled={loading}
            className={inputClassName}
          />
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label className={labelClassName}>
            <span>Nicho principal *</span>
            <select
              name="primary_niche"
              required
              disabled={loading}
              value={selectedNiche}
              onChange={(event) => setSelectedNiche(event.target.value)}
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
              disabled={loading || !selectedNiche}
              className={inputClassName}
            >
              <option value="">
                {selectedNiche ? "Selecciona una categoría" : "Elige nicho primero"}
              </option>

              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className={labelClassName}>
            <span>Subcategoría</span>
            <input
              name="secondary_category"
              type="text"
              placeholder="Ej: ventas consultivas, hábitos financieros..."
              disabled={loading}
              className={inputClassName}
            />
          </label>

          <label className={labelClassName}>
            <span>Palabras clave *</span>
            <input
              name="keywords"
              type="text"
              required
              placeholder="liderazgo, ventas, hábitos, negocios"
              disabled={loading}
              className={inputClassName}
            />
            <span className="block text-xs text-slate-500">
              Mínimo 3. Sepáralas por coma. Esto ayuda a posicionamiento y búsqueda.
            </span>
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className={labelClassName}>
            <span>Estado del manuscrito</span>
            <select
              name="manuscript_status"
              disabled={loading}
              className={inputClassName}
              defaultValue=""
            >
              <option value="">Selecciona una opción</option>
              {MANUSCRIPT_STATUSES.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            <span>Formato deseado</span>
            <select
              name="book_format"
              disabled={loading}
              className={inputClassName}
              defaultValue=""
            >
              <option value="">Selecciona una opción</option>
              {BOOK_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <label className={labelClassName}>
            <span>Idioma</span>
            <select
              name="language_code"
              disabled={loading}
              className={inputClassName}
              defaultValue="es"
            >
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="fr">Francés</option>
              <option value="pt">Portugués</option>
            </select>
          </label>

          <label className={labelClassName}>
            <span>Páginas estimadas</span>
            <input
              name="estimated_pages"
              type="number"
              min="1"
              step="1"
              disabled={loading}
              className={inputClassName}
            />
          </label>

          <label className={labelClassName}>
            <span>Precio deseado</span>
            <input
              name="desired_price"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej: 499"
              disabled={loading}
              className={inputClassName}
            />
          </label>
        </div>
      </section>

      <section className="space-y-5">
        <h3 className={sectionTitleClassName}>Posicionamiento</h3>

        <label className={labelClassName}>
          <span>¿Para quién es este libro?</span>
          <textarea
            name="target_audience"
            rows={3}
            placeholder="Ej: emprendedores que venden servicios y quieren ordenar su proceso comercial..."
            disabled={loading}
            className={inputClassName}
          />
        </label>

        <label className={labelClassName}>
          <span>Promesa principal para el lector</span>
          <textarea
            name="reader_promise"
            rows={3}
            placeholder="Ej: al terminar el libro podrá crear un sistema simple para vender más sin depender de improvisación."
            disabled={loading}
            className={inputClassName}
          />
        </label>

        <label className={labelClassName}>
          <span>Ángulo de marketing</span>
          <textarea
            name="marketing_angle"
            rows={3}
            placeholder="¿Qué lo hace diferente, urgente o más vendible?"
            disabled={loading}
            className={inputClassName}
          />
        </label>

        <label className={labelClassName}>
          <span>Libros comparables</span>
          <textarea
            name="comparable_books"
            rows={3}
            placeholder="Ej: Padre Rico Padre Pobre, Hábitos Atómicos, Véndele a la mente..."
            disabled={loading}
            className={inputClassName}
          />
        </label>

        <label className={labelClassName}>
          <span>Objetivo principal</span>
          <select
            name="publishing_goal"
            disabled={loading}
            className={inputClassName}
            defaultValue=""
          >
            <option value="">Selecciona una opción</option>
            {PUBLISHING_GOALS.map((goal) => (
              <option key={goal} value={goal}>
                {goal}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="space-y-5">
        <h3 className={sectionTitleClassName}>Material</h3>

        <label className={labelClassName}>
          <span>Resumen / notas editoriales</span>
          <textarea
            name="about"
            rows={5}
            placeholder="Cuéntanos de qué trata el libro, qué problema resuelve y qué quieres lograr."
            disabled={loading}
            className={inputClassName}
          />
        </label>

        <label className={labelClassName}>
          <span>Link de muestra del manuscrito</span>
          <input
            name="sample_link"
            type="url"
            placeholder="Google Drive, Dropbox, Notion, etc."
            disabled={loading}
            className={inputClassName}
          />
        </label>
      </section>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-accent-600 px-5 py-3 font-semibold text-white transition hover:scale-[1.01] hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Enviando aplicación..." : "Enviar aplicación editorial"}
      </button>

      {status && (
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
      )}
    </form>
  );
}