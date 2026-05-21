/**
 * Chat-message visual components.
 *
 * Phase 1.2 thirteenth carve from DesignWithAIDialog. Three
 * tightly-coupled React components that render the conversation
 * thread:
 *
 *   - `AgentAvatar` — the small ring + sparkle dot rendered next
 *     to every agent message (optionally pulsing during "agent
 *     is thinking").
 *   - `ChatBubble` — one message row (user-right-aligned, agent-
 *     left-aligned-with-avatar).
 *   - `TypingIndicator` — three-dot bouncing animation +
 *     optional status string; replaces a bare "Thinking…" line.
 *
 * `ChatBubble` reads only `role` + `text` from its message, so
 * the structural `ChatBubbleMessage` type lets it accept any
 * wider ChatMessage shape unchanged.
 */

import { Sparkles } from "lucide-react";
import React from "react";

/** Minimal subset of ChatMessage that ChatBubble renders. */
export interface ChatBubbleMessage {
  readonly role: "user" | "agent" | "system";
  readonly text: string;
}

/**
 * Small avatar rendered next to every agent message. Pass
 * `pulsing` to animate the sparkle when the agent is mid-turn.
 */
export function AgentAvatar({
  pulsing = false,
}: {
  pulsing?: boolean;
}): React.ReactElement {
  return (
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center mt-0.5 ring-1 ring-primary/30 ">
      <Sparkles size={12} className={`text-primary ${pulsing ? "" : ""}`} />
    </div>
  );
}

/**
 * One conversation row. User messages are right-aligned with
 * primary-tinted bubbles; agent messages are left-aligned with
 * an AgentAvatar.
 */
export function ChatBubble({
  message,
}: {
  message: ChatBubbleMessage;
}): React.ReactElement {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end pl-10">
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-md bg-gradient-to-br from-primary/25 to-primary/15 text-text-primary text-[13px] leading-relaxed whitespace-pre-wrap border border-primary/25 ">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start gap-2.5 pr-10">
      <AgentAvatar />
      <div className="max-w-[85%] px-5 py-4.5 rounded-2xl rounded-tl-md bg-bg-secondary text-text-primary text-[13px] leading-relaxed whitespace-pre-wrap border border-border-primary shadow-sm">
        {message.text}
      </div>
    </div>
  );
}

/**
 * Three-dot bouncing typing indicator — drop-in replacement for
 * the bare "Thinking…" line. Optionally shows a status string
 * below the dots (e.g. "Drafting the HUD…").
 */
export function TypingIndicator({
  status,
}: {
  status: string | null;
}): React.ReactElement {
  return (
    <div className="flex justify-start gap-2.5 pr-10">
      <AgentAvatar pulsing />
      <div className="px-5 py-4 rounded-2xl rounded-tl-md bg-bg-secondary border border-border-primary shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary/70 "
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary/70 "
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary/70 "
              style={{ animationDelay: "300ms" }}
            />
          </span>
          {status && (
            <span className="text-[11px] text-text-tertiary leading-none">
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
