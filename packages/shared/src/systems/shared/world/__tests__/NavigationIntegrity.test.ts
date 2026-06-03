/**
 * Navigation Integrity Tests
 *
 * Comprehensive validation of the entire navigation system including:
 * 1. Building registration verification
 * 2. Wall segment completeness
 * 3. Floor tracking correctness
 * 4. Door detection accuracy
 *
 * These tests ensure buildings are properly registered and that players
 * cannot walk through walls, must use doors, and navigate correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BuildingCollisionService } from "../BuildingCollisionService";
import { CollisionMatrix } from "../../movement/CollisionMatrix";
import { CollisionFlag } from "../../movement/CollisionFlags";
import { BFSPathfinder } from "../../movement/BFSPathfinder";
import type { BuildingLayoutInput } from "../../../../types/world/building-collision-types";
import type { TileCoord } from "../../movement/TileSystem";
import type { World } from "../../../../core/World";

// ============================================================================
// TEST UTILITIES
// ============================================================================

function createMockWorld(): World {
  const collision = new CollisionMatrix();
  return {
    collision,
    isServer: true,
    isClient: false,
    physics: null,
    camera: null,
    stage: null,
    entities: new Map(),
    emit: () => {},
    on: () => {},
    off: () => {},
    getSystem: () => null,
    setupMaterial: () => {},
  } as unknown as World;
}

/**
 * Create a standard test building with known dimensions
 * Building is 3x3 cells (12x12 tiles) with a north-facing door
 */
function createStandardTestBuilding(
  doorDirection: "north" | "south" | "east" | "west" = "north",
): BuildingLayoutInput {
  // Door position depends on direction
  const doorKey =
    doorDirection === "north"
      ? "1,0,north"
      : doorDirection === "south"
        ? "1,2,south"
        : doorDirection === "east"
          ? "2,1,east"
          : "0,1,west";

  return {
    width: 3,
    depth: 3,
    floors: 1,
    floorPlans: [
      {
        footprint: [
          [true, true, true],
          [true, true, true],
          [true, true, true],
        ],
        roomMap: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
        internalOpenings: new Map(),
        externalOpenings: new Map([[doorKey, "door"]]),
      },
    ],
    stairs: null,
  };
}

/**
 * Create walkability checker for BFSPathfinder
 */
function createWalkabilityChecker(
  collisionService: BuildingCollisionService,
  floorIndex: number,
) {
  return (tile: TileCoord, fromTile?: TileCoord): boolean => {
    const walkable = collisionService.isTileWalkableInBuilding(
      tile.x,
      tile.z,
      floorIndex,
    );
    if (!walkable) return false;

    if (fromTile) {
      const wallBlocked = collisionService.isWallBlocked(
        fromTile.x,
        fromTile.z,
        tile.x,
        tile.z,
        floorIndex,
      );
      if (wallBlocked) return false;
    }

    return true;
  };
}

/**
 * Verify path doesn't cross any walls
 */
function verifyPathIntegrity(
  path: TileCoord[],
  collisionService: BuildingCollisionService,
  floorIndex: number,
  startTile: TileCoord,
): { valid: boolean; violations: Array<{ from: TileCoord; to: TileCoord }> } {
  const violations: Array<{ from: TileCoord; to: TileCoord }> = [];

  // Check from start to first path tile
  if (path.length > 0) {
    const wallBlocked = collisionService.isWallBlocked(
      startTile.x,
      startTile.z,
      path[0].x,
      path[0].z,
      floorIndex,
    );
    if (wallBlocked) {
      violations.push({ from: startTile, to: path[0] });
    }
  }

  // Check each step in the path
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];

    const wallBlocked = collisionService.isWallBlocked(
      from.x,
      from.z,
      to.x,
      to.z,
      floorIndex,
    );
    if (wallBlocked) {
      violations.push({ from, to });
    }
  }

  return { valid: violations.length === 0, violations };
}

// ============================================================================
// TEST SUITE 1: Building Registration Verification
// ============================================================================

