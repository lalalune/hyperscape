import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/dashboard/DashboardLayout";
import { AgentChat } from "../components/dashboard/AgentChat";
import { AgentViewportChat } from "../components/dashboard/AgentViewportChat";
import { AgentSettings } from "../components/dashboard/AgentSettings";
import { AgentLogs } from "../components/dashboard/AgentLogs";
import { AgentMemories } from "../components/dashboard/AgentMemories";
import { AgentTimeline } from "../components/dashboard/AgentTimeline";
import { AgentDynamicPanel } from "../components/dashboard/AgentDynamicPanel";
import { AgentRuns } from "../components/dashboard/AgentRuns";
import { SystemStatus } from "../components/dashboard/SystemStatus";
import { ViewportConfirmModal } from "../components/dashboard/ViewportConfirmModal";
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

export interface Agent {
  id: string;
  name: string;
  characterName?: string;
  bio?: string;
  status: "active" | "inactive" | string;
  settings?: {
    accountId?: string;
    characterType?: string;
    avatar?: string;
    [key: string]: unknown;
  };
}

export interface AgentPanel {
  id: string;
  name: string;
  url: string;
  type: string;
}

// Preference key for localStorage
const VIEWPORT_AUTO_START_KEY = "hyperscape_viewport_auto_start";

