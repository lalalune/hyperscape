/**
 * `proposeActionRegistry` — single source of truth for the
 * agent's PROPOSE_* tool-call vocabulary.
 *
 * Phase 1.3 first cut from PLAN_AAA_MASTER_AUDIT.md. Previously
 * the action names, payload-key mappings, plan-field mappings,
 * arities, and status labels were duplicated across:
 *
 *   - DesignWithAIDialog.tsx — 21 case arms accumulating into
 *     an `OnboardingPlan`.
 *   - WorldStudioCompanion.tsx — 14 case arms dispatching to
 *     the studio reducer via placementDispatcher.
 *   - DesignWithAIDialog's `prettifyToolName` switch — 21 case
 *     arms returning status strings.
 *   - Companion's `prettifyToolName` switch — 14 more arms.
 *
 * Adding a new PROPOSE_* action required edits in ALL 4 sites,
 * with drift-risk on every addition. This registry is the
 * single declaration. Both dispatchers will iterate over it
 * (Phase 1.3 second cut). For now, the registry is consulted
 * by the prettify functions + tests pin the shape.
 *
 * NOT covered by the registry (they have action-specific
 * handling that doesn't fit the dataKey/planField/arity shape):
 *   - PROPOSE_ASSET_PACK_INSTALL — Set-merge of string IDs.
 *   - PROPOSE_UI_PACK — singleton but UI-pack-shaped payload.
 *   - REMOVE_FROM_PROJECT — multi-kind removal switch.
 *
 * Those stay as bespoke case arms.
 */

/** List-append vs singleton-replace semantics on the plan side. */
export type ProposeArity = "list" | "singleton";

/**
 * Declaration of one PROPOSE_* action: its name, the property
 * on the tool call's `data` payload that carries the proposed
 * entity, the corresponding `OnboardingPlan` field name, the
 * arity, and a status label shown in the agent activity bar
 * while the action is running.
 */
export interface ProposeActionDef {
  /** Action name as emitted by the agent (e.g. "PROPOSE_NPC_PLACEMENT"). */
  readonly name: string;
  /** Property on `toolCall.data` that carries the proposal payload. */
  readonly dataKey: string;
  /** Field on `OnboardingPlan` the proposal lands in. */
  readonly planField: string;
  /**
   * `"list"` = append to `plan[planField]` array on each call.
   * `"singleton"` = replace `plan[planField]` (last write wins).
   */
  readonly arity: ProposeArity;
  /** Status label for the agent activity bar (no trailing punctuation). */
  readonly statusLabel: string;
  /**
   * Method name on the studio's placement dispatcher that
   * applies this proposal live (Companion mode). When set, the
   * Companion's tool-call handler can dispatch generically via
   * `dispatcher[def.dispatcherMethod](payload)` instead of a
   * bespoke else-if arm. Omitted for actions whose Companion
   * handling goes through a different persistence path
   * (PROPOSE_QUEST / PROPOSE_ZONE write to a different state
   * slice via setAndPersist*; PROPOSE_TERRAIN_CONFIG /
   * PROPOSE_PLUGIN_SET don't dispatch live at all).
   */
  readonly dispatcherMethod?: string;
}

/**
 * The canonical PROPOSE_* action set. Adding a new action means
 * adding one entry here and (when ready) updating the dispatch
 * helpers to honor it. No edits to the case arms in the dialog
 * or companion required.
 */
