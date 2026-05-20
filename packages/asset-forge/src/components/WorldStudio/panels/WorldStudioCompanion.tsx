/**
 * WorldStudioCompanion — persistent in-studio AI chat dock.
 *
 * Phase B1'.3 of `PLAN_PROJECT_AS_DATA.md`. The onboarding dialog
 * (`DesignWithAIDialog`) only opens when the user is creating a
 * brand-new project. Once a project exists and the user is in
 * World Studio, this panel keeps the agent available for follow-up
 * edits — "make this terrain colder", "add a quest giver here",
 * "swap to a shooter HUD" — without leaving the editor.
 *
 * Today's surface (B1'.3.1):
 *
 *   - SSE-streaming chat against `/design/stream` in onboarding
 *     mode so the agent can emit `PROPOSE_*` actions.
 *   - Conversation history persists per-project in localStorage.
 *   - When the agent emits `PROPOSE_UI_PACK`, we apply it via
 *     `setAgentPack` + `persistAgentPackToProject`.
 *   - When the agent emits `PROPOSE_NPC_PLACEMENT`, we apply via
 *     `setAndPersistAgentNpc`.
 *   - Terrain / plugin proposals are surfaced as text only — the
 *     project mutation surface for those (B1'.2.3) ships next.
 */

import {
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useWorldStudio } from "../WorldStudioContext";
import { setAgentPack, persistAgentPackToProject } from "../state/agentPack";
import {
  getAgentWorldContent,
  removeAndPersistAgentEntity,
  setAndPersistAgentQuest,
  setAndPersistAgentZone,
} from "../state/agentWorldContent";
import { useAgentPlacementDispatcher } from "../hooks/useAgentPlacementDispatcher";
import { buildTerrainSummary } from "../utils/buildTerrainSummary";
import {
  applyProposalToDispatcher,
  prettifyToolName,
} from "../utils/proposeActionRegistry";
import { summarizeToolCalls } from "../utils/toolBreadcrumbSummary";
import {
  clearCompanionDraft,
  loadCompanionDraft,
  saveCompanionDraft,
} from "../utils/companionDraftStorage";
import { generateWorldFromConfig } from "../../WorldBuilder/worldGeneration";
import {
  HYPERIA_CREATION_CONFIG,
  MINIMAL_CREATION_CONFIG,
} from "../../WorldBuilder/types";
import { serializeWorld } from "../../WorldBuilder/utils/worldPersistence";
import { saveWorldProject } from "../../../utils/worldProjectApi";
import { mergeProcgenConfig } from "../utils/mergeProcgenConfig";
// WorldArea* type imports dropped — Phase 1.3 third cut moved
// the per-action dispatcher casts into `applyProposalToDispatcher`
// in the registry, where the payload flows through as `unknown`
// and the dispatcher's own method signatures own the typing.
import {
  kickoffAssetGeneration,
  type AgentAssetProposal,
} from "../../../utils/assetGenApi";
import {
  resolveProjectAssetPacks,
  listInstallableAssetPacks,
  setProjectAssetPacks,
  getAssetPack,
  type InstallablePackSummary,
} from "../../../utils/assetPackApi";
import { setProjectPlugins } from "../../../utils/worldProjectApi";
import { parseSSEStream } from "../utils/parseSSEStream";
import { DEFAULT_DESIGN_ENDPOINT } from "../utils/designEndpoint";
import { findLatestAgentIndex } from "../utils/chatMessageHelpers";
import { toNpmName } from "../utils/pluginManifestNpm";

interface ChatMessage {
  role: "user" | "agent";
  text: string;
  /** B1'.4 — clickable choice chips offered on the agent's last turn. */
  choices?: {
    question: string | null;
    choices: ReadonlyArray<{ label: string; prompt: string }>;
  } | null;
  /** Tool-call breadcrumbs — what the agent actually did this turn. */
  toolBreadcrumbs?: ReadonlyArray<{ icon: string; label: string }>;
}

interface DesignResponse {
  ok: boolean;
  pack?: unknown;
  finalText?: string;
  turns?: number;
  truncated?: boolean;
  error?: string;
  plan?: {
    terrainConfig: unknown | null;
    pluginIds: ReadonlyArray<string> | null;
    npcs: ReadonlyArray<unknown>;
    uiPack: unknown | null;
  };
  choices?: ChatMessage["choices"];
}

