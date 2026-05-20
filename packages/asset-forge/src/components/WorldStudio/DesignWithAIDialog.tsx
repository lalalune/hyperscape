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
  ChevronDown,
  ChevronRight,
  Circle,
  Droplets,
  Flag,
  Hammer,
  Layout,
  Loader2,
  MapPin,
  Map as MapIcon,
  Music,
  Palette,
  Pickaxe,
  RefreshCw,
  Route,
  RotateCcw,
  ScrollText,
  Send,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  TreePine,
  Users,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  HYPERIA_CREATION_CONFIG,
  MINIMAL_CREATION_CONFIG,
} from "../WorldBuilder/types";
import { generateWorldFromConfig } from "../WorldBuilder/worldGeneration";
import { mergeProcgenConfig } from "./utils/mergeProcgenConfig";
import {
  applyProposalToPlan,
  getProposeActionDef,
  prettifyToolName,
} from "./utils/proposeActionRegistry";
import {
  setContentPackContent,
  type ContentPackContentInput,
} from "./utils/contentRegistry";
import { serializeWorld } from "../WorldBuilder/utils/worldPersistence";
import {
  createWorldProject,
  patchProjectWorldContent,
  setProjectPlugins,
} from "../../utils/worldProjectApi";
import {
  getAssetPack,
  listInstallableAssetPacks,
  resolveProjectAssetPacks,
  setProjectAssetPacks,
  type InstallablePackSummary,
  type ResolvedProjectAssetPack,
} from "../../utils/assetPackApi";
import { kickoffAssetGeneration } from "../../utils/assetGenApi";

const DEFAULT_DESIGN_ENDPOINT = "http://localhost:5180/design";

// `OnboardingPlan` interface + `buildDebugPlan` extracted to
// `utils/onboardingPlan.ts` (Phase 1.2 seventh carve). The
// dialog accumulates the agent's PROPOSE_* tool calls into one
// OnboardingPlan; buildDebugPlan short-circuits the agent for
// downstream pipeline iteration.

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
 * MANIFEST_TO_NPM map extracted to `utils/pluginManifestNpm.ts`
 * (Phase 1.2 third carve). The agent server emits manifest-style
 * plugin ids (`com.hyperforge.x`); the project store + asset-pack
 * resolver expect npm-style names (`@hyperforge/x`). Translate
 * at this seam.
 *
 * Removed alongside: `HYPERIA_PLUGIN_IDS` const + `pluginsTargetHyperia`
 * helper. Both were declared here but never called anywhere in
 * the codebase — dead code from an earlier procgen-base picker
 * that's since been replaced by the content-pack-driven theme
 * resolution path.
 */

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
// IDLE_SUGGESTIONS + nextStepChips extracted to
// `utils/onboardingChips.ts` (Phase 1.2 fifth carve). Both move
// together — they feed complementary chip surfaces (idle =
// empty-chat cards, next-step = live progress-driven chips).

export interface DesignWithAIDialogProps {
  readonly teamId: string;
  readonly gameId: string;
  readonly onClose: () => void;
  readonly onCreated: (projectId: string) => void;
  /** Override the design endpoint (defaults to localhost:5180/design). */
  readonly endpoint?: string;
}

// `nextStepChips` extracted alongside IDLE_SUGGESTIONS to
// `utils/onboardingChips.ts`. The helper is generic over the
// plan shape — accepts any object with the OnboardingPlan
// subset { pluginIds, terrainConfig, npcs, mobSpawns, quests,
// uiPack } that nextStepChips actually reads.

// `PlanSlotKey`, `PLAN_SLOTS`, `isSlotSet`, `countSetSlots`
// extracted to `utils/planSlots.ts` (Phase 1.2 sixth carve).
// The slot helpers take a structural `PlanSlotShape` so they
// don't import OnboardingPlan (dialog ↔ slots dep cycle).

function initialGreeting(): ChatMessage {
  return {
    role: "agent",
    text: "Hi! Tell me what kind of world you want to build — or pick a quick-start below. As we chat, the right side will fill up with the project plan.",
  };
}

// `prettifyToolName` lives in `utils/proposeActionRegistry.ts`
// (Phase 1.3 first cut). Imported above.

// Tool-call breadcrumb summarizer extracted to
// `utils/toolBreadcrumbSummary.ts` (Phase 1.2 fourth carve).
// The registry + `summarizeToolCalls` helper move together — the
// helper is meaningless without the registry it consults, and
// adding a new tool is a single-file edit there.

