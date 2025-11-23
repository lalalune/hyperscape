import React from "react";
import { AgentSidebar } from "./AgentSidebar";
import { Agent } from "../../screens/DashboardScreen";

interface DashboardLayoutProps {
  agents: Agent[];
  selectedAgentId: string | null;
  viewportAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
  onStartAgent: (agentId: string) => void;
  onStopAgent: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => Promise<void>;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  agents,
  selectedAgentId,
  viewportAgentId,
  onSelectAgent,
  onCreateAgent,
  onStartAgent,
  onStopAgent,
  onDeleteAgent,
  children,
}) => {
  return (
    <div className="flex h-screen bg-[#0b0a15] text-[#e8ebf4] font-['Rubik'] overflow-hidden">
      {/* Sidebar */}
      <AgentSidebar
        agents={agents}
        selectedAgentId={selectedAgentId}
        viewportAgentId={viewportAgentId}
        onSelectAgent={onSelectAgent}
        onCreateAgent={onCreateAgent}
        onStartAgent={onStartAgent}
        onStopAgent={onStopAgent}
        onDeleteAgent={onDeleteAgent}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#140f0a] relative">
        {/* Background Overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: "url('/assets/background.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};
