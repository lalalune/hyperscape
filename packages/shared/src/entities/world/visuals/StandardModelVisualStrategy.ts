/**
 * StandardModelVisualStrategy — GLB model clone + dissolve + LOD1/LOD2 + HLOD.
 *
 * Used for rocks, herbs, and any non-tree, non-fishing-spot resource that has
 * a `config.model` path. Also serves as the fallback for trees when instancing
 * is unavailable.
 */

import THREE from "../../../extras/three/three";
import { modelCache } from "../../../utils/rendering/ModelCache";
import {
  createDissolveMaterial,
  isDissolveMaterial,
  getLODDistances,
  GPU_VEG_CONFIG,
  type DissolveMaterial,
} from "../../../systems/shared/world/GPUVegetation";
import { getCameraPosition } from "../../../utils/rendering/AnimationLOD";
import type {
  ResourceVisualContext,
  ResourceVisualStrategy,
} from "./ResourceVisualStrategy";

// ---------------------------------------------------------------------------
// LOD configuration
// ---------------------------------------------------------------------------

const DEFAULT_RESOURCE_LOD = getLODDistances("resource");
const SKIP_LOD_TYPES = new Set(["herb", "fishing_spot"]);

function inferLOD1Path(p: string): string {
  return p.replace(/\.glb$/i, "_lod1.glb");
}
function inferLOD2Path(p: string): string {
  return p.replace(/\.glb$/i, "_lod2.glb");
}

// ---------------------------------------------------------------------------
// Shared LOD caches (one entry per model path, shared across all entities)
// ---------------------------------------------------------------------------

interface LODCacheEntry {
  geometry: THREE.BufferGeometry;
  originalMaterial: THREE.Material;
  dissolveMaterial: DissolveMaterial;
  refCount: number;
}

const lod1MeshCache = new Map<string, LODCacheEntry | null>();
const lod2MeshCache = new Map<string, LODCacheEntry | null>();
const activeLOD1Materials = new Set<DissolveMaterial>();
const activeLOD2Materials = new Set<DissolveMaterial>();
const pendingLOD1Loads = new Map<string, Promise<void>>();
const pendingLOD2Loads = new Map<string, Promise<void>>();
const lastLODCameraPos = new THREE.Vector3(Infinity, 0, Infinity);
const lastLODPlayerPos = new THREE.Vector3(Infinity, 0, Infinity);

function updateSharedLODMaterials(
  cameraPos: { x: number; y?: number; z: number },
  playerPos: { x: number; y?: number; z: number },
): void {
  const cdx = cameraPos.x - lastLODCameraPos.x;
  const cdz = cameraPos.z - lastLODCameraPos.z;
  const pdx = playerPos.x - lastLODPlayerPos.x;
  const pdz = playerPos.z - lastLODPlayerPos.z;
  if (cdx * cdx + cdz * cdz < 1 && pdx * pdx + pdz * pdz < 1) return;

  const camY = cameraPos.y ?? 0;
  const plrY = playerPos.y ?? 0;
  lastLODCameraPos.set(cameraPos.x, camY, cameraPos.z);
  lastLODPlayerPos.set(playerPos.x, plrY, playerPos.z);

  for (const mat of activeLOD1Materials) {
    mat.dissolveUniforms.playerPos.value.set(playerPos.x, plrY, playerPos.z);
    mat.dissolveUniforms.cameraPos.value.set(cameraPos.x, camY, cameraPos.z);
  }
  for (const mat of activeLOD2Materials) {
    mat.dissolveUniforms.playerPos.value.set(playerPos.x, plrY, playerPos.z);
    mat.dissolveUniforms.cameraPos.value.set(cameraPos.x, camY, cameraPos.z);
  }
}

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------

export class StandardModelVisualStrategy implements ResourceVisualStrategy {
  private dissolveMaterials: DissolveMaterial[] = [];
  private dissolveInitialized = false;
  private currentLOD: 0 | 1 | 2 = 0;
  private lastCameraPos = new THREE.Vector3();

  // ---- createVisual ----

