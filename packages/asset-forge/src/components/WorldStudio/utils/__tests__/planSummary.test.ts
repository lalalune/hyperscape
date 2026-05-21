/**
 * planSummary — terrain / build-readiness / footer-text tests.
 *
 * Phase 1.2 ninth carve. Pins the helpers feeding the dialog's
 * footer + Build CTA. Their output is user-visible text so any
 * regression here shows up immediately as a UX glitch.
 */

import { describe, it, expect } from "vitest";

import {
  createEmptyOnboardingPlan,
  type OnboardingPlan,
} from "../onboardingPlan";
import {
  hasAnyPlanContent,
  planSummaryText,
  terrainSummary,
} from "../planSummary";

describe("terrainSummary", () => {
  it("returns fallback for an empty config", () => {
    expect(terrainSummary({})).toBe("Custom terrain config");
  });

  it("surfaces preset name when present", () => {
    expect(terrainSummary({ preset: "island" })).toBe("island");
  });

  it("surfaces seed when numeric", () => {
    expect(terrainSummary({ seed: 42 })).toBe("seed 42");
  });

  it("surfaces world dimensions when terrain config provides them", () => {
    const out = terrainSummary({
      terrain: { worldSize: 50, tileSize: 100 },
    });
    expect(out).toBe("50×50 @ 100m");
  });

  it("joins multiple knobs with · separator", () => {
    const out = terrainSummary({
      preset: "island",
      seed: 42,
      terrain: { worldSize: 50, tileSize: 100 },
    });
    expect(out).toBe("island · seed 42 · 50×50 @ 100m");
  });

  it("ignores non-string preset / non-number seed", () => {
    const out = terrainSummary({ preset: 123, seed: "abc" });
    expect(out).toBe("Custom terrain config");
  });
});

describe("hasAnyPlanContent", () => {
  it("returns false for fully empty plan", () => {
    expect(hasAnyPlanContent(createEmptyOnboardingPlan())).toBe(false);
  });

  it("returns true when terrainConfig is set", () => {
    const p = { ...createEmptyOnboardingPlan(), terrainConfig: { seed: 42 } };
    expect(hasAnyPlanContent(p)).toBe(true);
  });

  it("returns false when pluginIds is empty array (not null)", () => {
    const p = { ...createEmptyOnboardingPlan(), pluginIds: [] };
    expect(hasAnyPlanContent(p)).toBe(false);
  });

  it("returns true when pluginIds has entries", () => {
    const p = { ...createEmptyOnboardingPlan(), pluginIds: ["combat"] };
    expect(hasAnyPlanContent(p)).toBe(true);
  });

  it("returns true when any single list-shaped slot is non-empty", () => {
    expect(
      hasAnyPlanContent({ ...createEmptyOnboardingPlan(), npcs: [{}] }),
    ).toBe(true);
    expect(
      hasAnyPlanContent({ ...createEmptyOnboardingPlan(), mobSpawns: [{}] }),
    ).toBe(true);
    expect(
      hasAnyPlanContent({ ...createEmptyOnboardingPlan(), quests: [{}] }),
    ).toBe(true);
    expect(
      hasAnyPlanContent({ ...createEmptyOnboardingPlan(), mines: [{}] }),
    ).toBe(true);
    expect(
      hasAnyPlanContent({ ...createEmptyOnboardingPlan(), sfxTriggers: [{}] }),
    ).toBe(true);
  });

  it("returns true when wildernessBoundary is set (singleton path)", () => {
    const p = {
      ...createEmptyOnboardingPlan(),
      wildernessBoundary: { points: [] },
    };
    expect(hasAnyPlanContent(p)).toBe(true);
  });

  it("returns true when uiPack is set", () => {
    const p = { ...createEmptyOnboardingPlan(), uiPack: { id: "hud" } };
    expect(hasAnyPlanContent(p)).toBe(true);
  });
});

describe("planSummaryText", () => {
  it("returns 'Plan empty.' for fully empty plan", () => {
    expect(planSummaryText(createEmptyOnboardingPlan())).toBe("Plan empty.");
  });

  it("returns Build-CTA suffix when at least one slot is filled", () => {
    const p = { ...createEmptyOnboardingPlan(), npcs: [{}] };
    expect(planSummaryText(p)).toContain("Click Build.");
    expect(planSummaryText(p)).toContain("✓ Plan:");
  });

  it("lists 'terrain' for a filled terrainConfig", () => {
    const p = { ...createEmptyOnboardingPlan(), terrainConfig: { seed: 1 } };
    expect(planSummaryText(p)).toContain("terrain");
  });

  it("counts plugins as N plugin(s)", () => {
    const p = {
      ...createEmptyOnboardingPlan(),
      pluginIds: ["combat", "skills"],
    };
    expect(planSummaryText(p)).toContain("2 plugin(s)");
  });

  it("counts NPCs", () => {
    const p = { ...createEmptyOnboardingPlan(), npcs: [{}, {}, {}] };
    expect(planSummaryText(p)).toContain("3 NPC(s)");
  });

  it("lists 'wilderness boundary' as label, not count", () => {
    const p = {
      ...createEmptyOnboardingPlan(),
      wildernessBoundary: { points: [] },
    };
    expect(planSummaryText(p)).toContain("wilderness boundary");
    expect(planSummaryText(p)).not.toMatch(/\d+ wilderness/);
  });

  it("lists 'HUD' when uiPack is set", () => {
    const p = { ...createEmptyOnboardingPlan(), uiPack: { id: "hud" } };
    expect(planSummaryText(p)).toContain("HUD");
  });

  it("comma-joins multiple slots", () => {
    const p = {
      ...createEmptyOnboardingPlan(),
      npcs: [{}],
      quests: [{}, {}],
      mines: [{}, {}, {}],
    };
    const out = planSummaryText(p);
    expect(out).toContain("1 NPC(s)");
    expect(out).toContain("2 quest(s)");
    expect(out).toContain("3 mine(s)");
    expect(out.match(/,/g)?.length ?? 0).toBeGreaterThan(0);
  });
});
