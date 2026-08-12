import { afterEach, describe, expect, it, vi } from "vitest";

import { GATHERING_CONSTANTS } from "../../../../constants/GatheringConstants";
import { CollisionFlag } from "../../movement/CollisionFlags";
import { CollisionMatrix } from "../../movement/CollisionMatrix";
import { worldToTile } from "../../movement/TileSystem";
import { ResourceSystem } from "../ResourceSystem";

type FishingResource = {
  id: string;
  type: "fishing_spot";
  name: string;
  position: { x: number; y: number; z: number };
  skillRequired: "fishing";
  isAvailable: boolean;
  drops: [];
};

type FishingEntity = {
  position: {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): void;
  };
  data: { position: [number, number, number] };
  config: { position: { x: number; y: number; z: number } };
  markNetworkDirty: ReturnType<typeof vi.fn>;
};

function createFishingEcologyFixture() {
  const collision = new CollisionMatrix();
  for (let x = 1; x <= 30; x++) {
    for (let z = -15; z <= 15; z++) {
      collision.addFlags(x, z, CollisionFlag.WATER);
    }
  }

  const entities = new Map<string, FishingEntity>();
  const networkSend = vi.fn();
  const world = {
    isServer: true,
    currentTick: 0,
    collision,
    entities,
    network: { send: networkSend },
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getPlayer: vi.fn(),
    getSystem: vi.fn(() => null),
    $eventBus: {
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      subscribeOnce: vi.fn(() => ({ unsubscribe: vi.fn() })),
      emitEvent: vi.fn(),
      request: vi.fn(),
      respond: vi.fn(),
    },
  };
  const system = new ResourceSystem(world as never);
  const resources = new Map<string, FishingResource>();
  const timers = new Map<
    string,
    {
      moveAtTick: number;
      originalPosition: { x: number; y: number; z: number };
    }
  >();
  const terrain = {
    getHeightAt: (x: number, z: number) =>
      x >= 1 && x <= 30 && z >= -15 && z <= 15 ? 0 : 10,
    getWaterBodyRegistry: () => ({ getWaterSurfaceAt: () => 8 }),
  };
  const internals = system as unknown as {
    resources: typeof resources;
    fishingSpotMoveTimers: typeof timers;
    terrainSystem: typeof terrain;
    processFishingSpotMovement: (tick: number) => void;
  };
  internals.resources = resources;
  internals.fishingSpotMoveTimers = timers;
  internals.terrainSystem = terrain;

  const addSpot = (
    id: string,
    x: number,
    z: number,
    moveAtTick: number,
  ): void => {
    const position = { x, y: 8, z };
    resources.set(id, {
      id,
      type: "fishing_spot",
      name: id,
      position: { ...position },
      skillRequired: "fishing",
      isAvailable: true,
      drops: [],
    });
    entities.set(id, {
      position: {
        ...position,
        set(nextX: number, nextY: number, nextZ: number): void {
          this.x = nextX;
          this.y = nextY;
          this.z = nextZ;
        },
      },
      data: { position: [x, 8, z] },
      config: { position: { ...position } },
      markNetworkDirty: vi.fn(),
    });
    timers.set(id, { moveAtTick, originalPosition: { ...position } });
  };

  return {
    world,
    system,
    resources,
    entities,
    timers,
    networkSend,
    internals,
    addSpot,
  };
}

function expectUniqueSpotTiles(resources: Map<string, FishingResource>): void {
  const tiles = [...resources.values()].map(({ position }) =>
    worldToTile(position.x, position.z),
  );
  expect(new Set(tiles.map(({ x, z }) => `${x},${z}`)).size).toBe(tiles.length);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ResourceSystem long-run fishing ecology", () => {
  it("keeps three moving spots bounded, distinct, and fully synchronized for ten simulated hours", () => {
    const fixture = createFishingEcologyFixture();
    fixture.addSpot("fish-a", 1.75, -12.5, 200);
    fixture.addSpot("fish-b", 1.75, 0.5, 250);
    fixture.addSpot("fish-c", 29.25, 10.5, 300);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const moveCountBySpot = new Map<string, number>();
    let checkedPackets = 0;
    const tenHoursInTicks = 10 * 60 * 60 * (1000 / 600);
    for (let tick = 0; tick <= tenHoursInTicks; tick++) {
      fixture.world.currentTick = tick;
      fixture.internals.processFishingSpotMovement(tick);
      expectUniqueSpotTiles(fixture.resources);

      const moveCalls = fixture.networkSend.mock.calls.filter(
        ([packet]) => packet === "fishingSpotMoved",
      );
      while (checkedPackets < moveCalls.length) {
        const payload = moveCalls[checkedPackets][1] as {
          resourceId: string;
          oldPosition: { x: number; y: number; z: number };
          newPosition: { x: number; y: number; z: number };
        };
        checkedPackets++;
        const distance = Math.hypot(
          payload.newPosition.x - payload.oldPosition.x,
          payload.newPosition.z - payload.oldPosition.z,
        );
        expect(distance).toBeGreaterThanOrEqual(
          GATHERING_CONSTANTS.FISHING_SPOT_MOVE.relocateMinDistance,
        );
        expect(distance).toBeLessThanOrEqual(
          GATHERING_CONSTANTS.FISHING_SPOT_MOVE.relocateRadius,
        );
        moveCountBySpot.set(
          payload.resourceId,
          (moveCountBySpot.get(payload.resourceId) ?? 0) + 1,
        );

        const resource = fixture.resources.get(payload.resourceId)!;
        const entity = fixture.entities.get(payload.resourceId)!;
        expect(entity.position).toMatchObject(resource.position);
        expect(entity.data.position).toEqual([
          resource.position.x,
          resource.position.y,
          resource.position.z,
        ]);
        expect(entity.config.position).toEqual(resource.position);
        expect(entity.markNetworkDirty).toHaveBeenCalled();
      }
    }

    expect(checkedPackets).toBeGreaterThan(100);
    expect(moveCountBySpot).toEqual(
      new Map([
        ["fish-a", expect.any(Number)],
        ["fish-b", expect.any(Number)],
        ["fish-c", expect.any(Number)],
      ]),
    );
    for (const count of moveCountBySpot.values()) {
      expect(count).toBeGreaterThan(0);
    }
    for (const timer of fixture.timers.values()) {
      expect(timer.moveAtTick).toBeGreaterThan(tenHoursInTicks);
      expect(timer.moveAtTick).toBeLessThanOrEqual(
        tenHoursInTicks +
          GATHERING_CONSTANTS.FISHING_SPOT_MOVE.baseTicks +
          GATHERING_CONSTANTS.FISHING_SPOT_MOVE.varianceTicks,
      );
    }
  });
});
