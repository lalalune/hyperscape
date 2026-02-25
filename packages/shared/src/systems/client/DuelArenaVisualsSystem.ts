/**
 * DuelArenaVisualsSystem - Procedural Duel Arena Rendering
 *
 * Creates visual geometry for the duel arena without requiring external models.
 * Uses procedural Three.js geometry to render:
 * - 6 arena floors (tan colored planes)
 * - Arena walls (brown colored boxes)
 * - Lobby floor area
 * - Hospital floor area
 *
 * This is a temporary visual system until proper building assets are created.
 *
 * Arena Layout (OSRS-style):
 * - 6 rectangular arenas in a 2x3 grid
 * - Each arena is 20m wide x 24m long
 * - 4m gap between arenas
 * - Base coordinates: x=60, z=80 (near spawn)
 */

import THREE, { MeshStandardNodeMaterial } from "../../extras/three/three";
import { System } from "../shared/infrastructure/System";
import type { World } from "../../core/World";
import type { WorldOptions } from "../../types/index";
import { getPhysX } from "../../physics/PhysXManager";
import { Layers } from "../../physics/Layers";
import type { Physics } from "../shared/interaction/Physics";
import type { PxRigidStatic } from "../../types/systems/physics";
import type { ParticleSystem } from "../shared/presentation/ParticleSystem";
import type { FlatZone } from "../../types/world/terrain";

// ============================================================================
// Arena Configuration (matches ArenaPoolManager)
// ============================================================================

const ARENA_BASE_X = 60;
const ARENA_BASE_Z = 80;
const ARENA_WIDTH = 20;
const ARENA_LENGTH = 24;
const ARENA_GAP = 4;
const ARENA_COUNT = 6;
// Fence configuration (replaces solid walls for better visibility)
const FENCE_HEIGHT = 1.5;
const FENCE_POST_RADIUS = 0.08;
const FENCE_POST_SPACING = 2.0;
const FENCE_RAIL_HEIGHT = 0.06;
const FENCE_RAIL_DEPTH = 0.06;
const FENCE_RAIL_HEIGHTS = [0.3, 0.75, 1.2]; // Heights of horizontal rails
const FLOOR_THICKNESS = 0.3; // BoxGeometry height for floors
// Floor positioning relative to PROCEDURAL terrain height:
// - heightOffset in JSON = 0.4 (where players stand above procedural terrain)
// - Floor TOP should be at procedural + 0.4 + 0.02 (2cm above terrain mesh to prevent z-fighting)
// - Floor CENTER = procedural + 0.4 + 0.02 - 0.15 = procedural + 0.27
const FLOOR_HEIGHT_OFFSET = 0.27; // Floor center position above procedural terrain

// Lobby configuration
const LOBBY_CENTER_X = 105;
const LOBBY_CENTER_Z = 62;
const LOBBY_WIDTH = 40;
const LOBBY_LENGTH = 25;

// Hospital configuration
const HOSPITAL_CENTER_X = 65;
const HOSPITAL_CENTER_Z = 62;
const HOSPITAL_WIDTH = 30;
const HOSPITAL_LENGTH = 25;

// Colors - OSRS-style tan/brown
const ARENA_FLOOR_COLOR = 0xd4a574; // Sandy tan
const ARENA_FENCE_COLOR = 0x8b7355; // Wood brown for fences
const LOBBY_FLOOR_COLOR = 0xc9b896; // Lighter tan for lobby
const HOSPITAL_FLOOR_COLOR = 0xffffff; // White hospital floor

// Arena tile texture configuration
const TILE_TEXTURE_SIZE = 512;
const TILE_GRID = 4; // 4x4 tiles per texture
const TILE_GROUT_WIDTH = 4; // pixels
const TILE_TEXTURE_WORLD_SIZE = 8; // meters the texture covers before repeating

// Torch configuration
const TORCH_POST_HEIGHT = 1.2;
const TORCH_POST_RADIUS = 0.06;
const TORCH_BRAZIER_RADIUS = 0.12;
const TORCH_LIGHT_INTENSITY = 0.8;
const TORCH_LIGHT_RANGE = 6;
const TORCH_LIGHT_COLOR = 0xff6600;

// Forfeit pillar configuration
const FORFEIT_PILLAR_RADIUS = 0.4;
const FORFEIT_PILLAR_HEIGHT = 1.2;
const FORFEIT_PILLAR_COLOR = 0x8b4513; // Saddle brown (wooden trapdoor look)
const FORFEIT_PILLAR_EMISSIVE = 0x4a2510;

// ============================================================================
// DuelArenaVisualsSystem
// ============================================================================

export class DuelArenaVisualsSystem extends System {
  name = "duel-arena-visuals";

  /** Container for all arena geometry */
  private arenaGroup: THREE.Group | null = null;

  /** Materials (cached for cleanup) */
  private materials: THREE.Material[] = [];

  /** Geometries (cached for cleanup) */
  private geometries: THREE.BufferGeometry[] = [];

  /** Textures (cached for cleanup) */
  private textures: THREE.Texture[] = [];

  /** Track if visuals have been created */
  private visualsCreated = false;

