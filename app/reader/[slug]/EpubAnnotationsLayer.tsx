"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AnnotationKind = "highlight" | "underline" | "comment";
type SyncState = "local" | "syncing" | "cloud";

type ReaderAnnotation = {
  id: string;
  kind: AnnotationKind;
  sectionSignature: string;
  start: number;
  end: number;
  text: string;
  note: string;
  createdAt: string;
};

type PendingSelection = {
  sectionSignature: string;
  start: number;
  end: number;
  text: string;
};

type TextSnapshot = {
  nodes: Text[];
  text: string;
};

type HighlightRegistry = {
  set: (name: string, highlight: unknown) => void;
  delete: (name: string) => void;
};

type HighlightWindow = Window & {
  Highlight?: new (...ranges: Range[]) => unknown;
  CSS: typeof CSS & {
    highlights?: HighlightRegistry;
  };
};

const MAX_ANNOTATIONS = 500;
const MAX_SELECTED_TEXT = 5000;
const MAX_NOTE_LENGTH = 3000;
const REMOTE_SAVE_DELAY_MS = 700;
const HIGHLIGHT_NAME = "libroseller-reader-highlights";
const UNDERLINE_NAME = "libroseller-reader-underlines";
const COMMENT_NAME = "libroseller-reader-comments";
const STYLE_ID = "libroseller-reader-annotation-style";

function storageKey(progressKey: string) {
  return `libroseller:epub-annotations:${progressKey}`;
}

function safeId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function isAnnotationKind(value: unknown): value is AnnotationKind {
  return value === "highlight" || value === "underline" || value === "comment";
}

function parseAnnotation(value: unknown): ReaderAnnotation | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const sectionSignature =
    typeof item.sectionSignature === "string" ? item.sectionSignature.trim() : "";
  const start = Number(item.start);
  const end = Number(item.end);
  const text = typeof item.text === "string" ? item.text.trim() : "";
  const note = typeof item.note === "string" ? item.note : "";
  const createdAt =
    typeof item.createdAt === "string" && item.createdAt
      ? item.createdAt
      : new Date().toISOString();

  if (
    !id ||
    !isAnnotationKind(item.kind) ||
    !sectionSignature ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    !text
  ) {
    return null;
  }

  return {
    id,
    kind: item.kind,
    sectionSignature,
    start,
    end,
    text: text.slice(0, MAX_SELECTED_TEXT),
    note: note.slice(0, MAX_NOTE_LENGTH),
    createdAt,
  };
}

function annotationIdentity(item: ReaderAnnotation) {
  return `${item.kind}:${item.sectionSignature}:${item.start}:${item.end}`;
}

function mergeAnnotations(...groups: ReaderAnnotation[][]) {
  const byIdentity = new Map<string, ReaderAnnotation>();

  for (const group of groups) {
    for (const item of group) {
      const key = annotationIdentity(item);
      const previous = byIdentity.get(key);

      if (!previous) {
        byIdentity.set(key, item);
        continue;
      }

      const previousTime = new Date(previous.createdAt).getTime();
      const nextTime = new Date(item.createdAt).getTime();
      if (!Number.isFinite(previousTime) || nextTime >= previousTime) {
        byIdentity.set(key, item);
      }
    }
  }

  return Array.from(byIdentity.values())
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })
    .slice(0, MAX_ANNOTATIONS);
}

