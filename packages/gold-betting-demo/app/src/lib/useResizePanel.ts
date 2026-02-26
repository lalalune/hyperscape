import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Returns true when the viewport is at or below `breakpoint` px wide.
 * Tracks resize events so components re-render when the user rotates or
 * resizes. The default breakpoint (768) matches our CSS resize-handle hide rule.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= breakpoint;
  });

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Returns a draggable panel size value (pixels) that persists across reloads.
 *
 * `startDrag(event, axis, invert?)` — call from the resize handle's onMouseDown.
 * - axis: "x" for horizontal handles, "y" for vertical handles.
 * - invert: true when dragging in the positive direction should SHRINK the panel
 *           (e.g. right-side sidebar: dragging right → sidebar gets narrower).
 */
export function useResizePanel(options: {
  initial: number;
  min: number;
  max: number;
  storageKey: string;
}) {
  const { initial, min, max, storageKey } = options;

  const [size, setSize] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const n = parseFloat(stored);
        if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
      }
    } catch {
      // private-mode or SSR — fall back to initial
    }
    return initial;
  });

  // Keep a ref so the drag closure always reads the latest size at drag-start,
  // not a stale captured value.
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const startDrag = useCallback(
    (e: React.MouseEvent, axis: "x" | "y", invert = false) => {
      e.preventDefault();
      const startPos = axis === "x" ? e.clientX : e.clientY;
      const startSize = sizeRef.current;

      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        const raw = (axis === "x" ? ev.clientX : ev.clientY) - startPos;
        const delta = invert ? -raw : raw;
        const next = Math.max(min, Math.min(max, startSize + delta));
        setSize(next);
        try {
          localStorage.setItem(storageKey, String(next));
        } catch {
          // ignore write errors
        }
      };

      const onUp = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [min, max, storageKey],
  );

  /** Reset to initial size and clear localStorage. */
  const reset = useCallback(() => {
    setSize(initial);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [initial, storageKey]);

  return { size, startDrag, reset };
}
