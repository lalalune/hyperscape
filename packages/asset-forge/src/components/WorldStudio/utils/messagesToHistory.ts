/**
 * messagesToHistory — translate the dialog/companion's
 * `ChatMessage[]` into the agent-server's request `history` shape.
 *
 * The local ChatMessage uses `role: "user" | "agent"`; the
 * agent server expects OpenAI-style `role: "user" | "assistant"`.
 * `"system"` messages (stream_start / stream_end ticker) are
 * filtered out — they're UI-side only and the server doesn't
 * expect them in history.
 *
 * Both dialog and companion `sendPrompt` had byte-identical
 * inline map calls; centralising here keeps the protocol shape
 * in one place.
 */

interface MessageLike {
  readonly role: "user" | "agent" | "system";
  readonly text: string;
}

export interface AgentHistoryMessage {
  readonly role: "user" | "assistant";
  readonly text: string;
}

/**
 * Map UI-side messages to agent-server `history` entries.
 * Filters out system messages (UI-only); maps `agent` → `assistant`.
 */
export function messagesToHistory(
  messages: ReadonlyArray<MessageLike>,
): AgentHistoryMessage[] {
  const out: AgentHistoryMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    out.push({
      role: m.role === "agent" ? "assistant" : "user",
      text: m.text,
    });
  }
  return out;
}