export const PROPOSE_ACTIONS: readonly ProposeActionDef[] = [
  {
    name: "PROPOSE_TERRAIN_CONFIG",
    dataKey: "config",
    planField: "terrainConfig",
    arity: "singleton",
    statusLabel: "Shaping the terrain",
    // No dispatcherMethod — terrain config doesn't dispatch live.
  },
  {
    name: "PROPOSE_PLUGIN_SET",
    dataKey: "pluginIds",
    planField: "pluginIds",
    arity: "singleton",
    statusLabel: "Picking a plugin set",
    // No dispatcherMethod — plugin sets aren't placed live.
  },
  {
    name: "PROPOSE_NPC_PLACEMENT",
    dataKey: "entity",
    planField: "npcs",
    arity: "list",
    statusLabel: "Placing an NPC",
    dispatcherMethod: "placeNpc",
  },
  {
    name: "PROPOSE_MOB_SPAWN",
    dataKey: "spawn",
    planField: "mobSpawns",
    arity: "list",
    statusLabel: "Placing a mob spawn",
    dispatcherMethod: "placeMobSpawn",
  },
  {
    name: "PROPOSE_QUEST",
    dataKey: "quest",
    planField: "quests",
    arity: "list",
    statusLabel: "Authoring a quest",
    // No dispatcherMethod — quests persist via setAndPersistAgentQuest.
  },
  {
    name: "PROPOSE_ASSET",
    dataKey: "asset",
    planField: "assets",
    arity: "list",
    statusLabel: "Designing a new asset",
    // No dispatcherMethod — asset bakes fire post-project-create.
  },
  {
    name: "PROPOSE_ZONE",
    dataKey: "zone",
    planField: "zones",
    arity: "list",
    statusLabel: "Carving a zone",
    // No dispatcherMethod — zones persist via setAndPersistAgentZone.
  },
  {
    name: "PROPOSE_RESOURCE",
    dataKey: "resource",
    planField: "resources",
    arity: "list",
    statusLabel: "Placing a resource",
    dispatcherMethod: "placeResource",
  },
  {
    name: "PROPOSE_STATION",
    dataKey: "station",
    planField: "stations",
    arity: "list",
    statusLabel: "Placing a station",
    dispatcherMethod: "placeStation",
  },
  {
    name: "PROPOSE_TELEPORT",
    dataKey: "teleport",
    planField: "teleports",
    arity: "list",
    statusLabel: "Placing a teleport",
    dispatcherMethod: "placeTeleport",
  },
  {
    name: "PROPOSE_ROAD",
    dataKey: "road",
    planField: "roads",
    arity: "list",
    statusLabel: "Drawing a road",
    dispatcherMethod: "placeRoad",
  },
  {
    name: "PROPOSE_POI",
    dataKey: "poi",
    planField: "pois",
    arity: "list",
    statusLabel: "Marking a point of interest",
    dispatcherMethod: "placePOI",
  },
  {
    name: "PROPOSE_DANGER_SOURCE",
    dataKey: "dangerSource",
    planField: "dangerSources",
    arity: "list",
    statusLabel: "Adding a danger zone",
    dispatcherMethod: "placeDangerSource",
  },
  {
    name: "PROPOSE_WATER_BODY",
    dataKey: "waterBody",
    planField: "waterBodies",
    arity: "list",
    statusLabel: "Placing a water body",
    dispatcherMethod: "placeWaterBody",
  },
  {
    name: "PROPOSE_MUSIC_ZONE",
    dataKey: "musicZone",
    planField: "musicZones",
    arity: "list",
    statusLabel: "Defining a music zone",
    dispatcherMethod: "placeMusicZone",
  },
  {
    name: "PROPOSE_AMBIENT_ZONE",
    dataKey: "ambientZone",
    planField: "ambientZones",
    arity: "list",
    statusLabel: "Defining an ambient zone",
    dispatcherMethod: "placeAmbientZone",
  },
  {
    name: "PROPOSE_SFX_TRIGGER",
    dataKey: "sfxTrigger",
    planField: "sfxTriggers",
    arity: "list",
    statusLabel: "Placing a sound trigger",
    dispatcherMethod: "placeSfxTrigger",
  },
  {
    name: "PROPOSE_MINE",
    dataKey: "mine",
    planField: "mines",
    arity: "list",
    statusLabel: "Marking a mining area",
    dispatcherMethod: "placeMine",
  },
  {
    name: "PROPOSE_WILDERNESS_BOUNDARY",
    dataKey: "wildernessBoundary",
    planField: "wildernessBoundary",
    arity: "singleton",
    statusLabel: "Drawing the wilderness boundary",
    dispatcherMethod: "placeWildernessBoundary",
  },
];

/**
 * Indexed lookup by action name. Built once at module load —
 * the registry is `readonly` and never mutates.
 */
const BY_NAME = new Map<string, ProposeActionDef>(
  PROPOSE_ACTIONS.map((a) => [a.name, a]),
);

/**
 * Look up a PROPOSE_* action definition by its name. Returns
 * `undefined` for unknown names + for the bespoke actions that
 * intentionally aren't in the registry (PROPOSE_ASSET_PACK_INSTALL,
 * PROPOSE_UI_PACK, REMOVE_FROM_PROJECT) — callers either fall
 * through to default case arms or handle absence as "unknown".
 */
export function getProposeActionDef(
  name: string,
): ProposeActionDef | undefined {
  return BY_NAME.get(name);
}

/**
 * Status labels for non-PROPOSE_* tool calls (discovery, removal,
 * UI offers). Kept here so the consolidated prettify lookup is a
 * single function with one fall-through path.
 */