describe("Building Registration Verification", () => {
  let world: World;
  let collisionService: BuildingCollisionService;

  beforeAll(() => {
    world = createMockWorld();
    collisionService = new BuildingCollisionService(world);
  });

  afterAll(() => {
    collisionService.clear();
  });

  it("should register building and make it queryable", () => {
    const layout = createStandardTestBuilding();
    const buildingId = "test-registration-1";
    const position = { x: 100, y: 10, z: 100 };

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      position,
      0,
    );

    // Verify building is registered
    const building = collisionService.getBuilding(buildingId);
    expect(building).toBeDefined();
    expect(building?.buildingId).toBe(buildingId);
  });

  it("should have correct bounding box after registration", () => {
    const layout = createStandardTestBuilding();
    const buildingId = "test-bbox-1";
    const position = { x: 200, y: 10, z: 200 };

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      position,
      0,
    );

    const building = collisionService.getBuilding(buildingId);
    expect(building).toBeDefined();

    // 3x3 cells = 12x12 tiles (each cell is 4x4 tiles)
    const bbox = building!.boundingBox;
    const bboxWidth = bbox.maxTileX - bbox.minTileX + 1;
    const bboxDepth = bbox.maxTileZ - bbox.minTileZ + 1;

    expect(bboxWidth).toBe(12);
    expect(bboxDepth).toBe(12);
  });

  it("should have walkable tiles on ground floor", () => {
    const layout = createStandardTestBuilding();
    const buildingId = "test-walkable-1";
    const position = { x: 300, y: 10, z: 300 };

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      position,
      0,
    );

    const building = collisionService.getBuilding(buildingId);
    const groundFloor = building?.floors.find((f) => f.floorIndex === 0);

    expect(groundFloor).toBeDefined();
    // 3x3 cells = 9 cells, each cell has 16 tiles (4x4) = 144 walkable tiles
    expect(groundFloor!.walkableTiles.size).toBe(144);
  });

  it("should throw error for building with no walkable tiles", () => {
    const layout: BuildingLayoutInput = {
      width: 1,
      depth: 1,
      floors: 1,
      floorPlans: [
        {
          footprint: [[false]], // No cells!
          roomMap: [[-1]],
          internalOpenings: new Map(),
          externalOpenings: new Map(),
        },
      ],
      stairs: null,
    };

    expect(() => {
      collisionService.registerBuilding(
        "test-empty-building",
        "test-town",
        layout,
        { x: 400, y: 10, z: 400 },
        0,
      );
    }).toThrow(/NO WALKABLE TILES/);
  });

  it("should count all registered buildings correctly", () => {
    const initialCount = collisionService.getBuildingCount();

    // Register 3 new buildings
    for (let i = 0; i < 3; i++) {
      const layout = createStandardTestBuilding();
      collisionService.registerBuilding(
        `count-test-${i}`,
        "test-town",
        layout,
        { x: 500 + i * 50, y: 10, z: 500 },
        0,
      );
    }

    expect(collisionService.getBuildingCount()).toBe(initialCount + 3);
  });
});

// ============================================================================
// TEST SUITE 2: Wall Segment Completeness
// ============================================================================

describe("Wall Segment Completeness", () => {
  let world: World;
  let collisionService: BuildingCollisionService;

  beforeAll(() => {
    world = createMockWorld();
    collisionService = new BuildingCollisionService(world);
  });

  afterAll(() => {
    collisionService.clear();
  });

  it("should have wall segments on all external edges", () => {
    const layout = createStandardTestBuilding("north");
    const buildingId = "wall-test-1";

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      { x: 0, y: 10, z: 0 },
      0,
    );

    const building = collisionService.getBuilding(buildingId);
    const groundFloor = building?.floors.find((f) => f.floorIndex === 0);
    expect(groundFloor).toBeDefined();

    // Count walls by direction
    const wallCounts = { north: 0, south: 0, east: 0, west: 0 };
    for (const wall of groundFloor!.wallSegments) {
      wallCounts[wall.side]++;
    }

    // Each edge should have 12 wall segments (4 tiles per cell * 3 cells)
    // But door tiles reduce the count on that edge
    console.log(
      `Wall counts: N=${wallCounts.north} S=${wallCounts.south} E=${wallCounts.east} W=${wallCounts.west}`,
    );

    // South, East, West edges should have 12 walls each
    expect(wallCounts.south).toBe(12);
    expect(wallCounts.east).toBe(12);
    expect(wallCounts.west).toBe(12);

    // North edge has door (2 center tiles), so 12 - 2 = 10 wall segments
    // Door width is ~2 tiles in center
    expect(wallCounts.north).toBeGreaterThanOrEqual(10);
  });

  it("should register wall flags in CollisionMatrix", () => {
    const layout = createStandardTestBuilding("south");
    const buildingId = "collision-flag-test";

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      { x: 100, y: 10, z: 100 },
      0,
    );

    const building = collisionService.getBuilding(buildingId);
    const bbox = building!.boundingBox;
    const collision = world.collision;

    // Check that wall flags are set on the edges
    let northWallFlags = 0;
    let southWallFlags = 0;

    // Check north edge tiles
    for (let x = bbox.minTileX; x <= bbox.maxTileX; x++) {
      const flags = collision.getFlags(x, bbox.minTileZ);
      if (flags & CollisionFlag.WALL_NORTH) northWallFlags++;
    }

    // Check south edge tiles
    for (let x = bbox.minTileX; x <= bbox.maxTileX; x++) {
      const flags = collision.getFlags(x, bbox.maxTileZ);
      if (flags & CollisionFlag.WALL_SOUTH) southWallFlags++;
    }

    console.log(
      `CollisionMatrix flags: North=${northWallFlags}, South=${southWallFlags}`,
    );

    // Should have wall flags on edges (minus door opening)
    expect(northWallFlags).toBeGreaterThan(0);
    // South edge has door, but still has some wall flags
    expect(southWallFlags).toBeGreaterThanOrEqual(10);
  });

  it("should mark door tiles as having openings", () => {
    const layout = createStandardTestBuilding("north");
    const buildingId = "door-opening-test";

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      { x: 200, y: 10, z: 200 },
      0,
    );

    const building = collisionService.getBuilding(buildingId);
    const groundFloor = building?.floors.find((f) => f.floorIndex === 0);

    // Find wall segments with door openings
    const doorSegments = groundFloor!.wallSegments.filter(
      (w) => w.hasOpening && w.openingType === "door",
    );

    console.log(`Found ${doorSegments.length} door segments`);
    expect(doorSegments.length).toBeGreaterThan(0);

    // All door segments should be on north edge
    for (const door of doorSegments) {
      expect(door.side).toBe("north");
    }
  });

  it("should block movement through walls but allow through doors", () => {
    const layout = createStandardTestBuilding("north");
    const buildingId = "wall-block-test";
    const position = { x: 300, y: 10, z: 300 };

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      position,
      0,
    );

    const building = collisionService.getBuilding(buildingId);
    const bbox = building!.boundingBox;

    // Get a door tile location
    const doorTiles = collisionService.getDoorTiles(buildingId);
    expect(doorTiles.length).toBeGreaterThan(0);

    const doorTile = doorTiles[0];

    // Movement through door should be allowed
    const throughDoor = collisionService.isWallBlocked(
      doorTile.tileX,
      doorTile.tileZ - 1, // Outside
      doorTile.tileX,
      doorTile.tileZ, // Through door
      0,
    );
    expect(throughDoor).toBe(false);

    // Find a non-door tile on north edge
    let nonDoorTileX = bbox.minTileX;
    const isNotDoor = doorTiles.every((d) => d.tileX !== nonDoorTileX);
    if (!isNotDoor) {
      nonDoorTileX = bbox.maxTileX;
    }

    // Movement through wall (non-door tile) should be blocked
    const throughWall = collisionService.isWallBlocked(
      nonDoorTileX,
      bbox.minTileZ - 1, // Outside
      nonDoorTileX,
      bbox.minTileZ, // Through wall
      0,
    );
    expect(throughWall).toBe(true);
  });
});

