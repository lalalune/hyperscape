/**
 * OnboardingPlan — the dialog's accumulator type + debug-mode fixture.
 *
 * Phase 1.2 seventh carve from DesignWithAIDialog. The dialog
 * accumulates the agent's PROPOSE_* tool calls into one
 * `OnboardingPlan` value over the course of a multi-turn
 * conversation. Every slot the user sees in the right-side Plan
 * panel maps to a field here.
 *
 * Living in its own module lets future utility carves (debug
 * plan, plan-mutating helpers, plan→world serializers) reach
 * for the canonical type without going through the dialog. The
 * dialog re-exports the same interface unchanged.
 */

/**
 * Accumulator for the agent's PROPOSE_* proposals across a
 * multi-turn conversation. Null/empty fields are unfilled
 * slots; non-null/non-empty fields are filled slots that the
 * dialog shows in the Plan panel.
 *
 * `unknown[]` is deliberate — every list-shaped slot carries a
 * domain-specific entity shape (NPCs, mob spawns, quests, etc.)
 * but those shapes are validated downstream by world-building
 * code; the dialog only counts/displays them.
 */
export interface OnboardingPlan {
  terrainConfig: Record<string, unknown> | null;
  pluginIds: string[] | null;
  /**
   * Asset packs the agent recommended installing
   * (PROPOSE_ASSET_PACK_INSTALL). Surfaced here so the dialog
   * can preview installs before commit; project-pack persistence
   * happens via the dedicated asset-pack endpoint, not the
   * worldContent patch.
   */
  assetPackIds: string[] | null;
  npcs: unknown[];
  mobSpawns: unknown[];
  quests: unknown[];
  /** Asset bake proposals (A5) — fired after project creation. */
  assets: unknown[];
  /** Bounded named regions. */
  zones: unknown[];
  /** Gathering resources (trees, rocks, fishing spots). */
  resources: unknown[];
  /** Crafting stations (anvils, furnaces, ranges, banks). */
  stations: unknown[];
  /** Teleport nodes (lodestones, portals, shortcuts). */
  teleports: unknown[];
  /** Roads / paths the agent placed across the run. */
  roads: unknown[];
  /** Points of interest the agent placed across the run. */
  pois: unknown[];
  /** Danger sources / hazards the agent placed across the run. */
  dangerSources: unknown[];
  /** R4.P8 — water bodies (rivers / lakes / ponds). */
  waterBodies: unknown[];
  /** R4.P8 — polygonal music zones. */
  musicZones: unknown[];
  /** R4.P8 — polygonal ambient sound zones. */
  ambientZones: unknown[];
  /** R4.P8 — point-source SFX triggers. */
  sfxTriggers: unknown[];
  /** R4.P8 — mining areas with clustered ore rocks. */
  mines: unknown[];
  /** R4.P8 — singleton PvP wilderness boundary; null when unset. */
  wildernessBoundary: unknown | null;
  uiPack: unknown | null;
}

/**
 * Empty-state `OnboardingPlan` factory.
 *
 * Used as the initial state for fresh dialog sessions + the
 * fallback when `startOver` resets the conversation. Returns a
 * fresh object every call (no shared mutable state across
 * callers).
 *
 * Adding a new slot to `OnboardingPlan` requires updating ONE
 * place — this factory — instead of every inline literal that
 * had to redeclare the empty shape across the codebase (the
 * dialog had two, every test file had its own helper).
 */
export function createEmptyOnboardingPlan(): OnboardingPlan {
  return {
    terrainConfig: null,
    pluginIds: null,
    assetPackIds: null,
    npcs: [],
    mobSpawns: [],
    quests: [],
    assets: [],
    zones: [],
    resources: [],
    stations: [],
    teleports: [],
    roads: [],
    pois: [],
    dangerSources: [],
    waterBodies: [],
    musicZones: [],
    ambientZones: [],
    sfxTriggers: [],
    mines: [],
    wildernessBoundary: null,
    uiPack: null,
  };
}

/**
 * Debug-mode plan — a fully-populated `OnboardingPlan` that
 * mimics what the agent would produce after a multi-turn
 * conversation. Loading this short-circuits the LLM calls so we
 * can iterate on the downstream `buildWorld` → procgen → studio
 * pipeline without burning API credits.
 *
 * Coverage:
 *   - terrainConfig — seeded, with explicit biome + island knobs
 *   - pluginIds     — Hyperia plugin
 *   - npcs          — 3 varied placements (shopkeeper, questgiver, guard)
 *   - mobSpawns     — 5 spawn points across the map
 *   - quests        — 1 quest with mixed dialogue + gather stages
 *   - zones         — 1 named region
 *   - resources     — oak tree + iron rock
 *   - uiPack        — null (uses default HUD; agent's HUD design is
 *                      tested separately in the dialog's HUD-only mode)
 */
