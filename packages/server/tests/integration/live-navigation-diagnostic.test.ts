/**
 * LIVE NAVIGATION DIAGNOSTIC TEST
 *
 * This test diagnoses WHY players might be able to walk through walls
 * by simulating the EXACT server-side validation flow.
 *
 * Key checks:
 * 1. Verify playerBuildingId tracking is accurate
 * 2. Verify path calculation uses correct layer
 * 3. Verify each step in path is individually valid
 * 4. Verify wall blocking works for EVERY wall in buildings
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { World, BFSPathfinder, tilesEqual } from "@hyperforge/shared";
import { BuildingCollisionService } from "@hyperforge/shared";
import type { TileCoord } from "@hyperforge/shared";
import type { EntityID } from "@hyperforge/shared";

const TEST_TIMEOUT = 60000;

/**
 * Simulates the server's isTileWalkable function from tile-movement.ts
 */
function createServerWalkability(
  collisionService: BuildingCollisionService,
  world: World,
  playerFloor: number,
  playerBuildingId: string | null,
) {
  return (tile: TileCoord, fromTile?: TileCoord): boolean => {
    // EXACT copy of server's isTileWalkable building check
    const buildingCheck = collisionService.checkBuildingMovement(
      fromTile ?? null,
      tile,
      playerFloor,
      playerBuildingId,
    );

    if (!buildingCheck.buildingAllowsMovement) {
      return false;
    }

    // Respect building walls
    if (buildingCheck.wallBlocked) {
      return false;
    }

    // CollisionMatrix directional walls (building + ground)
    if (
      fromTile &&
      world.collision.isBlocked(fromTile.x, fromTile.z, tile.x, tile.z)
    ) {
      return false;
    }

    // If target is inside building, allow (skip terrain for tests)
    if (buildingCheck.targetInBuildingFootprint) {
      return true;
    }

    // Ground tile - allow for this test (no terrain)
    return true;
  };
}

/**
 * Create a 2x2 cell building (8x8 tiles) with one door
 */
function createSimpleBuilding() {
  return {
    width: 2,
    depth: 2,
    floors: 1,
    floorPlans: [
      {
        footprint: [
          [true, true],
          [true, true],
        ],
        roomMap: [
          [0, 0],
          [0, 0],
        ],
        internalOpenings: new Map(),
        externalOpenings: new Map([["0,0,north", "door"]]),
      },
    ],
    stairs: null,
  };
}

