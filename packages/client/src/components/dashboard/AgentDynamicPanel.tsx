import React from "react";
import { ExternalLink } from "lucide-react";
import { AgentPanel } from "../../screens/DashboardScreen";

interface AgentDynamicPanelProps {
  panel: AgentPanel;
  agentId: string;
}

export const AgentDynamicPanel: React.FC<AgentDynamicPanelProps> = ({
  panel,
  agentId,
}) => {
  // Construct full URL for the panel
  const panelUrl = panel.url.startsWith("http")
    ? panel.url
    : `http://localhost:3000${panel.url}`;

  return (
    <div className="flex flex-col h-full bg-[#0b0a15]/50 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-[#8b4513]/30 bg-[#0b0a15]/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ExternalLink className="text-[#f2d08a]" size={20} />
            <div>
              <h2 className="font-bold text-[#f2d08a]">{panel.name}</h2>
              <p className="text-xs text-[#f2d08a]/60 mt-0.5">
                Plugin Panel • {panel.type}
              </p>
            </div>
          </div>
          <a
            href={panelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-[#f2d08a]/10 rounded-lg text-[#f2d08a] transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={18} />
          </a>
        </div>
      </div>

      {/* iframe Container */}
      <div className="flex-1 overflow-hidden relative bg-[#1a1005]">
        <iframe
          src={panelUrl}
          title={panel.name}
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          style={{
            colorScheme: "dark",
          }}
        />

        {/* Overlay for Hyperscape theme hint */}
        <div className="absolute inset-0 pointer-events-none border-4 border-[#f2d08a]/5 rounded-lg" />
      </div>
    </div>
  );
};