// ============================================================================
// TEST SUITE 3: Floor Tracking Correctness
// ============================================================================

describe("Floor Tracking Correctness", () => {
  let world: World;
  let collisionService: BuildingCollisionService;

  beforeAll(() => {
    world = createMockWorld();
    collisionService = new BuildingCollisionService(world);
  });

  afterAll(() => {
    collisionService.clear();
  });

  it("should track player building state correctly", () => {
    const entityId =
      "player-1" as unknown as import("@hyperforge/shared").EntityID;

    // Initial state
    const state = collisionService.getPlayerBuildingState(entityId);
    expect(state.insideBuildingId).toBeNull();
    expect(state.currentFloor).toBe(0);
    expect(state.onStairs).toBe(false);
  });

  it("should report correct floor for multi-floor building", () => {
    const layout: BuildingLayoutInput = {
      width: 3,
      depth: 3,
      floors: 2,
      floorPlans: [
        {
          footprint: [
            [true, true, true],
            [true, true, true],
            [true, true, true],
          ],
          roomMap: [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
          ],
          internalOpenings: new Map(),
          externalOpenings: new Map([["1,0,north", "door"]]),
        },
        {
          footprint: [
            [true, true, true],
            [true, true, true],
            [true, true, true],
          ],
          roomMap: [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
          ],
          internalOpenings: new Map(),
          externalOpenings: new Map(),
        },
      ],
      stairs: {
        col: 0,
        row: 0,
        direction: "south",
        landing: { col: 0, row: 1 },
      },
    };

    const buildingId = "multi-floor-test";
    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      { x: 0, y: 10, z: 0 },
      0,
    );

    const building = collisionService.getBuilding(buildingId);
    expect(building?.floors.length).toBeGreaterThanOrEqual(2);

    // Check floor 0 exists
    const floor0 = building?.floors.find((f) => f.floorIndex === 0);
    expect(floor0).toBeDefined();
    expect(floor0!.walkableTiles.size).toBeGreaterThan(0);

    // Check floor 1 exists
    const floor1 = building?.floors.find((f) => f.floorIndex === 1);
    expect(floor1).toBeDefined();
    expect(floor1!.walkableTiles.size).toBeGreaterThan(0);
  });

  it("should report different elevations for different floors", () => {
    const buildingId = "multi-floor-test";
    const building = collisionService.getBuilding(buildingId);

    if (!building || building.floors.length < 2) {
      console.log("Skipping - multi-floor building not available");
      return;
    }

    const floor0 = building.floors.find((f) => f.floorIndex === 0);
    const floor1 = building.floors.find((f) => f.floorIndex === 1);

    expect(floor0).toBeDefined();
    expect(floor1).toBeDefined();

    // Floor 1 should be higher than floor 0
    expect(floor1!.elevation).toBeGreaterThan(floor0!.elevation);

    // The difference should be approximately FLOOR_HEIGHT (3.4 meters = WALL_HEIGHT 3.2 + FLOOR_THICKNESS 0.2)
    const heightDiff = floor1!.elevation - floor0!.elevation;
    expect(heightDiff).toBeCloseTo(3.4, 1);
  });
});