describe("Live Navigation Diagnostic", () => {
  let world: World;
  let collisionService: BuildingCollisionService;
  let pathfinder: BFSPathfinder;

  const BUILDING_POS = { x: 100, y: 0, z: 100 };
  const BUILDING_ID = "diagnostic_building";
  const PLAYER_ID = "test_player" as unknown as EntityID;

  beforeAll(async () => {
    world = new World({ isServer: true, isClient: false });
    collisionService = new BuildingCollisionService(world);

    const layout = createSimpleBuilding();
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

  it("DIAGNOSTIC 1: Player state tracking accuracy", () => {
    console.log(`\n=== DIAGNOSTIC 1: Player State Tracking ===`);

    const building = collisionService.getBuilding(BUILDING_ID)!;
    const bbox = building.boundingBox;

    // Test 1: Player outside building - state should be null
    const outsideTile: TileCoord = {
      x: bbox.minTileX - 5,
      z: bbox.minTileZ - 5,
    };
    collisionService.updatePlayerBuildingState(
      PLAYER_ID,
      outsideTile.x,
      outsideTile.z,
      0,
    );
    let state = collisionService.getPlayerBuildingState(PLAYER_ID);
    console.log(
      `Outside (${outsideTile.x},${outsideTile.z}): insideBuildingId=${state.insideBuildingId}`,
    );
    expect(state.insideBuildingId).toBeNull();

    // Test 2: Player on door exterior (approach tile) - should be null
    const closestDoor = collisionService.findClosestDoorTile(
      BUILDING_ID,
      100,
      100,
    )!;
    const doorExterior: TileCoord = {
      x: closestDoor.tileX,
      z: closestDoor.tileZ,
    };
    collisionService.updatePlayerBuildingState(
      PLAYER_ID,
      doorExterior.x,
      doorExterior.z,
      0,
    );
    state = collisionService.getPlayerBuildingState(PLAYER_ID);
    console.log(
      `Door exterior (${doorExterior.x},${doorExterior.z}): insideBuildingId=${state.insideBuildingId}`,
    );
    // Door exterior may or may not be in footprint depending on layout
    // Just log the result

    // Test 3: Player on door interior - should be in building
    const doorInterior: TileCoord = {
      x: closestDoor.interiorTileX,
      z: closestDoor.interiorTileZ,
    };
    collisionService.updatePlayerBuildingState(
      PLAYER_ID,
      doorInterior.x,
      doorInterior.z,
      0,
    );
    state = collisionService.getPlayerBuildingState(PLAYER_ID);
    console.log(
      `Door interior (${doorInterior.x},${doorInterior.z}): insideBuildingId=${state.insideBuildingId}`,
    );
    expect(state.insideBuildingId).toBe(BUILDING_ID);

    // Test 4: Player in building center - should be in building
    const centerX = Math.floor((bbox.minTileX + bbox.maxTileX) / 2);
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);
    collisionService.updatePlayerBuildingState(PLAYER_ID, centerX, centerZ, 0);
    state = collisionService.getPlayerBuildingState(PLAYER_ID);
    console.log(
      `Building center (${centerX},${centerZ}): insideBuildingId=${state.insideBuildingId}`,
    );
    expect(state.insideBuildingId).toBe(BUILDING_ID);

    // Test 5: Player exits building - should be null
    collisionService.updatePlayerBuildingState(
      PLAYER_ID,
      outsideTile.x,
      outsideTile.z,
      0,
    );
    state = collisionService.getPlayerBuildingState(PLAYER_ID);
    console.log(
      `After exit (${outsideTile.x},${outsideTile.z}): insideBuildingId=${state.insideBuildingId}`,
    );
    expect(state.insideBuildingId).toBeNull();
  });

  it("DIAGNOSTIC 2: Path calculation uses correct layer", () => {
    console.log(`\n=== DIAGNOSTIC 2: Path Layer Verification ===`);

    const building = collisionService.getBuilding(BUILDING_ID)!;
    const bbox = building.boundingBox;
    const closestDoor = collisionService.findClosestDoorTile(
      BUILDING_ID,
      100,
      100,
    )!;

    const outsideTile: TileCoord = {
      x: closestDoor.tileX,
      z: closestDoor.tileZ - 10,
    };
    const doorExterior: TileCoord = {
      x: closestDoor.tileX,
      z: closestDoor.tileZ,
    };
    const doorInterior: TileCoord = {
      x: closestDoor.interiorTileX,
      z: closestDoor.interiorTileZ,
    };
    const centerX = Math.floor((bbox.minTileX + bbox.maxTileX) / 2);
    const centerZ = Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2);
    const buildingCenter: TileCoord = { x: centerX, z: centerZ };

    // Scenario 1: Ground player trying to path directly to building center
    console.log(
      `\nScenario 1: Ground player → building center (SHOULD FAIL or go around)`,
    );
    const groundWalkable = createServerWalkability(
      collisionService,
      world,
      0,
      null,
    );
    const directPath = pathfinder.findPath(
      outsideTile,
      buildingCenter,
      groundWalkable,
    );
    console.log(`  Direct path length: ${directPath.length}`);

    // Check if path goes through building without using door
    if (directPath.length > 0) {
      let enteredThroughDoor = false;
      for (let i = 0; i < directPath.length - 1; i++) {
        const current = directPath[i];
        const next = directPath[i + 1];
        const currentInFootprint =
          collisionService.isTileInBuildingFootprint(current.x, current.z) !==
          null;
        const nextInFootprint =
          collisionService.isTileInBuildingFootprint(next.x, next.z) !== null;

        if (!currentInFootprint && nextInFootprint) {
          // Entering building - check if through door
          const doorOpenings = collisionService.getDoorOpeningsAtTile(
            next.x,
            next.z,
            0,
          );
          enteredThroughDoor = doorOpenings.length > 0;
          console.log(
            `  Entry step ${i}: (${current.x},${current.z}) → (${next.x},${next.z}) | through door: ${enteredThroughDoor}`,
          );
          if (!enteredThroughDoor) {
            console.log(`  ❌ BUG: Path enters building at non-door tile!`);
          }
        }
      }
    }

    // Scenario 2: Ground player to door exterior (two-stage stage 1)
    console.log(`\nScenario 2: Ground player → door exterior`);
    const stage1Path = pathfinder.findPath(
      outsideTile,
      doorExterior,
      groundWalkable,
    );
    console.log(`  Stage 1 path length: ${stage1Path.length}`);
    expect(stage1Path.length).toBeGreaterThan(0);

    // Scenario 3: Building player from door interior to center (two-stage stage 2)
    console.log(`\nScenario 3: Building player (door interior) → center`);
    const buildingWalkable = createServerWalkability(
      collisionService,
      world,
      0,
      BUILDING_ID,
    );
    const stage2Path = pathfinder.findPath(
      doorInterior,
      buildingCenter,
      buildingWalkable,
    );
    console.log(`  Stage 2 path length: ${stage2Path.length}`);
    expect(stage2Path.length).toBeGreaterThan(0);

    // Scenario 4: Wrong layer - ground player with buildingId (BUG scenario)
    console.log(
      `\nScenario 4: WRONG LAYER - Ground player with buildingId set (BUG)`,
    );
    // This simulates a bug where playerBuildingId is stale
    const buggyWalkable = createServerWalkability(
      collisionService,
      world,
      0,
      BUILDING_ID,
    );
    // Ground player at ground tile but server thinks they're in building
    const bugPath = pathfinder.findPath(
      outsideTile,
      buildingCenter,
      buggyWalkable,
    );
    console.log(`  Buggy path length: ${bugPath.length}`);
    if (bugPath.length > 0) {
      console.log(`  ⚠️ WARNING: Stale playerBuildingId allows path!`);
      // Verify if this path goes through walls
      let wallViolations = 0;
      let enteredWithoutDoor = false;
      for (let i = 0; i < bugPath.length - 1; i++) {
        const from = bugPath[i];
        const to = bugPath[i + 1];

        // Check wall blocking
        const wallBlocked = collisionService.isWallBlocked(
          from.x,
          from.z,
          to.x,
          to.z,
          0,
        );
        if (wallBlocked) {
          wallViolations++;
          console.log(
            `    ❌ WALL VIOLATION step ${i}: (${from.x},${from.z}) → (${to.x},${to.z})`,
          );
        }

        // Check if entering building without door
        const fromInFootprint =
          collisionService.isTileInBuildingFootprint(from.x, from.z) !== null;
        const toInFootprint =
          collisionService.isTileInBuildingFootprint(to.x, to.z) !== null;
        if (!fromInFootprint && toInFootprint) {
          const doorOpenings = collisionService.getDoorOpeningsAtTile(
            to.x,
            to.z,
            0,
          );
          if (doorOpenings.length === 0) {
            enteredWithoutDoor = true;
            console.log(
              `    ❌ ENTERED WITHOUT DOOR at step ${i}: (${from.x},${from.z}) → (${to.x},${to.z})`,
            );
          } else {
            console.log(`    ✅ Entered through door at step ${i}`);
          }
        }
      }
      console.log(`  Wall violations: ${wallViolations}`);
      console.log(`  Entered without door: ${enteredWithoutDoor}`);
      if (wallViolations > 0 || enteredWithoutDoor) {
        console.log(
          `  🚨 BUG CONFIRMED: Stale playerBuildingId causes wall bypass!`,
        );
      } else {
        console.log(`  Path went around correctly (no wall bypass)`);
      }
    }
  });

  it("DIAGNOSTIC 3: Individual step validation", () => {
    console.log(`\n=== DIAGNOSTIC 3: Step-by-Step Validation ===`);

    const building = collisionService.getBuilding(BUILDING_ID)!;
    const bbox = building.boundingBox;
    const closestDoor = collisionService.findClosestDoorTile(
      BUILDING_ID,
      100,
      100,
    )!;

    const doorExterior: TileCoord = {
      x: closestDoor.tileX,
      z: closestDoor.tileZ,
    };
    const doorInterior: TileCoord = {
      x: closestDoor.interiorTileX,
      z: closestDoor.interiorTileZ,
    };

    console.log(
      `Door: exterior=(${doorExterior.x},${doorExterior.z}) interior=(${doorInterior.x},${doorInterior.z})`,
    );

    // Test: Ground player step from door exterior to door interior
    console.log(`\nStep: Door exterior → Door interior (ground player)`);
    const groundCheck = collisionService.checkBuildingMovement(
      doorExterior,
      doorInterior,
      0,
      null, // ground player
    );
    console.log(
      `  buildingAllowsMovement: ${groundCheck.buildingAllowsMovement}`,
    );
    console.log(
      `  targetDoorOpenings: [${groundCheck.targetDoorOpenings.join(", ")}]`,
    );
    console.log(`  blockReason: ${groundCheck.blockReason || "none"}`);
    expect(groundCheck.buildingAllowsMovement).toBe(true);

    // Test: Ground player step to non-door interior tile (SHOULD BE BLOCKED)
    const nonDoorInterior: TileCoord = {
      x: bbox.maxTileX,
      z: bbox.maxTileZ,
    };
    console.log(
      `\nStep: Ground → non-door interior (${nonDoorInterior.x},${nonDoorInterior.z})`,
    );
    const blockedCheck = collisionService.checkBuildingMovement(
      { x: nonDoorInterior.x, z: nonDoorInterior.z + 1 }, // from outside
      nonDoorInterior,
      0,
      null, // ground player
    );
    console.log(
      `  buildingAllowsMovement: ${blockedCheck.buildingAllowsMovement}`,
    );
    console.log(
      `  targetDoorOpenings: [${blockedCheck.targetDoorOpenings.join(", ")}]`,
    );
    console.log(`  blockReason: ${blockedCheck.blockReason || "none"}`);
    expect(blockedCheck.buildingAllowsMovement).toBe(false);

    // Test: Building player step within building
    console.log(`\nStep: Building player within building`);
    const internalCheck = collisionService.checkBuildingMovement(
      doorInterior,
      { x: doorInterior.x + 1, z: doorInterior.z },
      0,
      BUILDING_ID, // building player
    );
    console.log(
      `  buildingAllowsMovement: ${internalCheck.buildingAllowsMovement}`,
    );
    console.log(`  wallBlocked: ${internalCheck.wallBlocked}`);
    expect(internalCheck.buildingAllowsMovement).toBe(true);
  });

  it("DIAGNOSTIC 4: All walls block movement", () => {
    console.log(`\n=== DIAGNOSTIC 4: Wall Blocking Verification ===`);

    const building = collisionService.getBuilding(BUILDING_ID)!;
    const floor0 = building.floors[0];

    const solidWalls = floor0.wallSegments.filter((w) => !w.hasOpening);
    console.log(`Total solid walls: ${solidWalls.length}`);

    let wallsBlocking = 0;
    let wallsNotBlocking = 0;
    const failures: string[] = [];

    for (const wall of solidWalls) {
      // Calculate outside tile
      let outsideX = wall.tileX;
      let outsideZ = wall.tileZ;

      if (wall.side === "north") outsideZ -= 1;
      else if (wall.side === "south") outsideZ += 1;
      else if (wall.side === "east") outsideX += 1;
      else if (wall.side === "west") outsideX -= 1;

      const outsideTile: TileCoord = { x: outsideX, z: outsideZ };
      const insideTile: TileCoord = { x: wall.tileX, z: wall.tileZ };

      // Check isWallBlocked (direct wall check)
      const wallBlocked = collisionService.isWallBlocked(
        outsideTile.x,
        outsideTile.z,
        insideTile.x,
        insideTile.z,
        0,
      );

      // Check checkBuildingMovement (full validation)
      const moveCheck = collisionService.checkBuildingMovement(
        outsideTile,
        insideTile,
        0,
        null, // ground player
      );

      const isBlocked = wallBlocked || !moveCheck.buildingAllowsMovement;

      if (isBlocked) {
        wallsBlocking++;
      } else {
        wallsNotBlocking++;
        failures.push(
          `Wall at (${wall.tileX},${wall.tileZ}) side=${wall.side} NOT BLOCKING! ` +
            `isWallBlocked=${wallBlocked} checkBuildingMovement.allowed=${moveCheck.buildingAllowsMovement}`,
        );
      }
    }

    console.log(`Walls blocking: ${wallsBlocking}/${solidWalls.length}`);
    console.log(`Walls NOT blocking: ${wallsNotBlocking}`);

    if (failures.length > 0) {
      console.log(`\n=== FAILURES ===`);
      failures.forEach((f) => console.log(`  ❌ ${f}`));
    }

    expect(wallsNotBlocking).toBe(0);
  });

  it("DIAGNOSTIC 5: Simulate full player movement sequence", () => {
    console.log(`\n=== DIAGNOSTIC 5: Full Movement Simulation ===`);

    const building = collisionService.getBuilding(BUILDING_ID)!;
    const bbox = building.boundingBox;
    const closestDoor = collisionService.findClosestDoorTile(
      BUILDING_ID,
      100,
      100,
    )!;

    // Starting position outside
    let playerTile: TileCoord = {
      x: closestDoor.tileX,
      z: closestDoor.tileZ - 5,
    };
    let playerBuildingId: string | null = null;
    let playerFloor = 0;

    // Target inside building
    const targetTile: TileCoord = {
      x: Math.floor((bbox.minTileX + bbox.maxTileX) / 2),
      z: Math.floor((bbox.minTileZ + bbox.maxTileZ) / 2),
    };

    console.log(
      `Start: (${playerTile.x},${playerTile.z}) playerBuildingId=${playerBuildingId}`,
    );
    console.log(`Target: (${targetTile.x},${targetTile.z})`);

    // Simulate server's handleMoveRequest
    collisionService.updatePlayerBuildingState(
      PLAYER_ID,
      playerTile.x,
      playerTile.z,
      0,
    );
    const state = collisionService.getPlayerBuildingState(PLAYER_ID);
    playerBuildingId = state.insideBuildingId;
    playerFloor = state.currentFloor;

    console.log(`\nAfter state update: playerBuildingId=${playerBuildingId}`);

    // Stage 1: Path to door exterior
    const doorExterior: TileCoord = {
      x: closestDoor.tileX,
      z: closestDoor.tileZ,
    };
    const walkable1 = createServerWalkability(
      collisionService,
      world,
      playerFloor,
      playerBuildingId,
    );
    const path1 = pathfinder.findPath(playerTile, doorExterior, walkable1);
    console.log(`Stage 1 path: ${path1.length} tiles`);
    expect(path1.length).toBeGreaterThan(0);

    // Simulate walking to door exterior
    for (const tile of path1) {
      playerTile = tile;
    }
    console.log(`Arrived at door exterior: (${playerTile.x},${playerTile.z})`);

    // Step through door (manual append in server)
    const doorInterior: TileCoord = {
      x: closestDoor.interiorTileX,
      z: closestDoor.interiorTileZ,
    };
    playerTile = doorInterior;
    console.log(`Stepped to door interior: (${playerTile.x},${playerTile.z})`);

    // Update player state (server does this after reaching door)
    collisionService.updatePlayerBuildingState(
      PLAYER_ID,
      playerTile.x,
      playerTile.z,
      0,
    );
    const state2 = collisionService.getPlayerBuildingState(PLAYER_ID);
    playerBuildingId = state2.insideBuildingId;
    playerFloor = state2.currentFloor;
    console.log(
      `After entering building: playerBuildingId=${playerBuildingId}`,
    );
    expect(playerBuildingId).toBe(BUILDING_ID);

    // Stage 2: Path to target
    const walkable2 = createServerWalkability(
      collisionService,
      world,
      playerFloor,
      playerBuildingId,
    );
    const path2 = pathfinder.findPath(playerTile, targetTile, walkable2);
    console.log(`Stage 2 path: ${path2.length} tiles`);
    expect(path2.length).toBeGreaterThan(0);

    // Verify stage 2 path doesn't go through walls
    for (let i = 0; i < path2.length - 1; i++) {
      const from = path2[i];
      const to = path2[i + 1];
      const wallBlocked = collisionService.isWallBlocked(
        from.x,
        from.z,
        to.x,
        to.z,
        playerFloor,
      );
      if (wallBlocked) {
        console.log(
          `  ❌ Wall blocked at step ${i}: (${from.x},${from.z}) → (${to.x},${to.z})`,
        );
      }
      expect(wallBlocked).toBe(false);
    }

    console.log(`\n✅ Full movement simulation passed!`);
  });
});
