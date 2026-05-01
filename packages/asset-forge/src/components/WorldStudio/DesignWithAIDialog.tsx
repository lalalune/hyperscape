/**
 * DesignWithAIDialog — conversational onboarding for "Design with AI".
 *
 * Phase B1'.2 of `PLAN_PROJECT_AS_DATA.md`. The user picks "Design
 * with AI" in `NewWorldDialog`; this full-screen overlay opens
 * with a chat where they describe the world they want. After the
 * agent has gathered enough context and emits its plan, the host
 * creates the project with all layers populated and opens it.
 *
 * Today's surface (B1'.2.1):
 *
 *   - Multi-turn chat: user types a prompt, agent responds, user
 *     can refine, agent responds again, etc.
 *   - Each turn POSTs to the existing `/design` endpoint
 *     (port 5180 default). Single-turn-per-call API today.
 *   - When the agent's response includes a `pack` field, the
 *     dialog stores it for project creation.
 *   - "Build my world" button creates a new blank-template project
 *     with the accumulated pack persisted into `worldContent.uiPack`.
 *     Plugin set + terrain reshape are deferred to B1'.2.2 once
 *     the agent server emits those actions.
 *
 * Follow-ups (next slices, captured in PLAN_PROJECT_AS_DATA.md):
 *
 *   - **B1'.2.2** — agent emits `PROPOSE_TERRAIN_CONFIG` +
 *     `PROPOSE_PLUGIN_SET` + `PROPOSE_NPC_PLACEMENT` actions in
 *     one onboarding turn. Dialog applies all of them to the new
 *     project's layers before creation.
 *   - **B1'.2.3** — SSE streaming so the user sees the agent
 *     thinking turn-by-turn instead of a 30-second blank wait.
 *   - **B1'.3** — persistent companion mode after onboarding
 *     completes.
 */

import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Bug,
  Check,
  Circle,
  Layout,
  Loader2,
  Map as MapIcon,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Send,
  Sparkles,
  Swords,
  Trash2,
  Users,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { DEFAULT_CREATION_CONFIG } from "../WorldBuilder/types";
import { generateWorldFromConfig } from "../WorldBuilder/worldGeneration";
import { mergeProcgenConfig } from "./utils/mergeProcgenConfig";
import { serializeWorld } from "../WorldBuilder/utils/worldPersistence";
import {
  createWorldProject,
  patchProjectWorldContent,
  setProjectPlugins,
} from "../../utils/worldProjectApi";
import {
  listInstallableAssetPacks,
  resolveProjectAssetPacks,
  setProjectAssetPacks,
  type InstallablePackSummary,
  type ResolvedProjectAssetPack,
} from "../../utils/assetPackApi";
import { kickoffAssetGeneration } from "../../utils/assetGenApi";

const DEFAULT_DESIGN_ENDPOINT = "http://localhost:5180/design";

/**
 * Aggregated artifacts returned by the agent server's onboarding
 * mode (B1'.2.2). Each field is the LAST successful emission of
 * the corresponding `PROPOSE_*` action over the run.
 */
interface OnboardingPlan {
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
  uiPack: unknown | null;
}

/** Hybrid-UX choice chips (B1'.4) — agent's last OFFER_CHOICES. */
interface OfferedChoicesPayload {
  question: string | null;
  choices: Array<{ label: string; prompt: string }>;
}

interface DesignResponse {
  ok: boolean;
  pack?: unknown;
  finalText?: string;
  turns?: number;
  truncated?: boolean;
  error?: string;
  /** B1'.2.2 — present when the request was sent in onboarding mode. */
  plan?: OnboardingPlan;
  /** B1'.4 — choice chips offered on the last agent turn. */
  choices?: OfferedChoicesPayload | null;
}

/**
 * Manifest id → npm name lookup. The agent server's
 * `proposePluginSetAction` resolves ids to manifest-style
 * (`com.hyperforge.x`) but the project's `plugins` array stores
 * npm-style (`@hyperforge/x`) because that's what
 * `resolveProjectPluginSet` matches against. Translate at this
 * seam.
 */
const MANIFEST_TO_NPM: Record<string, string> = {
  "com.hyperforge.hyperscape": "@hyperforge/hyperscape",
  "com.hyperforge.plugin-shooter-demo": "@hyperforge/plugin-shooter-demo",
};

/** One message in the conversation thread. */
interface ChatMessage {
  readonly role: "user" | "agent" | "system";
  readonly text: string;
  /** Pack emitted on this turn, if any (legacy single-pack surface). */
  readonly pack?: unknown;
  /**
   * B1'.2.2 — full onboarding plan emitted on this turn (terrain
   * config + plugins + NPCs + UI pack). Only the last turn's plan
   * is applied at "Build my world" time.
   */
  readonly plan?: OnboardingPlan;
  /**
   * B1'.4 — choice chips offered on this turn. Only the latest
   * agent message's choices are clickable; older offers are
   * stale-grayed.
   */
  readonly choices?: OfferedChoicesPayload | null;
  /**
   * Tool-call breadcrumbs — what the agent actually did during
   * this turn. Renders as small chips below the message text
   * ("🗺️ Carved north_wilderness", "⚔️ Placed 3 mob spawns").
   * Persists with the message so the user can scroll back and
   * see step-by-step how the project came together.
   */
  readonly toolBreadcrumbs?: ReadonlyArray<{
    readonly icon: string;
    readonly label: string;
  }>;
}

/**
 * Idle-state suggested prompts shown when the conversation is
 * empty. Each renders as a richer card with an emoji, title, and
 * one-line subtitle so the empty state feels like a curated
 * welcome instead of a row of pills.
 */
const IDLE_SUGGESTIONS: ReadonlyArray<{
  emoji: string;
  title: string;
  subtitle: string;
  prompt: string;
}> = [
  {
    emoji: "🏝️",
    title: "Tropical island RPG",
    subtitle: "Village, combat, quest giver",
    prompt:
      "Build me a tropical island RPG with a starter village, basic combat, and a quest giver.",
  },
  {
    emoji: "🏔️",
    title: "Snowy mountains",
    subtitle: "Rugged terrain · exploration",
    prompt:
      "Make a snowy mountain region with rugged terrain, a few NPCs, and exploration-focused gameplay.",
  },
  {
    emoji: "🌑",
    title: "Empty canvas",
    subtitle: "Open terrain, no setup",
    prompt: "Just give me an empty terrain to start exploring on my own.",
  },
  {
    emoji: "🎯",
    title: "Top-down shooter",
    subtitle: "Crosshair HUD · minimal terrain",
    prompt:
      "Build a top-down shooter with a crosshair HUD and minimal terrain.",
  },
];

export interface DesignWithAIDialogProps {
  readonly teamId: string;
  readonly gameId: string;
  readonly onClose: () => void;
  readonly onCreated: (projectId: string) => void;
  /** Override the design endpoint (defaults to localhost:5180/design). */
  readonly endpoint?: string;
}

/**
 * Always-on next-step suggestion chips. Computed from the current
 * effective plan so the user never has to wonder "what's next?".
 * Each chip is a one-click prompt the user can shoot back at the
 * agent. As the agent fills slots the chip set shrinks toward
 * "Build my world".
 *
 * Phase B1'.7 of `PLAN_PROJECT_AS_DATA.md`.
 */
function nextStepChips(plan: OnboardingPlan): Array<{
  label: string;
  prompt: string;
}> {
  const chips: Array<{ label: string; prompt: string }> = [];
  if (plan.pluginIds === null) {
    chips.push({
      label: "Pick a gameplay style",
      prompt:
        "What gameplay plugins should I use? List the choices and pick the best fit.",
    });
  }
  if (plan.terrainConfig === null) {
    chips.push({
      label: "Shape the terrain",
      prompt:
        "Propose a terrain configuration that fits the world we're designing.",
    });
  }
  if (plan.npcs.length === 0) {
    chips.push({
      label: "Add NPCs",
      prompt: "Add 1-3 starter NPCs that fit this world.",
    });
  }
  if (plan.mobSpawns.length === 0) {
    chips.push({
      label: "Place mobs",
      prompt: "Place a few mob spawn points that fit the difficulty curve.",
    });
  }
  if (plan.quests.length === 0) {
    chips.push({
      label: "Add quests",
      prompt: "Author 1-3 starter quests that introduce the gameplay loop.",
    });
  }
  if (plan.uiPack === null) {
    chips.push({
      label: "Design the HUD",
      prompt: "Design a HUD layout that fits the game we're building.",
    });
  }
  return chips;
}

/**
 * The four ordered slots shown in the header progress strip and
 * the right-side plan panel. Centralising the order + labels +
 * icons here keeps both UIs synchronised. Used by Phase B1'.7.
 */
const PLAN_SLOTS: ReadonlyArray<{
  key:
    | "pluginIds"
    | "terrainConfig"
    | "npcs"
    | "mobSpawns"
    | "quests"
    | "uiPack";
  short: string;
  Icon: typeof Boxes;
  emptyPrompt: string;
}> = [
  {
    key: "pluginIds",
    short: "Plugins",
    Icon: Boxes,
    emptyPrompt:
      "What gameplay plugins should I use? List the choices and pick the best fit.",
  },
  {
    key: "terrainConfig",
    short: "Terrain",
    Icon: MapIcon,
    emptyPrompt:
      "Propose a terrain configuration that fits the world we're designing.",
  },
  {
    key: "npcs",
    short: "NPCs",
    Icon: Users,
    emptyPrompt: "Add 1-3 starter NPCs that fit this world.",
  },
  {
    key: "mobSpawns",
    short: "Mobs",
    Icon: Swords,
    emptyPrompt: "Place a few mob spawn points that fit the difficulty curve.",
  },
  {
    key: "quests",
    short: "Quests",
    Icon: ScrollText,
    emptyPrompt: "Author 1-3 starter quests that introduce the gameplay loop.",
  },
  {
    key: "uiPack",
    short: "HUD",
    Icon: Layout,
    emptyPrompt: "Design a HUD layout that fits the game we're building.",
  },
];

function isSlotSet(
  plan: OnboardingPlan,
  key: (typeof PLAN_SLOTS)[number]["key"],
): boolean {
  if (key === "pluginIds")
    return plan.pluginIds !== null && plan.pluginIds.length > 0;
  if (key === "npcs") return plan.npcs.length > 0;
  if (key === "mobSpawns") return plan.mobSpawns.length > 0;
  if (key === "quests") return plan.quests.length > 0;
  if (key === "terrainConfig") return plan.terrainConfig !== null;
  return plan.uiPack !== null;
}

function countSetSlots(plan: OnboardingPlan): number {
  return PLAN_SLOTS.filter((s) => isSlotSet(plan, s.key)).length;
}

