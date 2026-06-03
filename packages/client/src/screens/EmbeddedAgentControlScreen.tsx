import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Compass,
  MessageSquare,
  Send,
  Terminal,
  Brain,
  Clock,
  Activity,
  RefreshCw,
} from "lucide-react";
import { EmbeddedGameClient } from "../game/EmbeddedGameClient";
import { AgentLogs } from "../game/dashboard/AgentLogs";
import { AgentMemories } from "../game/dashboard/AgentMemories";
import { AgentRuns } from "../game/dashboard/AgentRuns";
import { AgentThoughtsOverlay } from "../game/dashboard/AgentThoughtsOverlay";
import { AgentTimeline } from "../game/dashboard/AgentTimeline";
import { QuickActionMenu } from "../game/dashboard/QuickActionMenu";
import { GAME_API_URL, ELIZAOS_API } from "../lib/api-config";
import { cloneEmbeddedConfig } from "../lib/embedded-entry";
import {
  getEmbeddedConfig,
  type EmbeddedViewportConfig,
} from "../types/embeddedConfig";
import type { Agent } from "../game/dashboard/types";

type ControlTab = "command" | "logs" | "memories" | "timeline" | "runs";

type CommandMessage = {
  id: string;
  sender: "user" | "system";
  text: string;
  timestamp: Date;
};

type AgentDetailsResponse = {
  success?: boolean;
  data?: {
    agent?: {
      id?: string;
      name?: string;
      status?: string;
      character?: {
        name?: string;
        settings?: {
          accountId?: string;
          characterId?: string;
          [key: string]: unknown;
        };
      };
      settings?: {
        accountId?: string;
        characterType?: string;
        avatar?: string;
        [key: string]: unknown;
      };
    };
  };
};

const AGENT_REFRESH_MS = 15000;

function buildFallbackAgent(
  config: EmbeddedViewportConfig | null,
): Agent | null {
  if (!config?.agentId) {
    return null;
  }

  return {
    id: config.agentId,
    name: "Hyperia Agent",
    characterName: config.characterId || "Connecting…",
    status: config.authToken ? "active" : "connecting",
    settings: config.characterId
      ? {
          characterId: config.characterId,
        }
      : undefined,
  };
}

function normalizeAgent(
  payload: AgentDetailsResponse,
  fallback: Agent | null,
): Agent | null {
  const source = payload.data?.agent;
  if (!source?.id) {
    return fallback;
  }

  return {
    id: source.id,
    name: source.name || fallback?.name || "Hyperia Agent",
    characterName:
      source.character?.name ||
      fallback?.characterName ||
      source.name ||
      "Hyperia Agent",
    status: source.status || fallback?.status || "unknown",
    settings: {
      ...(fallback?.settings ?? {}),
      ...(source.settings ?? {}),
      ...(source.character?.settings ?? {}),
    },
  };
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Live";
    case "inactive":
      return "Offline";
    case "connecting":
      return "Connecting";
    default:
      return status || "Unknown";
  }
}

function statusBadgeClasses(status: string): string {
  switch (status) {
    case "active":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "inactive":
      return "border-rose-400/30 bg-rose-500/10 text-rose-200";
    default:
      return "border-[#f2d08a]/20 bg-[#f2d08a]/10 text-[#f2d08a]";
  }
}

