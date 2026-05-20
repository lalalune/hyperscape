/**
 * messagesToHistory — UI message → agent history transform tests.
 *
 * Pins the role rename (`agent` → `assistant`) and the system-
 * message filtering rule.
 */

import { describe, it, expect } from "vitest";

import { messagesToHistory } from "../messagesToHistory";

describe("messagesToHistory", () => {
  it("returns an empty array on empty input", () => {
    expect(messagesToHistory([])).toEqual([]);
  });

  it("maps `agent` → `assistant`", () => {
    expect(messagesToHistory([{ role: "agent", text: "Hello!" }])).toEqual([
      { role: "assistant", text: "Hello!" },
    ]);
  });

  it("keeps `user` as `user`", () => {
    expect(messagesToHistory([{ role: "user", text: "Hi there." }])).toEqual([
      { role: "user", text: "Hi there." },
    ]);
  });

  it("filters out `system` messages (UI-only ticker entries)", () => {
    const out = messagesToHistory([
      { role: "system", text: "[stream_start]" },
      { role: "user", text: "build me an island" },
      { role: "system", text: "[stream_end]" },
      { role: "agent", text: "On it!" },
    ]);
    expect(out).toEqual([
      { role: "user", text: "build me an island" },
      { role: "assistant", text: "On it!" },
    ]);
  });

  it("preserves text verbatim, including multi-line content", () => {
    const out = messagesToHistory([
      { role: "user", text: "line 1\nline 2\nline 3" },
    ]);
    expect(out[0].text).toBe("line 1\nline 2\nline 3");
  });

  it("preserves message order across mixed roles", () => {
    const out = messagesToHistory([
      { role: "user", text: "u1" },
      { role: "agent", text: "a1" },
      { role: "user", text: "u2" },
      { role: "agent", text: "a2" },
    ]);
    expect(out.map((m) => m.text)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(out.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
  });
});
