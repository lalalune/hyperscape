/**
 * Plan-slot registry + slot-state helpers.
 *
 * Phase 1.2 sixth carve from DesignWithAIDialog. The dialog
 * renders two slot-aware UIs on every paint:
 *
 *   - A header progress strip ("3 of 7 slots set")
 *   - A right-side Plan panel split into primary + secondary
 *     tiers, with empty-prompt CTAs for each unfilled slot
 *
 * Both are driven by the same `PLAN_SLOTS` array — one ordered,
 * tier-tagged registry of every slot the agent can fill. Adding
 * a new slot is a single-row edit here; the dialog UI picks it
 * up automatically.
 *
 * The slot-state helpers (`isSlotSet`, `countSetSlots`) are
 * generic over the plan shape — they accept any object exposing
 * the `PlanSlotShape` surface (mirrors `OnboardingPlan`'s field
 * layout). Keeping the structural type local avoids a circular
 * dependency on the dialog's `OnboardingPlan` interface.
 */

import {
  AlertTriangle,
  Boxes,
  Droplets,
  Flag,
  Hammer,
  Layout,
  MapPin,
  Map as MapIcon,
  Music,
  Palette,
  Pickaxe,
  Route,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  TreePine,
  Users,
  Volume2,
  Waves,
} from "lucide-react";
import { isContentPackId } from "./contentPackConstants";

/**
 * Slot key — one entry per agent-fillable section of the plan.
 * Two tiers:
 *
 *   - "primary" — top-of-panel, always rendered. The slots a
 *     user MUST care about for any onboarding (theme, plugins,
 *     terrain, npcs, mobs, quests, hud). Filled = ready to build.
 *   - "secondary" — collapsed by default into a "World Detail"
 *     section. Optional but visible — water bodies, audio
 *     zones, mines, roads, POIs, etc. The agent fills these
 *     when the theme suggests them; user sees the work.
 */
export type PlanSlotKey =
  // Primary slots
  | "theme"
  | "pluginIds"
  | "terrainConfig"
  | "npcs"
  | "mobSpawns"
  | "quests"
  | "uiPack"
  // Secondary slots
  | "zones"
  | "resources"
  | "stations"
  | "teleports"
  | "roads"
  | "pois"
  | "dangerSources"
  | "waterBodies"
  | "musicZones"
  | "ambientZones"
  | "sfxTriggers"
  | "mines"
  | "wildernessBoundary"
  | "assets";

export interface PlanSlot {
  readonly key: PlanSlotKey;
  readonly short: string;
  readonly Icon: typeof Boxes;
  readonly emptyPrompt: string;
  readonly tier: "primary" | "secondary";
}

/**
 * Structural subset of `OnboardingPlan` that the slot helpers
 * read. Mirrors the field layout exactly — kept local so the
 * slot module doesn't have to import OnboardingPlan (which would
 * make the dialog ↔ slots dep cycle).
 */
export interface PlanSlotShape {
  readonly assetPackIds: string[] | null;
  readonly pluginIds: string[] | null;
  readonly terrainConfig: Record<string, unknown> | null;
  readonly npcs: ReadonlyArray<unknown>;
  readonly mobSpawns: ReadonlyArray<unknown>;
  readonly quests: ReadonlyArray<unknown>;
  readonly uiPack: unknown | null;
  readonly zones: ReadonlyArray<unknown>;
  readonly resources: ReadonlyArray<unknown>;
  readonly stations: ReadonlyArray<unknown>;
  readonly teleports: ReadonlyArray<unknown>;
  readonly roads: ReadonlyArray<unknown>;
  readonly pois: ReadonlyArray<unknown>;
  readonly dangerSources: ReadonlyArray<unknown>;
  readonly waterBodies: ReadonlyArray<unknown>;
  readonly musicZones: ReadonlyArray<unknown>;
  readonly ambientZones: ReadonlyArray<unknown>;
  readonly sfxTriggers: ReadonlyArray<unknown>;
  readonly mines: ReadonlyArray<unknown>;
  readonly wildernessBoundary: unknown | null;
  readonly assets: ReadonlyArray<unknown>;
}

/**
 * Ordered slot registry. Order is the rendering order in both
 * the header progress strip and the right-side Plan panel.
 */
