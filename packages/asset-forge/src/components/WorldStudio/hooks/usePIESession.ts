/**
 * usePIESession — Play-In-Editor session manager
 *
 * Orchestrates the PIE lifecycle:
 * 1. Creates a PlayTestWorld with entities from manifests
 * 2. Enters player mode on the viewport camera (WASD + mouse look)
 * 3. Runs the game tick loop (mob patrol, NPC face-toward-player)
 * 4. Syncs entity transforms to the Three.js scene (animated markers)
 * 5. Cleans up on exit (ESC or explicit stop)
 *
 * The hook is used by ViewportContainer and controlled by MainToolbar's
 * Play button via the PIE state in the World Studio context.
 */

import { useRef, useCallback, useEffect } from "react";
import * as THREE from "three/webgpu";

// PIE world + script runtime live in @hyperforge/shared.
// The runtime uses the same ScriptGraphInterpreter as the production server
// so behavior graphs run identically inside PIE and in-game.
//
// `PIEEditorSession` is the real-loopback PIE replacement for
// `PlayTestWorld`: it boots a real ServerNetwork + ClientNetwork over an
// in-memory socket pair so the editor runs the exact code paths the live
// client speaks. Public API mirrors `PlayTestWorld` exactly.
import {
  PIEEditorSession,
  type PIEEntity,
  type PIEEditorSessionOptions,
  type PIEDebugEntry,
  type RuntimeScriptGraph,
  type GameModeManifest,
  HYPERIA_DEFAULT_MANIFEST,
  CLICK_TO_WALK_CONTROLLER_ID,
} from "@hyperforge/shared/runtime";
import type { ScriptGraph } from "../../../scripting/types";
import { createPIEPluginHooks } from "../../../pie/pluginBoot";
import { resolveProjectPluginSet } from "../toolbar/gamePluginResolver";
import type { WidgetRegistry } from "@hyperforge/ui-framework";
import {
  bindAllWidgets,
  createUIWidgetRegistry,
  type UIWidgetComponent,
} from "@hyperforge/ui-widgets";

import type { TerrainSceneRefs } from "../../WorldBuilder/TileBasedTerrain";
import type {
  WorldStudioState,
  ManifestPrayer,
  ManifestTierRequirement,
  ManifestRecipe,
  ManifestItem,
  ManifestCombatSpell,
  ManifestRune,
  ManifestElementalStaff,
  ManifestTree,
  ManifestMiningRock,
  ManifestFishingSpot,
  ManifestSkillUnlock,
  ManifestAmmunition,
  ManifestStore,
} from "../worldStudioTypes";

/**
 * Cast an editor `ScriptGraph` to the runtime's `RuntimeScriptGraph`.
 * The two types are structurally identical for runtime fields; the editor's
 * `ScriptNode.position` is an extra field the runtime ignores.
 */
function toRuntimeGraph(g: ScriptGraph): RuntimeScriptGraph {
  return g as unknown as RuntimeScriptGraph;
}

/**
 * Convert the editor's `ManifestPrayer[]` shape to the runtime-facing
 * `PrayersManifest` input shape consumed by `PrayerDataProvider.hotReload`.
 *
 * The editor allows `icon` to be optional so in-progress rows don't fail
 * validation; the runtime requires a non-empty icon. We fall back to the
 * prayer `id` as a stable placeholder — the final Zod parse inside
 * `loadPrayers` still enforces min(1) on every field.
 */
function toPrayersManifestInput(prayers: ManifestPrayer[]): {
  prayers: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    level: number;
    category: string;
    drainEffect: number;
    bonuses: Record<string, unknown>;
    conflicts: string[];
  }>;
} {
  return {
    prayers: prayers.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon && p.icon.length > 0 ? p.icon : p.id,
      level: p.level,
      category: p.category,
      drainEffect: p.drainEffect,
      bonuses: p.bonuses,
      conflicts: p.conflicts,
    })),
  };
}

/**
 * Convert the editor's flat `ManifestTierRequirement[]` list into the
 * runtime-facing `TierRequirementsManifest` shape (4 category buckets of
 * tier → skill-requirements records) consumed by
 * `TierDataProvider.hotReload`.
 *
 * Entries with unrecognized categories are dropped — the runtime schema
 * only knows `melee | tools | ranged | magic`. The final Zod parse
 * inside `load()` enforces per-tier skill shape (e.g. melee needs both
 * attack + defence).
 */
function toTierRequirementsManifestInput(tiers: ManifestTierRequirement[]): {
  melee: Record<string, Record<string, number>>;
  tools: Record<string, Record<string, number>>;
  ranged: Record<string, Record<string, number>>;
  magic: Record<string, Record<string, number>>;
} {
  const manifest = {
    melee: {} as Record<string, Record<string, number>>,
    tools: {} as Record<string, Record<string, number>>,
    ranged: {} as Record<string, Record<string, number>>,
    magic: {} as Record<string, Record<string, number>>,
  };
  for (const t of tiers) {
    const bucket =
      t.category === "melee"
        ? manifest.melee
        : t.category === "tools"
          ? manifest.tools
          : t.category === "ranged"
            ? manifest.ranged
            : t.category === "magic"
              ? manifest.magic
              : null;
    if (!bucket) continue;
    bucket[t.tier] = { ...t.requirements };
  }
  return manifest;
}

