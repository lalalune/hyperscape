/**
 * ManifestService
 * Service for reading and writing game manifest JSON files
 *
 * Handles all manifest operations including:
 * - Listing available manifests
 * - Reading manifest content
 * - Writing/updating manifest content
 * - Validating manifest schemas
 * - Creating backups before writes
 */

import fs from "fs";
import path from "path";

// Manifest metadata describing each manifest file
interface ManifestInfo {
  name: string;
  filename: string;
  description: string;
  category: ManifestCategory;
  editable: boolean;
  schema: ManifestSchemaType;
}

type ManifestCategory =
  | "world"
  | "entities"
  | "items"
  | "progression"
  | "audio"
  | "generated";

type ManifestSchemaType =
  | "biomes"
  | "buildings"
  | "model-bounds"
  | "music"
  | "npcs"
  | "prayers"
  | "world-areas"
  | "world-config"
  | "quests"
  | "skill-unlocks"
  | "stations"
  | "stores"
  | "tier-requirements"
  | "tools"
  | "vegetation"
  | "lod-settings"
  | "items"
  | "gathering"
  | "woodcutting"
  | "mining"
  | "fishing"
  | "combat-spells"
  | "npcs-spawn-constants"
  | "recipes"
  | "combat"
  | "ammunition"
  | "runes"
  | "duel-arenas"
  | "dialogue-condition-bindings"
  | "combat-tuning"
  | "combat-tuning-agent-bindings"
  | "xp-curves"
  | "achievements"
  | "loot-tables"
  | "mob-loot-table-mappings"
  | "dialogue"
  | "npc-dialogue-bindings"
  | "localization"
  | "time-weather"
  | "accessibility"
  | "analytics-events"
  | "render-profiles"
  | "damage-types"
  | "status-effects"
  | "camera-profiles"
  | "audio-bus-mix"
  | "post-process-volumes"
  | "npc-schedule"
  | "chat-channels"
  | "interaction-prompts"
  | "music-state-machine"
  | "save-data"
  | "factions"
  | "mounts"
  | "voice-chat"
  | "parental-controls"
  | "tutorial-flows"
  | "haptics"
  | "physics-config"
  | "feature-flags"
  | "crash-reporter"
  | "push-notifications"
  | "license-agreements"
  | "news-feed"
  | "moderation"
  | "fast-travel"
  | "respawn"
  | "talent-trees"
  | "auction-house"
  | "transmog"
  | "housing"
  | "group-finder"
  | "friends-social"
  | "loadouts"
  | "trading"
  | "item-sets"
  | "leaderboards"
  | "titles"
  | "world-events"
  | "seasons"
  | "pet-companion"
  | "enchantments"
  | "mail"
  | "tooltips"
  | "key-prompt-icons"
  | "screenshot"
  | "party-guild"
  | "economy-tuning"
  | "loading-screens"
  | "skybox-atmosphere"
  | "particle-graph"
  | "cinematic"
  | "editor-snap"
  | "deploy-targets"
  | "input-actions"
  | "profiler"
  | "replication"
  | "prefab"
  | "level-streaming"
  | "lighting-bake"
  | "project-settings"
  | "ai-behavior"
  | "animations"
  | "quality-presets"
  | "nav-mesh"
  | "lod-settings"
  | "sfx"
  | "vfx"
  | "main-menu"
  | "credits"
  | "duel"
  | "arena-layout"
  | "avatars"
  | "banking"
  | "trees"
  | "weapon-styles"
  | "npc-sizes"
  | "onboarding-goals"
  | "skill-icons"
  | "player-emotes"
  | "matchmaking-tuning"
  | "spell-visuals"
  | "profiler"
  | "server-browser"
  | "store-front"
  | "commerce"
  | "interaction"
  | "combat"
  | "equipment"
  | "game"
  | "smithing"
  | "world-structure"
  | "gathering"
  | "processing";

