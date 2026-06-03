/**
 * ProcgenRockInstancer - Instanced Rendering for Procedural Rocks
 *
 * Handles LOD transitions and instanced rendering for procedurally generated rocks.
 * Similar to ProcgenTreeInstancer but simpler since rocks are single meshes without
 * separate foliage components.
 *
 * LOD Levels:
 * - LOD0 (0-50m): Full detail rock mesh
 * - LOD1 (50-100m): Simplified rock mesh
 * - LOD2 (100-150m): Cross-billboard cards
 * - Impostor (150-250m): Per-preset octahedral billboard with TSL material
 * - Culled (250m+): Not rendered
 *
 * Features:
 * - Cross-fade LOD transitions with screen-space dithering
 * - Per-preset instanced meshes for batched rendering
 * - Per-preset impostor materials using TSLImpostorMaterial (same as trees)
 */

import THREE from "../../../extras/three/three";
import type { World } from "../../../core/World";
import {
  ImpostorManager,
  BakePriority,
  ImpostorBakeMode,
} from "../rendering/ImpostorManager";
import {
  createTSLImpostorMaterial,
  buildOctahedronMesh,
  lerpOctahedronGeometry,
  OctahedronType,
  type TSLImpostorMaterial,
} from "@hyperforge/impostor";
import { getRockVariant, ensureRockVariantsLoaded } from "./ProcgenRockCache";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Disable impostors and LOD2 cards for rocks.
 * Rocks use only LOD0 + LOD1 with dissolve fade to cull.
 */
const DISABLE_IMPOSTORS = true;
const DISABLE_LOD2_CARDS = false;

const MAX_INSTANCES_PER_PRESET = 500;
const LOD_FADE_MS = 250;
const LOD_UPDATE_MS = 100;
const LOD_UPDATES_PER_FRAME = 30;
const HYSTERESIS_SQ = 16; // 4m buffer

// LOD distances - with cards/impostors disabled, rocks fade from LOD1 directly to cull
const LOD_DIST = { lod1: 50, lod2: 100, impostor: 150, cull: 150 };
const LOD_DIST_SQ = {
  lod1: LOD_DIST.lod1 ** 2,
  lod2: LOD_DIST.lod2 ** 2,
  impostor: LOD_DIST.impostor ** 2,
  cull: LOD_DIST.cull ** 2, // Cull at 150m (no impostor stage)
};

// ============================================================================
// TYPES
// ============================================================================

interface RockInstance {
  id: string;
  presetName: string;
  position: THREE.Vector3;
  rotation: number;
  scale: number;
  currentLOD: number; // 0-4: lod0, lod1, lod2, impostor, culled
  lodIndices: [number, number, number, number]; // [lod0, lod1, lod2, impostor] mesh indices
  hasImpostor: boolean; // Whether this preset has a working impostor
  transition: { from: number; to: number; start: number } | null;
  radius: number;
}

interface MeshData {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  mesh: THREE.InstancedMesh;
  fadeAttr: THREE.InstancedBufferAttribute;
  idxToId: Map<number, string>;
  freeIndices: number[]; // Recycled indices available for reuse
  nextIdx: number;
  count: number;
  dirty: boolean;
}

/** Impostor mesh data - uses TSLImpostorMaterial for proper lighting */
interface ImpostorMeshData {
  geometry: THREE.BufferGeometry;
  material: TSLImpostorMaterial;
  mesh: THREE.InstancedMesh;
  idxToId: Map<number, string>;
  freeIndices: number[];
  nextIdx: number;
  count: number;
  dirty: boolean;
  width: number;
  height: number;
}

interface PresetMeshes {
  lod0: MeshData | null;
  lod1: MeshData | null;
  lod2: MeshData | null;
  impostor: ImpostorMeshData | null;
  dimensions: { width: number; height: number; depth: number };
  averageColor: THREE.Color;
}

type LODKey = "lod0" | "lod1" | "lod2";

/** LOD key lookup array to avoid repeated array allocations */
const LOD_KEYS: readonly LODKey[] = ["lod0", "lod1", "lod2"] as const;

/** Impostor configuration - matches tree instancer for consistency */
const IMPOSTOR_CONFIG = {
  ATLAS_SIZE: 512,
  GRID_SIZE_X: 12,
  GRID_SIZE_Y: 6,
  MAX_INSTANCES: 500,
} as const;

