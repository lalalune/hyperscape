/**
 * Skills reference-plugin smoke tests.
 *
 * Mirrors @hyperforge/combat's plugin.test.ts pattern. Drives the
 * lifecycle by hand using `createPluginContextScope` from
 * @hyperforge/gameplay-framework. Proves the facade is sufficient
 * for authoring; integration with the real host lives elsewhere.
 */

import { describe, expect, it } from "vitest";

import { createPluginContextScope } from "@hyperforge/gameplay-framework";

import {
  DEFAULT_SKILLS,
  createSkillsService,
  manifest,
  skillsPluginFactory,
  type SkillDefinition,
  type SkillsContext,
  type SkillsService,
} from "../index.js";

function makeContext(pluginId: string, service: SkillsService): SkillsContext {
  const scope = createPluginContextScope(pluginId);
  return {
    pluginId,
    scope,
    registerSkill(skill) {
      service.registerSkill(skill);
      scope.register(() => service.unregisterSkill(skill.id));
    },
  };
}

describe("@hyperforge/skills", () => {
  it("ships a plugin.json that parses through PluginManifestSchema", () => {
    expect(manifest.id).toBe("com.hyperforge.skills");
    expect(manifest.version).toBe("0.1.0");
    expect(manifest.entry).toBe("./dist/index.js");
    expect(manifest.author.name).toBe("Hyperforge");
    expect(manifest.hyperforgeApi).toBe("0.1.0");
    expect(manifest.enabledByDefault).toBe(false);
    expect(manifest.tags).toContain("skills");
    expect(manifest.tags).toContain("reference");
  });

  it("declares contributions across multiple buckets", () => {
    expect(manifest.contributions.systems).toEqual([
      "com.hyperforge.skills.xp-system",
    ]);
    expect(manifest.contributions.widgets).toEqual([
      "com.hyperforge.skills.skill-panel",
    ]);
    expect(manifest.contributions.manifestSchemas).toEqual([
      "com.hyperforge.skills.definitions",
    ]);
    expect(manifest.contributions.commands).toEqual([
      "com.hyperforge.skills.commands.add-xp",
    ]);
  });

  it("ships a default starter pack covering combat/gathering/production", () => {
    expect(DEFAULT_SKILLS).toHaveLength(6);
    const ids = DEFAULT_SKILLS.map((s) => s.id);
    expect(ids).toContain("com.hyperforge.skills.attack");
    expect(ids).toContain("com.hyperforge.skills.hitpoints");
    expect(ids).toContain("com.hyperforge.skills.woodcutting");
    expect(ids).toContain("com.hyperforge.skills.cooking");
    const categories = new Set(DEFAULT_SKILLS.map((s) => s.category));
    expect(categories.has("combat")).toBe(true);
    expect(categories.has("gathering")).toBe(true);
    expect(categories.has("production")).toBe(true);
  });

  it("hitpoints starts at level 10 (matches tile-based MMORPG contract)", () => {
    const hp = DEFAULT_SKILLS.find(
      (s) => s.id === "com.hyperforge.skills.hitpoints",
    );
    expect(hp?.defaultLevel).toBe(10);
    expect(hp?.maxLevel).toBe(99);
  });

  it("registers all skills on enable + unregisters via scope drain on disable", async () => {
    const service = createSkillsService();
    const ctx = makeContext("com.hyperforge.skills", service);

    const factory = skillsPluginFactory(DEFAULT_SKILLS);
    const plugin = factory();

    expect(service.list().size).toBe(0);

    // onLoad does NOT register — only validates.
    await plugin.onLoad?.(ctx);
    expect(service.list().size).toBe(0);

    // onEnable registers the full pack.
    await plugin.onEnable?.(ctx);
    expect(service.list().size).toBe(DEFAULT_SKILLS.length);
    expect(service.getSkill("com.hyperforge.skills.attack")?.displayName).toBe(
      "Attack",
    );
    expect(
      service.getSkill("com.hyperforge.skills.hitpoints")?.defaultLevel,
    ).toBe(10);

    // onDisable is a no-op; teardown happens via scope drain after.
    await plugin.onDisable?.(ctx);
    expect(service.list().size).toBe(DEFAULT_SKILLS.length);

    // Scope drain (simulating host post-disable) unregisters everything.
    await ctx.scope.dispose();
    expect(service.list().size).toBe(0);
  });

  it("rejects a duplicate-id skill list during onLoad before any registration", async () => {
    const service = createSkillsService();
    const ctx = makeContext("com.hyperforge.skills#dup", service);

    const malformed: readonly SkillDefinition[] = [
      {
        id: "x",
        displayName: "X1",
        category: "combat",
        maxLevel: 99,
        defaultLevel: 1,
        icon: "?",
      },
      {
        id: "x",
        displayName: "X2",
        category: "support",
        maxLevel: 99,
        defaultLevel: 1,
        icon: "?",
      },
    ];
    const plugin = skillsPluginFactory(malformed)();

    await expect(async () => plugin.onLoad?.(ctx)).rejects.toThrow(
      /duplicate skill id "x"/,
    );

    expect(service.list().size).toBe(0);
  });

  it("rejects defaultLevel exceeding maxLevel during onLoad", async () => {
    const service = createSkillsService();
    const ctx = makeContext("com.hyperforge.skills#badlevel", service);

    const malformed: readonly SkillDefinition[] = [
      {
        id: "broken",
        displayName: "Broken",
        category: "combat",
        maxLevel: 50,
        defaultLevel: 99, // > maxLevel
        icon: "?",
      },
    ];
    const plugin = skillsPluginFactory(malformed)();

    await expect(async () => plugin.onLoad?.(ctx)).rejects.toThrow(
      /defaultLevel \(99\) exceeds maxLevel \(50\)/,
    );

    expect(service.list().size).toBe(0);
  });

  it("supports multiple independent factory calls", () => {
    const a = skillsPluginFactory(DEFAULT_SKILLS)();
    const b = skillsPluginFactory(DEFAULT_SKILLS)();
    expect(a).not.toBe(b);
    expect(typeof a.onLoad).toBe("function");
    expect(typeof a.onEnable).toBe("function");
    expect(typeof a.onDisable).toBe("function");
  });

  it("isolates scope teardown to the disposing plugin instance", async () => {
    const service = createSkillsService();
    const ctxA = makeContext("com.hyperforge.skills#scope-a", service);
    const ctxB = makeContext("com.hyperforge.skills#scope-b", service);

    // A registers the default pack.
    const pluginA = skillsPluginFactory(DEFAULT_SKILLS)();
    await pluginA.onEnable?.(ctxA);

    // B registers a single extra skill.
    const extra: SkillDefinition = {
      id: "com.hyperforge.skills.flying",
      displayName: "Flying",
      category: "support",
      maxLevel: 99,
      defaultLevel: 1,
      icon: "🪶",
    };
    const pluginB = skillsPluginFactory([extra])();
    await pluginB.onEnable?.(ctxB);
    expect(service.list().size).toBe(DEFAULT_SKILLS.length + 1);

    // Disposing B's scope removes only B's contribution.
    await ctxB.scope.dispose();
    expect(service.list().size).toBe(DEFAULT_SKILLS.length);
    expect(service.getSkill(extra.id)).toBeUndefined();
    expect(service.getSkill("com.hyperforge.skills.attack")).toBeDefined();
  });
});
