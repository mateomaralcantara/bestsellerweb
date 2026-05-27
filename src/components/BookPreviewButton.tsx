import React, { useState } from "react";
import {
  getBookPreviewPages,
  getPublicPreviewUrl,
} from "../data/bookRepo";
import { BookPreviewReader } from "./BookPreviewReader";

type BookPreviewButtonProps = {
  bookId: string;
  title: string;
};

export function BookPreviewButton({ bookId, title }: BookPreviewButtonProps) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<Array<{ pageIndex: number; imageUrl: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setLoading(true);

    try {
      const rows = await getBookPreviewPages(bookId);

      setPages(
        rows.map((row) => ({
          pageIndex: row.page_index,
          imageUrl: getPublicPreviewUrl(row.image_path),
        }))
      );

      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className="px-5 py-3 rounded-2xl bg-slate-950 text-white font-black hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Cargando muestra..." : "Ver muestra"}
      </button>

      {open && (
        <BookPreviewReader
          title={title}
          pages={pages}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}