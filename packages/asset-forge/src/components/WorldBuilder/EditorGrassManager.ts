// @ts-nocheck -- TSL type definitions are incomplete for Fn() callbacks and node reassignment
/**
 * EditorGrassManager — Game-accurate grass for World Studio
 *
 * Uses the EXACT same visual primitives as the game's GrassVisualManager:
 * - Same clump geometry (sunflower spiral blades)
 * - Same TSL material (MeshStandardNodeMaterial with anime shading)
 * - Same instance placement logic (spacing, culling, color sampling)
 *
 * Editor optimizations vs the game:
 * - Uses LOD1 geometry (12 blades, 2 segments) — still looks good, half the verts
 * - 3× wider spacing (2.1m vs 0.7m) — 9× fewer instances per tile
 * - Camera-distance gated tile generation
 * - Deferred queue (1 tile/frame) to avoid frame stalls
 */

import * as THREE from "three";
import {
  uniform,
  Fn,
  float,
  sin,
  time,
  positionLocal,
  attribute,
  cos,
  uv,
  pow,
  vec3,
  vec4,
  mix,
  smoothstep,
  sub,
  dot,
  clamp,
  modelWorldMatrix,
  cameraViewMatrix,
  output,
} from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";

// Import from shared SOURCE to bypass Vite pre-bundle cache
import {
  GRASS_CONFIG,
  createClumpGeometry,
  mulberry32,
  setColorTintInterleaved,
} from "../../../../shared/src/systems/shared/world/GrassVisualManager";
import { applyAnimeShade } from "../../../../shared/src/systems/shared/world/TerrainShader";
import { SUN_LIGHT } from "../../../../shared/src/systems/shared/world/LightingConfig";
import {
  computeTerrainColorCPU,
  calculateSlope,
} from "../../../../shared/src/systems/shared/world/TerrainShader";
import { getGrassConfigForBiome } from "../../../../shared/src/systems/shared/world/TerrainBiomeTypes";
import { TERRAIN_CONSTANTS } from "../../../../shared/src/constants/GameConstants";

// ---------------------------------------------------------------------------
// Editor-specific tuning — keeps visuals close to game while staying fast
// ---------------------------------------------------------------------------

/** Spacing multiplier vs game (game=0.7m, editor=0.7*SPACING_MUL) */
const SPACING_MUL = 3;
/** Use LOD1 tier geometry (12 blades, 2 segments) */
const EDITOR_BLADES = 12;
const EDITOR_SEGMENTS = 2;
/** Only generate grass for tiles within this distance from camera */
const MAX_GRASS_TILE_DIST = 400; // meters
/** Shader fade distances */
const FADE_START = 200;
const FADE_END = 350;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Terrain data callback matching TileBasedTerrain's querier pattern */
export interface EditorTerrainQuerier {
  (
    worldX: number,
    worldZ: number,
  ): {
    height: number;
    biome?: string;
    biomeForestWeight?: number;
    biomeCanyonWeight?: number;
  };
}

export interface EditorGrassManagerOptions {
  waterThreshold?: number;
}

interface GrassChunk {
  key: string;
  mesh: THREE.InstancedMesh;
  centerX: number;
  centerZ: number;
}

// ---------------------------------------------------------------------------
// EditorGrassManager
// ---------------------------------------------------------------------------

export class EditorGrassManager {
  private container: THREE.Group;
  private scene: THREE.Scene;
  private chunks = new Map<string, GrassChunk>();
  private material: MeshStandardNodeMaterial | null = null;
  private geometry: THREE.BufferGeometry;

  private querier: EditorTerrainQuerier | null = null;
  private getHeight: ((x: number, z: number) => number) | null = null;
  private worldOffset = 0;

  private waterThreshold: number;
  private spacing: number;

  private sunDirUniform: ReturnType<typeof uniform>;
  private dayIntensityUniform: ReturnType<typeof uniform>;
  private playerPosUniform: ReturnType<typeof uniform>;

