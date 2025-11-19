import React, { useEffect, useState } from "react";
import { DashboardLayout } from "../components/dashboard/DashboardLayout";
import { AgentChat } from "../components/dashboard/AgentChat";
import { AgentSettings } from "../components/dashboard/AgentSettings";
import { AgentLogs } from "../components/dashboard/AgentLogs";
import { AgentViewport } from "../components/dashboard/AgentViewport";
import { MessageSquare, Settings, Terminal, Monitor } from "lucide-react";
import "./DashboardScreen.css";

export interface Agent {
  id: string;
  name: string;
  characterName?: string;
  bio?: string;
  status: "active" | "inactive" | string;
}

export const DashboardScreen: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    "chat" | "settings" | "logs" | "viewport"
  >("chat");
  const [loading, setLoading] = useState(true);

  const ELIZAOS_API = "http://localhost:3000/api";

  const fetchAgents = async () => {
    try {
      const response = await fetch(`${ELIZAOS_API}/agents`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data.success && data.data && data.data.agents) {
        setAgents(data.data.agents);
        // Select first agent if none selected
        if (!selectedAgentId && data.data.agents.length > 0) {
          setSelectedAgentId(data.data.agents[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load agents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, []);

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
      onCreateAgent={() => window.open("http://localhost:3000", "_blank")}
    >
      {selectedAgent ? (
        <div className="flex flex-col h-full">
          {/* Top Navigation Bar */}
          <div className="h-14 border-b border-[#8b4513]/30 bg-[#0b0a15]/80 flex items-center px-4 gap-1">
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
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative">
            {activeView === "chat" && <AgentChat agent={selectedAgent} />}
            {activeView === "settings" && (
              <AgentSettings agent={selectedAgent} />
            )}
            {activeView === "logs" && <AgentLogs agent={selectedAgent} />}
            {activeView === "viewport" && (
              <AgentViewport agent={selectedAgent} />
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
