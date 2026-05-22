/**
 * NotFoundPage — catch-all 404.
 *
 * Brand-aligned: atmospheric backdrop, FORGE mark, restrained CTA back
 * to dashboard. No tagline repetition — this is a system message.
 */

import { ArrowRight, ChevronLeft, Home } from "lucide-react";
import React from "react";
import { Link, useLocation } from "react-router-dom";

import { ForgeLogo } from "../components/shared/ForgeLogo";
import { ROUTES } from "../constants";

export function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="relative min-h-full bg-bg-primary overflow-hidden flex items-center justify-center">
      {/* Atmospheric backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(28,30,34,0.7) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 5%, rgba(212,175,55,0.18) 50%, transparent 95%)",
          animation: "celestial-pulse 8s ease-in-out infinite",
        }}
      />

      <div className="relative max-w-xl mx-auto px-10 py-16 text-center">
        <ForgeLogo size={56} className="mx-auto mb-8" />

        <div className="flex items-baseline justify-center gap-4 mb-4">
          <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
            404
          </span>
          <span className="font-display text-base font-medium text-text-primary tracking-tight">
            Not found
          </span>
        </div>

        <h1 className="font-display text-4xl md:text-5xl font-medium text-text-primary tracking-tight leading-[1.05] mb-4">
          This <span className="text-primary">world</span> doesn&apos;t exist.
        </h1>
        <p className="text-base text-text-tertiary leading-relaxed mb-2">
          The route you&apos;re looking for hasn&apos;t been forged yet, or it
          may have been moved.
        </p>
        <p className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case tracking-normal mb-10">
          {location.pathname}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-center gap-3">
          <Link
            to={ROUTES.DASHBOARD}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md bg-primary text-bg-primary text-sm font-medium hover:bg-primary-dark transition-colors duration-500 ease-out"
          >
            <Home size={14} strokeWidth={1.75} />
            Return to dashboard
            <ArrowRight size={14} strokeWidth={1.75} />
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-300 ease-out"
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
