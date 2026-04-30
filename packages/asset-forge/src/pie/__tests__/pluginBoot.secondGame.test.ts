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
import { getPluginModules } from "../pluginBoot";
import { manifest as combatManifest } from "@hyperforge/combat";
import { manifest as skillsManifest } from "@hyperforge/skills";
import { manifest as hyperscapeManifest } from "@hyperforge/hyperscape";
import { manifest as shooterDemoManifest } from "@hyperforge/plugin-shooter-demo";

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
