/**
 * chatMessageHelpers — conversation summary + agent-index tests.
 *
 * Phase 1.2 tenth carve. Pins the two helpers feeding "save as
 * project" name/description + the OFFER_CHOICES staleness gate.
 */

import { describe, it, expect } from "vitest";

import {
  findLatestAgentIndex,
  summariseConversation,
  type ChatMessageLike,
} from "../chatMessageHelpers";

describe("summariseConversation", () => {
  it("returns null/null when there's no user message yet", () => {
    const msgs: ChatMessageLike[] = [{ role: "agent", text: "Hi!" }];
    expect(summariseConversation(msgs)).toEqual({
      name: null,
      description: null,
    });
  });

  it("returns null/null on empty history", () => {
    expect(summariseConversation([])).toEqual({
      name: null,
      description: null,
    });
  });

  it("derives name + description from the first user message", () => {
    const msgs: ChatMessageLike[] = [
      { role: "user", text: "Tropical island RPG" },
      { role: "agent", text: "OK!" },
    ];
    expect(summariseConversation(msgs)).toEqual({
      name: "Tropical island RPG",
      description: "Tropical island RPG",
    });
  });

  it("trims whitespace before truncation", () => {
    const msgs: ChatMessageLike[] = [
      { role: "user", text: "   Hello   world   " },
    ];
    const out = summariseConversation(msgs);
    expect(out.name).toBe("Hello   world");
  });

  it("name caps at 60 chars, description caps at 200", () => {
    const long = "x".repeat(300);
    const msgs: ChatMessageLike[] = [{ role: "user", text: long }];
    const out = summariseConversation(msgs);
    expect(out.name!.length).toBe(60);
    expect(out.description!.length).toBe(200);
  });

  it("ignores agent messages that come before the first user message", () => {
    const msgs: ChatMessageLike[] = [
      { role: "agent", text: "Welcome!" },
      { role: "agent", text: "Tell me more" },
      { role: "user", text: "Snowy mountains" },
    ];
    expect(summariseConversation(msgs).name).toBe("Snowy mountains");
  });

  it("ignores system messages when scanning for first user", () => {
    const msgs: ChatMessageLike[] = [
      { role: "system", text: "[stream_start]" },
      { role: "user", text: "Top-down shooter" },
    ];
    expect(summariseConversation(msgs).name).toBe("Top-down shooter");
  });
});

describe("findLatestAgentIndex", () => {
  it("returns -1 when there are no agent messages", () => {
    const msgs: ChatMessageLike[] = [{ role: "user", text: "hi" }];
    expect(findLatestAgentIndex(msgs)).toBe(-1);
  });

  it("returns -1 on empty history", () => {
    expect(findLatestAgentIndex([])).toBe(-1);
  });

  it("returns the index of the last agent message", () => {
    const msgs: ChatMessageLike[] = [
      { role: "user", text: "hi" },
      { role: "agent", text: "first agent" },
      { role: "user", text: "more" },
      { role: "agent", text: "second agent" },
      { role: "user", text: "trailing user" },
    ];
    expect(findLatestAgentIndex(msgs)).toBe(3);
  });

  it("returns the last index when the most recent is an agent message", () => {
    const msgs: ChatMessageLike[] = [
      { role: "user", text: "hi" },
      { role: "agent", text: "reply" },
    ];
    expect(findLatestAgentIndex(msgs)).toBe(1);
  });

  it("ignores system messages — only matches role:agent", () => {
    const msgs: ChatMessageLike[] = [
      { role: "agent", text: "reply" },
      { role: "system", text: "[stream_end]" },
    ];
    expect(findLatestAgentIndex(msgs)).toBe(0);
  });
});
