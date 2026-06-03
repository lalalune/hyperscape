// Math utilities for movement calculations
import {
  THREE,
  BFSPathfinder,
  worldToTile,
  tileToWorld,
  BuildingCollisionService,
  EntityID,
} from "@hyperforge/shared";
import type {
  World,
  Player,
  TileCoord,
  WalkabilityChecker,
  Position3D,
} from "@hyperforge/shared";
import { Entity } from "@hyperforge/shared";
import { EventEmitter } from "events";

// Pre-allocated temp objects for hot path optimizations (avoid GC pressure)
// Each operation gets its own temp vector to allow safe chaining without overwrites
const _subtractResult = new THREE.Vector3();
const _normalizeResult = new THREE.Vector3();
const _multiplyResult = new THREE.Vector3();
const _addResult = new THREE.Vector3();
const _lerpResult = new THREE.Vector3();
const _zeroVelocity = { x: 0, y: 0, z: 0 } as const;

const MathUtils = {
  distance2D: (a: { x: number; z: number }, b: { x: number; z: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2),
  subtract: (
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
  ) => _subtractResult.set(a.x - b.x, a.y - b.y, a.z - b.z),
  normalize: (v: { x: number; y: number; z: number }) => {
    _normalizeResult.set(v.x, v.y, v.z);
    const length = _normalizeResult.length();
    return length > 0
      ? _normalizeResult.divideScalar(length)
      : _normalizeResult.set(0, 0, 0);
  },
  multiply: (v: { x: number; y: number; z: number }, scalar: number) =>
    _multiplyResult.set(v.x * scalar, v.y * scalar, v.z * scalar),
  add: (
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
  ) => _addResult.set(a.x + b.x, a.y + b.y, a.z + b.z),
  lerp: (
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
    t: number,
  ) =>
    _lerpResult.set(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t,
    ),
};

interface MovablePlayer {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  node: {
    position: Position3D;
    quaternion?: { x: number; y: number; z: number; w: number };
  };
  base?: unknown;
  isMoving?: boolean;
  targetPosition?: Position3D;
  movementPath?: Position3D[];
  velocity: Position3D;
  speed?: number;
}

export class PlayerMovementSystem extends EventEmitter {
  private world: World;
  private movingPlayers: Map<
    string,
    { target: Position3D; path?: Position3D[] }
  > = new Map();
  private lastUpdateTime: number = Date.now();
  private updateInterval: number = 50; // Network update interval in ms
  private lastNetworkUpdate: number = Date.now();

  /** Shared BFSPathfinder instance - same algorithm used by server for OSRS-accurate movement */
  private pathfinder: BFSPathfinder = new BFSPathfinder();

  constructor(world: World) {
    super();
    this.world = world;
  }

  async moveTo(playerId: string, target: Position3D): Promise<void> {
    const worldWithEntities = this.world as {
      entities?: {
        players?: Map<string, Entity>;
        player?: Entity & { id?: string };
      };
    };
    const player =
      worldWithEntities.entities?.players?.get(playerId) ||
      (playerId === worldWithEntities.entities?.player?.id
        ? worldWithEntities.entities?.player
        : null);
    if (!player) return;

    // Find path to target
    const floorIndex = this.getPlayerFloor(player);
    const path = this.findPath(
      player.node.position as Position3D,
      target,
      floorIndex,
    );
    if (!path) {
      throw new Error("No path found to target");
    }

    // Start movement
    this.startMovement(playerId, target, path);

    // Wait for movement to complete
    return new Promise((resolve) => {
      const checkComplete = () => {
        if (!this.movingPlayers.has(playerId)) {
          resolve();
        } else {
          setTimeout(checkComplete, 50);
        }
      };
      checkComplete();
    });
  }

  startMovement(
    playerId: string,
    target: Position3D,
    path?: Position3D[],
  ): void {
    const worldWithEntities = this.world as {
      entities?: {
        players?: Map<string, Entity>;
        player?: Entity & { id?: string };
      };
      network?: { send?: (event: string, data: unknown) => void };
    };
    const player =
      worldWithEntities.entities?.players?.get(playerId) ||
      (playerId === worldWithEntities.entities?.player?.id
        ? worldWithEntities.entities?.player
        : null);
    if (!player) return;

    // Calculate path if not provided
    const floorIndex = this.getPlayerFloor(player);
    const finalPath = path ||
      this.findPath(player.node.position as Position3D, target, floorIndex) || [
        target,
      ];

    // Set player moving (simulate with custom property)
    const movablePlayer = player as unknown as MovablePlayer;
    movablePlayer.isMoving = true;
    movablePlayer.targetPosition = target;
    movablePlayer.movementPath = finalPath;
    this.movingPlayers.set(playerId, { target, path: finalPath });

    // Calculate initial velocity
    this.updatePlayerVelocity(movablePlayer, finalPath[0]);

    // Broadcast movement start via network
    if (worldWithEntities.network?.send) {
      worldWithEntities.network.send("player:moved", {
        playerId,
        position: player.node.position,
        velocity: movablePlayer.velocity,
      });
    }
  }

  stopMovement(playerId: string): void {
    const worldWithEntities = this.world as {
      entities?: {
        players?: Map<string, Entity>;
        player?: Entity & { id?: string };
      };
      network?: { send?: (event: string, data: unknown) => void };
    };
    const player =
      worldWithEntities.entities?.players?.get(playerId) ||
      (playerId === worldWithEntities.entities?.player?.id
        ? worldWithEntities.entities?.player
        : null);
    if (!player) return;

    // Stop player movement (simulate)
    const movablePlayer = player as unknown as MovablePlayer;
    movablePlayer.isMoving = false;
    // Reuse pre-allocated zero velocity reference (immutable, safe to share)
    movablePlayer.velocity = _zeroVelocity as Position3D;
    this.movingPlayers.delete(playerId);

    // Broadcast stop via network - use pre-allocated zero velocity
    if (worldWithEntities.network?.send) {
      worldWithEntities.network.send("player:moved", {
        playerId,
        position: player.node.position,
        velocity: _zeroVelocity,
      });
    }
  }

  update(deltaTime: number): void {
    const now = Date.now();
    const worldWithEntities = this.world as {
      entities?: {
        players?: Map<string, Entity>;
        player?: Entity & { id?: string };
      };
    };

    // Update all moving players
    for (const [playerId, movement] of this.movingPlayers) {
      const player =
        worldWithEntities.entities?.players?.get(playerId) ||
        (playerId === worldWithEntities.entities?.player?.id
          ? worldWithEntities.entities?.player
          : null);
      if (!player) {
        this.movingPlayers.delete(playerId);
        continue;
      }

      // Update player position (simulate)
      this.updatePlayerPosition(player, deltaTime);

      // Check for collisions
      if (this.checkCollisions(player)) {
        // Handle collision - stop or slide
        this.handleCollision(player as unknown as MovablePlayer, movement);
      }

      // Check if reached target
      if (!(player as unknown as MovablePlayer).isMoving) {
        this.movingPlayers.delete(playerId);
      }
    }

    // Send network updates at intervals
    if (now - this.lastNetworkUpdate >= this.updateInterval) {
      this.sendNetworkUpdates();
      this.lastNetworkUpdate = now;
    }
  }

  /**
   * Find a path from start to end using the shared BFSPathfinder.
   *
   * Uses the same OSRS-accurate pathfinding algorithm as the server:
   * - Naive diagonal pathing first (walk diagonally toward target, then straight)
   * - Falls back to BFS if obstacles block the naive path
   *
   * @see packages/shared/src/systems/shared/movement/BFSPathfinder.ts
   */
  findPath(
    start: Position3D,
    end: Position3D,
    floorIndex: number = 0,
  ): Position3D[] | null {
    // Convert world coordinates to tile coordinates
    const startTile = worldToTile(start.x, start.z);
    const endTile = worldToTile(end.x, end.z);

    // Get building collision service
    const buildingService = this.world.getSystem(
      "buildingCollision",
    ) as unknown as BuildingCollisionService;

    // Create walkability checker that uses world collision
    const isWalkable: WalkabilityChecker = (
      tile: TileCoord,
      _fromTile?: TileCoord,
    ): boolean => {
      // Check building collision first
      if (buildingService) {
        if (
          !buildingService.isTileWalkableInBuilding(tile.x, tile.z, floorIndex)
        ) {
          return false;
        }
      }

      // Convert tile back to world position for collision check
      const worldPos = tileToWorld(tile);
      return !this.checkWorldCollision(worldPos as Position3D, floorIndex);
    };

    // Use shared BFSPathfinder (same as server uses for player movement)
    const tilePath = this.pathfinder.findPath(startTile, endTile, isWalkable);

    // No path found
    if (tilePath.length === 0) {
      return null;
    }

    // Convert tile path back to world coordinates
    const worldPath: Position3D[] = tilePath.map((tile) => {
      const worldPos = tileToWorld(tile);

      // Calculate height for this tile based on floor
      let y = start.y;
      if (buildingService) {
        const checkTile = worldToTile(worldPos.x, worldPos.z);
        const buildingId = buildingService.getBuildingAtTile(
          checkTile.x,
          checkTile.z,
        );
        if (buildingId) {
          const h = buildingService.getFloorElevation(
            checkTile.x,
            checkTile.z,
            floorIndex,
          );
          if (h !== null) y = h + 0.1;
        }
      }

      return {
        x: worldPos.x,
        y: y, // Use calculated height or preserve start Y
        z: worldPos.z,
      };
    });

    return worldPath;
  }

  private updatePlayerVelocity(
    player: MovablePlayer,
    target: Position3D,
  ): void {
    if (!player.node.position) {
      return;
    }

    const direction = MathUtils.subtract(
      target,
      player.node.position as Position3D,
    );
    const normalized = MathUtils.normalize(direction);

    if (player.speed) {
      player.velocity = MathUtils.multiply(
        normalized,
        player.speed,
      ) as Position3D;
    }
  }

  private checkCollisions(player: Entity): boolean {
    // Check ahead of player
    const movablePlayer = player as unknown as MovablePlayer;
    if (!player.node.position || !movablePlayer.velocity) {
      return false;
    }

    const floorIndex = this.getPlayerFloor(player);

    const lookAhead = MathUtils.add(
      player.node.position as Position3D,
      MathUtils.multiply(MathUtils.normalize(movablePlayer.velocity), 0.5),
    ) as Position3D;

    return this.checkWorldCollision(lookAhead, floorIndex);
  }

  private handleCollision(
    player: MovablePlayer,
    _movement: { target: Position3D; path?: Position3D[] },
  ): void {
    // Try to slide along obstacle
    const slideVelocity = this.calculateSlideVelocity(player);

    if (slideVelocity) {
      player.velocity = slideVelocity;
    } else {
      // Can't slide, stop
      this.stopMovement(player.id);
    }
  }

  // Pre-allocated perpendicular vectors for slide velocity calculation
  private readonly _perpendicular1 = { x: 0, y: 0, z: 0 };
  private readonly _perpendicular2 = { x: 0, y: 0, z: 0 };
  // Pre-allocated array to avoid allocation in calculateSlideVelocity loop
  private readonly _perps: Array<{ x: number; y: number; z: number }> = [
    this._perpendicular1,
    this._perpendicular2,
  ];

  private calculateSlideVelocity(player: MovablePlayer): Position3D | null {
    if (!player.velocity || !player.node.position || !player.speed) {
      return null;
    }

    const floorIndex = this.getPlayerFloor(player as unknown as Entity);

    // Try perpendicular directions - reuse pre-allocated objects
    const vel = player.velocity;
    this._perpendicular1.x = -(vel.z as number);
    this._perpendicular1.y = 0;
    this._perpendicular1.z = vel.x as number;

    this._perpendicular2.x = vel.z as number;
    this._perpendicular2.y = 0;
    this._perpendicular2.z = -(vel.x as number);

    // Test both directions - use pre-allocated array reference
    for (let i = 0; i < this._perps.length; i++) {
      const perp = this._perps[i];
      const testPos = MathUtils.add(
        player.node.position as Position3D,
        MathUtils.multiply(MathUtils.normalize(perp), 0.5),
      ) as Position3D;

      if (!this.checkWorldCollision(testPos, floorIndex)) {
        return MathUtils.multiply(
          MathUtils.normalize(perp),
          player.speed * 0.7,
        ) as Position3D;
      }
    }

    return null;
  }

  // Pre-allocated network update payload to avoid allocation per update
  private readonly _networkUpdatePayload: {
    playerId: string;
    position: Position3D | null;
    velocity: Position3D | null;
  } = {
    playerId: "",
    position: null,
    velocity: null,
  };

  private sendNetworkUpdates(): void {
    const worldWithNetwork = this.world as {
      entities?: {
        players?: Map<string, Entity>;
        player?: Entity & { id?: string };
      };
      network?: { send?: (event: string, data: unknown) => void };
    };

    // Send position updates for all moving players
    for (const [playerId, movement] of this.movingPlayers) {
      const player =
        worldWithNetwork.entities?.players?.get(playerId) ||
        (playerId === worldWithNetwork.entities?.player?.id
          ? worldWithNetwork.entities?.player
          : null);
      if (!player) continue;

      // Send via network - reuse pre-allocated payload object
      if (worldWithNetwork.network?.send) {
        this._networkUpdatePayload.playerId = playerId;
        this._networkUpdatePayload.position = player.node
          .position as Position3D;
        this._networkUpdatePayload.velocity = (
          player as unknown as MovablePlayer
        ).velocity;
        worldWithNetwork.network.send(
          "player:moved",
          this._networkUpdatePayload,
        );
      }
    }
  }

  // Helper methods to simulate missing World functionality
  private getPlayerFloor(player: Entity): number {
    const buildingService = this.world.getSystem("buildingCollision") as any;
    if (buildingService && (player as any).id) {
      // Use any cast to avoid lint errors with missing type definitions
      return buildingService.getPlayerFloor((player as any).id as EntityID);
    }
    return 0;
  }

  private checkWorldCollision(
    position: Position3D,
    floorIndex: number = 0,
  ): boolean {
    const buildingService = this.world.getSystem("buildingCollision") as any;
    if (buildingService) {
      // Use any cast to avoid lint errors
      // Convert Position3D to tile for check
      const tile = worldToTile(position.x, position.z);
      if (
        !buildingService.isTileWalkableInBuilding(tile.x, tile.z, floorIndex)
      ) {
        return true; // Blocked by building
      }
    }
    // Simulate basic collision detection
    // In a real implementation, this would check against world geometry
    return false;
  }

  private updatePlayerPosition(player: Entity, deltaTime: number): void {
    // Simulate player position update based on velocity
    const movablePlayer = player as unknown as MovablePlayer;
    if (movablePlayer.velocity && player.node.position) {
      const pos = player.node.position as { x: number; y: number; z: number };
      pos.x += movablePlayer.velocity.x * deltaTime;
      pos.y += movablePlayer.velocity.y * deltaTime;
      pos.z += movablePlayer.velocity.z * deltaTime;
    }
  }
}