export const DashboardScreen: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
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
  const [userAccountId, setUserAccountId] = useState<string | null>(null);
  const [agentPanels, setAgentPanels] = useState<AgentPanel[]>([]);
  const [loadingPanels, setLoadingPanels] = useState(false);

  // Viewport confirmation state
  const [showViewportModal, setShowViewportModal] = useState(false);
  const [pendingStartAgentId, setPendingStartAgentId] = useState<string | null>(
    null,
  );
  const [viewportAgentId, setViewportAgentId] = useState<string | null>(null);

  // Get user's main account ID from Privy localStorage
  useEffect(() => {
    const accountId = localStorage.getItem("privy_user_id");
    if (accountId) {
      setUserAccountId(accountId);
      console.log("[Dashboard] User account ID:", accountId);
    } else {
      console.warn(
        "[Dashboard] No user account ID found - dashboard may show all agents",
      );
    }
  }, []);

  const fetchAgents = async () => {
    try {
      // First, fetch user's agent IDs from Hyperscape database
      let userAgentIds: string[] = [];

      if (userAccountId) {
        try {
          const mappingResponse = await fetch(
            `http://localhost:5555/api/agents/mappings/${userAccountId}`,
          );

          if (mappingResponse.ok) {
            const mappingData = await mappingResponse.json();
            userAgentIds = mappingData.agentIds || [];
            console.log(
              `[Dashboard] Found ${userAgentIds.length} agent mapping(s) for user ${userAccountId}`,
              userAgentIds,
            );
          } else {
            console.warn(
              "[Dashboard] Failed to fetch agent mappings from Hyperscape",
            );
          }
        } catch (err) {
          console.error("[Dashboard] Error fetching agent mappings:", err);
        }
      }

      // Then fetch all agents from ElizaOS
      const response = await fetch(`${ELIZAOS_API}/agents`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data.success && data.data && data.data.agents) {
        let filteredAgents = data.data.agents;

        // Filter agents using Hyperscape database mappings
        if (userAccountId && userAgentIds.length > 0) {
          filteredAgents = data.data.agents.filter((agent: Agent) => {
            const match = userAgentIds.includes(agent.id);

            if (match) {
              console.log(
                `[Dashboard] ✅ Agent ${agent.name} (${agent.id}) belongs to user ${userAccountId}`,
              );
            }

            return match;
          });

          console.log(
            `[Dashboard] Filtered ${filteredAgents.length} agents out of ${data.data.agents.length} for user ${userAccountId}`,
          );
        } else if (userAccountId) {
          console.log(
            "[Dashboard] No agent mappings found - showing empty list",
          );
          filteredAgents = [];
        } else {
          console.warn("[Dashboard] No userAccountId - showing all agents");
        }

        setAgents(filteredAgents);
        // Select first agent if none selected
        if (!selectedAgentId && filteredAgents.length > 0) {
          setSelectedAgentId(filteredAgents[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load agents:", err);
    } finally {
      setLoading(false);
    }
  };

  const startAgent = async (agentId: string) => {
    try {
      console.log(`[Dashboard] Starting agent ${agentId}...`);

      // Check if user wants to auto-start viewport
      const autoStartViewport =
        localStorage.getItem(VIEWPORT_AUTO_START_KEY) === "true";

      // Start the agent
      const response = await fetch(`${ELIZAOS_API}/agents/${agentId}/start`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      console.log(`[Dashboard] Agent started:`, result);

      // Refresh agent list to update status
      await fetchAgents();

      // Show viewport confirmation modal if not auto-start
      if (!autoStartViewport) {
        setPendingStartAgentId(agentId);
        setShowViewportModal(true);
      } else {
        // Auto-start viewport
        console.log(
          `[Dashboard] Auto-starting viewport for ${agentId} (preference enabled)`,
        );
        setViewportAgentId(agentId);
        // Switch to chat view to show the viewport
        if (selectedAgentId === agentId) {
          setActiveView("chat");
        }
      }
    } catch (error) {
      console.error(`[Dashboard] Failed to start agent:`, error);
    }
  };

  const handleViewportConfirm = (dontAskAgain: boolean) => {
    if (dontAskAgain) {
      console.log(
        "[Dashboard] Saving viewport auto-start preference to localStorage",
      );
      localStorage.setItem(VIEWPORT_AUTO_START_KEY, "true");
    }

    if (pendingStartAgentId) {
      console.log(`[Dashboard] Starting viewport for ${pendingStartAgentId}`);
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
    console.log(
      "[Dashboard] User declined viewport start - agent running without viewport",
    );
    setShowViewportModal(false);
    setPendingStartAgentId(null);
  };

  const stopAgent = async (agentId: string) => {
    try {
      console.log(`[Dashboard] Stopping agent ${agentId}...`);
      const response = await fetch(`${ELIZAOS_API}/agents/${agentId}/stop`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      console.log(`[Dashboard] Agent stopped:`, result);

      // Clear viewport if this agent's viewport is showing
      if (viewportAgentId === agentId) {
        console.log(
          `[Dashboard] Clearing viewport for stopped agent ${agentId}`,
        );
        setViewportAgentId(null);
      }

      // Refresh agent list to update status
      await fetchAgents();
    } catch (error) {
      console.error(`[Dashboard] Failed to stop agent:`, error);
    }
  };

  const deleteAgent = async (agentId: string) => {
    console.log(
      `[Dashboard] 🗑️  Starting atomic deletion for agent ${agentId}...`,
    );

    // Store mapping data for potential rollback
    let deletedMapping: {
      agentId: string;
      accountId: string;
      characterId: string;
      agentName: string;
    } | null = null;

    try {
      // STEP 1: Fetch mapping data before deletion (for rollback)
      console.log(
        `[Dashboard] 📋 Fetching mapping data for rollback protection...`,
      );
      try {
        const getMappingResponse = await fetch(
          `http://localhost:5555/api/agents/mappings/${agentId}`,
        );

        if (getMappingResponse.ok) {
          const mappingData = await getMappingResponse.json();
          deletedMapping = {
            agentId: mappingData.agentId || agentId,
            accountId: mappingData.accountId || userAccountId || "",
            characterId: mappingData.characterId || "",
            agentName: mappingData.agentName || "Unknown Agent",
          };
          console.log(
            `[Dashboard] ✅ Mapping data cached for rollback:`,
            deletedMapping,
          );
        } else {
          console.warn(
            `[Dashboard] ⚠️  Could not fetch mapping data (HTTP ${getMappingResponse.status}) - proceeding without rollback protection`,
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
      console.log(
        `[Dashboard] 🗑️  Step 1/2: Deleting mapping from Hyperscape database...`,
      );
      const mappingResponse = await fetch(
        `http://localhost:5555/api/agents/mappings/${agentId}`,
        {
          method: "DELETE",
        },
      );

      if (!mappingResponse.ok) {
        throw new Error(
          `Failed to delete agent mapping from Hyperscape: HTTP ${mappingResponse.status}`,
        );
      }

      console.log(`[Dashboard] ✅ Mapping deleted from Hyperscape database`);

      // STEP 3: Delete from ElizaOS SECOND (expensive operation, slow)
      console.log(`[Dashboard] 🗑️  Step 2/2: Deleting agent from ElizaOS...`);
      const elizaResponse = await fetch(`${ELIZAOS_API}/agents/${agentId}`, {
        method: "DELETE",
      });

      if (!elizaResponse.ok) {
        throw new Error(`ElizaOS DELETE failed: HTTP ${elizaResponse.status}`);
      }

      console.log(`[Dashboard] ✅ Agent deleted from ElizaOS`);

      // STEP 4: Clear viewport if this agent's viewport is showing
      if (viewportAgentId === agentId) {
        console.log(
          `[Dashboard] Clearing viewport for deleted agent ${agentId}`,
        );
        setViewportAgentId(null);
      }

      // STEP 5: Clear selection if deleted agent was selected
      if (selectedAgentId === agentId) {
        setSelectedAgentId(null);
      }

      // STEP 6: Refresh agent list
      await fetchAgents();

      console.log(`[Dashboard] ✅ Atomic deletion completed successfully`);
    } catch (error) {
      console.error(`[Dashboard] ❌ Agent deletion failed:`, error);

      // ROLLBACK: Restore mapping if ElizaOS deletion failed
      if (deletedMapping) {
        console.log(
          `[Dashboard] 🔄 ElizaOS deletion failed, attempting rollback of mapping deletion...`,
        );

        try {
          const rollbackResponse = await fetch(
            `http://localhost:5555/api/agents/mappings`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(deletedMapping),
            },
          );

          if (rollbackResponse.ok) {
            console.log(
              `[Dashboard] ✅ Mapping rollback successful - agent restored in dashboard`,
            );
          } else {
            console.error(
              `[Dashboard] ❌ Mapping rollback failed: HTTP ${rollbackResponse.status} - ghost agent may appear`,
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
      throw new Error(
        `Failed to delete agent: ${error instanceof Error ? error.message : String(error)}. ${
          deletedMapping
            ? "Mapping has been restored."
            : "Please refresh the page to see current state."
        }`,
      );
    }
  };

  const fetchAgentPanels = async (agentId: string) => {
    setLoadingPanels(true);
    try {
      console.log(`[Dashboard] Fetching panels for agent ${agentId}...`);
      const response = await fetch(`${ELIZAOS_API}/agents/${agentId}/panels`);

      if (!response.ok) {
        // Silently handle 404 - panels endpoint may not exist on all ElizaOS versions
        if (response.status !== 404) {
          console.warn(
            `[Dashboard] Failed to fetch panels: HTTP ${response.status}`,
          );
        }
        setAgentPanels([]);
        return;
      }

      const data = await response.json();
      console.log(
        `[Dashboard] ✅ Fetched ${data.panels?.length || 0} panel(s):`,
        data,
      );

      // Transform panel data to our format
      const panels: AgentPanel[] = (data.panels || []).map(
        (panel: any, index: number) => ({
          id: panel.id || `panel-${index}`,
          name: panel.name,
          url: panel.url,
          type: panel.type || "plugin",
        }),
      );

      setAgentPanels(panels);
    } catch (error) {
      console.error(`[Dashboard] Failed to fetch agent panels:`, error);
      setAgentPanels([]);
    } finally {
      setLoadingPanels(false);
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
    // Fetch agents immediately (don't wait for userAccountId)
    // If userAccountId is available, it will be used for filtering
    fetchAgents();
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, [userAccountId]);

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
            {activeView === "chat" &&
              (viewportAgentId === selectedAgent.id ? (
                <AgentViewportChat agent={selectedAgent} />
              ) : (
                <AgentChat agent={selectedAgent} />
              ))}
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