  async createVisual(ctx: ResourceVisualContext): Promise<void> {
    const { config, world, node, id } = ctx;
    if (!config.model || !world.loader) return;

    const { scene } = await modelCache.loadModel(config.model, world);
    const mesh = scene;
    mesh.name = `Resource_${config.resourceType}`;

    let modelScale = config.modelScale ?? 1.0;
    if (config.modelScale === undefined && config.resourceType === "tree") {
      modelScale = 3.0;
    }
    mesh.scale.set(modelScale, modelScale, modelScale);

    mesh.layers.set(1);
    mesh.traverse((child) => {
      child.layers.set(1);
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    mesh.userData = {
      type: "resource",
      entityId: id,
      name: config.name,
      interactable: true,
      resourceType: config.resourceType,
      depleted: config.depleted,
    };

    const bbox = new THREE.Box3().setFromObject(mesh);
    mesh.position.set(0, -bbox.min.y, 0);

    ctx.setMesh(mesh);
    node.add(mesh);

    this.applyDissolveMaterials(ctx);

    const modelId = `resource_${config.resourceType}_${config.model || "default"}`;
    await ctx.initHLOD(modelId, {
      category: "resource",
      atlasSize: 512,
      hemisphere: true,
    });

    await Promise.all([
      this.loadLOD1(ctx, modelScale),
      this.loadLOD2(ctx, modelScale),
    ]);
  }

  // ---- depletion / respawn ----

  async onDepleted(): Promise<boolean> {
    return false;
  }

  async onRespawn(ctx: ResourceVisualContext): Promise<void> {
    // Reload the full model
    await this.createVisual(ctx);
  }

  // ---- per-frame update ----

  update(ctx: ResourceVisualContext): void {
    this.updateLODAndDissolve(ctx);
  }

  // ---- destroy ----

  destroy(ctx: ResourceVisualContext): void {
    this.dissolveMaterials = [];
    this.dissolveInitialized = false;

    const lod1 = ctx.getLod1Mesh();
    if (lod1) {
      const modelPath = ctx.config.model;
      if (modelPath) {
        const cached = lod1MeshCache.get(modelPath);
        if (cached) cached.refCount--;
      }
      ctx.node.remove(lod1);
      ctx.setLod1Mesh(undefined);
    }

    const lod2 = ctx.getLod2Mesh();
    if (lod2) {
      const modelPath = ctx.config.model;
      if (modelPath) {
        const cached = lod2MeshCache.get(modelPath);
        if (cached) cached.refCount--;
      }
      ctx.node.remove(lod2);
      ctx.setLod2Mesh(undefined);
    }
  }

  // ---- dissolve materials ----

  private applyDissolveMaterials(ctx: ResourceVisualContext): void {
    const mesh = ctx.getMesh();
    if (!mesh || ctx.world.isServer || this.dissolveInitialized) return;

    this.dissolveInitialized = true;
    this.dissolveMaterials = [];

    mesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.material) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      const newMaterials: THREE.Material[] = [];

      for (const mat of materials) {
        if (isDissolveMaterial(mat)) {
          newMaterials.push(mat);
          continue;
        }
        const dissolveMat = createDissolveMaterial(mat, {
          fadeStart: GPU_VEG_CONFIG.FADE_START,
          fadeEnd: GPU_VEG_CONFIG.FADE_END,
          enableNearFade: false,
          enableWaterCulling: false,
          enableOcclusionDissolve: false,
        });
        ctx.world.setupMaterial(dissolveMat);
        this.dissolveMaterials.push(dissolveMat);
        newMaterials.push(dissolveMat);
      }

      child.material =
        newMaterials.length === 1 ? newMaterials[0] : newMaterials;
    });
  }

  // ---- LOD ----

  private updateLODAndDissolve(ctx: ResourceVisualContext): void {
    const cameraPosXZ = getCameraPosition(ctx.world);
    if (!cameraPosXZ) return;

    const cameraY = ctx.world.camera?.position?.y ?? 0;
    const cameraPos = { x: cameraPosXZ.x, y: cameraY, z: cameraPosXZ.z };

    const players = ctx.world.getPlayers();
    const localPlayer = players && players.length > 0 ? players[0] : null;
    const playerNodePos = localPlayer?.node?.position;
    const playerPos = playerNodePos
      ? { x: playerNodePos.x, y: playerNodePos.y, z: playerNodePos.z }
      : cameraPos;

    const worldPos = ctx.node.position;
    const dx = cameraPos.x - worldPos.x;
    const dz = cameraPos.z - worldPos.z;
    const distSq = dx * dx + dz * dz;

    const lodConfig = ctx.config.lodConfig || {};
    const lod1Distance =
      lodConfig.lod1Distance ?? DEFAULT_RESOURCE_LOD.lod1Distance;
    const lod2Distance =
      lodConfig.lod2Distance ?? DEFAULT_RESOURCE_LOD.lod2Distance;
    const lod1DistSq = lod1Distance * lod1Distance;
    const lod2DistSq = lod2Distance * lod2Distance;
    const hysteresisSq = 0.81;

    const lod1Mesh = ctx.getLod1Mesh();
    const lod2Mesh = ctx.getLod2Mesh();
    const hasLOD1 = !!lod1Mesh;
    const hasLOD2 = !!lod2Mesh;
    let targetLOD: 0 | 1 | 2;

    if (distSq < lod1DistSq * hysteresisSq) {
      targetLOD = 0;
    } else if (distSq < lod1DistSq) {
      targetLOD = this.currentLOD === 0 ? 0 : hasLOD1 ? 1 : 0;
    } else if (distSq < lod2DistSq * hysteresisSq) {
      targetLOD = hasLOD1 ? 1 : 0;
    } else if (distSq < lod2DistSq) {
      if (this.currentLOD <= 1) {
        targetLOD = hasLOD1 ? 1 : 0;
      } else {
        targetLOD = hasLOD2 ? 2 : hasLOD1 ? 1 : 0;
      }
    } else {
      targetLOD = hasLOD2 ? 2 : hasLOD1 ? 1 : 0;
    }

    const mesh = ctx.getMesh();
    if (targetLOD !== this.currentLOD && mesh) {
      mesh.visible = false;
      if (lod1Mesh) lod1Mesh.visible = false;
      if (lod2Mesh) lod2Mesh.visible = false;

      if (targetLOD === 0) {
        mesh.visible = true;
      } else if (targetLOD === 1 && lod1Mesh) {
        lod1Mesh.visible = true;
      } else if (targetLOD === 2 && lod2Mesh) {
        lod2Mesh.visible = true;
      } else {
        if (lod1Mesh) lod1Mesh.visible = true;
        else mesh.visible = true;
      }
      this.currentLOD = targetLOD;
    }

    updateSharedLODMaterials(cameraPos, playerPos);

    if (this.dissolveMaterials.length === 0) return;

    const ddx = cameraPos.x - this.lastCameraPos.x;
    const ddz = cameraPos.z - this.lastCameraPos.z;
    if (ddx * ddx + ddz * ddz < 1) return;
    this.lastCameraPos.set(cameraPos.x, 0, cameraPos.z);

    for (const mat of this.dissolveMaterials) {
      mat.dissolveUniforms.playerPos.value.set(
        playerPos.x,
        playerPos.y,
        playerPos.z,
      );
      mat.dissolveUniforms.cameraPos.value.set(
        cameraPos.x,
        cameraPos.y,
        cameraPos.z,
      );
    }
  }

  // ---- LOD1 / LOD2 loading ----

  private async loadLOD1(
    ctx: ResourceVisualContext,
    lod0Scale: number,
  ): Promise<void> {
    if (ctx.world.isServer) return;
    const modelPath = ctx.config.model;
    if (!modelPath) return;
    if (SKIP_LOD_TYPES.has(ctx.config.resourceType)) return;

    if (lod1MeshCache.has(modelPath)) {
      const cached = lod1MeshCache.get(modelPath);
      if (cached) this.createLODMesh(ctx, cached, lod0Scale, "lod1");
      return;
    }

    const pending = pendingLOD1Loads.get(modelPath);
    if (pending) {
      await pending;
      const cached = lod1MeshCache.get(modelPath);
      if (cached) this.createLODMesh(ctx, cached, lod0Scale, "lod1");
      return;
    }

    const loadPromise = this.loadAndCacheLOD(
      ctx,
      modelPath,
      inferLOD1Path(modelPath),
      lod1MeshCache,
      activeLOD1Materials,
      lod0Scale,
      "lod1",
    );
    pendingLOD1Loads.set(modelPath, loadPromise);
    try {
      await loadPromise;
    } finally {
      pendingLOD1Loads.delete(modelPath);
    }
  }

  private async loadLOD2(
    ctx: ResourceVisualContext,
    lod0Scale: number,
  ): Promise<void> {
    if (ctx.world.isServer) return;
    const modelPath = ctx.config.model;
    if (!modelPath) return;
    if (SKIP_LOD_TYPES.has(ctx.config.resourceType)) return;

    if (lod2MeshCache.has(modelPath)) {
      const cached = lod2MeshCache.get(modelPath);
      if (cached) this.createLODMesh(ctx, cached, lod0Scale, "lod2");
      return;
    }

    const pending = pendingLOD2Loads.get(modelPath);
    if (pending) {
      await pending;
      const cached = lod2MeshCache.get(modelPath);
      if (cached) this.createLODMesh(ctx, cached, lod0Scale, "lod2");
      return;
    }

    const loadPromise = this.loadAndCacheLOD(
      ctx,
      modelPath,
      inferLOD2Path(modelPath),
      lod2MeshCache,
      activeLOD2Materials,
      lod0Scale,
      "lod2",
    );
    pendingLOD2Loads.set(modelPath, loadPromise);
    try {
      await loadPromise;
    } finally {
      pendingLOD2Loads.delete(modelPath);
    }
  }

  private async loadAndCacheLOD(
    ctx: ResourceVisualContext,
    modelPath: string,
    lodPath: string,
    cache: Map<string, LODCacheEntry | null>,
    activeSet: Set<DissolveMaterial>,
    lod0Scale: number,
    level: "lod1" | "lod2",
  ): Promise<void> {
    try {
      const { scene: lodScene } = await modelCache.loadModel(
        lodPath,
        ctx.world,
      );

      let foundGeometry: THREE.BufferGeometry | null = null;
      let foundMaterial: THREE.Material | null = null;
      lodScene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry && !foundGeometry) {
          foundGeometry = child.geometry;
          foundMaterial = Array.isArray(child.material)
            ? child.material[0]
            : child.material;
        }
      });

      const geometry = foundGeometry as THREE.BufferGeometry | null;
      const material = foundMaterial as THREE.Material | null;

      if (geometry && material) {
        const dissolveMaterial = createDissolveMaterial(material, {
          fadeStart: GPU_VEG_CONFIG.FADE_START,
          fadeEnd: GPU_VEG_CONFIG.FADE_END,
          enableNearFade: false,
          enableWaterCulling: false,
          enableOcclusionDissolve: false,
        });
        ctx.world.setupMaterial(dissolveMaterial);
        activeSet.add(dissolveMaterial);

        const entry: LODCacheEntry = {
          geometry,
          originalMaterial: material,
          dissolveMaterial,
          refCount: 0,
        };
        cache.set(modelPath, entry);
        this.createLODMesh(ctx, entry, lod0Scale, level);
        return;
      }
    } catch {
      // LOD file not found — normal if not baked yet
    }

    cache.set(modelPath, null);
  }

  private createLODMesh(
    ctx: ResourceVisualContext,
    cached: LODCacheEntry,
    lod0Scale: number,
    level: "lod1" | "lod2",
  ): void {
    const mesh = new THREE.Mesh(cached.geometry, cached.dissolveMaterial);
    mesh.name = `Resource${level.toUpperCase()}_${ctx.config.resourceType}`;
    cached.refCount++;

    const scaleKey = level === "lod1" ? "lod1ModelScale" : "lod2ModelScale";
    const lodScale = ctx.config[scaleKey] ?? lod0Scale;
    mesh.scale.set(lodScale, lodScale, lodScale);

    mesh.layers.set(1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.userData = {
      type: "resource",
      entityId: ctx.id,
      name: ctx.config.name,
      interactable: true,
      resourceType: ctx.config.resourceType,
      depleted: ctx.config.depleted,
    };

    const bbox = new THREE.Box3().setFromObject(mesh);
    mesh.position.set(0, -bbox.min.y, 0);
    mesh.visible = false;

    ctx.node.add(mesh);

    if (level === "lod1") ctx.setLod1Mesh(mesh);
    else ctx.setLod2Mesh(mesh);
  }
}