/**
 * Group the editor's flat `ManifestRecipe[]` by `skill` and project each row
 * back into the per-skill schema shape expected by
 * `ProcessingDataProvider.hotReload`. The editor preserves the original JSON
 * in `_raw` when loading manifests via `useManifestLoader`, so emitting
 * `_raw` as the recipe body round-trips the source-of-truth shape; Zod
 * validates server-side and rejects malformed edits.
 *
 * Returns `undefined` if no recipes are present, so the PIE session skips
 * the update entirely instead of clearing the manifests.
 */
function toProcessingManifestsInput(recipes: ManifestRecipe[]):
  | {
      cooking?: { recipes: unknown[] };
      firemaking?: { recipes: unknown[] };
      smelting?: { recipes: unknown[] };
      smithing?: { recipes: unknown[] };
      crafting?: { recipes: unknown[] };
      tanning?: { recipes: unknown[] };
      fletching?: { recipes: unknown[] };
      runecrafting?: { recipes: unknown[] };
    }
  | undefined {
  if (recipes.length === 0) return undefined;
  const bundle: Record<string, { recipes: unknown[] }> = {};
  for (const r of recipes) {
    const raw = r._raw;
    if (!raw) continue;
    const key = r.skill;
    if (
      key !== "cooking" &&
      key !== "firemaking" &&
      key !== "smelting" &&
      key !== "smithing" &&
      key !== "crafting" &&
      key !== "tanning" &&
      key !== "fletching" &&
      key !== "runecrafting"
    ) {
      continue;
    }
    if (!bundle[key]) bundle[key] = { recipes: [] };
    bundle[key].recipes.push(raw);
  }
  return bundle;
}

/**
 * Convert the editor's flat `ManifestCombatSpell[]` back into the
 * runtime's `{ standard: { strike: [...], bolt: [...] } }` shape
 * consumed by `hotReloadCombatSpells`. Spells are grouped by their
 * `tier` field (the same field the loader set when flattening). Rows
 * whose tier isn't `strike` or `bolt` are dropped — F2P scope only.
 *
 * Returns `undefined` if neither bucket has entries, so the PIE session
 * skips the update rather than pushing an empty manifest that would
 * trip the schema's `min(1)` constraints.
 */
/**
 * Convert the editor's lossy `ManifestTree[]` slice back into a
 * `WoodcuttingManifest`-shaped body suitable for
 * `session.world.updateManifests({ woodcutting })`.
 *
 * The editor-side type only surfaces 6 flat fields (id, name, type,
 * levelRequired, examine, modelVariants). The schema requires the full
 * gathering-resource shape (harvestSkill, toolRequired, baseCycleTicks,
 * harvestYield, etc.). We preserve the original JSON body in `_raw`
 * during load and overlay the editor-surfaced fields on top so form
 * edits take effect without synthesizing missing data.
 *
 * Rows that never had a `_raw` attached (e.g., freshly added by the
 * user) are dropped — a brand-new tree can't be hot-reloaded without
 * providing the full schema-required body. Returns `undefined` when
 * nothing survives so the useEffect skips the push.
 */
function toWoodcuttingManifestInput(
  trees: ManifestTree[],
): { trees: unknown[] } | undefined {
  const out: unknown[] = [];
  for (const t of trees) {
    if (!t._raw) continue;
    out.push({
      ...t._raw,
      id: t.id,
      name: t.name,
      type: t.type,
      levelRequired: t.levelRequired,
      examine: t.examine,
      modelVariants: t.modelVariants,
    });
  }
  if (out.length === 0) return undefined;
  return { trees: out };
}

/**
 * Mining companion to `toWoodcuttingManifestInput`. See that function
 * for the overlay rationale.
 */
function toMiningManifestInput(
  rocks: ManifestMiningRock[],
): { rocks: unknown[] } | undefined {
  const out: unknown[] = [];
  for (const r of rocks) {
    if (!r._raw) continue;
    out.push({
      ...r._raw,
      id: r.id,
      name: r.name,
      type: r.type,
      modelPath: r.modelPath,
      levelRequired: r.levelRequired,
      examine: r.examine,
    });
  }
  if (out.length === 0) return undefined;
  return { rocks: out };
}

/**
 * Fishing companion to `toWoodcuttingManifestInput`. See that function
 * for the overlay rationale.
 */
function toFishingManifestInput(
  spots: ManifestFishingSpot[],
): { spots: unknown[] } | undefined {
  const out: unknown[] = [];
  for (const s of spots) {
    if (!s._raw) continue;
    out.push({
      ...s._raw,
      id: s.id,
      name: s.name,
      type: s.type,
      toolRequired: s.toolRequired,
      levelRequired: s.levelRequired,
      examine: s.examine,
    });
  }
  if (out.length === 0) return undefined;
  return { spots: out };
}

/**
 * Convert the editor's flat `ManifestSkillUnlock[]` back into the
 * `SkillUnlocksManifest` shape `{ skills: { [skillName]: Array<{ level,
 * description, type? }> } }` consumed by `loadSkillUnlocks`. Entries
 * are grouped by their `skill` field (the loader flattened them the
 * same way). Empty editor state yields `undefined` so the push is
 * skipped rather than clearing the live map.
 */
function toSkillUnlocksManifestInput(unlocks: ManifestSkillUnlock[]):
  | {
      skills: Record<
        string,
        Array<{ level: number; description: string; type?: string }>
      >;
    }
  | undefined {
  if (unlocks.length === 0) return undefined;
  const skills: Record<
    string,
    Array<{ level: number; description: string; type?: string }>
  > = {};
  for (const u of unlocks) {
    if (!skills[u.skill]) skills[u.skill] = [];
    skills[u.skill].push({
      level: u.level,
      description: u.description,
      ...(u.type !== undefined ? { type: u.type } : {}),
    });
  }
  return { skills };
}

