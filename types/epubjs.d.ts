declare module "epubjs" {
  export type RelocatedLocation = {
    start?: {
      displayed?: {
        page?: number;
        total?: number;
      };
      index?: number | string;
    };
  };

  export type Rendition = {
    display: (target?: string | number) => Promise<void>;
    next: () => Promise<void> | void;
    prev: () => Promise<void> | void;
    destroy: () => void;
    on(event: "relocated", callback: (location: RelocatedLocation) => void): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
  };

  export type Book = {
    renderTo: (
      element: HTMLElement,
      options?: {
        width?: string | number;
        height?: string | number;
        spread?: "none" | "auto" | "always";
        flow?: "paginated" | "scrolled" | "scrolled-doc";
        manager?: string;
      }
    ) => Rendition;
    destroy: () => void;
  };

  export type EpubOptions = {
    openAs?: "epub";
  };

  export default function ePub(
    input: string | ArrayBuffer,
    options?: EpubOptions
  ): Book;
}