  private destroyed = false;
  private cameraX = 0;
  private cameraZ = 0;

  /** Deferred generation queue */
  private generateQueue: Array<{
    key: string;
    centerX: number;
    centerZ: number;
    size: number;
  }> = [];
  private queuedKeys = new Set<string>();

  constructor(scene: THREE.Scene, options?: EditorGrassManagerOptions) {
    this.scene = scene;
    this.waterThreshold =
      options?.waterThreshold ?? TERRAIN_CONSTANTS.WATER_THRESHOLD;
    this.spacing = GRASS_CONFIG.CLUMP_SPACING * SPACING_MUL;

    this.container = new THREE.Group();
    this.container.name = "EditorGrass";
    this.scene.add(this.container);

    // LOD1 geometry — 12 blades, 2 segments (half the verts of LOD0)
    this.geometry = createClumpGeometry(EDITOR_BLADES, EDITOR_SEGMENTS);

    console.log(
      `[EditorGrassManager] Init — spacing ${this.spacing.toFixed(1)}m, ` +
        `${EDITOR_BLADES} blades, ${EDITOR_SEGMENTS} segs, ` +
        `fade ${FADE_START}-${FADE_END}m`,
    );
  }

  // -- Public API -----------------------------------------------------------

  setTerrainCallbacks(
    querier: EditorTerrainQuerier,
    getHeight: (x: number, z: number) => number,
    worldOffset: number,
  ): void {
    this.querier = querier;
    this.getHeight = getHeight;
    this.worldOffset = worldOffset;
  }

  /** Queue grass generation for a terrain tile (deferred to processQueue). */
  addTile(centerX: number, centerZ: number, size: number): void {
    const key = `${centerX}_${centerZ}`;
    if (this.chunks.has(key) || this.queuedKeys.has(key)) return;
    this.generateQueue.push({ key, centerX, centerZ, size });
    this.queuedKeys.add(key);
  }

  /**
   * Process queued grass tiles. Call once per frame from the render loop.
   * Generates at most `budget` tiles per call.
   */
  processQueue(budget = 1): number {
    if (!this.querier || !this.getHeight || this.generateQueue.length === 0)
      return 0;

    // Lazy-init material on first processQueue (defers shader compile until
    // the render loop is running, avoids blocking scene setup)
    if (!this.material) {
      this.material = this.createMaterial();
    }

    // Sort queue: nearest tiles first
    this.generateQueue.sort((a, b) => {
      const da =
        (a.centerX - this.cameraX) ** 2 + (a.centerZ - this.cameraZ) ** 2;
      const db =
        (b.centerX - this.cameraX) ** 2 + (b.centerZ - this.cameraZ) ** 2;
      return da - db;
    });

    let built = 0;
    while (this.generateQueue.length > 0 && built < budget) {
      const { key, centerX, centerZ, size } = this.generateQueue.shift()!;
      this.queuedKeys.delete(key);
      if (this.chunks.has(key)) continue;

      // Skip tiles too far from camera
      const dx = centerX - this.cameraX;
      const dz = centerZ - this.cameraZ;
      if (dx * dx + dz * dz > MAX_GRASS_TILE_DIST * MAX_GRASS_TILE_DIST) {
        continue;
      }

      const t0 = performance.now();
      const instanceData = this.generateInstanceData(centerX, centerZ, size);
      if (!instanceData || instanceData.count === 0) {
        console.log(
          `[EditorGrass] Tile ${key}: 0 instances (${(performance.now() - t0).toFixed(1)}ms)`,
        );
        continue;
      }

      const geo = this.geometry.clone();
      geo.setAttribute(
        "instanceOffset",
        new THREE.InstancedBufferAttribute(instanceData.offsets, 3),
      );
      geo.setAttribute(
        "instanceRotScaleHash",
        new THREE.InstancedBufferAttribute(instanceData.rotScaleHash, 3),
      );
      setColorTintInterleaved(
        geo,
        instanceData.groundColors,
        instanceData.grassTints,
        instanceData.count,
      );
      geo.setAttribute(
        "instanceGroundNormal",
        new THREE.InstancedBufferAttribute(instanceData.groundNormals, 3),
      );

      const mesh = new THREE.InstancedMesh(
        geo,
        this.material,
        instanceData.count,
      );
      mesh.position.set(centerX, 0, centerZ);
      mesh.name = `EditorGrass_${key}`;
      mesh.frustumCulled = false;
      mesh.receiveShadow = false;
      mesh.castShadow = false;

      const identity = new THREE.Matrix4();
      for (let i = 0; i < instanceData.count; i++) {
        mesh.setMatrixAt(i, identity);
      }
      mesh.instanceMatrix.needsUpdate = true;

      this.container.add(mesh);
      this.chunks.set(key, { key, mesh, centerX, centerZ });
      built++;

      console.log(
        `[EditorGrass] Tile ${key}: ${instanceData.count} clumps (${(performance.now() - t0).toFixed(1)}ms) — ${this.generateQueue.length} queued`,
      );
    }
    return built;
  }