function initialGreeting(): ChatMessage {
  return {
    role: "agent",
    text: "Hi! Tell me what kind of world you want to build — or pick a quick-start below. As we chat, the right side will fill up with the project plan.",
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
function buildDebugPlan(): OnboardingPlan {
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
    uiPack: null,
  };
}

// ────────────── SSE streaming (B1'.7) ────────────────────────

interface StreamTurnEvent {
  turn: number;
  assistantText: string;
  toolCalls: ReadonlyArray<{
    name: string;
    success: boolean;
    data: unknown;
  }>;
}

/**
 * Parse one SSE event block (`event: ...\ndata: ...`) into a
 * structured event. Returns null if the block isn't a recognisable
 * event (comment, blank, malformed).
 */
function parseSSEBlock(block: string): { event: string; data: unknown } | null {
  const lines = block.split("\n");
  let eventName = "message";
  let dataStr = "";
  for (const line of lines) {
    if (line.startsWith("event: ")) eventName = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataStr += line.slice(6);
  }
  if (!dataStr) return null;
  try {
    return { event: eventName, data: JSON.parse(dataStr) };
  } catch {
    return null;
  }
}

/**
 * Apply one streamed turn event: update the live status string
 * (so the user sees "Calling LIST_PLUGINS…" instead of just
 * "Thinking…") and incrementally fill effectivePlan with each
 * `PROPOSE_*` tool call's result. NPCs append, so within-run
 * duplicates are reconciled at done-time against the canonical
 * server aggregate.
 */
function applyStreamingTurn(
  detail: StreamTurnEvent,
  setPlan: React.Dispatch<React.SetStateAction<OnboardingPlan>>,
  setStatus: React.Dispatch<React.SetStateAction<string | null>>,
  priorNpcs: ReadonlyArray<unknown>,
): void {
  // Surface the most recent tool name as the live status.
  if (detail.toolCalls.length > 0) {
    const last = detail.toolCalls[detail.toolCalls.length - 1]!;
    setStatus(prettifyToolName(last.name));
  } else if (detail.assistantText) {
    setStatus("Drafting reply…");
  }

  for (const call of detail.toolCalls) {
    if (!call.success || !call.data) continue;
    const data = call.data as Record<string, unknown>;
    switch (call.name) {
      case "PROPOSE_TERRAIN_CONFIG":
        if (data.config !== undefined) {
          setPlan((p) => ({
            ...p,
            terrainConfig: data.config as Record<string, unknown>,
          }));
        }
        break;
      case "PROPOSE_PLUGIN_SET":
        if (Array.isArray(data.pluginIds)) {
          const ids = (data.pluginIds as unknown[]).filter(
            (x): x is string => typeof x === "string",
          );
          setPlan((p) => ({ ...p, pluginIds: ids }));
        }
        break;
      case "PROPOSE_NPC_PLACEMENT":
        if (data.entity !== undefined) {
          // Append; reconciled at done.
          setPlan((p) => ({ ...p, npcs: [...p.npcs, data.entity] }));
        }
        break;
      case "PROPOSE_MOB_SPAWN":
        if (data.spawn !== undefined) {
          setPlan((p) => ({ ...p, mobSpawns: [...p.mobSpawns, data.spawn] }));
        }
        break;
      case "PROPOSE_QUEST":
        if (data.quest !== undefined) {
          setPlan((p) => ({ ...p, quests: [...p.quests, data.quest] }));
        }
        break;
      case "PROPOSE_ASSET":
        if (data.asset !== undefined) {
          setPlan((p) => ({ ...p, assets: [...p.assets, data.asset] }));
        }
        break;
      case "PROPOSE_ZONE":
        if (data.zone !== undefined) {
          setPlan((p) => ({ ...p, zones: [...p.zones, data.zone] }));
        }
        break;
      case "PROPOSE_RESOURCE":
        if (data.resource !== undefined) {
          setPlan((p) => ({
            ...p,
            resources: [...p.resources, data.resource],
          }));
        }
        break;
      case "PROPOSE_STATION":
        if (data.station !== undefined) {
          setPlan((p) => ({
            ...p,
            stations: [...p.stations, data.station],
          }));
        }
        break;
      case "PROPOSE_TELEPORT":
        if (data.teleport !== undefined) {
          setPlan((p) => ({
            ...p,
            teleports: [...p.teleports, data.teleport],
          }));
        }
        break;
      case "PROPOSE_ASSET_PACK_INSTALL":
        if (Array.isArray(data.assetPackIds)) {
          // Additive merge — multiple PROPOSE_ASSET_PACK_INSTALL
          // turns over a conversation should accumulate.
          const incoming = (data.assetPackIds as unknown[]).filter(
            (x): x is string => typeof x === "string",
          );
          setPlan((p) => {
            const merged = new Set([...(p.assetPackIds ?? []), ...incoming]);
            return { ...p, assetPackIds: Array.from(merged) };
          });
        }
        break;
      case "REMOVE_FROM_PROJECT":
        if (data.removal !== undefined) {
          // A4 — apply the removal to the streaming aggregate so
          // the right pane updates live. Server's done-event will
          // also have the cleaned aggregate; this is just
          // optimistic UI.
          const removal = data.removal as {
            kind: string;
            id?: string;
            mobId?: string;
            resourceId?: string;
            position?: { x: number; y: number; z: number };
          };
          setPlan((p) => {
            switch (removal.kind) {
              case "npc":
                return {
                  ...p,
                  npcs: p.npcs.filter(
                    (n) => (n as { id?: string }).id !== removal.id,
                  ),
                };
              case "quest":
                return {
                  ...p,
                  quests: p.quests.filter(
                    (q) => (q as { id?: string }).id !== removal.id,
                  ),
                };
              case "zone":
                return {
                  ...p,
                  zones: p.zones.filter(
                    (z) => (z as { id?: string }).id !== removal.id,
                  ),
                };
              case "station":
                return {
                  ...p,
                  stations: p.stations.filter(
                    (s) => (s as { id?: string }).id !== removal.id,
                  ),
                };
              case "teleport":
                return {
                  ...p,
                  teleports: p.teleports.filter(
                    (t) => (t as { id?: string }).id !== removal.id,
                  ),
                };
              case "asset":
                return {
                  ...p,
                  assets: p.assets.filter(
                    (a) => (a as { name?: string }).name !== removal.id,
                  ),
                };
              case "mobSpawn":
                return {
                  ...p,
                  mobSpawns: p.mobSpawns.filter((s) => {
                    const o = s as {
                      mobId?: string;
                      position?: { x?: number; y?: number; z?: number };
                    };
                    return !(
                      o.mobId === removal.mobId &&
                      o.position?.x === removal.position?.x &&
                      o.position?.y === removal.position?.y &&
                      o.position?.z === removal.position?.z
                    );
                  }),
                };
              case "resource":
                return {
                  ...p,
                  resources: p.resources.filter((r) => {
                    const o = r as {
                      resourceId?: string;
                      position?: { x?: number; y?: number; z?: number };
                    };
                    return !(
                      o.resourceId === removal.resourceId &&
                      o.position?.x === removal.position?.x &&
                      o.position?.y === removal.position?.y &&
                      o.position?.z === removal.position?.z
                    );
                  }),
                };
              default:
                return p;
            }
          });
        }
        break;
      case "PROPOSE_UI_PACK":
        if (data.pack !== undefined) {
          setPlan((p) => ({ ...p, uiPack: data.pack }));
        }
        break;
      default:
        break;
    }
  }
  // priorNpcs is referenced for reconciliation at the call-site;
  // unused inside this helper but kept in the signature for
  // discoverability.
  void priorNpcs;
}

/**
 * Convert an action name like `LIST_GAME_WIDGETS` into a human
 * status string like "Listing widgets…".
 */
function prettifyToolName(name: string): string {
  switch (name) {
    case "LIST_PLUGINS":
      return "Looking up plugins…";
    case "GET_PLUGIN":
      return "Inspecting a plugin…";
    case "LIST_GAME_WIDGETS":
      return "Listing widgets…";
    case "SEARCH_GAME_WIDGETS":
      return "Searching widgets…";
    case "GET_GAME_WIDGET":
      return "Inspecting a widget…";
    case "GET_CATALOG_STATS":
      return "Reading catalog stats…";
    case "PROPOSE_TERRAIN_CONFIG":
      return "Shaping the terrain…";
    case "PROPOSE_PLUGIN_SET":
      return "Picking a plugin set…";
    case "PROPOSE_NPC_PLACEMENT":
      return "Placing an NPC…";
    case "PROPOSE_MOB_SPAWN":
      return "Placing a mob spawn…";
    case "PROPOSE_QUEST":
      return "Authoring a quest…";
    case "PROPOSE_ASSET":
      return "Designing a new asset…";
    case "PROPOSE_ZONE":
      return "Carving a zone…";
    case "PROPOSE_RESOURCE":
      return "Placing a resource…";
    case "PROPOSE_STATION":
      return "Placing a station…";
    case "PROPOSE_TELEPORT":
      return "Placing a teleport…";
    case "PROPOSE_ASSET_PACK_INSTALL":
      return "Picking asset packs…";
    case "LIST_ENTITY_TYPES":
      return "Listing entity types…";
    case "LIST_ASSET_PACKS":
      return "Listing asset packs…";
    case "REMOVE_FROM_PROJECT":
      return "Removing an entity…";
    case "GET_PROJECT_STATE":
      return "Reviewing the project…";
    case "PROPOSE_UI_PACK":
      return "Drafting the HUD…";
    case "OFFER_CHOICES":
      return "Offering choices…";
    default:
      return `Running ${name}…`;
  }
}

/**
 * Roll a tool-call tally into a list of compact human chips.
 *
 *   PROPOSE_MOB_SPAWN × 3 → "⚔️ Placed 3 mob spawns"
 *   PROPOSE_QUEST × 1     → "📜 Wrote 1 quest"
 *   GET_PROJECT_STATE × 2 → (omitted — discovery isn't worth a chip)
 *
 * Discovery tools (LIST/GET/SEARCH/CATALOG) are filtered out —
 * they're noise from the user's perspective. PROPOSE_* and
 * REMOVE_FROM_PROJECT survive.
 */
function summarizeToolCalls(
  tally: Map<string, number>,
): ReadonlyArray<{ icon: string; label: string }> {
  const out: Array<{ icon: string; label: string }> = [];
  for (const [name, count] of tally) {
    const summary = TOOL_BREADCRUMB_SUMMARY[name];
    if (!summary) continue; // skip discovery tools
    out.push({
      icon: summary.icon,
      label: summary.label(count),
    });
  }
  return out;
}

const TOOL_BREADCRUMB_SUMMARY: Record<
  string,
  { icon: string; label: (count: number) => string }
> = {
  PROPOSE_TERRAIN_CONFIG: {
    icon: "🗺️",
    label: () => "Shaped the terrain",
  },
  PROPOSE_PLUGIN_SET: {
    icon: "🧩",
    label: () => "Picked plugins",
  },
  PROPOSE_NPC_PLACEMENT: {
    icon: "👤",
    label: (n) => `Placed ${n} NPC${n === 1 ? "" : "s"}`,
  },
  PROPOSE_MOB_SPAWN: {
    icon: "⚔️",
    label: (n) => `Placed ${n} mob spawn${n === 1 ? "" : "s"}`,
  },
  PROPOSE_QUEST: {
    icon: "📜",
    label: (n) => `Wrote ${n} quest${n === 1 ? "" : "s"}`,
  },
  PROPOSE_ZONE: {
    icon: "🌍",
    label: (n) => `Carved ${n} zone${n === 1 ? "" : "s"}`,
  },
  PROPOSE_RESOURCE: {
    icon: "🪵",
    label: (n) => `Placed ${n} resource${n === 1 ? "" : "s"}`,
  },
  PROPOSE_STATION: {
    icon: "🛠️",
    label: (n) => `Placed ${n} station${n === 1 ? "" : "s"}`,
  },
  PROPOSE_TELEPORT: {
    icon: "🌀",
    label: (n) => `Placed ${n} teleport${n === 1 ? "" : "s"}`,
  },
  PROPOSE_ASSET_PACK_INSTALL: {
    icon: "📦",
    label: (n) => `Picked ${n} asset pack${n === 1 ? "" : "s"}`,
  },
  PROPOSE_ASSET: {
    icon: "✨",
    label: (n) => `Queued ${n} asset bake${n === 1 ? "" : "s"}`,
  },
  PROPOSE_UI_PACK: {
    icon: "🎛️",
    label: () => "Designed the HUD",
  },
  REMOVE_FROM_PROJECT: {
    icon: "🗑️",
    label: (n) => `Removed ${n} ${n === 1 ? "entity" : "entities"}`,
  },
};

// ────────────── Draft persistence (B1'.7) ────────────────────
//
// Persisting (messages + plan) to localStorage means a stray
// refresh — or accidentally closing the dialog — doesn't lose
// the user's onboarding work. Keyed by team + game so multiple
// projects don't trample each other.

const DRAFT_VERSION = 1;

interface DesignDraft {
  readonly version: number;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly plan: OnboardingPlan;
}

function draftKey(teamId: string, gameId: string): string {
  return `hyperforge:design-with-ai:draft:${teamId}:${gameId}`;
}

function loadDraft(teamId: string, gameId: string): DesignDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(teamId, gameId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DesignDraft> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== DRAFT_VERSION ||
      !Array.isArray(parsed.messages) ||
      !parsed.plan
    ) {
      return null;
    }
    return parsed as DesignDraft;
  } catch {
    return null;
  }
}

