/**
 * `handleDesignRequest` — pure handler the HTTP route delegates to.
 *
 * Separated from `bin.ts` / `serve()` so the agent loop's behavior
 * can be unit-tested with a `FakeLLM` without spinning up a real
 * server or making real API calls.
 *
 * Contract:
 *   request   `{ prompt: string, model?: string, maxTurns?: number }`
 *   response  `{ ok: true,  pack: UIPackManifest | null,
 *               finalText: string, turns: number,
 *               truncated: boolean }`
 *           | `{ ok: false, error: string, code: ErrorCode }`
 */

import {
  GameBuilderService,
  catalogStatsAction,
  getPluginAction,
  getWidgetAction,
  listPluginsAction,
  listWidgetsAction,
  offerChoicesAction,
  proposeAssetAction,
  proposeMobSpawnAction,
  proposeNpcPlacementAction,
  proposePluginSetAction,
  proposeQuestAction,
  proposeResourceAction,
  proposeStationAction,
  proposeTeleportAction,
  proposeTerrainConfigAction,
  proposeUIPackAction,
  proposeZoneAction,
  removeFromProjectAction,
  scaffoldWidgetAction,
  searchWidgetsAction,
  getProjectStateAction,
  PROJECT_CONTEXT_SERVICE_TYPE,
  makeProjectContextService,
  listAssetPacksAction,
  listEntityTypesAction,
  proposeAssetPackInstallAction,
  ASSET_PACK_CATALOG_SERVICE_TYPE,
  makeAssetPackCatalogService,
  type InstallableAssetPack,
  type OfferedChoice,
} from "@hyperforge/eliza-game-builder";
import { runAgentLoop, type LLMClient } from "@hyperforge/agent-runner";

/** HUD-design mode prompt (today's default). */
const HUD_SYSTEM_PROMPT = `You are HyperForge's game-builder agent. Your job is to design UI packs for Hyperia worlds by composing existing widgets from the catalog.

Workflow:
1. Start with GET_CATALOG_STATS to see what's available.
2. Use LIST_GAME_WIDGETS or SEARCH_GAME_WIDGETS to find candidate widgets. Don't search the same query twice.
3. Use GET_GAME_WIDGET to inspect a candidate's prop schema before using it. Only inspect widgets you intend to use.
4. Compose a UIPackManifest that uses widgets you've verified exist. Submit via PROPOSE_UI_PACK.
5. If the pack fails validation, read the issues and fix them in your next call.

Be efficient. Aim to converge in 4-6 tool calls. Don't list every widget — pick what's relevant.

The UIPackManifest schema requires: version: 1, id (string), name (string), widgets (array of {id}), and layouts.default with {id, name, revision, instances[]}. Each instance needs instanceId, widgetId, position {kind: "anchored", anchor: <one of: top-left, top-right, top-center, bottom-left, bottom-right, bottom-center, middle-left, middle-right, middle-center>, offset: {x, y}}, and props ({} if you don't customize).`;

/**
 * Onboarding mode prompt — drives the new-project conversational
 * flow (B1'.2.2). The agent asks 1–3 clarifying questions, then
 * emits all of: PROPOSE_TERRAIN_CONFIG, PROPOSE_PLUGIN_SET,
 * 0..N PROPOSE_NPC_PLACEMENT, PROPOSE_UI_PACK. Each one becomes a
 * separate layer of the new project.
 */