// Define all manifest files and their metadata
const MANIFEST_DEFINITIONS: ManifestInfo[] = [
  {
    name: "biomes",
    filename: "biomes.json",
    description:
      "Biome definitions with vegetation layers, mobs, and difficulty settings",
    category: "world",
    editable: true,
    schema: "biomes",
  },
  {
    name: "buildings",
    filename: "buildings.json",
    description: "Town building definitions and placements",
    category: "world",
    editable: true,
    schema: "buildings",
  },
  {
    name: "model-bounds",
    filename: "model-bounds.json",
    description: "Auto-generated model bounding boxes (read-only)",
    category: "generated",
    editable: false,
    schema: "model-bounds",
  },
  {
    name: "music",
    filename: "music.json",
    description: "Music track definitions and categories",
    category: "audio",
    editable: true,
    schema: "music",
  },
  {
    name: "npcs",
    filename: "npcs.json",
    description: "NPC definitions including mobs, dialogue, drops, and stats",
    category: "entities",
    editable: true,
    schema: "npcs",
  },
  {
    name: "npcs-spawn-constants",
    filename: "npcs-spawn-constants.json",
    description:
      "NPC spawn-rule tuning constants (respawn time, cap per zone, aggro radius)",
    category: "entities",
    editable: true,
    schema: "npcs-spawn-constants",
  },
  {
    name: "prayers",
    filename: "prayers.json",
    description: "Prayer ability definitions",
    category: "progression",
    editable: true,
    schema: "prayers",
  },
  {
    name: "world-areas",
    filename: "world-areas.json",
    description: "World area definitions with NPCs, resources, and stations",
    category: "world",
    editable: true,
    schema: "world-areas",
  },
  {
    name: "world-config",
    filename: "world-config.json",
    description: "World generation settings for terrain, towns, and roads",
    category: "world",
    editable: true,
    schema: "world-config",
  },
  {
    name: "quests",
    filename: "quests.json",
    description: "Quest definitions with stages and rewards",
    category: "progression",
    editable: true,
    schema: "quests",
  },
  {
    name: "skill-unlocks",
    filename: "skill-unlocks.json",
    description: "Skill level unlock definitions",
    category: "progression",
    editable: true,
    schema: "skill-unlocks",
  },
  {
    name: "stations",
    filename: "stations.json",
    description: "Crafting station definitions",
    category: "world",
    editable: true,
    schema: "stations",
  },
  {
    name: "stores",
    filename: "stores.json",
    description: "Store inventory definitions",
    category: "items",
    editable: true,
    schema: "stores",
  },
  {
    name: "tier-requirements",
    filename: "tier-requirements.json",
    description: "Equipment tier level requirements",
    category: "items",
    editable: true,
    schema: "tier-requirements",
  },
  {
    name: "tools",
    filename: "tools.json",
    description: "Tool item definitions",
    category: "items",
    editable: true,
    schema: "tools",
  },
  {
    name: "vegetation",
    filename: "vegetation.json",
    description: "Vegetation asset definitions with LOD settings",
    category: "world",
    editable: true,
    schema: "vegetation",
  },
  {
    name: "lod-settings",
    filename: "lod-settings.json",
    description:
      "LOD distance thresholds, dissolve settings, and vertex budgets",
    category: "world",
    editable: true,
    schema: "lod-settings",
  },
  // Combat
  {
    name: "combat-spells",
    filename: "combat-spells.json",
    description: "Magic combat spell definitions with rune costs",
    category: "progression",
    editable: true,
    schema: "combat-spells",
  },
  {
    name: "runes",
    filename: "runes.json",
    description: "Rune definitions for magic system",
    category: "items",
    editable: true,
    schema: "runes",
  },
  {
    name: "ammunition",
    filename: "ammunition.json",
    description: "Arrow and bolt ammunition definitions",
    category: "items",
    editable: true,
    schema: "ammunition",
  },
  {
    name: "duel-arenas",
    filename: "duel-arenas.json",
    description: "Duel arena definitions with spawn points",
    category: "world",
    editable: true,
    schema: "duel-arenas",
  },
  {
    name: "dialogue-condition-bindings",
    filename: "dialogue-condition-bindings.json",
    description:
      "Authored dialogue showIf/condition predicate bindings (quest/item/level)",
    category: "progression",
    editable: true,
    schema: "dialogue-condition-bindings",
  },
  {
    name: "combat-tuning",
    filename: "combat-tuning.json",
    description:
      "Combat tuning profiles consumed by DuelCombatAI (tick rate, HP thresholds, engagement ranges)",
    category: "progression",
    editable: true,
    schema: "combat-tuning",
  },
  {
    name: "combat-tuning-agent-bindings",
    filename: "combat-tuning-agent-bindings.json",
    description:
      "Per-agent combat-tuning profile overrides (characterId → profileId | null)",
    category: "progression",
    editable: true,
    schema: "combat-tuning-agent-bindings",
  },
  {
    name: "xp-curves",
    filename: "xp-curves.json",
    description:
      "Level↔XP curves per skill (formula or lookup). Consumed by xpCurveRegistry.",
    category: "progression",
    editable: true,
    schema: "xp-curves",
  },
  {
    name: "achievements",
    filename: "achievements.json",
    description:
      "Achievement definitions (event/count/stat triggers + prerequisite graph). Consumed by AchievementEvaluator.",
    category: "progression",
    editable: true,
    schema: "achievements",
  },
  {
    name: "loot-tables",
    filename: "loot-tables.json",
    description:
      "Authored loot tables — weighted drop pools consumed by LootSystem for mob deaths, chests, and quest rewards",
    category: "progression",
    editable: true,
    schema: "loot-tables",
  },
  {
    name: "mob-loot-table-mappings",
    filename: "mob-loot-table-mappings.json",
    description:
      "Mob-type → loot-table-id pointers routing mob deaths into the authored LootTablesManifest",
    category: "progression",
    editable: true,
    schema: "mob-loot-table-mappings",
  },
  {
    name: "dialogue",
    filename: "dialogue.json",
    description:
      "Authored dialogue trees (line/choice/branch/action/end nodes) consumed by DialogueSystem",
    category: "progression",
    editable: true,
    schema: "dialogue",
  },
  {
    name: "npc-dialogue-bindings",
    filename: "npc-dialogue-bindings.json",
    description:
      "NPC-id → authored-dialogue-tree-id pointers routing NPC interactions into the authored DialogueManifest",
    category: "progression",
    editable: true,
    schema: "npc-dialogue-bindings",
  },
  {
    name: "time-weather",
    filename: "time-weather.json",
    description:
      "Authored day/night cycle keyframes + weather state machine. Consumed by TimeWeatherDriver.",
    category: "world",
    editable: true,
    schema: "time-weather",
  },
  {
    name: "accessibility",
    filename: "accessibility.json",
    description:
      "Per-game accessibility defaults (font scale, color-blind palette, subtitles, input assist, reduced motion).",
    category: "progression",
    editable: true,
    schema: "accessibility",
  },
  {
    name: "analytics-events",
    filename: "analytics-events.json",
    description:
      "Declared analytics event catalog — names, property types, cardinality + PII hints. Consumed by the runtime analytics bridge to validate emits.",
    category: "progression",
    editable: true,
    schema: "analytics-events",
  },
  {
    name: "render-profiles",
    filename: "render-profiles.json",
    description:
      "Render profile presets — tone mapping, bloom, fog, ambient light, environment map, color grading. Consumed by RenderProfileRegistry + PostProcessVolumeCompositor.",
    category: "world",
    editable: true,
    schema: "render-profiles",
  },
  {
    name: "damage-types",
    filename: "damage-types.json",
    description:
      "Damage-type registry — typed namespace (physical/fire/ice/…), sparse (attacker,target) resistance matrix, and `ignoresResistances` bypass. Consumed by DamageTypeRegistry.",
    category: "progression",
    editable: true,
    schema: "damage-types",
  },
  {
    name: "status-effects",
    filename: "status-effects.json",
    description:
      "Buff/debuff registry — stat modifiers, stack rules, per-tick damage/heal, VFX/SFX hooks. Consumed by StatusEffectSystem.",
    category: "progression",
    editable: true,
    schema: "status-effects",
  },
  {
    name: "camera-profiles",
    filename: "camera-profiles.json",
    description:
      "Camera rig profiles — first-person, third-person, top-down, orbit, free-fly — with FOV, lag, and collision tuning. Consumed by CameraProfileRegistry.",
    category: "world",
    editable: true,
    schema: "camera-profiles",
  },
  {
    name: "audio-bus-mix",
    filename: "audio-bus-mix.json",
    description:
      "Audio bus DAG + duck rules — master/music/sfx/ui/ambient routing with per-bus volume, mute, solo, lowpass/highpass filters. Consumed by AudioBusMixer.",
    category: "world",
    editable: true,
    schema: "audio-bus-mix",
  },
  {
    name: "post-process-volumes",
    filename: "post-process-volumes.json",
    description:
      "Region-bounded post-process overrides — unbounded/sphere/aabb volumes with priority, blend distance, and per-override exposure/bloom/fog/saturation/vignette. Consumed by PostProcessVolumeCompositor.",
    category: "world",
    editable: true,
    schema: "post-process-volumes",
  },
  {
    name: "npc-schedule",
    filename: "npc-schedule.json",
    description:
      "NPC time-of-day schedules — activity slots (idle/walk-to/work-at/sleep/patrol/socialize/custom) with day-of-week masks and waypoint/patrol-path anchors. Consumed by NPCScheduleDriver.",
    category: "progression",
    editable: true,
    schema: "npc-schedule",
  },
  {
    name: "chat-channels",
    filename: "chat-channels.json",
    description:
      "Chat channel registry — global/zone/party/guild/whisper/system/custom scopes with permission tiers, rate limits, message length caps, and filter-rule references. Consumed by ChatRouter.",
    category: "progression",
    editable: true,
    schema: "chat-channels",
  },
  {
    name: "interaction-prompts",
    filename: "interaction-prompts.json",
    description:
      "Interaction HUD prompts — 'Press [E] to open chest', 'Hold [F] to loot' templates keyed by interactionKind with tap/hold/toggle/rapid-tap modes, auto-hide distance, and unique-per-kind priority tie-break. Consumed by InteractionPromptSelector.",
    category: "progression",
    editable: true,
    schema: "interaction-prompts",
  },
  {
    name: "music-state-machine",
    filename: "music-state-machine.json",
    description:
      "Dynamic music state machines — explore/combat/boss/victory graphs with predicate-gated transitions, equal-power crossfades, stingers, and bar quantization. Consumed by MusicStateController.",
    category: "progression",
    editable: true,
    schema: "music-state-machine",
  },
  {
    name: "save-data",
    filename: "save-data.json",
    description:
      "Plugin save-data slices — persisted state declarations scoped to character/account/world/guild, versioned single-step migrations, periodic-snapshot toggle. Consumed by SaveDataMigrator + SaveDataRegistry.",
    category: "progression",
    editable: true,
    schema: "save-data",
  },
  {
    name: "factions",
    filename: "factions.json",
    description:
      "Reputation graph — factions with tiered standing bands (hated/hostile/neutral/friendly/honored/exalted) + sparse pairwise relationship overrides + mutually-exclusive rep chains. Feeds the (forthcoming) FactionSystem.",
    category: "progression",
    editable: true,
    schema: "factions",
  },
  {
    name: "mounts",
    filename: "mounts.json",
    description:
      "Mount registry — ground/water/flight locomotion with per-mode speeds, stamina model (maxStamina=0 = unlimited sprint), passenger/cargo capacity, summon rules, forceDismountOnDamage anti-kiting toggle. Feeds the (forthcoming) MountSystem.",
    category: "progression",
    editable: true,
    schema: "mounts",
  },
  {
    name: "voice-chat",
    filename: "voice-chat.json",
    description:
      "Voice-chat rooms (proximity/party/guild/raid/global/custom) with transmission modes (pushToTalk/openMic/voiceActivation), per-player mute defaults, auto-mute gates, codec/bandwidth tuning (opus/g722), voice-activation thresholds, and moderation recording policy. Consumed by (forthcoming) VoiceChatSystem.",
    category: "progression",
    editable: true,
    schema: "voice-chat",
  },
  {
    name: "parental-controls",
    filename: "parental-controls.json",
    description:
      "Age-gated profiles (minAccountAgeYears + maxExclusive + priority) bundling playTime (daily/weekly caps + allowed hours + break reminders), spend (per-day/week/month/single-txn caps + guardian approval), communication (allowed chat scopes + voice modes + whispers + friend requests + family-friendly filter), and content (blood/profanity/substances/mature theme suppression) rules, plus a guardian workflow (email verification + approval timeout + weekly summaries). Consumed by (forthcoming) ParentalControlsSystem.",
    category: "progression",
    editable: true,
    schema: "parental-controls",
  },
  {
    name: "tutorial-flows",
    filename: "tutorial-flows.json",
    description:
      "Declarative onboarding / tutorial graphs — flows composed of steps with trigger-based advancement (event/enter-volume/item-acquired/skill-level/manual-continue/quest-stage), prompt anchors (screen-*/widget/world-entity/world-position), next/skip pointers, and a prerequisite DAG across flows. Consumed by (forthcoming) TutorialSystem.",
    category: "progression",
    editable: true,
    schema: "tutorial-flows",
  },
  {
    name: "haptics",
    filename: "haptics.json",
    description:
      "Controller rumble / touch / VR haptic pattern registry — per-stage channel (low/high freq, triggers, mobile-default), amplitude envelope (constant/linear/ease-*), optional frequency hint, loop + loopGap, priority + cancellable + category (combat/ui/ambient/notification/environment/custom). Consumed by (forthcoming) HapticsSystem.",
    category: "progression",
    editable: true,
    schema: "haptics",
  },
  {
    name: "physics-config",
    filename: "physics-config.json",
    description:
      "Authored PhysX tuning — simulation (gravity, fixed-step, max substeps), solver iterations (position/velocity/deterministic), sleep thresholds, CCD policy, physics-material registry (friction/restitution/density presets) referenced by colliders, and the sparse collision-layer interaction matrix (unordered (a,b) → collide/overlap/ignore). Runtime PhysicsSystem consumes authored tuning once wired.",
    category: "progression",
    editable: true,
    schema: "physics-config",
  },
  {
    name: "feature-flags",
    filename: "feature-flags.json",
    description:
      "Live-ops feature gating — named targeting rules (platforms/regions/min-account-age/min-character-level/rollout-percent/allow-block lists, all AND), boolean or variant flags (first-match rule→variant assignment), mutual-exclusion groups (at most one competing flag per player). Consumed by (forthcoming) FeatureFlagRegistry runtime.",
    category: "progression",
    editable: true,
    schema: "feature-flags",
  },
  {
    name: "crash-reporter",
    filename: "crash-reporter.json",
    description:
      "Crash-reporter policy — sink registry (http/localFile/syslog/custom) referencing deploy-target endpoint names (NOT real URLs — commit-safe), per-sink severity/sampling/retry rules, symbolication settings, breadcrumb ring buffer, PII redaction categories (ip/email/username/deviceId/filePath/stackFrameArgs/envVars/customFields), consent gating, and in-flight deduplication window. Consumed by (forthcoming) CrashReporterSystem.",
    category: "progression",
    editable: true,
    schema: "crash-reporter",
  },
  {
    name: "push-notifications",
    filename: "push-notifications.json",
    description:
      "Push-notification delivery policy — channel registry (apns/fcm/webPush/email/inApp) referencing deploy-target credentials by name (commit-safe), notification categories with per-category channel fan-out + priority + quiet-hours respect + collapseKey + localization keys, quiet-hours default window (HH:MM with overnight support), consent gating, global rate cap, and dedupe window. Consumed by (forthcoming) PushNotificationsSystem.",
    category: "progression",
    editable: true,
    schema: "push-notifications",
  },
  {
    name: "license-agreements",
    filename: "license-agreements.json",
    description:
      "Legal document registry — 7-kind catalog (eula/tos/privacy/coc/ageConsent/dlcAddendum/custom) with SemVer-versioned histories, per-version JurisdictionalVariant[] keyed by global / ISO-3166-1 / ISO-3166-2, acceptance gates (beforeAccountCreation / beforeFirstLogin / beforeGameplay / beforePurchase / onNextLogin / optional), revocation policy, and consent-flow rules. Body text lives outside the manifest (bodyAssetRef). Consumed by (forthcoming) LegalConsentSystem.",
    category: "progression",
    editable: true,
    schema: "license-agreements",
  },
  {
    name: "news-feed",
    filename: "news-feed.json",
    description:
      "In-game announcement feed — categorized entries (patch notes, maintenance, events, hotfixes) with priority band (critical/high/normal/low), publish/expire ISO windows, targeting (platforms/regionPrefixes/minClientBuild/minCharacterLevel/minAccountAgeDays/requiresFlagId), pinned/dismissable/trackReads flags, bodyAssetRef pointers (text kept out of the manifest), and feed-level poll/cache/auto-show rules. Consumed by (forthcoming) NewsFeedSystem.",
    category: "progression",
    editable: true,
    schema: "news-feed",
  },
  {
    name: "moderation",
    filename: "moderation.json",
    description:
      "Trust-and-safety substrate — report-category registry with 8-default-action enum, chat filter-rule registry (4 match kinds × 5 actions) pointing at external pattern assets (slur lists NOT in manifest), per-category sanction ladders (7-action tier enum + strictly-increasing atOffenseCount + duration=0-as-permanent-for-ban-only), and global rule blocks (reportRateLimits day≥hour superset, autoModeration noisy-reporter demotion, appeals workflow, banPolicy IP/hardware/cascade toggles). Consumed by (forthcoming) ModerationSystem.",
    category: "progression",
    editable: true,
    schema: "moderation",
  },
  {
    name: "fast-travel",
    filename: "fast-travel.json",
    description:
      "WoW-flight-master-style travel graph — 7-kind node registry (flightMaster/portalStone/hearthBindPoint/wormhole/teleportAnchor/mountBoard/custom) + 5-kind edge registry (flightAnimated/instantTeleport/fadedCutscene/loadingScreen/vehicleControlled) with bidirectional|oneWayForward direction, 5-gate unlock (visit/quest/achievement/level/reputation), and global rules (blockedInCombat/pvpFlagged/instanced, globalCooldownSec, channelTimeSec↔cancelOnDamage paired refinement, maxHearthBindings). Consumed by (forthcoming) FastTravelSystem.",
    category: "world",
    editable: true,
    schema: "fast-travel",
  },
  {
    name: "respawn",
    filename: "respawn.json",
    description:
      "Death / respawn policy — bind-point registry (7-kind graveyard/innkeeper/capitalSpawn/dungeonEntrance/raidEntrance/playerHousing/custom with allowBindHere/corpseRunAllowed/applyResurrectionSickness toggles, level + faction gates) plus global rule blocks for DeathPenalty (xpLoss/delevel/goldLoss/durability/drop policy with grace window), CorpseRun (ghost speed/invisibility/invuln/despawn/PvP full-loot/proximity-rez/corpse-teleport), and Resurrection (sickness minutes, stat reduction, auto-res-at-bind, spirit-guide res, sickness min level). Consumed by (forthcoming) RespawnSystem.",
    category: "progression",
    editable: true,
    schema: "respawn",
  },
  {
    name: "talent-trees",
    filename: "talent-trees.json",
    description:
      "Branching progression registry — 6-kind tree enum (class/weapon/profession/racial/pet/custom) + 6-kind node enum (statBoost/abilityGrant/abilityModifier/passive/keystone/aura) DAG with prereq (nodeId + minPoints), tier 0..20 with tierPointRequirement gating, maxPoints 1..10 per node, exclusiveWithSiblings sibling-lock, 20×40 grid layout, and respec rules (baseCost + costMultiplierPerUse + freeRespecsPerWeek + respecCooldownHours + allowPartialRespec). Schema refinements enforce DFS DAG cycle detection, prereq resolves + minPoints≤target.maxPoints + prereq target tier < current tier, keystone requires tags + maxPoints=1, abilityGrant/Modifier requires abilityRef, custom-kind requires customKey, and max-tier×tierPointRequirement ≤ totalPoints. Consumed by (forthcoming) TalentTreeSystem.",
    category: "progression",
    editable: true,
    schema: "talent-trees",
  },
  {
    name: "auction-house",
    filename: "auction-house.json",
    description:
      "Auction-house policy blob — listing rules (3-model bidOnly/buyoutOnly/bidAndBuyout, strictly-increasing durationsHours, depositFraction + deposit-minimum, maxListingsPer-char/account with account-superset refinement, minReserve/maxListing price caps, stacks, 3-expiry-policy returnToSeller/relistAtReserve/destroy), bidding rules (minIncrementFraction + anti-snipe window/extension paired refinement + outbid refund + bidder anonymity), cancellation rules (allow/deposit-forfeit/blocked-window ≤240min + outstanding-bid refunds), fees (commissionFraction + currencyId + premium-currency + daily-revenue cap), search (page-size 5..500 + query-length + rate-limit + seller anonymity + public API), and anti-manipulation heuristics (flag-overpriced fraction, rapid list+cancel, self-bidding log|block policy). Manifest-level refinement: bidOnly|bidAndBuyout requires bidding.minIncrementFraction>0 (else bid war cannot progress). Consumed by (forthcoming) AuctionHouseSystem.",
    category: "progression",
    editable: true,
    schema: "auction-house",
  },
  {
    name: "transmog",
    filename: "transmog.json",
    description:
      "Cosmetic appearance-override registry — global rules (enabled, lockedSlots, accountWideByDefault, applyCostPerSlotCurrency, requireSourceInInventory, allowHideSlot, allowDye) + outfit-save rules (enabled + maxOutfitsPerCharacter + allowOutfitSharing + enabled⇒maxOutfits>0 refinement) + per-source appearance list (10-slot enum shared with enchantments.ts, 6-unlock-model onFirstEquip/onFirstAcquire/vendorPurchase/questReward/collectionEvent/manual, perCharacter|perAccount scope, race/class/faction restriction with `all` wildcard or ≥1 ManifestRef, 6-rarity tier, #rrggbb color). Source refinements: vendorPurchase requires vendorCost>0, onFirstEquip|Acquire requires itemId. Manifest-level refinement: unique source ids. Consumed by (forthcoming) TransmogSystem.",
    category: "progression",
    editable: true,
    schema: "transmog",
  },
  {
    name: "housing",
    filename: "housing.json",
    description:
      "Player housing registry — plot-type registry (6-category apartment/cottage/manor/estate/openWorld/guildHall) with per-plot size (width/depth/heightMeters), slot caps (interior/exterior/lighting/customMedia), visitorCap, purchase/upkeep cost, minCharLevel, transferable + instanced. Global rule blocks: customization (decoration/structural skins/edits/clipping + stack-height + session-minutes), permissions (coOwners/friendEntries/blockEntries/publicListing), upkeep (cyclePeriodDays with 0=lifetime + gracePeriodDays + reclaimAfterDays > gracePeriodDays strict refinement), visitors (interact/guestbook + combatPolicy allow/block/ownerChoice). Manifest-level refinements: unique plotType ids + maxPlotsPerAccount ≥ maxPlotsPerCharacter + enabled=true requires ≥1 plotType. Consumed by (forthcoming) HousingSystem.",
    category: "progression",
    editable: true,
    schema: "housing",
  },
  {
    name: "group-finder",
    filename: "group-finder.json",
    description:
      "LFG / dungeon-finder content registry — 7-kind content (dungeon/raid/scenario/battleground/arena/worldBoss/custom) with min/max group size, 5-role (tank/healer/dps/support/flex) requirements, 4-policy queue (random/specific/ranked/casual), level/gear/rating gates (minRating>0 requires ranked policy), plus matchmaking (queueTimeout/readyCheck/backfill/deserter/widening/crossRealm/crossFaction) and rewards (daily/weekly completion bonuses + consolation currency + role-incentive) blocks. Refinements: minGroupSize≤maxGroupSize, role-count sum ≤ maxGroupSize, unique content ids, enabled=true requires content. Consumed by (forthcoming) GroupFinderSystem.",
    category: "progression",
    editable: true,
    schema: "group-finder",
  },
  {
    name: "friends-social",
    filename: "friends-social.json",
    description:
      "MMO social-graph policy blob — friends (max 1..1000, scope perCharacter/perAccount/perRealm, cross-faction/realm toggles, request-expire, offline-messages, per-friend notes), ignore (max, expire-days, blocksAllInteractions, transparent|silent), recent-players (max entries + retention + record-party/finder/pvp filters), online-status (4 visibility modes, broadcast-offline/online edges, zone+last-seen). Refinements enforce friends.scope == ignore.scope and defaultVisibility='invisible' requires allowPlayerOverride. Consumed by (forthcoming) SocialSystem.",
    category: "progression",
    editable: true,
    schema: "friends-social",
  },
  {
    name: "loadouts",
    filename: "loadouts.json",
    description:
      "WoW Equipment-Manager-style saved character configurations — maxSlotsPerCharacter (0..50) with freeSlotCount premium-unlock split; 4 rule groups: slot (6-category subset equipment/consumables/abilities/prayers/talents/runes + fullReplacement + pullFromBags/Bank), naming (name-length + profanity-filter + icon-presets), swap (always/outOfCombat/safeZoneOnly policy + cooldown + channel-time with cancelChannelOnDamage-requires-channel refinement + autoRestoreOnRespawn), sharing (export/import/partyShare with partyShare-requires-both refinement). Manifest-level refinements enforce freeSlotCount≤maxSlots and enabled=true requires maxSlots>0. Consumed by (forthcoming) LoadoutSystem.",
    category: "progression",
    editable: true,
    schema: "loadouts",
  },
  {
    name: "trading",
    filename: "trading.json",
    description:
      "P2P trade policy blob — 6 rule groups: session (confirmMode bothConfirm|singleConfirm|none + countdown + timeout + distance), items (soulbound/BoA/quest blocks + gearScore/rarity gates + blocklist), currency (commission 0..1 + per-side cap + premium block), eligibility (cross-faction/friendship/account-age/level-gap + ignore block), rateLimit (day≥hour superset refinement), antiRmt (heuristic flagging with auto-suspend threshold). Refinement rejects confirmMode='none' + sessionTimeoutSec=0 (unsafe freeze vector). Consumed by (forthcoming) TradeSystem.",
    category: "progression",
    editable: true,
    schema: "trading",
  },
  {
    name: "item-sets",
    filename: "item-sets.json",
    description:
      "Array-shape registry of set-bonus definitions — 6-category (raid/dungeon/crafted/world/pvp/legacy) with tiered incremental stages (2pc/4pc/6pc...), 20-stat add/multiply modifiers (multiply>0), triggered effects with chance/cooldown/status-effect/damage/heal payloads. Refinements enforce reachable-requiredPieces, strictly-monotonic stages, and globally-unique triggered-effect ids across the whole set (combat event bus). Consumed by (forthcoming) ItemSetSystem.",
    category: "progression",
    editable: true,
    schema: "item-sets",
  },
  {
    name: "leaderboards",
    filename: "leaderboards.json",
    description:
      "Array-shape registry of competitive ranking boards — 10-metric enum (pvpRating/dungeonClearTime/bossKillCount/goldEarned/xpEarned/craftingScore/gatheringScore/fishSize/achievementScore/custom) with customMetricKey-iff-custom refinement, 5-scope (global/region/guild/faction/friends), 5-cadence (allTime/season/monthly/weekly/daily), 3-tieBreak (earliestFirst/latestFirst/none), desc/asc sort, rank|percent reward brackets with mode-scoped non-overlap refinements, rollover-announcement opts. Consumed by (forthcoming) LeaderboardSystem.",
    category: "progression",
    editable: true,
    schema: "leaderboards",
  },
  {
    name: "titles",
    filename: "titles.json",
    description:
      "Array-shape registry of honorific titles — 7-kind unlock-condition discriminated union (achievement/leaderboardBracket/bossKillCount/quest/skillLevel/purchase/manual) with unique-kind refinement (OR semantics, no redundant dups), prefix/suffix/replace display mode, 6-rarity, revocation block (cadence/expire/GM), always-localized displayKey. Consumed by (forthcoming) TitleSystem.",
    category: "progression",
    editable: true,
    schema: "titles",
  },
  {
    name: "world-events",
    filename: "world-events.json",
    description:
      "Array-shape FATE/public-event/world-boss registry — 7-category (invasion/boss/gather/escort/defense/puzzle/holiday), 5-kind trigger (schedule/random/chain/proximity/manual), linear phase chain with nextOnSuccess/nextOnFailure branches (empty = end), participation-tier bracket with strictly-unique minContribution. Manifest-level refinement ensures chain sourceEventId resolves. Consumed by (forthcoming) WorldEventSystem.",
    category: "progression",
    editable: true,
    schema: "world-events",
  },
  {
    name: "seasons",
    filename: "seasons.json",
    description:
      "Array-shape Battle Pass/live-ops registry — free|premium|bonus tracks, tier 1..200 with author-listed xpRequired + item/currency/cosmetic rewards, daily/weekly/season challenges with premiumOnly + unlockWeek, ISO 8601 startsAt/endsAt with strict `<`, ≥1-free-track, premiumPrice>0-requires-premium-track, end-of-season rules. Manifest-level refinement: unique ids + non-overlapping time windows. Consumed by (forthcoming) SeasonSystem.",
    category: "progression",
    editable: true,
    schema: "seasons",
  },
  {
    name: "pet-companion",
    filename: "pet-companion.json",
    description:
      "Array-shape registry of summonable pets/companions — 3-category (combat/utility/cosmetic), per-pet slot subset (saddle/armor/collar/charm/satchel), 4-follow mode, summon rules (maxActive 1..20, cooldown, idle-despawn), stats with ownerStatScaling 0..1, shape-only ability refs with priority/cooldown, optional progression (maxLevel 1..100, loyalty). Refinements: no-abilities-on-cosmetic + no-progression-on-cosmetic + unique-slots + unique-ability-ids-per-pet. Consumed by (forthcoming) PetSystem.",
    category: "progression",
    editable: true,
    schema: "pet-companion",
  },
  {
    name: "enchantments",
    filename: "enchantments.json",
    description:
      "Array-shape registry of authored item modifiers — 4-kind (permanent/socket-gem/rune-word/temporary), 11-slot enum (10 specific + `any` wildcard), 20-stat enum, per-modifier tier ladder 1..10 with author-listed non-linear scaling. Refinements: unique ids + `any`-cannot-combine-with-specific + `temporary ⟺ durationHits>0` iff + modifier-tier-≤-maxTier + multiply-must-be-positive. Consumed by (forthcoming) EnchantmentSystem.",
    category: "progression",
    editable: true,
    schema: "enchantments",
  },
  {
    name: "mail",
    filename: "mail.json",
    description:
      "Singleton policy blob (UE5-DefaultMail.ini style) for persistent mail — 5-category (player/auction/system/guild/gm) with 5 rule-group sub-schemas (attachments/CoD/postage/retention/rateLimit). Refinements: unique enabledCategories + CoD-enabled-requires-attachment-slots + retention superset + rateLimit superset. Consumed by (forthcoming) MailSystem.",
    category: "progression",
    editable: true,
    schema: "mail",
  },
  {
    name: "tooltips",
    filename: "tooltips.json",
    description:
      "UI tooltip registry — dots+dashes id regex, body localization key required, 4-trigger × 5-placement, per-entry show/hide delays, max-width cap, optional icon asset, category tag, max-shows-per-player quota. Refinement: unique entry ids. Consumed by (forthcoming) TooltipsSystem.",
    category: "progression",
    editable: true,
    schema: "tooltips",
  },
  {
    name: "key-prompt-icons",
    filename: "key-prompt-icons.json",
    description:
      "7-device input-glyph catalog (keyboard/mouse/xbox/playstation/nintendo/generic/touch) with device-family theme metadata. Refinements: unique (deviceKind, inputCode) pair across glyphs + at-most-one-family-per-device-kind. Consumed by (forthcoming) KeyPromptIconsSystem.",
    category: "progression",
    editable: true,
    schema: "key-prompt-icons",
  },
  {
    name: "screenshot",
    filename: "screenshot.json",
    description:
      "Photo-mode capture policy — 3-format (png/jpeg/webp), 7-aspect preset, capture/photo-mode/watermark rules, share-target registry with 4-share-kind (saveToDisk/clipboard/uploadToGallery/external) backed by endpointNameRef → deploy-target (commit-safe, no real URLs). Refinements: unique share-target ids + enabled=true requires ≥1 enabled target + upload/external requires endpointNameRef. Consumed by (forthcoming) ScreenshotSystem.",
    category: "progression",
    editable: true,
    schema: "screenshot",
  },
  {
    name: "party-guild",
    filename: "party-guild.json",
    description:
      "Authored party/guild policy — party loot/xp policies (free-for-all/round-robin/leader-chooses/need-before-greed · full-share/split/proximity-share/tag-only), guild rank hierarchy with 13-permission enum, 6-kind perk system, alliance/war rules. Refinements: unique rank order, leader at order=0, perk customKey iff custom. Consumed by (forthcoming) PartyManager/GuildRegistry.",
    category: "progression",
    editable: true,
    schema: "party-guild",
  },
  {
    name: "economy-tuning",
    filename: "economy-tuning.json",
    description:
      "Authored economy tuning — currency registry (tradeable/bankStored/keepOnDeath + cap), vendor buyback/sell multipliers + stock restock, reusable cost-curve entries (linear over level+tier with min/max clamp), auction house fees. Refinements: unique currency ids, vendor.defaultCurrencyId resolves, market.currencyId must be tradeable when market enabled. Consumed by (forthcoming) VendorSystem/AuctionHouseSystem.",
    category: "progression",
    editable: true,
    schema: "economy-tuning",
  },
  {
    name: "loading-screens",
    filename: "loading-screens.json",
    description:
      "6-trigger loading-slate registry with weighted selection, fade rules, tip/progress-bar toggles. Refinements: unique slate ids + defaultSlateId resolves + enabled=true requires ≥1 slate. Inert `{enabled:false}` baseline keeps pipeline off until authored. Consumed by (forthcoming) LoadingScreensSystem.",
    category: "progression",
    editable: true,
    schema: "loading-screens",
  },
  {
    name: "skybox-atmosphere",
    filename: "skybox-atmosphere.json",
    description:
      "Authored skybox-atmosphere manifest — sun/moon discs, parametric star field with time-of-day window, up-to-8 cloud layers, Bruneton/Hillaire-style atmospheric scattering (rayleigh/mie/ozone + mieG), horizon/zenith gradient fallback; `activeSkyboxId` selector at manifest root. Refinements: unique skybox ids + activeSkyboxId resolves. Consumed by (forthcoming) SkyboxSystem.",
    category: "progression",
    editable: true,
    schema: "skybox-atmosphere",
  },
  {
    name: "particle-graph",
    filename: "particle-graph.json",
    description:
      "Niagara-style declarative particle systems — emitter (rate/burst/lifetime/spawn-shape), ordered initializers (velocity-cone/vector/initial-color/size/rotation), ordered updaters (gravity/drag/curl-noise/color-over-life/alpha-over-life/size-over-life/collide), renderer (billboard/mesh/ribbon). Refinements: unique system ids + at-least-one-velocity-init + rate|burst>0 per emitter. Consumed by (forthcoming) ParticleSystem compiler.",
    category: "progression",
    editable: true,
    schema: "particle-graph",
  },
  {
    name: "cinematic",
    filename: "cinematic.json",
    description:
      "Authored cinematic registry — 5-kind track discriminated union (camera/entity-pose/dialogue/audio/event), per-track monotonic-time refinement + cinematic-level durationSec containment. Refinement: unique cinematic ids. Consumed by (forthcoming) CinematicPlayer.",
    category: "progression",
    editable: true,
    schema: "cinematic",
  },
  {
    name: "editor-snap",
    filename: "editor-snap.json",
    description:
      "Editor snap policy — grid snap (translate/rotate/scale steps), surface snap (tolerance/mode), gizmo settings (space/pivot/size), global `snapByDefault` toggle. Baseline `{}` uses all defaults. Consumed by editor authoring tools at boot.",
    category: "progression",
    editable: true,
    schema: "editor-snap",
  },
  {
    name: "deploy-targets",
    filename: "deploy-targets.json",
    description:
      "Named deployment endpoints (provider/environment/region + secret *names*, never values). Referenced by crash-reporter, push-notifications, screenshot share-targets. Refinement: unique target ids. Safe to commit — real credentials resolve at runtime from deployment secret store.",
    category: "progression",
    editable: true,
    schema: "deploy-targets",
  },
  {
    name: "input-actions",
    filename: "input-actions.json",
    description:
      "Author-side default input bindings — 3-kind action (button/axis/vector2) with lowerCamelCase id + rebindable flag. Complement to runtime per-player `useUserInputBindings` (UI Pack U10). Refinement: unique action ids.",
    category: "progression",
    editable: true,
    schema: "input-actions",
  },
  {
    name: "profiler",
    filename: "profiler.json",
    description:
      "Profiler overlay configuration — declarative metrics with threshold-driven color bands + anchor/refresh/opacity/font-scale. Refinements: unique profiler group ids + unique metric ids across all groups. Baseline `{}` keeps overlay disabled.",
    category: "progression",
    editable: true,
    schema: "profiler",
  },
  {
    name: "replication",
    filename: "replication.json",
    description:
      "Authored replication contract — declarative replicated fields + events so plugins can participate in netcode without touching ServerNetwork. Authority (server|client-owner|client-any), cadence (on-change|interval|always|reliable-once), event direction + reliability + rate-limit. Refinements: unique component names + unique event ids.",
    category: "progression",
    editable: true,
    schema: "replication",
  },
  {
    name: "prefab",
    filename: "prefab.json",
    description:
      "Prefab library — reusable entity composition with slash-separated lowerCamelCase localIds, sparse overrides targeting (localId, propertyName) pairs, nested-prefab DAG with cycle detection. Refinements: unique prefab ids + instance.prefabId resolves + no self-cycle in nested prefab references.",
    category: "progression",
    editable: true,
    schema: "prefab",
  },
  {
    name: "level-streaming",
    filename: "level-streaming.json",
    description:
      "Sublevel streaming policies — 4 policies (always-loaded/proximity/on-demand/server-authoritative), 3 trigger-volume kinds (sphere/aabb/tag), dependsOn DAG with cycle-detection + hysteresis via unloadPaddingMeters. Refinements: unique sublevel ids + dependsOn resolves.",
    category: "progression",
    editable: true,
    schema: "level-streaming",
  },
  {
    name: "lighting-bake",
    filename: "lighting-bake.json",
    description:
      "Offline lighting-bake settings — lightmaps/probes/AO/GI with per-sublevel overrides, lightprobe-volume unique-id refinement, power-of-two atlas-size refinement, `skipBake` dev-iteration toggle. Baseline `{}` is a no-bake pass-through.",
    category: "progression",
    editable: true,
    schema: "lighting-bake",
  },
  {
    name: "project-settings",
    filename: "project-settings.json",
    description:
      "Top-level project identity — projectName + gameModeId + installed plugin list. No baseline fixture because projectName + gameModeId are required fields.",
    category: "progression",
    editable: true,
    schema: "project-settings",
  },
  {
    name: "ai-behavior",
    filename: "ai-behavior.json",
    description:
      "Authored AI behavior-tree library — array of named BehaviorTree objects that the BehaviorTreeInterpreter runtime binds to by id. Refinement: unique tree ids + root references a declared node + record-key matches node.id.",
    category: "progression",
    editable: true,
    schema: "ai-behavior",
  },
  {
    name: "animations",
    filename: "animations.json",
    description:
      "Animation clip + action→clip binding registry consumed by the (forthcoming) AnimationSystem. Both arrays default to [] so `{}` is a valid empty baseline.",
    category: "progression",
    editable: true,
    schema: "animations",
  },
  {
    name: "quality-presets",
    filename: "quality-presets.json",
    description:
      "Ordered quality tiers (low/medium/high/ultra) with shadow resolution, reflection quality, post-process passes, particle density, LOD bias, pixel-ratio cap. Refinements: unique ids + at least one preset. No baseline.",
    category: "progression",
    editable: true,
    schema: "quality-presets",
  },
  {
    name: "nav-mesh",
    filename: "nav-mesh.json",
    description:
      "Nav-mesh bake settings — voxelizer + agent profiles (radius/height/step/slope) + modifier volumes + jump links. Refinements: unique agent/volume/jumpLink ids + jumpLink.agentTag references a declared agent id or area tag. No baseline (agents.min(1)).",
    category: "progression",
    editable: true,
    schema: "nav-mesh",
  },
  {
    name: "lod-settings",
    filename: "lod-settings.json",
    description:
      "Versioned LOD distance thresholds + close-range dissolve transition. No baseline — version/distanceThresholds/dissolve are required without defaults.",
    category: "progression",
    editable: true,
    schema: "lod-settings",
  },
  {
    name: "sfx",
    filename: "sfx.json",
    description:
      "Sound-effect registry. Flat array of SFX entries (id/name/category/path). Baseline: [].",
    category: "audio",
    editable: true,
    schema: "sfx",
  },
  {
    name: "vfx",
    filename: "vfx.json",
    description:
      "Visual-effect registry. Flat array of VFX entries (id/name/kind/asset). Baseline: [].",
    category: "progression",
    editable: true,
    schema: "vfx",
  },
  {
    name: "main-menu",
    filename: "main-menu.json",
    description:
      "Pre-game main-menu tree (enabled + menus + rootMenuId). Baseline: { enabled: false }.",
    category: "progression",
    editable: true,
    schema: "main-menu",
  },
  {
    name: "credits",
    filename: "credits.json",
    description:
      "Credit-roll registry (enabled + sections). Baseline: { enabled: false }.",
    category: "progression",
    editable: true,
    schema: "credits",
  },
  {
    name: "duel",
    filename: "duel.json",
    description:
      "Duel rules, equipment slot definitions, and slot mapping. No baseline — $schema/rules/equipmentSlots required.",
    category: "progression",
    editable: true,
    schema: "duel",
  },
  {
    name: "arena-layout",
    filename: "arena-layout.json",
    description:
      "Streaming duel arena grid + lobby + hospital geometry. No baseline — full layout required.",
    category: "world",
    editable: true,
    schema: "arena-layout",
  },
  {
    name: "avatars",
    filename: "avatars.json",
    description:
      "VRM avatar catalog with 3-tier LOD URLs + LOD switching distances. No baseline — avatars.min(1) + lodDistances required.",
    category: "progression",
    editable: true,
    schema: "avatars",
  },
  {
    name: "banking",
    filename: "banking.json",
    description:
      "Bank sizes + UI settings + transaction limits + error/message catalogs. No baseline — all required.",
    category: "progression",
    editable: true,
    schema: "banking",
  },
  {
    name: "trees",
    filename: "trees.json",
    description:
      "Tree-type catalog keyed by subtype (oak/maple/...) consumed by woodcutting + procgen vegetation. Baseline empty trees record.",
    category: "world",
    editable: true,
    schema: "trees",
  },
  {
    name: "weapon-styles",
    filename: "weapon-styles.json",
    description:
      "tile-based-MMORPG-accurate combat-style availability table keyed by weapon type. No baseline — record key is exhaustive enum.",
    category: "combat",
    editable: true,
    schema: "weapon-styles",
  },
  {
    name: "npc-sizes",
    filename: "npc-sizes.json",
    description:
      "NPC footprint dimensions (width×depth tiles) keyed by NPC id. Baseline empty sizes record.",
    category: "world",
    editable: true,
    schema: "npc-sizes",
  },
  {
    name: "onboarding-goals",
    filename: "onboarding-goals.json",
    description:
      "New-player goal graph with criteria/rewards/prerequisite DAG. Baseline `{enabled: false}`.",
    category: "progression",
    editable: true,
    schema: "onboarding-goals",
  },
  {
    name: "skill-icons",
    filename: "skill-icons.json",
    description:
      "tile-based-MMORPG-style UI display metadata per skill (label/icon/category/defaultLevel) + emoji icon lookup table.",
    category: "progression",
    editable: true,
    schema: "skill-icons",
  },
  {
    name: "player-emotes",
    filename: "player-emotes.json",
    description:
      "Avatar animation asset URLs keyed by emote name + essential pre-load list.",
    category: "world",
    editable: true,
    schema: "player-emotes",
  },
  {
    name: "matchmaking-tuning",
    filename: "matchmaking-tuning.json",
    description:
      "Automatic matchmaking policy — queues, skill bucket widening, party constraints, backfill. Baseline `{enabled: false}`.",
    category: "combat",
    editable: true,
    schema: "matchmaking-tuning",
  },
  {
    name: "spell-visuals",
    filename: "spell-visuals.json",
    description:
      "Projectile visual params (color/size/glow/trail/pulse) per spell + per-arrow visual configs + fallback spell.",
    category: "combat",
    editable: true,
    schema: "spell-visuals",
  },
  {
    name: "profiler",
    filename: "profiler.json",
    description:
      "On-screen performance HUD configuration — groups, metrics, anchor, refresh interval. Baseline `{}`.",
    category: "system",
    editable: true,
    schema: "profiler",
  },
  {
    name: "server-browser",
    filename: "server-browser.json",
    description:
      "Manual server-browser filters, columns, sort policy, direct-connect toggle. Baseline `{}`.",
    category: "system",
    editable: true,
    schema: "server-browser",
  },
  {
    name: "store-front",
    filename: "store-front.json",
    description:
      "Premium/real-money bundle catalog with shelves, discount rules, price tiers, daily spend cap. Baseline `{}`.",
    category: "progression",
    editable: true,
    schema: "store-front",
  },
  {
    name: "commerce",
    filename: "commerce.json",
    description:
      "Global commerce constants (buyback rate, unlimited-stock sentinels, interaction range, starter store items).",
    category: "progression",
    editable: true,
    schema: "commerce",
  },
  {
    name: "interaction",
    filename: "interaction.json",
    description:
      "Session/interaction tuning (store/bank/dialogue types, distances, rate limits, validation ticks, input limits).",
    category: "system",
    editable: true,
    schema: "interaction",
  },
  {
    name: "combat",
    filename: "combat-constants.json",
    description:
      "Global combat constants — ranges, tick rates, food timing, hit delays, projectile arcs, rotation, aggro, level caps, attack-style tables.",
    category: "combat",
    editable: true,
    schema: "combat",
  },
  {
    name: "equipment",
    filename: "equipment-constants.json",
    description:
      "Authored equipment slot list, bank slot grid layout, and bank-equip error messages.",
    category: "combat",
    editable: true,
    schema: "equipment",
  },
  {
    name: "game",
    filename: "game-constants.json",
    description:
      "Engine-wide game constants — inventory, player stats, home teleport, xp table, distance LOD, mob limits, UI, physics, camera, network, test harness.",
    category: "system",
    editable: true,
    schema: "game",
  },
  {
    name: "smithing",
    filename: "smithing-constants.json",
    description:
      "Smithing skill constants — hammer/coal ids, default smelt/smith ticks, validation limits, anvil/smelting messages.",
    category: "skills",
    editable: true,
    schema: "smithing",
  },
  {
    name: "world-structure",
    filename: "world-structure.json",
    description:
      "High-level world structure constants — grid size, default spawn height, water level, max build height, safe zone radius.",
    category: "world",
    editable: true,
    schema: "world-structure",
  },
  {
    name: "gathering",
    filename: "gathering-constants.json",
    description:
      "Gathering skill mechanics (woodcutting/mining/fishing) — roll types, tick rates, tool/level effects, ranges, timing.",
    category: "skills",
    editable: true,
    schema: "gathering",
  },
  {
    name: "processing",
    filename: "processing-constants.json",
    description:
      "Processing skill mechanics (firemaking/cooking) — roll types, fire duration, fire-walk priority, success rates. Distinct from recipes/* registries.",
    category: "skills",
    editable: true,
    schema: "processing",
  },
  {
    name: "localization",
    filename: "localization.json",
    description:
      "Localization bundle (base locale + per-locale translation manifests) consumed by DialogueSystem for textKey resolution",
    category: "progression",
    editable: true,
    schema: "localization",
  },
  // Items (subdirectory)
  {
    name: "items/weapons",
    filename: "items/weapons.json",
    description: "Weapon item definitions",
    category: "items",
    editable: true,
    schema: "items",
  },
  {
    name: "items/armor",
    filename: "items/armor.json",
    description: "Armor item definitions",
    category: "items",
    editable: true,
    schema: "items",
  },
  {
    name: "items/resources",
    filename: "items/resources.json",
    description: "Resource item definitions (ores, logs, fish, etc.)",
    category: "items",
    editable: true,
    schema: "items",
  },
  {
    name: "items/tools",
    filename: "items/tools.json",
    description: "Tool item definitions (pickaxes, axes, etc.)",
    category: "items",
    editable: true,
    schema: "items",
  },
  {
    name: "items/ammunition",
    filename: "items/ammunition.json",
    description: "Ammunition item definitions",
    category: "items",
    editable: true,
    schema: "items",
  },
  {
    name: "items/food",
    filename: "items/food.json",
    description: "Food item definitions",
    category: "items",
    editable: true,
    schema: "items",
  },
  {
    name: "items/misc",
    filename: "items/misc.json",
    description: "Miscellaneous item definitions",
    category: "items",
    editable: true,
    schema: "items",
  },
  {
    name: "items/runes",
    filename: "items/runes.json",
    description: "Rune item definitions",
    category: "items",
    editable: true,
    schema: "items",
  },
  // Gathering (subdirectory)
  {
    name: "gathering/mining",
    filename: "gathering/mining.json",
    description: "Mining rock definitions with levels and ore types",
    category: "world",
    editable: true,
    schema: "mining",
  },
  {
    name: "gathering/woodcutting",
    filename: "gathering/woodcutting.json",
    description: "Tree definitions with levels and log types",
    category: "world",
    editable: true,
    schema: "woodcutting",
  },
  {
    name: "gathering/fishing",
    filename: "gathering/fishing.json",
    description: "Fishing spot definitions with levels and fish types",
    category: "world",
    editable: true,
    schema: "fishing",
  },
  // Recipes (subdirectory)
  {
    name: "recipes/smithing",
    filename: "recipes/smithing.json",
    description: "Smithing recipes (bars to equipment)",
    category: "progression",
    editable: true,
    schema: "recipes",
  },
  {
    name: "recipes/fletching",
    filename: "recipes/fletching.json",
    description: "Fletching recipes (bows and arrows)",
    category: "progression",
    editable: true,
    schema: "recipes",
  },
  {
    name: "recipes/crafting",
    filename: "recipes/crafting.json",
    description: "Crafting recipes (leather, jewelry)",
    category: "progression",
    editable: true,
    schema: "recipes",
  },
  {
    name: "recipes/cooking",
    filename: "recipes/cooking.json",
    description: "Cooking recipes (raw to cooked food)",
    category: "progression",
    editable: true,
    schema: "recipes",
  },
  {
    name: "recipes/smelting",
    filename: "recipes/smelting.json",
    description: "Smelting recipes (ores to bars)",
    category: "progression",
    editable: true,
    schema: "recipes",
  },
  {
    name: "recipes/runecrafting",
    filename: "recipes/runecrafting.json",
    description: "Runecrafting recipes (essence to runes)",
    category: "progression",
    editable: true,
    schema: "recipes",
  },
  {
    name: "recipes/firemaking",
    filename: "recipes/firemaking.json",
    description: "Firemaking recipes (logs to fires)",
    category: "progression",
    editable: true,
    schema: "recipes",
  },
  {
    name: "recipes/tanning",
    filename: "recipes/tanning.json",
    description: "Tanning recipes (hides to leather)",
    category: "progression",
    editable: true,
    schema: "recipes",
  },
];

