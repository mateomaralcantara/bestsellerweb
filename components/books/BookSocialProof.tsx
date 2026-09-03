import { Star } from "lucide-react";
import {
  DEFAULT_BOOK_DISPLAY_RATING,
  normalizeDisplayRating,
} from "@/lib/book-social-proof";

type BookSocialProofProps = {
  rating?: number | null;
  salesCount?: number | null;
  compact?: boolean;
  className?: string;
};

const STAR_INDEXES = [0, 1, 2, 3, 4] as const;

function RatingStar({ fill }: { fill: number }) {
  const percentage = Math.max(0, Math.min(1, fill)) * 100;

  return (
    <span className="relative inline-block h-4 w-4 shrink-0" aria-hidden="true">
      <Star className="absolute inset-0 h-4 w-4 fill-slate-200 text-slate-200" />
      <span
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${percentage}%` }}
      >
        <Star className="h-4 w-4 min-w-4 fill-amber-400 text-amber-400" />
      </span>
    </span>
  );
}

export function BookSocialProof({
  rating = DEFAULT_BOOK_DISPLAY_RATING,
  compact = false,
  className = "",
}: BookSocialProofProps) {
  const safeRating = normalizeDisplayRating(rating);

  if (safeRating <= 0) {
    return (
      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${
          compact ? "text-xs" : "text-sm"
        } ${className}`}
        aria-label="Libro nuevo; sin reseñas todavía"
      >
        <span className="rounded-full bg-blue-50 px-2 py-1 font-black text-blue-700">
          Nuevo
        </span>
        <span className="font-bold text-slate-600">Sin reseñas todavía</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${
        compact ? "text-xs" : "text-sm"
      } ${className}`}
      aria-label={`${safeRating.toFixed(1)} de 5 estrellas`}
    >
      <span className="flex items-center gap-0.5">
        {STAR_INDEXES.map((index) => (
          <RatingStar key={index} fill={safeRating - index} />
        ))}
      </span>
      <strong className="font-black text-amber-700">
        {safeRating.toFixed(1)}/5
      </strong>
    </div>
  );
}