const NON_PROPOSE_LABELS: Record<string, string> = {
  LIST_PLUGINS: "Looking up plugins",
  GET_PLUGIN: "Inspecting a plugin",
  LIST_GAME_WIDGETS: "Listing widgets",
  SEARCH_GAME_WIDGETS: "Searching widgets",
  GET_GAME_WIDGET: "Inspecting a widget",
  GET_CATALOG_STATS: "Reading catalog stats",
  LIST_ENTITY_TYPES: "Listing entity types",
  LIST_ASSET_PACKS: "Listing asset packs",
  REMOVE_FROM_PROJECT: "Removing an entity",
  GET_PROJECT_STATE: "Reviewing the project",
  OFFER_CHOICES: "Offering choices",
  // PROPOSE_ACTIONS isn't here — it's looked up via the registry.
  // Bespoke ones still need labels:
  PROPOSE_ASSET_PACK_INSTALL: "Picking asset packs",
  PROPOSE_UI_PACK: "Drafting the HUD",
};

/**
 * Convert an action name like `LIST_GAME_WIDGETS` into a human
 * status string like "Listing widgets…". Trailing ellipsis is
 * added by this function so the registry entries don't have to
 * include it.
 *
 * Lookup order:
 *   1. Standard PROPOSE_* action registry.
 *   2. Non-PROPOSE label table.
 *   3. Fallback: "Running <name>…".
 */
export function prettifyToolName(name: string): string {
  const def = getProposeActionDef(name);
  if (def) return `${def.statusLabel}…`;
  const fallback = NON_PROPOSE_LABELS[name];
  if (fallback) return `${fallback}…`;
  return `Running ${name}…`;
}

/**
 * Generic plan-state update derived from the registry. Given an
 * onboarding `plan`, an agent tool-call `name`, and its `data`
 * payload, this returns the next plan state according to the
 * registry entry for `name`:
 *
 *   - Action not in registry → returns plan unchanged (caller's
 *     bespoke switch handles the action).
 *   - Payload missing the registry's `dataKey` → returns plan
 *     unchanged.
 *   - `arity: "singleton"` → replaces `plan[planField]` with the
 *     payload value (last write wins).
 *   - `arity: "list"` → appends to the existing array at
 *     `plan[planField]`. If the existing slot isn't an array,
 *     returns the plan unchanged (defensive).
 *
 * Returns the input plan reference when there's no change, so
 * callers can use referential equality as a fast no-op check.
 *
 * Bespoke actions outside the registry (PROPOSE_PLUGIN_SET with
 * its string-filter pass, PROPOSE_ASSET_PACK_INSTALL with
 * Set-merge, REMOVE_FROM_PROJECT, PROPOSE_UI_PACK) need their
 * own switch arms in the caller — this helper handles the
 * 18 actions that follow the dataKey→planField pattern.
 */
/**
 * Live-dispatch variant of `applyProposalToPlan` for the
 * Companion. Looks up the registry entry's `dispatcherMethod`
 * and invokes it on the supplied dispatcher with the payload
 * value at the registry's `dataKey`.
 *
 * Returns `true` when the action was dispatched, `false`
 * otherwise (caller can then fall through to its bespoke
 * else-if chain for actions that aren't in the registry,
 * don't have a `dispatcherMethod`, or have a missing payload
 * field).
 *
 * Uses indexed property access on the dispatcher object —
 * each registry entry's `dispatcherMethod` value MUST match a
 * real method name on `AgentPlacementDispatcher`. The
 * proposeActionRegistry tests pin this contract against an
 * inline list of expected dispatcher methods, so a typo in
 * the registry surfaces as a test failure rather than a
 * runtime no-op.
 */
export function applyProposalToDispatcher(
  dispatcher: Record<string, unknown>,
  name: string,
  data: Record<string, unknown>,
): boolean {
  const def = getProposeActionDef(name);
  if (!def || !def.dispatcherMethod) return false;
  const value = data[def.dataKey];
  if (value === undefined) return false;
  const method = dispatcher[def.dispatcherMethod];
  if (typeof method !== "function") return false;
  (method as (v: unknown) => void).call(dispatcher, value);
  return true;
}

export function applyProposalToPlan<TPlan extends object>(
  plan: TPlan,
  name: string,
  data: Record<string, unknown>,
): TPlan {
  const def = getProposeActionDef(name);
  if (!def) return plan;
  const value = data[def.dataKey];
  if (value === undefined) return plan;
  // Treat the plan as a string-keyed record locally — every
  // OnboardingPlan-style consumer's planField targets a string-
  // keyed slot, but TS can't infer the slot type from the
  // dynamic field name without a generic bound that's too tight
  // for real OnboardingPlan shapes (heterogeneous slot types).
  const planRecord = plan as unknown as Record<string, unknown>;
  if (def.arity === "singleton") {
    return { ...plan, [def.planField]: value };
  }
  // list: append, defensive on the existing slot
  const existing = planRecord[def.planField];
  if (!Array.isArray(existing)) return plan;
  return { ...plan, [def.planField]: [...existing, value] };
}