export function buildDebugPlan(): OnboardingPlan {
  return {
    terrainConfig: {
      seed: 42,
      preset: null,
      useGamePipeline: false,
      terrain: {
        tileSize: 100,
        worldSize: 50,
        tileResolution: 32,
        maxHeight: 256,
        waterThreshold: 5.4,
      },
      biomes: {
        gridSize: 4,
        jitter: 0.3,
        minInfluence: 200,
        maxInfluence: 600,
        gaussianCoeff: 1.5,
        boundaryNoiseScale: 0.02,
        boundaryNoiseAmount: 100,
      },
      island: {
        enabled: true,
        maxWorldSizeTiles: 50,
        falloffTiles: 5,
        edgeNoiseScale: 0.1,
        edgeNoiseStrength: 0.2,
      },
    },
    pluginIds: ["@hyperforge/hyperscape"],
    npcs: [
      {
        id: "debug_eldric_shopkeeper",
        type: "shopkeeper",
        name: "Eldric the Merchant",
        position: { x: 0, y: 0, z: 0 },
        assetRef: "@hyperforge/asset-pack-hyperia-npcs-v1/shopkeeper",
      },
      {
        id: "debug_marcus_questgiver",
        type: "questgiver",
        name: "Marcus the Adventurer",
        position: { x: 12, y: 0, z: -8 },
        assetRef: "@hyperforge/asset-pack-hyperia-npcs-v1/questgiver",
      },
      {
        id: "debug_garrick_guard",
        type: "guard",
        name: "Garrick the Guard",
        position: { x: -8, y: 0, z: 4 },
        assetRef: "@hyperforge/asset-pack-hyperia-npcs-v1/guard",
      },
    ],
    mobSpawns: [
      {
        mobId: "goblin",
        position: { x: 30, y: 0, z: 30 },
        maxCount: 3,
        spawnRadius: 5,
        assetRef: "@hyperforge/asset-pack-hyperia-mobs-v1/goblin",
      },
      {
        mobId: "goblin",
        position: { x: -30, y: 0, z: 25 },
        maxCount: 2,
        spawnRadius: 4,
        assetRef: "@hyperforge/asset-pack-hyperia-mobs-v1/goblin",
      },
      {
        mobId: "wolf",
        position: { x: 50, y: 0, z: -10 },
        maxCount: 4,
        spawnRadius: 8,
        assetRef: "@hyperforge/asset-pack-hyperia-mobs-v1/wolf",
      },
      {
        mobId: "skeleton",
        position: { x: -50, y: 0, z: -40 },
        maxCount: 2,
        spawnRadius: 3,
        assetRef: "@hyperforge/asset-pack-hyperia-mobs-v1/skeleton",
      },
      {
        mobId: "rat",
        position: { x: 5, y: 0, z: 15 },
        maxCount: 6,
        spawnRadius: 6,
        assetRef: "@hyperforge/asset-pack-hyperia-mobs-v1/rat",
      },
    ],
    quests: [
      {
        id: "debug_tutorial_quest",
        name: "Welcome to the World",
        description: "Help Eldric set up his shop, then deal with the rats.",
        difficulty: "novice",
        questPoints: 1,
        replayable: false,
        startNpc: "debug_eldric_shopkeeper",
        requirements: { quests: [], skills: {}, items: [] },
        stages: [
          {
            type: "dialogue",
            id: "meet-eldric",
            description: "Talk to Eldric the Merchant",
            npcId: "debug_eldric_shopkeeper",
          },
          {
            type: "kill",
            id: "kill-rats",
            description: "Slay 5 rats near the shop",
            target: "rat",
            count: 5,
          },
          {
            type: "dialogue",
            id: "report-back",
            description: "Return to Eldric",
            npcId: "debug_eldric_shopkeeper",
          },
        ],
        onStart: {},
        rewards: {
          questPoints: 1,
          items: [],
          xp: { combat: 100, attack: 50 },
        },
      },
    ],
    assets: [],
    zones: [
      {
        id: "debug_starter_village",
        name: "Starter Village",
        description: "A small village where new adventurers begin.",
        difficultyLevel: 0,
        bounds: { minX: -20, maxX: 20, minZ: -15, maxZ: 15 },
        biomeType: "plains",
        safeZone: true,
        pvpEnabled: false,
      },
    ],
    resources: [
      {
        resourceId: "tree_oak",
        type: "tree",
        position: { x: 18, y: 0, z: -12 },
        assetRef: "@hyperforge/asset-pack-hyperia-trees-v1/tree_oak_v1",
      },
      {
        resourceId: "rock_iron",
        type: "rock",
        position: { x: -25, y: 0, z: 18 },
        assetRef: "@hyperforge/asset-pack-hyperia-rocks-v1/rock_iron",
      },
    ],
    stations: [
      {
        id: "debug_smithy_anvil",
        type: "anvil",
        position: { x: 4, y: 0, z: -2 },
        assetRef: "@hyperforge/asset-pack-hyperia-stations-v1/anvil",
      },
      {
        id: "debug_smithy_furnace",
        type: "furnace",
        position: { x: 5, y: 0, z: -2 },
        assetRef: "@hyperforge/asset-pack-hyperia-stations-v1/furnace",
      },
    ],
    teleports: [
      {
        id: "debug_village_lodestone",
        name: "Village Lodestone",
        type: "lodestone",
        position: { x: 0, y: 0, z: 6 },
      },
    ],
    assetPackIds: [
      "@hyperforge/asset-pack-hyperia-npcs-v1",
      "@hyperforge/asset-pack-hyperia-mobs-v1",
      "@hyperforge/asset-pack-hyperia-trees-v1",
      "@hyperforge/asset-pack-hyperia-stations-v1",
    ],
    roads: [],
    pois: [],
    dangerSources: [],
    waterBodies: [],
    musicZones: [],
    ambientZones: [],
    sfxTriggers: [],
    mines: [],
    wildernessBoundary: null,
    uiPack: null,
  };
}