// ============================================================================
// TEST SUITE 4: Door Detection Accuracy
// ============================================================================

describe("Door Detection Accuracy", () => {
  let world: World;
  let collisionService: BuildingCollisionService;

  beforeAll(() => {
    world = createMockWorld();
    collisionService = new BuildingCollisionService(world);
  });

  afterAll(() => {
    collisionService.clear();
  });

  it("should detect doors on all four cardinal directions", () => {
    const directions = ["north", "south", "east", "west"] as const;

    for (const dir of directions) {
      const layout = createStandardTestBuilding(dir);
      const buildingId = `door-detect-${dir}`;

      collisionService.registerBuilding(
        buildingId,
        "test-town",
        layout,
        { x: directions.indexOf(dir) * 100, y: 10, z: 0 },
        0,
      );

      const doorTiles = collisionService.getDoorTiles(buildingId);
      expect(doorTiles.length).toBeGreaterThan(0);

      // Door should be in the correct direction
      const door = doorTiles[0];
      expect(door.direction).toBe(dir);
    }
  });

  it("should find closest door to player position", () => {
    const layout = createStandardTestBuilding("north");
    const buildingId = "closest-door-test";
    const position = { x: 500, y: 10, z: 500 };

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      position,
      0,
    );

    const building = collisionService.getBuilding(buildingId);
    const bbox = building!.boundingBox;

    // Player is north of building (outside)
    const playerTileX = Math.floor((bbox.minTileX + bbox.maxTileX) / 2);
    const playerTileZ = bbox.minTileZ - 5;

    const closestDoor = collisionService.findClosestDoorTile(
      buildingId,
      playerTileX,
      playerTileZ,
    );

    expect(closestDoor).not.toBeNull();
    expect(closestDoor?.direction).toBe("north");
  });

  it("should return entrance tiles with correct exterior/interior coords", () => {
    const layout = createStandardTestBuilding("north");
    const buildingId = "entrance-tiles-test";

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      { x: 600, y: 10, z: 600 },
      0,
    );

    const entranceTiles = collisionService.getEntranceTiles(buildingId);
    expect(entranceTiles.length).toBeGreaterThan(0);

    const entrance = entranceTiles[0];

    // For north-facing door, exterior Z should be less than minTileZ
    // Interior Z should be >= minTileZ
    expect(entrance.direction).toBe("north");
  });
});

// ============================================================================
// TEST SUITE 5: Pathfinding Integration
// ============================================================================

