/**
 * Chat-message helpers — conversation summary + index lookup.
 *
 * Phase 1.2 tenth carve from DesignWithAIDialog. Two small pure
 * helpers that the dialog uses for save-as-project + choice-chip
 * gating:
 *
 *   - `summariseConversation` derives a name + description from
 *     the first user message (used when persisting an in-progress
 *     conversation as a project).
 *   - `findLatestAgentIndex` finds the most recent agent message
 *     in a thread — only that turn's OFFER_CHOICES chips are
 *     clickable; older offers are stale.
 *
 * Helpers are generic over the message shape — they read only
 * `role` and `text`, so the structural `ChatMessageLike` lets
 * callers pass any wider ChatMessage type unchanged.
 */

/**
 * Minimal structural subset of ChatMessage that the helpers
 * read. Dialog's full `ChatMessage` (with `plan`, `choices`,
 * `toolBreadcrumbs`, etc.) satisfies this implicitly.
 */
export interface ChatMessageLike {
  readonly role: "user" | "agent" | "system";
  readonly text: string;
}

/**
 * Derive a name + description from the first user message in a
 * conversation. Used when the user saves a chat as a project —
 * the first user message is the prompt that started the world.
 *
 * Returns `{ name: null, description: null }` when there's no
 * user message yet (agent-only history, edge case).
 */
export function summariseConversation(
  messages: ReadonlyArray<ChatMessageLike>,
): { name: string | null; description: string | null } {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return { name: null, description: null };
  const summary = firstUser.text.trim().slice(0, 200);
  const name = summary.slice(0, 60);
  return { name, description: summary };
}

/**
 * Index of the most recent `role === "agent"` message. Only that
 * message's choice chips are clickable — older offers are stale.
 * Returns -1 when there's no agent message yet.
 */
export function findLatestAgentIndex(
  messages: ReadonlyArray<ChatMessageLike>,
): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "agent") return i;
  }
  return -1;
}
