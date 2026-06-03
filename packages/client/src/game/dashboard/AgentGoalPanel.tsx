import React, { useState, useEffect, useRef, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { Agent } from "./types";
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
  Timer,
  CheckCircle,
  Fish,
  Flame,
  Pickaxe,
  Square,
  Play,
  Pause,
} from "lucide-react";

// Configuration constants
const GOAL_POLL_INTERVAL_MS = 10000; // Poll every 10 seconds to avoid rate limiting
const MAX_RECENT_GOALS = 5; // Maximum number of recent goals to track
const MIN_ELAPSED_MS_FOR_ESTIMATE = 5000; // Minimum elapsed time before showing time estimate
const MIN_PROGRESS_FOR_ESTIMATE = 1; // Minimum progress percentage for time estimate

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

interface DesireScore {
  goalType: string;
  score: number;
  breakdown: string;
}

interface RecentGoal {
  type: string;
  description: string;
  completedAt: number;
  success: boolean;
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
  const [recentGoals, setRecentGoals] = useState<RecentGoal[]>([]);
  const [lastGoalType, setLastGoalType] = useState<string | null>(null);
  const [goalsPaused, setGoalsPaused] = useState(false);
  const [desireScores, setDesireScores] = useState<DesireScore[]>([]);
  const pollTimeoutRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const fetchGoal = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      // Call Hyperia server API
      const result = await apiClient.get<{
        goal?: Goal;
        availableGoals?: AvailableGoal[];
        goalsPaused?: boolean;
        desireScores?: DesireScore[];
      }>(`/api/agents/${agent.id}/goal`);

      if (!result.ok) {
        if (result.status === 503) {
          setError("Service not ready");
          return;
        }
        throw new Error(`Failed: ${result.error || result.status}`);
      }

      const data = result.data;

      // Track goal changes for history
      if (data?.goal && lastGoalType && lastGoalType !== data.goal.type) {
        // Previous goal completed or changed
        setRecentGoals((prev) => {
          const newGoal: RecentGoal = {
            type: lastGoalType,
            description: goal?.description || lastGoalType.replace(/_/g, " "),
            completedAt: Date.now(),
            success: (goal?.progressPercent || 0) >= 100,
          };
          return [newGoal, ...prev].slice(0, MAX_RECENT_GOALS);
        });
      }

      if (data?.goal) {
        setLastGoalType(data.goal.type);
      }