function hashText(text: string) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${text.length}-${(hash >>> 0).toString(36)}`;
}

function getTextSnapshot(doc: Document): TextSnapshot {
  if (!doc.body) return { nodes: [], text: "" };

  const nodes: Text[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      const tag = parent?.tagName.toLowerCase();

      if (
        tag === "script" ||
        tag === "style" ||
        tag === "noscript" ||
        parent?.closest("[data-libroseller-ignore-annotation]")
      ) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  return {
    nodes,
    text: nodes.map((node) => node.data).join(""),
  };
}

function getNodeGlobalOffset(nodes: Text[], target: Node, localOffset: number) {
  let total = 0;

  for (const node of nodes) {
    if (node === target) {
      return total + Math.max(0, Math.min(localOffset, node.data.length));
    }
    total += node.data.length;
  }

  return -1;
}

function rangeFromOffsets(
  doc: Document,
  snapshot: TextSnapshot,
  start: number,
  end: number
) {
  if (start < 0 || end <= start || end > snapshot.text.length) return null;

  let cursor = 0;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startOffset = 0;
  let endOffset = 0;

  for (const node of snapshot.nodes) {
    const next = cursor + node.data.length;

    if (!startNode && start >= cursor && start <= next) {
      startNode = node;
      startOffset = Math.min(node.data.length, Math.max(0, start - cursor));
    }

    if (endNode === null && end >= cursor && end <= next) {
      endNode = node;
      endOffset = Math.min(node.data.length, Math.max(0, end - cursor));
      break;
    }

    cursor = next;
  }

  if (!startNode || !endNode) return null;

  try {
    const range = doc.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return range;
  } catch {
    return null;
  }
}

function ensureAnnotationStyles(doc: Document) {
  if (doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    ::highlight(${HIGHLIGHT_NAME}) {
      background-color: rgba(250, 204, 21, 0.58);
      color: inherit;
    }
    ::highlight(${UNDERLINE_NAME}) {
      background-color: transparent;
      text-decoration-line: underline;
      text-decoration-color: rgba(16, 185, 129, 0.98);
      text-decoration-thickness: 2px;
      text-underline-offset: 3px;
      color: inherit;
    }
    ::highlight(${COMMENT_NAME}) {
      background-color: rgba(56, 189, 248, 0.26);
      text-decoration-line: underline;
      text-decoration-style: dotted;
      text-decoration-color: rgba(2, 132, 199, 0.98);
      text-decoration-thickness: 2px;
      text-underline-offset: 3px;
      color: inherit;
    }
  `;

  doc.head?.appendChild(style);
}

function applyAnnotationsToDocument(
  doc: Document,
  annotations: ReaderAnnotation[]
) {
  if (!doc.body) return;

  const win = doc.defaultView as HighlightWindow | null;
  const registry = win?.CSS?.highlights;
  const HighlightCtor = win?.Highlight;

  if (!registry || !HighlightCtor) return;

  ensureAnnotationStyles(doc);

  const snapshot = getTextSnapshot(doc);
  const signature = hashText(snapshot.text);
  const matching = annotations.filter(
    (annotation) => annotation.sectionSignature === signature
  );

  const highlightRanges: Range[] = [];
  const underlineRanges: Range[] = [];
  const commentRanges: Range[] = [];

  for (const annotation of matching) {
    const range = rangeFromOffsets(
      doc,
      snapshot,
      annotation.start,
      annotation.end
    );

    if (!range) continue;

    if (annotation.kind === "comment") {
      commentRanges.push(range);
    } else if (annotation.kind === "underline") {
      underlineRanges.push(range);
    } else {
      highlightRanges.push(range);
    }
  }

  registry.delete(HIGHLIGHT_NAME);
  registry.delete(UNDERLINE_NAME);
  registry.delete(COMMENT_NAME);

  if (highlightRanges.length > 0) {
    registry.set(HIGHLIGHT_NAME, new HighlightCtor(...highlightRanges));
  }

  if (underlineRanges.length > 0) {
    registry.set(UNDERLINE_NAME, new HighlightCtor(...underlineRanges));
  }

  if (commentRanges.length > 0) {
    registry.set(COMMENT_NAME, new HighlightCtor(...commentRanges));
  }
}

function readAnnotations(progressKey: string): ReaderAnnotation[] {
  try {
    const raw = localStorage.getItem(storageKey(progressKey));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(parseAnnotation)
      .filter((item): item is ReaderAnnotation => Boolean(item))
      .slice(0, MAX_ANNOTATIONS);
  } catch {
    return [];
  }
}

function writeAnnotations(progressKey: string, annotations: ReaderAnnotation[]) {
  try {
    localStorage.setItem(
      storageKey(progressKey),
      JSON.stringify(annotations.slice(0, MAX_ANNOTATIONS))
    );
  } catch {
    // La sesión actual conserva las anotaciones aunque Storage esté lleno.
  }
}

