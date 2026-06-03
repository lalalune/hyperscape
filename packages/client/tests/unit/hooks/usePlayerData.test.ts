import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventType } from "@hyperforge/shared";
import { usePlayerDataState } from "../../../src/hooks/usePlayerData";
import {
  asClientWorld,
  createEventTracker,
  createMockWorld,
} from "../../mocks/MockWorld";

describe("usePlayerDataState", () => {
  it("preserves cached prayer state when the entity only has health data", async () => {
    const eventTracker = createEventTracker();
    const world = createMockWorld({
      on: eventTracker.on,
      off: eventTracker.off,
      entities: {
        player: {
          id: "player-1",
          health: 8,
          maxHealth: 10,
          data: {
            health: 8,
            maxHealth: 10,
          },
        } as never,
      },
    });
    world.network.lastPrayerStateByPlayerId = {
      "player-1": {
        points: 37,
        maxPoints: 50,
        active: ["thick_skin"],
      },
    };

    const { result } = renderHook(() =>
      usePlayerDataState(asClientWorld(world)),
    );

    await waitFor(() => {
      expect(result.current.playerStats?.health).toEqual({
        current: 8,
        max: 10,
      });
      expect(result.current.playerStats?.prayerPoints).toEqual({
        current: 37,
        max: 50,
      });
    });

    expect(world.emit).toHaveBeenCalledWith(EventType.INVENTORY_REQUEST, {
      playerId: "player-1",
    });
  });

  it("hydrates prayer state when the local player becomes available via PLAYER_SPAWNED", async () => {
    const eventTracker = createEventTracker();
    const world = createMockWorld({
      on: eventTracker.on,
      off: eventTracker.off,
      getPlayer: vi.fn(() => null),
      entities: {
        player: null,
      },
    });
    world.network.lastPrayerStateByPlayerId = {
      "spawned-player": {
        points: 12,
        maxPoints: 18,
        active: ["thick_skin"],
      },
    };

    const { result } = renderHook(() =>
      usePlayerDataState(asClientWorld(world)),
    );

    expect(result.current.playerStats).toBeNull();

    act(() => {
      world.entities.player = {
        id: "spawned-player",
        health: 9,
        maxHealth: 10,
        data: {
          health: 9,
          maxHealth: 10,
        },
      } as never;
      world.getPlayer.mockReturnValue({ id: "spawned-player" });
      eventTracker.trigger(EventType.PLAYER_SPAWNED, {
        playerId: "spawned-player",
      });
    });

    await waitFor(() => {
      expect(result.current.playerStats?.prayerPoints).toEqual({
        current: 12,
        max: 18,
      });
      expect(result.current.playerStats?.health).toEqual({
        current: 9,
        max: 10,
      });
    });
  });

  it("only seeds entity prayer points when both values are finite", async () => {
    const missingMaxEventTracker = createEventTracker();
    const missingMaxWorld = createMockWorld({
      on: missingMaxEventTracker.on,
      off: missingMaxEventTracker.off,
      entities: {
        player: {
          id: "player-2",
          health: 6,
          maxHealth: 10,
          data: {
            health: 6,
            maxHealth: 10,
            prayerPoints: 14,
          },
        } as never,
      },
    });

    const { result: missingMaxResult, unmount } = renderHook(() =>
      usePlayerDataState(asClientWorld(missingMaxWorld)),
    );

    await waitFor(() => {
      expect(missingMaxResult.current.playerStats?.health).toEqual({
        current: 6,
        max: 10,
      });
    });
    expect(missingMaxResult.current.playerStats?.prayerPoints).toBeUndefined();

    unmount();

    const finiteEventTracker = createEventTracker();
    const finiteWorld = createMockWorld({
      on: finiteEventTracker.on,
      off: finiteEventTracker.off,
      entities: {
        player: {
          id: "player-3",
          health: 7,
          maxHealth: 10,
          data: {
            health: 7,
            maxHealth: 10,
            prayerPoints: 14,
            maxPrayerPoints: 20,
          },
        } as never,
      },
    });

    const { result: finiteResult } = renderHook(() =>
      usePlayerDataState(asClientWorld(finiteWorld)),
    );

    await waitFor(() => {
      expect(finiteResult.current.playerStats?.prayerPoints).toEqual({
        current: 14,
        max: 20,
      });
    });
  });
});