// ============================================================================
// ROCK INSTANCER CLASS
// ============================================================================

export class ProcgenRockInstancer {
  private static instance: ProcgenRockInstancer | null = null;

  private world: World;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private impostorManager: ImpostorManager;

  private instances: Map<string, RockInstance> = new Map();
  private presetMeshes: Map<string, PresetMeshes> = new Map();

  private lastUpdate = 0;
  private updateQueue: string[] = [];
  private updateIndex = 0;

  private tempMatrix = new THREE.Matrix4();
  private tempPosition = new THREE.Vector3();
  private tempQuat = new THREE.Quaternion();
  private tempScale = new THREE.Vector3();
  private zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private lookMatrix = new THREE.Matrix4();

  // View sampling for impostors (octahedral mapping)
  private raycaster = new THREE.Raycaster();
  private raycastMesh: THREE.Mesh | null = null;
  private _faceIndices = new THREE.Vector3(0, 0, 0);
  private _faceWeights = new THREE.Vector3(0.33, 0.33, 0.34);

  // Lighting sync for impostors
  private _lastLightUpdate = 0;
  private _ambientColor = new THREE.Vector3(0.6, 0.65, 0.7);
  private _lightingLoggedOnce = false;

  private constructor(world: World) {
    this.world = world;
    this.scene = world.stage?.scene as THREE.Scene;
    this.camera = world.camera;
    this.impostorManager = ImpostorManager.getInstance(world);

    // Only initialize impostor-related systems if impostors are enabled
    if (!DISABLE_IMPOSTORS) {
      this.impostorManager.initBaker();

      // Initialize octahedron mesh for view sampling
      const octMeshData = buildOctahedronMesh(
        OctahedronType.HEMI,
        IMPOSTOR_CONFIG.GRID_SIZE_X,
        IMPOSTOR_CONFIG.GRID_SIZE_Y,
        [0, 0, 0],
        true,
      );
      lerpOctahedronGeometry(octMeshData, 1.0);
      octMeshData.filledMesh.geometry.computeBoundingSphere();
      octMeshData.filledMesh.geometry.computeBoundingBox();
      this.raycastMesh = octMeshData.filledMesh;
    }
  }

  /**
   * Get or create the singleton instancer.
   */
  static getInstance(world: World | null): ProcgenRockInstancer | null {
    if (!world) return ProcgenRockInstancer.instance;
    if (!ProcgenRockInstancer.instance) {
      ProcgenRockInstancer.instance = new ProcgenRockInstancer(world);
    }
    return ProcgenRockInstancer.instance;
  }

  /**
   * Add a rock instance.
   */
  async addInstance(
    id: string,
    presetName: string,
    position: THREE.Vector3,
    rotation: number,
    scale: number,
  ): Promise<void> {
    // Ensure preset meshes are loaded
    await this.ensurePresetLoaded(presetName);

    // Create instance data
    const presetData = this.presetMeshes.get(presetName);
    if (!presetData) {
      console.warn(`[ProcgenRockInstancer] Preset ${presetName} not loaded`);
      return;
    }

    const radius =
      Math.max(presetData.dimensions.width, presetData.dimensions.depth) *
      scale *
      0.5;

    const instance: RockInstance = {
      id,
      presetName,
      position: position.clone(),
      rotation,
      scale,
      currentLOD: 4, // Start culled
      lodIndices: [-1, -1, -1, -1], // LOD0, LOD1, LOD2, Impostor
      hasImpostor: presetData.impostor !== null,
      transition: null,
      radius,
    };

    this.instances.set(id, instance);

    // NOTE: Grass exclusion is handled by ProceduralGrass.collectAndRefreshExclusionTexture()
    // which reads all rock positions at once. No per-rock registration needed.

    // Determine initial LOD based on distance
    const distSq = this.camera.position.distanceToSquared(position);
    const targetLOD = this.getLODForDistance(distSq, instance.hasImpostor);

    // Immediately show at target LOD (no transition for initial add)
    await this.setInstanceLOD(instance, targetLOD, false);

    // Add to update queue
    this.updateQueue.push(id);
  }

