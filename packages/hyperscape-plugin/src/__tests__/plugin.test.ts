/**
 * @hyperforge/hyperscape meta-plugin tests.
 *
 * Scope: prove the meta-plugin's manifest is well-formed (declares
 * the right dependencies + load-after) and that its re-exports
 * work end-to-end.
 *
 * Substrate-integration test (validatePluginDirectory) lives next
 * to it to lock the manifest gate in CI.
 */

import { describe, expect, it } from "vitest";

import {
  combatPluginFactory,
  createCombatAbilityService,
  createSkillsService,
  DEFAULT_COMBAT_ABILITIES,
  DEFAULT_SKILLS,
  manifest,
  skillsPluginFactory,
} from "../index.js";

describe("@hyperforge/hyperscape", () => {
  it("ships a plugin.json that parses through PluginManifestSchema", () => {
    expect(manifest.id).toBe("com.hyperforge.hyperscape");
    expect(manifest.version).toBe("0.1.0");
    expect(manifest.entry).toBe("./dist/index.js");
    expect(manifest.author.name).toBe("Hyperforge");
    expect(manifest.hyperforgeApi).toBe("0.1.0");
    expect(manifest.enabledByDefault).toBe(false);
    expect(manifest.tags).toContain("meta");
    expect(manifest.tags).toContain("hyperia");
  });

  it("declares @hyperforge/combat AND @hyperforge/skills as manifest dependencies", () => {
    expect(manifest.dependencies).toEqual([
      {
        id: "com.hyperforge.combat",
        versionRange: "^0.1.0",
        optional: false,
      },
      {
        id: "com.hyperforge.skills",
        versionRange: "^0.1.0",
        optional: false,
      },
    ]);
  });

  it("declares loadAfter both deps so the host runs them first", () => {
    expect(manifest.loadAfter).toEqual([
      "com.hyperforge.combat",
      "com.hyperforge.skills",
    ]);
  });

  it("starts with empty contribution buckets (composition is via deps, not contributions)", () => {
    // Phase I4 cut #1: the meta-plugin doesn't directly contribute
    // anything — its constituent plugins do. Future cuts may add
    // cross-plugin contributions (e.g. quest references) but today
    // the surface is empty by design.
    expect(manifest.contributions.systems).toEqual([]);
    expect(manifest.contributions.widgets).toEqual([]);
    expect(manifest.contributions.commands).toEqual([]);
  });

  it("re-exports combatPluginFactory for one-import callers", () => {
    expect(typeof combatPluginFactory).toBe("function");
    const factory = combatPluginFactory(DEFAULT_COMBAT_ABILITIES);
    const plugin = factory();
    expect(typeof plugin.onLoad).toBe("function");
    expect(typeof plugin.onEnable).toBe("function");
    expect(typeof plugin.onDisable).toBe("function");
  });

  it("re-exports createCombatAbilityService for one-import callers", () => {
    expect(typeof createCombatAbilityService).toBe("function");
    const svc = createCombatAbilityService();
    expect(svc.list().size).toBe(0);
  });

  it("re-exports DEFAULT_COMBAT_ABILITIES (the curated starter pack)", () => {
    expect(DEFAULT_COMBAT_ABILITIES).toHaveLength(3);
    expect(DEFAULT_COMBAT_ABILITIES.map((a) => a.id)).toContain(
      "com.hyperforge.combat.slash",
    );
  });

  it("re-exports skillsPluginFactory + createSkillsService for one-import callers", () => {
    expect(typeof skillsPluginFactory).toBe("function");
    expect(typeof createSkillsService).toBe("function");
    const factory = skillsPluginFactory(DEFAULT_SKILLS);
    const plugin = factory();
    expect(typeof plugin.onLoad).toBe("function");
    expect(typeof plugin.onEnable).toBe("function");
    expect(typeof plugin.onDisable).toBe("function");
  });

  it("re-exports DEFAULT_SKILLS (the 6-skill tile-based MMORPG starter pack)", () => {
    expect(DEFAULT_SKILLS).toHaveLength(6);
    expect(DEFAULT_SKILLS.map((s) => s.id)).toContain(
      "com.hyperforge.skills.attack",
    );
    expect(DEFAULT_SKILLS.map((s) => s.id)).toContain(
      "com.hyperforge.skills.hitpoints",
    );
  });
});
