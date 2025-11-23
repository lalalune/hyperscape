import React from "react";
import {
  Plus,
  Users,
  Settings,
  LogOut,
  Play,
  Square,
  Server,
} from "lucide-react";
import { Agent } from "../../screens/DashboardScreen";
import { AgentSkillsPanel } from "./AgentSkillsPanel";

interface AgentSidebarProps {
  agents: Agent[];
  selectedAgentId: string | null;
  viewportAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
  onStartAgent: (agentId: string) => void;
  onStopAgent: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => Promise<void>;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  agents,
  selectedAgentId,
  viewportAgentId,
  onSelectAgent,
  onCreateAgent,
  onStartAgent,
  onStopAgent,
  onDeleteAgent,
}) => {
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  return (
    <div className="w-64 flex flex-col border-r border-[#8b4513]/30 bg-[#0b0a15]/95 backdrop-blur-md">
      {/* Header */}
      <div className="p-4 border-b border-[#8b4513]/30 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-[#f2d08a] to-[#8b4513] flex items-center justify-center text-[#0b0a15] font-bold text-lg">
          H
        </div>
        <div>
          <h1 className="font-bold text-[#f2d08a] text-sm uppercase tracking-wider">
            Hyperscape
          </h1>
          <p className="text-xs text-[#f2d08a]/60">Control Panel</p>
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="text-xs font-bold text-[#f2d08a]/40 uppercase tracking-widest px-2 mb-2">
          Agents
        </div>

        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`group w-full flex items-center gap-2 p-2 rounded-md transition-all border ${
              selectedAgentId === agent.id
                ? "bg-[#f2d08a]/10 border-[#f2d08a]/50"
                : "hover:bg-[#f2d08a]/5 border-transparent"
            }`}
          >
            <button
              onClick={() => onSelectAgent(agent.id)}
              className="flex-1 flex items-center gap-3"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-[#1a1005] border border-[#f2d08a]/30 flex items-center justify-center text-lg">
                  🤖
                </div>
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0b0a15] ${
                    agent.status === "active" ? "bg-green-500" : "bg-gray-500"
                  }`}
                />
              </div>
              <div className="text-left truncate">
                <div
                  className={`font-medium text-sm truncate ${
                    selectedAgentId === agent.id
                      ? "text-[#f2d08a]"
                      : "text-[#e8ebf4]/80 group-hover:text-[#f2d08a]"
                  }`}
                >
                  {agent.characterName || agent.name || "Unknown"}
                </div>
                <div className="text-[10px] opacity-60 truncate">
                  {agent.status === "active" ? "Active" : "Inactive"}
                </div>
              </div>
            </button>

            {/* Start/Stop Button */}
            {agent.status === "active" ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStopAgent(agent.id);
                }}
                className="w-6 h-6 rounded flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                title="Stop Agent"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartAgent(agent.id);
                }}
                className="w-6 h-6 rounded flex items-center justify-center bg-green-500/20 hover:bg-green-500/30 text-green-400 hover:text-green-300 transition-colors"
                title="Start Agent"
              >
                <Play size={12} fill="currentColor" />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={onCreateAgent}
          className="w-full flex items-center gap-2 p-2 rounded-md border border-dashed border-[#f2d08a]/30 text-[#f2d08a]/60 hover:text-[#f2d08a] hover:border-[#f2d08a]/60 hover:bg-[#f2d08a]/5 transition-all mt-4 group"
        >
          <div className="w-8 h-8 rounded-full bg-[#1a1005] flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus size={16} />
          </div>
          <span className="text-sm font-medium">Create New Agent</span>
        </button>
      </div>

      {/* Skills Panel for Selected Agent */}
      {selectedAgent && (
        <AgentSkillsPanel
          agent={selectedAgent}
          isViewportActive={viewportAgentId === selectedAgentId}
        />
      )}

      {/* Footer */}
      <div className="p-3 border-t border-[#8b4513]/30 space-y-1">
        <button className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-[#f2d08a]/5 text-[#e8ebf4]/60 hover:text-[#f2d08a] transition-colors">
          <Settings size={18} />
          <span className="text-sm">Settings</span>
        </button>
        <button
          onClick={() => (window.location.href = "/")}
          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-red-500/10 text-[#e8ebf4]/60 hover:text-red-400 transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm">Exit to Client</span>
        </button>
      </div>
    </div>
  );
};