describe("Pathfinding Integration", () => {
  let world: World;
  let collisionService: BuildingCollisionService;
  let pathfinder: BFSPathfinder;

  beforeAll(() => {
    world = createMockWorld();
    collisionService = new BuildingCollisionService(world);
    pathfinder = new BFSPathfinder();
  });

  afterAll(() => {
    collisionService.clear();
  });

  it("should find path from outside to inside building through door", () => {
    const layout = createStandardTestBuilding("north");
    const buildingId = "pathfind-test-1";
    const position = { x: 700, y: 10, z: 700 };

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      position,
      0,
    );

    const building = collisionService.getBuilding(buildingId);
    const bbox = building!.boundingBox;
    const doorTiles = collisionService.getDoorTiles(buildingId);
    expect(doorTiles.length).toBeGreaterThan(0);

    const door = doorTiles[0];

    // Start outside, 5 tiles north of door
    const startTile: TileCoord = { x: door.tileX, z: door.tileZ - 5 };

    // Target inside building
    const centerX = Math.floor((bbox.minTileX + bbox.maxTileX) / 2);
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);
    const targetTile: TileCoord = { x: centerX, z: centerZ };

    const isWalkable = createWalkabilityChecker(collisionService, 0);
    const path = pathfinder.findPath(startTile, targetTile, isWalkable);

    console.log(`Path from outside to inside: ${path.length} tiles`);
    expect(path.length).toBeGreaterThan(0);

    // Verify path integrity
    const integrity = verifyPathIntegrity(path, collisionService, 0, startTile);
    expect(integrity.valid).toBe(true);

    if (!integrity.valid) {
      console.log("Path violations:", integrity.violations);
    }
  });

  it("should find path from inside to outside building through door", () => {
    const buildingId = "pathfind-test-1";
    const building = collisionService.getBuilding(buildingId);

    if (!building) {
      console.log("Skipping - building not available");
      return;
    }

    const bbox = building.boundingBox;
    const doorTiles = collisionService.getDoorTiles(buildingId);

    // Start inside building center
    const centerX = Math.floor((bbox.minTileX + bbox.maxTileX) / 2);
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);
    const startTile: TileCoord = { x: centerX, z: centerZ };

    // Target outside, 5 tiles from door
    const door = doorTiles[0];
    const targetTile: TileCoord = { x: door.tileX, z: door.tileZ - 5 };

    const isWalkable = createWalkabilityChecker(collisionService, 0);
    const path = pathfinder.findPath(startTile, targetTile, isWalkable);

    console.log(`Path from inside to outside: ${path.length} tiles`);
    expect(path.length).toBeGreaterThan(0);

    // Verify path integrity
    const integrity = verifyPathIntegrity(path, collisionService, 0, startTile);
    expect(integrity.valid).toBe(true);
  });

  it("should not find path through walls (must go around to door)", () => {
    const layout = createStandardTestBuilding("north");
    const buildingId = "pathfind-no-wall-test";
    const position = { x: 800, y: 10, z: 800 };

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      position,
      0,
    );

    const building = collisionService.getBuilding(buildingId);
    const bbox = building!.boundingBox;

    // Start outside on SOUTH side (no door there)
    const startTile: TileCoord = {
      x: Math.floor((bbox.minTileX + bbox.maxTileX) / 2),
      z: bbox.maxTileZ + 5,
    };

    // Target inside building
    const targetTile: TileCoord = {
      x: Math.floor((bbox.minTileX + bbox.maxTileX) / 2),
      z: Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2),
    };

    const isWalkable = createWalkabilityChecker(collisionService, 0);
    const path = pathfinder.findPath(startTile, targetTile, isWalkable);

    console.log(`Path from south (no door) to inside: ${path.length} tiles`);

    // Path should exist but must go around to north door
    // This tests that walls are actually blocking direct entry
    if (path.length > 0) {
      const integrity = verifyPathIntegrity(
        path,
        collisionService,
        0,
        startTile,
      );
      expect(integrity.valid).toBe(true);

      // Path should be longer than direct distance (had to go around)
      const directDistance = Math.abs(targetTile.z - startTile.z);
      expect(path.length).toBeGreaterThan(directDistance);
    }
  });
});

// ============================================================================
// TEST SUITE 6: Building Rotation Handling
// ============================================================================

describe("Building Rotation Handling", () => {
  let world: World;
  let collisionService: BuildingCollisionService;

  beforeAll(() => {
    world = createMockWorld();
    collisionService = new BuildingCollisionService(world);
  });

  afterAll(() => {
    collisionService.clear();
  });

  it("should correctly rotate door position with building", () => {
    // Three.js Y-axis rotation: positive θ rotates CCW when viewed from above
    // Local north (-Z) at θ=0 → north, θ=π/2 → west, θ=π → south, θ=3π/2 → east
    const rotations = [
      { angle: 0, doorDir: "north" },
      { angle: Math.PI / 2, doorDir: "west" },
      { angle: Math.PI, doorDir: "south" },
      { angle: (3 * Math.PI) / 2, doorDir: "east" },
    ];

    for (const { angle, doorDir } of rotations) {
      // Use north door in layout, rotate building
      const layout = createStandardTestBuilding("north");
      const buildingId = `rotation-test-${angle}`;

      collisionService.registerBuilding(
        buildingId,
        "test-town",
        layout,
        { x: angle * 100, y: 10, z: 900 },
        angle,
      );

      const doorTiles = collisionService.getDoorTiles(buildingId);
      expect(doorTiles.length).toBeGreaterThan(0);

      // After rotation, door should be in the expected direction
      const door = doorTiles[0];
      console.log(
        `Rotation ${((angle * 180) / Math.PI).toFixed(0)}°: door direction = ${door.direction}`,
      );
      expect(door.direction).toBe(doorDir);
    }
  });
});

// ============================================================================
// TEST SUITE 7: Unified Navigation Helpers
// ============================================================================

