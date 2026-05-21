/**
 * R3.P11 — server-side plugin id list resolver.
 *
 * Mirrors the asset-forge R2.P2 test suite for
 * `resolvePluginModules` so the server-side static-map dispatch
 * matches PIE's behavior exactly. Adding a plugin to one map
 * but not the other would mean the agent's PROPOSE_PLUGIN_SET
 * worked in PIE but failed in the production server — this
 * test catches that asymmetry early by pinning the contract.
 */

import { describe, expect, it, vi } from "vitest";
import { resolveServerPluginModules } from "../plugins.js";
import { manifest as combatManifest } from "@hyperforge/combat";
import { manifest as skillsManifest } from "@hyperforge/skills";
import { manifest as hyperscapeManifest } from "@hyperforge/hyperscape";
import { manifest as shooterDemoManifest } from "@hyperforge/plugin-shooter-demo";
import { manifest as arcticSurvivalManifest } from "@hyperforge/plugin-arctic-survival";

describe("resolveServerPluginModules — registry-driven server boot (R3.P11)", () => {
  it("empty input → empty result (blank-canvas server)", () => {
    expect(resolveServerPluginModules([])).toEqual([]);
  });

  it("hyperscape npm name → combat + skills + hyperscape", () => {
    const ids = resolveServerPluginModules(["@hyperforge/hyperscape"]).map(
      (m) => m.manifest.id,
    );
    expect(ids).toContain(combatManifest.id);
    expect(ids).toContain(skillsManifest.id);
    expect(ids).toContain(hyperscapeManifest.id);
    expect(ids).not.toContain(shooterDemoManifest.id);
  });

  it("hyperscape manifest id (com.hyperforge.hyperscape) also resolves", () => {
    const ids = resolveServerPluginModules([hyperscapeManifest.id]).map(
      (m) => m.manifest.id,
    );
    expect(ids).toContain(hyperscapeManifest.id);
  });

  it("shooter-demo → combat + shooter-demo (no hyperscape / skills)", () => {
    const ids = resolveServerPluginModules([
      "@hyperforge/plugin-shooter-demo",
    ]).map((m) => m.manifest.id);
    expect(ids).toContain(combatManifest.id);
    expect(ids).toContain(shooterDemoManifest.id);
    expect(ids).not.toContain(hyperscapeManifest.id);
    expect(ids).not.toContain(skillsManifest.id);
  });

  it("unknown plugin id skips silently with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolveServerPluginModules([
      "@hyperforge/plugin-nonexistent",
    ]);
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("dedupes: hyperscape + combat → single combat entry", () => {
    const ids = resolveServerPluginModules([
      "@hyperforge/hyperscape",
      "@hyperforge/combat",
    ]).map((m) => m.manifest.id);
    const combatCount = ids.filter((id) => id === combatManifest.id).length;
    expect(combatCount).toBe(1);
  });

  it("each call returns a fresh module array (no shared singleton)", () => {
    const a = resolveServerPluginModules(["@hyperforge/hyperscape"]);
    const b = resolveServerPluginModules(["@hyperforge/hyperscape"]);
    expect(a).not.toBe(b);
  });

  it("every returned module has manifest + factory", () => {
    const modules = resolveServerPluginModules(["@hyperforge/hyperscape"]);
    for (const m of modules) {
      expect(m.manifest).toBeDefined();
      expect(m.manifest.id).toBeTruthy();
      expect(m.factory).toBeTypeOf("function");
    }
  });

  // ─── Phase 5.1 — arctic-survival third plugin parity ───
  // Mirrors the asset-forge PIE resolver tests so the server's
  // static-map dispatch matches PIE byte-for-byte. Drift fails
  // here before it ships to prod boot.

  it("arctic-survival npm name → combat + arctic-survival (no hyperscape / skills / shooter)", () => {
    const ids = resolveServerPluginModules([
      "@hyperforge/plugin-arctic-survival",
    ]).map((m) => m.manifest.id);
    expect(ids).toContain(combatManifest.id);
    expect(ids).toContain(arcticSurvivalManifest.id);
    expect(ids).not.toContain(hyperscapeManifest.id);
    expect(ids).not.toContain(skillsManifest.id);
    expect(ids).not.toContain(shooterDemoManifest.id);
  });

  it("arctic-survival manifest id also resolves (com.hyperforge.plugin-arctic-survival)", () => {
    const ids = resolveServerPluginModules([arcticSurvivalManifest.id]).map(
      (m) => m.manifest.id,
    );
    expect(ids).toContain(arcticSurvivalManifest.id);
    expect(ids).toContain(combatManifest.id);
  });

  it("combat loads BEFORE arctic-survival (transitive dependency order)", () => {
    const ids = resolveServerPluginModules([arcticSurvivalManifest.id]).map(
      (m) => m.manifest.id,
    );
    const combatIdx = ids.indexOf(combatManifest.id);
    const arcticIdx = ids.indexOf(arcticSurvivalManifest.id);
    expect(combatIdx).toBeGreaterThanOrEqual(0);
    expect(arcticIdx).toBeGreaterThan(combatIdx);
  });

  it("composes shooter-demo + arctic-survival cleanly (single combat, no leaks)", () => {
    const ids = resolveServerPluginModules([
      shooterDemoManifest.id,
      arcticSurvivalManifest.id,
    ]).map((m) => m.manifest.id);
    expect(ids).toContain(combatManifest.id);
    expect(ids).toContain(shooterDemoManifest.id);
    expect(ids).toContain(arcticSurvivalManifest.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(hyperscapeManifest.id);
    expect(ids).not.toContain(skillsManifest.id);
  });
});
