/**
 * Async-iterable SSE event stream parser.
 *
 * Both `DesignWithAIDialog` (onboarding) and `WorldStudioCompanion`
 * (in-studio chat) consume the same `/design/stream` endpoint with
 * structurally-identical chunk loops:
 *
 *   1. `res.body.getReader()` + `TextDecoder` over Uint8Array chunks
 *   2. Accumulate into a string buffer
 *   3. Split on `\n\n` delimiter — each block is one SSE event
 *   4. Parse each block with `parseSSEBlock` (already extracted)
 *   5. Dispatch to per-event handlers
 *
 * Steps 1–4 are pure plumbing — yielded as an async generator so
 * callers express their per-event dispatch as a plain
 * `for await (const evt of parseSSEStream(res.body)) { ... }`
 * loop. The dispatch (which events the caller cares about, what
 * state setters fire) stays at the call site.
 *
 * Pattern matches Node's standard `events.on()` / web SSE — the
 * generator owns the byte loop, the caller owns the semantics.
 */

import { parseSSEBlock, type ParsedSSEEvent } from "./parseSSEBlock";

/**
 * Consume an SSE-formatted ReadableStream and yield each parsed
 * event in turn. Malformed blocks (failed JSON parse, missing
 * `data:`) are silently dropped — same behavior as
 * `parseSSEBlock` itself.
 *
 * The generator completes when the underlying reader hits EOF.
 * Abort handling is the caller's concern (pass an AbortSignal
 * to `fetch()` — the reader will throw when the request is
 * aborted, which propagates out of this generator).
 */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ParsedSSEEvent, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sepIdx: number;
    while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      const parsed = parseSSEBlock(block);
      if (parsed) yield parsed;
    }
  }
}
