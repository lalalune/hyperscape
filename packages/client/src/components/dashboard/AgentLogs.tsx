import React, { useState, useEffect } from "react";
import { Terminal, Clock, Filter, Download, Pause, Play } from "lucide-react";
import { Agent } from "../../screens/DashboardScreen";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug" | "success" | "warning";
  message: string;
  source: string;
}

interface AgentLogsProps {
  agent: Agent;
}

export const AgentLogs: React.FC<AgentLogsProps> = ({ agent }) => {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [filter, setFilter] = React.useState<string>("all");
  const [isPaused, setIsPaused] = React.useState(false);
  const logsEndRef = React.useRef<HTMLDivElement>(null);

  // Fetch logs from API
  React.useEffect(() => {
    const fetchLogs = async () => {
      if (isPaused) return;

      try {
        const response = await fetch(
          `http://localhost:3000/hyperscape/logs/${agent.id}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const formattedLogs = data.logs.map((log: any) => ({
              ...log,
              timestamp: new Date(log.timestamp),
            }));
            setLogs(formattedLogs);
          }
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [agent.id, isPaused]);

  // Auto-scroll to bottom
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    if (filter === "error") return log.level === "error";
    if (filter === "warning")
      return log.level === "warn" || log.level === "warning"; // Handle both 'warn' and 'warning'
    if (filter === "success") return log.level === "success";
    if (filter === "info") return log.level === "info";
    if (filter === "debug") return log.level === "debug";
    return true;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-red-400";
      case "warn":
      case "warning":
        return "text-yellow-400";
      case "debug":
        return "text-blue-400";
      case "success":
        return "text-green-500"; // Added success color
      default:
        return "text-green-400"; // Default for info
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0a15]/50 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-[#8b4513]/30 bg-[#0b0a15]/80 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Terminal className="text-[#f2d08a]" size={20} />
          <h2 className="font-bold text-[#f2d08a]">Live Logs</h2>
          <span className="px-2 py-0.5 rounded text-[10px] bg-[#f2d08a]/10 text-[#f2d08a] border border-[#f2d08a]/20">
            {logs.length} Events
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-1">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 text-xs rounded ${filter === "all" ? "bg-[#f2d08a]/20 text-[#f2d08a]" : "text-[#f2d08a]/40 hover:text-[#f2d08a]"}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("error")}
              className={`px-3 py-1 text-xs rounded ${filter === "error" ? "bg-red-500/20 text-red-400" : "text-[#f2d08a]/40 hover:text-red-400"}`}
            >
              Errors
            </button>
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 hover:bg-[#f2d08a]/10 rounded-lg text-[#f2d08a]/60 hover:text-[#f2d08a] transition-colors"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>

          <button className="p-2 hover:bg-[#f2d08a]/10 rounded-lg text-[#f2d08a]/60 hover:text-[#f2d08a] transition-colors">
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Logs Viewer */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-[#050408]">
        <div className="space-y-1">
          {logs
            .filter((log) => filter === "all" || log.level === filter)
            .map((log) => (
              <div
                key={log.id}
                className="flex gap-3 hover:bg-[#f2d08a]/5 p-1 rounded transition-colors group"
              >
                <span className="text-[#f2d08a]/30 w-20 flex-shrink-0 text-xs pt-0.5">
                  {log.timestamp.toLocaleTimeString([], {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>

                <span
                  className={`w-16 flex-shrink-0 text-xs font-bold pt-0.5 uppercase ${getLevelColor(log.level)}`}
                >
                  {log.level}
                </span>

                <span className="text-[#f2d08a]/60 w-32 flex-shrink-0 text-xs pt-0.5 truncate">
                  [{log.source}]
                </span>

                <span className="text-[#e8ebf4]/80 flex-1 break-all">
                  {log.message}
                </span>
              </div>
            ))}

          {logs.length === 0 && (
            <div className="text-center py-20 text-[#f2d08a]/20">
              Waiting for logs...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
