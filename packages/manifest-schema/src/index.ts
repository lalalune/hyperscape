/**
 * @hyperforge/manifest-schema
 *
 * Single source of truth for every Hyperforge manifest kind.
 *
 * Each exported schema pair `{Kind}Schema` + `{Kind}Manifest` provides:
 *   - Zod schema: runtime validation at manifest load time
 *   - TypeScript type: static typing in consumers
 *   - Basis for schema-driven editor widgets in World Studio
 *   - Basis for AI-generated manifest mutations (Zod → JSON Schema)
 *
 * No runtime logic lives here. No game-specific defaults. This package is
 * depended on by:
 *   - `@hyperforge/shared` (DataManager loads + validates JSON manifests)
 *   - `asset-forge` (editor reads schemas to render property panels)
 *   - AI tooling (future) — schema-driven generation
 *
 * Every Hyperscape extraction lands here first. Example: `combat.ts` schematizes
 * what was hardcoded in `packages/shared/src/constants/CombatConstants.ts`.
 */

export * from "./accessibility.js";
export * from "./achievements.js";
export * from "./ai-behavior.js";
export * from "./ammunition.js";
export * from "./analytics-events.js";
export * from "./animations.js";
export * from "./arena-layout.js";
export * from "./asset-pack.js";
export * from "./auction-house.js";
export * from "./audio-bus-mix.js";
export * from "./avatars.js";
export * from "./banking.js";
export * from "./biomes.js";
export * from "./buildings.js";
export * from "./camera-profiles.js";
export * from "./chat-channels.js";
export * from "./cinematic.js";
export * from "./combat.js";
export * from "./combat-spells.js";
export * from "./combat-tuning.js";
export * from "./combat-tuning-agent-bindings.js";
export * from "./commerce.js";
export * from "./content-pack.js";
export * from "./crash-reporter.js";
export * from "./credits.js";
export * from "./damage-types.js";
export * from "./deploy-targets.js";
export * from "./dialogue.js";
export * from "./dialogue-condition-bindings.js";
export * from "./duel.js";
export * from "./duel-arenas.js";
export * from "./economy-tuning.js";
export * from "./editor-snap.js";
export * from "./enchantments.js";
export * from "./equipment.js";
export * from "./factions.js";
export * from "./fast-travel.js";
export * from "./feature-flags.js";
export * from "./friends-social.js";
export * from "./game.js";
export * from "./gathering.js";
export * from "./gathering-resources.js";
export * from "./group-finder.js";
export * from "./haptics.js";
export * from "./housing.js";
export * from "./input-actions.js";
export * from "./interaction.js";
export * from "./interaction-prompts.js";
export * from "./item-sets.js";
export * from "./key-prompt-icons.js";
export * from "./leaderboards.js";
export * from "./level-streaming.js";
export * from "./license-agreements.js";
export * from "./loading-screens.js";
export * from "./lighting-bake.js";
export * from "./loadouts.js";
export * from "./localization.js";
export * from "./lod-settings.js";
export * from "./loot-tables.js";
export * from "./mob-loot-table-mappings.js";
export * from "./npc-dialogue-bindings.js";
export * from "./mail.js";
export * from "./main-menu.js";
export * from "./matchmaking-tuning.js";
export * from "./moderation.js";
export * from "./mounts.js";
export * from "./music.js";
export * from "./music-state-machine.js";
export * from "./nav-mesh.js";
export * from "./news-feed.js";
export * from "./npc-definitions.js";
export * from "./npc-schedule.js";
export * from "./npc-sizes.js";
export * from "./npcs.js";
export * from "./onboarding-goals.js";
export * from "./pack-header.js";
export * from "./parental-controls.js";
export * from "./particle-graph.js";
export * from "./party-guild.js";
export * from "./pet-companion.js";
export * from "./physics-config.js";
export * from "./player-emotes.js";
export * from "./plugin.js";
export * from "./plugin-registry.js";
export * from "./post-process-volumes.js";
export * from "./prayers.js";
export * from "./prefab.js";
export * from "./processing.js";
export * from "./profiler.js";
export * from "./project.js";
export * from "./project-pack.js";
export * from "./project-settings.js";
export * from "./push-notifications.js";
export * from "./quality-presets.js";
export * from "./quests.js";
export * from "./recipes.js";
export * from "./render-profile.js";
export * from "./replication.js";
export * from "./respawn.js";
export * from "./runes.js";
export * from "./save-data.js";
export * from "./screenshot.js";
export * from "./seasons.js";
export * from "./server-browser.js";
export * from "./sfx.js";
export * from "./skill-icons.js";
export * from "./skill-unlocks.js";
export * from "./skybox-atmosphere.js";
export * from "./smithing.js";
export * from "./spell-visuals.js";
export * from "./stations.js";
export * from "./status-effects.js";
export * from "./store-front.js";
export * from "./stores.js";
export * from "./talent-trees.js";
export * from "./terrain-pack.js";
export * from "./tier-requirements.js";
export * from "./time-weather.js";
export * from "./titles.js";
export * from "./tooltips.js";
export * from "./tools.js";
export * from "./trading.js";
export * from "./transmog.js";
export * from "./trees.js";
export * from "./tutorial-flows.js";
export * from "./vegetation.js";
export * from "./vegetation-pack.js";
export * from "./vfx.js";
export * from "./voice-chat.js";
export * from "./water-pack.js";
export * from "./weapon-styles.js";
export * from "./world-areas.js";
export * from "./world-events.js";
export * from "./world-config.js";
export * from "./world-structure.js";
export * from "./xp-curves.js";
