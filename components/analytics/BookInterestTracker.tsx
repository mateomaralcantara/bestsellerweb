"use client";

import { useEffect } from "react";
import { trackBookInterest } from "@/lib/book-interest-client";

export function BookInterestTracker({ bookId }: { bookId: string }) {
  useEffect(() => {
    trackBookInterest(bookId, "book_view");
  }, [bookId]);

  return null;
}
