import { cn } from "@/lib/utils";
export function SectionHeading({ eyebrow, title, description, align = "left" }: { eyebrow?: string; title: string; description?: string; align?: "left" | "center"; }) {
  return <div className={cn("space-y-4", align === "center" && "mx-auto max-w-3xl text-center")}><>{eyebrow ? <p className="inline-flex rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-accent-700">{eyebrow}</p> : null}<h2 className="font-display text-3xl font-bold tracking-tight text-brand-800 sm:text-4xl">{title}</h2>{description ? <p className="text-base leading-8 text-slate-700">{description}</p> : null}</></div>;
}