const ONBOARDING_SYSTEM_PROMPT = `You are HyperForge's onboarding agent. The user is staring at an empty project and a chat dock; your job is to walk them from "I want a fantasy RPG" to a built starter world in as few turns as possible. The host UI shows a live "Project Plan" panel with four slots — Terrain, Plugins, NPCs, HUD — and the user can SEE which slots you have set and which are still empty. Make their progress visible.

==== HARD RULES ====

1. ALWAYS end every assistant turn with a clear next step. Either:
   - Ask a question (use OFFER_CHOICES if there are 3-6 obvious answers — chip clicks are faster than typing), OR
   - Confirm what you just decided and tell the user what you'll do next, OR
   - Say "I've got everything I need — click Build to generate your world" once all four slots are set.

   NEVER end a turn with "let me know if you have questions" or "what would you like to do?" — always offer a concrete next action.

2. EMIT \`PROPOSE_*\` ACTIONS INCREMENTALLY, NOT IN ONE BATCH. The instant you have enough info for a slot, emit its action — don't wait until the end. The user wants to see the right panel fill up as they answer questions.
   - Got the genre? → emit PROPOSE_PLUGIN_SET immediately.
   - User said "snowy mountains"? → emit PROPOSE_TERRAIN_CONFIG.
   - User picked "merchant + quest giver"? → emit PROPOSE_NPC_PLACEMENT for each.
   - User said "place goblins / wolves / skeletons"? → emit PROPOSE_MOB_SPAWN for each spawn point.
   - You've narrowed the gameplay style? → emit PROPOSE_UI_PACK.

3. You can REVISE slots later by emitting again — the host always uses your latest emission per slot.

4. INSTALL ASSET PACKS BEFORE PLACING CONTENT, but you usually don't need to specify \`assetRef\` per-placement. Workflow:
   - Make sure the relevant pack is installed. Call \`LIST_ASSET_PACKS\` to discover what's available, \`PROPOSE_ASSET_PACK_INSTALL\` to add one. Don't ship placeholder-only worlds.
   - For most placements, OMIT \`assetRef\` — the host auto-picks a sensible default from installed packs (matching by id when possible: \`mobId="goblin"\` → goblin entry; otherwise by the type's \`acceptedAssetTypes\`).
   - ONLY set \`assetRef\` explicitly when you care which specific asset gets used (e.g. user said "place a captain rowan, not just any humanoid"). To pick one, call \`GET_PROJECT_STATE\` with \`select=availableAssets\` and copy a \`ref\` from the catalog.

5. ALWAYS call \`LIST_ENTITY_TYPES\` before emitting placements so your \`type\` strings have gameplay backing. The action returns the catalog of entity types installed plugins actually handle (e.g. \`shopkeeper\` opens a store, \`questgiver\` offers quests, \`tree\` is a woodcutting target). Pick a \`type\` value from this list — guessing arbitrary strings means the placement is rejected with a list of valid alternatives. The catalog also tells you required extra fields (\`shopkeeper\` needs \`storeId\`) and which asset-pack types pair naturally (\`acceptedAssetTypes\`).

==== SLOT REFERENCE ====

   - PROPOSE_TERRAIN_CONFIG — \`config\` with at minimum \`{ seed: <int> }\`. Add \`preset\`, \`terrain\`, \`biomes\`, \`vegetation\` knobs as appropriate. Procgen fills defaults for omitted fields.
   - PROPOSE_PLUGIN_SET — \`pluginIds\` array. RPG/combat: ["@hyperforge/hyperscape"]. Shooter: ["@hyperforge/plugin-shooter-demo"]. Pure-procgen sandbox: [].
   - PROPOSE_ASSET_PACK_INSTALL — install one or more asset packs onto the project (e.g. trees, rocks, npcs, weapons). Source the ids from LIST_ASSET_PACKS.
   - PROPOSE_NPC_PLACEMENT — once per NPC; each \`{ id, type, position: {x,y,z} }\`, optionally \`name\`, \`storeId\`, \`dialogue\`, \`assetRef\` (host auto-picks if omitted). Use for vendors, quest-givers, dialogue NPCs.
   - PROPOSE_MOB_SPAWN — once per mob spawn point; each \`{ mobId, position, maxCount, spawnRadius }\`. Optional \`assetRef\` — host auto-picks by mobId match. Use for combat encounters.
   - PROPOSE_QUEST — once per quest; non-empty \`stages[]\` of dialogue/kill/gather/interact. Reference an NPC the user already accepted via \`startNpc\`. Hyperia-class RPGs usually have 3-8 starter quests.
   - PROPOSE_ASSET — propose generating a unique 3D model. Pass \`{ name, type, subtype, prompt, ... }\`. Use BEFORE PROPOSE_NPC_PLACEMENT when you want a unique mesh; the host bakes async and wires it to placements when ready. Skip when reusing existing catalog models.
   - PROPOSE_ZONE — define a bounded named region. Pass \`{ id, name, description, difficultyLevel, bounds, biomeType, safeZone, ... }\`. Use when the user describes a REGION ("wilderness north of town", "PvP arena") rather than a point.
   - PROPOSE_RESOURCE — place a gathering resource (tree / rock / fishing spot). Pass \`{ resourceId, type, position }\`. Optional \`assetRef\`. Use for the gathering loop (woodcutting / mining / fishing).
   - PROPOSE_STATION — place a crafting station (anvil / furnace / range / bank). Pass \`{ id, type, position }\`. Optional \`assetRef\`. Use to anchor crafting + banking gameplay loops.
   - PROPOSE_TELEPORT — place a teleport node. Pass \`{ id, name, type: 'lodestone'|'portal'|'shortcut', position }\`. Optional \`requirements\`, \`cost\`, \`assetRef\`. Use for fast-travel anchors (lodestones unlock by visiting; portals always available; shortcuts are quest-gated).
   - REMOVE_FROM_PROJECT — delete an existing entity. Pass \`{ kind: 'npc'|'quest'|'zone'|'asset'|'station'|'teleport', id }\` OR \`{ kind: 'mobSpawn', mobId, position }\` OR \`{ kind: 'resource', resourceId, position }\`. Use when the user says "remove the X" / "drop the Y" / "actually scrap that". Always call GET_PROJECT_STATE first to look up the right id.
   - PROPOSE_UI_PACK — Use LIST_GAME_WIDGETS / GET_GAME_WIDGET first to discover available widgets, then propose a HUD that fits the game type.

==== DISCOVERY TOOLS ====

   - GET_PROJECT_STATE — ALWAYS call this first when the user references "this project", "my world", "what I have", "what's next", or any incremental edit. Returns projectId, templateId, plugins, and worldContent counts (NPCs, mob spawns, etc.). Without it you'll re-propose slots the user already accepted.
   - LIST_PLUGINS / GET_PLUGIN — see what gameplay plugins exist before recommending.
   - LIST_ENTITY_TYPES — list the entity types installed plugins handle. Call this before any PROPOSE_NPC_PLACEMENT / PROPOSE_MOB_SPAWN / PROPOSE_RESOURCE so your \`type\` field maps to a real plugin behavior.
   - LIST_GAME_WIDGETS / SEARCH_GAME_WIDGETS / GET_GAME_WIDGET — explore the HUD widget catalog.
   - GET_CATALOG_STATS — quick overview.
   - OFFER_CHOICES — short-circuit narrow questions with clickable chips.

==== STYLE ====

Keep messages short — 2-4 sentences max. Don't over-explore widgets. Default to fast convergence: when a slot has an obvious choice, just take it and tell the user what you picked. The user can always ask you to change it.`;

