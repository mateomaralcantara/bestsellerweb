declare module "epubjs" {
    export type Rendition = {
      display: (target?: string | number) => Promise<void>;
      next: () => Promise<void> | void;
      prev: () => Promise<void> | void;
      destroy: () => void;
      on: (event: string, callback: (...args: any[]) => void) => void;
    };
  
    export type Book = {
      renderTo: (
        element: HTMLElement,
        options?: {
          width?: string | number;
          height?: string | number;
          spread?: "none" | "auto" | "always";
          flow?: "paginated" | "scrolled" | "scrolled-doc";
        }
      ) => Rendition;
      destroy: () => void;
    };
  
    export default function ePub(url: string): Book;
  }