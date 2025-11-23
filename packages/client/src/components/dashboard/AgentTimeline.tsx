import React, { useState, useEffect } from "react";
import { Clock, Activity, MessageSquare, Zap, AlertCircle } from "lucide-react";
import { Agent } from "../../screens/DashboardScreen";

interface TimelineEvent {
  id: string;
  type: "message" | "action" | "error" | "system";
  title: string;
  description: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface AgentTimelineProps {
  agent: Agent;
}

export const AgentTimeline: React.FC<AgentTimelineProps> = ({ agent }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchTimeline();
  }, [agent.id]);

  const fetchTimeline = async () => {
    try {
      // For now, we'll use logs as timeline events
      // In a real implementation, this would fetch from a dedicated timeline API
      const response = await fetch(
        `http://localhost:3000/api/agents/${agent.id}/logs?count=50`,
      );

      if (!response.ok) {
        console.warn("[AgentTimeline] Failed to fetch timeline");
        setEvents([]);
        return;
      }

      const logs = await response.json();
      console.log("[AgentTimeline] Fetched logs:", logs);

      // Transform logs to timeline events
      const timelineEvents: TimelineEvent[] = (
        Array.isArray(logs) ? logs : []
      ).map((log: any) => ({
        id: log.id || `${Date.now()}-${Math.random()}`,
        type: log.level === "error" ? "error" : log.type || "system",
        title: log.message || log.body || "Activity",
        description: log.source || agent.name,
        timestamp: new Date(
          log.timestamp || log.createdAt || Date.now(),
        ).getTime(),
        metadata: log,
      }));

      setEvents(timelineEvents);
    } catch (error) {
      console.error("[AgentTimeline] Error fetching timeline:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "message":
        return <MessageSquare size={16} className="text-blue-400" />;
      case "action":
        return <Zap size={16} className="text-yellow-400" />;
      case "error":
        return <AlertCircle size={16} className="text-red-400" />;
      default:
        return <Activity size={16} className="text-[#f2d08a]" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "message":
        return "border-blue-500/30 bg-blue-900/10";
      case "action":
        return "border-yellow-500/30 bg-yellow-900/10";
      case "error":
        return "border-red-500/30 bg-red-900/10";
      default:
        return "border-[#8b4513]/30 bg-[#1a1005]";
    }
  };

  const filteredEvents = events.filter((event) => {
    if (filter === "all") return true;
    return event.type === filter;
  });

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
            <Clock className="text-[#f2d08a]" size={20} />
            <h2 className="font-bold text-[#f2d08a]">Activity Timeline</h2>
            <span className="px-2 py-0.5 rounded text-[10px] bg-[#f2d08a]/10 text-[#f2d08a] border border-[#f2d08a]/20">
              {filteredEvents.length} Events
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 text-xs rounded ${filter === "all" ? "bg-[#f2d08a]/20 text-[#f2d08a]" : "bg-[#1a1005] text-[#f2d08a]/40 hover:text-[#f2d08a]"}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("message")}
            className={`px-3 py-1 text-xs rounded ${filter === "message" ? "bg-blue-500/20 text-blue-400" : "bg-[#1a1005] text-[#f2d08a]/40 hover:text-blue-400"}`}
          >
            Messages
          </button>
          <button
            onClick={() => setFilter("action")}
            className={`px-3 py-1 text-xs rounded ${filter === "action" ? "bg-yellow-500/20 text-yellow-400" : "bg-[#1a1005] text-[#f2d08a]/40 hover:text-yellow-400"}`}
          >
            Actions
          </button>
          <button
            onClick={() => setFilter("error")}
            className={`px-3 py-1 text-xs rounded ${filter === "error" ? "bg-red-500/20 text-red-400" : "bg-[#1a1005] text-[#f2d08a]/40 hover:text-red-400"}`}
          >
            Errors
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#f2d08a]/40">
            <Clock size={48} className="mb-4" />
            <p>No activity yet</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[#8b4513]/30" />

            {/* Events */}
            <div className="space-y-4">
              {filteredEvents.map((event) => (
                <div key={event.id} className="relative flex gap-4">
                  {/* Icon */}
                  <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-[#0b0a15] border-2 border-[#8b4513]/30 flex items-center justify-center">
                    {getEventIcon(event.type)}
                  </div>

                  {/* Content */}
                  <div
                    className={`flex-1 border rounded-lg p-4 ${getEventColor(event.type)}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-medium text-[#e8ebf4] text-sm">
                        {event.title}
                      </h3>
                      <span className="text-xs text-[#f2d08a]/40 whitespace-nowrap ml-3">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-[#e8ebf4]/60">
                      {event.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
