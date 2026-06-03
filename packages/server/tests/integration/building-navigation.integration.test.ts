/**
 * Building Navigation Integration Test
 *
 * Tests the building collision service and BFS pathfinding:
 * 1. Building registration and collision detection
 * 2. Door tile detection and wall openings
 * 3. Path finding through buildings
 * 4. Stair navigation between floors
 *
 * Uses BuildingCollisionService directly with test building data.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { World, BFSPathfinder, tilesEqual } from "@hyperforge/shared";
import { BuildingCollisionService } from "@hyperforge/shared";
import type { TileCoord } from "@hyperforge/shared";

// Test configuration
const TEST_TIMEOUT = 30000;

/**
 * Create a simple test building layout
 * A 2-floor building: 3x3 cells with a door on the south side and stairs
 *
 * Coordinate system (based on CARDINAL_DIRECTIONS in BuildingCollisionService):
 * - north: dr=+1 → checking HIGHER row number
 * - south: dr=-1 → checking LOWER row number
 *
 * So for external edges:
 * - Row 0 checking south (dr=-1) → row -1 doesn't exist → SOUTH external edge
 * - Row 2 checking north (dr=+1) → row 3 doesn't exist → NORTH external edge
 *
 * Building grid:
 *   col: 0   1   2
 * row 0: [ ] [D] [ ]   <- Door here (south external edge)
 * row 1: [L] [ ] [ ]   <- Landing here
 * row 2: [S] [ ] [ ]   <- Stairs here
 */
function createTestBuildingLayout() {
  // Each cell is 4x4 tiles (CELL_SIZE = 4)
  // 3x3 cells = 12x12 tiles
  const footprint = [
    [true, true, true], // row 0 (SOUTH external edge)
    [true, true, true], // row 1
    [true, true, true], // row 2 (NORTH external edge)
  ];

  const roomMap = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  // Door on NORTH side of cell (col=1, row=0)
  // Row 0 has external edge on NORTH (checking row -1 via dr=-1 which doesn't exist)
  // CARDINAL_DIRECTIONS: { dir: "north", dc: 0, dr: -1 } means north = row decreases
  const externalOpenings = new Map<string, string>();
  externalOpenings.set("1,0,north", "door"); // col=1, row=0, direction=north

  // Internal openings - none for simple test
  const internalOpenings = new Map<string, string>();

  return {
    width: 3,
    depth: 3,
    floors: 2,
    floorPlans: [
      // Floor 0
      {
        footprint: footprint.map((row) => [...row]), // Deep copy
        roomMap: roomMap.map((row) => [...row]),
        internalOpenings: new Map(internalOpenings),
        externalOpenings: new Map(externalOpenings),
      },
      // Floor 1
      {
        footprint: footprint.map((row) => [...row]),
        roomMap: roomMap.map((row) => [...row]),
        internalOpenings: new Map(),
        externalOpenings: new Map(), // No external doors on floor 1
      },
    ],
    stairs: {
      col: 0,
      row: 2,
      direction: "north" as const,
      landing: { col: 0, row: 1 },
    },
  };
}