  /** Reference to terrain system for height queries */
  private terrainSystem: {
    getHeightAt?: (x: number, z: number) => number;
    getProceduralHeightAt?: (x: number, z: number) => number;
    registerFlatZone?: (zone: FlatZone) => void;
    unregisterFlatZone?: (id: string) => void;
  } | null = null;

  /** Flat zone IDs registered with the terrain system */
  private flatZoneIds: string[] = [];

  /** Reference to physics system for collision bodies */
  private physicsSystem: Physics | null = null;

  /** Physics bodies for cleanup */
  private physicsBodies: PxRigidStatic[] = [];

  /** Torch PointLights for flicker animation + cleanup */
  private torchLights: THREE.PointLight[] = [];

  /** Torch particle emitter IDs for cleanup */
  private torchEmitterIds: string[] = [];

  /** Animation time accumulator for torch flicker */
  private animTime = 0;

  constructor(world: World) {
    super(world);
  }

  /**
   * Readiness hook used by spectator loading flow to avoid showing
   * duel contestants before arena floors are spawned.
   */
  isReady(): boolean {
    return this.visualsCreated;
  }

  /**
   * Get terrain height at world position (includes flat zone adjustments)
   */
  private getTerrainHeight(x: number, z: number): number {
    if (this.terrainSystem?.getHeightAt) {
      try {
        const height = this.terrainSystem.getHeightAt(x, z);
        return height ?? 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  /**
   * Get PROCEDURAL terrain height (bypasses flat zones).
   * Used to position floors above the actual terrain mesh.
   */
  private getProceduralTerrainHeight(x: number, z: number): number {
    if (this.terrainSystem?.getProceduralHeightAt) {
      try {
        const height = this.terrainSystem.getProceduralHeightAt(x, z);
        return height ?? 0;
      } catch {
        return 0;
      }
    }
    // Fallback to regular terrain height
    return this.getTerrainHeight(x, z);
  }

  async init(options?: WorldOptions): Promise<void> {
    await super.init(options as WorldOptions);
    console.log(
      "[DuelArenaVisualsSystem] init() called, isClient:",
      this.world.isClient,
    );
  }

  /**
   * Called after all systems are initialized and world is ready
   */
  start(): void {
    // Get terrain system for height queries
    this.terrainSystem = this.world.getSystem("terrain") as {
      getHeightAt?: (x: number, z: number) => number;
      getProceduralHeightAt?: (x: number, z: number) => number;
      registerFlatZone?: (zone: FlatZone) => void;
      unregisterFlatZone?: (id: string) => void;
    } | null;

    if (!this.terrainSystem?.getHeightAt) {
      console.warn(
        "[DuelArenaVisualsSystem] TerrainSystem not available, using fallback heights",
      );
    }

    // Get physics system for collision bodies
    this.physicsSystem = this.world.getSystem("physics") as Physics | null;
    if (!this.physicsSystem) {
      console.warn(
        "[DuelArenaVisualsSystem] Physics system not available, floors will have no collision",
      );
    }

    // Register flat zones so terrain height queries return floor-level values
    // (prevents players sinking into floors and grass growing through them)
    this.registerArenaFlatZones();

    console.log(
      "[DuelArenaVisualsSystem] start() called, creating arena visuals...",
    );
    this.createArenaVisuals();
  }

  /**
   * Register flat zones with the terrain system for all duel arena floors.
   * This ensures getHeightAt() returns the floor-level height so players
   * stand ON the floors (not sinking through) and terrain mesh is flattened
   * to prevent grass from growing through floor surfaces.
   */
  private registerArenaFlatZones(): void {
    if (!this.terrainSystem?.registerFlatZone) {
      console.warn(
        "[DuelArenaVisualsSystem] TerrainSystem.registerFlatZone not available, skipping flat zone registration",
      );
      return;
    }

    const FLAT_ZONE_HEIGHT_OFFSET = 0.4; // Where players stand above procedural terrain
    const BLEND_RADIUS = 1.0;
    const CARVE_INSET = 1.0;

    // Register flat zones for all 6 arenas
    for (let i = 0; i < ARENA_COUNT; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const centerX =
        ARENA_BASE_X + col * (ARENA_WIDTH + ARENA_GAP) + ARENA_WIDTH / 2;
      const centerZ =
        ARENA_BASE_Z + row * (ARENA_LENGTH + ARENA_GAP) + ARENA_LENGTH / 2;

      const proceduralHeight = this.getProceduralTerrainHeight(
        centerX,
        centerZ,
      );
      const zoneId = `duel_arena_floor_${i + 1}`;

      const zone: FlatZone = {
        id: zoneId,
        centerX,
        centerZ,
        width: ARENA_WIDTH,
        depth: ARENA_LENGTH,
        height: proceduralHeight + FLAT_ZONE_HEIGHT_OFFSET,
        blendRadius: BLEND_RADIUS,
        carveInset: CARVE_INSET,
      };

      this.terrainSystem.registerFlatZone(zone);
      this.flatZoneIds.push(zoneId);
    }

    // Register flat zone for lobby
    {
      const proceduralHeight = this.getProceduralTerrainHeight(
        LOBBY_CENTER_X,
        LOBBY_CENTER_Z,
      );
      const zoneId = "duel_lobby_floor";

      const zone: FlatZone = {
        id: zoneId,
        centerX: LOBBY_CENTER_X,
        centerZ: LOBBY_CENTER_Z,
        width: LOBBY_WIDTH,
        depth: LOBBY_LENGTH,
        height: proceduralHeight + FLAT_ZONE_HEIGHT_OFFSET,
        blendRadius: BLEND_RADIUS,
        carveInset: CARVE_INSET,
      };

      this.terrainSystem.registerFlatZone(zone);
      this.flatZoneIds.push(zoneId);
    }

    // Register flat zone for hospital
    {
      const proceduralHeight = this.getProceduralTerrainHeight(
        HOSPITAL_CENTER_X,
        HOSPITAL_CENTER_Z,
      );
      const zoneId = "duel_hospital_floor";

      const zone: FlatZone = {
        id: zoneId,
        centerX: HOSPITAL_CENTER_X,
        centerZ: HOSPITAL_CENTER_Z,
        width: HOSPITAL_WIDTH,
        depth: HOSPITAL_LENGTH,
        height: proceduralHeight + FLAT_ZONE_HEIGHT_OFFSET,
        blendRadius: BLEND_RADIUS,
        carveInset: CARVE_INSET,
      };

      this.terrainSystem.registerFlatZone(zone);
      this.flatZoneIds.push(zoneId);
    }

    console.log(
      `[DuelArenaVisualsSystem] Registered ${this.flatZoneIds.length} flat zones (${ARENA_COUNT} arenas + lobby + hospital)`,
    );
  }

  /**
   * Create all arena visual geometry
   */
  private createArenaVisuals(): void {
    if (this.visualsCreated) {
      console.log("[DuelArenaVisualsSystem] Visuals already created, skipping");
      return;
    }

    if (this.world.isClient) {
      this.arenaGroup = new THREE.Group();
      this.arenaGroup.name = "DuelArenaVisuals";
    }

    // Create lobby floor
    this.createLobbyFloor();

    // Create hospital floor
    this.createHospitalFloor();

    // Create 6 arena floors, walls, and forfeit pillars
    for (let i = 0; i < ARENA_COUNT; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;

      const centerX =
        ARENA_BASE_X + col * (ARENA_WIDTH + ARENA_GAP) + ARENA_WIDTH / 2;
      const centerZ =
        ARENA_BASE_Z + row * (ARENA_LENGTH + ARENA_GAP) + ARENA_LENGTH / 2;

      this.createArenaFloor(centerX, centerZ, i + 1);
      this.createArenaWalls(centerX, centerZ);
      this.createForfeitPillars(centerX, centerZ, i + 1);
      this.createCornerTorches(centerX, centerZ, i + 1);
    }

    // Add to scene (client-only)
    if (this.world.isClient) {
      if (this.world.stage?.scene) {
        this.world.stage.scene.add(this.arenaGroup!);
        this.visualsCreated = true;
        console.log(
          `[DuelArenaVisualsSystem] ✅ Added arena visuals to scene at x=${ARENA_BASE_X}, z=${ARENA_BASE_Z}`,
        );
        console.log(
          `[DuelArenaVisualsSystem] Created ${ARENA_COUNT} arenas, lobby at (${LOBBY_CENTER_X}, ${LOBBY_CENTER_Z}), hospital at (${HOSPITAL_CENTER_X}, ${HOSPITAL_CENTER_Z})`,
        );
        console.log(
          `[DuelArenaVisualsSystem] Total meshes in group: ${this.arenaGroup!.children.length}, geometries: ${this.geometries.length}, materials: ${this.materials.length}`,
        );

        // Register duel areas with grass exclusion manager
        this.registerGrassExclusions();
      } else {
        console.warn(
          "[DuelArenaVisualsSystem] ⚠️ No stage/scene available, cannot add arena visuals",
        );
      }
    } else {
      // On server, visuals are considered "created" once physics are set up
      this.visualsCreated = true;
    }
  }

  /**
   * Register all duel arena areas with the grass exclusion manager
   * to prevent grass from growing through arena floors
   */
  private async registerGrassExclusions(): Promise<void> {
    try {
      const { getGrassExclusionManager } =
        await import("../../systems/shared/world/GrassExclusionManager");
      const exclusionManager = getGrassExclusionManager();

      if (!exclusionManager) {
        console.warn(
          "[DuelArenaVisualsSystem] GrassExclusionManager not available",
        );
        return;
      }

      const margin = 1.0; // Extra margin around floors

      // Register each arena floor
      for (let i = 0; i < ARENA_COUNT; i++) {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const centerX =
          ARENA_BASE_X + col * (ARENA_WIDTH + ARENA_GAP) + ARENA_WIDTH / 2;
        const centerZ =
          ARENA_BASE_Z + row * (ARENA_LENGTH + ARENA_GAP) + ARENA_LENGTH / 2;

        exclusionManager.addRectangularBlocker(
          `duel_arena_${i + 1}`,
          centerX,
          centerZ,
          ARENA_WIDTH + margin * 2,
          ARENA_LENGTH + margin * 2,
          0, // No rotation
          0.5, // Soft fade at edges
        );
      }

      // Register lobby floor
      exclusionManager.addRectangularBlocker(
        "duel_lobby",
        LOBBY_CENTER_X,
        LOBBY_CENTER_Z,
        LOBBY_WIDTH + margin * 2,
        LOBBY_LENGTH + margin * 2,
        0,
        0.5,
      );

      // Register hospital floor
      exclusionManager.addRectangularBlocker(
        "duel_hospital",
        HOSPITAL_CENTER_X,
        HOSPITAL_CENTER_Z,
        HOSPITAL_WIDTH + margin * 2,
        HOSPITAL_LENGTH + margin * 2,
        0,
        0.5,
      );

      console.log(
        `[DuelArenaVisualsSystem] ✅ Registered ${ARENA_COUNT + 2} grass exclusion zones (arenas + lobby + hospital)`,
      );
    } catch (error) {
      console.warn(
        "[DuelArenaVisualsSystem] Failed to register grass exclusions:",
        error,
      );
    }
  }

  /**
   * Generate a procedural stone tile texture on a canvas.
   * Returns a CanvasTexture with RepeatWrapping for tiling across the floor.
   */
  private generateArenaTileTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = TILE_TEXTURE_SIZE;
    canvas.height = TILE_TEXTURE_SIZE;
    const ctx = canvas.getContext("2d")!;

    const tileSize = TILE_TEXTURE_SIZE / TILE_GRID;

    // Fill background with dark grout color
    ctx.fillStyle = "#6b5a3e";
    ctx.fillRect(0, 0, TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE);

    // Draw each tile with randomized sandstone color
    for (let row = 0; row < TILE_GRID; row++) {
      for (let col = 0; col < TILE_GRID; col++) {
        const x = col * tileSize + TILE_GROUT_WIDTH / 2;
        const y = row * tileSize + TILE_GROUT_WIDTH / 2;
        const w = tileSize - TILE_GROUT_WIDTH;
        const h = tileSize - TILE_GROUT_WIDTH;

        // Randomize base stone color (warm sandstone range)
        const rBase = 190 + Math.floor(Math.random() * 30); // 190-220
        const gBase = 150 + Math.floor(Math.random() * 25); // 150-175
        const bBase = 100 + Math.floor(Math.random() * 25); // 100-125
        ctx.fillStyle = `rgb(${rBase},${gBase},${bBase})`;
        ctx.fillRect(x, y, w, h);

        // Add subtle speckle noise for stone texture
        for (let s = 0; s < 80; s++) {
          const sx = x + Math.random() * w;
          const sy = y + Math.random() * h;
          const brightness = Math.random() * 40 - 20; // -20 to +20
          const r = Math.min(255, Math.max(0, rBase + brightness));
          const g = Math.min(255, Math.max(0, gBase + brightness));
          const b = Math.min(255, Math.max(0, bBase + brightness));
          ctx.fillStyle = `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},0.4)`;
          ctx.fillRect(sx, sy, 2 + Math.random() * 3, 2 + Math.random() * 3);
        }

        // Subtle edge darkening (worn stone effect)
        ctx.strokeStyle = "rgba(0,0,0,0.08)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    this.textures.push(texture);
    return texture;
  }

  /**
   * Create a single arena floor - snapped to terrain height
   */
  private createArenaFloor(
    centerX: number,
    centerZ: number,
    arenaId: number,
  ): void {
    // Get PROCEDURAL terrain height (not flat zone height) to position floor above actual terrain mesh
    const terrainY = this.getProceduralTerrainHeight(centerX, centerZ);
    const floorY = terrainY + FLOOR_HEIGHT_OFFSET;

    const floorWidth = ARENA_WIDTH - 1;
    const floorLength = ARENA_LENGTH - 1;

    if (this.world.isClient) {
      const geometry = new THREE.BoxGeometry(
        floorWidth,
        FLOOR_THICKNESS,
        floorLength,
      );

      const tileTexture = this.generateArenaTileTexture();
      tileTexture.repeat.set(
        floorWidth / TILE_TEXTURE_WORLD_SIZE,
        floorLength / TILE_TEXTURE_WORLD_SIZE,
      );

      const material = new MeshStandardNodeMaterial({
        color: ARENA_FLOOR_COLOR,
        map: tileTexture,
        emissive: ARENA_FLOOR_COLOR,
        emissiveIntensity: 0.15,
      });

      const floor = new THREE.Mesh(geometry, material);
      floor.position.set(centerX, floorY, centerZ);
      floor.name = `ArenaFloor_${arenaId}`;

      // Set layer 2 for click-to-move raycasting (walkable surface)
      floor.layers.set(2);
      floor.userData = {
        type: "arena-floor",
        walkable: true,
        arenaId,
      };

      console.log(
        `[DuelArenaVisualsSystem] Created floor ${arenaId} at (${centerX}, ${floorY.toFixed(1)}, ${centerZ}) - terrain=${terrainY.toFixed(1)}`,
      );

      this.geometries.push(geometry);
      this.materials.push(material);
      this.arenaGroup!.add(floor);
    }

    // Create physics collision body for the floor
    this.createFloorCollision(
      centerX,
      floorY,
      centerZ,
      floorWidth,
      floorLength,
      `arena_floor_${arenaId}`,
    );
  }

  /**
   * Create fence boundaries around a single arena - snapped to terrain height.
   * Fences use vertical posts + horizontal rails for visibility.
   */
  private createArenaWalls(centerX: number, centerZ: number): void {
    const terrainY = this.getTerrainHeight(centerX, centerZ);

    let fenceMaterial: THREE.Material | null = null;
    if (this.world.isClient) {
      fenceMaterial = new MeshStandardNodeMaterial({
        color: ARENA_FENCE_COLOR,
        roughness: 0.9,
      });
      this.materials.push(fenceMaterial);
    }

    const halfW = ARENA_WIDTH / 2;
    const halfL = ARENA_LENGTH / 2;

    // North fence (runs along X axis)
    this.createFence(
      centerX - halfW,
      centerZ - halfL,
      ARENA_WIDTH,
      "x",
      fenceMaterial,
      terrainY,
    );
    // South fence
    this.createFence(
      centerX - halfW,
      centerZ + halfL,
      ARENA_WIDTH,
      "x",
      fenceMaterial,
      terrainY,
    );
    // West fence (runs along Z axis)
    this.createFence(
      centerX - halfW,
      centerZ - halfL,
      ARENA_LENGTH,
      "z",
      fenceMaterial,
      terrainY,
    );
    // East fence
    this.createFence(
      centerX + halfW,
      centerZ - halfL,
      ARENA_LENGTH,
      "z",
      fenceMaterial,
      terrainY,
    );
  }

  /**
   * Create a fence segment: posts at regular intervals with horizontal rails.
   * @param startX - X position of the fence start
   * @param startZ - Z position of the fence start
   * @param length - Total length of the fence segment
   * @param axis - "x" for east-west fences, "z" for north-south fences
   */
  private createFence(
    startX: number,
    startZ: number,
    length: number,
    axis: "x" | "z",
    material: THREE.Material | null,
    terrainY: number,
  ): void {
    if (!this.world.isClient || !material) return;

    const postCount = Math.max(2, Math.floor(length / FENCE_POST_SPACING) + 1);
    const actualSpacing = length / (postCount - 1);

    // Shared geometries for this fence
    const postGeom = new THREE.CylinderGeometry(
      FENCE_POST_RADIUS,
      FENCE_POST_RADIUS,
      FENCE_HEIGHT,
      6,
    );
    this.geometries.push(postGeom);

    // Create posts
    for (let i = 0; i < postCount; i++) {
      const offset = i * actualSpacing;
      const px = axis === "x" ? startX + offset : startX;
      const pz = axis === "z" ? startZ + offset : startZ;

      const post = new THREE.Mesh(postGeom, material);
      post.position.set(px, terrainY + FENCE_HEIGHT / 2, pz);
      post.castShadow = true;
      post.receiveShadow = true;
      post.layers.set(1);
      post.userData = { type: "arena-fence", walkable: false };
      this.arenaGroup!.add(post);
    }

    // Create horizontal rails between posts
    const railLength = length;
    for (const railY of FENCE_RAIL_HEIGHTS) {
      const railGeom = new THREE.BoxGeometry(
        axis === "x" ? railLength : FENCE_RAIL_DEPTH,
        FENCE_RAIL_HEIGHT,
        axis === "z" ? railLength : FENCE_RAIL_DEPTH,
      );
      this.geometries.push(railGeom);

      const rail = new THREE.Mesh(railGeom, material);
      const railCenterX = axis === "x" ? startX + length / 2 : startX;
      const railCenterZ = axis === "z" ? startZ + length / 2 : startZ;
      rail.position.set(railCenterX, terrainY + railY, railCenterZ);
      rail.castShadow = true;
      rail.receiveShadow = true;
      rail.layers.set(1);
      rail.userData = { type: "arena-fence", walkable: false };
      this.arenaGroup!.add(rail);
    }
  }

  /**
   * Create the lobby floor - positioned above procedural terrain
   */
  private createLobbyFloor(): void {
    const terrainY = this.getProceduralTerrainHeight(
      LOBBY_CENTER_X,
      LOBBY_CENTER_Z,
    );
    const floorY = terrainY + FLOOR_HEIGHT_OFFSET;

    if (this.world.isClient) {
      const geometry = new THREE.BoxGeometry(
        LOBBY_WIDTH,
        FLOOR_THICKNESS,
        LOBBY_LENGTH,
      );

      const material = new MeshStandardNodeMaterial({
        color: LOBBY_FLOOR_COLOR,
        emissive: LOBBY_FLOOR_COLOR,
        emissiveIntensity: 0.3,
      });

      const floor = new THREE.Mesh(geometry, material);
      floor.position.set(LOBBY_CENTER_X, floorY, LOBBY_CENTER_Z);
      floor.name = "LobbyFloor";

      // Set layer 2 for click-to-move raycasting (walkable surface)
      floor.layers.set(2);
      floor.userData = {
        type: "lobby-floor",
        walkable: true,
      };

      console.log(
        `[DuelArenaVisualsSystem] Created lobby floor at (${LOBBY_CENTER_X}, ${floorY.toFixed(1)}, ${LOBBY_CENTER_Z}) - terrain=${terrainY.toFixed(1)}`,
      );

      this.geometries.push(geometry);
      this.materials.push(material);
      this.arenaGroup!.add(floor);
    }

    // Create physics collision body
    this.createFloorCollision(
      LOBBY_CENTER_X,
      floorY,
      LOBBY_CENTER_Z,
      LOBBY_WIDTH,
      LOBBY_LENGTH,
      "lobby_floor",
    );
  }

  /**
   * Create the hospital floor - positioned above procedural terrain
   */
  private createHospitalFloor(): void {
    const terrainY = this.getProceduralTerrainHeight(
      HOSPITAL_CENTER_X,
      HOSPITAL_CENTER_Z,
    );
    const floorY = terrainY + FLOOR_HEIGHT_OFFSET;

    if (this.world.isClient) {
      const geometry = new THREE.BoxGeometry(
        HOSPITAL_WIDTH,
        FLOOR_THICKNESS,
        HOSPITAL_LENGTH,
      );

      const material = new MeshStandardNodeMaterial({
        color: HOSPITAL_FLOOR_COLOR,
        emissive: HOSPITAL_FLOOR_COLOR,
        emissiveIntensity: 0.3,
      });

      const floor = new THREE.Mesh(geometry, material);
      floor.position.set(HOSPITAL_CENTER_X, floorY, HOSPITAL_CENTER_Z);
      floor.name = "HospitalFloor";

      // Set layer 2 for click-to-move raycasting (walkable surface)
      floor.layers.set(2);
      floor.userData = {
        type: "hospital-floor",
        walkable: true,
      };

      console.log(
        `[DuelArenaVisualsSystem] Created hospital floor at (${HOSPITAL_CENTER_X}, ${floorY.toFixed(1)}, ${HOSPITAL_CENTER_Z}) - terrain=${terrainY.toFixed(1)}`,
      );

      // Add a red cross marker
      this.createHospitalCross(HOSPITAL_CENTER_X, HOSPITAL_CENTER_Z, floorY);

      this.geometries.push(geometry);
      this.materials.push(material);
      this.arenaGroup!.add(floor);
    }

    // Create physics collision body
    this.createFloorCollision(
      HOSPITAL_CENTER_X,
      floorY,
      HOSPITAL_CENTER_Z,
      HOSPITAL_WIDTH,
      HOSPITAL_LENGTH,
      "hospital_floor",
    );
  }

  /**
   * Create a red cross on the hospital floor
   */
  private createHospitalCross(x: number, z: number, floorY: number): void {
    const crossMaterial = new MeshStandardNodeMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide,
    });
    this.materials.push(crossMaterial);

    // Vertical bar of cross
    const vertGeom = new THREE.PlaneGeometry(2, 8);
    vertGeom.rotateX(-Math.PI / 2);
    const vertBar = new THREE.Mesh(vertGeom, crossMaterial);
    vertBar.position.set(x, floorY + 0.2, z);
    this.geometries.push(vertGeom);
    this.arenaGroup!.add(vertBar);

    // Horizontal bar of cross
    const horizGeom = new THREE.PlaneGeometry(8, 2);
    horizGeom.rotateX(-Math.PI / 2);
    const horizBar = new THREE.Mesh(horizGeom, crossMaterial);
    horizBar.position.set(x, floorY + 0.2, z);
    this.geometries.push(horizGeom);
    this.arenaGroup!.add(horizBar);
  }

  /**
   * Create forfeit pillars (trapdoors) in opposite corners of an arena.
   * Players can click these during an active duel to surrender.
   */
  private createForfeitPillars(
    centerX: number,
    centerZ: number,
    arenaId: number,
  ): void {
    // Get terrain height at arena center
    const terrainY = this.getTerrainHeight(centerX, centerZ);

    // Place pillars in opposite corners (SW and NE)
    // This ensures both players have access to a nearby forfeit option
    const cornerOffset = {
      x: ARENA_WIDTH / 2 - 2, // 2 units from wall
      z: ARENA_LENGTH / 2 - 2,
    };

    // Southwest corner pillar
    this.createForfeitPillar(
      centerX - cornerOffset.x,
      terrainY,
      centerZ + cornerOffset.z,
      `forfeit_pillar_${arenaId}_sw`,
    );

    // Northeast corner pillar
    this.createForfeitPillar(
      centerX + cornerOffset.x,
      terrainY,
      centerZ - cornerOffset.z,
      `forfeit_pillar_${arenaId}_ne`,
    );
  }

  /**
   * Create a single forfeit pillar (trapdoor visual)
   * Uses a cylinder with proper userData for raycasting
   */
  private createForfeitPillar(
    x: number,
    terrainY: number,
    z: number,
    entityId: string,
  ): void {
    if (this.world.isClient) {
      // Create cylinder geometry for the pillar
      const geometry = new THREE.CylinderGeometry(
        FORFEIT_PILLAR_RADIUS,
        FORFEIT_PILLAR_RADIUS,
        FORFEIT_PILLAR_HEIGHT,
        8, // radial segments
      );

      const material = new MeshStandardNodeMaterial({
        color: FORFEIT_PILLAR_COLOR,
        emissive: FORFEIT_PILLAR_EMISSIVE,
        emissiveIntensity: 0.2,
        roughness: 0.8,
      });

      const pillar = new THREE.Mesh(geometry, material);
      // Position pillar so bottom is at terrain level
      pillar.position.set(x, terrainY + FORFEIT_PILLAR_HEIGHT / 2, z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      pillar.name = entityId;

      // CRITICAL: Set userData for raycast detection
      // This enables the interaction system to identify and route clicks
      pillar.userData = {
        entityId,
        type: "forfeit_pillar",
        name: "Trapdoor",
      };

      // Enable layer 1 for raycasting (entities are on layer 1)
      pillar.layers.enable(1);

      this.geometries.push(geometry);
      this.materials.push(material);
      this.arenaGroup!.add(pillar);

      console.log(
        `[DuelArenaVisualsSystem] Created forfeit pillar ${entityId} at (${x.toFixed(1)}, ${(terrainY + FORFEIT_PILLAR_HEIGHT / 2).toFixed(1)}, ${z.toFixed(1)})`,
      );
    }
  }

  /**
   * Create lit torches at the 4 fence corners of an arena.
   * Each torch: wooden post + brazier cap + PointLight + "torch" particle emitter.
   */
  private createCornerTorches(
    centerX: number,
    centerZ: number,
    arenaIndex: number,
  ): void {
    if (!this.world.isClient) return;

    const terrainY = this.getTerrainHeight(centerX, centerZ);
    const halfW = ARENA_WIDTH / 2;
    const halfL = ARENA_LENGTH / 2;

    const corners = [
      { x: centerX - halfW, z: centerZ - halfL, label: "nw" },
      { x: centerX + halfW, z: centerZ - halfL, label: "ne" },
      { x: centerX - halfW, z: centerZ + halfL, label: "sw" },
      { x: centerX + halfW, z: centerZ + halfL, label: "se" },
    ];

    // Reuse fence material color for torch posts
    const postMaterial = new MeshStandardNodeMaterial({
      color: ARENA_FENCE_COLOR,
      roughness: 0.9,
    });
    this.materials.push(postMaterial);

    const brazierMaterial = new MeshStandardNodeMaterial({
      color: 0x555555,
      roughness: 0.7,
      emissive: 0xff4400,
      emissiveIntensity: 0.3,
    });
    this.materials.push(brazierMaterial);

    const postGeom = new THREE.CylinderGeometry(
      TORCH_POST_RADIUS,
      TORCH_POST_RADIUS,
      TORCH_POST_HEIGHT,
      6,
    );
    this.geometries.push(postGeom);

    const brazierGeom = new THREE.CylinderGeometry(
      TORCH_BRAZIER_RADIUS * 0.6,
      TORCH_BRAZIER_RADIUS,
      0.1,
      6,
    );
    this.geometries.push(brazierGeom);

    const particleSystem = this.world.getSystem("particle") as
      | ParticleSystem
      | undefined;

    for (const corner of corners) {
      const torchTopY = terrainY + TORCH_POST_HEIGHT;

      // Torch post
      const post = new THREE.Mesh(postGeom, postMaterial);
      post.position.set(corner.x, terrainY + TORCH_POST_HEIGHT / 2, corner.z);
      post.castShadow = true;
      post.layers.set(1);
      this.arenaGroup!.add(post);

      // Brazier cap
      const brazier = new THREE.Mesh(brazierGeom, brazierMaterial);
      brazier.position.set(corner.x, torchTopY, corner.z);
      brazier.layers.set(1);
      this.arenaGroup!.add(brazier);

      // PointLight for warm glow
      const light = new THREE.PointLight(
        TORCH_LIGHT_COLOR,
        TORCH_LIGHT_INTENSITY,
        TORCH_LIGHT_RANGE,
      );
      light.position.set(corner.x, torchTopY + 0.15, corner.z);
      this.arenaGroup!.add(light);
      this.torchLights.push(light);

      // Register torch particle emitter
      if (particleSystem) {
        const emitterId = `torch_arena${arenaIndex}_${corner.label}`;
        particleSystem.register(emitterId, {
          type: "glow",
          preset: "torch",
          position: { x: corner.x, y: torchTopY + 0.12, z: corner.z },
        });
        this.torchEmitterIds.push(emitterId);
      }
    }
  }

  /**
   * Create a physics collision body for a floor
   */
  private createFloorCollision(
    centerX: number,
    centerY: number,
    centerZ: number,
    width: number,
    length: number,
    tag: string,
  ): void {
    const PHYSX = getPhysX();
    if (!PHYSX || !this.physicsSystem) {
      return;
    }

    // Access physics system internals (typed as unknown to avoid strict type checking)
    const physicsInternal = this.physicsSystem as unknown as {
      physics?: unknown;
      scene?: unknown;
    };

    const physxCore = physicsInternal.physics as
      | {
          createMaterial: (sf: number, df: number, r: number) => unknown;
          createShape: (
            g: unknown,
            m: unknown,
            exclusive: boolean,
            flags: unknown,
          ) => unknown;
          createRigidStatic: (t: unknown) => PxRigidStatic;
        }
      | undefined;

    const physxScene = physicsInternal.scene as
      | {
          addActor: (a: unknown) => void;
          removeActor: (a: unknown) => void;
        }
      | undefined;

    if (!physxCore || !physxScene) {
      return;
    }

    try {
      // Create box geometry for the floor (half extents)
      const halfExtents = new PHYSX.PxVec3(
        width / 2,
        FLOOR_THICKNESS / 2,
        length / 2,
      );
      const geometry = new PHYSX.PxBoxGeometry(
        halfExtents.x,
        halfExtents.y,
        halfExtents.z,
      );

      // Create material with some friction
      const material = physxCore.createMaterial(0.6, 0.6, 0.1);

      // Create shape flags for collision and scene queries
      const flags = new PHYSX.PxShapeFlags(
        PHYSX.PxShapeFlagEnum.eSCENE_QUERY_SHAPE |
          PHYSX.PxShapeFlagEnum.eSIMULATION_SHAPE,
      );

      const shape = physxCore.createShape(geometry, material, true, flags) as {
        setQueryFilterData: (f: unknown) => void;
        setSimulationFilterData: (f: unknown) => void;
      };

      // Use environment layer so players collide with the floor
      const layer = Layers.environment || { group: 4, mask: 31 };
      const filterData = new PHYSX.PxFilterData(layer.group, layer.mask, 0, 0);
      shape.setQueryFilterData(filterData);
      shape.setSimulationFilterData(filterData);

      // Create transform at the floor position
      const transform = new PHYSX.PxTransform(
        new PHYSX.PxVec3(centerX, centerY, centerZ),
        new PHYSX.PxQuat(0, 0, 0, 1),
      );

      // Create static rigid body
      const body = physxCore.createRigidStatic(transform);
      body.attachShape(shape as any);

      // Add to physics scene
      physxScene.addActor(body);
      this.physicsBodies.push(body);

      console.log(
        `[DuelArenaVisualsSystem] Created physics collision for ${tag} at (${centerX}, ${centerY.toFixed(1)}, ${centerZ})`,
      );
    } catch (error) {
      console.warn(
        `[DuelArenaVisualsSystem] Failed to create physics collision for ${tag}:`,
        error,
      );
    }
  }

  /**
   * Update (called each frame) - animate torch light flicker
   */
  update(deltaTime: number): void {
    if (this.torchLights.length === 0) return;

    this.animTime += deltaTime;
    for (let i = 0; i < this.torchLights.length; i++) {
      const light = this.torchLights[i];
      light.intensity =
        TORCH_LIGHT_INTENSITY +
        Math.sin(this.animTime * 10 + i * 1.7) * 0.15 +
        Math.random() * 0.05;
    }
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    // Unregister flat zones from terrain system
    if (this.terrainSystem?.unregisterFlatZone) {
      for (const id of this.flatZoneIds) {
        this.terrainSystem.unregisterFlatZone(id);
      }
    }
    this.flatZoneIds = [];

    // Unregister torch particle emitters
    const particleSystem = this.world.getSystem("particle") as
      | ParticleSystem
      | undefined;
    if (particleSystem) {
      for (const id of this.torchEmitterIds) {
        particleSystem.unregister(id);
      }
    }
    this.torchEmitterIds = [];

    // Dispose torch lights
    for (const light of this.torchLights) {
      light.dispose();
    }
    this.torchLights = [];

    // Remove physics bodies from scene
    if (this.physicsSystem && this.physicsBodies.length > 0) {
      const physicsInternal = this.physicsSystem as unknown as {
        scene?: unknown;
      };
      const physxScene = physicsInternal.scene as
        | {
            removeActor: (a: unknown) => void;
          }
        | undefined;

      if (physxScene) {
        for (const body of this.physicsBodies) {
          try {
            physxScene.removeActor(body);
            body.release();
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }
    this.physicsBodies = [];

    // Remove from scene
    if (this.arenaGroup && this.world.stage?.scene) {
      this.world.stage?.scene.remove(this.arenaGroup);
    }

    // Dispose geometries
    for (const geometry of this.geometries) {
      geometry.dispose();
    }
    this.geometries = [];

    // Dispose textures
    for (const texture of this.textures) {
      texture.dispose();
    }
    this.textures = [];

    // Dispose materials
    for (const material of this.materials) {
      material.dispose();
    }
    this.materials = [];

    this.arenaGroup = null;
    this.visualsCreated = false;
    this.physicsSystem = null;
    super.destroy();
  }
}