const COMPANION_SYSTEM_PROMPT = `You are HyperForge's in-studio companion agent. The user already has a project — you are NOT onboarding them, you are helping them iterate. Your job is to make small, surgical edits to a live world.

==== HARD RULES ====

1. ALWAYS call GET_PROJECT_STATE first when the user references "this", "the X", "what we have", "what's next", or any incremental edit. Without it you'll re-propose entities the user already has, or place things that contradict the existing world.

2. PREFER NARROW EDITS. The onboarding agent batches PROPOSE_* calls; the companion agent makes ONE edit per request unless the user explicitly asks for a sweep. "Add a merchant near the village" → emit one PROPOSE_NPC_PLACEMENT, not three.

3. USE REMOVE_FROM_PROJECT when the user says "remove", "delete", "drop", "scrap", "actually no". Don't just re-emit a PROPOSE_* — the user can see existing entities in the editor; explicit removal is the contract.

4. ENTITY TYPES + ASSET PACKS — placements are validated against the project's installed plugins + asset packs.
   - Call LIST_ENTITY_TYPES to see the catalog of valid \`type\` values for the project's current plugins. Bad types are hard-rejected with the list of valid alternatives.
   - You usually don't need to set \`assetRef\` — host auto-picks a sensible default from installed packs (matches by id where possible: \`mobId="goblin"\` → goblin entry; otherwise by the type's \`acceptedAssetTypes\`). Only set \`assetRef\` when the user wants a specific asset.
   - If the user wants content the project's packs don't cover ("add weapons" with only the trees pack installed) → call LIST_ASSET_PACKS + PROPOSE_ASSET_PACK_INSTALL first, then place.

5. END EVERY TURN WITH A NEXT ACTION. Either ask a question, confirm what you did, or volunteer one concrete next step ("Want me to give the goblins a patrol route?"). Never end with "let me know if you need anything else."

==== EDITS YOU CAN MAKE ====

   - PROPOSE_NPC_PLACEMENT — add an NPC. Required: \`{ id, type, position }\` (+ \`storeId\` for shopkeepers).
   - PROPOSE_MOB_SPAWN — add a combat encounter. Required: \`{ mobId, position, maxCount, spawnRadius }\`.
   - PROPOSE_RESOURCE — add a gathering target (tree / rock / fishing spot). Required: \`{ resourceId, type, position }\`.
   - PROPOSE_STATION — add a crafting station (anvil / furnace / range / bank). Required: \`{ id, type, position }\`.
   - PROPOSE_TELEPORT — add a teleport node. Required: \`{ id, name, type: 'lodestone'|'portal'|'shortcut', position }\`. Optional: requirements, cost.
   - PROPOSE_ZONE — define a named bounded region. Use when the user describes a REGION, not a point.
   - PROPOSE_QUEST — add a quest. Reference an NPC the user already has via \`startNpc\` (call GET_PROJECT_STATE for real ids).
   - PROPOSE_ASSET_PACK_INSTALL — install one or more asset packs onto this project.
   - PROPOSE_ASSET — propose a unique 3D model (host bakes async). Use only when no existing pack asset fits.
   - PROPOSE_UI_PACK — replace the HUD wholesale. Only emit when the user wants a new HUD.
   - PROPOSE_TERRAIN_CONFIG — re-shape terrain. The world is regenerated — only when the user explicitly wants a regen.
   - PROPOSE_PLUGIN_SET — swap gameplay plugins. World needs a Play restart — confirm before emitting.
   - REMOVE_FROM_PROJECT — delete by id (npc/quest/zone/asset/station) or composite key (mobSpawn / resource by id+position).

==== DISCOVERY TOOLS ====

   - GET_PROJECT_STATE — your most-used tool. Call it constantly. Use \`select="availableAssets"\` only when explicitly picking an \`assetRef\`.
   - LIST_ENTITY_TYPES — call before any placement to see valid \`type\` values for the project's installed plugins.
   - LIST_PLUGINS / GET_PLUGIN — only when discussing plugin swaps.
   - LIST_ASSET_PACKS — only when the user wants content the existing packs don't cover.
   - LIST_GAME_WIDGETS / SEARCH_GAME_WIDGETS / GET_GAME_WIDGET — only when designing a new HUD.
   - OFFER_CHOICES — offer 3-6 narrow options as clickable chips ("Add a patrol route, give them dialogue, or move on?").

==== STYLE ====

Conversational. 1-3 sentences per turn. Confirm small edits with one line ("Added Eldric the merchant near the spawn — anything else?"). Volunteer the next iteration.`;

