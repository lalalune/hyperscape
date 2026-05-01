/**
 * R2.P2 of `PLAN_HYPERIA_DECOUPLING.md` — registry-driven plugin
 * resolution. Asserts the new id-list surface of `pluginBoot`:
 *
 *   - resolvePluginModules([]) → empty (blank canvas)
 *   - resolvePluginModules(["@hyperforge/hyperscape"]) →
 *     combat + skills + hyperscape (transitive deps expanded)
 *   - resolvePluginModules(["@hyperforge/plugin-shooter-demo"]) →
 *     combat + shooter-demo
 *   - manifest-id form recognized: ["com.hyperforge.hyperscape"]
 *   - unknown ids skip silently
 *   - mixed valid + unknown ids resolves the valid ones
 *
 * Complements `pluginBoot.secondGame.test.ts` which exercises the
 * legacy `getPluginModules(gameId)` shim — both surfaces must
 * agree on which plugins boot for a given project declaration.
 */

import { describe, expect, it, vi } from "vitest";
import { resolvePluginModules } from "../pluginBoot";
import { manifest as combatManifest } from "@hyperforge/combat";
import { manifest as skillsManifest } from "@hyperforge/skills";
import { manifest as hyperscapeManifest } from "@hyperforge/hyperscape";
import { manifest as shooterDemoManifest } from "@hyperforge/plugin-shooter-demo";

describe("pluginBoot.resolvePluginModules — registry-driven boot (R2.P2)", () => {
  it("empty input → empty result (blank canvas)", () => {
    expect(resolvePluginModules([])).toEqual([]);
  });

  it("hyperscape npm name → combat + skills + hyperscape", () => {
    const ids = resolvePluginModules(["@hyperforge/hyperscape"]).map(
      (m) => m.manifest.id,
    );
    expect(ids).toContain(combatManifest.id);
    expect(ids).toContain(skillsManifest.id);
    expect(ids).toContain(hyperscapeManifest.id);
    expect(ids).not.toContain(shooterDemoManifest.id);
  });

  it("hyperscape manifest id (com.hyperforge.hyperscape) also resolves", () => {
    const ids = resolvePluginModules([hyperscapeManifest.id]).map(
      (m) => m.manifest.id,
    );
    expect(ids).toContain(hyperscapeManifest.id);
  });

  it("shooter-demo → combat + shooter-demo (no hyperscape / skills)", () => {
    const ids = resolvePluginModules(["@hyperforge/plugin-shooter-demo"]).map(
      (m) => m.manifest.id,
    );
    expect(ids).toContain(combatManifest.id);
    expect(ids).toContain(shooterDemoManifest.id);
    expect(ids).not.toContain(hyperscapeManifest.id);
    expect(ids).not.toContain(skillsManifest.id);
  });

  it("unknown plugin id skips silently with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolvePluginModules(["@hyperforge/plugin-nonexistent"]);
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("mixed valid + unknown — keeps the valid one", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ids = resolvePluginModules([
      "@hyperforge/hyperscape",
      "@hyperforge/plugin-fictional",
    ]).map((m) => m.manifest.id);
    expect(ids).toContain(hyperscapeManifest.id);
    warn.mockRestore();
  });

  it("dedupes: hyperscape + combat (already a transitive dep) → no duplicate combat", () => {
    const ids = resolvePluginModules([
      "@hyperforge/hyperscape",
      "@hyperforge/combat",
    ]).map((m) => m.manifest.id);
    const combatCount = ids.filter((id) => id === combatManifest.id).length;
    expect(combatCount).toBe(1);
  });

  it("each call returns a fresh module array (no shared singleton)", () => {
    const a = resolvePluginModules(["@hyperforge/hyperscape"]);
    const b = resolvePluginModules(["@hyperforge/hyperscape"]);
    expect(a).not.toBe(b);
  });

  it("every returned module has manifest + factory", () => {
    const modules = resolvePluginModules(["@hyperforge/hyperscape"]);
    for (const m of modules) {
      expect(m.manifest).toBeDefined();
      expect(m.manifest.id).toBeTruthy();
      expect(m.factory).toBeTypeOf("function");
    }
  });
});
