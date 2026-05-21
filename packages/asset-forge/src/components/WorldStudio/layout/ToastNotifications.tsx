/**
 * ToastNotifications — UE5-style toast notification system.
 *
 * Module-level pub/sub store so any code can push toasts without React context:
 *
 *   import { pushToast } from "./layout/ToastNotifications";
 *   pushToast({ type: "success", title: "Project saved" });
 *
 * ToastContainer renders toasts in a fixed portal at the bottom-right of
 * the viewport. Each toast slides in from the right with an accent bar,
 * auto-dismiss progress animation, and close button.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToastType = "info" | "success" | "warning" | "error";

interface ToastInput {
  type: ToastType;
  title: string;
  message?: string;
  /** Auto-dismiss duration in ms. Default 4000. Use 0 for persistent. */
  duration?: number;
}

interface Toast extends Required<Omit<ToastInput, "message">> {
  id: number;
  message: string;
  createdAt: number;
}

type Listener = (toasts: Toast[]) => void;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_DURATION = 4000;
const MAX_VISIBLE = 5;

const ACCENT_COLORS: Record<ToastType, string> = {
  info: "#2D8CFF",
  success: "#28D47A",
  warning: "#FF7A00",
  error: "#E84A4A",
};

/* ------------------------------------------------------------------ */
/*  Module-level store                                                 */
/* ------------------------------------------------------------------ */

let nextId = 1;
let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function notify() {
  const snapshot = [...toasts];
  listeners.forEach((fn) => fn(snapshot));
}

/**
 * Push a toast notification from anywhere in the app.
 * No React context required.
 */
function pushToast(input: ToastInput): void {
  const toast: Toast = {
    id: nextId++,
    type: input.type,
    title: input.title,
    message: input.message ?? "",
    duration: input.duration ?? DEFAULT_DURATION,
    createdAt: Date.now(),
  };

  toasts = [...toasts, toast];

  // Trim to max visible
  if (toasts.length > MAX_VISIBLE) {
    toasts = toasts.slice(toasts.length - MAX_VISIBLE);
  }

  notify();
}

function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

function useToasts(): Toast[] {
  const [snapshot, setSnapshot] = useState<Toast[]>(() => [...toasts]);

  useEffect(() => {
    // Sync immediately in case toasts were pushed between render and effect
    setSnapshot([...toasts]);
    return subscribe(setSnapshot);
  }, []);

  return snapshot;
}

/* ------------------------------------------------------------------ */
/*  Single toast card                                                  */
/* ------------------------------------------------------------------ */

function ToastCard({ toast }: { toast: Toast }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accentColor = ACCENT_COLORS[toast.type];

  const handleDismiss = useCallback(() => {
    setExiting(true);
    // Wait for exit animation before removing from store
    setTimeout(() => dismissToast(toast.id), 200);
  }, [toast.id]);

  // Auto-dismiss timer
  useEffect(() => {
    if (toast.duration <= 0) return;

    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, toast.duration);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.duration, handleDismiss]);

  return (
    <div
      role="alert"
      className={`
        relative flex overflow-hidden rounded-md border shadow-lg
        transition-all duration-200 ease-out pointer-events-auto
        ${exiting ? "opacity-0 translate-x-8" : "opacity-100 translate-x-0"}
      `}
      style={{
        backgroundColor: "var(--bg-elevated)",
        borderColor: "var(--border-secondary)",
        minWidth: 300,
        maxWidth: 400,
        boxShadow:
          "0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04)",
        // Slide-in via CSS animation on mount
        animation: exiting
          ? undefined
          : "toast-slide-in 250ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Left accent bar */}
      <div
        className="flex-shrink-0 w-1"
        style={{ backgroundColor: accentColor }}
      />

      {/* Content */}
      <div className="flex-1 px-3 py-2.5 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {toast.title}
            </p>
            {toast.message && (
              <p className="text-[11px] text-text-secondary mt-0.5 leading-snug line-clamp-2">
                {toast.message}
              </p>
            )}
          </div>

          {/* Close button */}
          <button
            className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors text-text-tertiary hover:text-white"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Auto-dismiss progress bar */}
      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/20">
          <div
            className="h-full"
            style={{
              backgroundColor: accentColor,
              opacity: 0.6,
              animation: `toast-progress ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Keyframe styles (injected once)                                    */
/* ------------------------------------------------------------------ */

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes toast-slide-in {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes toast-progress {
      from {
        width: 100%;
      }
      to {
        width: 0%;
      }
    }
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Container (portal)                                                 */
/* ------------------------------------------------------------------ */

export function ToastContainer() {
  const activeToasts = useToasts();

  useEffect(() => {
    injectStyles();
  }, []);

  if (activeToasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {activeToasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body,
  );
}
