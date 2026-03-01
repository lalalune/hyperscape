/**
 * GLBResourceInstancer — InstancedMesh-based rendering for GLB-loaded resources
 * (rocks, ores, herbs, and any non-tree, non-fishing-spot resource with a model).
 *
 * Modeled on GLBTreeInstancer: loads each model once, extracts geometry by
 * reference, and renders all instances of that model via a single
 * THREE.InstancedMesh per LOD level (LOD0 / LOD1 / LOD2).
 *
 * Distance-based LOD switching per-instance happens every frame by moving
 * instances between pools (matrix swap-and-pop).
 *
 * InstancedModelVisualStrategy calls addInstance / removeInstance / setDepleted.
 *
 * @module GLBResourceInstancer
 */

import THREE from "../../../extras/three/three";
import type { World } from "../../../core/World";
import { modelCache } from "../../../utils/rendering/ModelCache";
import {
  createDissolveMaterial,
  getLODDistances,
  GPU_VEG_CONFIG,
  type DissolveMaterial,
} from "./GPUVegetation";

const MAX_INSTANCES = 512;

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _swapMatrix = new THREE.Matrix4();

interface ResourceSlot {
  entityId: string;
  position: THREE.Vector3;
  rotation: number;
  scale: number;
  depletedScale: number;
  yOffset: number;
  currentLOD: 0 | 1 | 2;
  depleted: boolean;
}

interface LODPool {
  mesh: THREE.InstancedMesh;
  material: DissolveMaterial;
  slots: Map<string, number>;
  activeCount: number;
  dirty: boolean;
}

interface ModelPool {
  modelPath: string;
  lod0: LODPool | null;
  lod1: LODPool | null;
  lod2: LODPool | null;
  depleted: LODPool | null;
  instances: Map<string, ResourceSlot>;
  yOffset: number;
  depletedYOffset: number;
  highlightMesh: THREE.Mesh | null;
  depletedHighlightMesh: THREE.Mesh | null;
}

const resourceLOD = getLODDistances("resource");

let scene: THREE.Scene | null = null;
let world: World | null = null;
const pools = new Map<string, ModelPool>();
const entityToModel = new Map<string, string>();

function inferLOD1Path(lod0Path: string): string {
  return lod0Path.replace(/\.glb$/i, "_lod1.glb");
}
function inferLOD2Path(lod0Path: string): string {
  return lod0Path.replace(/\.glb$/i, "_lod2.glb");
}

function extractGeometryAndMaterial(
  root: THREE.Object3D,
): { geometry: THREE.BufferGeometry; material: THREE.Material } | null {
  let result: {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
  } | null = null;
  root.traverse((child) => {
    if (result) return;
    if (child instanceof THREE.Mesh && child.geometry) {
      result = {
        geometry: child.geometry,
        material: Array.isArray(child.material)
          ? child.material[0]
          : child.material,
      };
    }
  });
  return result;
}

function createSharedGeometry(
  source: THREE.BufferGeometry,
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  for (const name in source.attributes) {
    geo.setAttribute(name, source.attributes[name]);
  }
  if (source.index) geo.setIndex(source.index);
  if (source.morphAttributes) {
    for (const name in source.morphAttributes) {
      geo.morphAttributes[name] = source.morphAttributes[name];
    }
  }
  if (source.boundingBox) geo.boundingBox = source.boundingBox.clone();
  if (source.boundingSphere) geo.boundingSphere = source.boundingSphere.clone();
  return geo;
}

function computeYOffset(root: THREE.Object3D, scale: number): number {
  const saved = root.scale.clone();
  root.scale.set(scale, scale, scale);
  const bbox = new THREE.Box3().setFromObject(root);
  root.scale.copy(saved);
  return -bbox.min.y;
}

// ---------------------------------------------------------------------------
// LODPool creation
// ---------------------------------------------------------------------------

function createLODPool(
  geometry: THREE.BufferGeometry,
  material: DissolveMaterial,
): LODPool {
  const geo = createSharedGeometry(geometry);
  const mesh = new THREE.InstancedMesh(geo, material, MAX_INSTANCES);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.layers.set(1);
  scene!.add(mesh);

  return { mesh, material, slots: new Map(), activeCount: 0, dirty: false };
}

