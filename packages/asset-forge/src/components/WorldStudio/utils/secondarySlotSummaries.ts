/**
 * Secondary-slot summary helpers.
 *
 * Phase 1.2 eighth carve from DesignWithAIDialog. The Plan
 * panel renders 14 secondary-slot rows ("Roads · Mines ·
 * Water Bodies · …"). Each row shows:
 *
 *   - the slot's filled count ("3 placed")
 *   - a one-line collapsed summary string ("Forest Path, …")
 *   - an expanded entry list (first 5 entries with per-key detail)
 *
 * All three layers are pure data — they read OnboardingPlan
 * + PlanSlotKey and emit display values. Carved out so the
 * dialog's render path doesn't carry 290 lines of per-slot
 * field knowledge.
 *
 * Per-key detail extraction (`extractEntrySummary`) lives here
 * so adding a new secondary slot type means editing one switch
 * arm in this file — not threading through the dialog.
 */

import { PLAN_SLOTS, type PlanSlotKey } from "./planSlots";
import type { OnboardingPlan } from "./onboardingPlan";

/** One displayable secondary-slot entry — primary label + optional detail line. */
export interface SlotEntrySummary {
  primary: string;
  detail: string | null;
}

/**
 * Count of items in a secondary slot. Wilderness is a singleton
 * (1 when set, 0 when null); everything else is an array length.
 */
export function secondarySlotCount(
  plan: OnboardingPlan,
  key: PlanSlotKey,
): number {
  switch (key) {
    case "zones":
      return plan.zones.length;
    case "resources":
      return plan.resources.length;
    case "stations":
      return plan.stations.length;
    case "teleports":
      return plan.teleports.length;
    case "roads":
      return plan.roads.length;
    case "pois":
      return plan.pois.length;
    case "dangerSources":
      return plan.dangerSources.length;
    case "waterBodies":
      return plan.waterBodies.length;
    case "musicZones":
      return plan.musicZones.length;
    case "ambientZones":
      return plan.ambientZones.length;
    case "sfxTriggers":
      return plan.sfxTriggers.length;
    case "mines":
      return plan.mines.length;
    case "wildernessBoundary":
      return plan.wildernessBoundary !== null ? 1 : 0;
    case "assets":
      return plan.assets.length;
    default:
      return 0;
  }
}

/**
 * One-line summary string for a secondary slot — shows in the
 * collapsed view. Empty slots show "Not yet placed"; set slots
 * show count + first-entry name.
 */
export function secondarySlotSummary(
  plan: OnboardingPlan,
  key: PlanSlotKey,
): string {
  const count = secondarySlotCount(plan, key);
  if (count === 0) {
    const slot = PLAN_SLOTS.find((s) => s.key === key);
    return slot ? `Not yet placed` : "—";
  }
  if (key === "wildernessBoundary") {
    const wb = plan.wildernessBoundary as { points?: unknown[] } | null;
    const ptCount = Array.isArray(wb?.points) ? wb!.points.length : 0;
    return `${ptCount}-point boundary`;
  }
  const arrayKey = key as Exclude<PlanSlotKey, "wildernessBoundary">;
  const arr = plan[arrayKey as keyof OnboardingPlan] as unknown[];
  const first = (arr?.[0] ?? {}) as { id?: string; name?: string };
  const firstLabel = first.name ?? first.id ?? "(unnamed)";
  return count === 1 ? firstLabel : `${count} placed · ${firstLabel}, …`;
}

/** Slot's default "empty" CTA prompt — derived from the registry. */
export function getEmptyPrompt(key: PlanSlotKey): string {
  return PLAN_SLOTS.find((s) => s.key === key)!.emptyPrompt;
}

/**
 * Format a position-bearing entry as a one-line detail string.
 * Used by `extractEntrySummary` for every slot that carries a
 * `position: {x,y,z}` field. Returns "" when no x is present.
 */
function fmtPos(p: unknown): string {
  const pos = (p ?? {}) as { x?: number; y?: number; z?: number };
  if (typeof pos.x !== "number") return "";
  return `(${Math.round(pos.x)}, ${Math.round(pos.y ?? 0)}, ${Math.round(
    pos.z ?? 0,
  )})`;
}

/**
 * Per-slot entry extraction — converts one raw plan entry to a
 * SlotEntrySummary. Per-key field knowledge (which fields name
 * vs detail the entry) lives here so callers stay generic.
 */
