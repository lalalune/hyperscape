/**
 * Tests for `resolvePackIdsWithFallback` — the build-pipeline
 * helper that picks the final set of pack ids for a project,
 * with a tag-based themed-pack safety net so blank or off-theme
 * plans don't render with an empty palette.
 *
 * Behaviors pinned:
 *   - Explicit themed pack in plan → no fallback inferred
 *   - No themed pack + tag-matching catalog → catalog winner added
 *   - No themed pack + no inference possible → Hyperia fallback
 *   - Returns a fresh Set so callers can mutate without aliasing
 */

import { describe, expect, it } from "vitest";
import { resolvePackIdsWithFallback } from "../resolvePackIdsWithFallback";
import { createEmptyOnboardingPlan } from "../onboardingPlan";
import { HYPERIA_CONTENT_PACK_ID } from "../contentPackConstants";

const TROPICAL_PACK = "@hyperforge/content-pack-tropical-v1";
const ARCTIC_PACK = "@hyperforge/content-pack-arctic-v1";

describe("resolvePackIdsWithFallback", () => {
  it("returns explicit pack picks unchanged when a themed pack is already present", () => {
    const plan = createEmptyOnboardingPlan();
    plan.assetPackIds = [TROPICAL_PACK];
    const out = resolvePackIdsWithFallback(plan, [], []);
    expect(out.has(TROPICAL_PACK)).toBe(true);
    // No fallback added — Hyperia not present.
    expect(out.has(HYPERIA_CONTENT_PACK_ID)).toBe(false);
  });

  it("adds the catalog-inferred themed pack when none is explicit", () => {
    const plan = createEmptyOnboardingPlan();
    const out = resolvePackIdsWithFallback(
      plan,
      [{ role: "user", text: "Build me a tropical island game" }],
      [
        { manifestId: TROPICAL_PACK, tags: ["tropical", "island"] },
        { manifestId: ARCTIC_PACK, tags: ["arctic", "snow"] },
      ],
    );
    expect(out.has(TROPICAL_PACK)).toBe(true);
    // Inferred winner is tropical; arctic stays out.
    expect(out.has(ARCTIC_PACK)).toBe(false);
  });

  it("falls back to Hyperia when catalog is empty", () => {
    const plan = createEmptyOnboardingPlan();
    const out = resolvePackIdsWithFallback(
      plan,
      [{ role: "user", text: "Build me anything" }],
      [],
    );
    expect(out.has(HYPERIA_CONTENT_PACK_ID)).toBe(true);
  });

  it("falls back to Hyperia when no user messages exist (cold start)", () => {
    const plan = createEmptyOnboardingPlan();
    const out = resolvePackIdsWithFallback(
      plan,
      [],
      [
        { manifestId: TROPICAL_PACK, tags: ["tropical", "island"] },
        { manifestId: ARCTIC_PACK, tags: ["arctic", "snow"] },
      ],
    );
    expect(out.has(HYPERIA_CONTENT_PACK_ID)).toBe(true);
    expect(out.has(TROPICAL_PACK)).toBe(false);
    expect(out.has(ARCTIC_PACK)).toBe(false);
  });

  it("falls back to Hyperia when no catalog tag matches the conversation", () => {
    const plan = createEmptyOnboardingPlan();
    const out = resolvePackIdsWithFallback(
      plan,
      [{ role: "user", text: "Make a chess game" }],
      [
        { manifestId: TROPICAL_PACK, tags: ["tropical", "island"] },
        { manifestId: ARCTIC_PACK, tags: ["arctic", "snow"] },
      ],
    );
    expect(out.has(HYPERIA_CONTENT_PACK_ID)).toBe(true);
  });

  it("returns a fresh Set the caller can mutate without aliasing", () => {
    const plan = createEmptyOnboardingPlan();
    plan.assetPackIds = [TROPICAL_PACK];
    const a = resolvePackIdsWithFallback(plan, [], []);
    const b = resolvePackIdsWithFallback(plan, [], []);
    expect(a).not.toBe(b);
    a.add("@hyperforge/asset-pack-extra-v1");
    expect(b.has("@hyperforge/asset-pack-extra-v1")).toBe(false);
  });

  it("does NOT re-fallback when plan declares a non-themed asset pack but no themed one", () => {
    // Tree pack (`asset-pack-*`) doesn't satisfy isContentPackId,
    // so the themed-fallback branch still fires. Mirror reality:
    // the plan has the tree pack PLUS the inferred themed pack.
    const plan = createEmptyOnboardingPlan();
    plan.assetPackIds = ["@hyperforge/asset-pack-hyperia-trees-v1"];
    const out = resolvePackIdsWithFallback(
      plan,
      [{ role: "user", text: "tropical island world" }],
      [{ manifestId: TROPICAL_PACK, tags: ["tropical", "island"] }],
    );
    expect(out.has("@hyperforge/asset-pack-hyperia-trees-v1")).toBe(true);
    expect(out.has(TROPICAL_PACK)).toBe(true);
  });
});