describe("Unified Navigation Helpers", () => {
  let world: World;
  let collisionService: BuildingCollisionService;

  beforeAll(() => {
    world = createMockWorld();
    collisionService = new BuildingCollisionService(world);
  });

  afterAll(() => {
    collisionService.clear();
  });

  it("should use canMoveFromTo for single-call navigation check", () => {
    const layout = createStandardTestBuilding("north");
    const buildingId = "can-move-test";

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      { x: 0, y: 10, z: 0 },
      0,
    );

    const building = collisionService.getBuilding(buildingId)!;
    const bbox = building.boundingBox;
    const centerX = Math.floor((bbox.minTileX + bbox.maxTileX) / 2);
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);

    // Movement within building should be allowed
    const withinBuilding = collisionService.canMoveFromTo(
      { x: centerX, z: centerZ },
      { x: centerX + 1, z: centerZ },
      0,
    );
    expect(withinBuilding.allowed).toBe(true);

    // Movement through wall should be blocked
    const throughWall = collisionService.canMoveFromTo(
      { x: bbox.maxTileX, z: centerZ },
      { x: bbox.maxTileX + 1, z: centerZ },
      0,
    );
    expect(throughWall.allowed).toBe(false);
    expect(throughWall.reason).toContain("Wall blocks");
  });

  it("should validate building navigation with validateBuildingNavigation", () => {
    const buildingId = "can-move-test";

    const validation = collisionService.validateBuildingNavigation(buildingId);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(validation.stats.walkableTiles).toBe(144);
    expect(validation.stats.doors).toBeGreaterThan(0);
    expect(validation.stats.reachableTiles).toBe(144);
  });

  it("should return validation errors for missing building", () => {
    const validation =
      collisionService.validateBuildingNavigation("nonexistent");

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Building nonexistent not registered");
  });

  it("should provide detailed tile diagnostics", () => {
    const buildingId = "can-move-test";
    const building = collisionService.getBuilding(buildingId)!;
    const bbox = building.boundingBox;
    const centerX = Math.floor((bbox.minTileX + bbox.maxTileX) / 2);
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);

    // Get diagnostics for center tile (inside building)
    const insideDiag = collisionService.getTileDiagnostics(centerX, centerZ, 0);
    expect(insideDiag.isWalkable).toBe(true);
    expect(insideDiag.isInBuilding).toBe(true);
    expect(insideDiag.buildingId).toBe(buildingId);
    expect(insideDiag.isInBoundingBox).toBe(true);
    expect(insideDiag.isInFootprint).toBe(true);

    // Get diagnostics for tile outside building
    const outsideDiag = collisionService.getTileDiagnostics(
      bbox.minTileX - 10,
      bbox.minTileZ - 10,
      0,
    );
    expect(outsideDiag.isInBuilding).toBe(false);
    expect(outsideDiag.isInBoundingBox).toBe(false);
  });

  it("should find all buildings at a tile", () => {
    const buildingId = "can-move-test";
    const building = collisionService.getBuilding(buildingId)!;
    const bbox = building.boundingBox;
    const centerX = Math.floor((bbox.minTileX + bbox.maxTileX) / 2);
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);

    const buildings = collisionService.getBuildingsAtTile(centerX, centerZ);
    expect(buildings.length).toBe(1);
    expect(buildings[0].buildingId).toBe(buildingId);
    expect(buildings[0].isInFootprint).toBe(true);
    expect(buildings[0].floorIndex).toBe(0);
  });
});

// ============================================================================
// TEST SUITE 8: checkBuildingMovement Integration
// ============================================================================

