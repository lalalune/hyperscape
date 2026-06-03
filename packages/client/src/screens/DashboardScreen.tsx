import React, { useCallback, useEffect, useState, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import { DashboardLayout } from "../game/dashboard/DashboardLayout";
import { AgentViewportChat } from "../game/dashboard/AgentViewportChat";
import { AgentSettings } from "../game/dashboard/AgentSettings";
import { AgentLogs } from "../game/dashboard/AgentLogs";
import { AgentMemories } from "../game/dashboard/AgentMemories";
import { AgentTimeline } from "../game/dashboard/AgentTimeline";
import { AgentDynamicPanel } from "../game/dashboard/AgentDynamicPanel";
import { AgentRuns } from "../game/dashboard/AgentRuns";
import { SystemStatus } from "../game/dashboard/SystemStatus";
import { ViewportConfirmModal } from "../game/dashboard/ViewportConfirmModal";
import type { Agent, AgentPanel } from "../game/dashboard/types";
import {
  MessageSquare,
  Settings,
  Terminal,
  Monitor,
  Brain,
  Clock,
  ExternalLink,
  Activity,
  Server,
} from "lucide-react";
import { ELIZAOS_API } from "@/lib/api-config";
import "./DashboardScreen.css";

// Re-export types for backwards compatibility
export type { Agent, AgentPanel } from "../game/dashboard/types";

// Preference key for localStorage
const VIEWPORT_AUTO_START_KEY = "hyperia_viewport_auto_start";

export const DashboardScreen: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("agentId");
  });
  const [activeView, setActiveView] = useState<
    | "chat"
    | "settings"
    | "logs"
    | "memories"
    | "timeline"
    | "runs"
    | "system"
    | string
  >("chat");
  const [loading, setLoading] = useState(true);
  const [userAccountId, _setUserAccountId] = useState<string | null>(() =>
    localStorage.getItem("privy_user_id"),
  );
  const [agentPanels, setAgentPanels] = useState<AgentPanel[]>([]);
  const [_loadingPanels, setLoadingPanels] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Viewport confirmation state
  const [showViewportModal, setShowViewportModal] = useState(false);
  const [pendingStartAgentId, setPendingStartAgentId] = useState<string | null>(
    null,
  );
  const [viewportAgentId, setViewportAgentId] = useState<string | null>(null);

  // Keep sidebar "viewport active" in sync: live viewfinder uses AgentViewportChat whenever
  // the selected agent is running (no longer gated on the post-start modal alone).
  useEffect(() => {
    const agent = selectedAgentId
      ? agents.find((a) => a.id === selectedAgentId)
      : undefined;
    if (selectedAgentId && agent?.status === "active") {
      setViewportAgentId(selectedAgentId);
    } else {
      setViewportAgentId(null);
    }
  }, [selectedAgentId, agents]);

  // Ref to track if component is mounted (prevents state updates after unmount)
  const isMountedRef = useRef(true);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollInFlightRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Log account ID on mount (already read from localStorage in useState initializer)
  useEffect(() => {
    if (!userAccountId) {
      console.warn(
        "[Dashboard] No user account ID found - dashboard may show all agents",
      );
    }
  }, []);

  const fetchAgents = useCallback(
    async (isPoll = false) => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;

      if (!isPoll) {
        setDashboardError(null);
      }

      try {
        // First, fetch user's agent IDs from Hyperia database
        let userAgentIds: string[] = [];

        let mappingFetchFailed = false;
        if (userAccountId) {
          try {
            const mappingResult = await apiClient.get<{ agentIds?: string[] }>(
              `/api/agents/mappings/${userAccountId}`,
            );

            if (mappingResult.ok && mappingResult.data) {
              userAgentIds = mappingResult.data.agentIds || [];
            } else {
              console.warn(
                "[Dashboard] Failed to fetch agent mappings from Hyperia:",
                mappingResult.error,
              );
              mappingFetchFailed = true;
            }
          } catch (err) {
            console.error("[Dashboard] Error fetching agent mappings:", err);
            mappingFetchFailed = true;
          }
        }

        // Then fetch all agents from ElizaOS
        const response = await fetch(`${ELIZAOS_API}/agents`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.success && data.data && data.data.agents) {
          let filteredAgents = data.data.agents;

          // Filter agents using Hyperia database mappings
          if (userAccountId && userAgentIds.length > 0) {
            filteredAgents = data.data.agents.filter((agent: Agent) => {
              return userAgentIds.includes(agent.id);
            });
          } else if (mappingFetchFailed) {
            console.warn(
              "[Dashboard] Mapping fetch failed - showing all agents as fallback",
            );
          } else {
            console.warn("[Dashboard] No userAccountId - showing all agents");
          }

          // Only update state if component is still mounted
          if (isMountedRef.current) {
            setAgents(filteredAgents);
            if (!isPoll) {
              setDashboardError(null);
            }
            // Select first agent if none selected
            if (!selectedAgentId && filteredAgents.length > 0) {
              setSelectedAgentId(filteredAgents[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load agents:", err);
        if (isMountedRef.current) {
          setDashboardError("Failed to refresh agents. Will retry shortly.");
        }
      } finally {
        pollInFlightRef.current = false;
        if (!isPoll && isMountedRef.current) {
          setLoading(false);
        }
        if (isMountedRef.current) {
          if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
          }
          pollTimeoutRef.current = setTimeout(() => {
            void fetchAgents(true);
          }, 30000);
        }
      }
    },
    [selectedAgentId, userAccountId],
  );

  const startAgent = async (agentId: string) => {
    try {
      setDashboardError(null);
      // Check if user wants to auto-start viewport
      const autoStartViewport =
        localStorage.getItem(VIEWPORT_AUTO_START_KEY) === "true";

      // Start the agent
      const response = await fetch(`${ELIZAOS_API}/agents/${agentId}/start`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      await response.json();

      // Refresh agent list to update status
      await fetchAgents();

      // Show viewport confirmation modal if not auto-start
      if (!autoStartViewport) {
        setPendingStartAgentId(agentId);
        setShowViewportModal(true);
      } else {
        // Auto-start viewport
        setViewportAgentId(agentId);
        // Switch to chat view to show the viewport
        if (selectedAgentId === agentId) {
          setActiveView("chat");
        }
      }
    } catch (error) {
      console.error(`[Dashboard] Failed to start agent:`, error);
      setDashboardError(
        `Failed to start agent "${agentId}". ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleViewportConfirm = (dontAskAgain: boolean) => {
    if (dontAskAgain) {
      localStorage.setItem(VIEWPORT_AUTO_START_KEY, "true");
    }

    if (pendingStartAgentId) {
      setViewportAgentId(pendingStartAgentId);
      // Switch to chat view to show the viewport
      if (selectedAgentId === pendingStartAgentId) {
        setActiveView("chat");
      }
    }

    setShowViewportModal(false);
    setPendingStartAgentId(null);
  };

  const handleViewportCancel = () => {
    setShowViewportModal(false);
    setPendingStartAgentId(null);
  };

  const stopAgent = async (agentId: string) => {
    try {
      setDashboardError(null);
      const response = await fetch(`${ELIZAOS_API}/agents/${agentId}/stop`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      await response.json();

      // Clear viewport if this agent's viewport is showing
      if (viewportAgentId === agentId) {
        setViewportAgentId(null);
      }

      // Refresh agent list to update status
      await fetchAgents();
    } catch (error) {
      console.error(`[Dashboard] Failed to stop agent:`, error);
      setDashboardError(
        `Failed to stop agent "${agentId}". ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const deleteAgent = async (agentId: string) => {
    // Store mapping data for potential rollback
    let deletedMapping: {
      agentId: string;
      accountId: string;
      characterId: string;
      agentName: string;
    } | null = null;

    try {
      setDashboardError(null);
      // STEP 1: Fetch mapping data before deletion (for rollback)
      try {
        const getMappingResult = await apiClient.get<{
          agentId?: string;
          accountId?: string;
          characterId?: string;
          agentName?: string;
        }>(`/api/agents/mappings/${agentId}`);

        if (getMappingResult.ok && getMappingResult.data) {
          deletedMapping = {
            agentId: getMappingResult.data.agentId || agentId,
            accountId: getMappingResult.data.accountId || userAccountId || "",
            characterId: getMappingResult.data.characterId || "",
            agentName: getMappingResult.data.agentName || "Unknown Agent",
          };
        } else {
          console.warn(
            `[Dashboard] ⚠️  Could not fetch mapping data (${getMappingResult.error || getMappingResult.status}) - proceeding without rollback protection`,
          );
        }
      } catch (fetchError) {
        console.warn(
          `[Dashboard] ⚠️  Error fetching mapping data:`,
          fetchError,
          `- proceeding without rollback protection`,
        );
      }

      // STEP 2: Delete mapping FIRST (cheap operation, fast)
      const mappingDeleteResult = await apiClient.delete(
        `/api/agents/mappings/${agentId}`,
      );

      if (!mappingDeleteResult.ok) {
        throw new Error(
          `Failed to delete agent mapping from Hyperia: ${mappingDeleteResult.error || mappingDeleteResult.status}`,
        );
      }

      // STEP 3: Delete from ElizaOS SECOND (expensive operation, slow)
      const elizaResponse = await fetch(`${ELIZAOS_API}/agents/${agentId}`, {
        method: "DELETE",
      });

      if (!elizaResponse.ok) {
        throw new Error(`ElizaOS DELETE failed: HTTP ${elizaResponse.status}`);
      }

      // STEP 4: Clear viewport if this agent's viewport is showing
      if (viewportAgentId === agentId) {
        setViewportAgentId(null);
      }

      // STEP 5: Clear selection if deleted agent was selected
      if (selectedAgentId === agentId) {
        setSelectedAgentId(null);
      }

      // STEP 6: Refresh agent list
      await fetchAgents();
    } catch (error) {
      console.error(`[Dashboard] ❌ Agent deletion failed:`, error);

      // ROLLBACK: Restore mapping if ElizaOS deletion failed
      if (deletedMapping) {
        try {
          const rollbackResult = await apiClient.post(
            "/api/agents/mappings",
            deletedMapping,
          );

          if (!rollbackResult.ok) {
            console.error(
              `[Dashboard] ❌ Mapping rollback failed: ${rollbackResult.error || rollbackResult.status} - ghost agent may appear`,
            );
          }
        } catch (rollbackError) {
          console.error(
            `[Dashboard] ❌ Mapping rollback error:`,
            rollbackError,
            `- ghost agent may appear`,
          );
        }

        // Refresh agent list to show current state (rolled back)
        await fetchAgents();
      } else {
        console.warn(
          `[Dashboard] ⚠️  No mapping data available for rollback - cannot restore agent in dashboard`,
        );
      }

      // Re-throw with clear error message
      const message = `Failed to delete agent: ${error instanceof Error ? error.message : String(error)}. ${
        deletedMapping
          ? "Mapping has been restored."
          : "Please refresh the page to see current state."
      }`;
      setDashboardError(message);
      throw new Error(message);
    }
  };

  const fetchAgentPanels = async (agentId: string) => {
    setLoadingPanels(true);
    try {
      const response = await fetch(`${ELIZAOS_API}/agents/${agentId}/panels`);

      if (!response.ok) {
        // Silently handle 404 - panels endpoint may not exist on all ElizaOS versions
        if (response.status !== 404) {
          console.warn(
            `[Dashboard] Failed to fetch panels: HTTP ${response.status}`,
          );
        }
        if (isMountedRef.current) {
          setAgentPanels([]);
        }
        return;
      }

      const data = await response.json();

      // Transform panel data to our format
      interface PanelData {
        id?: string;
        name: string;
        url: string;
        type?: string;
        [key: string]: unknown;
      }
      const panels: AgentPanel[] = (data.panels || []).map(
        (panel: PanelData, index: number) => ({
          id: panel.id || `panel-${index}`,
          name: panel.name,
          url: panel.url,
          type: panel.type || "plugin",
        }),
      );

      if (isMountedRef.current) {
        setAgentPanels(panels);
      }
    } catch (error) {
      console.error(`[Dashboard] Failed to fetch agent panels:`, error);
      if (isMountedRef.current) {
        setAgentPanels([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingPanels(false);
      }
    }
  };

  // Fetch panels when selected agent changes
  useEffect(() => {
    if (selectedAgentId) {
      fetchAgentPanels(selectedAgentId);
    } else {
      setAgentPanels([]);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (isMountedRef.current) {
      pollInFlightRef.current = false;
      void fetchAgents();
    }

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [userAccountId, fetchAgents]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0b0a15] text-[#f2d08a]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f2d08a]"></div>
      </div>
    );
  }

  return (
    <DashboardLayout
      agents={agents}
      selectedAgentId={selectedAgentId}
      viewportAgentId={viewportAgentId}
      onSelectAgent={setSelectedAgentId}
      onCreateAgent={() => (window.location.href = "/?createAgent=true")}
      onStartAgent={startAgent}
      onStopAgent={stopAgent}
      onDeleteAgent={deleteAgent}
    >
      {selectedAgent ? (
        <div className="flex flex-col h-full">
          {dashboardError && (
            <div className="px-4 py-2 text-sm bg-[#5c1b1b]/70 text-[#ffd7d7] border-b border-[#ffb4b4]/20 flex items-center justify-between gap-2">
              <span>{dashboardError}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="shrink-0 px-2 py-1 rounded bg-[#ffb4b4]/20 hover:bg-[#ffb4b4]/30"
                  onClick={() => setDashboardError(null)}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="shrink-0 px-2 py-1 rounded bg-[#f2d08a] text-[#0b0a15] font-semibold"
                  onClick={() => void fetchAgents()}
                >
                  Retry Now
                </button>
              </div>
            </div>
          )}
          {/* Top Navigation Bar */}
          <div className="h-14 border-b border-[#8b4513]/30 bg-[#0b0a15]/80 flex items-center px-4 gap-1 overflow-x-auto">
            <NavButton
              active={activeView === "chat"}
              onClick={() => setActiveView("chat")}
              icon={<MessageSquare size={18} />}
              label="Chat"
            />
            <NavButton
              active={activeView === "settings"}
              onClick={() => setActiveView("settings")}
              icon={<Settings size={18} />}
              label="Settings"
            />
            <NavButton
              active={activeView === "memories"}
              onClick={() => setActiveView("memories")}
              icon={<Brain size={18} />}
              label="Memories"
            />
            <NavButton
              active={activeView === "timeline"}
              onClick={() => setActiveView("timeline")}
              icon={<Clock size={18} />}
              label="Timeline"
            />
            <NavButton
              active={activeView === "runs"}
              onClick={() => setActiveView("runs")}
              icon={<Activity size={18} />}
              label="Runs"
            />
            <NavButton
              active={activeView === "logs"}
              onClick={() => setActiveView("logs")}
              icon={<Terminal size={18} />}
              label="Logs"
            />
            <div className="w-px h-6 bg-[#8b4513]/30 mx-2" />
            <NavButton
              active={activeView === "system"}
              onClick={() => setActiveView("system")}
              icon={<Server size={18} />}
              label="System"
            />

            {/* Dynamic Plugin Panels */}
            {agentPanels.length > 0 && (
              <>
                <div className="w-px h-6 bg-[#8b4513]/30 mx-2" />
                {agentPanels.map((panel) => (
                  <NavButton
                    key={panel.id}
                    active={activeView === panel.id}
                    onClick={() => setActiveView(panel.id)}
                    icon={<ExternalLink size={18} />}
                    label={panel.name}
                  />
                ))}
              </>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative">
            {/* Viewport stays mounted always — hidden behind other tabs via CSS */}
            <div
              className="absolute inset-0"
              style={{
                visibility: activeView === "chat" ? "visible" : "hidden",
              }}
            >
              <AgentViewportChat key={selectedAgent.id} agent={selectedAgent} />
            </div>
            {activeView === "settings" && (
              <AgentSettings agent={selectedAgent} onDelete={deleteAgent} />
            )}
            {activeView === "memories" && (
              <AgentMemories agent={selectedAgent} />
            )}
            {activeView === "timeline" && (
              <AgentTimeline agent={selectedAgent} />
            )}
            {activeView === "runs" && <AgentRuns agent={selectedAgent} />}
            {activeView === "logs" && <AgentLogs agent={selectedAgent} />}
            {activeView === "system" && <SystemStatus />}

            {/* Dynamic Plugin Panels */}
            {agentPanels.find((p) => p.id === activeView) && (
              <AgentDynamicPanel
                panel={agentPanels.find((p) => p.id === activeView)!}
                agentId={selectedAgent.id}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-[#f2d08a]/40">
          {dashboardError && (
            <p className="mb-3 text-sm text-[#ffb4b4] max-w-md text-center px-4">
              {dashboardError}
            </p>
          )}
          <div className="w-20 h-20 rounded-full bg-[#1a1005] border border-[#f2d08a]/20 flex items-center justify-center mb-4">
            <Monitor size={40} />
          </div>
          <h2 className="text-xl font-bold text-[#f2d08a] mb-2">
            No Agent Selected
          </h2>
          <p>Select an agent from the sidebar to view details.</p>
        </div>
      )}

      {/* Viewport Confirmation Modal */}
      {showViewportModal && pendingStartAgentId && (
        <ViewportConfirmModal
          agentName={
            agents.find((a) => a.id === pendingStartAgentId)?.characterName ||
            agents.find((a) => a.id === pendingStartAgentId)?.name ||
            "Unknown Agent"
          }
          onConfirm={handleViewportConfirm}
          onCancel={handleViewportCancel}
        />
      )}
    </DashboardLayout>
  );
};

const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
      active
        ? "bg-[#f2d08a]/10 text-[#f2d08a]"
        : "text-[#e8ebf4]/60 hover:text-[#f2d08a] hover:bg-[#f2d08a]/5"
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
