/**
 * AtmosphericScene — the FORGE brand backdrop.
 *
 * A radial Graphite ellipse anchored to the top + four animated
 * "monolith" silhouettes flanking the content (positioned via
 * `calc(50% - Npx)` so they track the content edges at every
 * viewport width) + an optional Forge Gold horizon line.
 *
 * Used by every full-page surface (dashboard, profile, teams,
 * settings, etc.). Centralized so brand tweaks propagate once.
 */

import React from "react";

interface AtmosphericSceneProps {
  /**
   * Height of the top Graphite ellipse. Pages with shorter heroes use
   * a smaller value (520px on Settings, 640px on most, 720px on
   * Dashboard hero).
   */
  topEllipseHeight?: number;
  /**
   * Y position of the primary Forge Gold horizon line. Omit to skip
   * (e.g. tight pages where the horizon would land in the middle of
   * card content). Default 440px tracks the hero header on most pages.
   */
  horizonY?: number | null;
  /**
   * Optional second horizon further down the page for tall content.
   */
  secondaryHorizonY?: number;
}

export function AtmosphericScene({
  topEllipseHeight = 640,
  horizonY = 440,
  secondaryHorizonY,
}: AtmosphericSceneProps = {}) {
  const halfContent = 600;
  const monoliths = [
    {
      side: "left" as const,
      offset: halfContent + 80,
      opacity: 0.45,
      dur: 22,
      delay: 0,
    },
    {
      side: "left" as const,
      offset: halfContent + 8,
      opacity: 0.75,
      dur: 18,
      delay: -7,
    },
    {
      side: "right" as const,
      offset: halfContent + 8,
      opacity: 0.75,
      dur: 20,
      delay: -12,
    },
    {
      side: "right" as const,
      offset: halfContent + 80,
      opacity: 0.45,
      dur: 24,
      delay: -3,
    },
  ];

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Volumetric Graphite ellipse anchored to top */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: `${topEllipseHeight}px`,
          background:
            "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(28,30,34,0.75) 0%, transparent 75%)",
        }}
      />

      {/* Architectural monoliths flanking content */}
      {monoliths.map((m, i) => (
        <div
          key={i}
          className="absolute inset-y-0 w-px"
          style={{
            [m.side]: `calc(50% - ${m.offset}px)`,
            background: `linear-gradient(180deg, transparent 0%, rgba(28,30,34,${m.opacity}) 30%, rgba(28,30,34,${m.opacity}) 70%, transparent 100%)`,
            animation: `drift-y ${m.dur}s ease-in-out infinite`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}

      {/* Primary Forge Gold horizon — celestial light, breathing */}
      {horizonY != null && (
        <div
          className="absolute inset-x-0 h-px"
          style={{
            top: `${horizonY}px`,
            background:
              "linear-gradient(90deg, transparent 5%, rgba(212,175,55,0.22) 50%, transparent 95%)",
            animation: "celestial-pulse 8s ease-in-out infinite",
          }}
        />
      )}

      {/* Secondary horizon — softer, longer cycle */}
      {secondaryHorizonY !== undefined && (
        <div
          className="absolute inset-x-0 h-px"
          style={{
            top: `${secondaryHorizonY}px`,
            background:
              "linear-gradient(90deg, transparent 15%, rgba(212,175,55,0.10) 50%, transparent 85%)",
            animation: "celestial-pulse 14s ease-in-out infinite",
            animationDelay: "-4s",
          }}
        />
      )}
    </div>
  );
}
