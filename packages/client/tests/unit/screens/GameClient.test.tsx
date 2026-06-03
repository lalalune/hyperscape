/// <reference types="@testing-library/jest-dom" />

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveGameClientUiDisplay } from "../../../src/lib/gameClientUi";

const { mockWorld } = vi.hoisted(() => ({
  mockWorld: {
    systemsLoadedPromise: Promise.resolve(),
    on: vi.fn(),
    off: vi.fn(),
    getSystem: vi.fn(() => null),
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  },
}));

vi.mock("@hyperforge/shared", () => ({
  THREE: {
    Vector3: class MockVector3 {
      normalize() {
        return this;
      }
    },
  },
  createClientWorld: vi.fn(() => mockWorld),
  EventType: {
    UI_UPDATE: "ui:update",
  },
  System: class MockSystem {},
  World: class MockWorld {},
}));

vi.mock("../../../src/game/CoreUI", () => ({
  CoreUI: () => <div data-testid="core-ui">core ui</div>,
}));

vi.mock("../../../src/components/common/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("../../../src/lib/ThreeResourceManager", () => ({
  ThreeResourceManager: {
    teardown: vi.fn(),
  },
}));

vi.mock("../../../src/lib/api-config", () => ({
  GAME_WS_URL: "ws://game.example/ws",
  CDN_URL: "https://cdn.example/assets",
  normalizeBrowserLoopbackUrl: (value?: string) => value,
}));

import { GameClient } from "../../../src/screens/GameClient";

describe("GameClient", () => {
  beforeEach(() => {
    mockWorld.on.mockClear();
    mockWorld.off.mockClear();
    mockWorld.getSystem.mockClear();
    mockWorld.init.mockClear();
    mockWorld.destroy.mockClear();
    (window as Window & { env?: Record<string, string> }).env = {
      PUBLIC_WS_URL: "ws://runtime.example/ws",
      PUBLIC_CDN_URL: "https://runtime.example/assets",
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("hides the UI layer when visibility is false", () => {
    expect(resolveGameClientUiDisplay(true)).toBe("block");
    expect(resolveGameClientUiDisplay(false)).toBe("none");
  });

  it("does not reinitialize the world when hideUI or callback props change", async () => {
    const onSetupA = vi.fn();
    const onSetupB = vi.fn();
    const onInitErrorA = vi.fn();
    const onInitErrorB = vi.fn();

    const { rerender, unmount } = render(
      <GameClient
        hideUI={false}
        onSetup={onSetupA}
        onInitError={onInitErrorA}
      />,
    );

    await waitFor(() => {
      expect(mockWorld.init).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("core-ui")).toBeInTheDocument();

    rerender(
      <GameClient
        hideUI={true}
        onSetup={onSetupB}
        onInitError={onInitErrorB}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("core-ui")).not.toBeInTheDocument();
    });
    expect(mockWorld.init).toHaveBeenCalledTimes(1);
    expect(mockWorld.destroy).not.toHaveBeenCalled();
    expect(onSetupA).toHaveBeenCalledTimes(1);
    expect(onSetupB).not.toHaveBeenCalled();
    expect(onInitErrorA).toHaveBeenCalledWith(null);
    expect(onInitErrorB).not.toHaveBeenCalled();

    unmount();
    expect(mockWorld.destroy).toHaveBeenCalledTimes(1);
  });
});
