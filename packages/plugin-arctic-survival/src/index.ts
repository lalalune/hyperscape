/**
 * @hyperforge/plugin-arctic-survival
 *
 * Third non-Hyperia game plugin. Phase 5.1 of
 * `PLAN_AAA_MASTER_AUDIT.md` — proves the framework can host
 * ARBITRARILY many gameplay plugins, not just the
 * hyperscape + shooter-demo pair.
 *
 * Identity:
 *   - Manifest id: `com.hyperforge.plugin-arctic-survival`
 *   - Depends only on `@hyperforge/combat` (NOT on
 *     `@hyperforge/skills` or `@hyperforge/hyperscape`).
 *   - Pairs naturally with the `@hyperforge/content-pack-arctic-v1`
 *     content pack but doesn't require it.
 *
 * Contribution surface (v1):
 *   - One `CombatAbility`: "frost-blast" (utility, cold-snap AOE).
 *   - One widget: TemperatureGauge (HUD, shows cold-exposure level).
 *   - 4 entityTypes: heat_source (station), ice_block + frozen_cache
 *     (resources), expedition_guide (NPC).
 *   - paletteCategories: ["arctic-shelters", "arctic-resources"]
 *   - toolbarTools: ["arctic-cold-exposure-debug"]
 *
 * Same file shape as `plugin-shooter-demo`: `plugin.json` declares
 * the contract, `manifest.ts` validates at module load, `index.ts`
 * exports a `PluginFactory` that registers everything during
 * `onEnable`.
 */

import type {
  HyperforgePlugin,
  PluginFactory,
} from "@hyperforge/gameplay-framework";
import { type CombatAbility, type CombatContext } from "@hyperforge/combat";

import { temperatureGaugeRegistration } from "./widgets/TemperatureGauge.js";

/**
 * The cold-snap ability this plugin contributes. Chosen
 * specifically to have NO overlap with hyperscape's combat
 * starter pack or shooter-demo's `demo-shoot` so the acceptance
 * test can prove all three plugins' abilities coexist in
 * SEPARATE `CombatAbilityService` instances.
 *
 * `kind: "magic"` — frost blast is conceptually a spell.
 * Survival mechanics (cold-exposure ticking, heat-source
 * interaction) live in future cuts as a separate
 * `SurvivalContext` extension; the combat surface is the
 * minimum needed to demonstrate the plugin contribution path.
 */
export const FROST_BLAST_ABILITY: CombatAbility = Object.freeze({
  id: "arctic-frost-blast",
  displayName: "Frost Blast",
  kind: "magic",
  baseDamage: 8,
  accuracy: 0.9,
});

/**
 * Factory — mirrors `combatPluginFactory` / `shooterDemoPluginFactory`
 * shape for consistency. Parameterized so tests can ship a
 * different ability set without rebuilding the package.
 */
export function arcticSurvivalPluginFactory(
  abilities: readonly CombatAbility[] = [FROST_BLAST_ABILITY],
): PluginFactory<CombatContext> {
  return () => {
    const plugin: HyperforgePlugin<CombatContext> = {
      onLoad(_ctx) {
        const seen = new Set<string>();
        for (const ability of abilities) {
          if (seen.has(ability.id)) {
            throw new Error(
              `arctic-survival plugin load failed: duplicate ability id "${ability.id}"`,
            );
          }
          seen.add(ability.id);
        }
      },

      onEnable(ctx) {
        for (const ability of abilities) {
          ctx.registerAbility(ability);
        }

        // Widget contribution — optional; hosts without a UI
        // renderer (dedicated server) leave `ctx.widgets`
        // undefined and this block no-ops. Browser client +
        // asset-forge editor provide the adapter and the
        // temperature gauge appears on screen.
        if (ctx.widgets) {
          ctx.widgets.register(temperatureGaugeRegistration);
        }
      },

      onDisable(_ctx) {
        // Scope disposers fire after onDisable — they unregister
        // everything registerAbility added. Nothing to do here.
      },
    };
    return plugin;
  };
}

export { manifest } from "./manifest.js";

// Widget surface — re-exported so hosts that pre-register
// widgets out-of-band (editor palette, offline validators) can
// grab the registration without calling through the plugin
// lifecycle.
export {
  TemperatureGauge,
  temperatureGaugePropsSchema,
  temperatureGaugeRegistration,
  temperatureGaugeWidget,
} from "./widgets/TemperatureGauge.js";

/**
 * Default factory — the shape a host loader expects when it
 * calls `import(manifest.entry)`. Bakes in the frost-blast
 * ability pack.
 */
const defaultFactory: PluginFactory<CombatContext> =
  arcticSurvivalPluginFactory();
export default defaultFactory;
