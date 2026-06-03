import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { EmbeddedAgentControlScreen } from "../../../src/screens/EmbeddedAgentControlScreen";

vi.mock("../../../src/game/EmbeddedGameClient", () => ({
  EmbeddedGameClient: () => (
    <div data-testid="embedded-game-client">embedded viewport</div>
  ),
}));

vi.mock("../../../src/game/dashboard/AgentThoughtsOverlay", () => ({
  AgentThoughtsOverlay: () => (
    <div data-testid="agent-thoughts-overlay">thoughts</div>
  ),
}));

describe("EmbeddedAgentControlScreen", () => {
  const originalFetch = global.fetch;
  const originalPostMessage = window.postMessage;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    window.__HYPERIA_CONFIG__ = {
      agentId: "agent-1",
      authToken: "session-token",
      characterId: "char-1",
      wsUrl: "ws://localhost:5556/ws",
      mode: "spectator",
      surface: "agent-control",
      sessionToken: "",
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.postMessage = originalPostMessage;
    vi.restoreAllMocks();
  });

  it("loads the agent console and sends authenticated commands", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/api/agents/agent-1") && !init) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                agent: {
                  id: "agent-1",
                  name: "Chen",
                  status: "active",
                  character: {
                    name: "Chen",
                    settings: {
                      accountId: "did:privy:test",
                      characterId: "char-1",
                    },
                  },
                },
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (url.endsWith("/api/agents/agent-1/message")) {
          expect(init?.method).toBe("POST");
          expect(init?.headers).toMatchObject({
            "Content-Type": "application/json",
            Authorization: "Bearer session-token",
          });
          expect(init?.body).toBe(JSON.stringify({ content: "go fish" }));

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        throw new Error(`Unexpected fetch: ${url}`);
      },
    );

    global.fetch = fetchMock as unknown as typeof fetch;
    window.postMessage = vi.fn();

    render(<EmbeddedAgentControlScreen />);

    expect(
      await screen.findByTestId("embedded-agent-control-screen"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("embedded-game-client")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Chen")).toBeInTheDocument();
      expect(screen.getByText("Live")).toBeInTheDocument();
    });

    const input = screen.getByTestId(
      "embedded-agent-command-input",
    ) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "go fish" } });
    fireEvent.click(screen.getByTestId("embedded-agent-command-send"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/agents/agent-1/message"),
        expect.any(Object),
      );
    });

    expect(screen.getByText("go fish")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Command delivered. Watch the viewport and live logs for the agent response.",
      ),
    ).toBeInTheDocument();
    expect(window.postMessage).toHaveBeenCalledWith(
      { type: "OPEN_CHAT" },
      window.location.origin,
    );
  });
});