async function loadLODModel(path: string): Promise<{
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
} | null> {
  try {
    const { scene: lodScene } = await modelCache.loadModel(path, world!);
    return extractGeometryAndMaterial(lodScene);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Model pool lifecycle
// ---------------------------------------------------------------------------

const pendingEnsure = new Map<string, Promise<ModelPool>>();

function createHighlightMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.Mesh {
  const geo = createSharedGeometry(geometry);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.layers.set(1);
  mesh.visible = true;
  return mesh;
}

async function ensureModelPool(
  modelPath: string,
  depletedModelPath?: string | null,
): Promise<ModelPool> {
  const existing = pools.get(modelPath);
  if (existing) {
    if (depletedModelPath && !existing.depleted) {
      await loadDepletedPool(existing, depletedModelPath);
    }
    return existing;
  }

  const pending = pendingEnsure.get(modelPath);
  if (pending) return pending;

  const promise = (async (): Promise<ModelPool> => {
    const { scene: lod0Scene } = await modelCache.loadModel(modelPath, world!);
    const lod0Data = extractGeometryAndMaterial(lod0Scene);
    if (!lod0Data) throw new Error(`No mesh found in ${modelPath}`);

    const yOffset = computeYOffset(lod0Scene, 1);

    const lod0Material = createDissolveMaterial(lod0Data.material, {
      fadeStart: GPU_VEG_CONFIG.FADE_START,
      fadeEnd: GPU_VEG_CONFIG.FADE_END,
      enableNearFade: false,
      enableWaterCulling: false,
      enableOcclusionDissolve: false,
    });
    world!.setupMaterial(lod0Material);
    const lod0Pool = createLODPool(lod0Data.geometry, lod0Material);

    const highlightMesh = createHighlightMesh(
      lod0Data.geometry,
      lod0Data.material,
    );

    let lod1Pool: LODPool | null = null;
    const lod1Data = await loadLODModel(inferLOD1Path(modelPath));
    if (lod1Data) {
      const lod1Material = createDissolveMaterial(lod1Data.material, {
        fadeStart: GPU_VEG_CONFIG.FADE_START,
        fadeEnd: GPU_VEG_CONFIG.FADE_END,
        enableNearFade: false,
        enableWaterCulling: false,
        enableOcclusionDissolve: false,
      });
      world!.setupMaterial(lod1Material);
      lod1Pool = createLODPool(lod1Data.geometry, lod1Material);
    }

    let lod2Pool: LODPool | null = null;
    const lod2Data = await loadLODModel(inferLOD2Path(modelPath));
    if (lod2Data) {
      const lod2Material = createDissolveMaterial(lod2Data.material, {
        fadeStart: GPU_VEG_CONFIG.FADE_START,
        fadeEnd: GPU_VEG_CONFIG.FADE_END,
        enableNearFade: false,
        enableWaterCulling: false,
        enableOcclusionDissolve: false,
      });
      world!.setupMaterial(lod2Material);
      lod2Pool = createLODPool(lod2Data.geometry, lod2Material);
    }

    const pool: ModelPool = {
      modelPath,
      lod0: lod0Pool,
      lod1: lod1Pool,
      lod2: lod2Pool,
      depleted: null,
      instances: new Map(),
      yOffset,
      depletedYOffset: 0,
      highlightMesh,
      depletedHighlightMesh: null,
    };
    pools.set(modelPath, pool);

    if (depletedModelPath) {
      await loadDepletedPool(pool, depletedModelPath);
    }

    return pool;
  })();

  pendingEnsure.set(modelPath, promise);
  try {
    return await promise;
  } finally {
    pendingEnsure.delete(modelPath);
  }
}

async function loadDepletedPool(
  pool: ModelPool,
  depletedModelPath: string,
): Promise<void> {
  if (pool.depleted) return;
  const depletedData = await loadLODModel(depletedModelPath);
  if (!depletedData) return;

  let depletedYOffset = 0;
  try {
    const { scene: depScene } = await modelCache.loadModel(
      depletedModelPath,
      world!,
    );
    depletedYOffset = computeYOffset(depScene, 1);
  } catch {
    /* use 0 */
  }

  const depletedMaterial = createDissolveMaterial(depletedData.material, {
    fadeStart: GPU_VEG_CONFIG.FADE_START,
    fadeEnd: GPU_VEG_CONFIG.FADE_END,
    enableNearFade: false,
    enableWaterCulling: false,
    enableOcclusionDissolve: false,
  });
  world!.setupMaterial(depletedMaterial);
  pool.depleted = createLODPool(depletedData.geometry, depletedMaterial);
  pool.depletedYOffset = depletedYOffset;
  pool.depletedHighlightMesh = createHighlightMesh(
    depletedData.geometry,
    depletedData.material,
  );
}

// ---------------------------------------------------------------------------
// Instance matrix helpers
// ---------------------------------------------------------------------------

function composeInstanceMatrix(
  position: THREE.Vector3,
  rotation: number,
  scale: number,
  yOffset: number,
): THREE.Matrix4 {
  _position.set(position.x, position.y + yOffset * scale, position.z);
  _quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotation);
  _scale.set(scale, scale, scale);
  return _matrix.compose(_position, _quaternion, _scale);
}

function addToPool(pool: LODPool, entityId: string, mat: THREE.Matrix4): void {
  const idx = pool.activeCount;
  pool.mesh.setMatrixAt(idx, mat);
  pool.slots.set(entityId, idx);
  pool.activeCount++;
  pool.mesh.count = pool.activeCount;
  pool.dirty = true;
}

function removeFromPool(pool: LODPool, entityId: string): void {
  const idx = pool.slots.get(entityId);
  if (idx === undefined) return;

  const lastIdx = pool.activeCount - 1;
  if (idx !== lastIdx) {
    pool.mesh.getMatrixAt(lastIdx, _swapMatrix);
    pool.mesh.setMatrixAt(idx, _swapMatrix);

    for (const [eid, eidIdx] of pool.slots) {
      if (eidIdx === lastIdx) {
        pool.slots.set(eid, idx);
        break;
      }
    }
  }

  pool.slots.delete(entityId);
  pool.activeCount--;
  pool.mesh.count = pool.activeCount;
  pool.dirty = true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initGLBResourceInstancer(s: THREE.Scene, w: World): void {
  scene = s;
  world = w;
}

export function destroyGLBResourceInstancer(): void {
  for (const pool of pools.values()) {
    for (const lodPool of [pool.lod0, pool.lod1, pool.lod2, pool.depleted]) {
      if (!lodPool) continue;
      scene?.remove(lodPool.mesh);
      lodPool.mesh.geometry.dispose();
      lodPool.material.dispose();
    }
    if (pool.highlightMesh) pool.highlightMesh.geometry.dispose();
    if (pool.depletedHighlightMesh)
      pool.depletedHighlightMesh.geometry.dispose();
  }
  pools.clear();
  entityToModel.clear();
  pendingEnsure.clear();
  scene = null;
  world = null;
}

export async function addInstance(
  modelPath: string,
  entityId: string,
  position: THREE.Vector3,
  rotation: number,
  scale: number,
  depletedModelPath?: string | null,
  depletedScale?: number,
): Promise<boolean> {
  if (!scene || !world) return false;

  try {
    const pool = await ensureModelPool(modelPath, depletedModelPath);

    if (pool.lod0 && pool.lod0.activeCount >= MAX_INSTANCES) {
      console.warn(
        `[GLBResourceInstancer] LOD0 pool full for ${modelPath}, cannot add ${entityId}`,
      );
      return false;
    }

    const slot: ResourceSlot = {
      entityId,
      position: position.clone(),
      rotation,
      scale,
      depletedScale: depletedScale ?? scale,
      yOffset: pool.yOffset,
      currentLOD: 0,
      depleted: false,
    };

    pool.instances.set(entityId, slot);
    entityToModel.set(entityId, modelPath);

    const mat = composeInstanceMatrix(position, rotation, scale, pool.yOffset);
    addToPool(pool.lod0!, entityId, mat);

    return true;
  } catch (error) {
    console.warn(
      `[GLBResourceInstancer] Failed to add instance ${entityId}:`,
      error,
    );
    return false;
  }
}

export function removeInstance(entityId: string): void {
  const modelPath = entityToModel.get(entityId);
  if (!modelPath) return;

  const pool = pools.get(modelPath);
  if (!pool) return;

  const slot = pool.instances.get(entityId);
  if (!slot) return;

  const lodPool =
    slot.currentLOD === 0
      ? pool.lod0
      : slot.currentLOD === 1
        ? pool.lod1
        : pool.lod2;
  if (lodPool) removeFromPool(lodPool, entityId);

  pool.instances.delete(entityId);
  entityToModel.delete(entityId);
}

export function setDepleted(entityId: string, depleted: boolean): void {
  const modelPath = entityToModel.get(entityId);
  if (!modelPath) return;

  const pool = pools.get(modelPath);
  if (!pool) return;

  const slot = pool.instances.get(entityId);
  if (!slot || slot.depleted === depleted) return;

  const oldHlMesh = slot.depleted
    ? pool.depletedHighlightMesh
    : pool.highlightMesh;
  if (oldHlMesh?.parent) {
    oldHlMesh.parent.remove(oldHlMesh);
  }

  slot.depleted = depleted;

  if (depleted) {
    const lodPool =
      slot.currentLOD === 0
        ? pool.lod0
        : slot.currentLOD === 1
          ? pool.lod1
          : pool.lod2;
    if (lodPool) removeFromPool(lodPool, entityId);

    if (pool.depleted) {
      const mat = composeInstanceMatrix(
        slot.position,
        slot.rotation,
        slot.depletedScale,
        pool.depletedYOffset,
      );
      addToPool(pool.depleted, entityId, mat);
    }
  } else {
    if (pool.depleted) {
      removeFromPool(pool.depleted, entityId);
    }

    const mat = composeInstanceMatrix(
      slot.position,
      slot.rotation,
      slot.scale,
      slot.yOffset,
    );
    const lodPool =
      slot.currentLOD === 0
        ? pool.lod0
        : slot.currentLOD === 1
          ? pool.lod1
          : pool.lod2;
    if (lodPool) addToPool(lodPool, entityId, mat);
  }
}

export function hasInstance(entityId: string): boolean {
  return entityToModel.has(entityId);
}

export function hasDepleted(entityId: string): boolean {
  const modelPath = entityToModel.get(entityId);
  if (!modelPath) return false;
  const pool = pools.get(modelPath);
  return !!pool?.depleted;
}

export function getHighlightMesh(entityId: string): THREE.Object3D | null {
  const modelPath = entityToModel.get(entityId);
  if (!modelPath) return null;

  const pool = pools.get(modelPath);
  if (!pool) return null;

  const slot = pool.instances.get(entityId);
  if (!slot) return null;

  const mesh = slot.depleted ? pool.depletedHighlightMesh : pool.highlightMesh;
  if (!mesh) return null;

  const s = slot.depleted ? slot.depletedScale : slot.scale;
  const yOff = slot.depleted ? pool.depletedYOffset : pool.yOffset;
  mesh.position.set(
    slot.position.x,
    slot.position.y + yOff * s,
    slot.position.z,
  );
  mesh.rotation.set(0, slot.rotation, 0);
  mesh.scale.set(s, s, s);
  mesh.updateMatrixWorld(true);

  return mesh;
}

let lastUpdateFrame = -1;

export function updateGLBResourceInstancer(): void {
  if (!world) return;
  if (world.frame === lastUpdateFrame) return;
  lastUpdateFrame = world.frame;

  const camera = world.camera;
  if (!camera) return;

  const camPos = camera.position;
  const lod1DistSq = resourceLOD.lod1DistanceSq;
  const lod2DistSq = resourceLOD.lod2DistanceSq;
  const hysteresisSq = 0.81;

  for (const pool of pools.values()) {
    for (const slot of pool.instances.values()) {
      if (slot.depleted) continue;

      const dx = camPos.x - slot.position.x;
      const dz = camPos.z - slot.position.z;
      const distSq = dx * dx + dz * dz;

      let targetLOD: 0 | 1 | 2;
      if (distSq < lod1DistSq * hysteresisSq) {
        targetLOD = 0;
      } else if (distSq < lod1DistSq) {
        targetLOD = slot.currentLOD === 0 ? 0 : pool.lod1 ? 1 : 0;
      } else if (distSq < lod2DistSq * hysteresisSq) {
        targetLOD = pool.lod1 ? 1 : 0;
      } else if (distSq < lod2DistSq) {
        if (slot.currentLOD <= 1) {
          targetLOD = pool.lod1 ? 1 : 0;
        } else {
          targetLOD = pool.lod2 ? 2 : pool.lod1 ? 1 : 0;
        }
      } else {
        targetLOD = pool.lod2 ? 2 : pool.lod1 ? 1 : 0;
      }

      if (targetLOD === slot.currentLOD) continue;

      const oldPool =
        slot.currentLOD === 0
          ? pool.lod0
          : slot.currentLOD === 1
            ? pool.lod1
            : pool.lod2;
      const newPool =
        targetLOD === 0 ? pool.lod0 : targetLOD === 1 ? pool.lod1 : pool.lod2;

      if (oldPool) removeFromPool(oldPool, slot.entityId);
      if (newPool) {
        const mat = composeInstanceMatrix(
          slot.position,
          slot.rotation,
          slot.scale,
          slot.yOffset,
        );
        addToPool(newPool, slot.entityId, mat);
      }
      slot.currentLOD = targetLOD;
    }
  }

  const camY = camPos.y;
  const players = world.getPlayers();
  const localPlayer = players && players.length > 0 ? players[0] : null;
  const playerPos = localPlayer?.node?.position ?? camPos;

  for (const pool of pools.values()) {
    for (const lodPool of [pool.lod0, pool.lod1, pool.lod2, pool.depleted]) {
      if (!lodPool) continue;

      if (lodPool.dirty) {
        lodPool.mesh.instanceMatrix.needsUpdate = true;
        lodPool.dirty = false;
      }

      lodPool.material.dissolveUniforms.cameraPos.value.set(
        camPos.x,
        camY,
        camPos.z,
      );
      lodPool.material.dissolveUniforms.playerPos.value.set(
        playerPos.x,
        playerPos.y,
        playerPos.z,
      );
    }
  }
}