  get queuedCount(): number {
    return this.generateQueue.length;
  }

  removeTile(centerX: number, centerZ: number): void {
    const key = `${centerX}_${centerZ}`;
    if (this.queuedKeys.has(key)) {
      this.generateQueue = this.generateQueue.filter((q) => q.key !== key);
      this.queuedKeys.delete(key);
    }
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    this.container.remove(chunk.mesh);
    chunk.mesh.geometry.dispose();
    this.chunks.delete(key);
  }

  /** Per-frame update — camera position for shader uniforms + visibility */
  update(cameraPos: THREE.Vector3): void {
    this.cameraX = cameraPos.x;
    this.cameraZ = cameraPos.z;
    if (this.playerPosUniform) {
      this.playerPosUniform.value.copy(cameraPos);
    }

    // Hide/show chunks based on distance to camera
    const maxDistSq = FADE_END * FADE_END * 1.5; // beyond fade = hide
    for (const [, chunk] of this.chunks) {
      const dx = chunk.centerX - cameraPos.x;
      const dz = chunk.centerZ - cameraPos.z;
      chunk.mesh.visible = dx * dx + dz * dz < maxDistSq;
    }
  }

  setDayIntensity(intensity: number): void {
    if (this.dayIntensityUniform) this.dayIntensityUniform.value = intensity;
  }