export interface ManifestListItem {
  name: string;
  filename: string;
  description: string;
  category: ManifestCategory;
  editable: boolean;
  lastModified: string;
  size: number;
}

export interface ManifestContent {
  name: string;
  filename: string;
  content: unknown;
  lastModified: string;
  size: number;
}

export interface ManifestWriteResult {
  success: boolean;
  name: string;
  filename: string;
  backupPath: string | null;
  timestamp: string;
}

export interface ValidationError {
  path: string;
  message: string;
  value: unknown;
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class ManifestService {
  private manifestsDir: string;
  private backupsDir: string;

  constructor(projectRoot: string) {
    this.manifestsDir = path.join(projectRoot, "assets", "manifests");
    this.backupsDir = path.join(this.manifestsDir, ".backups");
  }

  /**
   * Get the path to a manifest file
   */
  private getManifestPath(filename: string): string {
    return path.join(this.manifestsDir, filename);
  }

  /**
   * List all available manifests with metadata
   */
  async listManifests(): Promise<ManifestListItem[]> {
    const results: ManifestListItem[] = [];

    for (const def of MANIFEST_DEFINITIONS) {
      const filePath = this.getManifestPath(def.filename);

      let lastModified = new Date().toISOString();
      let size = 0;

      const exists = await Bun.file(filePath).exists();
      if (exists) {
        const stat = await fs.promises.stat(filePath);
        lastModified = stat.mtime.toISOString();
        size = stat.size;
      }

      results.push({
        name: def.name,
        filename: def.filename,
        description: def.description,
        category: def.category,
        editable: def.editable,
        lastModified,
        size,
      });
    }

    return results;
  }

  /**
   * Get manifest info by name
   */
  getManifestInfo(name: string): ManifestInfo | null {
    return MANIFEST_DEFINITIONS.find((def) => def.name === name) || null;
  }

  /**
   * Read a manifest file content
   */
  async readManifest(name: string): Promise<ManifestContent> {
    const info = this.getManifestInfo(name);
    if (!info) {
      throw new Error(`Unknown manifest: ${name}`);
    }

    const filePath = this.getManifestPath(info.filename);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      throw new Error(`Manifest file not found: ${info.filename}`);
    }

    const stat = await fs.promises.stat(filePath);
    const content = await file.json();

    return {
      name: info.name,
      filename: info.filename,
      content,
      lastModified: stat.mtime.toISOString(),
      size: stat.size,
    };
  }