export type ErrorCode =
  | "BAD_REQUEST"
  | "MISSING_PROMPT"
  | "AGENT_FAILED"
  | "TRUNCATED";

/**
 * Mode the request runs in.
 *
 *   - `"hud"` (default) — today's behavior: agent designs a UI
 *     pack only. Single-action emission. Backwards-compat default.
 *   - `"onboarding"` — B1'.2.2 conversational onboarding: agent
 *     asks clarifying questions then emits multiple `PROPOSE_*`
 *     actions in one proposal turn. Response surfaces each
 *     emitted artifact (terrain config, plugin set, NPCs, pack).
 *   - `"companion"` — F2 of the AAA gap audit. Same action surface
 *     as onboarding, but assumes the project ALREADY EXISTS. The
 *     agent's job is incremental editing ("swap to a shooter HUD",
 *     "add a quest giver here"), not greenfield setup.
 */
export type DesignMode = "hud" | "onboarding" | "companion";

/**
 * One turn in the running conversation, as the host has it. Sent
 * to the server with each new prompt so the agent can pick up
 * mid-flow (B1'.7): without history the agent is amnesiac and
 * cannot incrementally refine the plan over multiple turns.
 */
export interface ConversationTurn {
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface DesignRequest {
  readonly prompt: string;
  readonly model?: string;
  readonly maxTurns?: number;
  readonly mode?: DesignMode;
  /**
   * B1'.7 — prior conversation. When omitted, the loop runs
   * stateless from a single `prompt` (back-compat for HUD mode).
   * In onboarding the host sends every prior user/agent turn so
   * the agent can emit `PROPOSE_*` slot-by-slot as info becomes
   * available, instead of batching at the end.
   */
  readonly history?: ReadonlyArray<ConversationTurn>;
  /**
   * Phase A3 of the AAA gap audit — the active project's state
   * the agent can introspect via `GET_PROJECT_STATE`. Without
   * this the agent is amnesiac about prior work: it can't say
   * "I see you already have a tavern at (12,0,8), I'll add the
   * smithy next to it." Companion mode in particular is useless
   * without it.
   */
  readonly projectContext?: ProjectContext;
  /**
   * Phase AP5 of `PLAN_ASSET_PACKS.md`. Catalog of asset packs
   * the active project COULD install (built-in + team's). Read
   * by `LIST_ASSET_PACKS`; validated against by
   * `PROPOSE_ASSET_PACK_INSTALL`. Distinct from
   * `projectContext.assetPacks` (the *installed* set).
   */
  readonly installableAssetPacks?: ReadonlyArray<InstallableAssetPack>;
}

/**
 * One installed asset pack as the agent sees it. Mirrors a
 * subset of `AssetPackManifest` from `@hyperforge/manifest-schema`
 * — agent only needs the catalog (id, name, type, subtype) to
 * pick assets, not URLs / thumbnails.
 *
 * Phase AP4 of `PLAN_ASSET_PACKS.md`.
 */
export interface ProjectContextAssetPack {
  readonly manifestId: string;
  readonly name: string;
  readonly packVersion: string;
  readonly assets: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly type: string;
    readonly subtype: string;
    readonly tags?: ReadonlyArray<string>;
  }>;
}

/**
 * What the agent sees about the active project. Mirrors the
 * Project-as-Data typed columns. All fields optional — missing
 * fields just narrow what `GET_PROJECT_STATE` can return.
 */
export interface ProjectContext {
  readonly projectId?: string;
  readonly templateId?: string | null;
  readonly config?: unknown;
  readonly plugins?: ReadonlyArray<string>;
  readonly worldContent?: unknown;
  /** Installed asset packs (Phase AP4 — PLAN_ASSET_PACKS.md). */
  readonly assetPacks?: ReadonlyArray<ProjectContextAssetPack>;
}

/**
 * Aggregated artifacts the agent emitted across the run. Each
 * field reflects the LAST successful emission of its action; the
 * agent can revise mid-run by emitting again.
 */
export interface OnboardingPlan {
  /** Last validated `WorldCreationConfig` (B0'.H). */
  readonly terrainConfig: unknown | null;
  /** Last validated plugin id list (B0'.I). */
  readonly pluginIds: ReadonlyArray<string> | null;
  /** Every NPC the agent placed across the run (B1.2). */
  readonly npcs: ReadonlyArray<unknown>;
  /** Every mob spawn the agent placed across the run (A2). */
  readonly mobSpawns: ReadonlyArray<unknown>;
  /** Every quest the agent authored across the run (A1). */
  readonly quests: ReadonlyArray<unknown>;
  /** Every asset the agent proposed for generation (A5). */
  readonly assets: ReadonlyArray<unknown>;
  /** Every zone the agent carved across the run. */
  readonly zones: ReadonlyArray<unknown>;
  /** Every gathering resource the agent placed across the run. */
  readonly resources: ReadonlyArray<unknown>;
  /** Last validated UI pack (B1.0). */
  readonly uiPack: unknown | null;
}

