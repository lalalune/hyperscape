import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/dashboard/DashboardLayout";
import { AgentChat } from "../components/dashboard/AgentChat";
import { AgentViewportChat } from "../components/dashboard/AgentViewportChat";
import { AgentSettings } from "../components/dashboard/AgentSettings";
import { AgentLogs } from "../components/dashboard/AgentLogs";
import { AgentViewport } from "../components/dashboard/AgentViewport";
import { AgentMemories } from "../components/dashboard/AgentMemories";
import { AgentTimeline } from "../components/dashboard/AgentTimeline";
import { AgentDynamicPanel } from "../components/dashboard/AgentDynamicPanel";
import { AgentRuns } from "../components/dashboard/AgentRuns";
import { SystemStatus } from "../components/dashboard/SystemStatus";
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

export const DashboardScreen: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    | "chat"
    | "settings"
    | "logs"
    | "viewport"
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

  const ELIZAOS_API = "http://localhost:3000/api";

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
      const response = await fetch(`${ELIZAOS_API}/agents/${agentId}/start`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      console.log(`[Dashboard] Agent started:`, result);

      // Refresh agent list to update status
      await fetchAgents();
    } catch (error) {
      console.error(`[Dashboard] Failed to start agent:`, error);
    }
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

      // Refresh agent list to update status
      await fetchAgents();
    } catch (error) {
      console.error(`[Dashboard] Failed to stop agent:`, error);
    }
  };

  const deleteAgent = async (agentId: string) => {
    try {
      console.log(`[Dashboard] Deleting agent ${agentId}...`);

      // Delete from ElizaOS
      const elizaResponse = await fetch(`${ELIZAOS_API}/agents/${agentId}`, {
        method: "DELETE",
      });

      if (!elizaResponse.ok) {
        throw new Error(`ElizaOS DELETE failed: HTTP ${elizaResponse.status}`);
      }

      console.log(`[Dashboard] ✅ Agent deleted from ElizaOS`);

      // Delete agent mapping from Hyperscape database
      try {
        const mappingResponse = await fetch(
          `http://localhost:5555/api/agents/mappings/${agentId}`,
          {
            method: "DELETE",
          },
        );

        if (mappingResponse.ok) {
          console.log(`[Dashboard] ✅ Agent mapping deleted from Hyperscape`);
        } else {
          console.warn(
            `[Dashboard] Failed to delete agent mapping: HTTP ${mappingResponse.status}`,
          );
        }
      } catch (mappingError) {
        console.error(
          `[Dashboard] Error deleting agent mapping:`,
          mappingError,
        );
      }

      // Clear selection if deleted agent was selected
      if (selectedAgentId === agentId) {
        setSelectedAgentId(null);
      }

      // Refresh agent list
      await fetchAgents();

      console.log(`[Dashboard] ✅ Agent deletion completed`);
    } catch (error) {
      console.error(`[Dashboard] Failed to delete agent:`, error);
      throw error; // Re-throw so UI can show error
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
              active={activeView === "viewport"}
              onClick={() => setActiveView("viewport")}
              icon={<Monitor size={18} />}
              label="Game Viewport"
            />
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
            {activeView === "chat" && (
              <AgentViewportChat agent={selectedAgent} />
            )}
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
            {activeView === "viewport" && (
              <AgentViewport agent={selectedAgent} />
            )}
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
