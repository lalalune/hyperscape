import React, { useState, useEffect, useRef } from "react";
import { Agent } from "../../screens/DashboardScreen";
import { Send, Bot, User, Paperclip, Mic } from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: Date;
}

interface AgentViewportChatProps {
  agent: Agent;
}

export const AgentViewportChat: React.FC<AgentViewportChatProps> = ({
  agent,
}) => {
  const [authToken, setAuthToken] = useState<string>("");
  const [characterId, setCharacterId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAgentCredentials();
  }, [agent.id]);

  const fetchAgentCredentials = async () => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/agents/${agent.id}`,
      );

      if (response.ok) {
        const data = await response.json();
        const agentData =
          data?.data?.agent || data?.data || data?.agent || data;
        const settings =
          agentData?.settings?.secrets || agentData?.settings || {};

        const token = settings.HYPERSCAPE_AUTH_TOKEN || "";
        const charId = settings.HYPERSCAPE_CHARACTER_ID || "";

        setAuthToken(token);
        setCharacterId(charId);

        console.log("[AgentViewportChat] Loaded credentials:", {
          hasToken: !!token,
          characterId: charId,
          agentName: agentData?.name,
        });
      } else {
        console.warn("[AgentViewportChat] Failed to fetch agent details");
      }
    } catch (error) {
      console.error("[AgentViewportChat] Error fetching credentials:", error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    try {
      const messageId = crypto.randomUUID();
      const userId = localStorage.getItem("privy_user_id") || "anonymous-user";
      const channelId = `dashboard-chat-${agent.id}`;

      const response = await fetch(
        `http://localhost:3000/api/agents/${agent.id}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: userMessage.text,
            channelId: channelId,
            messageId: messageId,
            userId: userId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const responses = Array.isArray(data) ? data : [data];

      responses.forEach((resp: any, index: number) => {
        const agentMessage: Message = {
          id: (Date.now() + index).toString(),
          sender: "agent",
          text: resp.text || resp.content || "No response",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, agentMessage]);
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        sender: "agent",
        text: "⚠️ Failed to send message to agent. Is ElizaOS running?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0b0a15]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f2d08a]"></div>
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
    wsUrl: "ws://localhost:5555/ws",
    hiddenUI: "chat,inventory,minimap,hotbar,stats",
  });

  return (
    <div className="flex flex-col h-full bg-black relative">
      {/* 3D Game Viewport (Background) */}
      <iframe
        className="absolute inset-0 w-full h-full border-none bg-[#0b0a15]"
        src={`/?${iframeParams.toString()}`}
        allow="autoplay; fullscreen; microphone; camera"
        title={`Viewport: ${agent.characterName || agent.name}`}
      />

      {/* Overlay Info (Top Left) */}
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

      {/* Agent Response Overlay (Top Right) - Transparent, Compact */}
      {messages.length > 0 && (
        <div className="absolute top-4 right-4 z-10 max-w-md pointer-events-none">
          <div className="space-y-2">
            {/* Show only last 3 messages */}
            {messages
              .slice(-3)
              .filter((msg) => msg.sender === "agent")
              .map((msg) => (
                <div
                  key={msg.id}
                  className="bg-black/40 backdrop-blur-md border border-[#f2d08a]/20 rounded-lg p-3 text-sm text-[#e8ebf4] shadow-lg animate-in fade-in slide-in-from-right-5 duration-300"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Bot size={14} className="text-[#f2d08a]" />
                    <span className="text-xs font-bold text-[#f2d08a]/80">
                      {agent.characterName || agent.name}
                    </span>
                    <span className="text-[10px] text-[#f2d08a]/40 ml-auto">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-[#e8ebf4]/90 leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              ))}

            {isTyping && (
              <div className="bg-black/40 backdrop-blur-md border border-[#f2d08a]/20 rounded-lg p-3 flex items-center gap-2">
                <Bot size={14} className="text-[#f2d08a]" />
                <div className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 bg-[#f2d08a]/60 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-[#f2d08a]/60 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-[#f2d08a]/60 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message Input (Bottom) - Fixed position, pointer events enabled */}
      <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-auto">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 bg-black/60 backdrop-blur-md border border-[#8b4513]/50 rounded-xl p-2 focus-within:border-[#f2d08a]/50 transition-colors shadow-2xl">
            <button className="p-2 text-[#f2d08a]/40 hover:text-[#f2d08a] transition-colors rounded-lg hover:bg-[#f2d08a]/5">
              <Paperclip size={20} />
            </button>

            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message here..."
              className="flex-1 bg-transparent border-none outline-none text-[#e8ebf4] placeholder-[#f2d08a]/30 resize-none py-2 max-h-32 min-h-[24px]"
              rows={1}
              style={{ height: "auto" }}
            />

            {inputValue.trim() ? (
              <button
                onClick={handleSendMessage}
                className="p-2 bg-[#f2d08a] text-[#0b0a15] rounded-lg hover:bg-[#e5c07b] transition-colors shadow-lg shadow-[#f2d08a]/20"
              >
                <Send size={18} />
              </button>
            ) : (
              <button className="p-2 text-[#f2d08a]/40 hover:text-[#f2d08a] transition-colors rounded-lg hover:bg-[#f2d08a]/5">
                <Mic size={20} />
              </button>
            )}
          </div>
          <div className="text-center mt-2 text-[10px] text-[#f2d08a]/30">
            AI can make mistakes. Check important info.
          </div>
        </div>
      </div>
    </div>
  );
};