  /**
   * Create a backup of a manifest file before writing
   */
  private async createBackup(filename: string): Promise<string | null> {
    const sourcePath = this.getManifestPath(filename);
    const sourceFile = Bun.file(sourcePath);

    if (!(await sourceFile.exists())) {
      return null;
    }

    // Ensure backups directory exists
    await fs.promises.mkdir(this.backupsDir, { recursive: true });

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFilename = `${filename}.${timestamp}.backup`;
    const backupPath = path.join(this.backupsDir, backupFilename);

    // Copy file to backup
    const content = await sourceFile.text();
    await Bun.write(backupPath, content);

    // Clean up old backups (keep last 10 per manifest)
    await this.cleanupOldBackups(filename);

    return backupPath;
  }

  /**
   * Remove old backups, keeping only the most recent ones
   */
  private async cleanupOldBackups(filename: string): Promise<void> {
    const maxBackups = 10;

    const backupsExist = await Bun.file(this.backupsDir).exists();
    if (!backupsExist) {
      return;
    }

    const entries = await fs.promises.readdir(this.backupsDir);
    const backupPattern = new RegExp(`^${filename}\\..*\\.backup$`);
    const matchingBackups = entries
      .filter((entry) => backupPattern.test(entry))
      .sort()
      .reverse();

    // Remove backups beyond the limit
    const toRemove = matchingBackups.slice(maxBackups);
    for (const backupFile of toRemove) {
      const backupPath = path.join(this.backupsDir, backupFile);
      await fs.promises.unlink(backupPath);
    }
  }

