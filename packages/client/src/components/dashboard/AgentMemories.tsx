import React, { useState, useEffect } from "react";
import { Brain, Plus, Search, Trash2, Edit2 } from "lucide-react";
import { Agent } from "../../screens/DashboardScreen";
import { ELIZAOS_API } from "@/lib/api-config";

interface Memory {
  id: string;
  userId: string;
  agentId: string;
  roomId: string;
  content: {
    text: string;
    [key: string]: unknown;
  };
  embedding?: number[];
  createdAt: number;
}

interface AgentMemoriesProps {
  agent: Agent;
}

export const AgentMemories: React.FC<AgentMemoriesProps> = ({ agent }) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchMemories();
  }, [agent.id]);

  const fetchMemories = async () => {
    try {
      // Fetch memories from ElizaOS API
      // Note: We need a default roomId - using agent's ID as room for now
      const response = await fetch(
        `${ELIZAOS_API}/agents/${agent.id}/rooms/${agent.id}/memories?limit=100&tableName=messages`,
      );

      if (!response.ok) {
        console.warn("[AgentMemories] Failed to fetch memories");
        setMemories([]);
        return;
      }

      const data = await response.json();
      console.log("[AgentMemories] Fetched memories:", data);

      // Extract memories array from response
      const memoriesArray = Array.isArray(data)
        ? data
        : data?.data?.memories || data?.data || data?.memories || [];

      setMemories(memoriesArray);
    } catch (error) {
      console.error("[AgentMemories] Error fetching memories:", error);
      setMemories([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMemories = memories.filter((memory) =>
    memory.content.text.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
            <Brain className="text-[#f2d08a]" size={20} />
            <h2 className="font-bold text-[#f2d08a]">Agent Memories</h2>
            <span className="px-2 py-0.5 rounded text-[10px] bg-[#f2d08a]/10 text-[#f2d08a] border border-[#f2d08a]/20">
              {filteredMemories.length} Memories
            </span>
          </div>
          <button className="p-2 hover:bg-[#f2d08a]/10 rounded-lg text-[#f2d08a] transition-colors">
            <Plus size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f2d08a]/40"
            size={16}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg pl-10 pr-4 py-2 text-[#e8ebf4] placeholder-[#f2d08a]/30 focus:border-[#f2d08a] outline-none transition-colors text-sm"
          />
        </div>
      </div>

      {/* Memories List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#f2d08a]/40">
            <Brain size={48} className="mb-4" />
            <p className="text-center">
              {searchQuery
                ? "No memories match your search"
                : "No memories yet. The agent will build memories through conversations."}
            </p>
          </div>
        ) : (
          filteredMemories.map((memory) => (
            <div
              key={memory.id}
              className="bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-4 hover:border-[#f2d08a]/30 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-[#e8ebf4] text-sm leading-relaxed">
                    {memory.content.text}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                  <button className="p-1.5 hover:bg-[#f2d08a]/10 rounded text-[#f2d08a]/60 hover:text-[#f2d08a] transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button className="p-1.5 hover:bg-red-500/10 rounded text-red-400/60 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#f2d08a]/40">
                <span>{new Date(memory.createdAt).toLocaleString()}</span>
                <span>•</span>
                <span>Room: {memory.roomId.substring(0, 8)}...</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