/**
 * Convert the editor's `ManifestAmmunition[]` slice plus the preserved
 * top-level `bowTiers` record into the `{ $schema, bowTiers, arrows }`
 * shape consumed by `hotReloadAmmunition`. Arrows are keyed by id in
 * the runtime manifest; the loader flattened them into an array on
 * import and we re-key here. `requiredBowTier` defaults to 1 when the
 * editor row doesn't specify one — matches the schema minimum.
 *
 * Returns `undefined` when there are no arrows so the push is skipped
 * rather than clearing `ARROW_DATA` on the runtime side.
 */
function toAmmunitionManifestInput(
  arrows: ManifestAmmunition[],
  bowTiers: Record<string, number>,
):
  | {
      $schema: "hyperforge.ammunition.v1";
      bowTiers: Record<string, number>;
      arrows: Record<
        string,
        {
          id: string;
          name: string;
          rangedStrength: number;
          requiredRangedLevel: number;
          requiredBowTier: number;
        }
      >;
    }
  | undefined {
  if (arrows.length === 0) return undefined;
  const arrowsByKey: Record<
    string,
    {
      id: string;
      name: string;
      rangedStrength: number;
      requiredRangedLevel: number;
      requiredBowTier: number;
    }
  > = {};
  for (const a of arrows) {
    arrowsByKey[a.id] = {
      id: a.id,
      name: a.name,
      rangedStrength: a.rangedStrength,
      requiredRangedLevel: a.requiredRangedLevel,
      requiredBowTier: a.requiredBowTier ?? 1,
    };
  }
  return {
    $schema: "hyperforge.ammunition.v1",
    bowTiers: { ...bowTiers },
    arrows: arrowsByKey,
  };
}

/**
 * Convert the editor's `ManifestStore[]` slice into the `StoreData[]`
 * shape consumed by `hotReloadStores`. Editor store items omit
 * `description` / `category` / `restockTime` — the runtime struct
 * technically requires them but the shop HUD + server shop system
 * read each field independently with sensible fallbacks, so we fill
 * default values here rather than forcing users to author every
 * field up front.
 *
 * Returns `undefined` when there are no stores to skip the push and
 * avoid clearing the live `GENERAL_STORES` map.
 */
function toStoresManifestInput(stores: ManifestStore[]):
  | Array<{
      id: string;
      name: string;
      buyback: boolean;
      buybackRate: number;
      description: string;
      items: Array<{
        id: string;
        itemId: string;
        name: string;
        price: number;
        description: string;
        category: string;
        stockQuantity: number;
        restockTime: number;
      }>;
    }>
  | undefined {
  if (stores.length === 0) return undefined;
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    buyback: s.buyback ?? false,
    buybackRate: s.buybackRate ?? 0,
    description: s.description ?? "",
    items: s.items.map((i) => ({
      id: i.id,
      itemId: i.itemId,
      name: i.name,
      price: i.price,
      description: i.description ?? "",
      category: i.category ?? "general",
      stockQuantity: i.stockQuantity,
      restockTime: i.restockTime ?? 0,
    })),
  }));
}

function toCombatSpellsManifestInput(spells: ManifestCombatSpell[]):
  | {
      standard: {
        strike: Array<{
          id: string;
          name: string;
          level: number;
          baseMaxHit: number;
          baseXp: number;
          element: string;
          attackSpeed: number;
          runes: Array<{ runeId: string; quantity: number }>;
        }>;
        bolt: Array<{
          id: string;
          name: string;
          level: number;
          baseMaxHit: number;
          baseXp: number;
          element: string;
          attackSpeed: number;
          runes: Array<{ runeId: string; quantity: number }>;
        }>;
      };
    }
  | undefined {
  const strike: Array<{
    id: string;
    name: string;
    level: number;
    baseMaxHit: number;
    baseXp: number;
    element: string;
    attackSpeed: number;
    runes: Array<{ runeId: string; quantity: number }>;
  }> = [];
  const bolt: typeof strike = [];
  for (const s of spells) {
    const row = {
      id: s.id,
      name: s.name,
      level: s.level,
      baseMaxHit: s.baseMaxHit,
      baseXp: s.baseXp,
      element: s.element,
      attackSpeed: s.attackSpeed ?? 5,
      runes: s.runes.map((r) => ({ runeId: r.runeId, quantity: r.quantity })),
    };
    if (s.tier === "strike") strike.push(row);
    else if (s.tier === "bolt") bolt.push(row);
  }
  if (strike.length === 0 || bolt.length === 0) return undefined;
  return { standard: { strike, bolt } };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Color palette for PIE entity markers */
const PIE_COLORS = {
  mob: 0xcc3333, // Red
  npc: 0x33cc33, // Green
  resource: 0x3399cc, // Blue
  station: 0xcccc33, // Yellow
} as const;

/** Marker geometry (shared across all PIE markers) */
let _capsuleGeom: THREE.CapsuleGeometry | null = null;
let _cylinderGeom: THREE.CylinderGeometry | null = null;

function getCapsuleGeom(): THREE.CapsuleGeometry {
  if (!_capsuleGeom) _capsuleGeom = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
  return _capsuleGeom;
}

function getCylinderGeom(): THREE.CylinderGeometry {
  if (!_cylinderGeom)
    _cylinderGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.6, 8);
  return _cylinderGeom;
}

