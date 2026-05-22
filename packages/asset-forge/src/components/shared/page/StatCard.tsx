/**
 * StatCard — labeled value display used in overview rows
 * (e.g. team stats, game stats, dashboard library counts).
 *
 *   ┌─────────────────┐
 *   │ LABEL           │
 *   │                 │
 *   │ 42              │
 *   │ MEMBERS         │
 *   └─────────────────┘
 *
 * `valueMono` toggles tabular-nums (default true — most stats are numeric).
 */

import React from "react";

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  valueMono?: boolean;
  /** Truncate long values with ellipsis (e.g. module ids on GameDetailPage). */
  truncateValue?: boolean;
}

export function StatCard({
  label,
  value,
  sub,
  valueMono = true,
  truncateValue = false,
}: StatCardProps) {
  return (
    <div className="rounded-lg bg-bg-tertiary border border-border-primary p-6">
      <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-3">
        {label}
      </p>
      <p
        className={`font-display text-2xl font-medium text-text-primary tracking-tight leading-none mb-2 ${
          valueMono ? "tabular-nums" : ""
        }${truncateValue ? " truncate" : ""}`}
      >
        {value}
      </p>
      <p className="text-[11px] text-text-tertiary uppercase tracking-[0.1em]">
        {sub}
      </p>
    </div>
  );
}