/**
 * Hybrid-UX clickable choices the agent offered on its last
 * `OFFER_CHOICES` call (B1'.4). The host renders these as
 * chips below the agent's text; click → resend prompt.
 */
export interface OfferedChoicesPayload {
  readonly question: string | null;
  readonly choices: ReadonlyArray<OfferedChoice>;
}

export interface DesignSuccessResponse {
  readonly ok: true;
  /** Convenience pointer to `plan.uiPack` for backwards compatibility. */
  readonly pack: unknown;
  readonly finalText: string;
  readonly turns: number;
  readonly truncated: boolean;
  /**
   * B1'.2.2: when `mode === "onboarding"`, populated with every
   * `PROPOSE_*` action's emission across the run. For `mode ===
   * "hud"`, only `uiPack` is populated.
   */
  readonly plan: OnboardingPlan;
  /**
   * B1'.4: hybrid-UX choice chips. Populated when the agent's
   * last turn called `OFFER_CHOICES`. The host renders these as
   * clickable buttons below the agent's text response; click
   * sends the chip's `prompt` as the next user message. `null`
   * when the agent didn't offer choices on the last turn.
   */
  readonly choices: OfferedChoicesPayload | null;
}

export interface DesignErrorResponse {
  readonly ok: false;
  readonly error: string;
  readonly code: ErrorCode;
}

export type DesignResponse = DesignSuccessResponse | DesignErrorResponse;

export interface HandleDesignOptions {
  /** LLM client (real Anthropic in production, FakeLLM in tests). */
  readonly llm: LLMClient;
  /** Pre-built service so tests can inject a fixture catalog. */
  readonly service: GameBuilderService;
  /** Default model id. Overridden per-request. */
  readonly defaultModel?: string;
  /** Default maxTurns. Overridden per-request. */
  readonly defaultMaxTurns?: number;
  /** Optional log hook called on every turn. */
  readonly onTurn?: (turn: number, calls: ReadonlyArray<string>) => void;
  /**
   * B1'.7 — richer per-turn callback for streaming consumers
   * (the SSE `/design/stream` route). Fires once per assistant
   * turn with the assistant text and every tool call's name +
   * success + data, so the consumer can push live `slot` / `choices`
   * events to the client without waiting for the full run to
   * finish.
   */
  readonly onTurnDetail?: (detail: TurnDetail) => void;
}

/**
 * One turn's per-call breakdown — what the agent said + every
 * tool it invoked + each tool's success/data. Same data the
 * aggregator walks at the end of the run, but emitted live so
 * the client can fill the plan panel turn-by-turn (B1'.7).
 */
export interface TurnDetail {
  readonly turn: number;
  readonly assistantText: string;
  readonly toolCalls: ReadonlyArray<{
    readonly name: string;
    readonly success: boolean;
    readonly data: unknown | null;
  }>;
}

/** HUD-design mode: today's catalog + UI-pack actions only. */
const HUD_ACTIONS = [
  catalogStatsAction,
  listWidgetsAction,
  getWidgetAction,
  searchWidgetsAction,
  proposeUIPackAction,
  scaffoldWidgetAction,
];

/**
 * Onboarding mode: HUD actions plus the world-content + plugin
 * actions that drive multi-layer project authoring, plus
 * OFFER_CHOICES for the hybrid chat-or-click UX (B1'.4).
 */
const ONBOARDING_ACTIONS = [
  ...HUD_ACTIONS,
  listPluginsAction,
  getPluginAction,
  getProjectStateAction,
  listEntityTypesAction,
  listAssetPacksAction,
  proposeTerrainConfigAction,
  proposePluginSetAction,
  proposeAssetPackInstallAction,
  proposeNpcPlacementAction,
  proposeMobSpawnAction,
  proposeQuestAction,
  proposeAssetAction,
  proposeZoneAction,
  proposeResourceAction,
  proposeStationAction,
  proposeTeleportAction,
  removeFromProjectAction,
  offerChoicesAction,
];

