import React, { useState, useEffect } from "react";
import { Agent } from "../../screens/DashboardScreen";
import {
  ChevronDown,
  ChevronUp,
  Target,
  Swords,
  TreePine,
  Compass,
  Clock,
} from "lucide-react";

interface Goal {
  type: string;
  description: string;
  progress: number;
  target: number;
  progressPercent: number;
  location?: string;
  targetEntity?: string;
  targetSkill?: string;
  targetSkillLevel?: number;
  startedAt: number;
  elapsedMs: number;
}

interface AgentGoalPanelProps {
  agent: Agent;
  isViewportActive: boolean;
}

export const AgentGoalPanel: React.FC<AgentGoalPanelProps> = ({
  agent,
  isViewportActive,
}) => {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Poll for goal updates when viewport is active
  useEffect(() => {
    if (agent.status !== "active") {
      setGoal(null);
      return;
    }

    // Fetch immediately
    fetchGoal();

    // Poll every 2 seconds for goal updates
    const interval = setInterval(fetchGoal, 2000);
    return () => clearInterval(interval);
  }, [agent.id, agent.status]);

  const fetchGoal = async () => {
    try {
      // Call Hyperscape server API on port 5555
      const response = await fetch(
        `http://localhost:5555/api/agents/${agent.id}/goal`,
      );

      if (!response.ok) {
        if (response.status === 503) {
          setError("Service not ready");
          return;
        }
        throw new Error(`Failed: ${response.status}`);
      }

      const data = await response.json();
      setGoal(data.goal);
      setError(null);
    } catch (err) {
      console.error("[AgentGoalPanel] Error fetching goal:", err);
      // Don't show error on fetch failure - just keep last known state
    } finally {
      setLoading(false);
    }
  };

  // Don't show if agent is inactive
  if (agent.status !== "active") {
    return null;
  }

  // Get icon based on goal type
  const getGoalIcon = (type: string) => {
    switch (type) {
      case "combat_training":
        return <Swords size={14} className="text-red-400" />;
      case "woodcutting":
        return <TreePine size={14} className="text-green-400" />;
      case "exploration":
        return <Compass size={14} className="text-blue-400" />;
      default:
        return <Target size={14} className="text-[#f2d08a]" />;
    }
  };

  // Format elapsed time
  const formatElapsed = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="border-t border-[#8b4513]/30 bg-[#0b0a15]/80">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2 hover:bg-[#f2d08a]/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target size={14} className="text-[#f2d08a]/60" />
          <span className="text-xs font-bold text-[#f2d08a]/80 uppercase tracking-wider">
            Current Goal
          </span>
          {goal && (
            <span className="text-[10px] text-[#f2d08a]/50">
              {goal.progressPercent}%
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-[#f2d08a]/40" />
        ) : (
          <ChevronDown size={14} className="text-[#f2d08a]/40" />
        )}
      </button>

      {/* Goal Display */}
      {expanded && (
        <div className="px-2 pb-2">
          {loading && !goal ? (
            <div className="flex items-center justify-center py-3">
              <div className="animate-spin rounded-full h-4 w-4 border-t border-b border-[#f2d08a]/60" />
            </div>
          ) : error ? (
            <div className="text-center py-2 text-[10px] text-red-400/70">
              {error}
            </div>
          ) : !goal ? (
            <div className="text-center py-3 text-[10px] text-[#f2d08a]/50">
              No active goal
              <div className="text-[9px] opacity-60 mt-1">
                Agent will set a goal automatically
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Goal Type & Description */}
              <div className="flex items-start gap-2 p-2 rounded bg-black/30 border border-[#f2d08a]/20">
                {getGoalIcon(goal.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-[#f2d08a] uppercase">
                    {goal.type.replace(/_/g, " ")}
                  </div>
                  <div className="text-[9px] text-[#e8ebf4]/70 mt-0.5 leading-relaxed">
                    {goal.description}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px]">
                  <span className="text-[#f2d08a]/60">Progress</span>
                  <span className="text-[#f2d08a]">
                    {goal.progress}/{goal.target}
                  </span>
                </div>
                <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-[#f2d08a]/20">
                  <div
                    className="h-full bg-gradient-to-r from-[#f2d08a] to-[#8b4513] transition-all duration-500"
                    style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Skill Target (if skill-based goal) */}
              {goal.targetSkill && goal.targetSkillLevel && (
                <div className="flex items-center justify-between p-1.5 rounded bg-blue-500/10 border border-blue-500/20">
                  <span className="text-[9px] text-blue-300/80">
                    Target: {goal.targetSkill}
                  </span>
                  <span className="text-[10px] font-bold text-blue-300">
                    Level {goal.targetSkillLevel}
                  </span>
                </div>
              )}

              {/* Elapsed Time */}
              <div className="flex items-center justify-center gap-1 pt-1 border-t border-[#8b4513]/20">
                <Clock size={10} className="text-[#f2d08a]/40" />
                <span className="text-[9px] text-[#f2d08a]/50">
                  {formatElapsed(goal.elapsedMs)}
                </span>
              </div>

              {/* Live indicator when viewport active */}
              {isViewportActive && (
                <div className="flex items-center justify-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[9px] text-green-500/80">
                    Live Tracking
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
