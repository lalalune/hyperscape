/**
 * Right-rail tab button (B1'.6).
 *
 * Phase 1.2 fourteenth carve from DesignWithAIDialog. The
 * right-side panel toggles between Plan / Plugins / etc. via a
 * row of tab buttons; this is the underline-on-active button.
 *
 * Self-contained — no React state, no external deps, just a
 * styled <button> with an active-state underline. Lives in its
 * own file so the dialog's render JSX stays clean.
 */

import React from "react";

export interface RightTabButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

export function RightTabButton({
  active,
  label,
  onClick,
}: RightTabButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 relative px-3 py-3 text-[11px] font-semibold transition-colors ${
        active
          ? "text-text-primary"
          : "text-text-tertiary hover:text-text-secondary"
      }`}
    >
      {label}
      {active && (
        <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
      )}
    </button>
  );
}