// ────────────── Draft persistence (B1'.7) ────────────────────
//
// Persisting (messages + plan) to localStorage means a stray
// refresh — or accidentally closing the dialog — doesn't lose
// the user's onboarding work. Keyed by team + game so multiple
// projects don't trample each other.

// Phase 1.2 first carve — draft storage extracted to
// `utils/designDraftStorage.ts`. The dialog still calls the
// helpers directly; only the implementation moved.
import {
  loadDraft as loadDraftFromStorage,
  saveDraft as saveDraftToStorage,
  clearDraft as clearDraftFromStorage,
} from "./utils/designDraftStorage";
import { parseSSEBlock } from "./utils/parseSSEBlock";
import { MANIFEST_TO_NPM } from "./utils/pluginManifestNpm";
import { summarizeToolCalls } from "./utils/toolBreadcrumbSummary";
import { IDLE_SUGGESTIONS, nextStepChips } from "./utils/onboardingChips";
import {
  PLAN_SLOTS,
  countSetSlots,
  isSlotSet,
  type PlanSlotKey,
} from "./utils/planSlots";
import { buildDebugPlan, type OnboardingPlan } from "./utils/onboardingPlan";
import {
  collectSecondarySlotEntries,
  getEmptyPrompt,
  secondarySlotCount,
  secondarySlotSummary,
} from "./utils/secondarySlotSummaries";
import {
  hasAnyPlanContent,
  planSummaryText,
  terrainSummary,
} from "./utils/planSummary";
import {
  findLatestAgentIndex,
  summariseConversation,
} from "./utils/chatMessageHelpers";
import { inferThemedPackFromCatalog } from "./utils/inferThemedPack";
import {
  applyStreamingTurn,
  type StreamTurnEvent,
} from "./utils/applyStreamingTurn";
import {
  AgentAvatar,
  ChatBubble,
  TypingIndicator,
} from "./utils/chatMessageRenderers";
import { RightTabButton } from "./utils/RightTabButton";

const loadDraft = (teamId: string, gameId: string) =>
  loadDraftFromStorage<ChatMessage, OnboardingPlan>(teamId, gameId);
