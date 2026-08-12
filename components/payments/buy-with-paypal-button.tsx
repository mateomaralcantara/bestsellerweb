import Link from "next/link";

type Props = {
  bookId: string;
  label?: string;
  className?: string;
};

export function BuyWithPayPalButton({
  bookId,
  label = "Comprar con PayPal",
  className = "",
}: Props) {
  return (
    <Link
      href={`/checkout/paypal?bookId=${encodeURIComponent(bookId)}`}
      className={`inline-flex items-center justify-center rounded-xl bg-[#ffd140] px-5 py-3 text-sm font-black text-[#142c8e] transition hover:bg-[#f2ba36] ${className}`}
    >
      {label}
    </Link>
  );
}
