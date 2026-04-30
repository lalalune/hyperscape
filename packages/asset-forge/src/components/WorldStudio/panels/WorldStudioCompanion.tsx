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
  mobSpawnKey,
  removeAndPersistAgentEntity,
  setAndPersistAgentNpc,
  setAndPersistAgentQuest,
  setAndPersistAgentResource,
  setAndPersistAgentSpawn,
  setAndPersistAgentStation,
  setAndPersistAgentTeleport,
  setAndPersistAgentZone,
} from "../state/agentWorldContent";
import {
  kickoffAssetGeneration,
  type AgentAssetProposal,
} from "../../../utils/assetGenApi";
import {
  resolveProjectAssetPacks,
  listInstallableAssetPacks,
  setProjectAssetPacks,
  type InstallablePackSummary,
} from "../../../utils/assetPackApi";

const DEFAULT_DESIGN_ENDPOINT = "http://localhost:5180/design";

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

const COMPANION_VERSION = 1;
function draftKey(projectId: string): string {
  return `hyperforge:companion:draft:${projectId}`;
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

  // Boot from localStorage if available.
  const restored = (() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(draftKey(projectId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        version?: number;
        messages?: ReadonlyArray<ChatMessage>;
      } | null;
      if (
        !parsed ||
        parsed.version !== COMPANION_VERSION ||
        !Array.isArray(parsed.messages) ||
        parsed.messages.length <= 1
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  })();

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    restored ? [...restored.messages!] : [initialGreeting()],
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  // Persist on every change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (messages.length <= 1) {
      try {
        window.localStorage.removeItem(draftKey(projectId));
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      window.localStorage.setItem(
        draftKey(projectId),
        JSON.stringify({ version: COMPANION_VERSION, messages }),
      );
    } catch {
      /* ignore */
    }
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
        if (call.name === "PROPOSE_UI_PACK" && data.pack !== undefined) {
          const r = setAgentPack(data.pack);
          if (r.ok) {
            void persistAgentPackToProject(
              projectId,
              data.pack as Parameters<typeof persistAgentPackToProject>[1],
            );
          }
        } else if (
          call.name === "PROPOSE_NPC_PLACEMENT" &&
          data.entity !== undefined
        ) {
          void setAndPersistAgentNpc(projectId, data.entity);
        } else if (
          call.name === "PROPOSE_MOB_SPAWN" &&
          data.spawn !== undefined
        ) {
          // Spawns have no `id` in the schema; key by composite
          // mobId+position so re-emissions of the same spawn collapse.
          const spawn = data.spawn as {
            mobId?: string;
            position?: { x?: number; y?: number; z?: number };
          };
          const key =
            typeof spawn.mobId === "string"
              ? `${spawn.mobId}@${spawn.position?.x ?? 0},${spawn.position?.y ?? 0},${spawn.position?.z ?? 0}`
              : `agent-spawn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          void setAndPersistAgentSpawn(projectId, data.spawn, key);
        } else if (call.name === "PROPOSE_QUEST" && data.quest !== undefined) {
          void setAndPersistAgentQuest(projectId, data.quest);
        } else if (call.name === "PROPOSE_ZONE" && data.zone !== undefined) {
          void setAndPersistAgentZone(projectId, data.zone);
        } else if (
          call.name === "PROPOSE_STATION" &&
          data.station !== undefined
        ) {
          void setAndPersistAgentStation(projectId, data.station);
        } else if (
          call.name === "PROPOSE_TELEPORT" &&
          data.teleport !== undefined
        ) {
          void setAndPersistAgentTeleport(projectId, data.teleport);
        } else if (
          call.name === "PROPOSE_RESOURCE" &&
          data.resource !== undefined
        ) {
          // Resources don't have a unique top-level id (multiple
          // oak trees are all `tree_oak`), so position
          // disambiguates. Same key shape as mob spawns.
          const r = data.resource as {
            resourceId?: string;
            position?: { x?: number; y?: number; z?: number };
          };
          const key =
            typeof r.resourceId === "string"
              ? `${r.resourceId}@${r.position?.x ?? 0},${r.position?.y ?? 0},${r.position?.z ?? 0}`
              : `agent-resource-${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 6)}`;
          void setAndPersistAgentResource(projectId, data.resource, key);
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
          if (
            removal.kind === "mobSpawn" &&
            removal.mobId &&
            removal.position
          ) {
            void removeAndPersistAgentEntity(
              projectId,
              "mobSpawn",
              mobSpawnKey(removal.mobId, removal.position),
            );
          } else if (
            removal.kind === "resource" &&
            removal.resourceId &&
            removal.position
          ) {
            // Resources use the same composite key shape as
            // mob spawns — `<resourceId>@x,y,z`. Reusing
            // mobSpawnKey under a different name would imply a
            // wrong invariant, so we inline the format here to
            // match the writer-side `setAndPersistAgentResource`
            // call site.
            const p = removal.position;
            void removeAndPersistAgentEntity(
              projectId,
              "resource",
              `${removal.resourceId}@${p.x},${p.y},${p.z}`,
            );
          } else if (
            (removal.kind === "npc" ||
              removal.kind === "quest" ||
              removal.kind === "zone" ||
              removal.kind === "station" ||
              removal.kind === "teleport") &&
            removal.id
          ) {
            void removeAndPersistAgentEntity(
              projectId,
              removal.kind,
              removal.id,
            );
          }
          // `asset` removal isn't applied to agentWorldContent
          // (assets aren't tracked there); the host's pipeline
          // status panel handles bake cancellation separately.
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

      // A3 — snapshot the agent's currently-accumulated content so
      // GET_PROJECT_STATE returns "what the user can already see"
      // not what the agent thinks it has emitted in this run.
      const wc = getAgentWorldContent();
      // Merge designer-placed entities (extendedLayers — palette
      // drag/drop, procgen, brush placements) with agent-emitted
      // ones (agentWorldContent) so GET_PROJECT_STATE reflects the
      // FULL world. Without this the agent thinks the project is
      // empty whenever the user has placed things by hand instead
      // of through chat.
      const ext = state.extendedLayers;
      const projectContext = {
        projectId,
        templateId,
        plugins: projectPlugins,
        assetPacks: resolvedAssetPacks,
        worldContent: {
          npcs: [
            ...Array.from(wc.npcs.values()),
            ...ext.npcs.map((n) => ({
              id: n.id,
              name: n.name,
              type:
                (n as { npcType?: string; npcTypeId?: string }).npcType ??
                (n as { npcTypeId?: string }).npcTypeId ??
                "generic",
              position: n.position,
              source: "designer",
            })),
          ],
          spawns: [
            ...Array.from(wc.spawns.values()),
            ...ext.mobSpawns.map((m) => ({
              mobId: m.mobId,
              position: m.position,
              maxCount: m.maxCount,
              spawnRadius: m.spawnRadius,
              source: "designer",
            })),
          ],
          zones: Array.from(wc.zones.values()),
          quests: Array.from(wc.quests.values()),
          resources: ext.resources.map((r) => ({
            resourceId: r.resourceId,
            type: r.resourceType,
            position: r.position,
            source: "designer",
          })),
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
        window.localStorage.removeItem(draftKey(projectId));
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

function findLatestAgentIndex(messages: ReadonlyArray<ChatMessage>): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "agent") return i;
  }
  return -1;
}

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

function summarizeToolCalls(
  tally: Map<string, number>,
): ReadonlyArray<{ icon: string; label: string }> {
  const out: Array<{ icon: string; label: string }> = [];
  for (const [name, count] of tally) {
    const summary = TOOL_BREADCRUMB_SUMMARY[name];
    if (!summary) continue;
    out.push({ icon: summary.icon, label: summary.label(count) });
  }
  return out;
}

const TOOL_BREADCRUMB_SUMMARY: Record<
  string,
  { icon: string; label: (count: number) => string }
> = {
  PROPOSE_TERRAIN_CONFIG: { icon: "🗺️", label: () => "Shaped the terrain" },
  PROPOSE_PLUGIN_SET: { icon: "🧩", label: () => "Picked plugins" },
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
  PROPOSE_ASSET: {
    icon: "✨",
    label: (n) => `Queued ${n} asset bake${n === 1 ? "" : "s"}`,
  },
  PROPOSE_UI_PACK: { icon: "🎛️", label: () => "Designed the HUD" },
  REMOVE_FROM_PROJECT: {
    icon: "🗑️",
    label: (n) => `Removed ${n} ${n === 1 ? "entity" : "entities"}`,
  },
};

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