  /**
   * Validate manifest content against its schema
   */
  validateManifest(name: string, content: unknown): ManifestValidationResult {
    const info = this.getManifestInfo(name);
    if (!info) {
      return {
        valid: false,
        errors: [
          { path: "", message: `Unknown manifest: ${name}`, value: null },
        ],
      };
    }

    const errors: ValidationError[] = [];

    // Basic structure validation
    if (content === null || content === undefined) {
      errors.push({
        path: "",
        message: "Content cannot be null or undefined",
        value: content,
      });
      return { valid: false, errors };
    }

    // Schema-specific validation
    switch (info.schema) {
      case "biomes":
        this.validateBiomesSchema(content, errors);
        break;
      case "buildings":
        this.validateBuildingsSchema(content, errors);
        break;
      case "music":
        this.validateMusicSchema(content, errors);
        break;
      case "npcs":
        this.validateNpcsSchema(content, errors);
        break;
      case "prayers":
        this.validatePrayersSchema(content, errors);
        break;
      case "world-areas":
        this.validateWorldAreasSchema(content, errors);
        break;
      case "quests":
        this.validateQuestsSchema(content, errors);
        break;
      case "skill-unlocks":
        this.validateSkillUnlocksSchema(content, errors);
        break;
      case "stations":
        this.validateStationsSchema(content, errors);
        break;
      case "stores":
        this.validateStoresSchema(content, errors);
        break;
      case "tier-requirements":
        this.validateTierRequirementsSchema(content, errors);
        break;
      case "tools":
        this.validateToolsSchema(content, errors);
        break;
      case "vegetation":
        this.validateVegetationSchema(content, errors);
        break;
      case "lod-settings":
        this.validateLODSettingsSchema(content, errors);
        break;
      case "model-bounds":
        // Auto-generated, no validation needed
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  // Schema validation helpers

  private validateBiomesSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(content)) {
      errors.push({
        path: "",
        message: "Biomes must be an array",
        value: content,
      });
      return;
    }

    for (let i = 0; i < content.length; i++) {
      const biome = content[i] as Record<string, unknown>;
      if (!biome.id || typeof biome.id !== "string") {
        errors.push({
          path: `[${i}].id`,
          message: "Biome must have a string id",
          value: biome.id,
        });
      }
      if (!biome.name || typeof biome.name !== "string") {
        errors.push({
          path: `[${i}].name`,
          message: "Biome must have a string name",
          value: biome.name,
        });
      }
      if (
        biome.difficultyLevel !== undefined &&
        typeof biome.difficultyLevel !== "number"
      ) {
        errors.push({
          path: `[${i}].difficultyLevel`,
          message: "difficultyLevel must be a number",
          value: biome.difficultyLevel,
        });
      }
    }
  }

