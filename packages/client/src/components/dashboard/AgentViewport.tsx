import React, { useState, useEffect } from "react";
import { Agent } from "../../screens/DashboardScreen";

interface AgentViewportProps {
  agent: Agent;
}

export const AgentViewport: React.FC<AgentViewportProps> = ({ agent }) => {
  const [characterId, setCharacterId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCharacterId();
  }, [agent.id]);

  const fetchCharacterId = async () => {
    try {
      // Fetch character ID for the spectator viewport to follow
      // We also need to verify ownership on the server
      const mappingResponse = await fetch(
        `http://localhost:5555/api/agents/mapping/${agent.id}`,
      );
      if (mappingResponse.ok) {
        const mappingData = await mappingResponse.json();
        const charId = mappingData.characterId || "";
        setCharacterId(charId);
      } else {
        console.warn(
          "[AgentViewport] Mapping not found, status:",
          mappingResponse.status,
        );
      }
    } catch (error) {
      console.error("[AgentViewport] Error fetching character ID:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0b0a15]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f2d08a]"></div>
      </div>
    );
  }

  // Only load game world when agent is active
  if (agent.status !== "active") {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0b0a15] text-[#f2d08a]/60">
        <div className="text-6xl mb-4">⏸️</div>
        <h2 className="text-xl font-bold text-[#f2d08a] mb-2">
          Agent is {agent.status}
        </h2>
        <p className="text-center max-w-md">
          Start the agent to view the live game world. The agent must be running
          to connect to the game server.
        </p>
      </div>
    );
  }

  if (!characterId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0b0a15] text-[#f2d08a]/60">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-[#f2d08a] mb-2">
          Character Not Found
        </h2>
        <p className="text-center max-w-md">
          Could not find character for this agent. Make sure the agent is
          properly configured.
        </p>
      </div>
    );
  }

  // Build iframe URL for spectator mode
  // Spectators must prove ownership by passing their Privy user ID
  // Server verifies they own the character before allowing spectator connection
  const userAccountId = localStorage.getItem("privy_user_id") || "";

  const iframeParams = new URLSearchParams({
    embedded: "true",
    mode: "spectator", // Server recognizes this and skips auth token validation
    agentId: agent.id,
    characterId: characterId,
    followEntity: characterId, // Camera will follow this entity
    privyUserId: userAccountId, // For ownership verification
    hiddenUI: "chat,inventory,minimap,hotbar,stats",
  });

  return (
    <div className="flex flex-col h-full bg-black relative">
      {/* Overlay Info */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md border border-[#f2d08a]/30 rounded-lg p-2 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[#f2d08a] font-bold text-sm uppercase tracking-wider">
            Live Feed
          </span>
          <span className="text-[#f2d08a]/60 text-xs border-l border-[#f2d08a]/20 pl-3">
            {agent.characterName || agent.name}
          </span>
        </div>
      </div>

      {/* Iframe Viewport */}
      <iframe
        className="w-full h-full border-none bg-[#0b0a15]"
        src={`/?${iframeParams.toString()}`}
        allow="autoplay; fullscreen; microphone; camera"
        title={`Viewport: ${agent.characterName || agent.name}`}
      />
    </div>
  );
};