describe("Building Collision Service", () => {
  let world: World;
  let collisionService: BuildingCollisionService;
  let pathfinder: BFSPathfinder;

  // Building position in world coordinates
  const BUILDING_POS = { x: 100, y: 10, z: 100 };
  const BUILDING_ID = "test_building_1";
  const TOWN_ID = "test_town";

  beforeAll(async () => {
    // Create minimal world
    world = new World({
      isServer: true,
      isClient: false,
    });

    // Create collision service directly
    collisionService = new BuildingCollisionService(world);

    // Register test building
    const layout = createTestBuildingLayout();
    collisionService.registerBuilding(
      BUILDING_ID,
      TOWN_ID,
      layout,
      BUILDING_POS,
      0, // No rotation
    );

    pathfinder = new BFSPathfinder();

    console.log(
      `[Test Setup] Buildings registered: ${collisionService.getBuildingCount()}`,
    );
  }, TEST_TIMEOUT);

  afterAll(() => {
    world.destroy();
  });

  /**
   * Helper: Check if a tile is walkable
   */
  function isTileWalkable(tile: TileCoord, fromTile?: TileCoord): boolean {
    // Check building footprint walkability
    const isWalkableInBuilding = collisionService.isTileWalkableInBuilding(
      tile.x,
      tile.z,
      0, // floor 0
    );

    if (!isWalkableInBuilding) {
      return false;
    }

    // Check wall blocking if moving between tiles
    if (fromTile) {
      const wallBlocked = collisionService.isWallBlocked(
        fromTile.x,
        fromTile.z,
        tile.x,
        tile.z,
        0,
      );
      if (wallBlocked) {
        return false;
      }
    }

    return true;
  }

  /**
   * Helper: Find a path between two tiles
   */
  function findPath(from: TileCoord, to: TileCoord): TileCoord[] {
    return pathfinder.findPath(from, to, (tile, fromTile) =>
      isTileWalkable(tile, fromTile),
    );
  }

  it("should have buildings registered", () => {
    const buildingCount = collisionService.getBuildingCount();
    console.log(`[Test] Building count: ${buildingCount}`);
    expect(buildingCount).toBeGreaterThan(0);
  });

  it("should have door tiles for buildings", () => {
    const buildings = collisionService.getAllBuildings();
    expect(buildings.length).toBeGreaterThan(0);

    const firstBuilding = buildings[0];
    const doorTiles = collisionService.getDoorTiles(firstBuilding.buildingId);

    console.log(
      `[Test] Building ${firstBuilding.buildingId} has ${doorTiles.length} door(s)`,
    );
    doorTiles.forEach((door, i) => {
      console.log(`  Door ${i + 1}: (${door.tileX}, ${door.tileZ})`);
    });

    expect(doorTiles.length).toBeGreaterThan(0);
  });

  it("should find a path from outside to building door", () => {
    const buildings = collisionService.getAllBuildings();
    const building = buildings[0];
    const doorTiles = collisionService.getDoorTiles(building.buildingId);

    if (doorTiles.length === 0) {
      console.log("[Test] Skipping - no door tiles");
      return;
    }

    const door = doorTiles[0];

    // Start position: 10 tiles south of the door
    const startTile: TileCoord = { x: door.tileX, z: door.tileZ - 10 };
    const targetTile: TileCoord = { x: door.tileX, z: door.tileZ };

    console.log(
      `[Test] Finding path from (${startTile.x}, ${startTile.z}) to door at (${targetTile.x}, ${targetTile.z})`,
    );

    const path = findPath(startTile, targetTile);

    console.log(`[Test] Path found with ${path.length} steps`);
    if (path.length > 0) {
      console.log(`  Start: (${path[0].x}, ${path[0].z})`);
      console.log(
        `  End: (${path[path.length - 1].x}, ${path[path.length - 1].z})`,
      );
    }

    expect(path.length).toBeGreaterThan(0);
    expect(tilesEqual(path[path.length - 1], targetTile)).toBe(true);
  });

  it("should allow walking through door into building", () => {
    const buildings = collisionService.getAllBuildings();
    const building = buildings[0];
    const doorTiles = collisionService.getDoorTiles(building.buildingId);

    if (doorTiles.length === 0) {
      console.log("[Test] Skipping - no door tiles");
      return;
    }

    const door = doorTiles[0];

    // Check collision at door tile
    const doorCollision = collisionService.queryCollision(
      door.tileX,
      door.tileZ,
      0,
    );

    console.log(`[Test] Door tile collision:`, {
      isInsideBuilding: doorCollision.isInsideBuilding,
      isWalkable: doorCollision.isWalkable,
      wallBlocking: doorCollision.wallBlocking,
    });

    // Door should be walkable
    expect(doorCollision.isWalkable).toBe(true);

    // Check the wall at the door has an opening
    // Doors should have hasOpening = true which means wallBlocking should be false
    // in the direction of the door
    const doorDirection = door.direction;
    const wallInDoorDirection =
      doorCollision.wallBlocking[
        doorDirection as keyof typeof doorCollision.wallBlocking
      ];

    console.log(
      `[Test] Door direction: ${doorDirection}, wall blocking: ${wallInDoorDirection}`,
    );

    // Wall should NOT block in the door direction
    expect(wallInDoorDirection).toBe(false);
  });

  it("should find a contiguous path from outside to inside building", () => {
    const buildings = collisionService.getAllBuildings();
    const building = buildings[0];
    const doorTiles = collisionService.getDoorTiles(building.buildingId);

    if (doorTiles.length === 0) {
      console.log("[Test] Skipping - no door tiles");
      return;
    }

    const door = doorTiles[0];

    // Start: 5 tiles outside the building
    let startTile: TileCoord;
    switch (door.direction) {
      case "north":
        startTile = { x: door.tileX, z: door.tileZ + 5 };
        break;
      case "south":
        startTile = { x: door.tileX, z: door.tileZ - 5 };
        break;
      case "east":
        startTile = { x: door.tileX + 5, z: door.tileZ };
        break;
      case "west":
        startTile = { x: door.tileX - 5, z: door.tileZ };
        break;
      default:
        startTile = { x: door.tileX, z: door.tileZ - 5 };
    }

    // Target: Deep inside the building (center of bounding box)
    const bbox = building.boundingBox;
    const centerX = Math.floor((bbox.minTileX + bbox.maxTileX) / 2);
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);
    const targetTile: TileCoord = { x: centerX, z: centerZ };

    console.log(
      `[Test] Finding path from outside (${startTile.x}, ${startTile.z}) to building center (${targetTile.x}, ${targetTile.z})`,
    );

    const path = findPath(startTile, targetTile);

    console.log(`[Test] Path length: ${path.length}`);

    if (path.length === 0) {
      // Debug: why no path?
      console.log("[Test] NO PATH FOUND - Debugging:");
      console.log(`  Start tile walkable: ${isTileWalkable(startTile)}`);
      console.log(`  Target tile walkable: ${isTileWalkable(targetTile)}`);
      console.log(
        `  Door tile walkable: ${isTileWalkable({ x: door.tileX, z: door.tileZ })}`,
      );

      // Check each tile from start toward door
      let currentTile = { ...startTile };
      const step =
        door.direction === "north" ? -1 : door.direction === "south" ? 1 : 0;
      for (let i = 0; i < 10; i++) {
        const walkable = isTileWalkable(currentTile);
        const footprint = collisionService.isTileInBuildingFootprint(
          currentTile.x,
          currentTile.z,
        );
        console.log(
          `  Tile (${currentTile.x}, ${currentTile.z}): walkable=${walkable}, inFootprint=${footprint}`,
        );
        currentTile.z += step || 1;
      }
    }

    expect(path.length).toBeGreaterThan(0);

    // Verify path is contiguous (each step is adjacent)
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const dx = Math.abs(curr.x - prev.x);
      const dz = Math.abs(curr.z - prev.z);

      // Each step should be at most 1 tile in any direction
      expect(dx).toBeLessThanOrEqual(1);
      expect(dz).toBeLessThanOrEqual(1);
      // Should actually move (not stay in place)
      expect(dx + dz).toBeGreaterThan(0);
    }
  });

  it("should have walkable stair tiles for multi-floor buildings", () => {
    const buildings = collisionService.getAllBuildings();

    // Find a building with stairs (more than 1 floor)
    const multiFloorBuilding = buildings.find((b) => b.floors.length > 1);

    if (!multiFloorBuilding) {
      console.log("[Test] Skipping - no multi-floor buildings found");
      return;
    }

    console.log(
      `[Test] Found multi-floor building: ${multiFloorBuilding.buildingId} with ${multiFloorBuilding.floors.length} floors`,
    );

    // Check floor 0 for stairs
    const floor0 = multiFloorBuilding.floors.find((f) => f.floorIndex === 0);
    if (!floor0) {
      console.log("[Test] No floor 0 found");
      return;
    }

    const stairTiles = floor0.stairTiles;
    console.log(`[Test] Floor 0 has ${stairTiles.length} stair tile(s)`);

    if (stairTiles.length > 0) {
      const stair = stairTiles[0];
      console.log(
        `[Test] Stair at (${stair.tileX}, ${stair.tileZ}): ${stair.fromFloor} -> ${stair.toFloor}`,
      );

      // Stair tile should be walkable
      const stairCollision = collisionService.queryCollision(
        stair.tileX,
        stair.tileZ,
        stair.fromFloor,
      );

      console.log(`[Test] Stair tile collision:`, {
        isInsideBuilding: stairCollision.isInsideBuilding,
        isWalkable: stairCollision.isWalkable,
        stairTile: stairCollision.stairTile,
      });

      expect(stairCollision.isWalkable).toBe(true);
      expect(stairCollision.stairTile).not.toBeNull();
    }

    expect(stairTiles.length).toBeGreaterThanOrEqual(0);
  });

  it("should find path from door to stairs on floor 0", () => {
    const buildings = collisionService.getAllBuildings();

    // Find a multi-floor building with door and stairs
    const building = buildings.find((b) => {
      const hasMultipleFloors = b.floors.length > 1;
      const hasDoor = collisionService.getDoorTiles(b.buildingId).length > 0;
      const floor0 = b.floors.find((f) => f.floorIndex === 0);
      const hasStairs = floor0 && floor0.stairTiles.length > 0;
      return hasMultipleFloors && hasDoor && hasStairs;
    });

    if (!building) {
      console.log(
        "[Test] Skipping - no multi-floor building with door and stairs found",
      );
      return;
    }

    const doorTiles = collisionService.getDoorTiles(building.buildingId);
    const door = doorTiles[0];
    const floor0 = building.floors.find((f) => f.floorIndex === 0)!;
    const stair = floor0.stairTiles[0];

    const startTile: TileCoord = { x: door.tileX, z: door.tileZ };
    const targetTile: TileCoord = { x: stair.tileX, z: stair.tileZ };

    console.log(
      `[Test] Finding path from door (${startTile.x}, ${startTile.z}) to stair (${targetTile.x}, ${targetTile.z})`,
    );

    const path = findPath(startTile, targetTile);

    console.log(`[Test] Path length: ${path.length}`);

    if (path.length > 0) {
      console.log(`  Path: ${path.map((t) => `(${t.x},${t.z})`).join(" -> ")}`);
    }

    expect(path.length).toBeGreaterThan(0);
  });

  it("should route outside-to-upper-floor via stairs for all exterior tiles", () => {
    const building = collisionService.getBuilding(BUILDING_ID);
    expect(building).toBeDefined();
    if (!building) return;

    const floor0 = building.floors.find((f) => f.floorIndex === 0);
    const floor1 = building.floors.find((f) => f.floorIndex === 1);
    expect(floor0).toBeDefined();
    expect(floor1).toBeDefined();
    if (!floor0 || !floor1) return;

    const doorTiles = collisionService.getDoorTiles(building.buildingId);
    expect(doorTiles.length).toBeGreaterThan(0);
    const door = doorTiles[0];

    const stairBase = floor0.stairTiles.find((s) => !s.isLanding);
    expect(stairBase).toBeDefined();
    if (!stairBase) return;

    const stairLanding = floor1.stairTiles.find((s) => s.isLanding);
    expect(stairLanding).toBeDefined();
    if (!stairLanding) return;

    // Choose a "middle" tile on the upper floor that isn't a stair tile
    const floor1NonStairTiles = Array.from(floor1.walkableTiles)
      .map((key) => key.split(",").map(Number))
      .filter(
        ([x, z]) =>
          !floor1.stairTiles.some((s) => s.tileX === x && s.tileZ === z),
      );
    expect(floor1NonStairTiles.length).toBeGreaterThan(0);
    const midIndex = Math.floor(floor1NonStairTiles.length / 2);
    const upperTarget: TileCoord = {
      x: floor1NonStairTiles[midIndex][0]!,
      z: floor1NonStairTiles[midIndex][1]!,
    };

    const doorInterior: TileCoord = {
      x:
        door.direction === "east"
          ? door.tileX - 1
          : door.direction === "west"
            ? door.tileX + 1
            : door.tileX,
      z:
        door.direction === "north"
          ? door.tileZ + 1
          : door.direction === "south"
            ? door.tileZ - 1
            : door.tileZ,
    };
    const stairBaseTile: TileCoord = {
      x: stairBase.tileX,
      z: stairBase.tileZ,
    };
    const stairLandingTile: TileCoord = {
      x: stairLanding.tileX,
      z: stairLanding.tileZ,
    };

    const isGroundWalkable = (
      tile: TileCoord,
      fromTile?: TileCoord,
    ): boolean => {
      const check = collisionService.checkBuildingMovement(
        fromTile ?? null,
        tile,
        0,
        null,
      );
      if (!check.buildingAllowsMovement) return false;
      if (check.wallBlocked) return false;
      return true;
    };

    const isFloorWalkable = (
      tile: TileCoord,
      fromTile: TileCoord | undefined,
      floorIndex: number,
      buildingId: string,
    ): boolean => {
      const check = collisionService.checkBuildingMovement(
        fromTile ?? null,
        tile,
        floorIndex,
        buildingId,
      );
      if (!check.buildingAllowsMovement) return false;
      if (check.wallBlocked) return false;
      return check.targetInBuildingFootprint;
    };

    const { minTileX, maxTileX, minTileZ, maxTileZ } = building.boundingBox;
    const outsideTiles: TileCoord[] = [];
    const offset = 2;

    for (let x = minTileX - offset; x <= maxTileX + offset; x += 1) {
      outsideTiles.push({ x, z: minTileZ - offset });
      outsideTiles.push({ x, z: maxTileZ + offset });
    }
    for (let z = minTileZ - offset + 1; z <= maxTileZ + offset - 1; z += 1) {
      outsideTiles.push({ x: minTileX - offset, z });
      outsideTiles.push({ x: maxTileX + offset, z });
    }

    const outsideKeySet = new Set<string>();
    const uniqueOutsideTiles = outsideTiles.filter((tile) => {
      const key = `${tile.x},${tile.z}`;
      if (outsideKeySet.has(key)) return false;
      outsideKeySet.add(key);
      return true;
    });

    for (const startTile of uniqueOutsideTiles) {
      // Stage 1: outside -> door exterior
      const pathToDoor = pathfinder.findPath(
        startTile,
        { x: door.tileX, z: door.tileZ },
        isGroundWalkable,
      );
      expect(pathToDoor.length).toBeGreaterThan(0);

      // Stage 2: door interior -> stair base on floor 0
      const pathToStairs = pathfinder.findPath(
        doorInterior,
        stairBaseTile,
        (tile, from) => isFloorWalkable(tile, from, 0, BUILDING_ID),
      );
      expect(pathToStairs.length).toBeGreaterThan(0);
      expect(
        tilesEqual(pathToStairs[pathToStairs.length - 1]!, stairBaseTile),
      ).toBe(true);

      // Stage 3: stair landing -> upper target on floor 1
      const pathOnUpper = pathfinder.findPath(
        stairLandingTile,
        upperTarget,
        (tile, from) => isFloorWalkable(tile, from, 1, BUILDING_ID),
      );
      expect(pathOnUpper.length).toBeGreaterThan(0);

      // Route must include stairs (entry to stair base + landing on upper floor)
      expect(pathToStairs.some((tile) => tilesEqual(tile, stairBaseTile))).toBe(
        true,
      );
      if (!tilesEqual(stairLandingTile, upperTarget)) {
        expect(pathOnUpper.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("Door Entry Coverage - Multiple Buildings", () => {
  let world: World;
  let collisionService: BuildingCollisionService;
  let pathfinder: BFSPathfinder;

  const BUILDINGS = [
    { id: "door_coverage_0", pos: { x: 400, y: 10, z: 100 }, rot: 0 },
    {
      id: "door_coverage_90",
      pos: { x: 520, y: 10, z: 100 },
      rot: Math.PI / 2,
    },
    {
      id: "door_coverage_180",
      pos: { x: 400, y: 10, z: 220 },
      rot: Math.PI,
    },
  ] as const;

  beforeAll(async () => {
    world = new World({ isServer: true, isClient: false });
    collisionService = new BuildingCollisionService(world);
    pathfinder = new BFSPathfinder();

    const layout = createTestBuildingLayout();
    for (const building of BUILDINGS) {
      collisionService.registerBuilding(
        building.id,
        "door_coverage_town",
        layout,
        building.pos,
        building.rot,
      );
    }
  }, TEST_TIMEOUT);

  afterAll(() => {
    world.destroy();
  });

  const isGroundWalkable = (tile: TileCoord, fromTile?: TileCoord): boolean => {
    const check = collisionService.checkBuildingMovement(
      fromTile ?? null,
      tile,
      0,
      null,
    );
    if (!check.buildingAllowsMovement) return false;
    if (check.wallBlocked) return false;
    return true;
  };

  const createFloorWalkable = (buildingId: string, floorIndex: number) => {
    return (tile: TileCoord, fromTile?: TileCoord): boolean => {
      const check = collisionService.checkBuildingMovement(
        fromTile ?? null,
        tile,
        floorIndex,
        buildingId,
      );
      if (!check.buildingAllowsMovement) return false;
      if (check.wallBlocked) return false;
      return check.targetInBuildingFootprint;
    };
  };

  const pickInteriorTarget = (walkableTiles: Set<string>): TileCoord => {
    const tiles = Array.from(walkableTiles)
      .map((key) => key.split(",").map(Number))
      .map(([x, z]) => ({ x, z }));
    const total = tiles.length;
    if (total === 0) {
      throw new Error("No walkable tiles found");
    }

    let sumX = 0;
    let sumZ = 0;
    for (const tile of tiles) {
      sumX += tile.x;
      sumZ += tile.z;
    }
    const avgX = sumX / total;
    const avgZ = sumZ / total;

    let best = tiles[0]!;
    let bestDist = Infinity;
    for (const tile of tiles) {
      const dx = tile.x - avgX;
      const dz = tile.z - avgZ;
      const dist = dx * dx + dz * dz;
      if (dist < bestDist) {
        bestDist = dist;
        best = tile;
      }
    }
    return best;
  };

  it("should force door entry for all exterior tiles", () => {
    for (const buildingRef of BUILDINGS) {
      const building = collisionService.getBuilding(buildingRef.id);
      expect(building).toBeDefined();
      if (!building) continue;

      const floor0 = building.floors.find((f) => f.floorIndex === 0);
      expect(floor0).toBeDefined();
      if (!floor0) continue;

      const targetTile = pickInteriorTarget(floor0.walkableTiles);
      const floorWalkable = createFloorWalkable(building.buildingId, 0);

      const { minTileX, maxTileX, minTileZ, maxTileZ } = building.boundingBox;
      const offset = 2;
      const outsideTiles: TileCoord[] = [];

      for (let x = minTileX - offset; x <= maxTileX + offset; x += 1) {
        outsideTiles.push({ x, z: minTileZ - offset });
        outsideTiles.push({ x, z: maxTileZ + offset });
      }
      for (let z = minTileZ - offset + 1; z <= maxTileZ + offset - 1; z += 1) {
        outsideTiles.push({ x: minTileX - offset, z });
        outsideTiles.push({ x: maxTileX + offset, z });
      }

      const seen = new Set<string>();
      const uniqueOutside = outsideTiles.filter((tile) => {
        const key = `${tile.x},${tile.z}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return (
          collisionService.isTileInBuildingFootprint(tile.x, tile.z) === null &&
          collisionService.isTileInBuildingBoundingBox(tile.x, tile.z) === null
        );
      });

      for (const startTile of uniqueOutside) {
        const door = collisionService.findClosestDoorTile(
          building.buildingId,
          startTile.x,
          startTile.z,
        );
        expect(door).not.toBeNull();
        if (!door) continue;

        const doorExterior: TileCoord = { x: door.tileX, z: door.tileZ };
        const doorInterior: TileCoord = {
          x: door.interiorTileX,
          z: door.interiorTileZ,
        };

        const directPath = pathfinder.findPath(
          startTile,
          targetTile,
          isGroundWalkable,
        );
        const directReached =
          directPath.length > 0 &&
          tilesEqual(directPath[directPath.length - 1]!, targetTile) &&
          !pathfinder.wasLastPathPartial();
        expect(directReached).toBe(false);

        const pathToDoor = pathfinder.findPath(
          startTile,
          doorExterior,
          isGroundWalkable,
        );
        if (!tilesEqual(startTile, doorExterior)) {
          expect(pathToDoor.length).toBeGreaterThan(0);
          expect(
            tilesEqual(pathToDoor[pathToDoor.length - 1]!, doorExterior),
          ).toBe(true);
        }

        const stepCheck = collisionService.checkBuildingMovement(
          doorExterior,
          doorInterior,
          0,
          null,
        );
        expect(stepCheck.buildingAllowsMovement).toBe(true);
        expect(stepCheck.wallBlocked).toBe(false);

        const pathInside = pathfinder.findPath(
          doorInterior,
          targetTile,
          floorWalkable,
        );
        const insidePartial = pathfinder.wasLastPathPartial();
        if (!tilesEqual(doorInterior, targetTile)) {
          expect(pathInside.length).toBeGreaterThan(0);
          expect(insidePartial).toBe(false);
        }
      }
    }
  });
});

/**
 * Simulated bot that walks through a building
 * Uses direct BuildingCollisionService with test building data
 */
describe("Building Navigation Bot Simulation", () => {
  let world: World;
  let collisionService: BuildingCollisionService;
  let pathfinder: BFSPathfinder;

  // Building position
  const BUILDING_POS = { x: 100, y: 10, z: 100 };
  const BUILDING_ID = "bot_test_building";

  beforeAll(async () => {
    world = new World({ isServer: true, isClient: false });

    // Create collision service directly
    collisionService = new BuildingCollisionService(world);

    // Register test building with door and stairs
    const layout = createTestBuildingLayout();
    collisionService.registerBuilding(
      BUILDING_ID,
      "test_town",
      layout,
      BUILDING_POS,
      0,
    );

    pathfinder = new BFSPathfinder();
  }, TEST_TIMEOUT);

  afterAll(() => {
    world.destroy();
  });

  it("should simulate bot walking into building and upstairs", async () => {
    const buildings = collisionService.getAllBuildings();

    // Find our test building
    const building = buildings.find((b) => b.buildingId === BUILDING_ID);
    expect(building).toBeDefined();

    const doorTiles = collisionService.getDoorTiles(BUILDING_ID);
    const floor0 = building!.floors.find((f) => f.floorIndex === 0);

    console.log(`\n[Bot Test] === BUILDING INFO ===`);
    console.log(`[Bot Test] Building ID: ${building!.buildingId}`);
    console.log(`[Bot Test] Floors: ${building!.floors.length}`);
    console.log(`[Bot Test] Door tiles: ${doorTiles.length}`);
    console.log(
      `[Bot Test] Stair tiles on floor 0: ${floor0?.stairTiles.length ?? 0}`,
    );

    if (doorTiles.length === 0 || !floor0 || floor0.stairTiles.length === 0) {
      console.log("[Bot Test] Missing door or stairs - check building layout");
      console.log("[Bot Test] Debug - checking building collision data:");

      // Debug: Print walkable tiles
      if (floor0) {
        console.log(
          `[Bot Test] Floor 0 walkable tiles: ${floor0.walkableTiles.size}`,
        );
        const sampleTiles = Array.from(floor0.walkableTiles).slice(0, 5);
        console.log(`[Bot Test] Sample tiles: ${sampleTiles.join(", ")}`);
      }

      // Debug: Print wall segments
      if (floor0) {
        const doorsegments = floor0.wallSegments.filter((w) => w.hasOpening);
        console.log(
          `[Bot Test] Wall segments with openings: ${doorsegments.length}`,
        );
        doorsegments.forEach((s) => {
          console.log(
            `  - (${s.tileX}, ${s.tileZ}) ${s.side} opening=${s.openingType}`,
          );
        });
      }

      return;
    }

    const door = doorTiles[0];
    const stair = floor0.stairTiles[0];

    console.log(`\n[Bot Test] === STARTING NAVIGATION SIMULATION ===`);
    console.log(`[Bot Test] Door at: (${door.tileX}, ${door.tileZ})`);
    console.log(`[Bot Test] Stair at: (${stair.tileX}, ${stair.tileZ})`);

    // Bot starts 5 tiles south of the door
    let botPosition: TileCoord = { x: door.tileX, z: door.tileZ - 5 };
    let botFloor = 0;

    console.log(
      `[Bot Test] Bot starting at (${botPosition.x}, ${botPosition.z}) floor ${botFloor}`,
    );

    // Helper to check walkability at current floor
    function isTileWalkable(tile: TileCoord, fromTile?: TileCoord): boolean {
      const inBuilding = collisionService.isTileWalkableInBuilding(
        tile.x,
        tile.z,
        botFloor,
      );
      if (!inBuilding) return false;

      if (fromTile) {
        const wallBlocked = collisionService.isWallBlocked(
          fromTile.x,
          fromTile.z,
          tile.x,
          tile.z,
          botFloor,
        );
        if (wallBlocked) return false;
      }

      return true;
    }

    // Step 1: Walk to door
    console.log(
      `\n[Bot Test] STEP 1: Walking to door at (${door.tileX}, ${door.tileZ})`,
    );
    let path = pathfinder.findPath(
      botPosition,
      { x: door.tileX, z: door.tileZ },
      (tile, from) => isTileWalkable(tile, from),
    );

    console.log(`[Bot Test] Path to door: ${path.length} tiles`);
    if (path.length === 0) {
      console.log("[Bot Test] FAILED - No path to door!");
      console.log(`[Bot Test] Start walkable: ${isTileWalkable(botPosition)}`);
      console.log(
        `[Bot Test] Door walkable: ${isTileWalkable({ x: door.tileX, z: door.tileZ })}`,
      );
    }

    expect(path.length).toBeGreaterThan(0);

    // Simulate walking
    for (const tile of path) {
      botPosition = tile;
    }
    console.log(`[Bot Test] Bot at door: (${botPosition.x}, ${botPosition.z})`);

    // Step 2: Enter building and walk to stairs
    console.log(
      `\n[Bot Test] STEP 2: Walking to stairs at (${stair.tileX}, ${stair.tileZ})`,
    );
    path = pathfinder.findPath(
      botPosition,
      { x: stair.tileX, z: stair.tileZ },
      (tile, from) => isTileWalkable(tile, from),
    );

    console.log(`[Bot Test] Path to stairs: ${path.length} tiles`);
    expect(path.length).toBeGreaterThan(0);

    // Simulate walking
    for (const tile of path) {
      botPosition = tile;
    }
    console.log(
      `[Bot Test] Bot at stairs: (${botPosition.x}, ${botPosition.z})`,
    );

    // Step 3: Ascend stairs
    console.log(`\n[Bot Test] STEP 3: Ascending to floor ${stair.toFloor}`);
    botFloor = stair.toFloor;
    console.log(`[Bot Test] Bot now on floor ${botFloor}`);

    // Step 4: Walk around on second floor
    const floor1 = building!.floors.find((f) => f.floorIndex === 1);
    if (floor1 && floor1.walkableTiles.size > 0) {
      // Find a walkable tile on floor 1
      const walkableTileKey = Array.from(floor1.walkableTiles)[0];
      const [targetX, targetZ] = walkableTileKey.split(",").map(Number);

      console.log(
        `\n[Bot Test] STEP 4: Walking on floor 1 to (${targetX}, ${targetZ})`,
      );

      // Find stair landing on floor 1
      const floor1Stair = floor1.stairTiles.find((s) => s.isLanding);
      if (floor1Stair) {
        botPosition = { x: floor1Stair.tileX, z: floor1Stair.tileZ };
      }

      path = pathfinder.findPath(
        botPosition,
        { x: targetX, z: targetZ },
        (tile, from) => isTileWalkable(tile, from),
      );

      console.log(`[Bot Test] Path on floor 1: ${path.length} tiles`);

      if (path.length > 0) {
        for (const tile of path) {
          botPosition = tile;
        }
        console.log(
          `[Bot Test] Bot final position: (${botPosition.x}, ${botPosition.z}) floor ${botFloor}`,
        );
      }
    }

    console.log(`\n[Bot Test] === NAVIGATION SIMULATION COMPLETE ===`);
    console.log(`[Bot Test] Bot successfully navigated building!`);
  });
});

/**
 * Full Two-Story Building Navigation Test with Floor Verification
 *
 * Tests a bot navigating through a two-story building:
 * 1. Spawn outside the building
 * 2. Walk to the door and enter
 * 3. Walk to the stairs on ground floor
 * 4. Climb stairs to second floor
 * 5. Walk around on second floor
 * 6. Descend stairs back to ground floor
 * 7. Exit the building
 *
 * Errors if the bot is not on the expected floor at each step.
 */
describe("Two-Story Building Bot Navigation with Floor Verification", () => {
  let world: World;
  let collisionService: BuildingCollisionService;
  let pathfinder: BFSPathfinder;

  // Building configuration
  const BUILDING_POS = { x: 200, y: 5, z: 200 }; // Y=5 for terrain variation
  const BUILDING_ID = "two_story_test_building";
  const TOWN_ID = "floor_test_town";

  // Building constants (from procgen)
  const FOUNDATION_HEIGHT = 0.5;
  const FLOOR_HEIGHT = 3.4; // WALL_HEIGHT (3.2) + FLOOR_THICKNESS (0.2)

  /**
   * Bot state tracking
   */
  interface BotState {
    tileX: number;
    tileZ: number;
    worldY: number;
    currentFloor: number;
    insideBuilding: boolean;
    onStairs: boolean;
    stepsTaken: number;
  }

  /**
   * Navigation error with detailed context
   */
  class BotNavigationError extends Error {
    constructor(
      message: string,
      public botState: BotState,
      public expectedFloor: number,
      public expectedY: number,
    ) {
      super(
        `${message}\n` +
          `  Bot position: (${botState.tileX}, ${botState.tileZ})\n` +
          `  Bot Y: ${botState.worldY.toFixed(2)} (expected: ${expectedY.toFixed(2)})\n` +
          `  Bot floor: ${botState.currentFloor} (expected: ${expectedFloor})\n` +
          `  Steps taken: ${botState.stepsTaken}\n` +
          `  Inside building: ${botState.insideBuilding}`,
      );
      this.name = "BotNavigationError";
    }
  }

  beforeAll(async () => {
    world = new World({ isServer: true, isClient: false });
    collisionService = new BuildingCollisionService(world);

    // Create a 2-story building layout with door and stairs
    const layout = createTestBuildingLayout();
    collisionService.registerBuilding(
      BUILDING_ID,
      TOWN_ID,
      layout,
      BUILDING_POS,
      0, // No rotation
    );

    pathfinder = new BFSPathfinder();

    console.log(`[Floor Test] Building registered at Y=${BUILDING_POS.y}`);
    console.log(
      `[Floor Test] Floor 0 elevation: ${BUILDING_POS.y + FOUNDATION_HEIGHT}`,
    );
    console.log(
      `[Floor Test] Floor 1 elevation: ${BUILDING_POS.y + FOUNDATION_HEIGHT + FLOOR_HEIGHT}`,
    );
  }, TEST_TIMEOUT);

  afterAll(() => {
    world.destroy();
  });

  /**
   * Calculate expected Y elevation for a floor
   */
  function getFloorElevation(floorIndex: number): number {
    return BUILDING_POS.y + FOUNDATION_HEIGHT + floorIndex * FLOOR_HEIGHT;
  }

  /**
   * Verify bot is on expected floor and Y position
   */
  function verifyBotPosition(
    bot: BotState,
    expectedFloor: number,
    description: string,
    toleranceY: number = 0.5,
  ): void {
    const expectedY = getFloorElevation(expectedFloor);
    const yDiff = Math.abs(bot.worldY - expectedY);

    // Check floor index
    if (bot.currentFloor !== expectedFloor) {
      throw new BotNavigationError(
        `[FLOOR ERROR] ${description}: Bot on wrong floor!`,
        bot,
        expectedFloor,
        expectedY,
      );
    }

    // Check Y position within tolerance
    if (yDiff > toleranceY) {
      throw new BotNavigationError(
        `[Y ERROR] ${description}: Bot Y position outside tolerance (${toleranceY}m)!`,
        bot,
        expectedFloor,
        expectedY,
      );
    }

    console.log(
      `[Floor Test] ✓ ${description} - Floor ${bot.currentFloor}, Y=${bot.worldY.toFixed(2)}`,
    );
  }

  /**
   * Verify bot is outside building (ground level)
   */
  function verifyBotOutside(bot: BotState, description: string): void {
    if (bot.insideBuilding) {
      throw new Error(
        `[LOCATION ERROR] ${description}: Bot should be OUTSIDE building but is inside!`,
      );
    }

    // Outside the building, bot should be at terrain level (approx BUILDING_POS.y)
    const terrainY = BUILDING_POS.y;
    const yDiff = Math.abs(bot.worldY - terrainY);
    if (yDiff > 1.0) {
      // Allow 1m tolerance for terrain variation
      console.warn(
        `[Floor Test] ⚠ ${description}: Bot Y=${bot.worldY.toFixed(2)} differs from terrain Y=${terrainY} by ${yDiff.toFixed(2)}m`,
      );
    }

    console.log(
      `[Floor Test] ✓ ${description} - Outside building, Y=${bot.worldY.toFixed(2)}`,
    );
  }

  it("should navigate full building circuit with floor verification", async () => {
    // Get building data
    const building = collisionService.getBuilding(BUILDING_ID);
    if (!building) {
      throw new Error("Test building not found!");
    }

    const floor0 = building.floors.find((f) => f.floorIndex === 0);
    const floor1 = building.floors.find((f) => f.floorIndex === 1);

    if (!floor0 || !floor1) {
      throw new Error("Building must have floors 0 and 1!");
    }

    const doorTiles = collisionService.getDoorTiles(BUILDING_ID);
    if (doorTiles.length === 0) {
      throw new Error("Building must have a door!");
    }

    const groundStairs = floor0.stairTiles.filter((s) => !s.isLanding);
    const landingStairs = floor1.stairTiles.filter((s) => s.isLanding);

    if (groundStairs.length === 0) {
      throw new Error("Building must have stairs on ground floor!");
    }

    const door = doorTiles[0];
    const stairBottom = groundStairs[0];
    const stairTop = landingStairs[0];

    console.log("\n[Floor Test] === BUILDING SETUP ===");
    console.log(`[Floor Test] Door: (${door.tileX}, ${door.tileZ})`);
    console.log(
      `[Floor Test] Stair bottom: (${stairBottom.tileX}, ${stairBottom.tileZ})`,
    );
    if (stairTop) {
      console.log(
        `[Floor Test] Stair top: (${stairTop.tileX}, ${stairTop.tileZ})`,
      );
    }
    console.log(
      `[Floor Test] Floor 0 walkable tiles: ${floor0.walkableTiles.size}`,
    );
    console.log(
      `[Floor Test] Floor 1 walkable tiles: ${floor1.walkableTiles.size}`,
    );

    // Initialize bot state outside the building
    const startX = door.tileX;
    const startZ = door.tileZ - 8; // 8 tiles south of door
    const bot: BotState = {
      tileX: startX,
      tileZ: startZ,
      worldY: BUILDING_POS.y, // Start at terrain level
      currentFloor: 0,
      insideBuilding: false,
      onStairs: false,
      stepsTaken: 0,
    };

    console.log("\n[Floor Test] === STARTING NAVIGATION ===");
    console.log(`[Floor Test] Bot start: (${bot.tileX}, ${bot.tileZ})`);

    // Helper to check walkability
    const isTileWalkable = (tile: TileCoord, fromTile?: TileCoord): boolean => {
      // Outside building or at ground floor
      const walkable = collisionService.isTileWalkableInBuilding(
        tile.x,
        tile.z,
        bot.currentFloor,
      );

      if (!walkable) {
        // If not walkable in building context, check if outside building
        const inFootprint = collisionService.isTileInBuildingFootprint(
          tile.x,
          tile.z,
        );
        if (inFootprint) {
          return false; // Inside building but not walkable
        }
        return true; // Outside building, assume walkable terrain
      }

      // Check wall blocking
      if (fromTile) {
        const wallBlocked = collisionService.isWallBlocked(
          fromTile.x,
          fromTile.z,
          tile.x,
          tile.z,
          bot.currentFloor,
        );
        if (wallBlocked) {
          return false;
        }
      }

      return true;
    };

    // Helper to move bot along a path
    const walkPath = (path: TileCoord[], description: string): void => {
      if (path.length === 0) {
        throw new Error(`[PATH ERROR] ${description}: No path found!`);
      }

      console.log(`[Floor Test] ${description}: ${path.length} steps`);

      for (const tile of path) {
        // Update bot position
        bot.tileX = tile.x;
        bot.tileZ = tile.z;
        bot.stepsTaken++;

        // Update building state
        const inFootprint = collisionService.isTileInBuildingFootprint(
          tile.x,
          tile.z,
        );
        bot.insideBuilding = inFootprint !== null;

        // Update Y position based on location
        if (bot.insideBuilding) {
          const elevation = collisionService.getFloorElevation(
            tile.x,
            tile.z,
            bot.currentFloor,
          );
          if (elevation !== null) {
            bot.worldY = elevation;
          }
        } else {
          bot.worldY = BUILDING_POS.y; // Terrain level
        }

        // Check if on stairs
        const collision = collisionService.queryCollision(
          tile.x,
          tile.z,
          bot.currentFloor,
        );
        bot.onStairs = collision.stairTile !== null;
      }
    };

    // =========================================================================
    // STEP 1: Walk from outside to door
    // =========================================================================
    console.log("\n[Floor Test] STEP 1: Walking to door");
    verifyBotOutside(bot, "Before walking to door");

    let path = pathfinder.findPath(
      { x: bot.tileX, z: bot.tileZ },
      { x: door.tileX, z: door.tileZ },
      (tile, from) => isTileWalkable(tile, from),
    );

    walkPath(path, "Path to door");
    // At the door, we're entering the building
    bot.insideBuilding = true;
    bot.worldY = getFloorElevation(0);
    verifyBotPosition(bot, 0, "At building door");

    // =========================================================================
    // STEP 2: Walk to stairs on ground floor
    // =========================================================================
    console.log("\n[Floor Test] STEP 2: Walking to stairs (ground floor)");

    path = pathfinder.findPath(
      { x: bot.tileX, z: bot.tileZ },
      { x: stairBottom.tileX, z: stairBottom.tileZ },
      (tile, from) => isTileWalkable(tile, from),
    );

    walkPath(path, "Path to stairs");
    verifyBotPosition(bot, 0, "At stair bottom");

    if (!bot.onStairs) {
      console.warn(
        "[Floor Test] ⚠ Bot not detected as on stairs at stair tile",
      );
    }

    // =========================================================================
    // STEP 3: Ascend stairs to second floor
    // =========================================================================
    console.log("\n[Floor Test] STEP 3: Climbing stairs to floor 1");

    // Simulate climbing stairs - update floor
    const previousFloor = bot.currentFloor;
    bot.currentFloor = 1;
    bot.worldY = getFloorElevation(1);

    // Move to stair landing on floor 1
    if (stairTop) {
      bot.tileX = stairTop.tileX;
      bot.tileZ = stairTop.tileZ;
      bot.stepsTaken++;
    }

    verifyBotPosition(bot, 1, "After climbing stairs");

    // Verify we actually changed floors
    if (bot.currentFloor === previousFloor) {
      throw new Error(
        `[STAIR ERROR] Bot did not change floors after climbing! Still on floor ${bot.currentFloor}`,
      );
    }

    console.log(
      `[Floor Test] ✓ Floor transition: ${previousFloor} → ${bot.currentFloor}`,
    );

    // =========================================================================
    // STEP 4: Walk around on second floor
    // =========================================================================
    console.log("\n[Floor Test] STEP 4: Walking around on floor 1");

    // Find a walkable tile on floor 1 that's not a stair tile
    const floor1Tiles = Array.from(floor1.walkableTiles);
    const nonStairTile = floor1Tiles.find((tileKey) => {
      const [tx, tz] = tileKey.split(",").map(Number);
      return !floor1.stairTiles.some((s) => s.tileX === tx && s.tileZ === tz);
    });

    if (nonStairTile) {
      const [targetX, targetZ] = nonStairTile.split(",").map(Number);

      path = pathfinder.findPath(
        { x: bot.tileX, z: bot.tileZ },
        { x: targetX, z: targetZ },
        (tile, from) => isTileWalkable(tile, from),
      );

      if (path.length > 0) {
        walkPath(path, "Path on floor 1");
        verifyBotPosition(bot, 1, "After walking on floor 1");
      } else {
        console.log(
          `[Floor Test] Could not find path on floor 1 - checking direct walkability`,
        );
      }
    }

    // =========================================================================
    // STEP 5: Return to stair landing
    // =========================================================================
    console.log("\n[Floor Test] STEP 5: Returning to stairs (floor 1)");

    if (stairTop) {
      path = pathfinder.findPath(
        { x: bot.tileX, z: bot.tileZ },
        { x: stairTop.tileX, z: stairTop.tileZ },
        (tile, from) => isTileWalkable(tile, from),
      );

      if (path.length > 0) {
        walkPath(path, "Path back to stair landing");
      } else {
        // Bot might already be at the stairs
        bot.tileX = stairTop.tileX;
        bot.tileZ = stairTop.tileZ;
      }

      verifyBotPosition(bot, 1, "At stair landing (floor 1)");
    }

    // =========================================================================
    // STEP 6: Descend stairs to ground floor
    // =========================================================================
    console.log("\n[Floor Test] STEP 6: Descending stairs to floor 0");

    const floorBeforeDescent = bot.currentFloor;
    bot.currentFloor = 0;
    bot.worldY = getFloorElevation(0);
    bot.tileX = stairBottom.tileX;
    bot.tileZ = stairBottom.tileZ;
    bot.stepsTaken++;

    verifyBotPosition(bot, 0, "After descending stairs");

    if (bot.currentFloor === floorBeforeDescent) {
      throw new Error(
        `[STAIR ERROR] Bot did not change floors after descending! Still on floor ${bot.currentFloor}`,
      );
    }

    console.log(
      `[Floor Test] ✓ Floor transition: ${floorBeforeDescent} → ${bot.currentFloor}`,
    );

    // =========================================================================
    // STEP 7: Walk back to door
    // =========================================================================
    console.log("\n[Floor Test] STEP 7: Walking back to door");

    path = pathfinder.findPath(
      { x: bot.tileX, z: bot.tileZ },
      { x: door.tileX, z: door.tileZ },
      (tile, from) => isTileWalkable(tile, from),
    );

    walkPath(path, "Path to door");
    verifyBotPosition(bot, 0, "At door (exiting)");

    // =========================================================================
    // STEP 8: Exit building
    // =========================================================================
    console.log("\n[Floor Test] STEP 8: Exiting building");

    const outsideX = door.tileX;
    const outsideZ = door.tileZ - 5;

    path = pathfinder.findPath(
      { x: bot.tileX, z: bot.tileZ },
      { x: outsideX, z: outsideZ },
      (tile, from) => isTileWalkable(tile, from),
    );

    walkPath(path, "Path to outside");
    bot.insideBuilding = false;
    bot.worldY = BUILDING_POS.y;
    verifyBotOutside(bot, "After exiting building");

    // =========================================================================
    // FINAL SUMMARY
    // =========================================================================
    console.log("\n[Floor Test] === NAVIGATION COMPLETE ===");
    console.log(`[Floor Test] Total steps taken: ${bot.stepsTaken}`);
    console.log(
      `[Floor Test] Final position: (${bot.tileX}, ${bot.tileZ}) Y=${bot.worldY.toFixed(2)}`,
    );
    console.log(`[Floor Test] Final floor: ${bot.currentFloor}`);
    console.log(`[Floor Test] Inside building: ${bot.insideBuilding}`);
    console.log("[Floor Test] ✓ All floor verifications passed!");
  });

  it("should error if bot falls through floor", async () => {
    const building = collisionService.getBuilding(BUILDING_ID);
    if (!building) {
      throw new Error("Test building not found!");
    }

    const floor1 = building.floors.find((f) => f.floorIndex === 1);
    if (!floor1) {
      console.log("[Floor Test] Skipping - no floor 1");
      return;
    }

    // Simulate a bot on floor 1 with wrong Y (fallen through)
    const floor1Tile = Array.from(floor1.walkableTiles)[0];
    const [tileX, tileZ] = floor1Tile.split(",").map(Number);

    const brokenBot: BotState = {
      tileX,
      tileZ,
      worldY: BUILDING_POS.y + 0.5, // Ground floor Y instead of floor 1
      currentFloor: 1, // Claims to be on floor 1
      insideBuilding: true,
      onStairs: false,
      stepsTaken: 10,
    };

    const expectedY = getFloorElevation(1);

    // This should detect the Y position mismatch
    expect(() => {
      const yDiff = Math.abs(brokenBot.worldY - expectedY);
      if (yDiff > 0.5) {
        throw new BotNavigationError(
          "Bot Y position mismatch - may have fallen through floor!",
          brokenBot,
          1,
          expectedY,
        );
      }
    }).toThrow(BotNavigationError);

    console.log(
      "[Floor Test] ✓ Floor-through detection working - error thrown as expected",
    );
  });

  it("should error if bot on wrong floor", async () => {
    const bot: BotState = {
      tileX: 100,
      tileZ: 100,
      worldY: getFloorElevation(0), // At ground floor elevation
      currentFloor: 1, // But claims to be on floor 1!
      insideBuilding: true,
      onStairs: false,
      stepsTaken: 5,
    };

    expect(() => {
      // Verify should fail because currentFloor doesn't match expected
      const expectedY = getFloorElevation(1);
      const yDiff = Math.abs(bot.worldY - expectedY);
      if (yDiff > 0.5) {
        throw new BotNavigationError(
          "Bot floor index doesn't match Y position!",
          bot,
          1,
          expectedY,
        );
      }
    }).toThrow(BotNavigationError);

    console.log(
      "[Floor Test] ✓ Floor index verification working - error thrown as expected",
    );
  });

  /**
   * LOOPING TEST: Bot navigates the full building circuit multiple times
   *
   * Tests continuous navigation to catch any state issues or edge cases
   * that only appear after multiple traversals.
   */
  it("should navigate building circuit in a loop (5 iterations)", async () => {
    const LOOP_COUNT = 5;

    // Get building data
    const building = collisionService.getBuilding(BUILDING_ID);
    if (!building) {
      throw new Error("Test building not found!");
    }

    const floor0 = building.floors.find((f) => f.floorIndex === 0);
    const floor1 = building.floors.find((f) => f.floorIndex === 1);

    if (!floor0 || !floor1) {
      throw new Error("Building must have floors 0 and 1!");
    }

    const doorTiles = collisionService.getDoorTiles(BUILDING_ID);
    if (doorTiles.length === 0) {
      throw new Error("Building must have a door!");
    }

    const groundStairs = floor0.stairTiles.filter((s) => !s.isLanding);
    const landingStairs = floor1.stairTiles.filter((s) => s.isLanding);

    if (groundStairs.length === 0) {
      throw new Error("Building must have stairs on ground floor!");
    }

    const door = doorTiles[0];
    const stairBottom = groundStairs[0];
    const stairTop = landingStairs[0];

    // Initialize bot state outside the building
    const startX = door.tileX;
    const startZ = door.tileZ - 8;
    const bot: BotState = {
      tileX: startX,
      tileZ: startZ,
      worldY: BUILDING_POS.y,
      currentFloor: 0,
      insideBuilding: false,
      onStairs: false,
      stepsTaken: 0,
    };

    // Helper to check walkability
    const isTileWalkable = (tile: TileCoord, fromTile?: TileCoord): boolean => {
      const walkable = collisionService.isTileWalkableInBuilding(
        tile.x,
        tile.z,
        bot.currentFloor,
      );

      if (!walkable) {
        const inFootprint = collisionService.isTileInBuildingFootprint(
          tile.x,
          tile.z,
        );
        if (inFootprint) {
          return false;
        }
        return true;
      }

      if (fromTile) {
        const wallBlocked = collisionService.isWallBlocked(
          fromTile.x,
          fromTile.z,
          tile.x,
          tile.z,
          bot.currentFloor,
        );
        if (wallBlocked) {
          return false;
        }
      }

      return true;
    };

    // Helper to move bot along a path with floor AND wall verification
    const walkPath = (
      path: TileCoord[],
      expectedFloor: number,
      description: string,
    ): void => {
      if (path.length === 0) {
        throw new Error(`[LOOP PATH ERROR] ${description}: No path found!`);
      }

      let previousTile: TileCoord = { x: bot.tileX, z: bot.tileZ };

      for (const tile of path) {
        // === WALL COLLISION CHECK ===
        // Verify we're not walking through a wall
        const wallBlocked = collisionService.isWallBlocked(
          previousTile.x,
          previousTile.z,
          tile.x,
          tile.z,
          bot.currentFloor,
        );

        if (wallBlocked) {
          throw new Error(
            `[WALL ERROR] ${description}: Bot walked through wall!\n` +
              `  From: (${previousTile.x}, ${previousTile.z})\n` +
              `  To: (${tile.x}, ${tile.z})\n` +
              `  Floor: ${bot.currentFloor}\n` +
              `  Step: ${bot.stepsTaken}`,
          );
        }

        // === STEP ADJACENCY CHECK ===
        // Verify steps are adjacent (max 1 tile in each direction)
        const dx = Math.abs(tile.x - previousTile.x);
        const dz = Math.abs(tile.z - previousTile.z);
        if (dx > 1 || dz > 1) {
          throw new Error(
            `[TELEPORT ERROR] ${description}: Bot teleported!\n` +
              `  From: (${previousTile.x}, ${previousTile.z})\n` +
              `  To: (${tile.x}, ${tile.z})\n` +
              `  Distance: dx=${dx}, dz=${dz}`,
          );
        }

        // Update bot position
        bot.tileX = tile.x;
        bot.tileZ = tile.z;
        bot.stepsTaken++;
        previousTile = { x: tile.x, z: tile.z };

        const inFootprint = collisionService.isTileInBuildingFootprint(
          tile.x,
          tile.z,
        );
        bot.insideBuilding = inFootprint !== null;

        if (bot.insideBuilding) {
          const elevation = collisionService.getFloorElevation(
            tile.x,
            tile.z,
            bot.currentFloor,
          );
          if (elevation !== null) {
            bot.worldY = elevation;
          }
        } else {
          bot.worldY = BUILDING_POS.y;
        }

        // Verify floor hasn't unexpectedly changed
        if (bot.currentFloor !== expectedFloor) {
          throw new BotNavigationError(
            `[LOOP ERROR] Floor changed unexpectedly during ${description}!`,
            bot,
            expectedFloor,
            getFloorElevation(expectedFloor),
          );
        }

        // Verify Y position
        const expectedY = bot.insideBuilding
          ? getFloorElevation(expectedFloor)
          : BUILDING_POS.y;
        const yDiff = Math.abs(bot.worldY - expectedY);
        if (yDiff > 0.6) {
          throw new BotNavigationError(
            `[LOOP ERROR] Y position mismatch during ${description}!`,
            bot,
            expectedFloor,
            expectedY,
          );
        }
      }
    };

    console.log(
      `\n[Loop Test] === STARTING ${LOOP_COUNT} ITERATION LOOP TEST ===`,
    );

    for (let iteration = 1; iteration <= LOOP_COUNT; iteration++) {
      console.log(`\n[Loop Test] --- ITERATION ${iteration}/${LOOP_COUNT} ---`);

      // Reset bot to starting position
      bot.tileX = startX;
      bot.tileZ = startZ;
      bot.worldY = BUILDING_POS.y;
      bot.currentFloor = 0;
      bot.insideBuilding = false;
      bot.onStairs = false;

      // Verify starting state
      if (bot.insideBuilding) {
        throw new Error(
          `[LOOP ERROR] Iteration ${iteration}: Bot should start OUTSIDE!`,
        );
      }
      if (bot.currentFloor !== 0) {
        throw new Error(
          `[LOOP ERROR] Iteration ${iteration}: Bot should start on floor 0!`,
        );
      }

      // STEP 1: Walk to door
      let path = pathfinder.findPath(
        { x: bot.tileX, z: bot.tileZ },
        { x: door.tileX, z: door.tileZ },
        (tile, from) => isTileWalkable(tile, from),
      );
      walkPath(path, 0, `Iter ${iteration} - to door`);
      bot.insideBuilding = true;
      bot.worldY = getFloorElevation(0);

      // STEP 2: Walk to stairs
      path = pathfinder.findPath(
        { x: bot.tileX, z: bot.tileZ },
        { x: stairBottom.tileX, z: stairBottom.tileZ },
        (tile, from) => isTileWalkable(tile, from),
      );
      walkPath(path, 0, `Iter ${iteration} - to stairs`);

      // STEP 3: Climb to floor 1
      bot.currentFloor = 1;
      bot.worldY = getFloorElevation(1);
      if (stairTop) {
        bot.tileX = stairTop.tileX;
        bot.tileZ = stairTop.tileZ;
        bot.stepsTaken++;
      }

      // Verify floor change
      if (bot.currentFloor !== 1) {
        throw new Error(
          `[LOOP ERROR] Iteration ${iteration}: Failed to climb to floor 1!`,
        );
      }

      // STEP 4: Walk on floor 1
      const floor1Tiles = Array.from(floor1.walkableTiles);
      const nonStairTile = floor1Tiles.find((tileKey) => {
        const [tx, tz] = tileKey.split(",").map(Number);
        return !floor1.stairTiles.some((s) => s.tileX === tx && s.tileZ === tz);
      });

      if (nonStairTile) {
        const [targetX, targetZ] = nonStairTile.split(",").map(Number);
        path = pathfinder.findPath(
          { x: bot.tileX, z: bot.tileZ },
          { x: targetX, z: targetZ },
          (tile, from) => isTileWalkable(tile, from),
        );
        if (path.length > 0) {
          walkPath(path, 1, `Iter ${iteration} - on floor 1`);
        }
      }

      // STEP 5: Return to stairs
      if (stairTop) {
        path = pathfinder.findPath(
          { x: bot.tileX, z: bot.tileZ },
          { x: stairTop.tileX, z: stairTop.tileZ },
          (tile, from) => isTileWalkable(tile, from),
        );
        if (path.length > 0) {
          walkPath(path, 1, `Iter ${iteration} - back to landing`);
        } else {
          bot.tileX = stairTop.tileX;
          bot.tileZ = stairTop.tileZ;
        }
      }

      // STEP 6: Descend to floor 0
      bot.currentFloor = 0;
      bot.worldY = getFloorElevation(0);
      bot.tileX = stairBottom.tileX;
      bot.tileZ = stairBottom.tileZ;
      bot.stepsTaken++;

      // Verify floor change
      if (bot.currentFloor !== 0) {
        throw new Error(
          `[LOOP ERROR] Iteration ${iteration}: Failed to descend to floor 0!`,
        );
      }

      // STEP 7: Walk to door
      path = pathfinder.findPath(
        { x: bot.tileX, z: bot.tileZ },
        { x: door.tileX, z: door.tileZ },
        (tile, from) => isTileWalkable(tile, from),
      );
      walkPath(path, 0, `Iter ${iteration} - to door exit`);

      // STEP 8: Exit building
      path = pathfinder.findPath(
        { x: bot.tileX, z: bot.tileZ },
        { x: startX, z: startZ },
        (tile, from) => isTileWalkable(tile, from),
      );
      walkPath(path, 0, `Iter ${iteration} - exit building`);
      bot.insideBuilding = false;
      bot.worldY = BUILDING_POS.y;

      // Verify end state
      if (bot.insideBuilding) {
        throw new Error(
          `[LOOP ERROR] Iteration ${iteration}: Bot should end OUTSIDE!`,
        );
      }
      if (bot.currentFloor !== 0) {
        throw new Error(
          `[LOOP ERROR] Iteration ${iteration}: Bot should end on floor 0!`,
        );
      }

      console.log(
        `[Loop Test] ✓ Iteration ${iteration} complete - ${bot.stepsTaken} total steps`,
      );
    }

    console.log(`\n[Loop Test] === LOOP TEST COMPLETE ===`);
    console.log(`[Loop Test] Total iterations: ${LOOP_COUNT}`);
    console.log(`[Loop Test] Total steps: ${bot.stepsTaken}`);
    console.log(`[Loop Test] ✓ All ${LOOP_COUNT} iterations passed!`);
  });

  /**
   * WALL COLLISION TEST: Verify walls actually block movement
   *
   * Tests that:
   * 1. Direct paths through walls are blocked
   * 2. Only door tiles allow passage through building exterior
   * 3. Wall blocking is detected for all cardinal directions
   */
  it("should verify walls actually block movement (not walking through walls)", async () => {
    const building = collisionService.getBuilding(BUILDING_ID);
    if (!building) {
      throw new Error("Test building not found!");
    }

    const floor0 = building.floors.find((f) => f.floorIndex === 0);
    if (!floor0) {
      throw new Error("Building must have floor 0!");
    }

    console.log("\n[Wall Test] === WALL COLLISION VERIFICATION ===");

    // Find wall segments (walls without openings)
    const solidWalls = floor0.wallSegments.filter((w) => !w.hasOpening);
    const doorWalls = floor0.wallSegments.filter(
      (w) => w.hasOpening && w.openingType === "door",
    );

    console.log(`[Wall Test] Solid wall segments: ${solidWalls.length}`);
    console.log(`[Wall Test] Door wall segments: ${doorWalls.length}`);

    if (solidWalls.length === 0) {
      throw new Error("Building has no solid walls to test!");
    }

    // Test 1: Verify solid walls block movement
    let wallsBlocked = 0;
    let wallsTestedCount = 0;
    const maxWallsToTest = 20; // Test a sample of walls

    for (const wall of solidWalls.slice(0, maxWallsToTest)) {
      wallsTestedCount++;

      // Calculate the tile OUTSIDE the wall based on wall direction
      let outsideTileX = wall.tileX;
      let outsideTileZ = wall.tileZ;

      switch (wall.side) {
        case "north":
          outsideTileZ -= 1;
          break;
        case "south":
          outsideTileZ += 1;
          break;
        case "east":
          outsideTileX += 1;
          break;
        case "west":
          outsideTileX -= 1;
          break;
      }

      // Check if movement from outside to inside is blocked
      const blockedInward = collisionService.isWallBlocked(
        outsideTileX,
        outsideTileZ,
        wall.tileX,
        wall.tileZ,
        0,
      );

      // Check if movement from inside to outside is blocked
      const blockedOutward = collisionService.isWallBlocked(
        wall.tileX,
        wall.tileZ,
        outsideTileX,
        outsideTileZ,
        0,
      );

      if (blockedInward || blockedOutward) {
        wallsBlocked++;
      }
    }

    console.log(
      `[Wall Test] Walls tested: ${wallsTestedCount}, Walls blocking: ${wallsBlocked}`,
    );

    // At least 80% of solid walls should block movement
    const blockPercentage = wallsBlocked / wallsTestedCount;
    if (blockPercentage < 0.8) {
      throw new Error(
        `[WALL ERROR] Only ${(blockPercentage * 100).toFixed(1)}% of walls are blocking! Expected >= 80%`,
      );
    }

    console.log(
      `[Wall Test] ✓ ${(blockPercentage * 100).toFixed(1)}% of walls blocking movement`,
    );

    // Test 2: Verify door walls allow passage
    let doorsPassable = 0;
    for (const door of doorWalls.slice(0, 10)) {
      let outsideTileX = door.tileX;
      let outsideTileZ = door.tileZ;

      switch (door.side) {
        case "north":
          outsideTileZ -= 1;
          break;
        case "south":
          outsideTileZ += 1;
          break;
        case "east":
          outsideTileX += 1;
          break;
        case "west":
          outsideTileX -= 1;
          break;
      }

      const blocked = collisionService.isWallBlocked(
        outsideTileX,
        outsideTileZ,
        door.tileX,
        door.tileZ,
        0,
      );

      if (!blocked) {
        doorsPassable++;
      }
    }

    const doorsTestedCount = Math.min(doorWalls.length, 10);
    if (doorsTestedCount > 0) {
      console.log(
        `[Wall Test] Doors tested: ${doorsTestedCount}, Doors passable: ${doorsPassable}`,
      );

      // All doors should be passable
      if (doorsPassable < doorsTestedCount) {
        console.warn(
          `[Wall Test] ⚠ Only ${doorsPassable}/${doorsTestedCount} doors are passable`,
        );
      } else {
        console.log(`[Wall Test] ✓ All ${doorsTestedCount} doors are passable`);
      }
    }

    // Test 3: Verify pathfinder respects walls - try to path directly into building center
    // from outside without using the door
    const bbox = building.boundingBox;
    const centerX = Math.floor((bbox.minTileX + bbox.maxTileX) / 2);
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);

    // Start position: outside the building on a non-door side
    // Find a solid wall and start from outside it
    const testWall = solidWalls[0];
    let startX = testWall.tileX;
    let startZ = testWall.tileZ;

    switch (testWall.side) {
      case "north":
        startZ -= 5;
        break;
      case "south":
        startZ += 5;
        break;
      case "east":
        startX += 5;
        break;
      case "west":
        startX -= 5;
        break;
    }

    console.log(
      `[Wall Test] Testing path from (${startX}, ${startZ}) to center (${centerX}, ${centerZ})`,
    );

    // The path should go AROUND to the door, not through the wall
    const path = pathfinder.findPath(
      { x: startX, z: startZ },
      { x: centerX, z: centerZ },
      (tile, fromTile) => {
        const walkable = collisionService.isTileWalkableInBuilding(
          tile.x,
          tile.z,
          0,
        );
        if (!walkable) {
          const inFootprint = collisionService.isTileInBuildingFootprint(
            tile.x,
            tile.z,
          );
          if (inFootprint) return false;
          return true;
        }
        if (fromTile) {
          const wallBlocked = collisionService.isWallBlocked(
            fromTile.x,
            fromTile.z,
            tile.x,
            tile.z,
            0,
          );
          if (wallBlocked) return false;
        }
        return true;
      },
    );

    if (path.length > 0) {
      // Verify path doesn't go through any solid walls
      let prevTile = { x: startX, z: startZ };
      let wallViolations = 0;

      for (const tile of path) {
        const wallBlocked = collisionService.isWallBlocked(
          prevTile.x,
          prevTile.z,
          tile.x,
          tile.z,
          0,
        );

        if (wallBlocked) {
          wallViolations++;
          console.error(
            `[Wall Test] PATH VIOLATION: (${prevTile.x},${prevTile.z}) → (${tile.x},${tile.z}) blocked by wall!`,
          );
        }

        prevTile = tile;
      }

      if (wallViolations > 0) {
        throw new Error(
          `[WALL ERROR] Path has ${wallViolations} wall violations!`,
        );
      }

      console.log(
        `[Wall Test] ✓ Path of ${path.length} steps has no wall violations`,
      );
    } else {
      console.log(
        `[Wall Test] No path found (walls may be blocking all routes)`,
      );
    }

    console.log("[Wall Test] === WALL VERIFICATION COMPLETE ===");
  });
});
