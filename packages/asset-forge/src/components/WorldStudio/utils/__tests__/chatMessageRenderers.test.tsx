/**
 * chatMessageRenderers — visual component render tests.
 *
 * Phase 1.2 thirteenth carve. Pins the three React components
 * that render the conversation thread: AgentAvatar, ChatBubble,
 * and TypingIndicator. Tests are render-asserts on DOM output —
 * they catch class/structural regressions without coupling to
 * exact Tailwind class names.
 */

import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import {
  AgentAvatar,
  ChatBubble,
  TypingIndicator,
  type ChatBubbleMessage,
} from "../chatMessageRenderers";

describe("AgentAvatar", () => {
  it("renders a sparkle icon by default (not pulsing)", () => {
    const { container } = render(<AgentAvatar />);
    const sparkle = container.querySelector("svg");
    expect(sparkle).not.toBeNull();
    expect(sparkle?.classList.toString()).not.toContain("animate-pulse");
  });

  it("adds animate-pulse when pulsing=true", () => {
    const { container } = render(<AgentAvatar pulsing />);
    const sparkle = container.querySelector("svg");
    expect(sparkle?.classList.toString()).toContain("animate-pulse");
  });
});

describe("ChatBubble — user message", () => {
  it("right-aligns user messages", () => {
    const msg: ChatBubbleMessage = { role: "user", text: "Hello!" };
    const { container } = render(<ChatBubble message={msg} />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("justify-end");
  });

  it("does NOT include an avatar on user messages", () => {
    const msg: ChatBubbleMessage = { role: "user", text: "Hello!" };
    const { container } = render(<ChatBubble message={msg} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders the message text verbatim", () => {
    const msg: ChatBubbleMessage = {
      role: "user",
      text: "Multi\nline\ntext",
    };
    const { container } = render(<ChatBubble message={msg} />);
    expect(container.textContent).toBe("Multi\nline\ntext");
  });
});

describe("ChatBubble — agent message", () => {
  it("left-aligns agent messages", () => {
    const msg: ChatBubbleMessage = { role: "agent", text: "How can I help?" };
    const { container } = render(<ChatBubble message={msg} />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("justify-start");
  });

  it("includes an avatar on agent messages", () => {
    const msg: ChatBubbleMessage = { role: "agent", text: "How can I help?" };
    const { container } = render(<ChatBubble message={msg} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("treats 'system' role like agent (left-aligned)", () => {
    const msg: ChatBubbleMessage = { role: "system", text: "[stream_start]" };
    const { container } = render(<ChatBubble message={msg} />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("justify-start");
  });
});

describe("TypingIndicator", () => {
  it("renders an avatar with pulsing animation", () => {
    const { container } = render(<TypingIndicator status={null} />);
    const sparkle = container.querySelector("svg");
    expect(sparkle?.classList.toString()).toContain("animate-pulse");
  });

  it("renders three animated bounce dots", () => {
    const { container } = render(<TypingIndicator status={null} />);
    const bouncers = container.querySelectorAll(".animate-bounce");
    expect(bouncers).toHaveLength(3);
  });

  it("staggers the bounce dots with 0/150/300ms delays", () => {
    const { container } = render(<TypingIndicator status={null} />);
    const bouncers = Array.from(
      container.querySelectorAll<HTMLElement>(".animate-bounce"),
    );
    expect(bouncers[0].style.animationDelay).toBe("0ms");
    expect(bouncers[1].style.animationDelay).toBe("150ms");
    expect(bouncers[2].style.animationDelay).toBe("300ms");
  });

  it("does NOT render a status label when status=null", () => {
    const { container } = render(<TypingIndicator status={null} />);
    // The status text shouldn't be in the DOM at all
    expect(container.textContent ?? "").toBe("");
  });

  it("renders the status label when status is non-null", () => {
    const { container } = render(<TypingIndicator status="Drafting reply…" />);
    expect(container.textContent).toContain("Drafting reply…");
  });
});