  private validateBuildingsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Buildings must be an object",
        value: content,
      });
      return;
    }

    const buildings = content as Record<string, unknown>;
    if (
      buildings.version !== undefined &&
      typeof buildings.version !== "number"
    ) {
      errors.push({
        path: "version",
        message: "version must be a number",
        value: buildings.version,
      });
    }
  }

  private validateMusicSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(content)) {
      errors.push({
        path: "",
        message: "Music must be an array",
        value: content,
      });
      return;
    }

    for (let i = 0; i < content.length; i++) {
      const track = content[i] as Record<string, unknown>;
      if (!track.id || typeof track.id !== "string") {
        errors.push({
          path: `[${i}].id`,
          message: "Track must have a string id",
          value: track.id,
        });
      }
      if (!track.name || typeof track.name !== "string") {
        errors.push({
          path: `[${i}].name`,
          message: "Track must have a string name",
          value: track.name,
        });
      }
      if (!track.path || typeof track.path !== "string") {
        errors.push({
          path: `[${i}].path`,
          message: "Track must have a string path",
          value: track.path,
        });
      }
    }
  }

  private validateNpcsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(content)) {
      errors.push({
        path: "",
        message: "NPCs must be an array",
        value: content,
      });
      return;
    }

    for (let i = 0; i < content.length; i++) {
      const npc = content[i] as Record<string, unknown>;
      if (!npc.id || typeof npc.id !== "string") {
        errors.push({
          path: `[${i}].id`,
          message: "NPC must have a string id",
          value: npc.id,
        });
      }
      if (!npc.name || typeof npc.name !== "string") {
        errors.push({
          path: `[${i}].name`,
          message: "NPC must have a string name",
          value: npc.name,
        });
      }
    }
  }

  private validatePrayersSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Prayers must be an object",
        value: content,
      });
      return;
    }

    const prayers = content as Record<string, unknown>;
    if (!Array.isArray(prayers.prayers)) {
      errors.push({
        path: "prayers",
        message: "prayers.prayers must be an array",
        value: prayers.prayers,
      });
    }
  }

  private validateWorldAreasSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "World areas must be an object",
        value: content,
      });
      return;
    }

    const areas = content as Record<string, unknown>;
    if (areas.starterTowns && typeof areas.starterTowns !== "object") {
      errors.push({
        path: "starterTowns",
        message: "starterTowns must be an object",
        value: areas.starterTowns,
      });
    }
  }

  private validateQuestsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Quests must be an object",
        value: content,
      });
      return;
    }

    const quests = content as Record<string, unknown>;
    for (const [questId, quest] of Object.entries(quests)) {
      const q = quest as Record<string, unknown>;
      if (!q.id || typeof q.id !== "string") {
        errors.push({
          path: `${questId}.id`,
          message: "Quest must have a string id",
          value: q.id,
        });
      }
      if (!q.name || typeof q.name !== "string") {
        errors.push({
          path: `${questId}.name`,
          message: "Quest must have a string name",
          value: q.name,
        });
      }
    }
  }

  private validateSkillUnlocksSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Skill unlocks must be an object",
        value: content,
      });
      return;
    }

    const unlocks = content as Record<string, unknown>;
    if (!unlocks.skills || typeof unlocks.skills !== "object") {
      errors.push({
        path: "skills",
        message: "Must have a skills object",
        value: unlocks.skills,
      });
    }
  }

  private validateStationsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Stations must be an object",
        value: content,
      });
      return;
    }

    const stations = content as Record<string, unknown>;
    if (!Array.isArray(stations.stations)) {
      errors.push({
        path: "stations",
        message: "stations.stations must be an array",
        value: stations.stations,
      });
    }
  }

  private validateStoresSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(content)) {
      errors.push({
        path: "",
        message: "Stores must be an array",
        value: content,
      });
      return;
    }

    for (let i = 0; i < content.length; i++) {
      const store = content[i] as Record<string, unknown>;
      if (!store.id || typeof store.id !== "string") {
        errors.push({
          path: `[${i}].id`,
          message: "Store must have a string id",
          value: store.id,
        });
      }
      if (!store.name || typeof store.name !== "string") {
        errors.push({
          path: `[${i}].name`,
          message: "Store must have a string name",
          value: store.name,
        });
      }
    }
  }

  private validateTierRequirementsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Tier requirements must be an object",
        value: content,
      });
      return;
    }

    const tiers = content as Record<string, unknown>;
    const requiredKeys = ["melee", "tools"];
    for (const key of requiredKeys) {
      if (!tiers[key] || typeof tiers[key] !== "object") {
        errors.push({
          path: key,
          message: `Missing or invalid ${key} tier requirements`,
          value: tiers[key],
        });
      }
    }
  }

  private validateToolsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(content)) {
      errors.push({
        path: "",
        message: "Tools must be an array",
        value: content,
      });
      return;
    }

    for (let i = 0; i < content.length; i++) {
      const tool = content[i] as Record<string, unknown>;
      if (!tool.itemId || typeof tool.itemId !== "string") {
        errors.push({
          path: `[${i}].itemId`,
          message: "Tool must have a string itemId",
          value: tool.itemId,
        });
      }
      if (!tool.skill || typeof tool.skill !== "string") {
        errors.push({
          path: `[${i}].skill`,
          message: "Tool must have a string skill",
          value: tool.skill,
        });
      }
    }
  }

  private validateVegetationSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Vegetation must be an object",
        value: content,
      });
      return;
    }

    const veg = content as Record<string, unknown>;
    if (!Array.isArray(veg.assets)) {
      errors.push({
        path: "assets",
        message: "vegetation.assets must be an array",
        value: veg.assets,
      });
      return;
    }

    for (let i = 0; i < (veg.assets as unknown[]).length; i++) {
      const asset = (veg.assets as Record<string, unknown>[])[i];
      if (!asset.id || typeof asset.id !== "string") {
        errors.push({
          path: `assets[${i}].id`,
          message: "Asset must have a string id",
          value: asset.id,
        });
      }
      if (!asset.model || typeof asset.model !== "string") {
        errors.push({
          path: `assets[${i}].model`,
          message: "Asset must have a string model path",
          value: asset.model,
        });
      }
    }
  }

  private validateLODSettingsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "LOD settings must be an object",
        value: content,
      });
      return;
    }

    const settings = content as Record<string, unknown>;

    if (
      !settings.distanceThresholds ||
      typeof settings.distanceThresholds !== "object"
    ) {
      errors.push({
        path: "distanceThresholds",
        message: "distanceThresholds must be an object",
        value: settings.distanceThresholds,
      });
    }

    if (!settings.dissolve || typeof settings.dissolve !== "object") {
      errors.push({
        path: "dissolve",
        message: "dissolve must be an object",
        value: settings.dissolve,
      });
    } else {
      const dissolve = settings.dissolve as Record<string, unknown>;
      if (typeof dissolve.closeRangeStart !== "number") {
        errors.push({
          path: "dissolve.closeRangeStart",
          message: "closeRangeStart must be a number",
          value: dissolve.closeRangeStart,
        });
      }
      if (typeof dissolve.closeRangeEnd !== "number") {
        errors.push({
          path: "dissolve.closeRangeEnd",
          message: "closeRangeEnd must be a number",
          value: dissolve.closeRangeEnd,
        });
      }
    }

    if (!settings.vertexBudgets || typeof settings.vertexBudgets !== "object") {
      errors.push({
        path: "vertexBudgets",
        message: "vertexBudgets must be an object",
        value: settings.vertexBudgets,
      });
    }
  }

  /**
   * Write manifest content with backup
   */
  async writeManifest(
    name: string,
    content: unknown,
  ): Promise<ManifestWriteResult> {
    const info = this.getManifestInfo(name);
    if (!info) {
      throw new Error(`Unknown manifest: ${name}`);
    }

    if (!info.editable) {
      throw new Error(`Manifest ${name} is not editable`);
    }

    // Validate content
    const validation = this.validateManifest(name, content);
    if (!validation.valid) {
      const errorMessages = validation.errors
        .map((e) => `${e.path}: ${e.message}`)
        .join("; ");
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    const filePath = this.getManifestPath(info.filename);

    // Create backup before writing
    const backupPath = await this.createBackup(info.filename);

    // Write the new content
    const jsonContent = JSON.stringify(content, null, 2);
    await Bun.write(filePath, jsonContent);

    return {
      success: true,
      name: info.name,
      filename: info.filename,
      backupPath,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get list of backups for a manifest
   */
  async listBackups(name: string): Promise<string[]> {
    const info = this.getManifestInfo(name);
    if (!info) {
      throw new Error(`Unknown manifest: ${name}`);
    }

    const backupsExist = await Bun.file(this.backupsDir).exists();
    if (!backupsExist) {
      return [];
    }

    const entries = await fs.promises.readdir(this.backupsDir);
    const backupPattern = new RegExp(`^${info.filename}\\..*\\.backup$`);

    return entries
      .filter((entry) => backupPattern.test(entry))
      .sort()
      .reverse();
  }

  /**
   * Restore a manifest from a backup
   */
  async restoreFromBackup(
    name: string,
    backupFilename: string,
  ): Promise<ManifestWriteResult> {
    const info = this.getManifestInfo(name);
    if (!info) {
      throw new Error(`Unknown manifest: ${name}`);
    }

    if (!info.editable) {
      throw new Error(`Manifest ${name} is not editable`);
    }

    const backupPath = path.join(this.backupsDir, backupFilename);
    const backupFile = Bun.file(backupPath);

    if (!(await backupFile.exists())) {
      throw new Error(`Backup file not found: ${backupFilename}`);
    }

    // Read backup content
    const backupContent = await backupFile.text();

    // Create a new backup of current state
    const currentBackupPath = await this.createBackup(info.filename);

    // Write the restored content
    const filePath = this.getManifestPath(info.filename);
    await Bun.write(filePath, backupContent);

    return {
      success: true,
      name: info.name,
      filename: info.filename,
      backupPath: currentBackupPath,
      timestamp: new Date().toISOString(),
    };
  }
}
