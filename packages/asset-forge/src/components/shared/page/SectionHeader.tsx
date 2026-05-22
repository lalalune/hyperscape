/**
 * SectionHeader — numbered editorial section header used across pages.
 *
 * Pattern: "00 / TITLE   meta"  with optional right-aligned action.
 * Hairline border-bottom for editorial chaptering.
 *
 * For settings panel-internal headers (no number, with description
 * paragraph), use `PanelHeader` instead.
 */

import React from "react";

interface SectionHeaderProps {
  /** Two-digit section index, e.g. "01", "02". */
  number: string;
  title: string;
  /** Subtitle inline with the title — uppercase tracked. */
  meta?: React.ReactNode;
  /** Right-aligned action button or link. */
  action?: React.ReactNode;
}

export function SectionHeader({
  number,
  title,
  meta,
  action,
}: SectionHeaderProps) {
  return (
    <header className="mb-8 pb-4 border-b border-border-primary flex items-baseline justify-between gap-4">
      <div className="flex items-baseline gap-4 min-w-0">
        <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em] flex-shrink-0">
          {number}
        </span>
        <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
          {title}
        </h2>
        {meta && (
          <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] truncate">
            {meta}
          </span>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}