export async function handleDesignRequest(
  request: DesignRequest,
  options: HandleDesignOptions,
): Promise<DesignResponse> {
  const prompt = request.prompt?.trim();
  if (!prompt) {
    return {
      ok: false,
      error: "Missing or empty `prompt` field.",
      code: "MISSING_PROMPT",
    };
  }

  // Phase A3 — request-scoped project context. The runtime
  // closure exposes it via `getService(PROJECT_CONTEXT_SERVICE_TYPE)`
  // so `GET_PROJECT_STATE` can read the active project verbatim.
  // Always non-null (returns a service whose `getProjectContext`
  // returns null when the host omitted projectContext).
  const projectContextService = makeProjectContextService(
    request.projectContext ?? null,
  );

  // Phase AP5 — request-scoped catalog of installable asset packs.
  // Read by `LIST_ASSET_PACKS`; validated against by
  // `PROPOSE_ASSET_PACK_INSTALL`.
  const assetPackCatalogService = makeAssetPackCatalogService(
    request.installableAssetPacks ?? [],
  );

  const runtime = {
    getService: <T>(name: string) => {
      if (name === GameBuilderService.serviceType)
        return options.service as unknown as T;
      if (name === PROJECT_CONTEXT_SERVICE_TYPE)
        return projectContextService as unknown as T;
      if (name === ASSET_PACK_CATALOG_SERVICE_TYPE)
        return assetPackCatalogService as unknown as T;
      return null;
    },
  } as unknown as import("@elizaos/core").IAgentRuntime;

  const mode: DesignMode = request.mode ?? "hud";
  // Onboarding + companion share the full action surface (the
  // companion just needs different framing). HUD mode stays
  // narrow.
  const actions =
    mode === "onboarding" || mode === "companion"
      ? ONBOARDING_ACTIONS
      : HUD_ACTIONS;
  const system =
    mode === "onboarding"
      ? ONBOARDING_SYSTEM_PROMPT
      : mode === "companion"
        ? COMPANION_SYSTEM_PROMPT
        : HUD_SYSTEM_PROMPT;

  // B1'.7 — when the host sends prior conversation, replay it
  // ahead of the new prompt so the agent has continuity. Each
  // turn becomes one Anthropic message; we drop empty turns
  // (e.g. an aborted request) and collapse identical adjacent
  // roles into a single message just to be defensive.
  const replayedMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [];
  if (request.history) {
    for (const turn of request.history) {
      const text = turn.text?.trim();
      if (!text) continue;
      const last = replayedMessages[replayedMessages.length - 1];
      if (last && last.role === turn.role) {
        last.content = `${last.content}\n${text}`;
      } else {
        replayedMessages.push({ role: turn.role, content: text });
      }
    }
  }
  // The new user turn always lands last.
  const lastReplayed = replayedMessages[replayedMessages.length - 1];
  if (lastReplayed && lastReplayed.role === "user") {
    lastReplayed.content = `${lastReplayed.content}\n${prompt}`;
  } else {
    replayedMessages.push({ role: "user", content: prompt });
  }

  try {
    const result = await runAgentLoop({
      messages: replayedMessages,
      actions,
      runtime,
      llm: options.llm,
      model: request.model ?? options.defaultModel,
      maxTurns: request.maxTurns ?? options.defaultMaxTurns ?? 12,
      system,
      onTurn:
        options.onTurn || options.onTurnDetail
          ? (t) => {
              if (options.onTurn) {
                options.onTurn(
                  t.turn,
                  t.toolCalls.map((c) => c.name),
                );
              }
              if (options.onTurnDetail) {
                const text = t.assistant.content
                  .filter(
                    (b): b is { type: "text"; text: string } =>
                      (b as { type?: string }).type === "text",
                  )
                  .map((b) => b.text)
                  .join("");
                options.onTurnDetail({
                  turn: t.turn,
                  assistantText: text,
                  toolCalls: t.toolCalls.map((c) => ({
                    name: c.name,
                    success: c.result?.success === true,
                    data: c.result?.data ?? null,
                  })),
                });
              }
            }
          : undefined,
    });

    const plan = aggregatePlanFromTurns(result.turns);
    const choices = extractLastOfferedChoices(result.turns);
    return {
      ok: true,
      pack: plan.uiPack ?? result.lastUIPack ?? null,
      finalText: result.finalText,
      turns: result.turns.length,
      truncated: result.truncated,
      plan,
      choices,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      code: "AGENT_FAILED",
    };
  }
}

/**
 * Walk every turn's tool calls and aggregate the artifacts each
 * `PROPOSE_*` action emitted into a single `OnboardingPlan`.
 *
 * Aggregation rules:
 *   - `terrainConfig`: last successful `PROPOSE_TERRAIN_CONFIG`
 *     (`data.config`)
 *   - `pluginIds`: last successful `PROPOSE_PLUGIN_SET`
 *     (`data.pluginIds`)
 *   - `npcs`: every successful `PROPOSE_NPC_PLACEMENT`
 *     (`data.entity`), in emission order
 *   - `uiPack`: last successful `PROPOSE_UI_PACK` (`data.pack`)
 */
/**
 * Walk turns from latest backwards, return the latest successful
 * `OFFER_CHOICES` payload. Choice chips only matter when offered
 * on the *last* agent turn — earlier offers are stale.
 */
function extractLastOfferedChoices(
  turns: ReadonlyArray<{
    toolCalls: ReadonlyArray<{
      name: string;
      result: { success?: boolean; data?: unknown } | undefined;
    }>;
  }>,
): OfferedChoicesPayload | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i]!;
    // Look at the last OFFER_CHOICES in this turn (if multiple).
    for (let j = turn.toolCalls.length - 1; j >= 0; j--) {
      const call = turn.toolCalls[j]!;
      if (call.name !== "OFFER_CHOICES") continue;
      if (!call.result || call.result.success !== true || !call.result.data)
        continue;
      const data = call.result.data as Record<string, unknown>;
      const rawChoices = data.choices;
      if (!Array.isArray(rawChoices)) continue;
      const choices = (rawChoices as unknown[]).filter(
        (c): c is OfferedChoice =>
          !!c &&
          typeof c === "object" &&
          typeof (c as Record<string, unknown>).label === "string" &&
          typeof (c as Record<string, unknown>).prompt === "string",
      );
      const question = typeof data.question === "string" ? data.question : null;
      return { question, choices };
    }
    // If this turn had any tool calls but no OFFER_CHOICES, the
    // agent moved past chips — return null.
    if (turn.toolCalls.length > 0) return null;
  }
  return null;
}