// Material cache — one per entity type
const _materials = new Map<string, THREE.MeshBasicMaterial>();
function getMaterial(type: keyof typeof PIE_COLORS): THREE.MeshBasicMaterial {
  let mat = _materials.get(type);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color: PIE_COLORS[type],
      transparent: true,
      opacity: 0.7,
    });
    _materials.set(type, mat);
  }
  return mat;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PIESessionState {
  world: PIEEditorSession | null;
  markers: Map<string, THREE.Mesh>;
  markerGroup: THREE.Group | null;
  animationId: number | null;
  lastTime: number;
  /**
   * Object3D wired into PlayTestWorld as the pawn body when `mode === "play"`.
   * The PIE interaction-router shim mutates its `position` on click-to-walk;
   * the orbit camera shim reads it each tick. Added to the scene so future
   * visual feedback (player marker, etc.) can be attached.
   */
  playerObject: THREE.Object3D | null;
  /**
   * Session-scoped UI widget registry, owned by this hook. Created
   * before plugin boot so widget contributions (e.g. shooter-demo's
   * crosshair) land in the same registry that `<PIEHudOverlay />`
   * reads from. Null while PIE is stopped.
   */
  widgetRegistry: WidgetRegistry<UIWidgetComponent> | null;
}

interface UsePIESessionOptions {
  /** Current scene refs from TileBasedTerrain */
  sceneRefs: TerrainSceneRefs | null;
  /** World Studio state for reading manifest/entity data */
  state: WorldStudioState;
  /** Called when PIE exits (e.g., user presses ESC) */
  onExit: () => void;
  /**
   * Receives every script-runtime debug entry while PIE is active.
   * Wired by `WorldStudioLayout` to a PIE Console panel.
   */
  onDebug?: (entry: PIEDebugEntry) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePIESession({
  sceneRefs,
  state,
  onExit,
  onDebug,
}: UsePIESessionOptions) {
  const sessionRef = useRef<PIESessionState>({
    world: null,
    markers: new Map(),
    markerGroup: null,
    animationId: null,
    lastTime: 0,
    playerObject: null,
    widgetRegistry: null,
  });

  // Track the onExit callback in a ref to avoid stale closures
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // Track the debug sink in a ref so updates don't restart PIE.
  const onDebugRef = useRef(onDebug);
  onDebugRef.current = onDebug;

  // Track sceneRefs in a ref
  const sceneRefsRef = useRef(sceneRefs);
  sceneRefsRef.current = sceneRefs;

  /**
   * Start the PIE session.
   * Creates the PIEEditorSession, spawns entities, enters player mode.
   *
   * Async because `PIEEditorSession.start()` boots the real server stack
   * (ServerNetwork + ClientNetwork over the in-memory socket pair). React
   * event handlers can fire-and-forget the returned promise.
   */
  const startPIE = useCallback(async () => {
    const refs = sceneRefsRef.current;
    if (!refs) {
      console.warn("[PIE] Cannot start — scene refs not available");
      return;
    }

    const session = sessionRef.current;

    // Clean up any existing session
    if (session.world) {
      await stopPIEInternal(session, refs);
    }

    // Point DataManager at Vite's /game-assets middleware so PIE's own
    // DataManager init doesn't try to reach the (absent) game server at
    // localhost:5555. Harmless if EditorWorldContext already set this.
    (window as unknown as Record<string, unknown>).__ASSETS_URL =
      "/game-assets";

    // Create PIE session (real ServerNetwork + ClientNetwork loopback).
    const world = new PIEEditorSession();

    // Collect entity data from manifests
    const gameEntities = state.gameEntities;
    const extendedLayers = state.extendedLayers;
    const overrides = state.manifestOverrides;
    const offset = refs.worldCenterOffset;

    // Behavior-graph lookup helpers — return the editor-side ScriptGraph cast
    // to the runtime shape (the runtime ignores the editor's `position` field).
    const npcGraph = (typeId: string) => {
      const g = overrides.npcOverrides.get(typeId)?.behaviorGraph;
      return g ? toRuntimeGraph(g) : undefined;
    };
    const mobGraph = (spawnId: string) => {
      const g = overrides.mobSpawnOverrides.get(spawnId)?.behaviorGraph;
      return g ? toRuntimeGraph(g) : undefined;
    };
    const resGraph = (resId: string) => {
      const g = overrides.resourceOverrides.get(resId)?.behaviorGraph;
      return g ? toRuntimeGraph(g) : undefined;
    };
    const stationGraph = (stationId: string) => {
      const g = overrides.stationOverrides.get(stationId)?.behaviorGraph;
      return g ? toRuntimeGraph(g) : undefined;
    };

    // Gather mob spawns from extended layers (hand-placed + procgen)
    const mobSpawns = extendedLayers.mobSpawns.map((ms) => ({
      id: ms.id,
      mobId: ms.mobId,
      name: ms.name,
      position: {
        x: ms.position.x + offset,
        y: ms.position.y,
        z: ms.position.z + offset,
      },
      spawnRadius: ms.spawnRadius,
      maxCount: ms.maxCount,
      behaviorGraph: mobGraph(ms.id),
    }));

    // Gather NPCs from BOTH manifest (gameEntities — Hyperia's
    // hand-authored NPCs from world-areas.json) AND extendedLayers
    // (palette-placed designer NPCs + agent emissions; both flow
    // into extendedLayers post-P0.3+P0.6 of PLAN_AGENT_STUDIO_PARITY).
    // The legacy `agentWorldContent.npcs/spawns` merge that used to
    // bolt on agent content separately is no longer needed — agent
    // entries are in extendedLayers from emission time onward.
    //
    // GameEntityInfo position is {x, z} (no y); extendedLayers is
    // already in scene-space so it adds offset 0 (already-applied).
    const npcs = [
      ...(gameEntities?.npcs ?? []).map((npc) => ({
        id: npc.entityId,
        type: npc.npcType ?? "generic",
        name: npc.name,
        position: {
          x: npc.position.x + offset,
          y: 0, // Will be corrected to terrain height by the PIE world
          z: npc.position.z + offset,
        },
        behaviorGraph: npcGraph(npc.entityId),
      })),
      ...extendedLayers.npcs.map((npc) => ({
        id: npc.id,
        type: npc.npcTypeId ?? "generic",
        name: npc.name,
        position: {
          x: npc.position.x,
          y: npc.position.y,
          z: npc.position.z,
        },
        behaviorGraph: npcGraph(npc.id),
      })),
    ];

    // Gather resources
    const resources = extendedLayers.resources.map((res) => ({
      id: res.id,
      resourceId: res.resourceId,
      resourceType: res.resourceType,
      name: res.name,
      position: {
        x: res.position.x + offset,
        y: res.position.y,
        z: res.position.z + offset,
      },
      behaviorGraph: resGraph(res.id),
    }));

    // Gather stations
    const stations = extendedLayers.stations.map((st) => ({
      id: st.id,
      type: st.stationType,
      position: {
        x: st.position.x + offset,
        y: st.position.y,
        z: st.position.z + offset,
      },
      behaviorGraph: stationGraph(st.id),
    }));

    // Player spawn: use camera's current XZ position at terrain height
    const camPos = refs.camera.position;
    const terrainHeight = refs.getTerrainHeight(camPos.x, camPos.z);
    const playerSpawn = {
      x: camPos.x,
      y: terrainHeight + 1.7,
      z: camPos.z,
    };

    // Start the PIE world. Debug entries flow up to the optional sink so
    // the PIE Console panel can render them.
    // GameMode manifest selects the viewport controller. Phase 4 persists
    // this per-game; `state.project.gameMode` is populated from the games
    // API (`fetchGame`) when the project loads. Legacy games or offline
    // projects fall back to the built-in Hyperia click-to-walk + orbit
    // composition.
    const manifest: GameModeManifest =
      state.project.gameMode ?? HYPERIA_DEFAULT_MANIFEST;

    // Play mode needs an Object3D pawn body the GameMode controllers can
    // possess. Created here (not inside PlayTestWorld) so it sits in the
    // editor scene graph and future visual feedback can attach to it.
    const pieMode = state.pie.mode;
    const playerObject = pieMode === "play" ? new THREE.Object3D() : null;
    if (playerObject) {
      playerObject.name = "pie-player-pawn";
      playerObject.position.set(playerSpawn.x, playerSpawn.y, playerSpawn.z);
      refs.scene.add(playerObject);
    }

    // Create + populate a session-scoped widget registry BEFORE the
    // plugin hooks fire so plugin onEnable widget contributions land
    // in the same instance the PIE HUD overlay reads from.
    const widgetRegistry = createUIWidgetRegistry();
    bindAllWidgets(widgetRegistry);
    session.widgetRegistry = widgetRegistry;

    const startOptions: PIEEditorSessionOptions = {
      mobSpawns,
      npcs,
      resources,
      stations,
      playerSpawn,
      debugSink: (entry: PIEDebugEntry) => onDebugRef.current?.(entry),
      gameMode: manifest,
      mode: pieMode === "play" ? "play" : "simulate",
      // B0'.C: derive the active plugin set from the project's
      // typed-layer surface (B0'.A) instead of env/localStorage.
      // Empty `project.plugins` → "blank" → no game plugins boot.
      // Hyperia template → "hyperscape" → full plugin chain.
      plugins: createPIEPluginHooks(
        resolveProjectPluginSet({
          plugins: state.project.plugins,
          templateId: state.project.templateId,
          projectLoaded: state.project.currentProjectId !== null,
        }),
        widgetRegistry,
      ),
      ...(pieMode === "play"
        ? {
            viewport: refs.container,
            camera: refs.camera,
            renderer: refs.renderer,
            scene: refs.scene,
            playerObject: playerObject!,
          }
        : {}),
    };
    await world.start(startOptions);

    // Create a group to hold all PIE markers
    const markerGroup = new THREE.Group();
    markerGroup.name = "pie-entities";
    refs.scene.add(markerGroup);

    // Create initial markers for mobs and NPCs
    const markers = new Map<string, THREE.Mesh>();
    for (const entity of world.entities.values()) {
      if (entity.type === "player") continue; // Player is the camera

      const marker = createMarker(entity);
      if (marker) {
        markerGroup.add(marker);
        markers.set(entity.id, marker);
      }
    }

    // Store session state
    session.world = world;
    session.markers = markers;
    session.markerGroup = markerGroup;
    session.lastTime = performance.now();
    session.playerObject = playerObject;

    // Branch on (pieMode, gameMode id):
    //   - Simulate: WASD fly-cam regardless of GameMode. The editor
    //     camera possesses nothing; designers move freely.
    //   - Play + click-to-walk: PlayTestWorld owns the camera via the
    //     resolved `OrbitCameraController` + `PIEOrbitCameraShim` and
    //     routes viewport clicks through `PIEInteractionRouterShim`.
    //     We suppress OrbitControls (setInteractionMode "tool") so its
    //     rotation doesn't fight the orbit shim.
    //   - Play + unknown id: alternate manifests registered by
    //     downstream games (Phase 5). Controllers are attached by
    //     PlayTestWorld; interaction mode is set to "tool" for the
    //     same reason.
    const modeId = world.gameMode?.id ?? CLICK_TO_WALK_CONTROLLER_ID;
    if (pieMode === "simulate") {
      refs.enterPlayerMode();
    } else if (modeId === CLICK_TO_WALK_CONTROLLER_ID) {
      refs.setInteractionMode("tool");
    } else {
      refs.setInteractionMode("tool");
    }

    // Start the tick loop
    const tickLoop = (time: number) => {
      const s = sessionRef.current;
      if (!s.world || !s.world.isRunning) return;

      const dt = Math.min((time - s.lastTime) / 1000, 0.1); // Cap at 100ms
      s.lastTime = time;

      // Tick the PIE world (mob AI, NPC behavior)
      s.world.tick(dt);

      // Sync entity positions to Three.js markers
      for (const entity of s.world.entities.values()) {
        if (entity.type === "player") continue;
        const marker = s.markers.get(entity.id);
        if (marker) {
          marker.position.set(
            entity.position.x,
            entity.position.y + 0.8, // Offset markers above ground
            entity.position.z,
          );
          marker.rotation.y = entity.rotation;
        }
      }

      s.animationId = requestAnimationFrame(tickLoop);
    };

    session.animationId = requestAnimationFrame(tickLoop);

    console.log("[PIE] Session started");
  }, [
    state.gameEntities,
    state.extendedLayers,
    state.pie.mode,
    state.project.gameMode,
  ]);

  /**
   * Stop the PIE session.
   * Cleans up markers, stops tick loop, exits player mode.
   *
   * `PIEEditorSession.stop()` is async (it awaits the server teardown),
   * but callers that don't care (React cleanup, event handlers) can
   * fire-and-forget the returned promise.
   */
  const stopPIE = useCallback(async () => {
    const refs = sceneRefsRef.current;
    const session = sessionRef.current;
    if (refs) {
      await stopPIEInternal(session, refs);
    }
  }, []);

  /**
   * Raycast from screen-center against PIE markers and fire `entity:interact`
   * on the first hit. Called by ViewportContainer when the user clicks while
   * PIE is active (the camera is in pointer-lock FPS mode, so cursor pos =
   * center of viewport).
   *
   * Returns the entity id that was interacted with, or null if nothing hit.
   */
  const interactAtCenter = useCallback((): string | null => {
    const refs = sceneRefsRef.current;
    const session = sessionRef.current;
    if (!refs || !session.world || !session.markerGroup) return null;

    // Pointer-lock mode: ray from the center of the camera (NDC origin).
    const ndc = new THREE.Vector2(0, 0);
    refs.raycaster.setFromCamera(ndc, refs.camera);
    const hits = refs.raycaster.intersectObjects(
      session.markerGroup.children,
      false,
    );
    if (hits.length === 0) return null;

    // Walk up to the marker mesh that carries `userData.pieEntity` —
    // intersectObjects returns the actual mesh, but be defensive.
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !(obj as THREE.Object3D).userData?.pieEntity) {
        obj = obj.parent;
      }
      const entityId = obj?.userData?.entityId as string | undefined;
      if (entityId) {
        session.world.interactWith(entityId);
        return entityId;
      }
    }
    return null;
  }, []);

  // Phase B3.1 — hot-reload prayer manifest edits into the running PIE
  // session. Runs whenever the reducer dispatches `MANIFEST_UPDATE_PRAYERS`
  // (reference equality on the prayers array). No-ops when PIE is not
  // running (updateManifests guards on `_running`). Malformed edits throw
  // inside `PrayerDataProvider.loadPrayers`; we catch so an in-progress
  // edit doesn't tear down the live session.
  const prayers = state.manifests.prayers;
  useEffect(() => {
    const session = sessionRef.current;
    if (!session.world || !session.world.isRunning) return;
    try {
      session.world.updateManifests({
        prayers: toPrayersManifestInput(prayers),
      });
    } catch (err) {
      console.warn(
        "[PIE] Prayer hot-reload skipped — manifest failed validation:",
        err,
      );
    }
  }, [prayers]);

  // Phase B3.1 — hot-reload tier-requirement edits. Safe kind: no scene
  // entities to respawn; next `TierDataProvider.getRequirements()` call
  // observes the new values. Malformed edits (e.g. missing `defence` on
  // a melee tier) throw out of `load()`; catch keeps live PIE alive.
  const tierRequirements = state.manifests.tierRequirements;
  useEffect(() => {
    const session = sessionRef.current;
    if (!session.world || !session.world.isRunning) return;
    try {
      session.world.updateManifests({
        tierRequirements: toTierRequirementsManifestInput(tierRequirements),
      });
    } catch (err) {
      console.warn(
        "[PIE] Tier-requirement hot-reload skipped — manifest failed validation:",
        err,
      );
    }
  }, [tierRequirements]);

  const recipes = state.manifests.recipes;
  useEffect(() => {
    const session = sessionRef.current;
    if (!session.world || !session.world.isRunning) return;
    const recipesInput = toProcessingManifestsInput(recipes);
    if (!recipesInput) return;
    try {
      session.world.updateManifests({ recipes: recipesInput });
    } catch (err) {
      console.warn(
        "[PIE] Recipe hot-reload skipped — manifest failed validation:",
        err,
      );
    }
  }, [recipes]);

  const items = state.manifests.items;
  useEffect(() => {
    const session = sessionRef.current;
    if (!session.world || !session.world.isRunning) return;
    if (items.length === 0) return;
    try {
      // Metadata-only overlay — combat stats / cooking / tool data are
      // never pushed from the editor because `ManifestItem` doesn't surface
      // them. See `DataManager.hotReloadItemsMetadata` for the merge rules.
      session.world.updateManifests({
        items: items.map((i: ManifestItem) => ({
          id: i.id,
          name: i.name,
          value: i.value,
          weight: i.weight,
          description: i.description,
          examine: i.examine,
          tradeable: i.tradeable,
          stackable: i.stackable,
          rarity: i.rarity,
          modelPath: i.modelPath,
          iconPath: i.iconPath,
        })),
      });
    } catch (err) {
      console.warn("[PIE] Item hot-reload skipped:", err);
    }
  }, [items]);

  const combatSpells = state.manifests.combatSpells;
  useEffect(() => {
    const session = sessionRef.current;
    if (!session.world || !session.world.isRunning) return;
    if (combatSpells.length === 0) return;
    try {
      const spellsInput = toCombatSpellsManifestInput(combatSpells);
      if (!spellsInput) return;
      session.world.updateManifests({ spells: spellsInput });
    } catch (err) {
      console.warn("[PIE] Combat spell hot-reload skipped:", err);
    }
  }, [combatSpells]);

  const runes = state.manifests.runes;
  const elementalStaves = state.manifests.elementalStaves;
  useEffect(() => {
    const session = sessionRef.current;
    if (!session.world || !session.world.isRunning) return;
    // RunesManifestSchema requires both arrays to be non-empty; skip the
    // update rather than tripping Zod when the project hasn't loaded yet.
    if (runes.length === 0 || elementalStaves.length === 0) return;
    try {
      session.world.updateManifests({
        runes: {
          runes: runes.map((r: ManifestRune) => ({
            id: r.id,
            name: r.name,
            element: r.element,
            stackable: r.stackable,
          })),
          elementalStaves: elementalStaves.map((s: ManifestElementalStaff) => ({
            staffId: s.staffId,
            providesInfinite: [...s.providesInfinite],
          })),
        },
      });
    } catch (err) {
      console.warn("[PIE] Rune hot-reload skipped:", err);
    }
  }, [runes, elementalStaves]);

  // Gathering resources: woodcutting / mining / fishing. Each sub-manifest
  // hot-reloads independently via `gatheringResources.load{Woodcutting,
  // Mining,Fishing}` which clears and re-populates its sub-index so later
  // `findResource(id)` / `tree(id)` / `rock(id)` / `fishingSpot(id)`
  // lookups from ResourceSystem, TerrainSystem, and ResourceInteractionHandler
  // pick up the new values without a Stop→Play cycle.
  const trees = state.manifests.trees;
  useEffect(() => {
    const session = sessionRef.current;
    if (!session.world || !session.world.isRunning) return;
    if (trees.length === 0) return;
    try {
      const woodcutting = toWoodcuttingManifestInput(trees);
      if (!woodcutting) return;
      session.world.updateManifests({
        woodcutting: woodcutting as unknown as Parameters<
          typeof session.world.updateManifests
        >[0]["woodcutting"],
      });
    } catch (err) {
      console.warn("[PIE] Woodcutting hot-reload skipped:", err);
    }
  }, [trees]);

  const miningRocks = state.manifests.miningRocks;
  useEffect(() => {
    const session = sessionRef.current;
    if (!session.world || !session.world.isRunning) return;
    if (miningRocks.length === 0) return;
    try {
      const mining = toMiningManifestInput(miningRocks);
      if (!mining) return;
      session.world.updateManifests({
        mining: mining as unknown as Parameters<
          typeof session.world.updateManifests
        >[0]["mining"],
      });
    } catch (err) {
      console.warn("[PIE] Mining hot-reload skipped:", err);
    }
  }, [miningRocks]);

  const fishingSpots = state.manifests.fishingSpots;
  useEffect(() => {
    const session = sessionRef.current;
    if (!session.world || !session.world.isRunning) return;
    if (fishingSpots.length === 0) return;
    try {
      const fishing = toFishingManifestInput(fishingSpots);
      if (!fishing) return;
      session.world.updateManifests({
        fishing: fishing as unknown as Parameters<
          typeof session.world.updateManifests
        >[0]["fishing"],
      });
    } catch (err) {
      console.warn("[PIE] Fishing hot-reload skipped:", err);
    }
  }, [fishingSpots]);

  // Skill unlocks: edits to `state.manifests.skillUnlocks` re-run
  // `loadSkillUnlocks` on the runtime side. `getUnlocksForSkill` reads
  // through the mutated `loadedUnlocks` map so level-up unlock strings,
  // ticked skill milestones, and any progression UI hooked into the
  // provider pick up the new text / level on the next query.
  const skillUnlocks = state.manifests.skillUnlocks;
  useEffect(() => {
    const session = sessionRef.current;
    if (!session.world || !session.world.isRunning) return;
    if (skillUnlocks.length === 0) return;
    try {
      const input = toSkillUnlocksManifestInput(skillUnlocks);
      if (!input) return;
      session.world.updateManifests({ skillUnlocks: input });
    } catch (err) {
      console.warn("[PIE] SkillUnlocks hot-reload skipped:", err);
    }
  }, [skillUnlocks]);

  // Ammunition: edits to `state.manifests.ammunition` (arrow rows) are
  // composed with the preserved `ammunitionBowTiers` slice into the full
  // manifest shape the runtime schema requires. `hotReloadAmmunition`
  // clears + rebuilds the mutable `ARROW_DATA` / `BOW_TIERS` records
  // in-place so `AmmunitionService` reads the new bonuses on its next
  // lookup without a Stop → Play cycle.
  const ammunition = state.manifests.ammunition;
  const ammunitionBowTiers = state.manifests.ammunitionBowTiers;
  useEffect(() => {
    const session = sessionRef.current;
    if (!session.world || !session.world.isRunning) return;
    if (ammunition.length === 0) return;
    try {
      const input = toAmmunitionManifestInput(ammunition, ammunitionBowTiers);
      if (!input) return;
      session.world.updateManifests({
        ammunition: input as unknown as Parameters<
          typeof session.world.updateManifests
        >[0]["ammunition"],
      });
    } catch (err) {
      console.warn("[PIE] Ammunition hot-reload skipped:", err);
    }
  }, [ammunition, ammunitionBowTiers]);

  // Stores: edits to `state.manifests.stores` hot-reload into the
  // mutable `GENERAL_STORES` record. `ShopSystem` reads via
  // `getStoreById(id)` / `GENERAL_STORES[id]` at lookup time so price
  // / stock / buyback edits take effect the next time a player opens
  // the shop HUD. Store items are currently authored independently
  // of the items manifest — stock entries that reference
  // non-existent items will simply fail the existing item-lookup
  // guard in the shop code.
  const stores = state.manifests.stores;
  useEffect(() => {
    const session = sessionRef.current;
    if (!session.world || !session.world.isRunning) return;
    if (stores.length === 0) return;
    try {
      const input = toStoresManifestInput(stores);
      if (!input) return;
      session.world.updateManifests({
        stores: input as unknown as Parameters<
          typeof session.world.updateManifests
        >[0]["stores"],
      });
    } catch (err) {
      console.warn("[PIE] Stores hot-reload skipped:", err);
    }
  }, [stores]);

  // Clean up on unmount. `stopPIEInternal` is async but useEffect cleanup
  // is sync — fire-and-forget is fine here because the React tree is
  // already tearing down; we only need the teardown to eventually complete.
  useEffect(() => {
    return () => {
      const refs = sceneRefsRef.current;
      const session = sessionRef.current;
      if (session.world && refs) {
        void stopPIEInternal(session, refs);
      }
    };
  }, []);

  /**
   * Read-only accessor for the session-scoped widget registry. Returns
   * the same instance the plugin contributions populated during start();
   * `null` when PIE is stopped.
   *
   * Returned as a callback (not a state value) because the registry
   * lives on the mutable `sessionRef` — exposing it through React state
   * would require an extra re-render pass on every start/stop. The
   * `<PIEHudOverlay>` consumer reads it once per render, which is fine.
   */
  const getWidgetRegistry = useCallback(() => {
    return sessionRef.current.widgetRegistry;
  }, []);

  /**
   * B0.3 — Snapshot of live player state for the PIE HUD overlay.
   * Polled on each PIEHudOverlay render so widgets bound to
   * `$player.hp` etc. show real values instead of placeholders.
   * Returns `{}` when PIE isn't running.
   */
  const getDataContext = useCallback(() => {
    return sessionRef.current.world?.getDataContext() ?? {};
  }, []);

  return {
    startPIE,
    stopPIE,
    interactAtCenter,
    getWidgetRegistry,
    getDataContext,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function stopPIEInternal(
  session: PIESessionState,
  refs: TerrainSceneRefs,
): Promise<void> {
  // Stop tick loop
  if (session.animationId !== null) {
    cancelAnimationFrame(session.animationId);
    session.animationId = null;
  }

  // Stop the world (detaches controllers + disposes PIE shims, and tears
  // down the ServerNetwork + ClientNetwork loopback). Async because the
  // server's world.destroy is async.
  if (session.world) {
    await session.world.stop();
    session.world = null;
  }

  // Remove markers from scene
  if (session.markerGroup) {
    for (const marker of session.markers.values()) {
      session.markerGroup.remove(marker);
      marker.geometry?.dispose();
    }
    refs.scene.remove(session.markerGroup);
    session.markerGroup = null;
  }
  session.markers.clear();

  // Remove the pawn Object3D if play mode created one.
  if (session.playerObject) {
    refs.scene.remove(session.playerObject);
    session.playerObject = null;
  }

  // Plugin scope disposers already unregistered every contributed
  // widget during `world.stop()`. Drop our reference to the registry
  // so the next start() rebuilds a fresh one with no stale entries.
  session.widgetRegistry = null;

  // Exit player mode (simulate) and restore orbit camera (play).
  if (refs.isPlayerMode()) {
    refs.exitPlayerMode();
  } else {
    refs.setInteractionMode("orbit");
  }

  console.log("[PIE] Session stopped");
}

function createMarker(entity: PIEEntity): THREE.Mesh | null {
  const type = entity.type;
  if (type === "player") return null;

  let geom: THREE.BufferGeometry;
  if (type === "mob" || type === "npc") {
    geom = getCapsuleGeom();
  } else {
    geom = getCylinderGeom();
  }

  const mat =
    type === "mob" ||
    type === "npc" ||
    type === "resource" ||
    type === "station"
      ? getMaterial(type)
      : getMaterial("resource");

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(
    entity.position.x,
    entity.position.y + 0.8,
    entity.position.z,
  );
  mesh.rotation.y = entity.rotation;
  mesh.name = `pie-${entity.id}`;
  mesh.userData.pieEntity = true;
  mesh.userData.entityId = entity.id;
  mesh.userData.entityType = entity.type;
  mesh.userData.entityName = entity.name;

  return mesh;
}