  updateSunDirection(sunDir: THREE.Vector3): void {
    if (this.sunDirUniform) this.sunDirUniform.value.copy(sunDir);
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  dispose(): void {
    this.destroyed = true;
    this.generateQueue.length = 0;
    this.queuedKeys.clear();
    for (const [, chunk] of this.chunks) {
      this.container.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
    }
    this.chunks.clear();
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
    if (this.container.parent) this.container.parent.remove(this.container);
  }

  // -- Instance Data Generation -----------------------------------------------

  private generateInstanceData(
    centerX: number,
    centerZ: number,
    size: number,
  ): {
    offsets: Float32Array;
    rotScaleHash: Float32Array;
    groundColors: Float32Array;
    grassTints: Float32Array;
    groundNormals: Float32Array;
    count: number;
  } | null {
    const spacing = this.spacing;
    const maxCount = Math.ceil((size * size) / (spacing * spacing));
    const rng = mulberry32(
      GRASS_CONFIG.SEED ^ ((centerX * 374761393 + centerZ * 668265263) | 0),
    );

    const offsets = new Float32Array(maxCount * 3);
    const rotScaleHash = new Float32Array(maxCount * 3);
    const groundColors = new Float32Array(maxCount * 3);
    const grassTints = new Float32Array(maxCount * 4);
    const groundNormals = new Float32Array(maxCount * 3);

    let count = 0;
    const wOff = this.worldOffset;
    const querier = this.querier!;
    const getHeight = this.getHeight!;

    const tCfg = getGrassConfigForBiome("tundra");
    const fCfg = getGrassConfigForBiome("forest");
    const cCfg = getGrassConfigForBiome("canyon");

    for (let i = 0; i < maxCount; i++) {
      const lx = (rng() - 0.5) * size;
      const lz = (rng() - 0.5) * size;
      const clumpRng = rng();

      const sceneX = centerX + lx;
      const sceneZ = centerZ + lz;
      const terrainX = sceneX - wOff;
      const terrainZ = sceneZ - wOff;

      const query = querier(terrainX, terrainZ);
      const ty = query.height;

      if (ty < this.waterThreshold + 0.1) continue;

      // Compute slope via central difference (inline — avoids function call overhead)
      const sd = 1.5; // wider sample for cheaper noise
      const hL = getHeight(sceneX - sd, sceneZ);
      const hR = getHeight(sceneX + sd, sceneZ);
      const hD = getHeight(sceneX, sceneZ - sd);
      const hU = getHeight(sceneX, sceneZ + sd);
      const dhdx = (hR - hL) / (2 * sd);
      const dhdz = (hU - hD) / (2 * sd);
      const gradMag = Math.sqrt(dhdx * dhdx + dhdz * dhdz);
      const normalY = 1 / Math.sqrt(1 + gradMag * gradMag);
      const slope = 1 - normalY;

      // Biome weights
      const forestW = query.biomeForestWeight ?? 0;
      const canyonW = query.biomeCanyonWeight ?? 0;
      const tundraW = 1 - forestW - canyonW;

      // Terrain color + grassWeight
      const color = computeTerrainColorCPU(
        sceneX,
        sceneZ,
        ty,
        slope,
        forestW,
        canyonW,
      );

      // Grass placement (biome-blended)
      const maxSlope =
        tCfg.maxSlope * tundraW +
        fCfg.maxSlope * forestW +
        cCfg.maxSlope * canyonW;
      const minGW =
        tCfg.minGrassWeight * tundraW +
        fCfg.minGrassWeight * forestW +
        cCfg.minGrassWeight * canyonW;
      const density =
        tCfg.density * tundraW +
        fCfg.density * forestW +
        cCfg.density * canyonW;
      const grassHeightScale =
        tCfg.heightScale * tundraW +
        fCfg.heightScale * forestW +
        cCfg.heightScale * canyonW;

      if (slope > maxSlope) continue;
      if (color.grassWeight < minGW) continue;
      const grassPlacement = color.grassWeight * density;
      if (grassPlacement <= 0 || clumpRng > grassPlacement) continue;

      // Terrain normal (reuse height samples from slope computation)
      const rnx = -dhdx;
      const rny = 1.0;
      const rnz = -dhdz;
      const nLen = Math.sqrt(rnx * rnx + rny * rny + rnz * rnz);
      const invLen = 1 / nLen;

      offsets[count * 3] = lx;
      offsets[count * 3 + 1] = ty;
      offsets[count * 3 + 2] = lz;

      const rotation = rng() * Math.PI * 2;
      const scale =
        (GRASS_CONFIG.SCALE_MIN +
          clumpRng * (GRASS_CONFIG.SCALE_MAX - GRASS_CONFIG.SCALE_MIN)) *
        grassHeightScale;
      rotScaleHash[count * 3] = rotation;
      rotScaleHash[count * 3 + 1] = scale;
      rotScaleHash[count * 3 + 2] = clumpRng;

      groundColors[count * 3] = color.r;
      groundColors[count * 3 + 1] = color.g;
      groundColors[count * 3 + 2] = color.b;

      // Biome tint
      const tintStrength =
        (tCfg.tintStrength ?? 0) * tundraW +
        (fCfg.tintStrength ?? 0) * forestW +
        (cCfg.tintStrength ?? 0) * canyonW;
      let tintR = 0,
        tintG = 0,
        tintB = 0;
      if (tintStrength > 0) {
        const inv = 1 / tintStrength;
        tintR =
          ((tCfg.tintColor?.[0] ?? 0) * (tCfg.tintStrength ?? 0) * tundraW +
            (fCfg.tintColor?.[0] ?? 0) * (fCfg.tintStrength ?? 0) * forestW +
            (cCfg.tintColor?.[0] ?? 0) * (cCfg.tintStrength ?? 0) * canyonW) *
          inv;
        tintG =
          ((tCfg.tintColor?.[1] ?? 0) * (tCfg.tintStrength ?? 0) * tundraW +
            (fCfg.tintColor?.[1] ?? 0) * (fCfg.tintStrength ?? 0) * forestW +
            (cCfg.tintColor?.[1] ?? 0) * (cCfg.tintStrength ?? 0) * canyonW) *
          inv;
        tintB =
          ((tCfg.tintColor?.[2] ?? 0) * (tCfg.tintStrength ?? 0) * tundraW +
            (fCfg.tintColor?.[2] ?? 0) * (fCfg.tintStrength ?? 0) * forestW +
            (cCfg.tintColor?.[2] ?? 0) * (cCfg.tintStrength ?? 0) * canyonW) *
          inv;
      }

      grassTints[count * 4] = tintR;
      grassTints[count * 4 + 1] = tintG;
      grassTints[count * 4 + 2] = tintB;
      grassTints[count * 4 + 3] = tintStrength;

      groundNormals[count * 3] = rnx * invLen;
      groundNormals[count * 3 + 1] = rny * invLen;
      groundNormals[count * 3 + 2] = rnz * invLen;

      count++;
    }

    if (count === 0) return null;

    return {
      offsets: offsets.slice(0, count * 3),
      rotScaleHash: rotScaleHash.slice(0, count * 3),
      groundColors: groundColors.slice(0, count * 3),
      grassTints: grassTints.slice(0, count * 4),
      groundNormals: groundNormals.slice(0, count * 3),
      count,
    };
  }

  // -- TSL Material (same as GrassVisualManager.createMaterial) ---------------

  private createMaterial(): MeshStandardNodeMaterial {
    const mat = new MeshStandardNodeMaterial();
    mat.side = THREE.DoubleSide;
    mat.transparent = false;
    mat.depthWrite = true;
    mat.roughness = 1.0;
    mat.metalness = 0.0;
    mat.fog = false;

    const uWindSpeed = uniform(GRASS_CONFIG.WIND_SPEED);
    const uWindStrength = uniform(GRASS_CONFIG.WIND_STRENGTH);
    const uBladeHeight = uniform(GRASS_CONFIG.BLADE_HEIGHT_MAX);
    this.sunDirUniform = uniform(
      new THREE.Vector3(...SUN_LIGHT.DEFAULT_DIRECTION),
    );
    this.dayIntensityUniform = uniform(1.0);
    this.playerPosUniform = uniform(new THREE.Vector3(0, 0, 0));

    const uPlayerPos = this.playerPosUniform;
    const uFadeStart = float(FADE_START);
    const uFadeEnd = float(FADE_END);

    mat.positionNode = Fn(() => {
      const localPos = positionLocal.toVar("gp");

      const offset = attribute("instanceOffset", "vec3");
      const rsh = attribute("instanceRotScaleHash", "vec3");
      const rot = rsh.x;
      const scale = rsh.y;
      const t = uv().y;

      // World-space base for distance fade
      const worldBase = modelWorldMatrix.mul(
        vec4(offset.x, float(0), offset.z, float(1.0)),
      );
      const toPlayer = sub(
        vec3(worldBase.x, float(0), worldBase.z),
        vec3(uPlayerPos.x, float(0), uPlayerPos.z),
      );
      const distSq = dot(toPlayer, toPlayer);
      const dist = pow(distSq, float(0.5));
      const fadeFactor = clamp(
        sub(float(1.0), smoothstep(uFadeStart, uFadeEnd, dist)),
        float(0.0),
        float(1.0),
      );

      // Scale + distance fade on Y
      localPos.x.assign(localPos.x.mul(scale));
      localPos.y.assign(localPos.y.mul(scale).mul(fadeFactor));
      localPos.z.assign(localPos.z.mul(scale));

      // Rotate clump around Y
      const cosR = cos(rot);
      const sinR = sin(rot);
      const preRotX = localPos.x.toVar("preRotX");
      const preRotZ = localPos.z.toVar("preRotZ");
      localPos.x.assign(preRotX.mul(cosR).sub(preRotZ.mul(sinR)));
      localPos.z.assign(preRotX.mul(sinR).add(preRotZ.mul(cosR)));

      // Terrain slope tilt (Rodrigues' rotation)
      const gn = attribute("instanceGroundNormal", "vec3");
      const nx = gn.x;
      const ny = gn.y;
      const nz = gn.z;
      const invOnePlusNy = float(1.0).div(ny.add(float(1.0)));
      const nxnzTerm = nx.mul(nz).mul(invOnePlusNy).negate();

      const preTiltX = localPos.x.toVar("preTiltX");
      const preTiltY = localPos.y.toVar("preTiltY");
      const preTiltZ = localPos.z.toVar("preTiltZ");

      localPos.x.assign(
        preTiltX
          .mul(ny.add(nz.mul(nz).mul(invOnePlusNy)))
          .add(preTiltY.mul(nx))
          .add(preTiltZ.mul(nxnzTerm)),
      );
      localPos.y.assign(
        preTiltX
          .mul(nx.negate())
          .add(preTiltY.mul(ny))
          .add(preTiltZ.mul(nz.negate())),
      );
      localPos.z.assign(
        preTiltX
          .mul(nxnzTerm)
          .add(preTiltY.mul(nz))
          .add(preTiltZ.mul(ny.add(nx.mul(nx).mul(invOnePlusNy)))),
      );

      // Wind
      const wt = time.mul(uWindSpeed);
      const bendFactor = pow(t, float(1.8));
      localPos.x.addAssign(
        sin(wt.add(offset.x.mul(0.35)).add(offset.z.mul(0.12)))
          .mul(uWindStrength)
          .mul(bendFactor)
          .mul(uBladeHeight),
      );
      localPos.z.addAssign(
        sin(
          wt.mul(0.67).add(offset.x.mul(0.18)).add(offset.z.mul(0.28)).add(2.0),
        )
          .mul(uWindStrength)
          .mul(0.55)
          .mul(bendFactor)
          .mul(uBladeHeight),
      );

      // Translate to instance world position
      localPos.x.addAssign(offset.x);
      localPos.y.addAssign(offset.y);
      localPos.z.addAssign(offset.z);

      return localPos;
    })();

    const uSunDir = this.sunDirUniform;
    const terrainNormal = attribute("instanceGroundNormal", "vec3");

    mat.normalNode = cameraViewMatrix.transformDirection(terrainNormal);

    mat.colorNode = Fn(() => {
      const groundCol = attribute("instanceGroundColor", "vec3");
      const tint = attribute("instanceGrassTint", "vec4");
      const tintCol = tint.xyz;
      const tintStr = tint.w;
      const t = uv().y;
      const tintedCol = mix(groundCol, tintCol, tintStr);
      const tipCol = mix(
        groundCol,
        tintedCol,
        smoothstep(float(0.0), float(1.0), t),
      ).mul(1.4);
      const bladeCol = mix(
        groundCol,
        tipCol,
        smoothstep(float(0.0), float(1.0), t),
      );
      return applyAnimeShade(bladeCol, terrainNormal, uSunDir);
    })();

    mat.outputNode = Fn(() => {
      return vec4(output.rgb, output.a);
    })();

    return mat;
  }
}
