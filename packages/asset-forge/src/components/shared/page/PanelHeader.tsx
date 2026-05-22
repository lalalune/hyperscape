/**
 * PanelHeader — inside-panel section header.
 *
 * Used inside Settings tab panels and similar nested surfaces. Has a
 * display-font title + optional description paragraph + right-aligned
 * action slot. Different from `SectionHeader` which is for top-level
 * page chaptering (numbered).
 */

import React from "react";

interface PanelHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PanelHeader({ title, description, action }: PanelHeaderProps) {
  return (
    <header className="mb-6 pb-5 border-b border-border-primary flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h2 className="font-display text-xl font-medium text-text-primary tracking-tight mb-1">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-text-tertiary leading-relaxed max-w-prose">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}
