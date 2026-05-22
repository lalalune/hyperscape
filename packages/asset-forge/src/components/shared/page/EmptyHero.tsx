/**
 * EmptyHero — empty-state card for section bodies (no data yet).
 *
 * Shows the FORGE mark + display headline + subtitle + optional CTA.
 * Has an atmospheric radial Gold backdrop matching the brand. Used in
 * Continue section on dashboard, team list empty state, etc.
 */

import { Plus } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";

import { ForgeLogo } from "../ForgeLogo";

interface EmptyHeroProps {
  message: string;
  subtitle: string;
  ctaLabel?: string;
  ctaTo?: string;
  /**
   * Fixed total height — used when the empty state needs to match the
   * height of cards in the same row (e.g. dashboard Continue: 320px).
   * Omit for auto-sizing.
   */
  fixedHeight?: number;
}

export function EmptyHero({
  message,
  subtitle,
  ctaLabel,
  ctaTo,
  fixedHeight,
}: EmptyHeroProps) {
  return (
    <div
      className="relative rounded-lg bg-bg-tertiary border border-border-primary p-16 text-center overflow-hidden flex flex-col items-center justify-center"
      style={fixedHeight ? { height: `${fixedHeight}px` } : undefined}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(212,175,55,0.05) 0%, transparent 70%)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(212,175,55,0.12), transparent)",
        }}
      />
      <div className="relative">
        <ForgeLogo size={48} className="mx-auto mb-6 opacity-60" />
        <h3 className="font-display text-xl font-medium text-text-primary tracking-tight mb-3">
          {message}
        </h3>
        <p className="text-sm text-text-tertiary max-w-md mx-auto leading-relaxed mb-6">
          {subtitle}
        </p>
        {ctaLabel && ctaTo && (
          <Link
            to={ctaTo}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-bg-primary text-sm font-medium hover:bg-primary-dark transition-colors duration-500 ease-out"
          >
            <Plus size={14} strokeWidth={2} />
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
