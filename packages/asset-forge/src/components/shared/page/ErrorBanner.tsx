/**
 * ErrorBanner — brand-aligned error display used across pages.
 *
 *   inline (default)  — sits in the page flow above content
 *                       (`p-6 mb-8`, left-aligned text)
 *   page              — full-bleed "couldn't load this surface" state
 *                       (`p-8 text-center`, used as the page body when
 *                       the primary fetch fails)
 *
 * Optional `meta` renders a mono caption underneath the message —
 * usually the id of the resource that couldn't be loaded.
 */

import React from "react";

interface ErrorBannerProps {
  message: string;
  variant?: "inline" | "page";
  meta?: string;
}

export function ErrorBanner({
  message,
  variant = "inline",
  meta,
}: ErrorBannerProps) {
  if (variant === "page") {
    return (
      <div className="rounded-lg bg-bg-tertiary border border-error/40 p-8 text-center">
        <p className={`text-sm text-error${meta ? " mb-2" : ""}`}>{message}</p>
        {meta && (
          <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case">
            {meta}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-bg-tertiary border border-error/40 p-6 mb-8">
      <p className="text-sm text-error">{message}</p>
    </div>
  );
}
