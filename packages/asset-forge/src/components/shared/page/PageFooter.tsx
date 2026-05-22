/**
 * PageFooter — the brand-aligned end-of-page footer.
 *
 *   ForgeLogo · HyperForge · {subtitle}                     {right}
 *
 * The `subtitle` slot is usually a label ("Profile", "Team
 * settings") but accepts JSX for pages that show a breadcrumb chain
 * (e.g. GameDetailPage / TeamDetailPage). The `right` slot is
 * typically a `<StatusDot /> + text` pair or a mono id.
 *
 * Borders, spacing, typography are fixed — pages don't need to
 * customise them. Variants live here when one emerges.
 */

import React from "react";

import { ForgeLogo } from "../ForgeLogo";

interface PageFooterProps {
  /** Right-of-the-bullet label (e.g. "Profile", "Teams"). */
  subtitle: React.ReactNode;
  /** Right-hand content (status pill, mono id, etc.). */
  right?: React.ReactNode;
}

export function PageFooter({ subtitle, right }: PageFooterProps) {
  return (
    <footer className="pt-10 border-t border-border-primary">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-center gap-3">
          <ForgeLogo size={18} />
          <span className="font-display text-sm font-medium text-text-secondary tracking-tight">
            HyperForge
          </span>
          <span className="text-text-tertiary/40">·</span>
          {typeof subtitle === "string" ? (
            <span className="text-[11px] text-text-tertiary uppercase tracking-[0.14em]">
              {subtitle}
            </span>
          ) : (
            subtitle
          )}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </footer>
  );
}