const saveDraft = (
  teamId: string,
  gameId: string,
  messages: ReadonlyArray<ChatMessage>,
  plan: OnboardingPlan,
) => saveDraftToStorage(teamId, gameId, messages, plan);
const clearDraft = clearDraftFromStorage;

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
          roads: Array.isArray(restored.plan.roads)
            ? [...restored.plan.roads]
            : [],
          pois: Array.isArray(restored.plan.pois)
            ? [...restored.plan.pois]
            : [],
          dangerSources: Array.isArray(restored.plan.dangerSources)
            ? [...restored.plan.dangerSources]
            : [],
          waterBodies: Array.isArray(restored.plan.waterBodies)
            ? [...restored.plan.waterBodies]
            : [],
          musicZones: Array.isArray(restored.plan.musicZones)
            ? [...restored.plan.musicZones]
            : [],
          ambientZones: Array.isArray(restored.plan.ambientZones)
            ? [...restored.plan.ambientZones]
            : [],
          sfxTriggers: Array.isArray(restored.plan.sfxTriggers)
            ? [...restored.plan.sfxTriggers]
            : [],
          mines: Array.isArray(restored.plan.mines)
            ? [...restored.plan.mines]
            : [],
          wildernessBoundary: restored.plan.wildernessBoundary ?? null,
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
  // R1.P15 — discoverable plugins from PluginRegistryService.
  // Sent to agent-server with each /design request so the
  // LIST_PLUGINS action sees actual on-disk plugins instead of
  // a hardcoded 2-element fallback.
  // R2.P10 — also carries entityTypeContributions so
  // LIST_ENTITY_TYPES reads from live plugin.json instead of the
  // static eliza-game-builder mirror.
  // Same fetch as BuildingBlocksPanel below; kept here at the
  // dialog scope so the chat handler has access to it.
  const [installablePlugins, setInstallablePlugins] = useState<
    Array<{
      id: string;
      npmName: string | null;
      name: string;
      description: string;
      tags: string[];
      entityTypeContributions?: Array<{
        kind: "npc" | "mobSpawn" | "resource" | "station";
        type: string;
        description: string;
        requiredFields: string[];
        acceptedAssetTypes: string[];
      }>;
      // Phase 3.1 of PLAN_AAA_MASTER_AUDIT — 6 uniform string-
      // array contribution kinds the plugin's `plugin.json`
      // declares. Forwarded to agent-server so `LIST_COMMANDS`
      // and `LIST_CONTRIBUTIONS` return real plugin-declared
      // identifiers the agent can reference.
      commandContributions?: string[];
      systemContributions?: string[];
      entityContributions?: string[];
      widgetContributions?: string[];
      manifestSchemaContributions?: string[];
      paletteCategoryContributions?: string[];
      toolbarToolContributions?: string[];
    }>
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
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/plugins/installed", {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        type RegistryEntry = {
          id: string;
          npmName: string | null;
          name: string;
          description: string;
          tags: string[];
          contributions?: {
            entityTypes?: Array<{
              kind: "npc" | "mobSpawn" | "resource" | "station";
              type: string;
              description: string;
              requiredFields: string[];
              acceptedAssetTypes: string[];
            }>;
            commands?: string[];
            systems?: string[];
            entities?: string[];
            widgets?: string[];
            manifestSchemas?: string[];
            paletteCategories?: string[];
            toolbarTools?: string[];
          };
        };
        const json = (await res.json()) as ReadonlyArray<RegistryEntry>;
        if (cancelled) return;
        setInstallablePlugins(
          json.map((p) => ({
            id: p.id,
            npmName: p.npmName,
            name: p.name,
            description: p.description,
            tags: [...p.tags],
            entityTypeContributions: p.contributions?.entityTypes
              ? p.contributions.entityTypes.map((e) => ({
                  kind: e.kind,
                  type: e.type,
                  description: e.description,
                  requiredFields: [...e.requiredFields],
                  acceptedAssetTypes: [...e.acceptedAssetTypes],
                }))
              : undefined,
            commandContributions: p.contributions?.commands
              ? [...p.contributions.commands]
              : undefined,
            systemContributions: p.contributions?.systems
              ? [...p.contributions.systems]
              : undefined,
            entityContributions: p.contributions?.entities
              ? [...p.contributions.entities]
              : undefined,
            widgetContributions: p.contributions?.widgets
              ? [...p.contributions.widgets]
              : undefined,
            manifestSchemaContributions: p.contributions?.manifestSchemas
              ? [...p.contributions.manifestSchemas]
              : undefined,
            paletteCategoryContributions: p.contributions?.paletteCategories
              ? [...p.contributions.paletteCategories]
              : undefined,
            toolbarToolContributions: p.contributions?.toolbarTools
              ? [...p.contributions.toolbarTools]
              : undefined,
          })),
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "[DesignWithAIDialog] Failed to fetch installable plugins " +
            "(agent will fall back to KNOWN_PLUGINS):",
          err,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      const priorRoads = effectivePlan.roads;
      const priorPois = effectivePlan.pois;
      const priorDangerSources = effectivePlan.dangerSources;
      const priorWaterBodies = effectivePlan.waterBodies;
      const priorMusicZones = effectivePlan.musicZones;
      const priorAmbientZones = effectivePlan.ambientZones;
      const priorSfxTriggers = effectivePlan.sfxTriggers;
      const priorMines = effectivePlan.mines;
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
            installablePlugins,
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
          const finalRoads = (finalPlan as { roads?: unknown[] }).roads;
          const finalPois = (finalPlan as { pois?: unknown[] }).pois;
          const finalDangerSources = (
            finalPlan as { dangerSources?: unknown[] }
          ).dangerSources;
          const finalWaterBodies = (finalPlan as { waterBodies?: unknown[] })
            .waterBodies;
          const finalMusicZones = (finalPlan as { musicZones?: unknown[] })
            .musicZones;
          const finalAmbientZones = (finalPlan as { ambientZones?: unknown[] })
            .ambientZones;
          const finalSfxTriggers = (finalPlan as { sfxTriggers?: unknown[] })
            .sfxTriggers;
          const finalMines = (finalPlan as { mines?: unknown[] }).mines;
          const finalWildernessBoundary = (
            finalPlan as { wildernessBoundary?: unknown }
          ).wildernessBoundary;
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
            roads:
              Array.isArray(finalRoads) && finalRoads.length > 0
                ? [...priorRoads, ...finalRoads]
                : prev.roads,
            pois:
              Array.isArray(finalPois) && finalPois.length > 0
                ? [...priorPois, ...finalPois]
                : prev.pois,
            dangerSources:
              Array.isArray(finalDangerSources) && finalDangerSources.length > 0
                ? [...priorDangerSources, ...finalDangerSources]
                : prev.dangerSources,
            waterBodies:
              Array.isArray(finalWaterBodies) && finalWaterBodies.length > 0
                ? [...priorWaterBodies, ...finalWaterBodies]
                : prev.waterBodies,
            musicZones:
              Array.isArray(finalMusicZones) && finalMusicZones.length > 0
                ? [...priorMusicZones, ...finalMusicZones]
                : prev.musicZones,
            ambientZones:
              Array.isArray(finalAmbientZones) && finalAmbientZones.length > 0
                ? [...priorAmbientZones, ...finalAmbientZones]
                : prev.ambientZones,
            sfxTriggers:
              Array.isArray(finalSfxTriggers) && finalSfxTriggers.length > 0
                ? [...priorSfxTriggers, ...finalSfxTriggers]
                : prev.sfxTriggers,
            mines:
              Array.isArray(finalMines) && finalMines.length > 0
                ? [...priorMines, ...finalMines]
                : prev.mines,
            wildernessBoundary:
              finalWildernessBoundary !== undefined &&
              finalWildernessBoundary !== null
                ? finalWildernessBoundary
                : prev.wildernessBoundary,
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

      // Procgen merge base — was previously selected by
      // "did the agent install the Hyperscape plugin?" which
      // forced HYPERIA_CREATION_CONFIG (Hyperia island shape,
      // useGamePipeline=true → createGameTerrainQuerier with
      // hardcoded Hyperia heightmap + biome polygons) for
      // EVERY RPG-style prompt. Result: tropical / arctic /
      // desert prompts produced the Hyperia island shape
      // because the plugin gates the procgen, not the theme.
      //
      // Right shape: pick HYPERIA_CREATION_CONFIG ONLY when
      // the agent explicitly installed the canonical Hyperia
      // content pack (i.e. the user is asking for a Hyperia
      // clone). For every other theme — tropical, arctic,
      // desert, volcanic, wetland — use MINIMAL_CREATION_CONFIG
      // so procgen runs the generic pipeline driven by the
      // theme's biome registry instead of the Hyperia game-
      // world reproducer. The Hyperscape plugin can still be
      // installed for gameplay (combat, skills, banking) — it
      // just doesn't force the terrain shape anymore.
      //
      // Shallow spread silently corrupts nested objects (terrain,
      // biomes, etc.); deep-merge preserves sibling fields. See
      // mergeProcgenConfig for the full story.
      const seed = Math.floor(Math.random() * 2147483647);
      const agentTerrain = (effectivePlan.terrainConfig ?? {}) as Record<
        string,
        unknown
      >;
      const resolvedSeed =
        typeof agentTerrain.seed === "number" ? agentTerrain.seed : seed;

      // Resolve the FINAL set of pack ids before procgen so the
      // heightmap preset from whichever themed pack is actually
      // installed can drive the procgen shape. Mirrors the
      // `refPackIds` collection that runs after project creation
      // for the install call — same agent picks + collected
      // refs + tag-based fallback. Hoisted here so we can read
      // the active pack's `terrainHeightmapPresets` BEFORE
      // procgen runs, not after.
      const resolvedPackIds = new Set<string>(effectivePlan.assetPackIds ?? []);
      const collectRefsForResolve = (entries: ReadonlyArray<unknown>): void => {
        for (const e of entries) {
          const ref = (e as { assetRef?: unknown })?.assetRef;
          if (typeof ref !== "string") continue;
          const slash = ref.lastIndexOf("/");
          if (slash > 0) resolvedPackIds.add(ref.slice(0, slash));
        }
      };
      collectRefsForResolve(effectivePlan.npcs);
      collectRefsForResolve(effectivePlan.mobSpawns);
      collectRefsForResolve(effectivePlan.resources);
      collectRefsForResolve(effectivePlan.stations);
      collectRefsForResolve(effectivePlan.teleports);
      collectRefsForResolve(effectivePlan.pois);
      collectRefsForResolve(effectivePlan.dangerSources);
      collectRefsForResolve(effectivePlan.waterBodies);
      collectRefsForResolve(effectivePlan.mines);
      // Tag-based fallback if no themed pack was proposed.
      const alreadyHasThemedPack = Array.from(resolvedPackIds).some((id) =>
        id.startsWith("@hyperforge/content-pack-"),
      );
      if (!alreadyHasThemedPack) {
        const inferredPack = inferThemedPackFromCatalog(
          messages,
          installablePacks.map((p) => ({
            manifestId: p.manifestId,
            tags: p.tags,
          })),
        );
        resolvedPackIds.add(
          inferredPack ?? "@hyperforge/content-pack-hyperia-v1",
        );
      }

      const projectIsHyperiaThemed = resolvedPackIds.has(
        "@hyperforge/content-pack-hyperia-v1",
      );
      const baseConfig = projectIsHyperiaThemed
        ? HYPERIA_CREATION_CONFIG
        : MINIMAL_CREATION_CONFIG;

      // Fetch the heightmap preset from the active themed pack.
      // Each themed content pack ships ONE preset under
      // `manifest.terrainHeightmapPresets[0]` (per
      // `server/builtins/content-packs.ts`). The preset's
      // `params` carry WorldCreationConfig overrides
      // (terrain.maxHeight, island.maxWorldSizeTiles, edge
      // noise, etc.) — we deep-merge them into baseConfig so
      // the theme actually shapes the procgen output:
      //   - tropical: smaller atoll-like landmass, irregular coast
      //   - arctic:   bigger mountainous landmass, smoother edges
      //   - desert:   wide flat with mesa relief
      //   - volcanic: tall central peak, rugged
      //   - wetland:  flat low-elevation marsh with many cuts
      //
      // Soft-fail: if the fetch errors or the manifest doesn't
      // ship a preset, the dialog falls back to the base config
      // (no preset merge). Procgen still runs.
      let heightmapPresetParams: Record<string, unknown> | null = null;
      let packVegetationByBiome: Record<
        string,
        Record<string, unknown>
      > | null = null;
      // Asset packs that resolved content packs declare as
      // dependencies. Replaces the previous unconditional Hyperia
      // trees install — strict-catalog: a project gets only the
      // asset packs its installed content packs declare.
      const declaredAssetPackDeps = new Set<string>();
      // Content-pack contributions accumulated across every
      // resolved themed pack. Registered into `contentRegistry`
      // BEFORE procgen runs — without this, procgen reads from
      // an empty registry, falls through to engine defaults, and
      // assigns every tile to the lone "default" biome (the
      // smoking-gun symptom: outliner shows "Default (210
      // tiles)" / "Default (333 tiles)" / etc. instead of named
      // biomes).
      //
      // useProjectLoader's `fetchContentPacksAndRegister` ALSO
      // registers these post-creation when the studio mounts —
      // but the dialog runs procgen BEFORE creating the project,
      // so we have to register here too. Idempotent: the loader's
      // call replaces the same maps with the same data when it
      // fires.
      const registryAccumulator: ContentPackContentInput = {
        biomes: [],
        terrainShaders: [],
        terrainHeightmapPresets: [],
        terrainNoiseFunctions: [],
        waterShaders: [],
        waterAnimations: [],
        vegetationSpecies: [],
        vegetationDensityRules: [],
      };
      try {
        const contentPackIds = Array.from(resolvedPackIds).filter((id) =>
          id.startsWith("@hyperforge/content-pack-"),
        );
        let firstThemedPackUsedForOverrides: string | null = null;
        for (const packId of contentPackIds) {
          const fullPack = await getAssetPack(packId);
          const m = fullPack?.manifest as
            | {
                terrainHeightmapPresets?: ReadonlyArray<{
                  id?: string;
                  params?: Record<string, unknown>;
                }>;
                vegetationByBiome?: Record<string, Record<string, unknown>>;
                assetPackDeps?: ReadonlyArray<string>;
                biomes?: ReadonlyArray<unknown>;
                terrainShaders?: ReadonlyArray<unknown>;
                terrainNoiseFunctions?: ReadonlyArray<unknown>;
                waterShaders?: ReadonlyArray<unknown>;
                waterAnimations?: ReadonlyArray<unknown>;
                vegetationSpecies?: ReadonlyArray<unknown>;
                vegetationDensityRules?: ReadonlyArray<unknown>;
              }
            | null
            | undefined;
          // Accumulate every content-pack section the dialog
          // recognizes. Sections the manifest doesn't ship just
          // stay empty.
          if (Array.isArray(m?.biomes)) {
            (registryAccumulator.biomes as unknown[])!.push(...m.biomes);
          }
          if (Array.isArray(m?.terrainShaders)) {
            (registryAccumulator.terrainShaders as unknown[])!.push(
              ...m.terrainShaders,
            );
          }
          if (Array.isArray(m?.terrainHeightmapPresets)) {
            (registryAccumulator.terrainHeightmapPresets as unknown[])!.push(
              ...m.terrainHeightmapPresets,
            );
          }
          if (Array.isArray(m?.terrainNoiseFunctions)) {
            (registryAccumulator.terrainNoiseFunctions as unknown[])!.push(
              ...m.terrainNoiseFunctions,
            );
          }
          if (Array.isArray(m?.waterShaders)) {
            (registryAccumulator.waterShaders as unknown[])!.push(
              ...m.waterShaders,
            );
          }
          if (Array.isArray(m?.waterAnimations)) {
            (registryAccumulator.waterAnimations as unknown[])!.push(
              ...m.waterAnimations,
            );
          }
          if (Array.isArray(m?.vegetationSpecies)) {
            (registryAccumulator.vegetationSpecies as unknown[])!.push(
              ...m.vegetationSpecies,
            );
          }
          if (Array.isArray(m?.vegetationDensityRules)) {
            (registryAccumulator.vegetationDensityRules as unknown[])!.push(
              ...m.vegetationDensityRules,
            );
          }
          // First themed pack wins on heightmap + vegetation
          // overrides; subsequent themed packs only contribute
          // asset-pack deps. (Multiple themed content packs at
          // once is rare today but the catalog supports it.)
          if (firstThemedPackUsedForOverrides === null) {
            const firstPreset = m?.terrainHeightmapPresets?.[0];
            if (firstPreset?.params) {
              heightmapPresetParams = firstPreset.params;
              // eslint-disable-next-line no-console
              console.info(
                `[DesignWithAIDialog] Applying heightmap preset "${firstPreset.id ?? "(unnamed)"}" from ${packId}`,
              );
            }
            if (
              m?.vegetationByBiome &&
              typeof m.vegetationByBiome === "object"
            ) {
              packVegetationByBiome = m.vegetationByBiome;
              // eslint-disable-next-line no-console
              console.info(
                `[DesignWithAIDialog] Applying vegetation overrides for ${Object.keys(packVegetationByBiome).length} biomes from ${packId}`,
              );
            }
            firstThemedPackUsedForOverrides = packId;
          }
          if (Array.isArray(m?.assetPackDeps)) {
            for (const depId of m.assetPackDeps) {
              if (typeof depId === "string" && depId.length > 0) {
                declaredAssetPackDeps.add(depId);
              }
            }
          }
        }
        if (declaredAssetPackDeps.size > 0) {
          // eslint-disable-next-line no-console
          console.info(
            `[DesignWithAIDialog] Resolved ${declaredAssetPackDeps.size} asset-pack deps from ${contentPackIds.length} content pack(s): ${Array.from(declaredAssetPackDeps).join(", ")}`,
          );
        }
        // Register accumulated content-pack contributions BEFORE
        // procgen runs. The studio's `useProjectLoader` ALSO
        // registers them post-creation (via
        // `fetchContentPacksAndRegister`) — this pre-procgen
        // call closes the timing gap where procgen would
        // otherwise see an empty registry and assign every tile
        // to the engine's lone "default" biome (the bug visible
        // as `Default (210 tiles)` / `Default (333 tiles)` /
        // etc. in the outliner instead of named biomes).
        const accumulatedBiomes = registryAccumulator.biomes ?? [];
        if (accumulatedBiomes.length > 0) {
          // eslint-disable-next-line no-console
          console.info(
            `[DesignWithAIDialog] Registering ${accumulatedBiomes.length} content-pack biomes into runtime registry pre-procgen: ${accumulatedBiomes
              .map((b) => (b as { id?: string }).id)
              .filter(Boolean)
              .join(", ")}`,
          );
          setContentPackContent(registryAccumulator);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "[DesignWithAIDialog] themed-pack fetch failed; using base config:",
          err,
        );
      }

      // Merge order for terrain knobs: baseConfig → heightmap
      // preset → agent's PROPOSE_TERRAIN_CONFIG. Vegetation is
      // an additive overlay merged separately below — the
      // pack's per-biome scatter rules add new keys onto the
      // base config's vegetation map, which the worker then
      // looks up at scatter time using each tile's biome id.
      // Each later layer wins on overlapping keys. Agent's
      // explicit emission has highest priority since it
      // represents user intent expressed through the chat.
      const baseWithPreset = heightmapPresetParams
        ? (mergeProcgenConfig(
            baseConfig as unknown as Record<string, unknown>,
            heightmapPresetParams,
            resolvedSeed,
          ) as unknown as Record<string, unknown>)
        : (baseConfig as unknown as Record<string, unknown>);
      const baseWithVegetation = packVegetationByBiome
        ? (mergeProcgenConfig(
            baseWithPreset,
            { vegetation: packVegetationByBiome },
            resolvedSeed,
          ) as unknown as Record<string, unknown>)
        : baseWithPreset;
      const procgenConfig = mergeProcgenConfig(
        baseWithVegetation,
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
      if (effectivePlan.roads.length > 0) {
        patch.roads = effectivePlan.roads;
      }
      if (effectivePlan.pois.length > 0) {
        patch.pois = effectivePlan.pois;
      }
      if (effectivePlan.dangerSources.length > 0) {
        patch.dangerSources = effectivePlan.dangerSources;
      }
      if (effectivePlan.waterBodies.length > 0) {
        patch.waterBodies = effectivePlan.waterBodies;
      }
      if (effectivePlan.musicZones.length > 0) {
        patch.musicZones = effectivePlan.musicZones;
      }
      if (effectivePlan.ambientZones.length > 0) {
        patch.ambientZones = effectivePlan.ambientZones;
      }
      if (effectivePlan.sfxTriggers.length > 0) {
        patch.sfxTriggers = effectivePlan.sfxTriggers;
      }
      if (effectivePlan.mines.length > 0) {
        patch.mines = effectivePlan.mines;
      }
      if (effectivePlan.wildernessBoundary !== null) {
        patch.wildernessBoundary = effectivePlan.wildernessBoundary;
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

      // Strict-catalog: install only what packs declare. The
      // resolved set = pack-ids the agent proposed +
      // entity-ref-derived packs + the union of `assetPackDeps`
      // declared by every installed content pack (computed
      // above as `declaredAssetPackDeps`). The previous
      // unconditional `@hyperforge/asset-pack-hyperia-trees-v1`
      // append is gone — content packs that need those tree
      // GLBs declare the dep themselves; packs with their own
      // tree assets bring different deps.
      const refPackIds = new Set<string>(resolvedPackIds);
      for (const depId of declaredAssetPackDeps) {
        refPackIds.add(depId);
      }
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
  const hasTheme = isSlotSet(plan, "theme");
  const setCountAll = countSetSlots(plan, "all");
  const setCountPrimary = countSetSlots(plan, "primary");
  const setCountSecondary = countSetSlots(plan, "secondary");
  const primarySlots = PLAN_SLOTS.filter((s) => s.tier === "primary");
  const secondarySlots = PLAN_SLOTS.filter((s) => s.tier === "secondary");
  const totalSlots = PLAN_SLOTS.length;
  const totalPrimary = primarySlots.length;
  const allPrimarySet = setCountPrimary === totalPrimary;
  // Build is gated on having at least one primary slot set (the
  // user's intent must be visible). Secondary slots fill in
  // organically — the agent emits them based on theme without
  // the user having to ask.
  const [worldDetailOpen, setWorldDetailOpen] = useState(setCountSecondary > 0);
  // Auto-expand when the agent fills a secondary slot so the
  // user sees the work happening.
  useEffect(() => {
    if (setCountSecondary > 0) setWorldDetailOpen(true);
  }, [setCountSecondary]);

  // Theme summary — extract the content pack id from
  // `assetPackIds` and show its short name (arctic, tropical,
  // desert, volcanic, wetland, hyperia).
  const themePackId = (plan.assetPackIds ?? []).find((id) =>
    id.startsWith("@hyperforge/content-pack-"),
  );
  const themeSummary = themePackId
    ? themePackId
        .replace(/^@hyperforge\/content-pack-/, "")
        .replace(/-v\d+$/, "")
    : "No theme picked yet";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold text-text-primary">
            Project Plan
          </div>
          <div
            className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
              allPrimarySet
                ? "bg-primary/15 text-primary"
                : "bg-bg-tertiary text-text-tertiary"
            }`}
          >
            {setCountAll}/{totalSlots}
          </div>
        </div>
        <div className="text-[11px] text-text-tertiary mt-1 leading-snug">
          {allPrimarySet
            ? "All core slots set. Generate your world below."
            : "Click an empty slot to ask the agent to fill it."}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto design-ai-scrollbar px-3 py-3 space-y-2">
        {/* Theme — content pack identity. The single most
            user-visible decision: what climate is this world?
            Surfaces the content pack the agent installed (or
            the user picked); falls through to empty CTA. */}
        <PlanSlot
          icon={<Palette size={14} />}
          title="Theme"
          set={hasTheme}
          summary={hasTheme ? themeSummary : "No theme picked yet"}
          actionLabel="Pick a climate"
          onAction={
            hasTheme ? undefined : () => onAskFor(getEmptyPrompt("theme"))
          }
          actionDisabled={isPending || isCreating}
        />

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

        {/* World Detail — secondary slots collapsed by default,
            auto-expanded once the agent fills any of them. The
            user sees roads/POIs/water/audio/mines/etc. without
            having to ask, but they don't dominate the panel. */}
        <button
          type="button"
          onClick={() => setWorldDetailOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 mt-2 rounded-md bg-bg-tertiary/40 hover:bg-bg-tertiary/60 ring-1 ring-white/[0.04] transition-colors"
        >
          <div className="flex items-center gap-2">
            {worldDetailOpen ? (
              <ChevronDown size={12} className="text-text-tertiary" />
            ) : (
              <ChevronRight size={12} className="text-text-tertiary" />
            )}
            <div className="text-[11px] font-semibold text-text-secondary">
              World Detail
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-secondary text-text-tertiary">
              {setCountSecondary}/{secondarySlots.length}
            </span>
          </div>
          <div className="text-[10px] text-text-tertiary">
            roads · pois · audio · mines · water
          </div>
        </button>

        {worldDetailOpen && (
          <div className="space-y-1.5 pt-1">
            {secondarySlots.map((slot) => {
              const set = isSlotSet(plan, slot.key);
              const Icon = slot.Icon;
              const summary = secondarySlotSummary(plan, slot.key);
              return (
                <PlanSlot
                  key={slot.key}
                  icon={<Icon size={14} />}
                  title={slot.short}
                  set={set}
                  summary={summary}
                  countBadge={
                    set ? secondarySlotCount(plan, slot.key) : undefined
                  }
                  actionLabel={`Add ${slot.short.toLowerCase()}`}
                  onAction={set ? undefined : () => onAskFor(slot.emptyPrompt)}
                  actionDisabled={isPending || isCreating}
                >
                  {set && (
                    <SecondarySlotEntryList plan={plan} slotKey={slot.key} />
                  )}
                </PlanSlot>
              );
            })}
          </div>
        )}
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
              : allPrimarySet
                ? "bg-gradient-to-br from-primary via-primary to-primary/90 text-white shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50 ring-1 ring-primary/40"
                : "bg-gradient-to-br from-primary to-primary/85 text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/40"
          }`}
        >
          {canBuild && !isCreating && (
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          )}
          {/* Subtle ambient pulse when fully ready */}
          {allPrimarySet && canBuild && !isCreating && (
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
                className={`relative z-10 ${allPrimarySet ? "drop-shadow-[0_0_4px_rgba(255,255,255,0.6)]" : ""}`}
              />
              <span className="relative z-10">
                {allPrimarySet ? "Generate your world" : "Generate world"}
              </span>
            </>
          )}
        </button>
        {!canBuild && !isCreating && (
          <div className="text-[10.5px] text-text-tertiary text-center leading-snug">
            {setCountAll === 0
              ? "Tell the agent what you want to build."
              : "Fill at least one slot to enable build."}
          </div>
        )}
        {canBuild && !isCreating && setCountAll < totalSlots && (
          <div className="text-[10.5px] text-text-tertiary text-center leading-snug">
            Building with {setCountAll} of {totalSlots} slots — defaults fill
            the rest.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Inline entry list for a secondary plan slot — shows what
 * actually got placed. Without this, the user sees only count
 * badges ("3 placed") and has to dig into the outliner to see
 * which roads / POIs / mines / water bodies the agent
 * authored.
 *
 * Renders up to MAX_INLINE entries, with a "+N more" tail when
 * the list is longer. Each row is a single line: primary label
 * (name → id → fallback) and a secondary detail extracted per
 * slot (type, category, position, polygon vertex count, etc.).
 *
 * Generic — drives off the slot key, so adding a new slot type
 * doesn't require duplicating expand UI. Per-key field
 * extraction lives in `extractEntrySummary` (in utils/secondarySlotSummaries.ts).
 */
interface SecondarySlotEntryListProps {
  plan: OnboardingPlan;
  slotKey: PlanSlotKey;
}

const MAX_INLINE_ENTRIES = 5;

function SecondarySlotEntryList({
  plan,
  slotKey,
}: SecondarySlotEntryListProps): React.ReactElement | null {
  const entries = collectSecondarySlotEntries(plan, slotKey);
  if (entries.length === 0) return null;
  const visible = entries.slice(0, MAX_INLINE_ENTRIES);
  const overflow = entries.length - visible.length;
  return (
    <div className="mt-2 space-y-1">
      {visible.map((entry, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-bg-primary/60 rounded-md text-[11px] ring-1 ring-white/[0.05]"
        >
          <div className="flex-1 min-w-0">
            <div className="text-text-primary truncate font-medium">
              {entry.primary}
            </div>
            {entry.detail && (
              <div className="text-text-tertiary truncate text-[10px]">
                {entry.detail}
              </div>
            )}
          </div>
        </div>
      ))}
      {overflow > 0 && (
        <div className="text-[10.5px] text-text-tertiary px-2.5 py-1 italic">
          +{overflow} more
        </div>
      )}
    </div>
  );
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

// ──────────────────────── helpers ──────────────────────────────
