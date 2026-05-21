/**
 * TemperatureGauge — arctic-survival's visible proof-of-composition HUD.
 *
 * When the editor user picks "Arctic Survival" in the toolbar game
 * selector and hits Play, the plugin's onEnable walks `ctx.widgets`
 * (host-provided) and registers this widget on the process-wide
 * UI registry. The editor's ManifestRenderer then mounts the
 * component wherever the active layout positions it.
 *
 * Under "Hyperia" or "Shooter Demo" the widget is never
 * registered — so the temperature gauge is absent. Visual tell
 * that the game-plugin set actually drives what the user sees,
 * not just what's in memory.
 *
 * Deliberately minimal: pure SVG, no state, no external deps
 * beyond React + the ui-framework's `defineWidget` schema
 * authoring. Cold exposure animation + warmth interaction live
 * in future cuts.
 */

import {
  defineWidget,
  type Widget,
  type WidgetRegistration,
} from "@hyperforge/ui-framework";
import React from "react";
import { z } from "zod";

/**
 * Props the gauge exposes through its Zod schema. Authors can
 * tune the size, the cold/warm tints, and the current
 * temperature level (-1..1 — negative = cold danger, positive
 * = safe heat-source range).
 */
export const temperatureGaugePropsSchema = z.object({
  size: z.number().min(48).max(256).default(96),
  /** Current temperature level normalized to [-1, 1]. */
  level: z.number().min(-1).max(1).default(0),
  /** Tint for the cold zone fill (left half). */
  coldColor: z.string().default("#5eb6ff"),
  /** Tint for the warm zone fill (right half). */
  warmColor: z.string().default("#ff7e5e"),
});

type TemperatureGaugeProps = z.infer<typeof temperatureGaugePropsSchema>;

/**
 * Widget schema. `defineWidget` validates the manifest + default
 * props at import time so malformed authoring fails at
 * `bun build`, not at host registration.
 */
export const temperatureGaugeWidget: Widget<TemperatureGaugeProps> =
  defineWidget({
    manifest: {
      id: "com.hyperforge.arctic-survival.temperature-gauge",
      name: "Temperature Gauge",
      category: "hud",
      defaultSize: { width: 4, height: 2 },
    },
    propsSchema: temperatureGaugePropsSchema,
    defaultProps: {
      size: 96,
      level: 0,
      coldColor: "#5eb6ff",
      warmColor: "#ff7e5e",
    },
  });

/**
 * React component. Renders a horizontal needle gauge — center
 * is "comfortable" (neither freezing nor overheating), needle
 * sweeps left toward cold-danger or right toward heat-source
 * comfort. Sized by props; positioned by the host layout.
 */
export function TemperatureGauge(
  props: TemperatureGaugeProps,
): React.ReactElement {
  const { size, level, coldColor, warmColor } = props;
  // Gauge is twice as wide as tall (defaultSize 4×2).
  const w = size;
  const h = size / 2;
  const trackY = h / 2;
  const trackHeight = Math.max(4, h / 6);
  // Map level [-1, 1] → x coordinate [0, w].
  const needleX = ((level + 1) / 2) * w;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ pointerEvents: "none" }}
      aria-label={`Temperature gauge, level ${level.toFixed(2)}`}
    >
      {/* Cold half — left side of the track. */}
      <rect
        x={0}
        y={trackY - trackHeight / 2}
        width={w / 2}
        height={trackHeight}
        fill={coldColor}
        opacity={0.6}
      />
      {/* Warm half — right side of the track. */}
      <rect
        x={w / 2}
        y={trackY - trackHeight / 2}
        width={w / 2}
        height={trackHeight}
        fill={warmColor}
        opacity={0.6}
      />
      {/* Center comfort tick. */}
      <line
        x1={w / 2}
        y1={trackY - trackHeight}
        x2={w / 2}
        y2={trackY + trackHeight}
        stroke="#ffffff"
        strokeOpacity={0.5}
        strokeWidth={1}
      />
      {/* Needle. */}
      <circle
        cx={needleX}
        cy={trackY}
        r={trackHeight}
        fill="#ffffff"
        stroke="#000000"
        strokeOpacity={0.4}
        strokeWidth={1}
      />
    </svg>
  );
}

/**
 * Bundled registration — pairs the widget schema with its React
 * renderer. The plugin's `onEnable` passes this to the host's
 * `ctx.widgets.register(...)` adapter.
 */
export const temperatureGaugeRegistration: WidgetRegistration<
  TemperatureGaugeProps,
  React.ComponentType<TemperatureGaugeProps>
> = {
  widget: temperatureGaugeWidget,
  Component: TemperatureGauge,
};
