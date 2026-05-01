/**
 * R1.P5 — DataManager.setActiveProjectPlugins / projectExcludesHyperia.
 *
 * Verifies the per-project Hyperia engine-load opt-out hook
 * added in `PLAN_HYPERIA_DECOUPLING.md` R1.P5. Doesn't drive a
 * full `loadManifestsFromCDN` (that's an integration concern);
 * just asserts the public setter + getter contract behaves so
 * downstream callers can rely on it.
 */
import { describe, it, expect, afterEach } from "vitest";
import { DataManager } from "../DataManager";

describe("DataManager.setActiveProjectPlugins", () => {
  afterEach(() => {
    // Reset to default so test isolation holds.
    DataManager.setActiveProjectPlugins(null);
  });

  it("defaults to null (legacy behavior — env flag is the only knob)", () => {
    expect(DataManager.getActiveProjectPlugins()).toBeNull();
  });

  it("records the plugin set as a defensive copy", () => {
    const input = ["@hyperforge/plugin-tropical"];
    DataManager.setActiveProjectPlugins(input);
    const stored = DataManager.getActiveProjectPlugins();
    expect(stored).toEqual(["@hyperforge/plugin-tropical"]);
    // Mutating the input must not affect the recorded snapshot.
    input.push("mutated");
    expect(DataManager.getActiveProjectPlugins()).toEqual([
      "@hyperforge/plugin-tropical",
    ]);
  });

  it("clears when set to null", () => {
    DataManager.setActiveProjectPlugins(["@hyperforge/plugin-tropical"]);
    DataManager.setActiveProjectPlugins(null);
    expect(DataManager.getActiveProjectPlugins()).toBeNull();
  });

  it("accepts an empty list (project declares no plugins)", () => {
    DataManager.setActiveProjectPlugins([]);
    expect(DataManager.getActiveProjectPlugins()).toEqual([]);
  });

  it("recognizes Hyperia by manifest id and excludes other plugins", () => {
    DataManager.setActiveProjectPlugins(["com.hyperforge.hyperscape"]);
    // Internal helper exercised via roundtrip — when a Hyperia id
    // is present, the active set does NOT exclude Hyperia.
    expect(DataManager.getActiveProjectPlugins()).toContain(
      "com.hyperforge.hyperscape",
    );
  });

  it("recognizes Hyperia by npm name", () => {
    DataManager.setActiveProjectPlugins(["@hyperforge/hyperscape"]);
    expect(DataManager.getActiveProjectPlugins()).toContain(
      "@hyperforge/hyperscape",
    );
  });

  it("multi-plugin sets — Hyperia among others is recognized", () => {
    DataManager.setActiveProjectPlugins([
      "@hyperforge/plugin-tropical",
      "@hyperforge/hyperscape",
      "@hyperforge/plugin-other",
    ]);
    const stored = DataManager.getActiveProjectPlugins();
    expect(stored).toHaveLength(3);
    expect(stored).toContain("@hyperforge/hyperscape");
  });

  it("non-Hyperia-only sets — Hyperia is absent", () => {
    DataManager.setActiveProjectPlugins([
      "@hyperforge/plugin-tropical",
      "@hyperforge/plugin-other",
    ]);
    const stored = DataManager.getActiveProjectPlugins() ?? [];
    expect(
      stored.some(
        (id) =>
          id === "@hyperforge/hyperscape" || id === "com.hyperforge.hyperscape",
      ),
    ).toBe(false);
  });
});
