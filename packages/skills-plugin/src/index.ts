/**
 * @hyperforge/skills
 *
 * Reference skills plugin. Second concrete reference alongside
 * @hyperforge/combat. Both prove the @hyperforge/gameplay-framework
 * author surface across all three lifecycle hooks (onLoad,
 * onEnable, onDisable) but from different domain angles —
 * combat is action-oriented; skills is progression-oriented.
 *
 * Shape:
 *   - `SkillCategory` — gameplay grouping ("combat" | "gathering"
 *     | "production" | "support") matching tile-based MMORPG skill panel layout
 *   - `SkillDefinition` — pure data record describing a skill
 *     (id, displayName, category, maxLevel, defaultLevel, icon)
 *   - `SkillsService` — caller-supplied registry the plugin writes
 *     into. Mirrors `CombatAbilityService`.
 *   - `skillsPluginFactory(skills)` — produces a
 *     `PluginFactory<SkillsContext>` parameterized by the skill list,
 *     so tests / downstream integrations can ship different starter
 *     packs without rebuilding the package.
 *   - default export — bakes in a 6-skill starter pack
 *     (attack/strength/hitpoints/woodcutting/fishing/cooking).
 *
 * Lifecycle (all three hooks exercised):
 *   - `onLoad(ctx)` — duplicate-id pre-check across the configured
 *     skill list. Throws synchronously before any registration if
 *     the configuration is malformed.
 *   - `onEnable(ctx)` — registers each skill via
 *     `ctx.registerSkill(skill)`, attaches inverse `unregisterSkill`
 *     to `ctx.scope` for automatic teardown.
 *   - `onDisable(ctx)` — explicit no-op documenting the contract.
 */

import type {
  HyperforgePlugin,
  PluginContextBase,
  PluginFactory,
} from "@hyperforge/gameplay-framework";

/**
 * Skill grouping. Matches the tile-based-MMORPG-style skill-panel layout:
 *   - combat: Attack, Strength, Defense, Ranged, Magic, Hitpoints, Prayer
 *   - gathering: Woodcutting, Mining, Fishing, Hunter
 *   - production: Cooking, Smithing, Crafting, Fletching, Herblore
 *   - support: Agility, Construction, Slayer, Runecrafting
 */
export type SkillCategory = "combat" | "gathering" | "production" | "support";

/**
 * Pure data record for a single skill. No behavior — XP curves,
 * level-up rewards, unlocks live on downstream systems that consume
 * the registry.
 */
export interface SkillDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly category: SkillCategory;
  /** Cap level (typically 99 in the tile-based MMORPG genre). Must be ≥ defaultLevel. */
  readonly maxLevel: number;
  /** Starting level for new players (typically 1; 10 for hitpoints). */
  readonly defaultLevel: number;
  /** Emoji or icon hint for HUD/skill-panel rendering. */
  readonly icon: string;
}

/** Registry the plugin writes into. Callers supply an implementation. */
export interface SkillsService {
  registerSkill(skill: SkillDefinition): void;
  unregisterSkill(id: string): void;
  getSkill(id: string): SkillDefinition | undefined;
  list(): ReadonlyMap<string, SkillDefinition>;
}

export function createSkillsService(): SkillsService {
  const entries = new Map<string, SkillDefinition>();
  return {
    registerSkill(skill) {
      if (entries.has(skill.id)) {
        throw new Error(`skill "${skill.id}" already registered`);
      }
      entries.set(skill.id, skill);
    },
    unregisterSkill(id) {
      entries.delete(id);
    },
    getSkill(id) {
      return entries.get(id);
    },
    list() {
      return entries;
    },
  };
}

/** Per-plugin context handed to the skills reference plugin's hooks. */
export interface SkillsContext extends PluginContextBase {
  /** Register a skill and track cleanup on the scope. */
  registerSkill(skill: SkillDefinition): void;
}

/**
 * Default starter pack — 6 skills covering the major tile-based MMORPG categories.
 * Exported so callers can extend or replace it without rebuilding.
 *
 * Layout: 3 combat + 2 gathering + 1 production. Hitpoints starts
 * at 10 (matches tile-based MMORPG); all other skills start at 1.
 */
export const DEFAULT_SKILLS: readonly SkillDefinition[] = Object.freeze([
  {
    id: "com.hyperforge.skills.attack",
    displayName: "Attack",
    category: "combat",
    maxLevel: 99,
    defaultLevel: 1,
    icon: "⚔️",
  },
  {
    id: "com.hyperforge.skills.strength",
    displayName: "Strength",
    category: "combat",
    maxLevel: 99,
    defaultLevel: 1,
    icon: "💪",
  },
  {
    id: "com.hyperforge.skills.hitpoints",
    displayName: "Hitpoints",
    category: "combat",
    maxLevel: 99,
    defaultLevel: 10,
    icon: "❤️",
  },
  {
    id: "com.hyperforge.skills.woodcutting",
    displayName: "Woodcutting",
    category: "gathering",
    maxLevel: 99,
    defaultLevel: 1,
    icon: "🪓",
  },
  {
    id: "com.hyperforge.skills.fishing",
    displayName: "Fishing",
    category: "gathering",
    maxLevel: 99,
    defaultLevel: 1,
    icon: "🎣",
  },
  {
    id: "com.hyperforge.skills.cooking",
    displayName: "Cooking",
    category: "production",
    maxLevel: 99,
    defaultLevel: 1,
    icon: "🍳",
  },
]);

/**
 * Factory that creates a skills-plugin instance bound to a specific
 * skill list. Parameterized so tests / downstream integrations can
 * ship different starter packs without rebuilding the package.
 */
export function skillsPluginFactory(
  skills: readonly SkillDefinition[],
): PluginFactory<SkillsContext> {
  return () => {
    const plugin: HyperforgePlugin<SkillsContext> = {
      onLoad(_ctx) {
        // Duplicate-id pre-check — fail loud BEFORE any registration
        // so a malformed configuration never half-registers and leaks
        // into the service.
        const seen = new Set<string>();
        for (const skill of skills) {
          if (seen.has(skill.id)) {
            throw new Error(
              `skills plugin load failed: duplicate skill id "${skill.id}"`,
            );
          }
          seen.add(skill.id);
          // Sanity guard: defaultLevel must not exceed maxLevel.
          if (skill.defaultLevel > skill.maxLevel) {
            throw new Error(
              `skills plugin load failed: skill "${skill.id}" defaultLevel (${skill.defaultLevel}) exceeds maxLevel (${skill.maxLevel})`,
            );
          }
        }
      },

      onEnable(ctx) {
        for (const skill of skills) {
          ctx.registerSkill(skill);
        }
      },

      onDisable(_ctx) {
        // Explicit no-op. Scope drain runs AFTER this hook, so the
        // unregister disposers attached during onEnable fire then.
      },
    };
    return plugin;
  };
}

export { manifest } from "./manifest.js";

/**
 * Default plugin factory — the shape a host loader expects when it
 * calls `import(manifest.entry)`. Bakes in the default starter pack
 * so the plugin is usable end-to-end without caller configuration.
 */
const defaultFactory: PluginFactory<SkillsContext> =
  skillsPluginFactory(DEFAULT_SKILLS);

export default defaultFactory;
