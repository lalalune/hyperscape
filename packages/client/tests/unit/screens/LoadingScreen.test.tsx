/// <reference types="@testing-library/jest-dom" />

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { LoadingScreen } from "../../../src/screens/LoadingScreen";
import { EventType } from "@hyperforge/shared";
import type { World } from "@hyperforge/shared";

const theme = {
  colors: {
    accent: {
      primary: "#f4b942",
      secondary: "#f97316",
    },
    background: {
      panelSecondary: "#111111",
      overlay: "#222222",
    },
    border: {
      decorative: "#444444",
    },
    text: {
      primary: "#ffffff",
      secondary: "#c0c0c0",
      muted: "#808080",
    },
    state: {
      danger: "#dc2626",
    },
  },
};

vi.mock("@/ui", () => ({
  useThemeStore: (selector: (state: { theme: typeof theme }) => unknown) =>
    selector({ theme }),
}));

function createMockWorld(): World {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();

  return {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: (payload: unknown) => void) => {
      handlers.get(event)?.delete(handler);
    }),
  } as unknown as World;
}

describe("LoadingScreen", () => {
  it("uses the custom completion stage instead of staying on Finalizing", () => {
    const world = createMockWorld();

    render(
      <LoadingScreen
        world={world}
        message="Loading stream..."
        completionStage="Ready to stream..."
      />,
    );

    const progressHandler = (
      world.on as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([event]) => event === EventType.ASSETS_LOADING_PROGRESS,
    )?.[1] as ((payload: unknown) => void) | undefined;

    expect(progressHandler).toBeDefined();

    act(() => {
      progressHandler?.({ stage: "Booting", progress: 100, total: 1 });
      progressHandler?.({ progress: 100, total: 1 });
    });

    expect(screen.getByText("Ready to stream...")).toBeInTheDocument();
    expect(screen.queryByText("Finalizing...")).not.toBeInTheDocument();
  });
});