export function extractEntrySummary(
  raw: unknown,
  key: PlanSlotKey,
): SlotEntrySummary {
  const e = (raw ?? {}) as Record<string, unknown>;
  const primary =
    (e.name as string | undefined) ??
    (e.id as string | undefined) ??
    (e.resourceId as string | undefined) ??
    "(unnamed)";

  switch (key) {
    case "zones": {
      const biome = e.biomeType as string | undefined;
      const safe = e.safeZone as boolean | undefined;
      return {
        primary,
        detail:
          [biome ?? "", safe ? "safe" : "hostile"]
            .filter(Boolean)
            .join(" · ") || null,
      };
    }
    case "resources":
      return {
        primary,
        detail:
          [e.type as string | undefined, fmtPos(e.position)]
            .filter(Boolean)
            .join(" · ") || null,
      };
    case "stations":
      return {
        primary,
        detail:
          [e.type as string | undefined, fmtPos(e.position)]
            .filter(Boolean)
            .join(" · ") || null,
      };
    case "teleports":
      return {
        primary,
        detail:
          [e.type as string | undefined, fmtPos(e.position)]
            .filter(Boolean)
            .join(" · ") || null,
      };
    case "roads": {
      const path = Array.isArray(e.path) ? e.path : [];
      const width = e.width as number | undefined;
      return {
        primary,
        detail: `${path.length}-pt path${
          typeof width === "number" ? ` · ${width}m wide` : ""
        }`,
      };
    }
    case "pois": {
      const cat = e.category as string | undefined;
      const importance = e.importance as number | undefined;
      return {
        primary,
        detail: [
          cat,
          typeof importance === "number"
            ? `importance ${importance.toFixed(1)}`
            : null,
          fmtPos(e.position),
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }
    case "dangerSources": {
      const intensity = e.intensity as number | undefined;
      return {
        primary,
        detail:
          [
            typeof intensity === "number" ? `intensity ${intensity}` : null,
            fmtPos(e.position),
          ]
            .filter(Boolean)
            .join(" · ") || null,
      };
    }
    case "waterBodies": {
      const bodyType = e.bodyType as string | undefined;
      const polygon = Array.isArray(e.polygon) ? e.polygon : null;
      const waypoints = Array.isArray(e.waypoints) ? e.waypoints : null;
      const shape = polygon
        ? `${polygon.length}-vertex polygon`
        : waypoints
          ? `${waypoints.length}-pt path`
          : null;
      return {
        primary,
        detail: [bodyType, shape].filter(Boolean).join(" · ") || null,
      };
    }
    case "musicZones": {
      const polygon = Array.isArray(e.polygon) ? e.polygon : [];
      const track = e.musicTrack as string | undefined;
      return {
        primary,
        detail: [track, `${polygon.length}-vertex polygon`]
          .filter(Boolean)
          .join(" · "),
      };
    }
    case "ambientZones": {
      const polygon = Array.isArray(e.polygon) ? e.polygon : [];
      const ambientType = e.ambientType as string | undefined;
      return {
        primary,
        detail: [ambientType, `${polygon.length}-vertex polygon`]
          .filter(Boolean)
          .join(" · "),
      };
    }
    case "sfxTriggers": {
      const sfxId = e.sfxId as string | undefined;
      const radius = e.radius as number | undefined;
      return {
        primary,
        detail: [
          sfxId,
          typeof radius === "number" ? `r=${radius}` : null,
          fmtPos(e.position),
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }
    case "mines": {
      const biome = e.biome as string | undefined;
      const oreRocks = Array.isArray(e.oreRocks) ? e.oreRocks : [];
      const tier = e.tier as number | undefined;
      return {
        primary,
        detail: [
          biome,
          `${oreRocks.length} ore type${oreRocks.length === 1 ? "" : "s"}`,
          typeof tier === "number" ? `tier ${tier}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }
    case "assets": {
      const type = e.type as string | undefined;
      const subtype = e.subtype as string | undefined;
      return {
        primary,
        detail: [type, subtype].filter(Boolean).join(" · ") || null,
      };
    }
    default:
      return { primary, detail: null };
  }
}

/**
 * Roll a secondary slot's entries into an array of
 * SlotEntrySummary values. Wilderness boundary surfaces as a
 * single synthetic entry; everything else is an array map.
 */
export function collectSecondarySlotEntries(
  plan: OnboardingPlan,
  key: PlanSlotKey,
): SlotEntrySummary[] {
  if (key === "wildernessBoundary") {
    const wb = plan.wildernessBoundary as {
      id?: string;
      points?: unknown[];
      maxLevel?: number;
    } | null;
    if (!wb) return [];
    const ptCount = Array.isArray(wb.points) ? wb.points.length : 0;
    return [
      {
        primary: wb.id ?? "wilderness",
        detail: `${ptCount}-point boundary${
          typeof wb.maxLevel === "number" ? ` · max lvl ${wb.maxLevel}` : ""
        }`,
      },
    ];
  }

  const arr = ((): ReadonlyArray<unknown> => {
    switch (key) {
      case "zones":
        return plan.zones;
      case "resources":
        return plan.resources;
      case "stations":
        return plan.stations;
      case "teleports":
        return plan.teleports;
      case "roads":
        return plan.roads;
      case "pois":
        return plan.pois;
      case "dangerSources":
        return plan.dangerSources;
      case "waterBodies":
        return plan.waterBodies;
      case "musicZones":
        return plan.musicZones;
      case "ambientZones":
        return plan.ambientZones;
      case "sfxTriggers":
        return plan.sfxTriggers;
      case "mines":
        return plan.mines;
      case "assets":
        return plan.assets;
      default:
        return [];
    }
  })();

  return arr.map((raw) => extractEntrySummary(raw, key));
}