interface StreamTurnEvent {
  turn: number;
  assistantText: string;
  toolCalls: ReadonlyArray<{ name: string; success: boolean; data: unknown }>;
}

function initialGreeting(): ChatMessage {
  return {
    role: "agent",
    text: "Hi! I'm your project companion. Ask me to swap the HUD, drop in a quest giver, or rough up the terrain. I'll edit the live project as we chat.",
  };
}

export function WorldStudioCompanion() {
  const { state } = useWorldStudio();
  const projectId = state.project.currentProjectId;

  // No project yet (rare in studio, but defensive): just say so.
  if (!projectId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center px-6 py-8 gap-2 text-text-tertiary text-xs">
        <Sparkles size={20} className="text-primary/60" />
        <div>Save the project to start chatting with the AI companion.</div>
      </div>
    );
  }

  return <CompanionInner projectId={projectId} />;
}

function CompanionInner({ projectId }: { projectId: string }) {
  // A3 — companion needs templateId + plugins for projectContext
  // we send to the agent so it can introspect via GET_PROJECT_STATE.
  const { state, actions } = useWorldStudio();
  const templateId = state.project.templateId;
  const projectPlugins = state.project.plugins;
  const projectAssetPackIds = state.project.assetPacks;
  const teamId = state.project.currentTeamId;

  // P0.3 of PLAN_AGENT_STUDIO_PARITY — agent placements now flow
  // through the studio's reducer into `extendedLayers`, sharing
  // the property panel / gizmo / outliner / undo machinery with
  // designer + procgen entries. The dispatcher applies the
  // bidirectional mapper (agent's WorldArea* shape + game-space
  // → studio's Placed* shape + scene-space) and dispatches via
  // `actions.addNPC`/etc.
  const placementDispatcher = useAgentPlacementDispatcher();

  // Boot from localStorage if available — versioned envelope +
  // safe-fail behavior owned by `companionDraftStorage`.
  const restored = loadCompanionDraft<ChatMessage>(projectId);

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    restored ? [...restored.messages] : [initialGreeting()],
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  // Persist on every change — empty/greeting-only threads are
  // cleared rather than stored (handled inside saveCompanionDraft).
  useEffect(() => {
    saveCompanionDraft<ChatMessage>(projectId, messages);
  }, [projectId, messages]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending]);

  const applyTurnSideEffects = useCallback(
    (detail: StreamTurnEvent) => {
      if (detail.toolCalls.length > 0) {
        const last = detail.toolCalls[detail.toolCalls.length - 1]!;
        setPendingStatus(prettifyToolName(last.name));
      } else if (detail.assistantText) {
        setPendingStatus("Drafting reply…");
      }
      for (const call of detail.toolCalls) {
        if (!call.success || !call.data) continue;
        const data = call.data as Record<string, unknown>;
        if (
          call.name === "PROPOSE_TERRAIN_CONFIG" &&
          data.config !== undefined
        ) {
          // Regenerate the world with the agent's new terrain
          // config. This is destructive — biome layout, town
          // placement, road connectivity all change. extendedLayers
          // entities (designer + agent placements) survive (they're
          // a separate state slice) but their coords may now sit on
          // different biomes / different elevations / underwater
          // depending on how the new terrain shapes up.
          //
          // The terrain-snap in the dispatcher fires at PLACEMENT
          // time, not at terrain-regen time, so existing y values
          // stay where they were. Future P10 (brush ops) can add
          // a "re-snap all entities to new terrain" sweep.
          // Async IIFE so we can await the themed-pack manifest
          // fetch (heightmap preset + vegetationByBiome). Treated
          // as fire-and-forget; if the fetch errors the regen
          // still runs against the base config.
          void (async () => {
            try {
              const agentTerrain = data.config as Record<string, unknown>;
              const seed =
                typeof agentTerrain.seed === "number"
                  ? agentTerrain.seed
                  : Math.floor(Math.random() * 2147483647);
              // Deep-merge nested config sections so the agent emitting
              // partial `terrain: { worldSize: 100 }` doesn't wipe
              // tileSize / maxHeight / tileResolution from the base.
              // Without this, procgen reads undefined values and
              // writes NaN into the heightmap → "Computed radius is
              // NaN" error spam from BufferGeometry.
              //
              // R1.P1 (PLAN_HYPERIA_DECOUPLING): pick the merge base
              // from the project's plugin set, not from a global
              // default.
              //   - Hyperia plugin → HYPERIA_CREATION_CONFIG (full
              //     Hyperia preset with tree species + town presets).
              //   - else → MINIMAL_CREATION_CONFIG (procgen biomes,
              //     empty species per biome, townCount=0). The
              //     agent's PROPOSE_* actions fill in specifics.
              const projectTargetsHyperia = projectPlugins.some(
                (id) =>
                  id === "@hyperforge/hyperscape" ||
                  id === "com.hyperforge.hyperscape",
              );
              const baseConfig = projectTargetsHyperia
                ? HYPERIA_CREATION_CONFIG
                : MINIMAL_CREATION_CONFIG;
              // Pull the active themed content pack's heightmap
              // preset + vegetation overrides — same path as
              // DesignWithAIDialog's onboarding flow. Mid-edit
              // PROPOSE_TERRAIN_CONFIG calls now respect the
              // theme's island shape and per-biome scatter rules
              // instead of ignoring them.
              let heightmapPresetParams: Record<string, unknown> | null = null;
              let packVegetationByBiome: Record<
                string,
                Record<string, unknown>
              > | null = null;
              try {
                const themedPackId = projectAssetPackIds.find((id) =>
                  id.startsWith("@hyperforge/content-pack-"),
                );
                if (themedPackId) {
                  const fullPack = await getAssetPack(themedPackId);
                  const m = fullPack?.manifest as
                    | {
                        terrainHeightmapPresets?: ReadonlyArray<{
                          id?: string;
                          params?: Record<string, unknown>;
                        }>;
                        vegetationByBiome?: Record<
                          string,
                          Record<string, unknown>
                        >;
                      }
                    | null
                    | undefined;
                  const firstPreset = m?.terrainHeightmapPresets?.[0];
                  if (firstPreset?.params) {
                    heightmapPresetParams = firstPreset.params;
                  }
                  if (
                    m?.vegetationByBiome &&
                    typeof m.vegetationByBiome === "object"
                  ) {
                    packVegetationByBiome = m.vegetationByBiome;
                  }
                }
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn(
                  "[Companion] themed-pack fetch failed; using base config:",
                  err,
                );
              }
              const baseWithPreset = heightmapPresetParams
                ? (mergeProcgenConfig(
                    baseConfig as unknown as Record<string, unknown>,
                    heightmapPresetParams,
                    seed,
                  ) as unknown as Record<string, unknown>)
                : (baseConfig as unknown as Record<string, unknown>);
              const baseWithVegetation = packVegetationByBiome
                ? (mergeProcgenConfig(
                    baseWithPreset,
                    { vegetation: packVegetationByBiome },
                    seed,
                  ) as unknown as Record<string, unknown>)
                : baseWithPreset;
              const procgenConfig = mergeProcgenConfig(
                baseWithVegetation,
                agentTerrain,
                seed,
              );
              const newWorld = generateWorldFromConfig(
                procgenConfig as unknown as Parameters<
                  typeof generateWorldFromConfig
                >[0],
              );
              actions.loadWorld(newWorld);
              // LOAD_WORLD sets hasUnsavedChanges=false (it's a load
              // semantically), so useAutoSave won't fire. Persist
              // directly so the new terrain survives a refresh.
              //
              // Critically: include the CURRENT extendedLayers in the
              // serialized worldData. Without this, the save passes
              // ONLY the new world (foundation + manifest layers) and
              // overwrites the persisted extendedLayers with nothing —
              // silently wiping every agent + designer placement on
              // disk. autoSave merges them in normally; we have to
              // mirror that behavior here.
              const serialized = serializeWorld(newWorld) as unknown as Record<
                string,
                unknown
              >;
              const ext = state.extendedLayers;
              const hasExt = Object.values(ext).some((v) =>
                Array.isArray(v) ? v.length > 0 : v !== null,
              );
              if (hasExt) serialized.extendedLayers = ext;
              void saveWorldProject(projectId, {
                worldData: serialized,
              }).catch((err: unknown) => {
                // eslint-disable-next-line no-console
                console.warn("[Companion] Terrain regen save failed:", err);
              });
            } catch (err) {
              // eslint-disable-next-line no-console
              console.warn("[Companion] Terrain regen failed:", err);
            }
          })();
        } else if (call.name === "PROPOSE_UI_PACK" && data.pack !== undefined) {
          const r = setAgentPack(data.pack);
          if (r.ok) {
            void persistAgentPackToProject(
              projectId,
              data.pack as Parameters<typeof persistAgentPackToProject>[1],
            );
          }
        } else if (
          applyProposalToDispatcher(
            placementDispatcher as unknown as Record<string, unknown>,
            call.name,
            data,
          )
        ) {
          // Phase 1.3 third cut: 14 placement-dispatcher else-if
          // arms collapsed into one registry-driven dispatch.
          // Covers PROPOSE_NPC_PLACEMENT / MOB_SPAWN / STATION /
          // TELEPORT / RESOURCE / ROAD / POI / DANGER_SOURCE /
          // WATER_BODY / MUSIC_ZONE / AMBIENT_ZONE / SFX_TRIGGER
          // / MINE / WILDERNESS_BOUNDARY — see
          // `proposeActionRegistry.ts` for the action→method
          // mapping. PROPOSE_QUEST / PROPOSE_ZONE have separate
          // persistence paths (state slices live outside the
          // studio reducer) so they stay below as bespoke arms.
        } else if (call.name === "PROPOSE_QUEST" && data.quest !== undefined) {
          // Quests live in worldContent (separate from extendedLayers).
          // Keep the legacy persistence path until P0.6 unifies.
          void setAndPersistAgentQuest(projectId, data.quest);
        } else if (call.name === "PROPOSE_ZONE" && data.zone !== undefined) {
          // Zones likewise — separate state slice from extendedLayers.
          void setAndPersistAgentZone(projectId, data.zone);
        } else if (
          call.name === "REMOVE_FROM_PROJECT" &&
          data.removal !== undefined
        ) {
          // A4 — apply the agent's removal to the local store and
          // re-persist. Removals are idempotent server-side; if
          // the entity isn't in the local store (e.g. agent removed
          // something the user added manually), we still persist
          // the up-to-date snapshot.
          const removal = data.removal as {
            kind:
              | "npc"
              | "quest"
              | "zone"
              | "asset"
              | "station"
              | "teleport"
              | "mobSpawn"
              | "resource";
            id?: string;
            mobId?: string;
            resourceId?: string;
            position?: { x: number; y: number; z: number };
          };
          // P0.3 — removals route through the studio reducer
          // (`actions.removeNPC` / `removeMobSpawn` / etc.) so the
          // gizmo / properties / outliner all see the change in
          // sync with the underlying state. extendedLayers is
          // auto-saved to the project, no explicit persistence
          // call required.
          //
          // For composite-keyed kinds (mobSpawn / resource), match
          // by the synthesized id the forward mapper produces:
          // `<key>@x,y,z` in scene-space. The agent emits in
          // game-space, so we add worldCenterOffset before matching.
          if (
            removal.kind === "mobSpawn" &&
            removal.mobId &&
            removal.position
          ) {
            const p = removal.position;
            const offset = placementDispatcher.worldCenterOffset;
            const sceneId = `${removal.mobId}@${p.x + offset},${p.y},${p.z + offset}`;
            actions.removeMobSpawn(sceneId);
          } else if (
            removal.kind === "resource" &&
            removal.resourceId &&
            removal.position
          ) {
            const p = removal.position;
            const offset = placementDispatcher.worldCenterOffset;
            const sceneId = `${removal.resourceId}@${p.x + offset},${p.y},${p.z + offset}`;
            actions.removeResource(sceneId);
          } else if (removal.kind === "npc" && removal.id) {
            actions.removeNPC(removal.id);
          } else if (removal.kind === "station" && removal.id) {
            actions.removeStation(removal.id);
          } else if (removal.kind === "teleport" && removal.id) {
            actions.removeTeleport(removal.id);
          } else if (
            (removal.kind === "quest" || removal.kind === "zone") &&
            removal.id
          ) {
            // Quests + zones still live in agentWorldContent + the
            // worldContent JSON shape (separate from extendedLayers).
            // P0.6 will migrate them to studio state slices; for now
            // route through the legacy persister so they actually
            // disappear instead of silently no-op'ing.
            void removeAndPersistAgentEntity(
              projectId,
              removal.kind,
              removal.id,
            );
          }
          // `asset` removal continues to be a separate concern —
          // the host's pipeline status panel handles bake
          // cancellation, not the world-content store.
        } else if (call.name === "PROPOSE_ASSET" && data.asset !== undefined) {
          // A5 — fire the bake pipeline asynchronously. The agent's
          // job ends with the proposal; the host owns the long-
          // running generation. Errors are surfaced to console
          // (non-fatal — chat continues).
          void kickoffAssetGeneration(data.asset as AgentAssetProposal).then(
            (kickoff) => {
              // eslint-disable-next-line no-console
              console.info(
                "[Companion] Asset bake started:",
                kickoff.assetId,
                "pipelineId=",
                kickoff.pipelineId,
              );
            },
            (err: unknown) => {
              // eslint-disable-next-line no-console
              console.warn("[Companion] Asset bake kickoff failed:", err);
            },
          );
        } else if (
          call.name === "PROPOSE_ASSET_PACK_INSTALL" &&
          Array.isArray(data.assetPackIds)
        ) {
          // AP5 — agent recommended installing packs. Merge with
          // the existing list (additive — agent emits "what to add",
          // never "the new full list"), then POST the union back.
          const newIds = (data.assetPackIds as unknown[]).filter(
            (x): x is string => typeof x === "string",
          );
          const existing = new Set(projectAssetPackIds);
          for (const id of newIds) existing.add(id);
          const merged = Array.from(existing);
          void setProjectAssetPacks(projectId, merged)
            .then(() => {
              // Mirror the new list into studio state so the rest
              // of the UI (palette gate, content browser, plugin
              // missing-deps warnings, next agent request's
              // projectContext) sees the install immediately —
              // matches the manual install path in
              // AssetPackBrowserPanel. Without this, an agent
              // install only takes effect after a project reload.
              actions.setProject(
                state.project.currentTeamId ?? "",
                state.project.currentGameId ?? "",
                projectId,
                state.project.projectName ?? "",
                state.project.projectVersion + 1,
                state.project.gameMode,
                state.project.templateId,
                state.project.plugins,
                merged,
              );
            })
            .catch((err: unknown) => {
              // eslint-disable-next-line no-console
              console.warn("[Companion] Failed to install asset packs:", err);
            });
        } else if (
          call.name === "PROPOSE_PLUGIN_SET" &&
          Array.isArray(data.pluginIds)
        ) {
          // Agent swapped the gameplay plugin set. Translate
          // manifest ids → npm ids (matches resolveProjectPluginSet)
          // and replace the project's plugins column. The current
          // world may need a Play restart for the new plugin set
          // to take effect — surfacing that is the system prompt's
          // job (it tells the agent to confirm before emitting).
          const incoming = (data.pluginIds as unknown[]).filter(
            (x): x is string => typeof x === "string",
          );
          const npmIds = incoming.map((id) => toNpmName(id));
          void setProjectPlugins(projectId, npmIds)
            .then(() => {
              // Mirror into studio state so the next agent request's
              // projectContext sees the new plugin set without a
              // project reload — same pattern as the asset-pack
              // mirror above.
              actions.setProject(
                state.project.currentTeamId ?? "",
                state.project.currentGameId ?? "",
                projectId,
                state.project.projectName ?? "",
                state.project.projectVersion + 1,
                state.project.gameMode,
                state.project.templateId,
                npmIds,
                state.project.assetPacks,
              );
            })
            .catch((err: unknown) => {
              // eslint-disable-next-line no-console
              console.warn("[Companion] Failed to set plugins:", err);
            });
        }
      }
    },
    [projectId, projectAssetPackIds, actions, state.project],
  );

  const sendPrompt = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;

      setMessages((m) => [...m, { role: "user", text: trimmed }]);
      setInput("");
      setPending(true);
      setError(null);
      setPendingStatus(null);

      const history = messages.map((m) => ({
        role: m.role === "agent" ? ("assistant" as const) : ("user" as const),
        text: m.text,
      }));

      // AP4 — resolve installed asset pack manifestIds into the
      // catalog the agent reads via GET_PROJECT_STATE
      // (select=availableAssets). Failures (network / 404) drop
      // silently; agent will just see fewer packs available.
      let resolvedAssetPacks: Awaited<
        ReturnType<typeof resolveProjectAssetPacks>
      > = [];
      try {
        resolvedAssetPacks =
          await resolveProjectAssetPacks(projectAssetPackIds);
      } catch (err) {
        console.warn(
          "[Companion] Failed to resolve asset packs; agent will see empty catalog",
          err,
        );
      }

      // AP5 — fetch the installable-packs catalog so LIST_ASSET_PACKS
      // and PROPOSE_ASSET_PACK_INSTALL have something to read /
      // validate against. Failures drop silently — agent will
      // just see "no packs available to install".
      let installablePacks: InstallablePackSummary[] = [];
      try {
        installablePacks = await listInstallableAssetPacks(teamId ?? undefined);
      } catch (err) {
        console.warn(
          "[Companion] Failed to fetch installable asset packs",
          err,
        );
      }

      // R1.P15 — fetch the installable-plugins catalog backed by
      // PluginRegistryService. LIST_PLUGINS reads through this on
      // the agent side; without it the action falls back to a
      // hardcoded 2-element list. Failures drop silently.
      // R2.P10 — also carry entityTypeContributions so
      // LIST_ENTITY_TYPES reads live plugin.json instead of the
      // static eliza-game-builder mirror.
      type CompanionPluginEntry = {
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
        // Phase 3.1 — 6 uniform string-array contribution kinds.
        // Agent's `LIST_COMMANDS` and generic `LIST_CONTRIBUTIONS`
        // surface these to the agent.
        commandContributions?: string[];
        systemContributions?: string[];
        entityContributions?: string[];
        widgetContributions?: string[];
        manifestSchemaContributions?: string[];
        paletteCategoryContributions?: string[];
        toolbarToolContributions?: string[];
      };
      let installablePlugins: CompanionPluginEntry[] = [];
      try {
        const res = await fetch("/api/plugins/installed", {
          credentials: "same-origin",
        });
        if (res.ok) {
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
          installablePlugins = json.map((p) => ({
            id: p.id,
            npmName: p.npmName,
            name: p.name,
            description: p.description,
            tags: [...p.tags],
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
            entityTypeContributions: p.contributions?.entityTypes
              ? p.contributions.entityTypes.map((e) => ({
                  kind: e.kind,
                  type: e.type,
                  description: e.description,
                  requiredFields: [...e.requiredFields],
                  acceptedAssetTypes: [...e.acceptedAssetTypes],
                }))
              : undefined,
          }));
        }
      } catch (err) {
        console.warn("[Companion] Failed to fetch installable plugins", err);
      }

      // P0.5.b of PLAN_AGENT_STUDIO_PARITY — placements are now in
      // extendedLayers (designer + agent + procgen all merged via
      // P0.3 emit + P0.6 rehydrate). The agent's GET_PROJECT_STATE
      // sees ONE consolidated world from a single source instead
      // of the dual-store merge this used to do.
      //
      // Quests + zones still flow through agentWorldContent until
      // P0.7+ migrates them — read from there for those two kinds.
      // Position is converted from scene-space (extendedLayers) to
      // game-space (the agent's convention) by subtracting the
      // worldCenterOffset.
      const wc = getAgentWorldContent();
      const ext = state.extendedLayers;
      const offset = placementDispatcher.worldCenterOffset;
      const toGameSpace = (p: { x: number; y: number; z: number }) => ({
        x: p.x - offset,
        y: p.y,
        z: p.z - offset,
      });
      // Terrain summary lets the agent know where biomes + towns
      // are, so it can pick land coords + match content to biomes
      // (rather than dropping things in the ocean by emitting raw
      // game-space (0,0,0) coords).
      const terrainSummary = buildTerrainSummary(state.builder.editing.world);

      const projectContext = {
        projectId,
        templateId,
        plugins: projectPlugins,
        assetPacks: resolvedAssetPacks,
        terrainSummary,
        worldContent: {
          npcs: ext.npcs.map((n) => ({
            id: n.id,
            name: n.name,
            type:
              (n as { npcType?: string; npcTypeId?: string }).npcType ??
              (n as { npcTypeId?: string }).npcTypeId ??
              "generic",
            position: toGameSpace(n.position),
            source: (n as { source?: string }).source ?? "designer",
          })),
          spawns: ext.mobSpawns.map((m) => ({
            id: m.id,
            mobId: m.mobId,
            position: toGameSpace(m.position),
            maxCount: m.maxCount,
            spawnRadius: m.spawnRadius,
            source: m.source ?? "designer",
          })),
          resources: ext.resources.map((r) => ({
            id: r.id,
            resourceId: r.resourceId,
            type: r.resourceType,
            position: toGameSpace(r.position),
            source: r.source ?? "designer",
          })),
          stations: ext.stations.map((s) => ({
            id: s.id,
            type: s.stationType,
            position: toGameSpace(s.position),
            source: s.source ?? "designer",
          })),
          teleports: ext.teleports.map((t) => ({
            id: t.id,
            name: t.name,
            position: toGameSpace(t.position),
            source: "designer",
          })),
          zones: Array.from(wc.zones.values()),
          quests: Array.from(wc.quests.values()),
        },
      };

      abortRef.current = new AbortController();
      let finalResponse: DesignResponse | null = null;
      let streamErrored: { message: string } | null = null;
      const toolCallTally = new Map<string, number>();
      try {
        const res = await fetch(`${DEFAULT_DESIGN_ENDPOINT}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmed,
            // F2 — companion mode (project exists, incremental
            // edits) is distinct from onboarding (greenfield).
            mode: "companion",
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
        for await (const parsed of parseSSEStream(res.body)) {
          if (parsed.event === "turn") {
            const turnEvent = parsed.data as StreamTurnEvent;
            applyTurnSideEffects(turnEvent);
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
        if (streamErrored) throw new Error(streamErrored.message);
        if (!finalResponse || !finalResponse.ok) {
          throw new Error(
            (finalResponse as { error?: string })?.error ??
              "Stream ended without result",
          );
        }
        const finalText =
          finalResponse.finalText && finalResponse.finalText.length > 0
            ? finalResponse.finalText
            : "(no response)";
        setMessages((m) => [
          ...m,
          {
            role: "agent",
            text: finalText,
            choices: finalResponse!.choices ?? null,
            toolBreadcrumbs: summarizeToolCalls(toolCallTally),
          },
        ]);
        setLastFailedPrompt(null);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // user cancelled
        } else {
          setError(err instanceof Error ? err.message : String(err));
          setLastFailedPrompt(trimmed);
        }
      } finally {
        abortRef.current = null;
        setPending(false);
        setPendingStatus(null);
      }
    },
    [
      pending,
      messages,
      applyTurnSideEffects,
      projectId,
      templateId,
      projectPlugins,
    ],
  );

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

  const retryLast = useCallback(async () => {
    if (!lastFailedPrompt || pending) return;
    setMessages((m) => {
      const last = m[m.length - 1];
      if (last && last.role === "user") return m.slice(0, -1);
      return m;
    });
    setError(null);
    await sendPrompt(lastFailedPrompt);
  }, [lastFailedPrompt, pending, sendPrompt]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([initialGreeting()]);
    setInput("");
    setError(null);
    setLastFailedPrompt(null);
    setPending(false);
    setPendingStatus(null);
    if (typeof window !== "undefined") {
      try {
        clearCompanionDraft(projectId);
      } catch {
        /* ignore */
      }
    }
  }, [projectId]);

  const latestAgentIdx = findLatestAgentIndex(messages);

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <style>{`
        @keyframes companionFadeUp {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .companion-fade-up { animation: companionFadeUp 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }

        .companion-scrollbar::-webkit-scrollbar { width: 6px; }
        .companion-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .companion-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.06);
          border-radius: 999px;
        }
        .companion-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.14);
        }
      `}</style>
      <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-b from-bg-secondary to-bg-secondary/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-1 ring-primary/30">
            <Sparkles size={11} className="text-primary" />
          </div>
          <span className="text-[12px] font-semibold text-text-primary">
            AI Companion
          </span>
        </div>
        {messages.some((m) => m.role === "user") && (
          <button
            type="button"
            onClick={clearChat}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            title="Clear chat history"
          >
            <RotateCcw size={10} />
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto companion-scrollbar px-3 py-3 space-y-3">
        {messages.map((m, i) => {
          const isLatestAgent = i === latestAgentIdx;
          return (
            <div
              key={i}
              className={`space-y-1.5 ${i > 0 ? "companion-fade-up" : ""}`}
            >
              <ChatBubble message={m} />
              {m.role === "agent" &&
                m.toolBreadcrumbs &&
                m.toolBreadcrumbs.length > 0 && (
                  <div className="flex flex-wrap gap-1 pl-[34px]">
                    {m.toolBreadcrumbs.map((b, bi) => (
                      <span
                        key={bi}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-bg-tertiary/60 ring-1 ring-white/[0.05] text-text-tertiary"
                      >
                        <span>{b.icon}</span>
                        <span>{b.label}</span>
                      </span>
                    ))}
                  </div>
                )}
              {isLatestAgent &&
                m.choices &&
                m.choices.choices.length > 0 &&
                !pending && (
                  <div className="flex flex-wrap gap-1 pl-[34px]">
                    {m.choices.choices.map((c, ci) => (
                      <button
                        key={ci}
                        type="button"
                        onClick={() => void sendPrompt(c.prompt)}
                        className="group inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full bg-gradient-to-br from-primary/20 to-primary/10 ring-1 ring-primary/40 text-text-primary hover:ring-primary/60 hover:shadow-sm hover:shadow-primary/10 transition-all"
                      >
                        <span>{c.label}</span>
                        <ArrowRight
                          size={10}
                          className="text-primary/70 group-hover:translate-x-0.5 transition-transform"
                        />
                      </button>
                    ))}
                  </div>
                )}
            </div>
          );
        })}

        {pending && <TypingIndicator status={pendingStatus} />}
        <div ref={scrollAnchorRef} />
      </div>

      {error && (
        <div className="px-3 pb-2">
          <div className="flex items-start gap-1.5 p-2 bg-red-500/10 ring-1 ring-red-500/25 rounded-lg text-[11px] text-red-300">
            <AlertTriangle
              size={12}
              className="flex-shrink-0 mt-0.5 text-red-400"
            />
            <span className="flex-1 leading-relaxed">{error}</span>
            {lastFailedPrompt && (
              <button
                type="button"
                onClick={() => void retryLast()}
                disabled={pending}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-200 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={10} />
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={sendMessage}
        className="px-3 py-2.5 bg-gradient-to-t from-bg-secondary/60 to-transparent"
      >
        <div className="relative flex items-end gap-2 rounded-lg bg-bg-tertiary ring-1 ring-white/[0.06] focus-within:ring-2 focus-within:ring-primary/40 focus-within:bg-bg-primary/40 transition-all shadow-sm">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && !pending) void sendMessage();
              }
            }}
            disabled={pending}
            placeholder="Ask the AI to edit your project…"
            rows={2}
            className="flex-1 px-3 py-2 pr-1 text-[12px] leading-relaxed bg-transparent text-text-primary focus:outline-none placeholder:text-text-tertiary resize-none disabled:opacity-50"
          />
          <div className="flex items-center pb-1.5 pr-1.5 self-end">
            {pending ? (
              <button
                type="button"
                onClick={cancel}
                className="px-2 py-1 text-[11px] font-medium rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-primary/60 transition-colors"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send"
                className="w-7 h-7 flex items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90 hover:shadow-sm hover:shadow-primary/30 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all"
              >
                <Send size={12} />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end pl-8">
        <div className="max-w-[88%] px-3 py-2 rounded-2xl rounded-tr-md bg-gradient-to-br from-primary/25 to-primary/15 text-text-primary text-[12px] leading-relaxed whitespace-pre-wrap border border-primary/25 shadow-sm shadow-primary/10">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start gap-2 pr-8">
      <CompanionAgentAvatar />
      <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tl-md bg-bg-primary/60 text-text-primary text-[12px] leading-relaxed whitespace-pre-wrap ring-1 ring-white/[0.06] shadow-sm">
        {message.text}
      </div>
    </div>
  );
}

function CompanionAgentAvatar({ pulsing = false }: { pulsing?: boolean }) {
  return (
    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center mt-0.5 ring-1 ring-primary/30 shadow-sm shadow-primary/20">
      <Sparkles
        size={10}
        className={`text-primary ${pulsing ? "animate-pulse" : ""}`}
      />
    </div>
  );
}

function TypingIndicator({ status }: { status: string | null }) {
  return (
    <div className="flex justify-start gap-2 pr-8">
      <CompanionAgentAvatar pulsing />
      <div className="px-3 py-2 rounded-2xl rounded-tl-md bg-bg-primary/60 ring-1 ring-white/[0.06] shadow-sm">
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
            <span className="text-[10px] text-text-tertiary leading-none">
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// `prettifyToolName` lives in `utils/proposeActionRegistry.ts`
// (Phase 1.3 first cut). Imported above.