  /**
   * Remove a rock instance.
   * @returns true if instance was found and removed, false otherwise
   */
  removeInstance(id: string): boolean {
    const instance = this.instances.get(id);
    if (!instance) return false;

    // Remove from all LOD meshes (including impostor)
    this.removeFromLODMesh(instance, 0);
    this.removeFromLODMesh(instance, 1);
    this.removeFromLODMesh(instance, 2);
    this.removeFromImpostorMesh(instance);

    // NOTE: Grass exclusion is handled via texture regeneration when needed.
    // Call ProceduralGrass.collectAndRefreshExclusionTexture() after major changes.

    this.instances.delete(id);

    // Remove from update queue
    const queueIdx = this.updateQueue.indexOf(id);
    if (queueIdx !== -1) {
      this.updateQueue.splice(queueIdx, 1);
    }

    return true;
  }

  /**
   * Update LOD levels based on camera position.
   * Call this every frame.
   */
  update(_deltaTime: number): void {
    if (!this.camera) return;

    const now = performance.now();

    // Throttle updates
    if (now - this.lastUpdate < LOD_UPDATE_MS) {
      // Still process transitions
      this.updateTransitions(now);
      return;
    }
    this.lastUpdate = now;

    // Update a batch of instances
    const batchSize = Math.min(LOD_UPDATES_PER_FRAME, this.updateQueue.length);
    if (batchSize === 0) return;

    for (let i = 0; i < batchSize; i++) {
      const idx = (this.updateIndex + i) % this.updateQueue.length;
      const id = this.updateQueue[idx];
      const instance = this.instances.get(id);

      if (instance) {
        const distSq = this.camera.position.distanceToSquared(
          instance.position,
        );
        const targetLOD = this.getLODForDistanceWithHysteresis(
          instance,
          distSq,
        );

        if (targetLOD !== instance.currentLOD && !instance.transition) {
          this.startLODTransition(instance, targetLOD, now);
        }
      }
    }

    this.updateIndex =
      (this.updateIndex + batchSize) % Math.max(1, this.updateQueue.length);

    // Process transitions
    this.updateTransitions(now);

    // Update dirty meshes
    this.commitDirtyMeshes();

    // Skip impostor updates when disabled
    if (!DISABLE_IMPOSTORS) {
      // Update view sampling for impostors (octahedral mapping)
      this.updateViewSampling();

      // Update impostor billboarding
      this.updateImpostorBillboarding();

      // Sync impostor lighting with scene sun light
      this.syncImpostorLighting();
    }
  }

  /**
   * Update view sampling for octahedral impostor mapping.
   * Raycasts against an octahedron to determine which atlas cells to blend.
   */
  private updateViewSampling(): void {
    if (!this.raycastMesh) return;

    const viewDir = this.tempPosition
      .set(0, 0, 0)
      .sub(this.camera.position)
      .normalize();
    this.raycaster.ray.origin.copy(viewDir).multiplyScalar(2);
    this.raycaster.ray.direction.copy(viewDir).negate();

    const hits = this.raycaster.intersectObject(this.raycastMesh, false);
    if (hits.length > 0 && hits[0].face && hits[0].barycoord) {
      const { face, barycoord } = hits[0];
      this._faceIndices.set(face.a, face.b, face.c);
      this._faceWeights.copy(barycoord);

      // Update all impostor materials with new view direction
      for (const preset of this.presetMeshes.values()) {
        if (preset.impostor) {
          preset.impostor.material.updateView(
            this._faceIndices,
            this._faceWeights,
          );
        }
      }
    }
  }

