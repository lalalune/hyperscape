import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Bot,
  User,
  MoreVertical,
  Paperclip,
  Mic,
} from "lucide-react";
import { Agent } from "../../screens/DashboardScreen";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: Date;
}

interface AgentChatProps {
  agent: Agent;
}

export const AgentChat: React.FC<AgentChatProps> = ({ agent }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const userId = localStorage.getItem("privy_user_id") || "anonymous-user";

      const response = await fetch(
        `http://localhost:5555/api/agents/${agent.id}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: userMessage.text,
            userId: userId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      // ElizaOS returns an array of messages
      const responses = Array.isArray(data) ? data : [data];

      responses.forEach((resp: { text?: string; content?: string }, index: number) => {
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

  return (
    <div className="flex flex-col h-full bg-[#0b0a15]/50 backdrop-blur-sm">
      {/* Chat Header */}
      <div className="p-4 border-b border-[#8b4513]/30 flex justify-between items-center bg-[#0b0a15]/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1a1005] border border-[#f2d08a]/30 flex items-center justify-center text-xl">
            🤖
          </div>
          <div>
            <h2 className="font-bold text-[#f2d08a] text-lg">
              {agent.characterName || agent.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[#f2d08a]/60">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Online
            </div>
          </div>
        </div>
        <button className="p-2 hover:bg-[#f2d08a]/10 rounded-full text-[#f2d08a]/60 hover:text-[#f2d08a] transition-colors">
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[#f2d08a]/40 space-y-4">
            <Bot size={48} />
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 ${
              msg.sender === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.sender === "user"
                  ? "bg-[#f2d08a]/20 text-[#f2d08a]"
                  : "bg-[#1a1005] border border-[#f2d08a]/30 text-white"
              }`}
            >
              {msg.sender === "user" ? <User size={16} /> : <Bot size={16} />}
            </div>

            <div
              className={`flex flex-col max-w-[70%] ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-[#f2d08a]/80">
                  {msg.sender === "user"
                    ? "You"
                    : agent.characterName || agent.name}
                </span>
                <span className="text-[10px] text-[#f2d08a]/40">
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div
                className={`p-3 rounded-lg text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-[#f2d08a]/10 text-[#e8ebf4] border border-[#f2d08a]/20 rounded-tr-none"
                    : "bg-[#1a1005] text-[#e8ebf4] border border-[#8b4513]/30 rounded-tl-none shadow-lg"
                }`}
              >
                {msg.text}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-[#1a1005] border border-[#f2d08a]/30 flex items-center justify-center text-white flex-shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-[#1a1005] border border-[#8b4513]/30 p-3 rounded-lg rounded-tl-none flex items-center gap-1">
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#0b0a15]/80 border-t border-[#8b4513]/30">
        <div className="relative flex items-end gap-2 bg-[#1a1005] border border-[#8b4513]/50 rounded-xl p-2 focus-within:border-[#f2d08a]/50 transition-colors">
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
  );
};