/**
 * Apply an in-run REMOVE_FROM_PROJECT to the aggregator buffers.
 *
 * Phase A4 of the AAA gap audit. Mutates the buffers in place so
 * the final plan reflects the intent the agent's chat trail
 * expressed (PROPOSE then REMOVE = nothing) rather than the raw
 * tool-call log. The host doesn't need to know about removals as
 * a separate concept; it just receives the cleaned aggregate.
 *
 * The removal request shape is validated by `removeFromProject.ts`
 * before this function sees it, so the cast here is sound.
 */
function applyRemovalToAggregate(
  rawRemoval: unknown,
  buffers: {
    npcs: unknown[];
    mobSpawns: unknown[];
    quests: unknown[];
    assets: unknown[];
    zones: unknown[];
  },
): void {
  if (!rawRemoval || typeof rawRemoval !== "object") return;
  const r = rawRemoval as {
    kind?: string;
    id?: string;
    mobId?: string;
    position?: { x: number; y: number; z: number };
  };
  switch (r.kind) {
    case "npc":
      filterById(buffers.npcs, r.id);
      break;
    case "quest":
      filterById(buffers.quests, r.id);
      break;
    case "asset":
      // Assets in the aggregate are agent proposals (no host id
      // assigned yet), so we match on the proposal `name` since
      // `id` doesn't exist on this side. The host applies its
      // own removal logic for already-baked records.
      filterByField(buffers.assets, "name", r.id);
      break;
    case "mobSpawn":
      if (!r.mobId || !r.position) return;
      const px = r.position.x;
      const py = r.position.y;
      const pz = r.position.z;
      const remaining = buffers.mobSpawns.filter((s) => {
        const o = s as {
          mobId?: string;
          position?: { x?: number; y?: number; z?: number };
        };
        return !(
          o.mobId === r.mobId &&
          o.position?.x === px &&
          o.position?.y === py &&
          o.position?.z === pz
        );
      });
      buffers.mobSpawns.length = 0;
      buffers.mobSpawns.push(...remaining);
      break;
    case "zone":
      filterById(buffers.zones, r.id);
      break;
    default:
      break;
  }
}

function filterById(buffer: unknown[], id: string | undefined): void {
  if (!id) return;
  const remaining = buffer.filter((entry) => {
    const o = entry as { id?: string };
    return o.id !== id;
  });
  buffer.length = 0;
  buffer.push(...remaining);
}

function filterByField(
  buffer: unknown[],
  field: string,
  value: string | undefined,
): void {
  if (!value) return;
  const remaining = buffer.filter((entry) => {
    const o = entry as Record<string, unknown>;
    return o[field] !== value;
  });
  buffer.length = 0;
  buffer.push(...remaining);
}

function aggregatePlanFromTurns(
  turns: ReadonlyArray<{
    toolCalls: ReadonlyArray<{
      name: string;
      result: { success?: boolean; data?: unknown } | undefined;
    }>;
  }>,
): OnboardingPlan {
  let terrainConfig: unknown | null = null;
  let pluginIds: ReadonlyArray<string> | null = null;
  const npcs: unknown[] = [];
  const mobSpawns: unknown[] = [];
  const quests: unknown[] = [];
  const assets: unknown[] = [];
  const zones: unknown[] = [];
  const resources: unknown[] = [];
  let uiPack: unknown | null = null;

  for (const turn of turns) {
    for (const call of turn.toolCalls) {
      const result = call.result;
      if (!result || result.success !== true || !result.data) continue;
      const data = result.data as Record<string, unknown>;
      switch (call.name) {
        case "PROPOSE_TERRAIN_CONFIG":
          if (data.config !== undefined) terrainConfig = data.config;
          break;
        case "PROPOSE_PLUGIN_SET":
          if (Array.isArray(data.pluginIds)) {
            pluginIds = (data.pluginIds as unknown[]).filter(
              (x): x is string => typeof x === "string",
            );
          }
          break;
        case "PROPOSE_NPC_PLACEMENT":
          if (data.entity !== undefined) npcs.push(data.entity);
          break;
        case "PROPOSE_MOB_SPAWN":
          if (data.spawn !== undefined) mobSpawns.push(data.spawn);
          break;
        case "PROPOSE_QUEST":
          if (data.quest !== undefined) quests.push(data.quest);
          break;
        case "PROPOSE_ASSET":
          if (data.asset !== undefined) assets.push(data.asset);
          break;
        case "PROPOSE_ZONE":
          if (data.zone !== undefined) zones.push(data.zone);
          break;
        case "PROPOSE_RESOURCE":
          if (data.resource !== undefined) resources.push(data.resource);
          break;
        case "PROPOSE_UI_PACK":
          if (data.pack !== undefined) uiPack = data.pack;
          break;
        case "REMOVE_FROM_PROJECT":
          // A4 — apply the agent's removal to the in-run aggregate
          // so the final plan reflects the *intended* state, not
          // the literal "every PROPOSE_* I emitted" trace. The
          // host then patches its store from the cleaned aggregate.
          applyRemovalToAggregate(data.removal, {
            npcs,
            mobSpawns,
            quests,
            assets,
            zones,
          });
          break;
        default:
          // ignore — discovery actions don't produce artifacts.
          break;
      }
    }
  }

  return {
    terrainConfig,
    pluginIds,
    npcs,
    mobSpawns,
    quests,
    assets,
    zones,
    resources,
    uiPack,
  };
}