function createSystemMessage(text: string): CommandMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sender: "system",
    text,
    timestamp: new Date(),
  };
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        active
          ? "border-[#f2d08a]/40 bg-[#f2d08a]/15 text-[#f2d08a]"
          : "border-[#8b4513]/30 bg-[#1a1005]/60 text-[#f2d08a]/55 hover:border-[#f2d08a]/20 hover:text-[#f2d08a]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function EmbeddedAgentControlScreen() {
  const [config, setConfig] = useState<EmbeddedViewportConfig | null>(() =>
    cloneEmbeddedConfig(getEmbeddedConfig()),
  );
  const [agent, setAgent] = useState<Agent | null>(() =>
    buildFallbackAgent(config),
  );
  const [agentError, setAgentError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ControlTab>("command");
  const [commandValue, setCommandValue] = useState("");
  const [commandMessages, setCommandMessages] = useState<CommandMessage[]>([]);
  const [sending, setSending] = useState(false);
  const commandEndRef = useRef<HTMLDivElement | null>(null);

  const resolvedAgent = useMemo(
    () => agent ?? buildFallbackAgent(config),
    [agent, config],
  );

  useEffect(() => {
    const handleAuthReady = () => {
      setConfig(cloneEmbeddedConfig(getEmbeddedConfig()));
    };

    window.addEventListener("hyperia:auth-ready", handleAuthReady);
    return () => {
      window.removeEventListener("hyperia:auth-ready", handleAuthReady);
    };
  }, []);

  useEffect(() => {
    if (!resolvedAgent) {
      return;
    }
    commandEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [commandMessages, resolvedAgent]);

  useEffect(() => {
    if (!config?.agentId) {
      setAgent(null);
      setAgentError("No agent was provided for this Hyperia session.");
      return;
    }

    let cancelled = false;
    let refreshTimer: number | null = null;
    const fallbackAgent = buildFallbackAgent(config);
    setAgent((current) => current ?? fallbackAgent);

    const fetchAgent = async () => {
      try {
        const response = await fetch(
          `${ELIZAOS_API}/agents/${encodeURIComponent(config.agentId)}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as AgentDetailsResponse;
        if (cancelled) {
          return;
        }

        setAgent(normalizeAgent(payload, fallbackAgent));
        setAgentError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAgent((current) => current ?? fallbackAgent);
        setAgentError(
          error instanceof Error
            ? `Agent status refresh failed: ${error.message}`
            : "Agent status refresh failed.",
        );
      } finally {
        if (!cancelled) {
          refreshTimer = window.setTimeout(fetchAgent, AGENT_REFRESH_MS);
        }
      }
    };

    void fetchAgent();

    return () => {
      cancelled = true;
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [config]);

  const sendCommand = async (rawCommand: string) => {
    const trimmedCommand = rawCommand.trim();
    if (!trimmedCommand) {
      return;
    }

    if (!config?.agentId) {
      setCommandMessages((current) => [
        ...current,
        createSystemMessage("No agent is attached to this session."),
      ]);
      return;
    }

    if (!config.authToken) {
      setCommandMessages((current) => [
        ...current,
        createSystemMessage(
          "Waiting for Milady to finish session authentication.",
        ),
      ]);
      return;
    }

    const userMessage: CommandMessage = {
      id: `${Date.now()}-user`,
      sender: "user",
      text: trimmedCommand,
      timestamp: new Date(),
    };

    setCommandMessages((current) => [...current, userMessage]);
    setCommandValue("");
    setSending(true);

    try {
      const response = await fetch(
        `${GAME_API_URL}/api/agents/${encodeURIComponent(config.agentId)}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.authToken}`,
          },
          body: JSON.stringify({ content: trimmedCommand }),
        },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || payload.success !== true) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      setCommandMessages((current) => [
        ...current,
        createSystemMessage(
          "Command delivered. Watch the viewport and live logs for the agent response.",
        ),
      ]);

      window.postMessage({ type: "OPEN_CHAT" }, window.location.origin);
    } catch (error) {
      setCommandMessages((current) => [
        ...current,
        createSystemMessage(
          error instanceof Error
            ? `Command failed: ${error.message}`
            : "Command failed.",
        ),
      ]);
    } finally {
      setSending(false);
    }
  };

  const controlsDisabled =
    sending ||
    !config?.agentId ||
    !config?.authToken ||
    resolvedAgent?.status !== "active";

  return (
    <div
      className="flex h-screen flex-col bg-[#0b0a15] text-[#e8ebf4] lg:flex-row"
      data-testid="embedded-agent-control-screen"
    >
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-[#8b4513]/30 lg:border-b-0 lg:border-r">
        <header className="border-b border-[#8b4513]/30 bg-[#110c08]/85 px-5 py-4 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#f2d08a]/20 bg-[#1a1005] text-[#f2d08a]">
                <Bot size={20} />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[#f2d08a]">
                  {resolvedAgent?.characterName ||
                    resolvedAgent?.name ||
                    "Hyperia Agent"}
                </h1>
                <p className="text-sm text-[#e8ebf4]/55">
                  Watch the run live and steer the agent from this session.
                </p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${statusBadgeClasses(
                  resolvedAgent?.status || "unknown",
                )}`}
              >
                {formatStatusLabel(resolvedAgent?.status || "unknown")}
              </span>
              <span className="rounded-full border border-[#8b4513]/30 bg-[#1a1005]/70 px-3 py-1 text-xs text-[#f2d08a]/70">
                {config?.authToken ? "Milady session linked" : "Authenticating"}
              </span>
            </div>
          </div>

          {agentError && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {agentError}
            </div>
          )}
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
          <EmbeddedGameClient />
          {resolvedAgent ? (
            <div className="pointer-events-auto absolute bottom-4 right-4 z-20 hidden lg:block">
              <AgentThoughtsOverlay agent={resolvedAgent} />
            </div>
          ) : null}
        </div>
      </section>

      <aside className="flex min-h-0 w-full flex-col bg-[#140f0a] lg:w-[440px] lg:min-w-[400px] lg:max-w-[460px]">
        <div className="border-b border-[#8b4513]/30 bg-[#110c08]/85 px-4 py-4 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#f2d08a]/45">
                Agent Console
              </p>
              <p className="mt-1 text-sm text-[#e8ebf4]/65">
                Direct messages, quick actions, live telemetry.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-[#8b4513]/30 bg-[#1a1005]/70 p-2 text-[#f2d08a]/70 transition-colors hover:border-[#f2d08a]/25 hover:text-[#f2d08a]"
              onClick={() => {
                setAgentError(null);
                setConfig(cloneEmbeddedConfig(getEmbeddedConfig()));
              }}
              title="Refresh session state"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div
            className="mt-4 flex flex-wrap gap-2"
            data-testid="embedded-agent-control-tabs"
          >
            <TabButton
              active={activeTab === "command"}
              icon={<Compass size={16} />}
              label="Command"
              onClick={() => setActiveTab("command")}
            />
            <TabButton
              active={activeTab === "logs"}
              icon={<Terminal size={16} />}
              label="Logs"
              onClick={() => setActiveTab("logs")}
            />
            <TabButton
              active={activeTab === "timeline"}
              icon={<Clock size={16} />}
              label="Timeline"
              onClick={() => setActiveTab("timeline")}
            />
            <TabButton
              active={activeTab === "runs"}
              icon={<Activity size={16} />}
              label="Runs"
              onClick={() => setActiveTab("runs")}
            />
            <TabButton
              active={activeTab === "memories"}
              icon={<Brain size={16} />}
              label="Memories"
              onClick={() => setActiveTab("memories")}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {resolvedAgent ? (
            activeTab === "command" ? (
              <div
                className="flex h-full flex-col"
                data-testid="embedded-agent-command-panel"
              >
                <div className="border-b border-[#8b4513]/20 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#f2d08a]/60">
                    <span className="rounded-full border border-[#8b4513]/30 bg-[#1a1005]/60 px-2.5 py-1">
                      Agent ID: {resolvedAgent.id}
                    </span>
                    {config?.characterId ? (
                      <span className="rounded-full border border-[#8b4513]/30 bg-[#1a1005]/60 px-2.5 py-1">
                        Character: {config.characterId}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {commandMessages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-[#f2d08a]/35">
                      <MessageSquare size={40} className="mb-4" />
                      <p className="max-w-xs text-sm leading-6">
                        Tell the agent what to do here. Commands go straight to
                        the running Hyperia session.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {commandMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.sender === "user"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl border px-3 py-2 text-sm leading-6 ${
                              message.sender === "user"
                                ? "border-[#f2d08a]/25 bg-[#f2d08a]/12 text-[#f8efd8]"
                                : "border-[#8b4513]/30 bg-[#1a1005]/80 text-[#e8ebf4]/85"
                            }`}
                          >
                            <p>{message.text}</p>
                            <p className="mt-1 text-[11px] text-[#f2d08a]/40">
                              {message.timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={commandEndRef} />
                    </div>
                  )}
                </div>

                <div className="border-t border-[#8b4513]/20 bg-[#110c08]/85 px-4 py-4 backdrop-blur-md">
                  {!config?.authToken ? (
                    <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                      Waiting for Milady to finish authenticating this agent
                      session.
                    </div>
                  ) : null}

                  {resolvedAgent.status !== "active" ? (
                    <div className="mb-3 rounded-xl border border-[#8b4513]/30 bg-[#1a1005]/70 px-3 py-2 text-sm text-[#f2d08a]/70">
                      The agent is not marked active yet. Commands stay disabled
                      until the live session is ready.
                    </div>
                  ) : null}

                  <div className="relative flex items-end gap-2 rounded-2xl border border-[#8b4513]/40 bg-[#1a1005]/85 p-2">
                    <QuickActionMenu
                      agentId={resolvedAgent.id}
                      authToken={config?.authToken}
                      disabled={controlsDisabled}
                      onCommandSend={(command) => {
                        void sendCommand(command);
                      }}
                    />

                    <textarea
                      data-testid="embedded-agent-command-input"
                      value={commandValue}
                      onChange={(event) => setCommandValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          if (!controlsDisabled) {
                            void sendCommand(commandValue);
                          }
                        }
                      }}
                      placeholder="Tell your agent what to do next..."
                      className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[#e8ebf4] outline-none placeholder:text-[#f2d08a]/25"
                      disabled={controlsDisabled}
                    />

                    <button
                      type="button"
                      data-testid="embedded-agent-command-send"
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2d08a] text-[#140f0a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={
                        controlsDisabled || commandValue.trim().length === 0
                      }
                      onClick={() => {
                        void sendCommand(commandValue);
                      }}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ) : activeTab === "logs" ? (
              <AgentLogs agent={resolvedAgent} />
            ) : activeTab === "memories" ? (
              <AgentMemories agent={resolvedAgent} />
            ) : activeTab === "timeline" ? (
              <AgentTimeline agent={resolvedAgent} />
            ) : (
              <AgentRuns agent={resolvedAgent} />
            )
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-[#f2d08a]/45">
              No agent session is attached to this embedded Hyperia view.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
