/**
 * Second-game regression smoke (H2 of the AAA gap audit).
 *
 * The Project-as-Data architecture's second-game claim is: a
 * project can declare a non-Hyperia plugin set and PIE will boot
 * exactly those plugins — no Hyperia leakage. The audit called
 * this out as unproven at runtime.
 *
 * This test asserts the boot-layer contract:
 *   - "blank"        → zero plugins
 *   - "hyperscape"   → combat + skills + hyperscape, no shooter
 *   - "shooter-demo" → combat + shooter-demo, no hyperscape / skills
 *
 * Crucially, switching plugin sets must not cross-contaminate
 * the manifest list. If the resolver ever started leaking
 * hyperscape into shooter-demo (e.g. by sharing a singleton),
 * this test fails before any user-visible damage.
 */

import { describe, expect, it } from "vitest";
import { getPluginModules, resolvePluginModules } from "../pluginBoot";
import { manifest as combatManifest } from "@hyperforge/combat";
import { manifest as skillsManifest } from "@hyperforge/skills";
import { manifest as hyperscapeManifest } from "@hyperforge/hyperscape";
import { manifest as shooterDemoManifest } from "@hyperforge/plugin-shooter-demo";
import { manifest as arcticSurvivalManifest } from "@hyperforge/plugin-arctic-survival";

describe("pluginBoot.getPluginModules — second-game smoke (H2)", () => {
  it("blank → empty plugin set", () => {
    const modules = getPluginModules("blank");
    expect(modules).toEqual([]);
  });

  it("hyperscape → combat + skills + hyperscape, NO shooter-demo", () => {
    const modules = getPluginModules("hyperscape");
    const ids = modules.map((m) => m.manifest.id).sort();
    expect(ids).toContain(combatManifest.id);
    expect(ids).toContain(skillsManifest.id);
    expect(ids).toContain(hyperscapeManifest.id);
    expect(ids).not.toContain(shooterDemoManifest.id);
  });

  it("shooter-demo → combat + shooter-demo, NO hyperscape, NO skills", () => {
    const modules = getPluginModules("shooter-demo");
    const ids = modules.map((m) => m.manifest.id).sort();
    expect(ids).toContain(combatManifest.id);
    expect(ids).toContain(shooterDemoManifest.id);
    expect(ids).not.toContain(hyperscapeManifest.id);
    expect(ids).not.toContain(skillsManifest.id);
  });

  it("module sets across gameIds are independent (no shared array refs)", () => {
    // Catches the "I returned the same array" hidden-singleton bug
    // that would let a stop()/start() cycle bleed plugins across
    // game switches.
    const a = getPluginModules("hyperscape");
    const b = getPluginModules("shooter-demo");
    const c = getPluginModules("hyperscape");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("every returned module has both manifest and factory", () => {
    for (const gameId of ["hyperscape", "shooter-demo"] as const) {
      for (const m of getPluginModules(gameId)) {
        expect(m.manifest).toBeDefined();
        expect(m.manifest.id).toBeTruthy();
        expect(m.factory).toBeTypeOf("function");
      }
    }
  });
});

describe("resolvePluginModules — arctic-survival (Phase 5.1 third-plugin scaffold)", () => {
  it("arctic-survival → combat + arctic-survival, NO hyperscape, NO skills, NO shooter", () => {
    const modules = resolvePluginModules([arcticSurvivalManifest.id]);
    const ids = modules.map((m) => m.manifest.id).sort();
    expect(ids).toContain(combatManifest.id);
    expect(ids).toContain(arcticSurvivalManifest.id);
    expect(ids).not.toContain(hyperscapeManifest.id);
    expect(ids).not.toContain(skillsManifest.id);
    expect(ids).not.toContain(shooterDemoManifest.id);
  });

  it("resolves arctic-survival via its npm name alias", () => {
    const modules = resolvePluginModules([
      "@hyperforge/plugin-arctic-survival",
    ]);
    const ids = modules.map((m) => m.manifest.id);
    expect(ids).toContain(arcticSurvivalManifest.id);
  });

  it("combat loads BEFORE arctic-survival (transitive dependency order)", () => {
    const modules = resolvePluginModules([arcticSurvivalManifest.id]);
    const ids = modules.map((m) => m.manifest.id);
    const combatIdx = ids.indexOf(combatManifest.id);
    const arcticIdx = ids.indexOf(arcticSurvivalManifest.id);
    expect(combatIdx).toBeGreaterThanOrEqual(0);
    expect(arcticIdx).toBeGreaterThan(combatIdx);
  });

  it("composes with shooter-demo when both ids are requested simultaneously", () => {
    // Critical proof: a future project that wants to ship BOTH
    // gameplay flavors (e.g. arctic-themed shooter) can declare
    // both and the resolver returns a clean union — combat,
    // shooter-demo, arctic-survival — no duplicates, no leaks.
    const modules = resolvePluginModules([
      shooterDemoManifest.id,
      arcticSurvivalManifest.id,
    ]);
    const ids = modules.map((m) => m.manifest.id);
    expect(ids).toContain(combatManifest.id);
    expect(ids).toContain(shooterDemoManifest.id);
    expect(ids).toContain(arcticSurvivalManifest.id);
    // No duplicates (combat is a transitive dep of BOTH and
    // must appear exactly once).
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    // And no Hyperia leak.
    expect(ids).not.toContain(hyperscapeManifest.id);
    expect(ids).not.toContain(skillsManifest.id);
  });

  it("arctic-survival is bootable via the static plugin map (returns manifest + factory)", () => {
    const modules = resolvePluginModules([arcticSurvivalManifest.id]);
    const arctic = modules.find(
      (m) => m.manifest.id === arcticSurvivalManifest.id,
    );
    expect(arctic).toBeDefined();
    expect(arctic!.manifest.id).toBe(arcticSurvivalManifest.id);
    expect(arctic!.factory).toBeTypeOf("function");
  });
});