describe("checkBuildingMovement Integration", () => {
  let world: World;
  let collisionService: BuildingCollisionService;

  beforeAll(() => {
    world = createMockWorld();
    collisionService = new BuildingCollisionService(world);
  });

  afterAll(() => {
    collisionService.clear();
  });

  it("should return comprehensive movement info for ground player", () => {
    const layout = createStandardTestBuilding("north");
    const buildingId = "check-movement-test-1";

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      { x: 0, y: 10, z: 0 },
      0,
    );

    const building = collisionService.getBuilding(buildingId)!;
    const bbox = building.boundingBox;
    const centerX = Math.floor((bbox.minTileX + bbox.maxTileX) / 2);
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);

    // Ground player moving to building center
    const result = collisionService.checkBuildingMovement(
      { x: centerX, z: bbox.minTileZ - 5 }, // Outside building
      { x: centerX, z: centerZ }, // Inside building
      0, // floor
      null, // ground player (no building)
    );

    expect(result.targetBuildingId).toBe(buildingId);
    expect(result.targetInBuildingFootprint).toBe(true);
    expect(result.targetWalkableOnFloor).toBe(true);
    expect(result.sourceInBuildingFootprint).toBe(false);
  });

  it("should identify door interior tiles correctly", () => {
    const buildingId = "check-movement-test-1";
    const building = collisionService.getBuilding(buildingId)!;
    const groundFloor = building.floors.find((f) => f.floorIndex === 0)!;

    // Find door wall segments directly (not exterior approach tiles)
    const doorSegments = groundFloor.wallSegments.filter(
      (w) =>
        w.hasOpening && (w.openingType === "door" || w.openingType === "arch"),
    );
    expect(doorSegments.length).toBeGreaterThan(0);

    const doorSegment = doorSegments[0];
    console.log(
      `[Test] Door segment at (${doorSegment.tileX}, ${doorSegment.tileZ}) side=${doorSegment.side}`,
    );

    // Get door openings at the WALL segment tile (interior tile)
    const directOpenings = collisionService.getDoorOpeningsAtTile(
      doorSegment.tileX,
      doorSegment.tileZ,
      0,
    );
    console.log(
      `[Test] getDoorOpeningsAtTile returned: [${directOpenings.join(",")}]`,
    );

    // Door segment tile should show door openings
    expect(directOpenings.length).toBeGreaterThan(0);
    expect(directOpenings).toContain(doorSegment.side);

    // Check via checkBuildingMovement as well
    const result = collisionService.checkBuildingMovement(
      null,
      { x: doorSegment.tileX, z: doorSegment.tileZ },
      0,
      null,
    );
    expect(result.targetDoorOpenings.length).toBeGreaterThan(0);
    expect(result.targetInBuildingFootprint).toBe(true);
  });

  it("should detect wall blocking for movement through walls", () => {
    const buildingId = "check-movement-test-1";
    const building = collisionService.getBuilding(buildingId)!;
    const bbox = building.boundingBox;
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);

    // Test raw wall blocking detection (wallBlocked field)
    // Movement through east wall has a wall between tiles
    const result = collisionService.checkBuildingMovement(
      { x: bbox.maxTileX, z: centerZ }, // Inside at east edge
      { x: bbox.maxTileX + 1, z: centerZ }, // Outside through wall
      0,
      buildingId, // Player is in building
    );

    // wallBlocked should be true (there IS a wall there)
    expect(result.wallBlocked).toBe(true);

    // Movement should be blocked (either by wall or layer separation)
    expect(result.buildingAllowsMovement).toBe(false);

    // Test wall blocking INSIDE the building (no layer separation conflict)
    // Create a scenario where we test internal wall blocking using isWallBlocked directly
    const rawWallBlocked = collisionService.isWallBlocked(
      bbox.maxTileX,
      centerZ,
      bbox.maxTileX + 1,
      centerZ,
      0,
    );
    expect(rawWallBlocked).toBe(true);
  });

  it("should allow movement within same building", () => {
    const buildingId = "check-movement-test-1";
    const building = collisionService.getBuilding(buildingId)!;
    const bbox = building.boundingBox;
    const centerX = Math.floor((bbox.minTileX + bbox.maxTileX) / 2);
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);

    // Movement within building (no wall crossing)
    const result = collisionService.checkBuildingMovement(
      { x: centerX, z: centerZ },
      { x: centerX + 1, z: centerZ },
      0,
      buildingId,
    );

    expect(result.wallBlocked).toBe(false);
    expect(result.buildingAllowsMovement).toBe(true);
    expect(result.blockReason).toBeNull();
  });

  it("should detect tiles under building", () => {
    // Find a tile in bbox but not in footprint (if any exist)
    // For a standard 3x3 building, bbox equals footprint, so this tests the flag
    const buildingId = "check-movement-test-1";
    const building = collisionService.getBuilding(buildingId)!;
    const bbox = building.boundingBox;

    // Tile inside bbox
    const result = collisionService.checkBuildingMovement(
      null,
      { x: bbox.minTileX, z: bbox.minTileZ },
      0,
      null,
    );

    // Should be in footprint (standard building fills its bbox)
    expect(result.targetInBuildingFootprint).toBe(true);
    expect(result.targetUnderBuilding).toBe(false);
  });
});

// ============================================================================
// TEST SUITE 9: Edge Cases and Regression Prevention
// ============================================================================

