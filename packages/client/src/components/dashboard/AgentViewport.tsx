import React, { useState, useEffect } from "react";
import { Agent } from "../../screens/DashboardScreen";

interface AgentViewportProps {
  agent: Agent;
}

export const AgentViewport: React.FC<AgentViewportProps> = ({ agent }) => {
  const [authToken, setAuthToken] = useState<string>("");
  const [characterId, setCharacterId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgentCredentials();
  }, [agent.id]);

  const fetchAgentCredentials = async () => {
    try {
      // Step 1: Fetch mapping data from Hyperscape (source of truth)
      // This gives us characterId and accountId needed for credentials
      let charId = "";
      let accountId = "";

      try {
        const mappingResponse = await fetch(
          `http://localhost:5555/api/agents/mapping/${agent.id}`,
        );
        if (mappingResponse.ok) {
          const mappingData = await mappingResponse.json();
          charId = mappingData.characterId || "";
          accountId = mappingData.accountId || "";
          console.log("[AgentViewport] Got mapping:", {
            characterId: charId,
            accountId: accountId,
          });
        } else {
          console.warn(
            "[AgentViewport] Mapping not found, status:",
            mappingResponse.status,
          );
        }
      } catch (mappingError) {
        console.warn("[AgentViewport] Failed to fetch mapping:", mappingError);
      }

      // Step 2: Generate fresh JWT credentials for the embedded viewport
      // This ensures the token has the correct characterId and accountId
      let token = "";
      if (charId && accountId) {
        try {
          const credentialsResponse = await fetch(
            `http://localhost:5555/api/agents/credentials`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                characterId: charId,
                accountId: accountId,
              }),
            },
          );
          if (credentialsResponse.ok) {
            const credData = await credentialsResponse.json();
            token = credData.authToken || "";
            console.log(
              "[AgentViewport] Generated fresh JWT for embedded viewport",
            );
          } else {
            console.warn(
              "[AgentViewport] Failed to generate credentials:",
              credentialsResponse.status,
            );
          }
        } catch (credError) {
          console.warn(
            "[AgentViewport] Failed to generate credentials:",
            credError,
          );
        }
      }

      setAuthToken(token);
      setCharacterId(charId);

      console.log("[AgentViewport] Loaded credentials:", {
        hasToken: !!token,
        characterId: charId,
        agentName: agent.name,
      });
    } catch (error) {
      console.error("[AgentViewport] Error fetching credentials:", error);
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

  if (!authToken) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0b0a15] text-[#f2d08a]/60">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-[#f2d08a] mb-2">
          Agent Not Configured
        </h2>
        <p className="text-center max-w-md">
          This agent needs Hyperscape credentials. Please start the agent from
          the dashboard to generate authentication tokens.
        </p>
      </div>
    );
  }

  // Build iframe URL with all required params
  const iframeParams = new URLSearchParams({
    embedded: "true",
    mode: "spectator",
    agentId: agent.id,
    authToken: authToken,
    characterId: characterId,
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
