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
  Lock,
  Unlock,
  RefreshCw,
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
  locked?: boolean;
  lockedBy?: string;
}

interface AvailableGoal {
  id: string;
  type: string;
  description: string;
  priority: number;
  reason: string;
  targetSkill?: string;
  targetSkillLevel?: number;
  location?: string;
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
  const [availableGoals, setAvailableGoals] = useState<AvailableGoal[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showSelector, setShowSelector] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [settingGoal, setSettingGoal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll for goal updates when viewport is active
  useEffect(() => {
    if (agent.status !== "active") {
      setGoal(null);
      setAvailableGoals([]);
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
      setAvailableGoals(data.availableGoals || []);
      setError(null);
    } catch (err) {
      console.error("[AgentGoalPanel] Error fetching goal:", err);
      // Don't show error on fetch failure - just keep last known state
    } finally {
      setLoading(false);
    }
  };

  const handleSetGoal = async () => {
    if (!selectedGoalId) return;

    setSettingGoal(true);
    try {
      const response = await fetch(
        `http://localhost:5555/api/agents/${agent.id}/goal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goalId: selectedGoalId }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to set goal");
      }

      // Success - close selector and refresh
      setShowSelector(false);
      setSelectedGoalId(null);
      await fetchGoal();
    } catch (err) {
      console.error("[AgentGoalPanel] Error setting goal:", err);
      setError(err instanceof Error ? err.message : "Failed to set goal");
    } finally {
      setSettingGoal(false);
    }
  };

  const handleUnlockGoal = async () => {
    try {
      const response = await fetch(
        `http://localhost:5555/api/agents/${agent.id}/goal/unlock`,
        { method: "POST" },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to unlock goal");
      }

      await fetchGoal();
    } catch (err) {
      console.error("[AgentGoalPanel] Error unlocking goal:", err);
      setError(err instanceof Error ? err.message : "Failed to unlock goal");
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
            <>
              <span className="text-[10px] text-[#f2d08a]/50">
                {goal.progressPercent}%
              </span>
              {goal.locked && <Lock size={10} className="text-yellow-500/70" />}
            </>
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
              {availableGoals.length > 0 && (
                <button
                  onClick={() => setShowSelector(true)}
                  className="mt-2 px-3 py-1 text-[9px] bg-[#f2d08a]/20 hover:bg-[#f2d08a]/30 text-[#f2d08a] rounded border border-[#f2d08a]/30 transition-colors"
                >
                  Set Goal Manually
                </button>
              )}
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

              {/* Lock Status & Controls */}
              <div className="flex items-center justify-between pt-1 border-t border-[#8b4513]/20">
                <div className="flex items-center gap-2">
                  {/* Elapsed Time */}
                  <div className="flex items-center gap-1">
                    <Clock size={10} className="text-[#f2d08a]/40" />
                    <span className="text-[9px] text-[#f2d08a]/50">
                      {formatElapsed(goal.elapsedMs)}
                    </span>
                  </div>

                  {/* Lock indicator */}
                  {goal.locked && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20">
                      <Lock size={8} className="text-yellow-500/70" />
                      <span className="text-[8px] text-yellow-500/70">
                        Manual
                      </span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  {goal.locked && (
                    <button
                      onClick={handleUnlockGoal}
                      className="p-1 rounded hover:bg-[#f2d08a]/10 transition-colors group"
                      title="Unlock (allow autonomous changes)"
                    >
                      <Unlock
                        size={12}
                        className="text-[#f2d08a]/40 group-hover:text-[#f2d08a]/80"
                      />
                    </button>
                  )}
                  <button
                    onClick={() => setShowSelector(true)}
                    className="p-1 rounded hover:bg-[#f2d08a]/10 transition-colors group"
                    title="Change goal"
                  >
                    <RefreshCw
                      size={12}
                      className="text-[#f2d08a]/40 group-hover:text-[#f2d08a]/80"
                    />
                  </button>
                </div>
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

          {/* Goal Selector Modal */}
          {showSelector && (
            <div className="mt-2 p-2 rounded bg-black/50 border border-[#f2d08a]/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[#f2d08a]/80">
                  Select New Goal
                </span>
                <button
                  onClick={() => {
                    setShowSelector(false);
                    setSelectedGoalId(null);
                  }}
                  className="text-[#f2d08a]/40 hover:text-[#f2d08a]/80 text-xs"
                >
                  ✕
                </button>
              </div>

              {availableGoals.length === 0 ? (
                <div className="text-center py-2 text-[9px] text-[#f2d08a]/50">
                  No goals available
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {availableGoals
                    .sort((a, b) => b.priority - a.priority)
                    .map((g) => (
                      <label
                        key={g.id}
                        className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                          selectedGoalId === g.id
                            ? "bg-[#f2d08a]/20 border border-[#f2d08a]/40"
                            : "hover:bg-[#f2d08a]/10 border border-transparent"
                        }`}
                      >
                        <input
                          type="radio"
                          name="goalSelection"
                          checked={selectedGoalId === g.id}
                          onChange={() => setSelectedGoalId(g.id)}
                          className="mt-0.5 accent-[#f2d08a]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            {getGoalIcon(g.type)}
                            <span className="text-[9px] font-bold text-[#f2d08a]/90">
                              {g.type.replace(/_/g, " ")}
                            </span>
                            {g.priority >= 70 && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/20 text-green-400">
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="text-[8px] text-[#e8ebf4]/60 mt-0.5">
                            {g.description}
                          </div>
                          <div className="text-[8px] text-[#f2d08a]/40 mt-0.5 italic">
                            {g.reason}
                          </div>
                        </div>
                      </label>
                    ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-2 pt-2 border-t border-[#8b4513]/20">
                <button
                  onClick={() => {
                    setShowSelector(false);
                    setSelectedGoalId(null);
                  }}
                  className="flex-1 px-2 py-1 text-[9px] bg-black/30 hover:bg-black/50 text-[#f2d08a]/60 rounded border border-[#8b4513]/30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetGoal}
                  disabled={!selectedGoalId || settingGoal}
                  className="flex-1 px-2 py-1 text-[9px] bg-[#f2d08a]/20 hover:bg-[#f2d08a]/30 text-[#f2d08a] rounded border border-[#f2d08a]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {settingGoal ? "Setting..." : "Set Goal"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
