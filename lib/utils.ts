import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function currency(value: number, code = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || "USD") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(value);
}