      setGoal(data?.goal || null);
      setAvailableGoals(data?.availableGoals || []);
      setGoalsPaused(data?.goalsPaused || false);
      setDesireScores(data?.desireScores || []);
      setError(null);
    } catch (err) {
      console.error("[AgentGoalPanel] Error fetching goal:", err);
      // Don't show error on fetch failure - just keep last known state
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [agent.id, goal?.description, goal?.progressPercent, lastGoalType]);

  useEffect(() => {
    if (agent.status !== "active") {
      setGoal(null);
      setAvailableGoals([]);
      return;
    }

    let cancelled = false;
    const schedule = (delay: number) => {
      if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = window.setTimeout(run, delay);
    };
    const run = async () => {
      await fetchGoal();
      if (!cancelled) {
        schedule(
          !document.hidden && isViewportActive
            ? GOAL_POLL_INTERVAL_MS
            : GOAL_POLL_INTERVAL_MS * 2,
        );
      }
    };
    const onVisibilityChange = () => {
      if (!cancelled)
        schedule(document.hidden ? GOAL_POLL_INTERVAL_MS * 2 : 1000);
    };

    void run();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
    };
  }, [agent.status, fetchGoal, isViewportActive]);

  const handleSetGoal = async () => {
    if (!selectedGoalId) return;

    setSettingGoal(true);
    try {
      const result = await apiClient.post<{ error?: string }>(
        `/api/agents/${agent.id}/goal`,
        { goalId: selectedGoalId },
      );

      if (!result.ok) {
        throw new Error(result.error || "Failed to set goal");
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
      const result = await apiClient.post<{ error?: string }>(
        `/api/agents/${agent.id}/goal/unlock`,
      );

      if (!result.ok) {
        throw new Error(result.error || "Failed to unlock goal");
      }

      await fetchGoal();
    } catch (err) {
      console.error("[AgentGoalPanel] Error unlocking goal:", err);
      setError(err instanceof Error ? err.message : "Failed to unlock goal");
    }
  };

  const handleStopGoal = async () => {
    try {
      const result = await apiClient.post<{ error?: string }>(
        `/api/agents/${agent.id}/goal/stop`,
      );

      if (!result.ok) {
        throw new Error(result.error || "Failed to stop goal");
      }

      await fetchGoal();
    } catch (err) {
      console.error("[AgentGoalPanel] Error stopping goal:", err);
      setError(err instanceof Error ? err.message : "Failed to stop goal");
    }
  };

  const handleResumeGoal = async () => {
    try {
      const result = await apiClient.post<{ error?: string }>(
        `/api/agents/${agent.id}/goal/resume`,
      );

      if (!result.ok) {
        throw new Error(result.error || "Failed to resume goals");
      }

      await fetchGoal();
    } catch (err) {
      console.error("[AgentGoalPanel] Error resuming goals:", err);
      setError(err instanceof Error ? err.message : "Failed to resume goals");
    }
  };

  // Don't show if agent is inactive
  if (agent.status !== "active") {
    return null;
  }

  // Get icon based on goal type
  const getGoalIcon = (type: string, size = 14) => {
    switch (type) {
      case "combat_training":
      case "combat":
        return <Swords size={size} className="text-red-400" />;
      case "woodcutting":
      case "train_woodcutting":
        return <TreePine size={size} className="text-green-400" />;
      case "fishing":
      case "train_fishing":
        return <Fish size={size} className="text-blue-400" />;
      case "firemaking":
      case "train_firemaking":
        return <Flame size={size} className="text-orange-400" />;
      case "mining":
      case "train_mining":
        return <Pickaxe size={size} className="text-gray-400" />;
      case "exploration":
      case "explore":
        return <Compass size={size} className="text-blue-400" />;
      default:
        return <Target size={size} className="text-[#f2d08a]" />;
    }
  };

  // Estimate time to completion based on progress rate
  const getEstimatedTimeRemaining = (g: Goal): string | null => {
    if (g.progressPercent >= 100) return null;
    // Need some progress and elapsed time to estimate
    if (
      g.elapsedMs < MIN_ELAPSED_MS_FOR_ESTIMATE ||
      g.progressPercent < MIN_PROGRESS_FOR_ESTIMATE
    ) {
      return null;
    }

    const msPerPercent = g.elapsedMs / g.progressPercent;
    const remainingPercent = 100 - g.progressPercent;
    const estimatedMs = msPerPercent * remainingPercent;

    // Format as human readable
    const minutes = Math.floor(estimatedMs / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `~${hours}h ${minutes % 60}m remaining`;
    } else if (minutes > 0) {
      return `~${minutes}m remaining`;
    } else {
      return "< 1m remaining";
    }
  };

  // Get XP rate if applicable
  const getXpRate = (g: Goal): string | null => {
    if (!g.targetSkill || g.elapsedMs < 10000) return null;

    // Estimate XP based on progress and typical XP curves
    // This is an approximation - server should provide actual XP
    const hoursElapsed = g.elapsedMs / 3600000;
    if (hoursElapsed < 0.01) return null;

    // Rough XP estimate based on progress (varies by skill)
    const xpGained = g.progress * 25; // ~25 XP per unit of progress (avg)
    const xpPerHour = Math.round(xpGained / hoursElapsed);

    if (xpPerHour > 0) {
      return `${xpPerHour.toLocaleString()} XP/hr`;
    }
    return null;
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
              {goalsPaused ? (
                <>
                  <div className="flex items-center justify-center gap-1.5 text-yellow-500/80">
                    <Pause size={12} />
                    <span className="font-medium">Goals Paused</span>
                  </div>
                  <div className="text-[9px] opacity-60 mt-1">
                    Agent is idle and waiting for instructions
                  </div>
                  <div className="flex gap-2 mt-2 justify-center">
                    <button
                      onClick={handleResumeGoal}
                      className="px-3 py-1 text-[9px] bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded border border-green-500/30 transition-colors flex items-center gap-1"
                    >
                      <Play size={10} />
                      Resume Auto
                    </button>
                    {availableGoals.length > 0 && (
                      <button
                        onClick={() => setShowSelector(true)}
                        className="px-3 py-1 text-[9px] bg-[#f2d08a]/20 hover:bg-[#f2d08a]/30 text-[#f2d08a] rounded border border-[#f2d08a]/30 transition-colors"
                      >
                        Set Goal
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
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
                </>
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

              {/* Estimated Time & XP Rate */}
              {(getEstimatedTimeRemaining(goal) || getXpRate(goal)) && (
                <div className="flex items-center justify-between p-1.5 rounded bg-[#f2d08a]/5 border border-[#f2d08a]/10">
                  {getEstimatedTimeRemaining(goal) && (
                    <div className="flex items-center gap-1">
                      <Timer size={10} className="text-[#f2d08a]/60" />
                      <span className="text-[9px] text-[#f2d08a]/80">
                        {getEstimatedTimeRemaining(goal)}
                      </span>
                    </div>
                  )}
                  {getXpRate(goal) && (
                    <span className="text-[9px] text-green-400/80 font-medium">
                      {getXpRate(goal)}
                    </span>
                  )}
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
                  <button
                    onClick={handleStopGoal}
                    className="p-1 rounded hover:bg-red-500/20 transition-colors group"
                    title="Stop current goal"
                  >
                    <Square
                      size={12}
                      fill="currentColor"
                      className="text-red-400/40 group-hover:text-red-400/80"
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

              {/* Recent Goals History */}
              {recentGoals.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#8b4513]/20">
                  <div className="text-[9px] font-bold text-[#f2d08a]/60 uppercase tracking-wider mb-1.5">
                    Recent Goals
                  </div>
                  <div className="space-y-1">
                    {recentGoals.slice(0, 3).map((rg, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-[9px] text-[#e8ebf4]/60"
                      >
                        {rg.success ? (
                          <CheckCircle
                            size={10}
                            className="text-green-400/70"
                          />
                        ) : (
                          getGoalIcon(rg.type, 10)
                        )}
                        <span className="flex-1 truncate">
                          {rg.description}
                        </span>
                        <span className="text-[8px] text-[#f2d08a]/40">
                          {formatElapsed(Date.now() - rg.completedAt)} ago
                        </span>
                      </div>
                    ))}
                  </div>
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
                            {(() => {
                              const ds = desireScores.find(
                                (d) => d.goalType === g.type,
                              );
                              if (!ds) return null;
                              const color =
                                ds.score >= 30
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : ds.score >= 10
                                    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                    : "bg-gray-500/20 text-gray-400 border-gray-500/30";
                              return (
                                <span
                                  className={`text-[8px] px-1 py-0.5 rounded border ${color}`}
                                  title={ds.breakdown}
                                >
                                  {ds.score}
                                </span>
                              );
                            })()}
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
