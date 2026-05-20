/**
 * Server-Sent Events (SSE) block parser.
 *
 * Phase 1.2 second carve from `DesignWithAIDialog.tsx`. The
 * dialog consumes a streaming `/design` endpoint that emits
 * SSE-formatted events; this helper turns one delimited block
 * into a structured `{ event, data }` pair the caller can
 * dispatch on.
 *
 * Format reference (one block):
 *
 *     event: stream_start
 *     data: {"turn":0}
 *
 * Multi-line `data:` lines concatenate; an event without `data:`
 * (e.g. comment heartbeat, blank line) returns `null` so the
 * caller can skip it.
 *
 * The function is pure — no React, no DOM, no fetch — so it's
 * useful anywhere SSE blocks need parsing (tests, other dialogs,
 * background workers).
 */

export interface ParsedSSEEvent {
  /**
   * The `event: NAME` value or `"message"` when omitted (matches
   * the EventSource default-event-name convention).
   */
  readonly event: string;
  /** The parsed `data:` payload — JSON.parse'd from the joined data lines. */
  readonly data: unknown;
}

/**
 * Parse one SSE event block (`event: ...\ndata: ...`) into a
 * structured event. Returns null if the block isn't a
 * recognisable event (comment, blank, malformed JSON, no data).
 */
export function parseSSEBlock(block: string): ParsedSSEEvent | null {
  const lines = block.split("\n");
  let eventName = "message";
  let dataStr = "";
  for (const line of lines) {
    if (line.startsWith("event: ")) eventName = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataStr += line.slice(6);
  }
  if (!dataStr) return null;
  try {
    return { event: eventName, data: JSON.parse(dataStr) };
  } catch {
    return null;
  }
}
