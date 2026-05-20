/**
 * Plan-summary helpers — terrain / build-readiness / footer-text.
 *
 * Phase 1.2 ninth carve from DesignWithAIDialog. Three small
 * pure functions used in the dialog footer + build-CTA gate:
 *
 *   - `terrainSummary` — one-line description of the terrain
 *     config (preset / seed / world size).
 *   - `hasAnyPlanContent` — true iff at least one slot is
 *     filled; gates the "Build my world" button.
 *   - `planSummaryText` — footer summary line ("✓ Plan: 3 NPCs,
 *     2 quests, …. Click Build.")
 *
 * All three are pure data transforms — no React, no DOM.
 */

import type { OnboardingPlan } from "./onboardingPlan";

/**
 * One-line description of a terrain config, suitable for the
 * Plan panel's terrain slot summary row. Falls back to
 * "Custom terrain config" when none of the recognised fields
 * are present (agent shipped a minimal proposal).
 */
export function terrainSummary(config: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof config.preset === "string") parts.push(config.preset);
  if (typeof config.seed === "number") parts.push(`seed ${config.seed}`);
  const terrain = config.terrain as
    | { worldSize?: number; tileSize?: number }
    | undefined;
  if (terrain?.worldSize && terrain?.tileSize) {
    parts.push(
      `${terrain.worldSize}×${terrain.worldSize} @ ${terrain.tileSize}m`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : "Custom terrain config";
}

/**
 * True when at least one slot of the agent's plan has content
 * worth applying. Used to gate the "Build my world" button —
 * an empty plan can't produce a meaningful world.
 */
export function hasAnyPlanContent(plan: OnboardingPlan): boolean {
  return (
    plan.terrainConfig !== null ||
    (plan.pluginIds !== null && plan.pluginIds.length > 0) ||
    (plan.assetPackIds !== null && plan.assetPackIds.length > 0) ||
    plan.npcs.length > 0 ||
    plan.mobSpawns.length > 0 ||
    plan.quests.length > 0 ||
    plan.assets.length > 0 ||
    plan.zones.length > 0 ||
    plan.resources.length > 0 ||
    plan.stations.length > 0 ||
    plan.teleports.length > 0 ||
    plan.roads.length > 0 ||
    plan.pois.length > 0 ||
    plan.dangerSources.length > 0 ||
    plan.waterBodies.length > 0 ||
    plan.musicZones.length > 0 ||
    plan.ambientZones.length > 0 ||
    plan.sfxTriggers.length > 0 ||
    plan.mines.length > 0 ||
    plan.wildernessBoundary !== null ||
    plan.uiPack !== null
  );
}

/**
 * Footer summary of what the agent has proposed so far. Renders
 * a short description of each populated plan slot — used as the
 * micro-status line above the Build CTA.
 */
export function planSummaryText(plan: OnboardingPlan): string {
  const parts: string[] = [];
  if (plan.terrainConfig) parts.push("terrain");
  if (plan.pluginIds && plan.pluginIds.length > 0) {
    parts.push(`${plan.pluginIds.length} plugin(s)`);
  }
  if (plan.assetPackIds && plan.assetPackIds.length > 0) {
    parts.push(`${plan.assetPackIds.length} pack(s)`);
  }
  if (plan.npcs.length > 0) parts.push(`${plan.npcs.length} NPC(s)`);
  if (plan.mobSpawns.length > 0) {
    parts.push(`${plan.mobSpawns.length} spawn(s)`);
  }
  if (plan.resources.length > 0) {
    parts.push(`${plan.resources.length} resource(s)`);
  }
  if (plan.stations.length > 0) {
    parts.push(`${plan.stations.length} station(s)`);
  }
  if (plan.teleports.length > 0) {
    parts.push(`${plan.teleports.length} teleport(s)`);
  }
  if (plan.roads.length > 0) parts.push(`${plan.roads.length} road(s)`);
  if (plan.pois.length > 0) parts.push(`${plan.pois.length} POI(s)`);
  if (plan.dangerSources.length > 0) {
    parts.push(`${plan.dangerSources.length} danger source(s)`);
  }
  if (plan.waterBodies.length > 0) {
    parts.push(`${plan.waterBodies.length} water body(s)`);
  }
  if (plan.musicZones.length > 0) {
    parts.push(`${plan.musicZones.length} music zone(s)`);
  }
  if (plan.ambientZones.length > 0) {
    parts.push(`${plan.ambientZones.length} ambient zone(s)`);
  }
  if (plan.sfxTriggers.length > 0) {
    parts.push(`${plan.sfxTriggers.length} sfx trigger(s)`);
  }
  if (plan.mines.length > 0) parts.push(`${plan.mines.length} mine(s)`);
  if (plan.wildernessBoundary !== null) parts.push("wilderness boundary");
  if (plan.zones.length > 0) parts.push(`${plan.zones.length} zone(s)`);
  if (plan.quests.length > 0) parts.push(`${plan.quests.length} quest(s)`);
  if (plan.uiPack) parts.push("HUD");
  if (parts.length === 0) return "Plan empty.";
  return `✓ Plan: ${parts.join(", ")}. Click Build.`;
}