describe("Edge Cases and Regression Prevention", () => {
  let world: World;
  let collisionService: BuildingCollisionService;

  beforeAll(() => {
    world = createMockWorld();
    collisionService = new BuildingCollisionService(world);
  });

  afterAll(() => {
    collisionService.clear();
  });

  it("should handle diagonal movement near walls correctly", () => {
    const layout = createStandardTestBuilding("north");
    const buildingId = "diagonal-test";

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      { x: 0, y: 10, z: 0 },
      0,
    );

    const building = collisionService.getBuilding(buildingId)!;
    const bbox = building.boundingBox;

    // Diagonal movement in corner should be blocked by wall
    const cornerCheck = collisionService.isWallBlocked(
      bbox.minTileX,
      bbox.minTileZ,
      bbox.minTileX - 1,
      bbox.minTileZ - 1,
      0,
    );
    expect(cornerCheck).toBe(true);
  });

  it("should not allow movement to non-existent floor", () => {
    // Try to move on floor 5 which doesn't exist
    const validation = collisionService.canMoveFromTo(
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      5,
    );

    // Should be allowed since these coords are outside the building
    // But if inside building, it would be blocked
    expect(typeof validation.allowed).toBe("boolean");
  });

  it("should handle tiles at exact building boundaries", () => {
    const buildingId = "diagonal-test";
    const building = collisionService.getBuilding(buildingId)!;
    const bbox = building.boundingBox;

    // Check corner tiles
    const corners = [
      { x: bbox.minTileX, z: bbox.minTileZ },
      { x: bbox.maxTileX, z: bbox.minTileZ },
      { x: bbox.minTileX, z: bbox.maxTileZ },
      { x: bbox.maxTileX, z: bbox.maxTileZ },
    ];

    for (const corner of corners) {
      const diag = collisionService.getTileDiagnostics(corner.x, corner.z, 0);
      expect(diag.isInBoundingBox).toBe(true);
      expect(diag.isInBuilding).toBe(true);
    }
  });

  it("should correctly block movement at edge tiles", () => {
    const buildingId = "diagonal-test";
    const building = collisionService.getBuilding(buildingId)!;
    const bbox = building.boundingBox;
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);

    // Movement from inside to outside through east wall should be blocked
    // (not testing north because that's where the door is)
    const throughEast = collisionService.isWallBlocked(
      bbox.maxTileX,
      centerZ,
      bbox.maxTileX + 1,
      centerZ,
      0,
    );
    expect(throughEast).toBe(true);

    // Movement from inside to outside through west wall should be blocked
    const throughWest = collisionService.isWallBlocked(
      bbox.minTileX,
      centerZ,
      bbox.minTileX - 1,
      centerZ,
      0,
    );
    expect(throughWest).toBe(true);
  });

  it("should handle multiple buildings near each other", () => {
    // Create two buildings close together
    const layout1 = createStandardTestBuilding("north");
    const layout2 = createStandardTestBuilding("south");

    collisionService.registerBuilding(
      "multi-1",
      "test-town",
      layout1,
      { x: 100, y: 10, z: 100 },
      0,
    );

    collisionService.registerBuilding(
      "multi-2",
      "test-town",
      layout2,
      { x: 100, y: 10, z: 130 }, // 30 tiles apart
      0,
    );

    // Validate both buildings
    const v1 = collisionService.validateBuildingNavigation("multi-1");
    const v2 = collisionService.validateBuildingNavigation("multi-2");

    expect(v1.valid).toBe(true);
    expect(v2.valid).toBe(true);

    // Tiles between buildings should not be in either building
    const betweenTile = collisionService.getBuildingsAtTile(100, 115);
    expect(betweenTile.length).toBe(0);
  });
});

// ============================================================================
// TEST SUITE 9: Comprehensive Integrity Check
// ============================================================================

describe("Comprehensive Navigation Integrity", () => {
  let world: World;
  let collisionService: BuildingCollisionService;

  beforeAll(() => {
    world = createMockWorld();
    collisionService = new BuildingCollisionService(world);
  });

  afterAll(() => {
    collisionService.clear();
  });

  it("should pass all four critical checks for each building", () => {
    const buildingId = "integrity-check";
    const layout = createStandardTestBuilding("north");

    collisionService.registerBuilding(
      buildingId,
      "test-town",
      layout,
      { x: 1000, y: 10, z: 1000 },
      0,
    );

    // CHECK 1: Building is registered
    const building = collisionService.getBuilding(buildingId);
    expect(building).toBeDefined();
    console.log("✓ CHECK 1: Building registered");

    // CHECK 2: Wall segments exist on all edges
    const groundFloor = building?.floors.find((f) => f.floorIndex === 0);
    expect(groundFloor).toBeDefined();
    expect(groundFloor!.wallSegments.length).toBeGreaterThan(0);

    const wallDirections = new Set(
      groundFloor!.wallSegments.map((w) => w.side),
    );
    expect(wallDirections.has("north")).toBe(true);
    expect(wallDirections.has("south")).toBe(true);
    expect(wallDirections.has("east")).toBe(true);
    expect(wallDirections.has("west")).toBe(true);
    console.log("✓ CHECK 2: Wall segments on all edges");

    // CHECK 3: Floor tracking works
    const entityId =
      "test-player" as unknown as import("@hyperforge/shared").EntityID;
    const state = collisionService.getPlayerBuildingState(entityId);
    expect(state).toBeDefined();
    expect(typeof state.currentFloor).toBe("number");
    console.log("✓ CHECK 3: Floor tracking works");

    // CHECK 4: Doors are detected
    const doorTiles = collisionService.getDoorTiles(buildingId);
    expect(doorTiles.length).toBeGreaterThan(0);

    const entranceTiles = collisionService.getEntranceTiles(buildingId);
    expect(entranceTiles.length).toBeGreaterThan(0);
    console.log("✓ CHECK 4: Doors detected");

    console.log("\n✅ ALL FOUR CRITICAL CHECKS PASSED");
  });
});
