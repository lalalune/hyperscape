/**
 * StatusDot — small live-pulse indicator used in status pills, member
 * row tone markers, system status footers.
 *
 * Tones map to semantic colors:
 *   online — Verdant (success); operational subsystems, signed-in
 *   ready  — Forge Gold; idle but ready to act
 *   active — Aether Blue; in-session indicators (current build, locked)
 *   idle   — text-tertiary; offline / not connected / placeholder
 */

import React from "react";

export type StatusDotTone = "online" | "ready" | "active" | "idle";

interface StatusDotProps {
  tone?: StatusDotTone;
  className?: string;
}

const TONE_CLASS: Record<StatusDotTone, string> = {
  online: "bg-success",
  ready: "bg-primary",
  active: "bg-accent-aether",
  idle: "bg-text-tertiary",
};

export function StatusDot({ tone = "online", className = "" }: StatusDotProps) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${TONE_CLASS[tone]} ${className}`}
      style={{ animation: "status-pulse 2.4s ease-in-out infinite" }}
    />
  );
}
