import React, { useState, useEffect } from "react";
import {
  Activity,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Filter,
} from "lucide-react";
import { Agent } from "../../screens/DashboardScreen";

interface AgentRun {
  id: string;
  agentId: string;
  roomId: string;
  status: "started" | "completed" | "timeout" | "error";
  startedAt: number;
  completedAt?: number;
  duration?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface AgentRunsProps {
  agent: Agent;
}

export const AgentRuns: React.FC<AgentRunsProps> = ({ agent }) => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchRuns();
  }, [agent.id, statusFilter]);

  const fetchRuns = async () => {
    try {
      const params = new URLSearchParams({
        limit: "50",
      });

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(
        `http://localhost:3000/api/agents/${agent.id}/runs?${params.toString()}`,
      );

      if (!response.ok) {
        console.warn("[AgentRuns] Failed to fetch runs");
        setRuns([]);
        return;
      }

      const data = await response.json();
      console.log("[AgentRuns] Fetched runs:", data);

      setRuns(data.runs || []);
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
    } catch (error) {
      console.error("[AgentRuns] Error fetching runs:", error);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle size={16} className="text-green-400" />;
      case "error":
        return <XCircle size={16} className="text-red-400" />;
      case "timeout":
        return <Clock size={16} className="text-orange-400" />;
      case "started":
        return <Play size={16} className="text-blue-400" />;
      default:
        return <Activity size={16} className="text-[#f2d08a]" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "border-green-500/30 bg-green-900/10";
      case "error":
        return "border-red-500/30 bg-red-900/10";
      case "timeout":
        return "border-orange-500/30 bg-orange-900/10";
      case "started":
        return "border-blue-500/30 bg-blue-900/10";
      default:
        return "border-[#8b4513]/30 bg-[#1a1005]";
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "N/A";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0b0a15]/50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f2d08a]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0a15]/50 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-[#8b4513]/30 bg-[#0b0a15]/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="text-[#f2d08a]" size={20} />
            <h2 className="font-bold text-[#f2d08a]">Agent Runs</h2>
            <span className="px-2 py-0.5 rounded text-[10px] bg-[#f2d08a]/10 text-[#f2d08a] border border-[#f2d08a]/20">
              {total} Total
            </span>
          </div>
          <button
            onClick={fetchRuns}
            className="p-2 hover:bg-[#f2d08a]/10 rounded-lg text-[#f2d08a] transition-colors"
            title="Refresh"
          >
            <Activity size={18} />
          </button>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[#f2d08a]/40" />
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1 text-xs rounded ${
              statusFilter === "all"
                ? "bg-[#f2d08a]/20 text-[#f2d08a]"
                : "bg-[#1a1005] text-[#f2d08a]/40 hover:text-[#f2d08a]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter("started")}
            className={`px-3 py-1 text-xs rounded ${
              statusFilter === "started"
                ? "bg-blue-500/20 text-blue-400"
                : "bg-[#1a1005] text-[#f2d08a]/40 hover:text-blue-400"
            }`}
          >
            Started
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`px-3 py-1 text-xs rounded ${
              statusFilter === "completed"
                ? "bg-green-500/20 text-green-400"
                : "bg-[#1a1005] text-[#f2d08a]/40 hover:text-green-400"
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setStatusFilter("error")}
            className={`px-3 py-1 text-xs rounded ${
              statusFilter === "error"
                ? "bg-red-500/20 text-red-400"
                : "bg-[#1a1005] text-[#f2d08a]/40 hover:text-red-400"
            }`}
          >
            Errors
          </button>
          <button
            onClick={() => setStatusFilter("timeout")}
            className={`px-3 py-1 text-xs rounded ${
              statusFilter === "timeout"
                ? "bg-orange-500/20 text-orange-400"
                : "bg-[#1a1005] text-[#f2d08a]/40 hover:text-orange-400"
            }`}
          >
            Timeout
          </button>
        </div>
      </div>

      {/* Runs List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#f2d08a]/40">
            <Activity size={48} className="mb-4" />
            <p className="text-center">
              {statusFilter === "all"
                ? "No runs yet"
                : `No ${statusFilter} runs`}
            </p>
          </div>
        ) : (
          <>
            {runs.map((run) => (
              <div
                key={run.id}
                className={`border rounded-lg p-4 transition-colors ${getStatusColor(
                  run.status,
                )}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(run.status)}
                    <span className="font-medium text-[#e8ebf4] text-sm capitalize">
                      {run.status}
                    </span>
                  </div>
                  <span className="text-xs text-[#f2d08a]/40">
                    {new Date(run.startedAt).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#f2d08a]/60">Duration:</span>
                    <span className="ml-2 text-[#e8ebf4]">
                      {formatDuration(run.duration)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#f2d08a]/60">Room:</span>
                    <span className="ml-2 text-[#e8ebf4] font-mono">
                      {run.roomId.substring(0, 8)}...
                    </span>
                  </div>
                </div>

                {run.error && (
                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>{run.error}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {hasMore && (
              <div className="text-center py-4">
                <button
                  onClick={fetchRuns}
                  className="px-4 py-2 text-sm bg-[#f2d08a]/10 border border-[#f2d08a]/30 rounded-lg text-[#f2d08a] hover:bg-[#f2d08a]/20 transition-colors"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