/**
 * Parse a JSON request body and validate the shape. Returns the
 * structured `DesignRequest` or an error response.
 */
export function parseDesignRequest(
  body: unknown,
): DesignRequest | DesignErrorResponse {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: "Request body must be a JSON object.",
      code: "BAD_REQUEST",
    };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.prompt !== "string") {
    return {
      ok: false,
      error: "Field `prompt` must be a string.",
      code: "MISSING_PROMPT",
    };
  }
  const rawMode = b.mode;
  const mode: DesignMode | undefined =
    rawMode === "hud" || rawMode === "onboarding" || rawMode === "companion"
      ? rawMode
      : undefined;

  let history: ReadonlyArray<ConversationTurn> | undefined;
  if (Array.isArray(b.history)) {
    const turns: ConversationTurn[] = [];
    for (const raw of b.history) {
      if (!raw || typeof raw !== "object") continue;
      const t = raw as Record<string, unknown>;
      const role = t.role;
      const text = t.text;
      if ((role !== "user" && role !== "assistant") || typeof text !== "string")
        continue;
      turns.push({ role, text });
    }
    history = turns;
  }

  let projectContext: ProjectContext | undefined;
  if (b.projectContext && typeof b.projectContext === "object") {
    const pc = b.projectContext as Record<string, unknown>;
    projectContext = {
      projectId: typeof pc.projectId === "string" ? pc.projectId : undefined,
      templateId:
        typeof pc.templateId === "string" || pc.templateId === null
          ? (pc.templateId as string | null)
          : undefined,
      config: "config" in pc ? pc.config : undefined,
      plugins: Array.isArray(pc.plugins)
        ? (pc.plugins as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : undefined,
      worldContent: "worldContent" in pc ? pc.worldContent : undefined,
      assetPacks: Array.isArray(pc.assetPacks)
        ? parseAssetPacks(pc.assetPacks)
        : undefined,
    };
  }

  let installableAssetPacks: ReadonlyArray<InstallableAssetPack> | undefined;
  if (Array.isArray(b.installableAssetPacks)) {
    installableAssetPacks = parseInstallableAssetPacks(
      b.installableAssetPacks as ReadonlyArray<unknown>,
    );
  }

  return {
    prompt: b.prompt,
    model: typeof b.model === "string" ? b.model : undefined,
    maxTurns: typeof b.maxTurns === "number" ? b.maxTurns : undefined,
    mode,
    history,
    projectContext,
    installableAssetPacks,
  };
}

function parseInstallableAssetPacks(
  raw: ReadonlyArray<unknown>,
): ReadonlyArray<InstallableAssetPack> {
  const out: InstallableAssetPack[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const p = entry as Record<string, unknown>;
    if (typeof p.manifestId !== "string") continue;
    if (typeof p.name !== "string") continue;
    if (typeof p.description !== "string") continue;
    if (typeof p.packVersion !== "string") continue;
    if (typeof p.assetCount !== "number") continue;
    const source = p.source;
    if (source !== "builtin" && source !== "team" && source !== "marketplace") {
      continue;
    }
    const tags = Array.isArray(p.tags)
      ? (p.tags as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    out.push({
      manifestId: p.manifestId,
      name: p.name,
      description: p.description,
      packVersion: p.packVersion,
      assetCount: p.assetCount,
      tags,
      source,
    });
  }
  return out;
}

function parseAssetPacks(
  raw: ReadonlyArray<unknown>,
): ReadonlyArray<ProjectContextAssetPack> {
  const out: ProjectContextAssetPack[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const p = entry as Record<string, unknown>;
    if (typeof p.manifestId !== "string") continue;
    if (typeof p.name !== "string") continue;
    if (typeof p.packVersion !== "string") continue;
    if (!Array.isArray(p.assets)) continue;
    const assets: ProjectContextAssetPack["assets"][number][] = [];
    for (const aRaw of p.assets) {
      if (!aRaw || typeof aRaw !== "object") continue;
      const a = aRaw as Record<string, unknown>;
      if (typeof a.id !== "string") continue;
      if (typeof a.name !== "string") continue;
      if (typeof a.type !== "string") continue;
      if (typeof a.subtype !== "string") continue;
      assets.push({
        id: a.id,
        name: a.name,
        description:
          typeof a.description === "string" ? a.description : undefined,
        type: a.type,
        subtype: a.subtype,
        tags: Array.isArray(a.tags)
          ? (a.tags as unknown[]).filter(
              (x): x is string => typeof x === "string",
            )
          : undefined,
      });
    }
    out.push({
      manifestId: p.manifestId,
      name: p.name,
      packVersion: p.packVersion,
      assets,
    });
  }
  return out;
}
