import React, { useState, useEffect, useRef } from "react";
import { Agent } from "../../screens/DashboardScreen";
import { Send, Bot, User, Paperclip, Mic } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

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
  const [characterId, setCharacterId] = useState<string>("");
  const [authToken, setAuthToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [waitingForEntity, setWaitingForEntity] = useState(false);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  // Use Privy hook to get fresh access token (not stale localStorage token)
  const { getAccessToken, user } = usePrivy();

  useEffect(() => {
    isMountedRef.current = true;
    fetchSpectatorData();
    return () => {
      isMountedRef.current = false;
    };
  }, [agent.id]);

  const fetchSpectatorData = async () => {
    const MAX_ATTEMPTS = 15; // Wait up to 15 seconds for entity to appear

    try {
      // Get FRESH Privy token using the SDK (not stale localStorage)
      // This ensures we always have a valid, non-expired token
      const privyToken = await getAccessToken();

      if (!privyToken) {
        console.warn(
          "[AgentViewportChat] No Privy token available - spectator mode requires authentication",
        );
        setLoading(false);
        return;
      }

      // Poll for entity existence - agent may still be connecting to game world
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (!isMountedRef.current) return; // Component unmounted

        // Exchange Privy token for permanent spectator JWT
        const tokenResponse = await fetch(
          `http://localhost:5555/api/spectator/token`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              agentId: agent.id,
              privyToken: privyToken,
            }),
          },
        );

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();

          // Check if entity exists in the game world
          if (tokenData.entityExists) {
            setAuthToken(tokenData.spectatorToken);
            setCharacterId(tokenData.characterId || "");
            setWaitingForEntity(false);
            setLoading(false);
            console.log(
              "[AgentViewportChat] ✅ Got permanent spectator token for:",
              tokenData.agentName,
            );
            return;
          }

          // Entity not ready yet - show waiting state and poll
          if (attempt === 1) {
            setWaitingForEntity(true);
            // Store token for when entity is ready
            setAuthToken(tokenData.spectatorToken);
            setCharacterId(tokenData.characterId || "");
          }

          console.log(
            `[AgentViewportChat] Waiting for agent entity (${attempt}/${MAX_ATTEMPTS})...`,
          );

          // Wait 1 second before next attempt
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        } else if (tokenResponse.status === 401) {
          // Privy token expired - user needs to re-authenticate
          console.warn(
            "[AgentViewportChat] Privy token expired, need to re-login",
          );
          localStorage.removeItem("privy_auth_token");
          setLoading(false);
          return;
        } else if (tokenResponse.status === 403) {
          console.warn("[AgentViewportChat] No permission to view this agent");
          setLoading(false);
          return;
        } else if (tokenResponse.status === 404) {
          console.warn("[AgentViewportChat] Agent not found");
          setLoading(false);
          return;
        } else {
          // Fallback: try to get character ID from mapping endpoint
          console.warn(
            "[AgentViewportChat] Spectator token endpoint failed, falling back to mapping",
          );
          const mappingResponse = await fetch(
            `http://localhost:5555/api/agents/mapping/${agent.id}`,
          );
          if (mappingResponse.ok) {
            const mappingData = await mappingResponse.json();
            setCharacterId(mappingData.characterId || "");
            setAuthToken(privyToken);
            console.warn(
              "[AgentViewportChat] Using Privy token as fallback - may expire in ~1 hour",
            );
          }
          setLoading(false);
          return;
        }
      }

      // Max attempts reached - entity never appeared
      console.warn(
        `[AgentViewportChat] Agent entity not found after ${MAX_ATTEMPTS} seconds`,
      );
      setEntityError(
        "Agent is taking too long to connect to the game world. Please try stopping and restarting the agent.",
      );
      setWaitingForEntity(false);
      setLoading(false);
    } catch (error) {
      console.error(
        "[AgentViewportChat] Error fetching spectator data:",
        error,
      );
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

    // SECURITY: Require authentication for sending messages
    if (!authToken) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        sender: "agent",
        text: "⚠️ Please log in to send messages to the agent.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

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
      // SECURITY: Include auth token in Authorization header
      const response = await fetch(
        `http://localhost:5555/api/agents/${agent.id}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            content: userMessage.text,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
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

  if (loading || waitingForEntity) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0b0a15]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f2d08a]"></div>
        {waitingForEntity && (
          <p className="text-[#f2d08a]/60 mt-4 text-sm">
            Connecting agent to game world...
          </p>
        )}
      </div>
    );
  }

  // Show error if entity failed to appear
  if (entityError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0b0a15] text-[#f2d08a]/60">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-[#f2d08a] mb-2">
          Connection Issue
        </h2>
        <p className="text-center max-w-md">{entityError}</p>
      </div>
    );
  }

  // Only load game world when agent is active
  if (agent.status !== "active") {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0b0a15] text-[#f2d08a]/60">
        <div className="text-6xl mb-4">⏸️</div>
        <h2 className="text-xl font-bold text-[#f2d08a] mb-2">
          Agent is {agent.status}
        </h2>
        <p className="text-center max-w-md">
          Start the agent to view the live game world and interact with it.
        </p>
      </div>
    );
  }

  if (!characterId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0b0a15] text-[#f2d08a]/60">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-[#f2d08a] mb-2">
          Character Not Found
        </h2>
        <p className="text-center max-w-md">
          Could not find character for this agent. Make sure the agent is
          properly configured.
        </p>
      </div>
    );
  }

  if (!authToken) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0b0a15] text-[#f2d08a]/60">
        <div className="text-6xl mb-4">🔐</div>
        <h2 className="text-xl font-bold text-[#f2d08a] mb-2">
          Authentication Required
        </h2>
        <p className="text-center max-w-md">
          Please log in to view and interact with the agent.
        </p>
      </div>
    );
  }

  // Build iframe URL for spectator mode
  // SECURITY: Server verifies authToken and checks character ownership
  const privyUserId = user?.id || "";

  const iframeParams = new URLSearchParams({
    embedded: "true",
    mode: "spectator",
    agentId: agent.id,
    authToken: authToken, // Server verifies this JWT
    characterId: characterId,
    followEntity: characterId, // Camera will follow this entity
    privyUserId: privyUserId,
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
