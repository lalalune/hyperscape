/**
 * Compact Status HUD
 *
 * Mobile-optimized HP and Prayer display using themed orbs.
 * Uses the shared StatusOrb component from @/ui.
 *
 * @packageDocumentation
 */

import React, { useMemo, type CSSProperties } from "react";
import { useMobileLayout, StatusOrb } from "@/ui";
import { getMobileUISizes } from "./mobileUISizes";
import type { StatusValue } from "../types";

interface CompactStatusHUDProps {
  /** Health points */
  health: StatusValue | null | undefined;
  /** Prayer points */
  prayerPoints: StatusValue | null | undefined;
}

/**
 * Compact Status HUD Component
 *
 * Displays HP and Prayer as dark themed orbs.
 */
export function CompactStatusHUD({
  health,
  prayerPoints,
}: CompactStatusHUDProps): React.ReactElement {
  const layout = useMobileLayout();
  const sizes = useMemo(() => getMobileUISizes(layout), [layout]);

  // Normalize values with defaults
  const hp = {
    current: typeof health?.current === "number" ? health.current : 0,
    max: typeof health?.max === "number" ? health.max : 1,
  };
  const prayer = {
    current:
      typeof prayerPoints?.current === "number" ? prayerPoints.current : 1,
    max: typeof prayerPoints?.max === "number" ? prayerPoints.max : 1,
  };

  // Orb size based on status HUD config
  const orbSize = sizes.statusHud.orbSize;

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 0,
    backgroundColor: "transparent",
  };

  return (
    <div style={containerStyle}>
      <StatusOrb
        type="hp"
        current={hp.current}
        max={hp.max}
        size={orbSize}
        icon="♥"
        showValue
        dynamicLabelColor
      />
      <StatusOrb
        type="prayer"
        current={prayer.current}
        max={prayer.max}
        size={orbSize}
        icon="✦"
        showValue
      />
    </div>
  );
}