  /**
   * Update impostor billboarding to face camera.
   */
  private updateImpostorBillboarding(): void {
    // Calculate billboard quaternion once
    this.lookMatrix.lookAt(
      this.camera.position,
      this.tempPosition.set(0, 0, 0),
      THREE.Object3D.DEFAULT_UP,
    );
    this.tempQuat.setFromRotationMatrix(this.lookMatrix);

    for (const preset of this.presetMeshes.values()) {
      if (!preset.impostor) continue;
      const impostorData = preset.impostor;
      let dirty = false;

      for (const [idx, instanceId] of impostorData.idxToId) {
        const instance = this.instances.get(instanceId);
        if (!instance || instance.lodIndices[3] !== idx) continue;

        impostorData.mesh.getMatrixAt(idx, this.tempMatrix);
        this.tempMatrix.decompose(
          this.tempPosition,
          new THREE.Quaternion(),
          this.tempScale,
        );
        this.tempMatrix.compose(
          this.tempPosition,
          this.tempQuat,
          this.tempScale,
        );
        impostorData.mesh.setMatrixAt(idx, this.tempMatrix);
        dirty = true;
      }

      if (dirty) {
        impostorData.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  /**
   * Sync impostor lighting with scene's sun light.
   * Same approach as ProcgenTreeInstancer for consistency.
   */
  private syncImpostorLighting(): void {
    const now = performance.now();
    // Only update lighting once per frame (~16ms)
    if (now - this._lastLightUpdate < 16) return;
    this._lastLightUpdate = now;

    // Get environment system for sun light and hemisphere light
    const env = this.world.getSystem("environment") as {
      sunLight?: THREE.DirectionalLight;
      lightDirection?: THREE.Vector3;
      hemisphereLight?: THREE.HemisphereLight;
    } | null;

    if (!env?.sunLight) return;

    const sun = env.sunLight;
    // Light direction is negated (light goes FROM direction TO target)
    const lightDir = new THREE.Vector3(0.5, 0.8, 0.3);
    if (env.lightDirection) {
      lightDir.copy(env.lightDirection).negate();
    }

    // Get ambient from hemisphere light
    if (env.hemisphereLight) {
      const hemi = env.hemisphereLight;
      const hemiIntensity = Math.min(hemi.intensity, 1.0) * 0.5;
      this._ambientColor.set(
        hemi.color.r * hemiIntensity,
        hemi.color.g * hemiIntensity,
        hemi.color.b * hemiIntensity,
      );
    }

    // Diagnostic: log once when lighting is connected
    if (!this._lightingLoggedOnce) {
      console.log(
        `[ProcgenRockInstancer] Lighting connected: ` +
          `dir=(${lightDir.x.toFixed(2)}, ${lightDir.y.toFixed(2)}, ${lightDir.z.toFixed(2)}), ` +
          `ambient=(${this._ambientColor.x.toFixed(2)}, ${this._ambientColor.y.toFixed(2)}, ${this._ambientColor.z.toFixed(2)})`,
      );
      this._lightingLoggedOnce = true;
    }

    // Update all per-preset impostor materials
    for (const preset of this.presetMeshes.values()) {
      if (preset.impostor?.material.updateLighting) {
        preset.impostor.material.updateLighting({
          ambientColor: new THREE.Vector3(
            this._ambientColor.x,
            this._ambientColor.y,
            this._ambientColor.z,
          ),
          ambientIntensity: 0.4,
          directionalLights: [
            {
              direction: lightDir,
              color: new THREE.Vector3(sun.color.r, sun.color.g, sun.color.b),
              intensity: Math.min(sun.intensity, 1.5),
            },
          ],
        });
      }
    }
  }

  /**
   * Ensure a preset's meshes are loaded and registered.
   */
  private async ensurePresetLoaded(presetName: string): Promise<void> {
    if (this.presetMeshes.has(presetName)) return;

    await ensureRockVariantsLoaded(presetName);

    const variant = getRockVariant(presetName, 0);
    if (!variant) {
      console.warn(
        `[ProcgenRockInstancer] Failed to get variant for ${presetName}`,
      );
      return;
    }

    const presetData: PresetMeshes = {
      lod0: null,
      lod1: null,
      lod2: null,
      impostor: null,
      dimensions: variant.dimensions,
      averageColor: variant.averageColor,
    };

    // Create LOD0 instanced mesh
    presetData.lod0 = this.createLODMesh(
      variant.mesh.geometry,
      variant.mesh.material as THREE.Material,
      `Rock_${presetName}_LOD0`,
    );

    // Create LOD1 instanced mesh
    if (variant.lod1Mesh) {
      presetData.lod1 = this.createLODMesh(
        variant.lod1Mesh.geometry,
        variant.lod1Mesh.material as THREE.Material,
        `Rock_${presetName}_LOD1`,
      );
    }

    // Create LOD2 instanced mesh (from the card group) - skip if disabled
    if (!DISABLE_LOD2_CARDS && variant.lod2Group) {
      const cardMesh = variant.lod2Group.children[0] as THREE.Mesh;
      if (cardMesh) {
        presetData.lod2 = this.createLODMesh(
          cardMesh.geometry,
          cardMesh.material as THREE.Material,
          `Rock_${presetName}_LOD2`,
        );
      }
    }

    // Create per-preset impostor - skip if disabled
    if (!DISABLE_IMPOSTORS) {
      try {
        await this.createImpostorMesh(presetName, variant.mesh, presetData);
      } catch (err) {
        console.warn(
          `[ProcgenRockInstancer] Failed to create impostor for ${presetName}:`,
          err,
        );
      }
    }

    this.presetMeshes.set(presetName, presetData);
  }

  /**
   * Create per-preset impostor mesh using TSLImpostorMaterial.
   * This uses the same proven approach as ProcgenTreeInstancer.
   *
   * NOTE: When DISABLE_IMPOSTORS is true, this function returns immediately.
   */
  private async createImpostorMesh(
    presetName: string,
    sourceMesh: THREE.Mesh,
    presetData: PresetMeshes,
  ): Promise<void> {
    if (DISABLE_IMPOSTORS) return; // Impostors disabled - using dissolve fade instead

    const { ATLAS_SIZE, GRID_SIZE_X, GRID_SIZE_Y, MAX_INSTANCES } =
      IMPOSTOR_CONFIG;

    // Bake impostor using ImpostorManager (same as trees use)
    const result = await this.impostorManager.getOrCreate(
      `rock_${presetName}_v1`,
      sourceMesh,
      {
        atlasSize: ATLAS_SIZE,
        hemisphere: true,
        priority: BakePriority.NORMAL,
        gridSizeX: GRID_SIZE_X,
        gridSizeY: GRID_SIZE_Y,
        bakeMode: ImpostorBakeMode.STANDARD, // albedo + normals for lighting
      },
    );

    // Raycast mesh is now initialized in constructor

    // Calculate billboard dimensions from bounding box
    const box = new THREE.Box3().setFromObject(sourceMesh);
    const size = box.getSize(new THREE.Vector3());
    const w = Math.max(size.x, size.z);
    const h = size.y;

    // Create TSL impostor material (same as trees use - proven to work)
    const mat = createTSLImpostorMaterial({
      atlasTexture: result.atlasTexture,
      normalAtlasTexture: result.normalAtlasTexture, // Enable dynamic lighting
      depthAtlasTexture: result.depthAtlasTexture, // Enable depth-based blending (if available)
      gridSizeX: result.gridSizeX,
      gridSizeY: result.gridSizeY,
      transparent: true,
      depthWrite: true,
      enableAAA: true,
    });
    this.world.setupMaterial?.(mat);

    const geo = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.InstancedMesh(geo, mat, MAX_INSTANCES);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.layers.set(1);
    mesh.name = `Rock_${presetName}_impostor`;
    this.scene.add(mesh);

    presetData.impostor = {
      geometry: geo,
      material: mat,
      mesh,
      idxToId: new Map(),
      freeIndices: [],
      nextIdx: 0,
      count: 0,
      dirty: false,
      width: w,
      height: h,
    };

    console.log(
      `[ProcgenRockInstancer] Created impostor for ${presetName}: ${w.toFixed(1)}x${h.toFixed(1)}m, ` +
        `hasNormals=${!!result.normalAtlasTexture}`,
    );
  }

  /**
   * Create an instanced mesh for a LOD level.
   */
  private createLODMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
  ): MeshData {
    const mesh = new THREE.InstancedMesh(
      geometry,
      material,
      MAX_INSTANCES_PER_PRESET,
    );
    mesh.name = name;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Add fade attribute
    const fades = new Float32Array(MAX_INSTANCES_PER_PRESET).fill(1);
    const fadeAttr = new THREE.InstancedBufferAttribute(fades, 1);
    fadeAttr.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry.setAttribute("instanceFade", fadeAttr);

    this.scene.add(mesh);

    return {
      geometry,
      material,
      mesh,
      fadeAttr,
      idxToId: new Map(),
      freeIndices: [],
      nextIdx: 0,
      count: 0,
      dirty: false,
    };
  }

  /**
   * Get target LOD for a distance squared value.
   *
   * With DISABLE_LOD2_CARDS and DISABLE_IMPOSTORS both true:
   * - LOD0 (0-50m): Full detail
   * - LOD1 (50-150m): Simplified with dissolve fade
   * - Culled (150m+): Not rendered
   */
  private getLODForDistance(distSq: number, _hasImpostor: boolean): number {
    // Skip LOD2 cards and impostors - only use LOD0 and LOD1
    if (DISABLE_LOD2_CARDS && DISABLE_IMPOSTORS) {
      if (distSq >= LOD_DIST_SQ.cull) return 4; // Cull at 150m
      if (distSq >= LOD_DIST_SQ.lod1) return 1; // LOD1 from 50-150m
      return 0; // LOD0 from 0-50m
    }

    // Legacy paths (when cards/impostors enabled)
    if (DISABLE_IMPOSTORS) {
      if (distSq >= LOD_DIST_SQ.impostor) return 4;
      if (distSq >= LOD_DIST_SQ.lod2) return 2;
      if (distSq >= LOD_DIST_SQ.lod1) return 1;
      return 0;
    }

    if (distSq >= LOD_DIST_SQ.cull) return 4;
    if (distSq >= LOD_DIST_SQ.lod2) return 2;
    if (distSq >= LOD_DIST_SQ.lod1) return 1;
    return 0;
  }

  /**
   * Get target LOD with hysteresis to prevent rapid switching.
   */
  private getLODForDistanceWithHysteresis(
    instance: RockInstance,
    distSq: number,
  ): number {
    const targetLOD = this.getLODForDistance(distSq, instance.hasImpostor);
    const currentLOD = instance.currentLOD;

    // Moving closer: switch immediately
    if (targetLOD < currentLOD) return targetLOD;

    // Moving farther: add hysteresis
    if (targetLOD > currentLOD) {
      // Simplified thresholds when LOD2/impostor disabled
      const thresholds =
        DISABLE_LOD2_CARDS && DISABLE_IMPOSTORS
          ? [
              0,
              LOD_DIST_SQ.lod1,
              LOD_DIST_SQ.cull,
              LOD_DIST_SQ.cull,
              LOD_DIST_SQ.cull,
            ]
          : [
              0,
              LOD_DIST_SQ.lod1,
              LOD_DIST_SQ.lod2,
              LOD_DIST_SQ.impostor,
              LOD_DIST_SQ.cull,
            ];
      const threshold = thresholds[currentLOD + 1] ?? LOD_DIST_SQ.cull;
      if (distSq > threshold + HYSTERESIS_SQ) {
        return targetLOD;
      }
    }

    return currentLOD;
  }

  /**
   * Start a LOD transition.
   * Note: setInstanceLOD is synchronous in practice since preset is already loaded.
   * The async signature is for initial load only.
   */
  private startLODTransition(
    instance: RockInstance,
    targetLOD: number,
    now: number,
  ): void {
    instance.transition = {
      from: instance.currentLOD,
      to: targetLOD,
      start: now,
    };

    // Add to target LOD mesh at fade 0
    // Safe to not await: preset is already loaded during addInstance
    void this.setInstanceLOD(instance, targetLOD, true);
  }

  /**
   * Update all active transitions.
   */
  private updateTransitions(now: number): void {
    for (const instance of this.instances.values()) {
      if (!instance.transition) continue;

      const elapsed = now - instance.transition.start;
      const progress = Math.min(1, elapsed / LOD_FADE_MS);

      if (progress >= 1) {
        // Transition complete - remove from old LOD
        const fromLOD = instance.transition.from;
        if (fromLOD < 3) {
          this.removeFromLODMesh(instance, fromLOD);
        } else if (fromLOD === 3) {
          // Remove from per-preset impostor mesh
          this.removeFromImpostorMesh(instance);
        }
        this.setInstanceFade(instance, instance.currentLOD, 1);
        instance.transition = null;
      } else {
        // Update fades (only for LOD0-2, impostor doesn't support fade)
        if (instance.transition.from < 3) {
          this.setInstanceFade(
            instance,
            instance.transition.from,
            1 - progress,
          );
        }
        if (instance.transition.to < 3) {
          this.setInstanceFade(instance, instance.transition.to, progress);
        }
      }
    }
  }

  /**
   * Set instance to a specific LOD level.
   */
  private async setInstanceLOD(
    instance: RockInstance,
    lod: number,
    fadeIn: boolean,
  ): Promise<void> {
    const presetData = this.presetMeshes.get(instance.presetName);
    if (!presetData) return;

    instance.currentLOD = lod;

    if (lod === 4) {
      // Culled - remove from all meshes
      return;
    }

    // Get the mesh for this LOD
    const meshKey = lod < 3 ? LOD_KEYS[lod] : null;

    if (lod < 3 && meshKey) {
      const meshData = presetData[meshKey];
      if (meshData) {
        const idx = this.addToMesh(meshData, instance.id);
        instance.lodIndices[lod] = idx;

        // Set transform
        this.tempPosition.copy(instance.position);
        this.tempQuat.setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          instance.rotation,
        );
        this.tempScale.set(instance.scale, instance.scale, instance.scale);
        this.tempMatrix.compose(
          this.tempPosition,
          this.tempQuat,
          this.tempScale,
        );

        meshData.mesh.setMatrixAt(idx, this.tempMatrix);
        meshData.fadeAttr.setX(idx, fadeIn ? 0 : 1);
        meshData.fadeAttr.needsUpdate = true;
        meshData.mesh.instanceMatrix.needsUpdate = true;
        meshData.dirty = true;
      }
    } else if (lod === 3 && presetData.impostor) {
      // Impostor - add to per-preset impostor mesh
      this.addToImpostorMesh(instance, presetData.impostor);
    }
  }

  /**
   * Add instance to per-preset impostor mesh.
   */
  private addToImpostorMesh(
    instance: RockInstance,
    impostorData: ImpostorMeshData,
  ): void {
    // Reuse freed index if available
    const idx =
      impostorData.freeIndices.length > 0
        ? impostorData.freeIndices.pop()!
        : impostorData.nextIdx++;

    if (idx >= IMPOSTOR_CONFIG.MAX_INSTANCES) {
      console.warn(`[ProcgenRockInstancer] Max impostor instances reached`);
      return;
    }

    instance.lodIndices[3] = idx;
    impostorData.idxToId.set(idx, instance.id);

    // Set transform - billboard position above ground
    this.tempPosition.copy(instance.position);
    this.tempPosition.y += impostorData.height * instance.scale * 0.5;
    this.tempQuat.identity(); // Billboard rotation updated in updateImpostorBillboarding
    this.tempScale.set(
      impostorData.width * instance.scale,
      impostorData.height * instance.scale,
      1,
    );
    this.tempMatrix.compose(this.tempPosition, this.tempQuat, this.tempScale);
    impostorData.mesh.setMatrixAt(idx, this.tempMatrix);

    impostorData.count = Math.max(impostorData.count, idx + 1);
    impostorData.mesh.count = impostorData.count;
    impostorData.mesh.instanceMatrix.needsUpdate = true;
    impostorData.dirty = true;
  }

  /**
   * Remove instance from per-preset impostor mesh.
   */
  private removeFromImpostorMesh(instance: RockInstance): void {
    const idx = instance.lodIndices[3];
    if (idx < 0) return;

    const presetData = this.presetMeshes.get(instance.presetName);
    if (!presetData?.impostor) return;

    const impostorData = presetData.impostor;
    impostorData.mesh.setMatrixAt(idx, this.zeroMatrix);
    impostorData.mesh.instanceMatrix.needsUpdate = true;
    impostorData.idxToId.delete(idx);
    impostorData.freeIndices.push(idx);
    impostorData.dirty = true;

    instance.lodIndices[3] = -1;
  }

  /**
   * Set fade value for an instance at a specific LOD.
   */
  private setInstanceFade(
    instance: RockInstance,
    lod: number,
    fade: number,
  ): void {
    const presetData = this.presetMeshes.get(instance.presetName);
    if (!presetData) return;

    const idx = instance.lodIndices[lod];
    if (idx < 0) return;

    if (lod < 3) {
      const meshData = presetData[LOD_KEYS[lod]];
      if (meshData && idx < meshData.fadeAttr.count) {
        meshData.fadeAttr.setX(idx, fade);
        meshData.fadeAttr.needsUpdate = true;
        meshData.dirty = true;
      }
    }
  }

  /**
   * Add instance to a mesh's buffer, reusing freed indices when available.
   */
  private addToMesh(meshData: MeshData, id: string): number {
    // Reuse freed index if available, otherwise allocate new
    const idx =
      meshData.freeIndices.length > 0
        ? meshData.freeIndices.pop()!
        : meshData.nextIdx++;

    meshData.idxToId.set(idx, id);
    meshData.count = Math.max(meshData.count, idx + 1);
    meshData.mesh.count = meshData.count;
    return idx;
  }

  /**
   * Remove instance from a LOD mesh, recycling its index.
   */
  private removeFromLODMesh(instance: RockInstance, lod: number): void {
    if (lod >= 3) return; // Impostor handled by atlased manager
    const idx = instance.lodIndices[lod];
    if (idx < 0) return;

    const presetData = this.presetMeshes.get(instance.presetName);
    if (!presetData) return;

    const meshData = presetData[LOD_KEYS[lod]];
    if (meshData) {
      this.tempMatrix.makeScale(0, 0, 0);
      meshData.mesh.setMatrixAt(idx, this.tempMatrix);
      meshData.mesh.instanceMatrix.needsUpdate = true;
      meshData.idxToId.delete(idx);
      meshData.freeIndices.push(idx); // Recycle the index
      meshData.dirty = true;
    }

    instance.lodIndices[lod] = -1;
  }

  /**
   * Commit changes to dirty meshes.
   */
  private commitDirtyMeshes(): void {
    for (const presetData of this.presetMeshes.values()) {
      if (presetData.lod0?.dirty) {
        presetData.lod0.mesh.instanceMatrix.needsUpdate = true;
        presetData.lod0.dirty = false;
      }
      if (presetData.lod1?.dirty) {
        presetData.lod1.mesh.instanceMatrix.needsUpdate = true;
        presetData.lod1.dirty = false;
      }
      if (presetData.lod2?.dirty) {
        presetData.lod2.mesh.instanceMatrix.needsUpdate = true;
        presetData.lod2.dirty = false;
      }
      if (presetData.impostor?.dirty) {
        presetData.impostor.mesh.instanceMatrix.needsUpdate = true;
        presetData.impostor.dirty = false;
      }
    }
  }

  /**
   * Get instance count.
   */
  getInstanceCount(): number {
    return this.instances.size;
  }

  /**
   * Get stats for debugging.
   */
  getStats(): {
    totalInstances: number;
    lodCounts: [number, number, number, number, number];
    presetCount: number;
  } {
    const lodCounts: [number, number, number, number, number] = [0, 0, 0, 0, 0];

    for (const instance of this.instances.values()) {
      lodCounts[instance.currentLOD]++;
    }

    return {
      totalInstances: this.instances.size,
      lodCounts,
      presetCount: this.presetMeshes.size,
    };
  }

  /**
   * Get all rock instance positions and radii for grass exclusion.
   * Used by ProceduralGrass to exclude grass under rocks.
   */
  getInstancesForGrassExclusion(): Array<{
    position: THREE.Vector3;
    radius: number;
  }> {
    const result: Array<{ position: THREE.Vector3; radius: number }> = [];
    for (const instance of this.instances.values()) {
      result.push({
        position: instance.position,
        radius: instance.radius,
      });
    }
    return result;
  }

  /**
   * Pre-warm the impostor cache for specified rock presets.
   * This loads/bakes impostors ahead of time for faster initial rendering.
   */
  async preWarmImpostorCache(presetNames: string[]): Promise<void> {
    // Ensure all presets are loaded first
    const loadPromises = presetNames.map((name) =>
      this.ensurePresetLoaded(name),
    );
    await Promise.all(loadPromises);

    console.log(
      `[ProcgenRockInstancer] Pre-warmed impostor cache for ${presetNames.length} presets`,
    );
  }

  /**
   * Dispose all resources.
   */
  dispose(): void {
    for (const presetData of this.presetMeshes.values()) {
      if (presetData.lod0) {
        this.scene.remove(presetData.lod0.mesh);
        presetData.lod0.mesh.dispose();
      }
      if (presetData.lod1) {
        this.scene.remove(presetData.lod1.mesh);
        presetData.lod1.mesh.dispose();
      }
      if (presetData.lod2) {
        this.scene.remove(presetData.lod2.mesh);
        presetData.lod2.mesh.dispose();
      }
      if (presetData.impostor) {
        this.scene.remove(presetData.impostor.mesh);
        presetData.impostor.mesh.dispose();
        presetData.impostor.geometry.dispose();
        presetData.impostor.material.dispose();
      }
    }

    this.presetMeshes.clear();
    this.instances.clear();
    this.updateQueue = [];

    ProcgenRockInstancer.instance = null;
  }
}
