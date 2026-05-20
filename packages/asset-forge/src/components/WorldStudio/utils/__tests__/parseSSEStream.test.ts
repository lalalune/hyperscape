/**
 * parseSSEStream — async-iterable SSE chunk parser tests.
 *
 * Pins the byte-loop behavior the dialog + companion share:
 * reader-of-Uint8Array → buffered split on `\n\n` → parseSSEBlock
 * → yielded ParsedSSEEvent.
 */

import { describe, it, expect } from "vitest";

import { parseSSEStream } from "../parseSSEStream";
import type { ParsedSSEEvent } from "../parseSSEBlock";

/**
 * Build a ReadableStream<Uint8Array> from a sequence of string
 * chunks. Tests use this to simulate the network arriving in
 * pieces — sometimes a full SSE block per chunk, sometimes
 * split across chunks.
 */
function streamFrom(chunks: ReadonlyArray<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i]));
      i += 1;
    },
  });
}

async function collect(
  body: ReadableStream<Uint8Array>,
): Promise<ParsedSSEEvent[]> {
  const out: ParsedSSEEvent[] = [];
  for await (const evt of parseSSEStream(body)) out.push(evt);
  return out;
}

describe("parseSSEStream — single chunk", () => {
  it("yields one event when the stream contains one block", async () => {
    const block = `event: turn\ndata: {"turn":0}\n\n`;
    const evts = await collect(streamFrom([block]));
    expect(evts).toEqual([{ event: "turn", data: { turn: 0 } }]);
  });

  it("yields multiple events when one chunk has several blocks", async () => {
    const text =
      `event: turn\ndata: {"turn":0}\n\n` +
      `event: turn\ndata: {"turn":1}\n\n` +
      `event: done\ndata: {"ok":true}\n\n`;
    const evts = await collect(streamFrom([text]));
    expect(evts).toEqual([
      { event: "turn", data: { turn: 0 } },
      { event: "turn", data: { turn: 1 } },
      { event: "done", data: { ok: true } },
    ]);
  });
});

describe("parseSSEStream — chunked across reads", () => {
  it("buffers a block split across two chunks", async () => {
    const evts = await collect(
      streamFrom([`event: turn\ndata: {"tur`, `n":0}\n\n`]),
    );
    expect(evts).toEqual([{ event: "turn", data: { turn: 0 } }]);
  });

  it("buffers a block split mid-delimiter (only `\\n` on first chunk)", async () => {
    const evts = await collect(
      streamFrom([`event: turn\ndata: {"turn":0}\n`, `\n`]),
    );
    expect(evts).toEqual([{ event: "turn", data: { turn: 0 } }]);
  });

  it("handles a stream that ends mid-block (no trailing \\n\\n) by dropping the partial", async () => {
    // Partial last block — caller's `for await` loop just exits;
    // no extra event surfaces.
    const evts = await collect(
      streamFrom([
        `event: turn\ndata: {"turn":0}\n\nevent: done\ndata: {"ok":true}`,
      ]),
    );
    expect(evts).toEqual([{ event: "turn", data: { turn: 0 } }]);
  });
});

describe("parseSSEStream — malformed blocks", () => {
  it("silently drops blocks with malformed JSON in data:", async () => {
    const text =
      `event: turn\ndata: not-json{\n\n` + `event: done\ndata: {"ok":true}\n\n`;
    const evts = await collect(streamFrom([text]));
    expect(evts).toEqual([{ event: "done", data: { ok: true } }]);
  });

  it("silently drops blocks missing the data: line", async () => {
    const text = `event: heartbeat\n\n` + `event: turn\ndata: {"turn":0}\n\n`;
    const evts = await collect(streamFrom([text]));
    expect(evts).toEqual([{ event: "turn", data: { turn: 0 } }]);
  });

  it("handles an empty stream gracefully (no events, no throw)", async () => {
    expect(await collect(streamFrom([]))).toEqual([]);
  });
});

describe("parseSSEStream — defaults", () => {
  it("blocks without `event:` default to event name 'message'", async () => {
    const text = `data: {"hello":"world"}\n\n`;
    const evts = await collect(streamFrom([text]));
    expect(evts).toEqual([{ event: "message", data: { hello: "world" } }]);
  });
});
