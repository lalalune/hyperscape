/**
 * parseSSEBlock — SSE event-block parser tests.
 *
 * Phase 1.2 second carve from DesignWithAIDialog. Pins the
 * EventSource-compatible parsing semantics so future stream
 * consumers (other dialogs, workers, tests) can rely on the
 * same surface.
 */

import { describe, it, expect } from "vitest";

import { parseSSEBlock } from "../parseSSEBlock";

describe("parseSSEBlock — happy paths", () => {
  it("parses a single event with JSON data", () => {
    const block = `event: stream_start\ndata: {"turn":0}`;
    expect(parseSSEBlock(block)).toEqual({
      event: "stream_start",
      data: { turn: 0 },
    });
  });

  it("defaults to event name 'message' when omitted", () => {
    // EventSource convention — a block with only `data:` is a
    // "message" event by default.
    const block = `data: {"hello":"world"}`;
    expect(parseSSEBlock(block)).toEqual({
      event: "message",
      data: { hello: "world" },
    });
  });

  it("trims whitespace around the event name", () => {
    const block = `event:    propose_quest   \ndata: {"id":"q1"}`;
    const result = parseSSEBlock(block);
    expect(result?.event).toBe("propose_quest");
  });

  it("concatenates multi-line data: payloads (server-side wrapping)", () => {
    // SSE spec allows splitting a large data field across
    // multiple lines; this parser concatenates them.
    const block = `event: big\ndata: {"a":1,\ndata: "b":2}`;
    expect(parseSSEBlock(block)).toEqual({
      event: "big",
      data: { a: 1, b: 2 },
    });
  });

  it("handles arrays and primitives in data payload", () => {
    const block = `event: list\ndata: [1,2,3]`;
    expect(parseSSEBlock(block)).toEqual({ event: "list", data: [1, 2, 3] });
  });
});

describe("parseSSEBlock — null returns", () => {
  it("returns null for an empty block", () => {
    expect(parseSSEBlock("")).toBeNull();
  });

  it("returns null when only event: is present (no data)", () => {
    expect(parseSSEBlock("event: heartbeat")).toBeNull();
  });

  it("returns null when data: payload is invalid JSON", () => {
    expect(parseSSEBlock("event: bad\ndata: {not valid")).toBeNull();
  });

  it("returns null for SSE comment lines (start with :)", () => {
    // Comments don't include a `data:` line, so the parser
    // returns null. The caller is expected to skip them.
    expect(parseSSEBlock(": heartbeat keepalive")).toBeNull();
  });

  it("returns null for whitespace-only blocks", () => {
    expect(parseSSEBlock("\n\n   \n")).toBeNull();
  });
});

describe("parseSSEBlock — line robustness", () => {
  it("ignores unrecognized prefix lines", () => {
    // Lines that aren't `event: ` or `data: ` are silently
    // dropped — matches EventSource's permissive behavior.
    const block = `id: 42\nevent: known\nretry: 5000\ndata: {"ok":true}`;
    expect(parseSSEBlock(block)).toEqual({
      event: "known",
      data: { ok: true },
    });
  });

  it("handles a block ending without trailing newline", () => {
    const block = `event: x\ndata: 1`;
    expect(parseSSEBlock(block)).toEqual({ event: "x", data: 1 });
  });

  it("handles a single-line data: with leading-space-sensitive content", () => {
    // The parser uses `line.slice(6)` after `"data: "` so the
    // payload's leading-whitespace within the JSON is preserved.
    const block = `data: { "k" : "v" }`;
    expect(parseSSEBlock(block)).toEqual({
      event: "message",
      data: { k: "v" },
    });
  });
});