function saveDraft(
  teamId: string,
  gameId: string,
  messages: ReadonlyArray<ChatMessage>,
  plan: OnboardingPlan,
): void {
  if (typeof window === "undefined") return;
  try {
    const draft: DesignDraft = { version: DRAFT_VERSION, messages, plan };
    window.localStorage.setItem(
      draftKey(teamId, gameId),
      JSON.stringify(draft),
    );
  } catch {
    // localStorage may be disabled (Safari private mode etc.) —
    // best-effort persistence, don't crash the UI.
  }
}

function clearDraft(teamId: string, gameId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(teamId, gameId));
  } catch {
    /* ignore */
  }
}

export function DesignWithAIDialog({
  teamId,
  gameId,
  onClose,
  onCreated,
  endpoint = DEFAULT_DESIGN_ENDPOINT,
}: DesignWithAIDialogProps) {
  // B1'.7 — restore a saved draft (messages + plan) so a refresh
  // or accidental close doesn't lose the user's onboarding work.
  const restored = (() => {
    const d = loadDraft(teamId, gameId);
    if (!d) return null;
    // Discard a draft that's just the empty greeting — no signal
    // worth persisting.
    if (d.messages.length <= 1) return null;
    return d;
  })();

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    restored ? [...restored.messages] : [initialGreeting()],
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  /**
   * B1'.7 — short live status string while a turn is in flight,
   * driven by SSE `turn` events. Examples: "Calling LIST_PLUGINS…",
   * "Picking widgets…", "Drafting plan…". Falls back to plain
   * "Thinking…" when no event has arrived yet.
   */
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * B1'.7 — tracks the most recent prompt that errored so the
   * "Retry" button can re-send it. Cleared on success.
   */
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  /**
   * B1'.7 — flagged when we boot from a saved draft. Drives a
   * one-shot banner so the user knows their conversation was
   * restored. Clears on any state change (sending, start over).
   */
  const [restoredFromDraft, setRestoredFromDraft] = useState(restored !== null);
  /**
   * B1'.5 — the effective plan the user has accumulated. Agent
   * emissions overwrite this state on each turn; user removals
   * (via the preview panel's × buttons) mutate it directly.
   * Build uses this state, not the latest message's plan.
   */
  const [effectivePlan, setEffectivePlan] = useState<OnboardingPlan>(() =>
    restored
      ? {
          terrainConfig: restored.plan.terrainConfig ?? null,
          pluginIds: restored.plan.pluginIds ?? null,
          assetPackIds: Array.isArray(restored.plan.assetPackIds)
            ? [...restored.plan.assetPackIds]
            : null,
          npcs: Array.isArray(restored.plan.npcs)
            ? [...restored.plan.npcs]
            : [],
          mobSpawns: Array.isArray(restored.plan.mobSpawns)
            ? [...restored.plan.mobSpawns]
            : [],
          quests: Array.isArray(restored.plan.quests)
            ? [...restored.plan.quests]
            : [],
          assets: Array.isArray(restored.plan.assets)
            ? [...restored.plan.assets]
            : [],
          zones: Array.isArray(restored.plan.zones)
            ? [...restored.plan.zones]
            : [],
          resources: Array.isArray(restored.plan.resources)
            ? [...restored.plan.resources]
            : [],
          stations: Array.isArray(restored.plan.stations)
            ? [...restored.plan.stations]
            : [],
          teleports: Array.isArray(restored.plan.teleports)
            ? [...restored.plan.teleports]
            : [],
          uiPack: restored.plan.uiPack ?? null,
        }
      : {
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
          uiPack: null,
        },
  );
  const [rightTab, setRightTab] = useState<"plan" | "blocks">("plan");
  const abortRef = useRef<AbortController | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  // Pre-fetch the catalog of installable asset packs (built-in
  // Hyperia packs + the team's published packs). Without this the
  // agent's auto-fill helper has no `assetPacks` to pick from in
  // the projectContext we send, so every PROPOSE_NPC / MOB / etc.
  // arrives without an assetRef and the renderer falls back to a
  // placeholder cube. The cost is one round-trip on dialog mount.
  const [installablePacks, setInstallablePacks] = useState<
    InstallablePackSummary[]
  >([]);
  const [resolvedPacks, setResolvedPacks] = useState<
    ResolvedProjectAssetPack[]
  >([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const installable = await listInstallableAssetPacks(teamId);
        if (cancelled) return;
        setInstallablePacks(installable);
        // Resolve the full catalog so projectContext.assetPacks
        // has the entry-level data the agent needs to pick refs
        // (each pack's `assets[]` with id + type + subtype).
        const resolved = await resolveProjectAssetPacks(
          installable.map((p) => p.manifestId),
        );
        if (cancelled) return;
        setResolvedPacks(resolved);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "[DesignWithAIDialog] Failed to fetch installable packs " +
            "(agent auto-fill will be limited):",
          err,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  // B1'.7 — persist (messages + plan) to localStorage so a stray
  // refresh doesn't lose the user's onboarding work. Skip while
  // the project is being created (the dialog is about to unmount).
  useEffect(() => {
    if (isCreatingProject) return;
    // Only persist once the user has actually engaged. The bare
    // greeting alone isn't worth a draft.
    if (messages.length <= 1) {
      clearDraft(teamId, gameId);
      return;
    }
    saveDraft(teamId, gameId, messages, effectivePlan);
  }, [teamId, gameId, messages, effectivePlan, isCreatingProject]);

  // Auto-scroll to the bottom whenever a new message arrives.
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending]);

  /**
   * Convenience pointer used by the "Build" button gate. The
   * preview panel reads `effectivePlan` directly.
   */
  const latestPlan: OnboardingPlan | null = hasAnyPlanContent(effectivePlan)
    ? effectivePlan
    : null;

  /**
   * Core send. Used by:
   *   - the textarea's submit (text from `input` state)
   *   - choice chip clicks (text from chip's `prompt`)
   *   - idle-suggestion clicks (text from suggestion's `prompt`)
   */
  const sendPrompt = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;

      // B1'.7 — system prompt on the server now owns onboarding
      // workflow (incremental emission, hard rules), so we just
      // forward the user's text verbatim each turn.
      const promptForAgent = trimmed;

      setRestoredFromDraft(false);
      setMessages((m) => [...m, { role: "user", text: trimmed }]);
      setInput("");
      setPending(true);
      setError(null);

      // B1'.7 — send full conversation history so the agent has
      // continuity across turns. Without this each request was
      // amnesiac and the agent could only emit PROPOSE_* in a
      // single batch on the final turn — which is why the right
      // pane stayed empty until the very end.
      const history = messages.map((m) => ({
        role: m.role === "agent" ? ("assistant" as const) : ("user" as const),
        text: m.text,
      }));

      abortRef.current = new AbortController();
      // B1'.7 / A2 — snapshot prior-turn NPCs and mob spawns so
      // the final merge can compose [prior + this-run-canonical]
      // without duplicating entries the agent re-emitted within
      // this run.
      const priorNpcs = effectivePlan.npcs;
      const priorMobSpawns = effectivePlan.mobSpawns;
      const priorQuests = effectivePlan.quests;
      const priorAssets = effectivePlan.assets;
      const priorZones = effectivePlan.zones;
      const priorResources = effectivePlan.resources;
      const priorStations = effectivePlan.stations;
      const priorTeleports = effectivePlan.teleports;
      const priorAssetPackIds = effectivePlan.assetPackIds;
      let finalResponse: DesignResponse | null = null;
      let streamErrored: { message: string } | null = null;
      // Tally tool calls across the turn so the agent message can
      // render compact breadcrumbs ("⚔️ Placed 3 mob spawns").
      const toolCallTally = new Map<string, number>();
      try {
        // Pre-onboarding projectContext — there's no project yet,
        // but the agent's `autoFillAssetRef` and `validateAssetRef`
        // helpers expect `assetPacks` to know what's available.
        // Sending the full installable catalog as `assetPacks` lets
        // them resolve refs against the built-in Hyperia packs from
        // turn 1. At Generate time we install whichever packs the
        // emitted entities actually referenced.
        const projectContext = {
          plugins: effectivePlan.pluginIds ?? [],
          assetPacks: resolvedPacks,
        };
        const res = await fetch(`${endpoint}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptForAgent,
            mode: "onboarding",
            history,
            projectContext,
            installableAssetPacks: installablePacks,
          }),
          signal: abortRef.current.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sepIdx: number;
          while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);
            const parsed = parseSSEBlock(block);
            if (!parsed) continue;
            if (parsed.event === "turn") {
              const turnEvent = parsed.data as StreamTurnEvent;
              applyStreamingTurn(
                turnEvent,
                setEffectivePlan,
                setPendingStatus,
                priorNpcs,
              );
              for (const call of turnEvent.toolCalls) {
                if (!call.success) continue;
                toolCallTally.set(
                  call.name,
                  (toolCallTally.get(call.name) ?? 0) + 1,
                );
              }
            } else if (parsed.event === "done") {
              finalResponse = parsed.data as DesignResponse;
            } else if (parsed.event === "error") {
              streamErrored = parsed.data as { message: string };
            }
          }
        }

        if (streamErrored) {
          throw new Error(streamErrored.message);
        }
        if (!finalResponse || !finalResponse.ok) {
          throw new Error(
            (finalResponse as { error?: string })?.error ??
              "Stream ended without result",
          );
        }

        const planEmitted =
          finalResponse.plan && hasAnyPlanContent(finalResponse.plan);
        const finalText =
          finalResponse.finalText && finalResponse.finalText.length > 0
            ? finalResponse.finalText
            : planEmitted
              ? "I've drafted your project plan. Click 'Build my world' when you're ready."
              : "(no response)";

        setMessages((m) => [
          ...m,
          {
            role: "agent",
            text: finalText,
            pack: finalResponse!.pack,
            plan: finalResponse!.plan,
            choices: finalResponse!.choices ?? null,
            toolBreadcrumbs: summarizeToolCalls(toolCallTally),
          },
        ]);

        // B1'.7 — reconcile streaming-state with server's
        // canonical aggregate. Single-value slots: trust server's
        // last-emission. NPCs: prior turns + this run's canonical
        // (server already deduplicated within-run re-emissions).
        const finalPlan = finalResponse.plan;
        if (finalPlan) {
          const finalMobSpawns = (finalPlan as { mobSpawns?: unknown[] })
            .mobSpawns;
          const finalQuests = (finalPlan as { quests?: unknown[] }).quests;
          const finalAssets = (finalPlan as { assets?: unknown[] }).assets;
          const finalZones = (finalPlan as { zones?: unknown[] }).zones;
          const finalResources = (finalPlan as { resources?: unknown[] })
            .resources;
          const finalStations = (finalPlan as { stations?: unknown[] })
            .stations;
          const finalTeleports = (finalPlan as { teleports?: unknown[] })
            .teleports;
          const finalAssetPackIds = (
            finalPlan as { assetPackIds?: string[] | null }
          ).assetPackIds;
          setEffectivePlan((prev) => ({
            terrainConfig:
              finalPlan.terrainConfig !== null
                ? finalPlan.terrainConfig
                : prev.terrainConfig,
            pluginIds:
              finalPlan.pluginIds !== null
                ? [...finalPlan.pluginIds]
                : prev.pluginIds,
            assetPackIds:
              Array.isArray(finalAssetPackIds) && finalAssetPackIds.length > 0
                ? Array.from(
                    new Set([
                      ...(priorAssetPackIds ?? []),
                      ...finalAssetPackIds,
                    ]),
                  )
                : prev.assetPackIds,
            npcs:
              finalPlan.npcs.length > 0
                ? [...priorNpcs, ...finalPlan.npcs]
                : prev.npcs,
            mobSpawns:
              Array.isArray(finalMobSpawns) && finalMobSpawns.length > 0
                ? [...priorMobSpawns, ...finalMobSpawns]
                : prev.mobSpawns,
            quests:
              Array.isArray(finalQuests) && finalQuests.length > 0
                ? [...priorQuests, ...finalQuests]
                : prev.quests,
            assets:
              Array.isArray(finalAssets) && finalAssets.length > 0
                ? [...priorAssets, ...finalAssets]
                : prev.assets,
            zones:
              Array.isArray(finalZones) && finalZones.length > 0
                ? [...priorZones, ...finalZones]
                : prev.zones,
            resources:
              Array.isArray(finalResources) && finalResources.length > 0
                ? [...priorResources, ...finalResources]
                : prev.resources,
            stations:
              Array.isArray(finalStations) && finalStations.length > 0
                ? [...priorStations, ...finalStations]
                : prev.stations,
            teleports:
              Array.isArray(finalTeleports) && finalTeleports.length > 0
                ? [...priorTeleports, ...finalTeleports]
                : prev.teleports,
            uiPack: finalPlan.uiPack !== null ? finalPlan.uiPack : prev.uiPack,
          }));
        }
        // B1'.7 — turn succeeded; clear retry state.
        setLastFailedPrompt(null);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled — no error to surface.
        } else {
          setError(err instanceof Error ? err.message : String(err));
          // B1'.7 — remember the prompt so the user can retry.
          setLastFailedPrompt(trimmed);
        }
      } finally {
        abortRef.current = null;
        setPending(false);
        setPendingStatus(null);
      }
    },
    [endpoint, messages, pending, effectivePlan.npcs],
  );

  /**
   * B1'.7 — retry the most recent failed turn. Pops the user's
   * message bubble (since `sendPrompt` will re-add it) and resends
   * the same text. No-op if nothing has failed yet.
   */
  const retryLast = useCallback(async () => {
    if (!lastFailedPrompt || pending || isCreatingProject) return;
    // Pop the trailing user message — sendPrompt appends a fresh
    // one. Without this we'd duplicate it in the UI.
    setMessages((m) => {
      const last = m[m.length - 1];
      if (last && last.role === "user") return m.slice(0, -1);
      return m;
    });
    setError(null);
    await sendPrompt(lastFailedPrompt);
  }, [lastFailedPrompt, pending, isCreatingProject, sendPrompt]);

  /**
   * B1'.7 — wipe conversation, plan, and any error state. Used
   * by the "Start over" button in the header. Aborts any pending
   * request so we don't accidentally append a stale agent reply
   * after the reset.
   */
  const startOver = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([initialGreeting()]);
    setEffectivePlan({
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
      uiPack: null,
    });
    setInput("");
    setError(null);
    setLastFailedPrompt(null);
    setRightTab("plan");
    setPending(false);
    clearDraft(teamId, gameId);
  }, [teamId, gameId]);

  /**
   * Debug — load a hardcoded fully-populated plan without calling
   * the LLM. Lets us iterate on the build pipeline (procgen,
   * worldContent persistence, viewport rendering, outliner) using
   * ZERO API credits. Adds a system message so the user can see
   * what was loaded.
   */
  const loadDebugPlan = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setEffectivePlan(buildDebugPlan());
    setMessages((m) => [
      ...m,
      {
        role: "agent",
        text:
          "🐛 Debug plan loaded — terrain seeded (50×50, island), Hyperia plugin set, " +
          "4 asset packs, 3 NPCs, 5 mob spawns, 1 quest, 1 zone, 2 resources, 2 stations, " +
          "1 teleport. Click 'Generate world' to test the build pipeline end-to-end without an LLM call.",
        toolBreadcrumbs: [
          { icon: "🗺️", label: "Shaped the terrain" },
          { icon: "🧩", label: "Picked plugins" },
          { icon: "📦", label: "Picked 4 asset packs" },
          { icon: "👤", label: "Placed 3 NPCs" },
          { icon: "⚔️", label: "Placed 5 mob spawns" },
          { icon: "📜", label: "Wrote 1 quest" },
          { icon: "🌍", label: "Carved 1 zone" },
          { icon: "🪵", label: "Placed 2 resources" },
          { icon: "🛠️", label: "Placed 2 stations" },
          { icon: "🌀", label: "Placed 1 teleport" },
        ],
      },
    ]);
    setError(null);
    setLastFailedPrompt(null);
  }, []);

  /**
   * Submit handler for the textarea form. Pulls text from the
   * `input` state (typed by user) and forwards to `sendPrompt`.
   */
  const sendMessage = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      await sendPrompt(input);
    },
    [input, sendPrompt],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const buildWorld = useCallback(async () => {
    setIsCreatingProject(true);
    setError(null);

    try {
      // B1'.2.2 — apply the agent's full plan across the four
      // typed-layer slots:
      //   - terrain config → procgen base config (knobs from agent
      //                       overlaid on DEFAULT_CREATION_CONFIG
      //                       so vegetation + towns + biomes work
      //                       out of the box; agent's overrides
      //                       win field-by-field via deep-merge).
      //   - plugins        → translated to npm-style ids and
      //                       persisted in `Project.plugins[]`
      //                       via the worldContent patch (templates
      //                       store plugins on the typed column;
      //                       the patch endpoint accepts plugins
      //                       too in B0'.G semantics).
      //   - npcs           → `worldContent.npcs[]`
      //   - uiPack         → `worldContent.uiPack`
      const summary = summariseConversation(messages);
      const projectName = summary.name ?? "AI-Designed Project";
      const projectDescription =
        summary.description ?? "Created via Design with AI onboarding.";

      // Deep-merge agent's terrain knobs over the rich Hyperia
      // default. Vegetation enabled, towns enabled, biomes
      // distributed. BLANK_CREATION_CONFIG explicitly disables
      // vegetation + sets townCount=0 — it's the "empty template"
      // base; not what the agent wants when building a Hyperia-
      // style world. Shallow spread silently corrupts nested
      // objects (terrain, biomes, etc.); deep-merge preserves
      // sibling fields. See mergeProcgenConfig for the full story.
      const seed = Math.floor(Math.random() * 2147483647);
      const agentTerrain = (effectivePlan.terrainConfig ?? {}) as Record<
        string,
        unknown
      >;
      const resolvedSeed =
        typeof agentTerrain.seed === "number" ? agentTerrain.seed : seed;
      const procgenConfig = mergeProcgenConfig(
        DEFAULT_CREATION_CONFIG as unknown as Record<string, unknown>,
        agentTerrain,
        resolvedSeed,
      ) as unknown as Parameters<typeof generateWorldFromConfig>[0];

      const worldData = await new Promise<ReturnType<typeof serializeWorld>>(
        (resolve, reject) => {
          setTimeout(() => {
            try {
              const world = generateWorldFromConfig(procgenConfig);
              resolve(serializeWorld(world));
            } catch (err) {
              reject(err);
            }
          }, 50);
        },
      );

      const project = await createWorldProject({
        teamId,
        gameId,
        name: projectName,
        description: projectDescription,
        templateId: "blank",
        worldData,
      });

      // Build the worldContent patch from the plan's content +
      // plugin slots. The server's `patchWorldContent` merges these
      // into the project; null entries delete keys.
      const patch: Record<string, unknown> = {};
      if (effectivePlan.npcs.length > 0) {
        patch.npcs = effectivePlan.npcs;
      }
      if (effectivePlan.mobSpawns.length > 0) {
        patch.spawns = effectivePlan.mobSpawns;
      }
      if (effectivePlan.quests.length > 0) {
        patch.quests = effectivePlan.quests;
      }
      if (effectivePlan.zones.length > 0) {
        patch.zones = effectivePlan.zones;
      }
      if (effectivePlan.resources.length > 0) {
        patch.resources = effectivePlan.resources;
      }
      if (effectivePlan.stations.length > 0) {
        patch.stations = effectivePlan.stations;
      }
      if (effectivePlan.teleports.length > 0) {
        patch.teleports = effectivePlan.teleports;
      }
      if (effectivePlan.uiPack) {
        patch.uiPack = effectivePlan.uiPack;
      }
      if (Object.keys(patch).length > 0) {
        try {
          await patchProjectWorldContent(project.id, patch);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(
            "[DesignWithAIDialog] worldContent patch failed (project still created):",
            err,
          );
        }
      }

      // Asset packs the agent recommended (PROPOSE_ASSET_PACK_INSTALL)
      // PLUS any pack referenced by an entity's assetRef. The agent's
      // auto-fill picks refs from the projectContext.assetPacks we
      // sent (full installable catalog), so those packs need to be
      // actually installed on the new project for the renderer to
      // resolve them post-Generate. Walk every entity slot, extract
      // pack ids from assetRefs, dedupe, and install.
      const refPackIds = new Set<string>(effectivePlan.assetPackIds ?? []);
      const collectRefs = (entries: ReadonlyArray<unknown>): void => {
        for (const e of entries) {
          const ref = (e as { assetRef?: unknown })?.assetRef;
          if (typeof ref !== "string") continue;
          const slash = ref.lastIndexOf("/");
          if (slash > 0) refPackIds.add(ref.slice(0, slash));
        }
      };
      collectRefs(effectivePlan.npcs);
      collectRefs(effectivePlan.mobSpawns);
      collectRefs(effectivePlan.resources);
      collectRefs(effectivePlan.stations);
      collectRefs(effectivePlan.teleports);
      const allPackIds = Array.from(refPackIds);
      if (allPackIds.length > 0) {
        try {
          await setProjectAssetPacks(project.id, allPackIds);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(
            "[DesignWithAIDialog] asset-pack install failed (project still created):",
            err,
          );
        }
      }

      // Plugins land on the project's typed `plugins` column via
      // `POST /api/world/projects/:id/plugins`. Manifest ids
      // (`com.hyperforge.x`) are translated to npm ids
      // (`@hyperforge/x`) at this seam — that's what
      // `resolveProjectPluginSet` matches against. Soft-fails
      // (project still created) on error.
      if (effectivePlan.pluginIds && effectivePlan.pluginIds.length > 0) {
        const npmIds = effectivePlan.pluginIds.map(
          (id) => MANIFEST_TO_NPM[id] ?? id,
        );
        try {
          await setProjectPlugins(project.id, npmIds);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(
            "[DesignWithAIDialog] plugin install failed (project still created):",
            err,
          );
        }
      }

      // A5 — fire any asset bakes the agent proposed. Don't await
      // them; the bakes are minutes-long and the user shouldn't be
      // gated on them. Errors land in the console.
      if (effectivePlan.assets.length > 0) {
        for (const proposal of effectivePlan.assets) {
          void kickoffAssetGeneration(
            proposal as Parameters<typeof kickoffAssetGeneration>[0],
          ).then(
            (kickoff) => {
              // eslint-disable-next-line no-console
              console.info(
                "[DesignWithAIDialog] Asset bake started:",
                kickoff.assetId,
                "pipelineId=",
                kickoff.pipelineId,
              );
            },
            (err: unknown) => {
              // eslint-disable-next-line no-console
              console.warn(
                "[DesignWithAIDialog] Asset bake kickoff failed:",
                err,
              );
            },
          );
        }
      }

      // B1'.7 — wipe the draft now that the project exists.
      // Keeps stale onboarding chatter out of the next session.
      clearDraft(teamId, gameId);
      onCreated(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsCreatingProject(false);
    }
  }, [teamId, gameId, messages, effectivePlan, onCreated]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/70 backdrop-blur-md design-ai-backdrop-in"
      role="dialog"
      aria-modal="true"
    >
      <style>{`
        @keyframes designAiFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .design-ai-fade-up { animation: designAiFadeUp 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }

        @keyframes designAiPanelIn {
          from { opacity: 0; transform: translateY(12px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .design-ai-panel-in { animation: designAiPanelIn 280ms cubic-bezier(0.16, 0.84, 0.32, 1) both; }

        @keyframes designAiBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .design-ai-backdrop-in { animation: designAiBackdropIn 200ms ease-out both; }

        /* Refined thin scrollbars inside the dialog. */
        .design-ai-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .design-ai-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .design-ai-scrollbar::-webkit-scrollbar-thumb {
          background: var(--surface-highlight, rgba(255,255,255,0.08));
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .design-ai-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.18);
          background-clip: padding-box;
        }
      `}</style>
      <div className="w-full max-w-6xl flex flex-col bg-bg-primary border-x border-white/[0.06] shadow-2xl design-ai-panel-in">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="bg-gradient-to-b from-bg-secondary/60 to-transparent">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-1 ring-primary/30 shadow-sm shadow-primary/20">
                <Sparkles size={16} className="text-primary" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-text-primary leading-tight">
                  Design with AI
                </div>
                <div className="text-[12px] text-text-tertiary mt-0.5">
                  {countSetSlots(effectivePlan) === 0
                    ? "Describe the world you want — I'll handle the rest."
                    : countSetSlots(effectivePlan) === PLAN_SLOTS.length
                      ? "All four slots set. Ready to generate."
                      : `${countSetSlots(effectivePlan)} of ${PLAN_SLOTS.length} slots set.`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={loadDebugPlan}
                disabled={isCreatingProject}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-md text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                title="Fill the plan with hardcoded sample content (no LLM call). Useful for iterating on the build pipeline without burning API credits."
              >
                <Bug size={11} />
                Debug plan
              </button>
              {messages.some((m) => m.role === "user") && (
                <button
                  type="button"
                  onClick={startOver}
                  disabled={isCreatingProject}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Clear the conversation and start fresh"
                >
                  <RotateCcw size={11} />
                  Start over
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={isCreatingProject}
                aria-label="Close"
                className="ml-1 w-8 h-8 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          {/* B1'.7 — refined progress strip with slot icons + animated connectors. */}
          <div className="px-6 pb-4 flex items-center gap-2">
            {PLAN_SLOTS.map((slot, i) => {
              const set = isSlotSet(effectivePlan, slot.key);
              const Icon = slot.Icon;
              return (
                <React.Fragment key={slot.key}>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium ring-1 transition-all duration-300 ${
                      set
                        ? "bg-primary/15 text-text-primary ring-primary/40 shadow-sm shadow-primary/10"
                        : "bg-bg-tertiary/60 text-text-tertiary ring-white/[0.05]"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300 ${
                        set
                          ? "bg-primary text-white scale-100"
                          : "bg-transparent text-text-tertiary scale-90"
                      }`}
                    >
                      {set ? (
                        <Check size={10} strokeWidth={3} />
                      ) : (
                        <Icon size={9} strokeWidth={2.5} />
                      )}
                    </span>
                    <span>{slot.short}</span>
                  </div>
                  {i < PLAN_SLOTS.length - 1 && (
                    <div
                      className={`flex-1 h-px transition-all duration-500 ${
                        set
                          ? "bg-gradient-to-r from-primary/50 to-border-primary/40"
                          : "bg-border-primary/40"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {restoredFromDraft && (
          <div className="px-6 py-2 flex items-center justify-between text-[11px] bg-primary/5 border-b border-primary/15">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <RotateCcw size={11} className="text-primary" />
              Resumed from your last session.
            </span>
            <button
              type="button"
              onClick={() => setRestoredFromDraft(false)}
              className="text-text-tertiary hover:text-text-primary transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Body: chat (left) + plan preview (right) ─── */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            {/* ── Chat thread ────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto design-ai-scrollbar px-6 py-5 space-y-4">
              {messages.map((m, i) => {
                // The "latest agent message" is the index of the
                // last role==="agent" entry. Only that message's
                // choices are clickable; older ones are stale.
                const latestAgentIdx = findLatestAgentIndex(messages);
                const isLatestAgent = i === latestAgentIdx;
                const showAfterLatestAgent =
                  isLatestAgent && !pending && !isCreatingProject;
                const agentOfferedChips =
                  m.choices && m.choices.choices.length > 0;
                const hasUserMessage = messages.some(
                  (mm) => mm.role === "user",
                );
                // B1'.7 — always show next-step chips below the
                // latest agent turn unless the agent itself just
                // offered explicit choices (in which case we defer
                // to those — the user gets one canonical chip set).
                // For the very first agent greeting (no user turn
                // yet), we surface IDLE_SUGGESTIONS (broad starters)
                // instead of next-step chips (which would all be
                // empty-slot prompts and feel premature).
                const dynamicChips =
                  showAfterLatestAgent && !agentOfferedChips && hasUserMessage
                    ? nextStepChips(effectivePlan)
                    : [];
                const showIdleStarters =
                  showAfterLatestAgent && !agentOfferedChips && !hasUserMessage;
                return (
                  <div
                    key={i}
                    className={`space-y-2 ${i > 0 ? "design-ai-fade-up" : ""}`}
                  >
                    <ChatBubble message={m} />
                    {/* Tool-call breadcrumbs — what the agent did this turn */}
                    {m.role === "agent" &&
                      m.toolBreadcrumbs &&
                      m.toolBreadcrumbs.length > 0 && (
                        <div className="flex flex-wrap gap-1 pl-[42px]">
                          {m.toolBreadcrumbs.map((b, bi) => (
                            <span
                              key={bi}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] rounded-full bg-bg-tertiary/60 ring-1 ring-white/[0.05] text-text-tertiary"
                            >
                              <span>{b.icon}</span>
                              <span>{b.label}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    {/* Agent-offered chips — exclusive when present */}
                    {isLatestAgent && agentOfferedChips && (
                      <div className="flex flex-wrap gap-1.5 pl-[42px]">
                        {m.choices!.choices.map((c, ci) => (
                          <button
                            key={ci}
                            type="button"
                            onClick={() => void sendPrompt(c.prompt)}
                            disabled={pending || isCreatingProject}
                            className="group inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-full bg-gradient-to-br from-primary/20 to-primary/10 ring-1 ring-primary/40 text-text-primary hover:from-primary/30 hover:to-primary/20 hover:ring-primary/60 hover:shadow-md hover:shadow-primary/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            <span>{c.label}</span>
                            <ArrowRight
                              size={11}
                              className="text-primary/70 group-hover:translate-x-0.5 transition-transform"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Next-step chips (mid-conversation) */}
                    {dynamicChips.length > 0 && (
                      <div className="pl-[42px] space-y-1.5">
                        <div className="text-[11px] font-medium text-text-tertiary">
                          Suggested next steps
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {dynamicChips.map((c, ci) => (
                            <button
                              key={ci}
                              type="button"
                              onClick={() => void sendPrompt(c.prompt)}
                              disabled={pending || isCreatingProject}
                              className="group inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg bg-bg-tertiary ring-1 ring-white/[0.06] text-text-primary hover:ring-primary/40 hover:bg-bg-secondary hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              <span>{c.label}</span>
                              <ArrowRight
                                size={11}
                                className="text-text-tertiary group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                              />
                            </button>
                          ))}
                          {countSetSlots(effectivePlan) > 0 && (
                            <button
                              type="button"
                              onClick={() => void buildWorld()}
                              disabled={pending || isCreatingProject}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                                countSetSlots(effectivePlan) ===
                                PLAN_SLOTS.length
                                  ? "bg-gradient-to-br from-primary via-primary to-primary/90 shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50 ring-1 ring-primary/40"
                                  : "bg-gradient-to-br from-primary to-primary/85 shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/40"
                              }`}
                            >
                              <Sparkles size={12} />
                              {countSetSlots(effectivePlan) ===
                              PLAN_SLOTS.length
                                ? "Generate your world"
                                : "Generate world"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Idle "Quick start" — richer card grid */}
                    {showIdleStarters && (
                      <div className="pl-[42px] space-y-2">
                        <div className="text-[11px] font-medium text-text-tertiary">
                          Quick start
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {IDLE_SUGGESTIONS.map((s, si) => (
                            <button
                              key={si}
                              type="button"
                              onClick={() => void sendPrompt(s.prompt)}
                              disabled={pending || isCreatingProject}
                              className="group flex items-start gap-2.5 px-3 py-2.5 text-left rounded-lg bg-bg-tertiary ring-1 ring-white/[0.06] hover:ring-primary/50 hover:bg-bg-secondary hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              <span className="text-[18px] leading-none flex-shrink-0 mt-0.5">
                                {s.emoji}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-[12px] font-semibold text-text-primary leading-tight group-hover:text-primary transition-colors">
                                  {s.title}
                                </div>
                                <div className="text-[10.5px] text-text-tertiary mt-1 leading-snug">
                                  {s.subtitle}
                                </div>
                              </div>
                              <ArrowRight
                                size={11}
                                className="flex-shrink-0 mt-1 text-text-tertiary opacity-0 group-hover:opacity-100 group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {pending && <TypingIndicator status={pendingStatus} />}
              <div ref={scrollAnchorRef} />
            </div>

            {/* ── Error ──────────────────────────────────────── */}
            {error && (
              <div className="px-6 pb-2">
                <div className="flex items-start gap-2 p-3 bg-red-500/10 ring-1 ring-red-500/25 rounded-lg text-[12px] text-red-300 shadow-sm">
                  <AlertTriangle
                    size={14}
                    className="flex-shrink-0 mt-0.5 text-red-400"
                  />
                  <span className="flex-1 leading-relaxed">{error}</span>
                  {lastFailedPrompt && !isCreatingProject && (
                    <button
                      type="button"
                      onClick={() => void retryLast()}
                      disabled={pending}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw size={11} />
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Input ──────────────────────────────────────── */}
            <form
              onSubmit={sendMessage}
              className="px-6 py-4 bg-gradient-to-t from-bg-secondary/40 to-transparent"
            >
              <div className="relative flex items-end gap-2 rounded-xl bg-bg-tertiary ring-1 ring-white/[0.06] focus-within:ring-2 focus-within:ring-primary/40 focus-within:bg-bg-secondary transition-all shadow-sm">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() && !pending) {
                        void sendMessage();
                      }
                    }
                  }}
                  disabled={pending || isCreatingProject}
                  placeholder="Describe your world, or ask the AI a question…"
                  rows={2}
                  className="flex-1 px-4 py-3 pr-2 text-[13px] leading-relaxed bg-transparent text-text-primary focus:outline-none placeholder:text-text-tertiary resize-none disabled:opacity-50"
                />
                <div className="flex items-center pb-2 pr-2 self-end">
                  {pending ? (
                    <button
                      type="button"
                      onClick={cancel}
                      className="px-3 py-1.5 text-[12px] font-medium rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-primary/60 transition-colors"
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim() || isCreatingProject}
                      aria-label="Send"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 hover:shadow-md hover:shadow-primary/30 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all"
                    >
                      <Send size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-text-tertiary px-1 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-bg-tertiary ring-1 ring-white/[0.06] text-text-secondary font-mono text-[9px]">
                    ⏎
                  </kbd>
                  <span>Send</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-bg-tertiary ring-1 ring-white/[0.06] text-text-secondary font-mono text-[9px]">
                    ⇧⏎
                  </kbd>
                  <span>Newline</span>
                </span>
              </div>
            </form>
          </div>
          {/* /left pane */}

          {/* ── Right: tabbed pane — Plan (B1'.5) | Blocks (B1'.6) ─ */}
          <div className="w-80 flex-shrink-0 flex flex-col bg-bg-secondary">
            <div className="flex">
              <RightTabButton
                active={rightTab === "plan"}
                onClick={() => setRightTab("plan")}
                label="Plan"
              />
              <RightTabButton
                active={rightTab === "blocks"}
                onClick={() => setRightTab("blocks")}
                label="Building Blocks"
              />
            </div>
            {rightTab === "plan" ? (
              <PlanPreviewPanel
                plan={effectivePlan}
                canBuild={latestPlan !== null && !pending && !isCreatingProject}
                isCreating={isCreatingProject}
                isPending={pending}
                onBuild={() => void buildWorld()}
                onAskFor={(prompt) => void sendPrompt(prompt)}
                onRemoveTerrain={() =>
                  setEffectivePlan((p) => ({ ...p, terrainConfig: null }))
                }
                onRemovePlugins={() =>
                  setEffectivePlan((p) => ({ ...p, pluginIds: null }))
                }
                onRemoveNpc={(idx) =>
                  setEffectivePlan((p) => ({
                    ...p,
                    npcs: p.npcs.filter((_, i) => i !== idx),
                  }))
                }
                onRemoveMobSpawn={(idx) =>
                  setEffectivePlan((p) => ({
                    ...p,
                    mobSpawns: p.mobSpawns.filter((_, i) => i !== idx),
                  }))
                }
                onRemoveQuest={(idx) =>
                  setEffectivePlan((p) => ({
                    ...p,
                    quests: p.quests.filter((_, i) => i !== idx),
                  }))
                }
                onRemoveAsset={(idx) =>
                  setEffectivePlan((p) => ({
                    ...p,
                    assets: p.assets.filter((_, i) => i !== idx),
                  }))
                }
                onRemoveUiPack={() =>
                  setEffectivePlan((p) => ({ ...p, uiPack: null }))
                }
              />
            ) : (
              <BuildingBlocksPanel
                disabled={pending || isCreatingProject}
                onUse={(prompt) => {
                  setRightTab("plan");
                  void sendPrompt(prompt);
                }}
              />
            )}
          </div>
        </div>
        {/* /body */}
      </div>
    </div>
  );
}

// ────────────────────── PlanPreviewPanel (B1'.5/B1'.7) ────────

interface PlanPreviewPanelProps {
  plan: OnboardingPlan;
  canBuild: boolean;
  isCreating: boolean;
  /** True while an agent turn is running — disable next-action chips. */
  isPending: boolean;
  onBuild: () => void;
  /** Empty-slot click — sends `prompt` to the agent. */
  onAskFor: (prompt: string) => void;
  onRemoveTerrain: () => void;
  onRemovePlugins: () => void;
  onRemoveNpc: (index: number) => void;
  onRemoveMobSpawn: (index: number) => void;
  onRemoveQuest: (index: number) => void;
  onRemoveAsset: (index: number) => void;
  onRemoveUiPack: () => void;
}

/**
 * Right-pane sidebar showing the project plan as it accumulates.
 * Each slot is **active**: when set, ✓ + summary + remove. When
 * empty, a click sends a "fill this slot" prompt to the agent —
 * the panel literally is the next-step menu.
 *
 * Phase B1'.7 of `PLAN_PROJECT_AS_DATA.md`.
 */
function PlanPreviewPanel({
  plan,
  canBuild,
  isCreating,
  isPending,
  onBuild,
  onAskFor,
  onRemoveTerrain,
  onRemovePlugins,
  onRemoveNpc,
  onRemoveMobSpawn,
  onRemoveQuest,
  onRemoveAsset,
  onRemoveUiPack,
}: PlanPreviewPanelProps) {
  const hasTerrain = plan.terrainConfig !== null;
  const hasPlugins = plan.pluginIds !== null && plan.pluginIds.length > 0;
  const hasUiPack = plan.uiPack !== null;
  const hasNpcs = plan.npcs.length > 0;
  const hasMobSpawns = plan.mobSpawns.length > 0;
  const hasQuests = plan.quests.length > 0;
  const hasAssets = plan.assets.length > 0;
  const setCount = countSetSlots(plan);
  const totalSlots = PLAN_SLOTS.length;
  const allSet = setCount === totalSlots;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold text-text-primary">
            Project Plan
          </div>
          <div
            className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
              allSet
                ? "bg-primary/15 text-primary"
                : "bg-bg-tertiary text-text-tertiary"
            }`}
          >
            {setCount}/{totalSlots}
          </div>
        </div>
        <div className="text-[11px] text-text-tertiary mt-1 leading-snug">
          {allSet
            ? "All set. Generate your world below."
            : "Click an empty slot to ask the agent to fill it."}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto design-ai-scrollbar px-3 py-3 space-y-2">
        <PlanSlot
          icon={<Boxes size={14} />}
          title="Plugins"
          set={hasPlugins}
          summary={
            hasPlugins ? plan.pluginIds!.join(", ") : "No game plugins yet"
          }
          actionLabel="Pick a gameplay style"
          onAction={
            hasPlugins ? undefined : () => onAskFor(getEmptyPrompt("pluginIds"))
          }
          actionDisabled={isPending || isCreating}
          onRemove={hasPlugins ? onRemovePlugins : undefined}
        />

        <PlanSlot
          icon={<MapIcon size={14} />}
          title="Terrain"
          set={hasTerrain}
          summary={
            hasTerrain
              ? terrainSummary(plan.terrainConfig as Record<string, unknown>)
              : "Default flat terrain"
          }
          actionLabel="Shape the terrain"
          onAction={
            hasTerrain
              ? undefined
              : () => onAskFor(getEmptyPrompt("terrainConfig"))
          }
          actionDisabled={isPending || isCreating}
          onRemove={hasTerrain ? onRemoveTerrain : undefined}
        />

        {/* NPCs — special slot with a list of children when set */}
        <PlanSlot
          icon={<Users size={14} />}
          title="NPCs"
          set={hasNpcs}
          countBadge={hasNpcs ? plan.npcs.length : undefined}
          summary={hasNpcs ? `${plan.npcs.length} placed` : "No NPCs yet"}
          actionLabel="Add NPCs"
          onAction={
            hasNpcs ? undefined : () => onAskFor(getEmptyPrompt("npcs"))
          }
          actionDisabled={isPending || isCreating}
        >
          {hasNpcs && (
            <div className="mt-2 space-y-1">
              {plan.npcs.map((npc, i) => {
                const npcObj = (npc ?? {}) as Record<string, unknown>;
                const id =
                  typeof npcObj.id === "string" ? npcObj.id : `npc-${i}`;
                const name = typeof npcObj.name === "string" ? npcObj.name : id;
                const type =
                  typeof npcObj.type === "string" ? npcObj.type : "?";
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-bg-primary/60 rounded-md text-[11px] ring-1 ring-white/[0.05] group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary truncate font-medium">
                        {name}
                      </div>
                      <div className="text-text-tertiary truncate text-[10px]">
                        {type}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveNpc(i)}
                      className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-opacity"
                      aria-label={`Remove ${name}`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                disabled={isPending || isCreating}
                onClick={() => onAskFor("Add another NPC to my world.")}
                className="w-full mt-1 px-2.5 py-1.5 text-[11px] rounded-md bg-bg-primary/40 text-text-tertiary hover:text-primary hover:bg-bg-primary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <ArrowRight size={10} />
                Add another
              </button>
            </div>
          )}
        </PlanSlot>

        {/* Mob spawns — list when set, prompt when empty */}
        <PlanSlot
          icon={<Swords size={14} />}
          title="Mob spawns"
          set={hasMobSpawns}
          countBadge={hasMobSpawns ? plan.mobSpawns.length : undefined}
          summary={
            hasMobSpawns
              ? `${plan.mobSpawns.length} placed`
              : "No mob spawns yet"
          }
          actionLabel="Place mobs"
          onAction={
            hasMobSpawns
              ? undefined
              : () => onAskFor(getEmptyPrompt("mobSpawns"))
          }
          actionDisabled={isPending || isCreating}
        >
          {hasMobSpawns && (
            <div className="mt-2 space-y-1">
              {plan.mobSpawns.map((spawn, i) => {
                const s = (spawn ?? {}) as {
                  mobId?: string;
                  position?: { x?: number; y?: number; z?: number };
                  maxCount?: number;
                };
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-bg-primary/60 rounded-md text-[11px] ring-1 ring-white/[0.05] group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary truncate font-medium">
                        {s.mobId ?? `spawn-${i}`}{" "}
                        <span className="text-text-tertiary font-normal">
                          ×{s.maxCount ?? "?"}
                        </span>
                      </div>
                      <div className="text-text-tertiary truncate text-[10px]">
                        ({s.position?.x ?? "?"}, {s.position?.y ?? "?"},{" "}
                        {s.position?.z ?? "?"})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveMobSpawn(i)}
                      className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-opacity"
                      aria-label={`Remove spawn`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </PlanSlot>

        {/* Quests — list when set, prompt when empty */}
        <PlanSlot
          icon={<ScrollText size={14} />}
          title="Quests"
          set={hasQuests}
          countBadge={hasQuests ? plan.quests.length : undefined}
          summary={
            hasQuests ? `${plan.quests.length} authored` : "No quests yet"
          }
          actionLabel="Add quests"
          onAction={
            hasQuests ? undefined : () => onAskFor(getEmptyPrompt("quests"))
          }
          actionDisabled={isPending || isCreating}
        >
          {hasQuests && (
            <div className="mt-2 space-y-1">
              {plan.quests.map((quest, i) => {
                const q = (quest ?? {}) as {
                  id?: string;
                  name?: string;
                  difficulty?: string;
                  stages?: unknown[];
                };
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-bg-primary/60 rounded-md text-[11px] ring-1 ring-white/[0.05] group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary truncate font-medium">
                        {q.name ?? q.id ?? `quest-${i}`}
                      </div>
                      <div className="text-text-tertiary truncate text-[10px]">
                        {q.difficulty ?? "?"} ·{" "}
                        {Array.isArray(q.stages) ? q.stages.length : 0} stages
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveQuest(i)}
                      className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-opacity"
                      aria-label={`Remove quest`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </PlanSlot>

        {/* Assets — only render the section when set; bakes are
            optional (not part of the slot count). */}
        {hasAssets && (
          <PlanSlot
            icon={<Sparkles size={14} />}
            title="Asset bakes"
            set={true}
            countBadge={plan.assets.length}
            summary={`${plan.assets.length} queued`}
          >
            <div className="mt-2 space-y-1">
              {plan.assets.map((asset, i) => {
                const a = (asset ?? {}) as {
                  name?: string;
                  type?: string;
                  subtype?: string;
                };
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-bg-primary/60 rounded-md text-[11px] ring-1 ring-white/[0.05] group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary truncate font-medium">
                        {a.name ?? `asset-${i}`}
                      </div>
                      <div className="text-text-tertiary truncate text-[10px]">
                        {a.type ?? "?"} / {a.subtype ?? "?"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAsset(i)}
                      className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-opacity"
                      aria-label={`Remove asset`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </PlanSlot>
        )}

        <PlanSlot
          icon={<Layout size={14} />}
          title="HUD"
          set={hasUiPack}
          summary={
            hasUiPack
              ? `${(plan.uiPack as { id?: string })?.id ?? "Custom HUD pack"}`
              : "Default HUD"
          }
          actionLabel="Design the HUD"
          onAction={
            hasUiPack ? undefined : () => onAskFor(getEmptyPrompt("uiPack"))
          }
          actionDisabled={isPending || isCreating}
          onRemove={hasUiPack ? onRemoveUiPack : undefined}
        />
      </div>

      {/* Build CTA — gradient when ready, celebratory when all 4 set */}
      <div className="px-3 py-3 space-y-2 bg-gradient-to-t from-bg-secondary/40 to-transparent">
        <button
          type="button"
          onClick={onBuild}
          disabled={!canBuild}
          className={`relative w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-semibold rounded-lg transition-all disabled:cursor-not-allowed overflow-hidden group ${
            !canBuild
              ? "bg-bg-tertiary text-text-tertiary ring-1 ring-white/[0.06]"
              : allSet
                ? "bg-gradient-to-br from-primary via-primary to-primary/90 text-white shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50 ring-1 ring-primary/40"
                : "bg-gradient-to-br from-primary to-primary/85 text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/40"
          }`}
        >
          {canBuild && !isCreating && (
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          )}
          {/* Subtle ambient pulse when fully ready */}
          {allSet && canBuild && !isCreating && (
            <span className="absolute inset-0 bg-primary/30 animate-pulse rounded-lg opacity-30 pointer-events-none" />
          )}
          {isCreating ? (
            <>
              <Loader2 size={14} className="animate-spin relative z-10" />
              <span className="relative z-10">Generating world…</span>
            </>
          ) : (
            <>
              <Sparkles
                size={14}
                className={`relative z-10 ${allSet ? "drop-shadow-[0_0_4px_rgba(255,255,255,0.6)]" : ""}`}
              />
              <span className="relative z-10">
                {allSet ? "Generate your world" : "Generate world"}
              </span>
            </>
          )}
        </button>
        {!canBuild && !isCreating && (
          <div className="text-[10.5px] text-text-tertiary text-center leading-snug">
            {setCount === 0
              ? "Tell the agent what you want to build."
              : "Fill at least one slot to enable build."}
          </div>
        )}
        {canBuild && !isCreating && setCount < totalSlots && (
          <div className="text-[10.5px] text-text-tertiary text-center leading-snug">
            Building with {setCount} of {totalSlots} slots — defaults fill the
            rest.
          </div>
        )}
      </div>
    </div>
  );
}

function getEmptyPrompt(key: (typeof PLAN_SLOTS)[number]["key"]): string {
  return PLAN_SLOTS.find((s) => s.key === key)!.emptyPrompt;
}

interface PlanSlotProps {
  icon: React.ReactNode;
  title: string;
  set: boolean;
  summary: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  onRemove?: () => void;
  /** Small numeric badge next to the title (e.g. NPC count). */
  countBadge?: number;
  /** Optional child content rendered below the summary (e.g. NPC list). */
  children?: React.ReactNode;
}

function PlanSlot({
  icon,
  title,
  set,
  summary,
  actionLabel,
  onAction,
  actionDisabled,
  onRemove,
  countBadge,
  children,
}: PlanSlotProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg ring-1 transition-all group ${
        set
          ? "bg-bg-tertiary/80 ring-white/[0.06] shadow-sm"
          : "bg-bg-tertiary/40 ring-white/[0.04] hover:ring-primary/30 hover:bg-bg-tertiary/60"
      }`}
    >
      {set && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-primary/40" />
      )}
      <div className="px-3 py-2.5 flex items-start gap-2.5">
        <div
          className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
            set
              ? "bg-primary/15 text-primary ring-1 ring-primary/25"
              : "bg-bg-secondary/60 text-text-tertiary"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="text-[12px] font-semibold text-text-primary">
                {title}
              </div>
              {typeof countBadge === "number" && countBadge > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  {countBadge}
                </span>
              )}
              {set && !countBadge && (
                <Check
                  size={11}
                  strokeWidth={3}
                  className="text-primary opacity-80"
                />
              )}
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-opacity"
                aria-label={`Remove ${title}`}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <div className="text-[11px] text-text-tertiary truncate mt-0.5 leading-snug">
            {summary}
          </div>
          {!set && onAction && actionLabel && (
            <button
              type="button"
              disabled={actionDisabled}
              onClick={onAction}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLabel}
              <ArrowRight size={10} />
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Short human-readable summary of a terrain config object. Picks
 * the most informative knobs the agent might have set.
 */
function terrainSummary(config: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof config.preset === "string") parts.push(config.preset);
  if (typeof config.seed === "number") parts.push(`seed ${config.seed}`);
  const terrain = config.terrain as
    | { worldSize?: number; tileSize?: number }
    | undefined;
  if (terrain?.worldSize && terrain?.tileSize) {
    parts.push(
      `${terrain.worldSize}×${terrain.worldSize} @ ${terrain.tileSize}m`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : "Custom terrain config";
}

// ────────────────────── RightTabButton (B1'.6) ────────────────

interface RightTabButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function RightTabButton({ active, label, onClick }: RightTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 relative px-3 py-3 text-[11px] font-semibold transition-colors ${
        active
          ? "text-text-primary"
          : "text-text-tertiary hover:text-text-secondary"
      }`}
    >
      {label}
      {active && (
        <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
      )}
    </button>
  );
}

// ────────────────────── BuildingBlocksPanel (B1'.6) ───────────

interface PluginRegistryEntry {
  id: string;
  npmName: string | null;
  name: string;
  version: string;
  description: string;
  contributions: {
    systems: ReadonlyArray<string>;
    entities: ReadonlyArray<string>;
    widgets: ReadonlyArray<string>;
    manifestSchemas: ReadonlyArray<string>;
    paletteCategories: ReadonlyArray<string>;
    toolbarTools: ReadonlyArray<string>;
    commands: ReadonlyArray<string>;
  };
  dependencies: ReadonlyArray<{ id: string; versionRange: string }>;
  tags: ReadonlyArray<string>;
  source: "workspace" | "node_modules";
}

interface BuildingBlocksPanelProps {
  /** Disable "Use" buttons while a turn is pending or build is running. */
  disabled: boolean;
  /** User clicked "Use" — inject this prompt as a chat turn. */
  onUse: (prompt: string) => void;
}

/**
 * Right-pane "Building Blocks" tab — surfaces installed plugins
 * (from the `/api/plugins/installed` registry, B0'.D) so the user
 * can browse what the agent has to work with and one-click insert
 * a "use this plugin" prompt into the conversation.
 *
 * Phase B1'.6 of `PLAN_PROJECT_AS_DATA.md`.
 */
function BuildingBlocksPanel({ disabled, onUse }: BuildingBlocksPanelProps) {
  const [entries, setEntries] = useState<ReadonlyArray<PluginRegistryEntry>>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/plugins/installed", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ReadonlyArray<PluginRegistryEntry>;
        if (!cancelled) setEntries(json);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load plugins");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lowered = filter.trim().toLowerCase();
  const filtered = lowered
    ? entries.filter(
        (e) =>
          e.id.toLowerCase().includes(lowered) ||
          e.name.toLowerCase().includes(lowered) ||
          e.description.toLowerCase().includes(lowered) ||
          e.tags.some((t) => t.toLowerCase().includes(lowered)),
      )
    : entries;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-4">
        <div className="text-[12px] font-semibold text-text-primary">
          Building Blocks
        </div>
        <div className="text-[11px] text-text-tertiary mt-1 leading-snug">
          Installed plugins the agent can compose into your world.
        </div>
      </div>

      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search plugins…"
          className="w-full px-3 py-2 text-[12px] bg-bg-tertiary rounded-md ring-1 ring-white/[0.06] text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-bg-secondary transition-all"
        />
      </div>

      <div className="flex-1 overflow-y-auto design-ai-scrollbar px-3 pb-3 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-[11px] text-text-tertiary py-4">
            <Loader2 size={12} className="animate-spin" />
            Loading installed plugins…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-[11px] text-red-400 px-2 py-2 bg-red-500/10 rounded-md ring-1 ring-red-500/20">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-[11px] text-text-tertiary py-6 text-center">
            {entries.length === 0
              ? "No installed plugins discovered."
              : "No plugins match your filter."}
          </div>
        ) : (
          filtered.map((entry) => (
            <PluginCard
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === entry.id ? null : entry.id))
              }
              disabled={disabled}
              onUse={() =>
                onUse(`Add the ${entry.name} plugin (${entry.id}) to my world.`)
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

interface PluginCardProps {
  entry: PluginRegistryEntry;
  expanded: boolean;
  onToggle: () => void;
  disabled: boolean;
  onUse: () => void;
}

function PluginCard({
  entry,
  expanded,
  onToggle,
  disabled,
  onUse,
}: PluginCardProps) {
  const totalContrib =
    entry.contributions.systems.length +
    entry.contributions.entities.length +
    entry.contributions.widgets.length +
    entry.contributions.manifestSchemas.length +
    entry.contributions.paletteCategories.length +
    entry.contributions.toolbarTools.length +
    entry.contributions.commands.length;

  return (
    <div
      className={`bg-bg-tertiary rounded-lg ring-1 ${
        expanded
          ? "ring-primary/40 shadow-md shadow-primary/10"
          : "ring-white/[0.06] hover:ring-primary/30"
      } transition-all`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-bg-secondary/40 rounded-t-lg"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-text-primary truncate">
              {entry.name}
            </span>
            <span className="text-[10px] text-text-tertiary flex-shrink-0 font-mono">
              v{entry.version}
            </span>
            {entry.source === "workspace" && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex-shrink-0 font-semibold">
                dev
              </span>
            )}
          </div>
          <div className="text-[11px] text-text-tertiary truncate mt-0.5 leading-snug">
            {entry.description || entry.id}
          </div>
          <div className="text-[10px] text-text-tertiary mt-1.5 flex items-center gap-1">
            <span className="font-mono px-1.5 py-0.5 rounded bg-bg-primary/60">
              {totalContrib} contribution{totalContrib === 1 ? "" : "s"}
            </span>
            {entry.tags.length > 0 && (
              <span className="truncate">· {entry.tags.join(", ")}</span>
            )}
          </div>
        </div>
        <ArrowRight
          size={11}
          className={`flex-shrink-0 mt-1 text-text-tertiary transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="border-t border-border-primary/15 px-3 py-2.5 space-y-1.5 bg-bg-primary/30 rounded-b-lg">
          {renderContribGroup("Systems", entry.contributions.systems)}
          {renderContribGroup("Entities", entry.contributions.entities)}
          {renderContribGroup("Widgets", entry.contributions.widgets)}
          {renderContribGroup(
            "Manifest schemas",
            entry.contributions.manifestSchemas,
          )}
          {renderContribGroup(
            "Palette categories",
            entry.contributions.paletteCategories,
          )}
          {renderContribGroup(
            "Toolbar tools",
            entry.contributions.toolbarTools,
          )}
          {renderContribGroup("Commands", entry.contributions.commands)}
          {entry.dependencies.length > 0 && (
            <div className="text-[10px] text-text-tertiary leading-snug">
              <span className="font-semibold text-text-secondary">
                Depends on:
              </span>{" "}
              {entry.dependencies.map((d) => d.id).join(", ")}
            </div>
          )}
          <button
            type="button"
            onClick={onUse}
            disabled={disabled}
            className="w-full mt-2 px-3 py-2 text-[11px] font-semibold rounded-md bg-gradient-to-br from-primary to-primary/85 text-white shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
          >
            <Sparkles size={11} />
            Use in my world
          </button>
        </div>
      )}
    </div>
  );
}

function renderContribGroup(label: string, items: ReadonlyArray<string>) {
  if (items.length === 0) return null;
  return (
    <div className="text-[10px] leading-snug">
      <span className="font-semibold text-text-secondary">{label}</span>
      <span className="text-text-tertiary"> · {items.join(", ")}</span>
    </div>
  );
}

// ────────────────────────── ChatBubble ─────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end pl-10">
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-md bg-gradient-to-br from-primary/25 to-primary/15 text-text-primary text-[13px] leading-relaxed whitespace-pre-wrap border border-primary/25 shadow-sm shadow-primary/10">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start gap-2.5 pr-10">
      <AgentAvatar />
      <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tl-md bg-bg-secondary text-text-primary text-[13px] leading-relaxed whitespace-pre-wrap border border-white/[0.06] shadow-sm">
        {message.text}
      </div>
    </div>
  );
}

function AgentAvatar({ pulsing = false }: { pulsing?: boolean }) {
  return (
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center mt-0.5 ring-1 ring-primary/30 shadow-sm shadow-primary/20">
      <Sparkles
        size={12}
        className={`text-primary ${pulsing ? "animate-pulse" : ""}`}
      />
    </div>
  );
}

/**
 * Three-dot bouncing typing indicator — drop-in replacement for
 * the bare "Thinking…" line. Optionally shows a status string
 * below the dots (e.g. "Drafting the HUD…").
 */
function TypingIndicator({ status }: { status: string | null }) {
  return (
    <div className="flex justify-start gap-2.5 pr-10">
      <AgentAvatar pulsing />
      <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-bg-secondary border border-white/[0.06] shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </span>
          {status && (
            <span className="text-[11px] text-text-tertiary leading-none">
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────── helpers ──────────────────────────────

/**
 * Best-effort: derive a project name + description from the
 * conversation thread. Today this just returns the first user
 * message lightly truncated. Future cut: have the agent itself
 * emit a `name` + `description` field on its proposal.
 */
function summariseConversation(messages: ReadonlyArray<ChatMessage>): {
  name: string | null;
  description: string | null;
} {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return { name: null, description: null };
  const summary = firstUser.text.trim().slice(0, 200);
  const name = summary.slice(0, 60);
  return { name, description: summary };
}

/**
 * True when at least one slot of the agent's plan has content
 * worth applying. Used to gate the "Build my world" button.
 */
function hasAnyPlanContent(plan: OnboardingPlan): boolean {
  return (
    plan.terrainConfig !== null ||
    (plan.pluginIds !== null && plan.pluginIds.length > 0) ||
    (plan.assetPackIds !== null && plan.assetPackIds.length > 0) ||
    plan.npcs.length > 0 ||
    plan.mobSpawns.length > 0 ||
    plan.quests.length > 0 ||
    plan.assets.length > 0 ||
    plan.zones.length > 0 ||
    plan.resources.length > 0 ||
    plan.stations.length > 0 ||
    plan.teleports.length > 0 ||
    plan.uiPack !== null
  );
}

/**
 * Index of the most recent `role === "agent"` message. Only that
 * message's choice chips are clickable — older offers are stale.
 * Returns -1 when there's no agent message yet.
 */
function findLatestAgentIndex(messages: ReadonlyArray<ChatMessage>): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "agent") return i;
  }
  return -1;
}

/**
 * Footer summary of what the agent has proposed so far. Renders
 * a short description of each populated plan slot.
 */
function planSummaryText(plan: OnboardingPlan): string {
  const parts: string[] = [];
  if (plan.terrainConfig) parts.push("terrain");
  if (plan.pluginIds && plan.pluginIds.length > 0) {
    parts.push(`${plan.pluginIds.length} plugin(s)`);
  }
  if (plan.assetPackIds && plan.assetPackIds.length > 0) {
    parts.push(`${plan.assetPackIds.length} pack(s)`);
  }
  if (plan.npcs.length > 0) parts.push(`${plan.npcs.length} NPC(s)`);
  if (plan.mobSpawns.length > 0) {
    parts.push(`${plan.mobSpawns.length} spawn(s)`);
  }
  if (plan.resources.length > 0) {
    parts.push(`${plan.resources.length} resource(s)`);
  }
  if (plan.stations.length > 0) {
    parts.push(`${plan.stations.length} station(s)`);
  }
  if (plan.teleports.length > 0) {
    parts.push(`${plan.teleports.length} teleport(s)`);
  }
  if (plan.zones.length > 0) parts.push(`${plan.zones.length} zone(s)`);
  if (plan.quests.length > 0) parts.push(`${plan.quests.length} quest(s)`);
  if (plan.uiPack) parts.push("HUD");
  if (parts.length === 0) return "Plan empty.";
  return `✓ Plan: ${parts.join(", ")}. Click Build.`;
}