function clearIframeSelections() {
  document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((iframe) => {
    try {
      iframe.contentWindow?.getSelection()?.removeAllRanges();
    } catch {
      // EPUB.js puede reemplazar el iframe durante la navegación.
    }
  });
}

function kindLabel(kind: AnnotationKind) {
  if (kind === "comment") return "Comentario";
  if (kind === "underline") return "Subrayado";
  return "Resaltado";
}

function kindDotClass(kind: AnnotationKind) {
  if (kind === "comment") return "bg-sky-400";
  if (kind === "underline") return "bg-emerald-400";
  return "bg-amber-300";
}

export default function EpubAnnotationsLayer({
  progressKey,
  annotationsUrl,
}: {
  progressKey: string;
  annotationsUrl?: string;
}) {
  const annotationsRef = useRef<ReaderAnnotation[]>([]);
  const attachedDocsRef = useRef(new WeakSet<Document>());
  const loadedRef = useRef(false);
  const remoteBootFinishedRef = useRef(false);
  const remoteDisabledRef = useRef(false);
  const remoteSaveTimerRef = useRef<number | null>(null);

  const [annotations, setAnnotations] = useState<ReaderAnnotation[]>([]);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("local");

  const highlightsCount = useMemo(
    () => annotations.filter((item) => item.kind === "highlight").length,
    [annotations]
  );
  const underlinesCount = useMemo(
    () => annotations.filter((item) => item.kind === "underline").length,
    [annotations]
  );
  const commentsCount = useMemo(
    () => annotations.filter((item) => item.kind === "comment").length,
    [annotations]
  );

  const applyEverywhere = useCallback((items: ReaderAnnotation[]) => {
    document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((iframe) => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) applyAnnotationsToDocument(doc, items);
      } catch {
        // Solo se anotan iframes EPUB accesibles desde el mismo origen.
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadedRef.current = false;
    remoteBootFinishedRef.current = false;
    remoteDisabledRef.current = false;
    setSyncState("local");

    const local = readAnnotations(progressKey);
    annotationsRef.current = local;
    setAnnotations(local);
    loadedRef.current = true;

    if (!annotationsUrl) {
      remoteBootFinishedRef.current = true;
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const response = await fetch(annotationsUrl, {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (cancelled) return;

        if (!response.ok) {
          if (response.status === 503) remoteDisabledRef.current = true;
          remoteBootFinishedRef.current = true;
          setSyncState("local");
          return;
        }

        const payload = (await response.json()) as { annotations?: unknown };
        const remote = Array.isArray(payload.annotations)
          ? payload.annotations
              .map(parseAnnotation)
              .filter((item): item is ReaderAnnotation => Boolean(item))
          : [];
        const merged = mergeAnnotations(local, remote);

        annotationsRef.current = merged;
        setAnnotations(merged);
        remoteBootFinishedRef.current = true;
        setSyncState("cloud");
      } catch {
        if (!cancelled) {
          remoteBootFinishedRef.current = true;
          setSyncState("local");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [annotationsUrl, progressKey]);

  useEffect(() => {
    annotationsRef.current = annotations;

    if (loadedRef.current) {
      writeAnnotations(progressKey, annotations);
    }

    applyEverywhere(annotations);

    if (
      !annotationsUrl ||
      !remoteBootFinishedRef.current ||
      remoteDisabledRef.current
    ) {
      return;
    }

    if (remoteSaveTimerRef.current !== null) {
      window.clearTimeout(remoteSaveTimerRef.current);
    }

    setSyncState("syncing");
    remoteSaveTimerRef.current = window.setTimeout(() => {
      remoteSaveTimerRef.current = null;
      const snapshot = annotationsRef.current.slice(0, MAX_ANNOTATIONS);

      void (async () => {
        try {
          const response = await fetch(annotationsUrl, {
            method: "PUT",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ annotations: snapshot }),
          });

          if (response.ok) {
            setSyncState("cloud");
            return;
          }

          if (response.status === 503) remoteDisabledRef.current = true;
          setSyncState("local");
        } catch {
          setSyncState("local");
        }
      })();
    }, REMOTE_SAVE_DELAY_MS);

    return () => {
      if (remoteSaveTimerRef.current !== null) {
        window.clearTimeout(remoteSaveTimerRef.current);
        remoteSaveTimerRef.current = null;
      }
    };
  }, [annotations, annotationsUrl, applyEverywhere, progressKey]);

  useEffect(() => {
    let stopped = false;

    const captureSelection = (doc: Document) => {
      window.setTimeout(() => {
        if (stopped || !doc.body) return;

        const selection = doc.defaultView?.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          return;
        }

        const range = selection.getRangeAt(0);
        const rawText = range.toString();
        const displayText = rawText.trim();

        if (!displayText) return;

        const snapshot = getTextSnapshot(doc);
        let start = getNodeGlobalOffset(
          snapshot.nodes,
          range.startContainer,
          range.startOffset
        );
        let end = getNodeGlobalOffset(
          snapshot.nodes,
          range.endContainer,
          range.endOffset
        );

        if (start < 0 || end <= start) {
          const fallback = snapshot.text.indexOf(rawText);
          if (fallback < 0) return;
          start = fallback;
          end = fallback + rawText.length;
        }

        setPending({
          sectionSignature: hashText(snapshot.text),
          start,
          end,
          text: displayText.slice(0, MAX_SELECTED_TEXT),
        });
      }, 10);
    };

    const attachDocument = (doc: Document | null) => {
      if (!doc?.body) return;

      applyAnnotationsToDocument(doc, annotationsRef.current);

      if (attachedDocsRef.current.has(doc)) return;
      attachedDocsRef.current.add(doc);

      const onMouseUp = () => captureSelection(doc);
      const onTouchEnd = () => captureSelection(doc);

      doc.addEventListener("mouseup", onMouseUp);
      doc.addEventListener("touchend", onTouchEnd, { passive: true });
    };

    const attachIframe = (iframe: HTMLIFrameElement) => {
      const load = () => {
        try {
          attachDocument(iframe.contentDocument);
        } catch {
          // El iframe todavía puede estar navegando.
        }
      };

      iframe.addEventListener("load", load);
      load();
    };

    const known = new WeakSet<HTMLIFrameElement>();
    const scan = () => {
      document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((iframe) => {
        if (known.has(iframe)) return;
        known.add(iframe);
        attachIframe(iframe);
      });
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, []);

  const savePending = useCallback(
    (kind: AnnotationKind, note = "") => {
      if (!pending) return;

      const next: ReaderAnnotation = {
        id: safeId(),
        kind,
        sectionSignature: pending.sectionSignature,
        start: pending.start,
        end: pending.end,
        text: pending.text,
        note: note.trim().slice(0, MAX_NOTE_LENGTH),
        createdAt: new Date().toISOString(),
      };

      setAnnotations((current) => {
        const withoutDuplicate = current.filter(
          (item) => annotationIdentity(item) !== annotationIdentity(next)
        );

        return [next, ...withoutDuplicate].slice(0, MAX_ANNOTATIONS);
      });

      setPending(null);
      setComposerOpen(false);
      setNoteDraft("");
      clearIframeSelections();
    },
    [pending]
  );

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    if (
      !window.confirm(
        "¿Eliminar todos tus resaltados, subrayados y comentarios de este libro?"
      )
    ) {
      return;
    }
    setAnnotations([]);
  }, []);

  return (
    <>
      {pending ? (
        <div className="fixed bottom-20 left-1/2 z-[90] w-[min(94vw,650px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#07131d]/95 p-2.5 text-white shadow-2xl backdrop-blur-xl">
          <p className="mb-2 line-clamp-2 text-xs leading-5 text-white/60">
            “{pending.text}”
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => savePending("highlight")}
              className="rounded-xl bg-amber-300 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-200"
            >
              Resaltar
            </button>
            <button
              type="button"
              onClick={() => savePending("underline")}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-300"
            >
              Subrayar
            </button>
            <button
              type="button"
              onClick={() => {
                setNoteDraft("");
                setComposerOpen(true);
              }}
              className="rounded-xl bg-sky-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-sky-300"
            >
              Comentar
            </button>
            <button
              type="button"
              onClick={() => {
                setPending(null);
                clearIframeSelections();
              }}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/65 hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setPanelOpen((value) => !value)}
        className="fixed bottom-[70px] right-4 z-[75] flex items-center gap-2 rounded-2xl border border-white/15 bg-[#09131d]/95 px-4 py-2.5 text-xs font-bold text-white shadow-2xl backdrop-blur-xl hover:bg-[#102231]"
        aria-label="Abrir resaltados, subrayados y comentarios"
      >
        <span aria-hidden="true">✎</span>
        <span>Notas</span>
        <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-300">
          {annotations.length}
        </span>
      </button>

      {panelOpen ? (
        <aside className="fixed bottom-20 right-4 top-20 z-[80] flex w-[min(94vw,410px)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#08131d]/98 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-black">Mis anotaciones</h2>
              <p className="mt-0.5 text-[11px] text-white/45">
                {highlightsCount} resaltados · {underlinesCount} subrayados · {commentsCount} comentarios
              </p>
              <p className="mt-1 text-[10px] font-semibold text-emerald-300/75">
                {syncState === "cloud"
                  ? "Guardado en tu cuenta"
                  : syncState === "syncing"
                    ? "Sincronizando…"
                    : "Guardado localmente"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-lg text-white/60 hover:bg-white/10"
              aria-label="Cerrar panel"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {annotations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-5 text-center">
                <p className="text-sm font-semibold text-white/75">
                  Aún no tienes anotaciones
                </p>
                <p className="mt-2 text-xs leading-5 text-white/40">
                  Selecciona una frase o un párrafo dentro del libro y elige Resaltar, Subrayar o Comentar.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {annotations.map((annotation) => (
                  <article
                    key={annotation.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 h-3 w-3 shrink-0 rounded-full ${kindDotClass(annotation.kind)}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
                          {kindLabel(annotation.kind)}
                        </p>
                        <p className="mt-1 line-clamp-4 text-xs leading-5 text-white/75">
                          “{annotation.text}”
                        </p>
                        {annotation.note ? (
                          <p className="mt-2 rounded-xl bg-sky-400/10 px-3 py-2 text-xs leading-5 text-sky-100">
                            {annotation.note}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[10px] text-white/30">
                          {new Date(annotation.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAnnotation(annotation.id)}
                        className="rounded-lg px-2 py-1 text-xs text-rose-300/75 hover:bg-rose-400/10"
                        aria-label="Eliminar anotación"
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {annotations.length > 0 ? (
            <div className="border-t border-white/10 p-3">
              <button
                type="button"
                onClick={clearAll}
                className="w-full rounded-xl border border-rose-300/15 px-3 py-2 text-xs font-semibold text-rose-200/70 hover:bg-rose-400/10"
              >
                Borrar todas las anotaciones
              </button>
            </div>
          ) : null}
        </aside>
      ) : null}

      {composerOpen && pending ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#09131d] p-5 text-white shadow-2xl">
            <h2 className="text-base font-black">Comentario del lector</h2>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/45">
              “{pending.text}”
            </p>
            <textarea
              value={noteDraft}
              onChange={(event) =>
                setNoteDraft(event.target.value.slice(0, MAX_NOTE_LENGTH))
              }
              autoFocus
              rows={6}
              placeholder="Escribe aquí tu reflexión, idea o comentario sobre este párrafo…"
              className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-sky-300/50"
            />
            <div className="mt-2 text-right text-[10px] text-white/30">
              {noteDraft.length}/{MAX_NOTE_LENGTH}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setComposerOpen(false);
                  setNoteDraft("");
                }}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/60 hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => savePending("comment", noteDraft)}
                disabled={!noteDraft.trim()}
                className="rounded-xl bg-sky-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Guardar comentario
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
