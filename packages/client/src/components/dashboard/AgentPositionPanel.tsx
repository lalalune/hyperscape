import React, { useState, useEffect } from "react";
import { Agent } from "../../screens/DashboardScreen";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";

interface Position {
  x: number;
  y: number;
  z: number;
}

interface AgentPositionPanelProps {
  agent: Agent;
  isViewportActive: boolean;
}

export const AgentPositionPanel: React.FC<AgentPositionPanelProps> = ({
  agent,
  isViewportActive,
}) => {
  const [position, setPosition] = useState<Position | null>(null);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [characterId, setCharacterId] = useState<string | null>(null);

  // Fetch character ID once when agent changes
  useEffect(() => {
    if (agent.status !== "active") {
      setPosition(null);
      setOnline(false);
      setCharacterId(null);
      return;
    }
    fetchCharacterId();
  }, [agent.id, agent.status]);

  // Poll for position updates when viewport is active and we have characterId
  useEffect(() => {
    if (!isViewportActive || agent.status !== "active" || !characterId) return;

    // Fetch immediately
    fetchPosition();

    const interval = setInterval(fetchPosition, 1000); // Poll every 1 second for position
    return () => clearInterval(interval);
  }, [isViewportActive, agent.id, agent.status, characterId]);

  const fetchCharacterId = async () => {
    try {
      setLoading(true);
      setError(null);

      const mappingResponse = await fetch(
        `http://localhost:5555/api/agents/mapping/${agent.id}`,
      );

      if (!mappingResponse.ok) {
        if (mappingResponse.status === 404) {
          setError("Agent not mapped");
          return;
        }
        throw new Error(`Mapping failed: ${mappingResponse.status}`);
      }

      const mappingData = await mappingResponse.json();
      const charId = mappingData.characterId;

      if (!charId) {
        setError("No character linked");
        return;
      }

      setCharacterId(charId);
    } catch (err) {
      console.error("[AgentPositionPanel] Error fetching character ID:", err);
      setError("Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  const fetchPosition = async () => {
    if (!characterId) return;

    try {
      const positionResponse = await fetch(
        `http://localhost:5555/api/characters/${characterId}/position`,
      );

      if (!positionResponse.ok) {
        throw new Error(`Position failed: ${positionResponse.status}`);
      }

      const positionData = await positionResponse.json();
      setOnline(positionData.online);
      setPosition(positionData.position);
      setError(null);
    } catch (err) {
      console.error("[AgentPositionPanel] Error fetching position:", err);
      // Don't set error state on position fetch failure - just keep last known position
    }
  };

  // Don't show if agent is inactive
  if (agent.status !== "active") {
    return null;
  }

  return (
    <div className="border-t border-[#8b4513]/30 bg-[#0b0a15]/80">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2 hover:bg-[#f2d08a]/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-[#f2d08a]/60" />
          <span className="text-xs font-bold text-[#f2d08a]/80 uppercase tracking-wider">
            Position
          </span>
          {online && position && (
            <span className="text-[10px] text-[#f2d08a]/50">
              ({Math.floor(position.x)}, {Math.floor(position.z)})
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-[#f2d08a]/40" />
        ) : (
          <ChevronDown size={14} className="text-[#f2d08a]/40" />
        )}
      </button>

      {/* Position Display */}
      {expanded && (
        <div className="px-2 pb-2">
          {loading && !position ? (
            <div className="flex items-center justify-center py-3">
              <div className="animate-spin rounded-full h-4 w-4 border-t border-b border-[#f2d08a]/60" />
            </div>
          ) : error ? (
            <div className="text-center py-2 text-[10px] text-red-400/70">
              {error}
            </div>
          ) : !online ? (
            <div className="text-center py-2 text-[10px] text-[#f2d08a]/50">
              Agent offline
            </div>
          ) : position ? (
            <div className="space-y-1">
              {/* Coordinate Grid - Show tile positions (whole numbers) */}
              <div className="grid grid-cols-3 gap-1">
                <CoordinateBox
                  label="X"
                  value={Math.floor(position.x)}
                  color="red"
                />
                <CoordinateBox
                  label="Y"
                  value={Math.floor(position.y)}
                  color="green"
                />
                <CoordinateBox
                  label="Z"
                  value={Math.floor(position.z)}
                  color="blue"
                />
              </div>

              {/* Copy button */}
              <button
                onClick={() => {
                  const coordString = `${Math.floor(position.x)}, ${Math.floor(position.y)}, ${Math.floor(position.z)}`;
                  navigator.clipboard.writeText(coordString);
                }}
                className="w-full mt-1 py-1 px-2 text-[9px] text-[#f2d08a]/60 hover:text-[#f2d08a] hover:bg-[#f2d08a]/10 rounded transition-colors"
              >
                Copy Coordinates
              </button>

              {/* Live indicator when viewport active */}
              {isViewportActive && (
                <div className="flex items-center justify-center gap-1 mt-1 pt-1 border-t border-[#8b4513]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[9px] text-green-500/80">
                    Live Tracking
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

function CoordinateBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "red" | "green" | "blue";
}) {
  const colorClasses = {
    red: "border-red-500/30 text-red-400",
    green: "border-green-500/30 text-green-400",
    blue: "border-blue-500/30 text-blue-400",
  };

  return (
    <div
      className={`flex flex-col items-center p-1.5 rounded bg-black/30 border ${colorClasses[color]}`}
    >
      <span className="text-[8px] opacity-60 uppercase">{label}</span>
      <span className="text-[11px] font-mono font-bold">{value}</span>
    </div>
  );
}
