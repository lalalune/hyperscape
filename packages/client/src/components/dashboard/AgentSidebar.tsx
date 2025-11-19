import React from "react";
import { Plus, Users, Settings, LogOut } from "lucide-react";
import { Agent } from "../../screens/DashboardScreen";

interface AgentSidebarProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  agents,
  selectedAgentId,
  onSelectAgent,
  onCreateAgent,
}) => {
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
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            className={`w-full flex items-center gap-3 p-2 rounded-md transition-all border ${
              selectedAgentId === agent.id
                ? "bg-[#f2d08a]/10 border-[#f2d08a]/50 text-[#f2d08a]"
                : "hover:bg-[#f2d08a]/5 border-transparent text-[#e8ebf4]/80 hover:text-[#f2d08a]"
            }`}
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
              <div className="font-medium text-sm truncate">
                {agent.characterName || agent.name || "Unknown"}
              </div>
              <div className="text-[10px] opacity-60 truncate">
                {agent.status === "active" ? "Active" : "Inactive"}
              </div>
            </div>
          </button>
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