export const PLAN_SLOTS: ReadonlyArray<PlanSlot> = [
  {
    key: "theme",
    short: "Theme",
    Icon: Palette,
    emptyPrompt:
      "Pick a themed content pack that matches the climate of this world.",
    tier: "primary",
  },
  {
    key: "pluginIds",
    short: "Plugins",
    Icon: Boxes,
    emptyPrompt:
      "What gameplay plugins should I use? List the choices and pick the best fit.",
    tier: "primary",
  },
  {
    key: "terrainConfig",
    short: "Terrain",
    Icon: MapIcon,
    emptyPrompt:
      "Propose a terrain configuration that fits the world we're designing.",
    tier: "primary",
  },
  {
    key: "npcs",
    short: "NPCs",
    Icon: Users,
    emptyPrompt: "Add 1-3 starter NPCs that fit this world.",
    tier: "primary",
  },
  {
    key: "mobSpawns",
    short: "Mobs",
    Icon: Swords,
    emptyPrompt: "Place a few mob spawn points that fit the difficulty curve.",
    tier: "primary",
  },
  {
    key: "quests",
    short: "Quests",
    Icon: ScrollText,
    emptyPrompt: "Author 1-3 starter quests that introduce the gameplay loop.",
    tier: "primary",
  },
  {
    key: "uiPack",
    short: "HUD",
    Icon: Layout,
    emptyPrompt: "Design a HUD layout that fits the game we're building.",
    tier: "primary",
  },
  // ─── Secondary tier (rendered in the collapsible "World Detail" group) ───
  {
    key: "zones",
    short: "Zones",
    Icon: Flag,
    emptyPrompt:
      "Define 2-4 named regions for this world (safe town area, hostile wilderness, etc.).",
    tier: "secondary",
  },
  {
    key: "roads",
    short: "Roads",
    Icon: Route,
    emptyPrompt:
      "Connect the main settlements + landmarks with curving roads or trails.",
    tier: "secondary",
  },
  {
    key: "pois",
    short: "Points of Interest",
    Icon: MapPin,
    emptyPrompt:
      "Mark 3-6 landmark points the player can discover (dungeons, shrines, ruins, camps).",
    tier: "secondary",
  },
  {
    key: "resources",
    short: "Gathering",
    Icon: TreePine,
    emptyPrompt:
      "Place a handful of gathering nodes (trees, rocks, fishing spots) so woodcutting/mining/fishing has anchors.",
    tier: "secondary",
  },
  {
    key: "stations",
    short: "Crafting Stations",
    Icon: Hammer,
    emptyPrompt:
      "Drop in a few crafting stations (anvil, furnace, range, bank) tied to the main settlement.",
    tier: "secondary",
  },
  {
    key: "teleports",
    short: "Teleports",
    Icon: Sparkles,
    emptyPrompt:
      "Add 1-3 teleport nodes (lodestones, portals, or shortcuts) for fast travel.",
    tier: "secondary",
  },
  {
    key: "dangerSources",
    short: "Danger Zones",
    Icon: AlertTriangle,
    emptyPrompt:
      "Mark dangerous areas that bump local difficulty (corrupted shrines, warlord camps).",
    tier: "secondary",
  },
  {
    key: "wildernessBoundary",
    short: "Wilderness Edge",
    Icon: Shield,
    emptyPrompt:
      "Trace the boundary between safe territory and PvP / hostile wilderness.",
    tier: "secondary",
  },
  {
    key: "mines",
    short: "Mines",
    Icon: Pickaxe,
    emptyPrompt:
      "Designate 1-2 mining areas with clustered ore rocks (copper, iron, tin, etc.).",
    tier: "secondary",
  },
  {
    key: "waterBodies",
    short: "Water Bodies",
    Icon: Waves,
    emptyPrompt: "Place named rivers / lakes / ponds that fit the climate.",
    tier: "secondary",
  },
  {
    key: "musicZones",
    short: "Music Zones",
    Icon: Music,
    emptyPrompt:
      "Bound 1-2 regions with mood-driven music (boss arena tension, town center theme).",
    tier: "secondary",
  },
  {
    key: "ambientZones",
    short: "Ambient Sound",
    Icon: Volume2,
    emptyPrompt:
      "Add ambient soundscape zones that match the climate (jungle insects, ocean waves, cave drips).",
    tier: "secondary",
  },
  {
    key: "sfxTriggers",
    short: "SFX Triggers",
    Icon: Droplets,
    emptyPrompt:
      "Place point-source sound triggers for landmark audio (waterfall splash, geyser, bell tower).",
    tier: "secondary",
  },
  {
    key: "assets",
    short: "Asset Bakes",
    Icon: Sparkles,
    emptyPrompt:
      "Generate any unique 3D assets the world needs (specific creatures, props).",
    tier: "secondary",
  },
];

/**
 * Theme slot is special — it's "set" when the project has any
 * themed content pack installed (canonical pack-id prefix:
 * `@hyperforge/content-pack-`). Everything else maps 1:1 to an
 * OnboardingPlan field via array length or non-null check.
 */
export function isSlotSet(plan: PlanSlotShape, key: PlanSlotKey): boolean {
  switch (key) {
    case "theme":
      return (
        Array.isArray(plan.assetPackIds) &&
        plan.assetPackIds.some((id) => isContentPackId(id))
      );
    case "pluginIds":
      return plan.pluginIds !== null && plan.pluginIds.length > 0;
    case "terrainConfig":
      return plan.terrainConfig !== null;
    case "npcs":
      return plan.npcs.length > 0;
    case "mobSpawns":
      return plan.mobSpawns.length > 0;
    case "quests":
      return plan.quests.length > 0;
    case "uiPack":
      return plan.uiPack !== null;
    case "zones":
      return plan.zones.length > 0;
    case "resources":
      return plan.resources.length > 0;
    case "stations":
      return plan.stations.length > 0;
    case "teleports":
      return plan.teleports.length > 0;
    case "roads":
      return plan.roads.length > 0;
    case "pois":
      return plan.pois.length > 0;
    case "dangerSources":
      return plan.dangerSources.length > 0;
    case "waterBodies":
      return plan.waterBodies.length > 0;
    case "musicZones":
      return plan.musicZones.length > 0;
    case "ambientZones":
      return plan.ambientZones.length > 0;
    case "sfxTriggers":
      return plan.sfxTriggers.length > 0;
    case "mines":
      return plan.mines.length > 0;
    case "wildernessBoundary":
      return plan.wildernessBoundary !== null;
    case "assets":
      return plan.assets.length > 0;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

/**
 * Count slots filled in a particular tier. `"all"` counts every
 * slot; `"primary"` is the build-CTA gate (secondary fills in
 * organically as the agent works through the world detail).
 */
export function countSetSlots(
  plan: PlanSlotShape,
  tier: "primary" | "secondary" | "all" = "all",
): number {
  const slots =
    tier === "all" ? PLAN_SLOTS : PLAN_SLOTS.filter((s) => s.tier === tier);
  return slots.filter((s) => isSlotSet(plan, s.key)).length;
}
