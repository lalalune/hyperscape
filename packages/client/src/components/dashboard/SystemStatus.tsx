import React, { useState, useEffect } from "react";
import {
  Server,
  Heart,
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";

interface ServerStatus {
  status: "healthy" | "unhealthy" | "unknown";
  uptime?: number;
  agents?: number;
  memory?: {
    used: number;
    total: number;
  };
}

interface ServerVersion {
  version?: string;
  build?: string;
  node?: string;
}

export const SystemStatus: React.FC = () => {
  const [health, setHealth] = useState<ServerStatus>({ status: "unknown" });
  const [version, setVersion] = useState<ServerVersion>({});
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      // Fetch health status from ElizaOS API
      const healthResponse = await fetch(
        "http://localhost:3000/api/server/health",
      );
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setHealth({
          status: "healthy",
          uptime: healthData.uptime,
          agents: healthData.agents,
          memory: healthData.memory,
        });

        // Extract version from health response
        if (healthData.version) {
          setVersion({
            version:
              healthData.version === "unknown" ? "1.6.4" : healthData.version,
            build: healthData.build || "N/A",
            node: typeof process !== "undefined" ? process.version : "N/A",
          });
        }
      } else {
        setHealth({ status: "unhealthy" });
      }

      setLastCheck(new Date());
    } catch (error) {
      console.error("[SystemStatus] Error fetching status:", error);
      setHealth({ status: "unhealthy" });
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return "N/A";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatMemory = (bytes?: number) => {
    if (!bytes) return "N/A";
    const mb = bytes / (1024 * 1024);
    const gb = mb / 1024;
    return gb > 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
  };

  const getStatusIcon = () => {
    switch (health.status) {
      case "healthy":
        return <CheckCircle className="text-green-400" size={24} />;
      case "unhealthy":
        return <XCircle className="text-red-400" size={24} />;
      default:
        return <AlertCircle className="text-yellow-400" size={24} />;
    }
  };

  const getStatusColor = () => {
    switch (health.status) {
      case "healthy":
        return "border-green-500/30 bg-green-900/10";
      case "unhealthy":
        return "border-red-500/30 bg-red-900/10";
      default:
        return "border-yellow-500/30 bg-yellow-900/10";
    }
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="text-[#f2d08a]" size={20} />
            <h2 className="font-bold text-[#f2d08a]">System Status</h2>
          </div>
          <button
            onClick={fetchStatus}
            className="p-2 hover:bg-[#f2d08a]/10 rounded-lg text-[#f2d08a] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Health Status Card */}
          <div className={`border rounded-lg p-6 ${getStatusColor()}`}>
            <div className="flex items-center gap-4 mb-4">
              {getStatusIcon()}
              <div>
                <h3 className="font-bold text-[#f2d08a] text-lg capitalize">
                  {health.status}
                </h3>
                <p className="text-xs text-[#f2d08a]/60">
                  Last checked: {lastCheck.toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-[#0b0a15]/50 rounded-lg p-3">
                <div className="text-xs text-[#f2d08a]/60 mb-1">Uptime</div>
                <div className="text-lg font-bold text-[#e8ebf4]">
                  {formatUptime(health.uptime)}
                </div>
              </div>

              <div className="bg-[#0b0a15]/50 rounded-lg p-3">
                <div className="text-xs text-[#f2d08a]/60 mb-1">
                  Active Agents
                </div>
                <div className="text-lg font-bold text-[#e8ebf4]">
                  {health.agents ?? "N/A"}
                </div>
              </div>

              <div className="bg-[#0b0a15]/50 rounded-lg p-3">
                <div className="text-xs text-[#f2d08a]/60 mb-1">
                  Memory Usage
                </div>
                <div className="text-lg font-bold text-[#e8ebf4]">
                  {health.memory
                    ? `${formatMemory(health.memory.used)} / ${formatMemory(health.memory.total)}`
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* Version Info Card */}
          <div className="border border-[#8b4513]/30 bg-[#1a1005] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Info className="text-[#f2d08a]" size={20} />
              <h3 className="font-bold text-[#f2d08a]">Version Information</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-[#8b4513]/20">
                <span className="text-sm text-[#f2d08a]/60">
                  ElizaOS Version
                </span>
                <span className="text-sm font-mono text-[#e8ebf4]">
                  {version.version || "N/A"}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-[#8b4513]/20">
                <span className="text-sm text-[#f2d08a]/60">Build</span>
                <span className="text-sm font-mono text-[#e8ebf4]">
                  {version.build || "N/A"}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-[#f2d08a]/60">
                  Node.js Version
                </span>
                <span className="text-sm font-mono text-[#e8ebf4]">
                  {version.node || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Server Endpoints Card */}
          <div className="border border-[#8b4513]/30 bg-[#1a1005] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Heart className="text-[#f2d08a]" size={20} />
              <h3 className="font-bold text-[#f2d08a]">Server Endpoints</h3>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 py-1">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-[#e8ebf4]/80 font-mono">
                  http://localhost:3000
                </span>
                <span className="text-[#f2d08a]/40">ElizaOS API</span>
              </div>

              <div className="flex items-center gap-2 py-1">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-[#e8ebf4]/80 font-mono">
                  http://localhost:5555
                </span>
                <span className="text-[#f2d08a]/40">Hyperscape Server</span>
              </div>

              <div className="flex items-center gap-2 py-1">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-[#e8ebf4]/80 font-mono">
                  http://localhost:3333
                </span>
                <span className="text-[#f2d08a]/40">Dashboard (Current)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
