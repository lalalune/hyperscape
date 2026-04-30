/**
 * Load a GLB into a Three.js Object3D suitable for adding to the
 * studio's WebGPU viewport scene. Mirrors the per-mesh material
 * conversion pattern in `WorldBuilder/GameWorldAssets.ts` —
 * MeshStandardMaterial → MeshStandardNodeMaterial — but exposed as
 * a reusable utility for surfaces (like agent-content markers)
 * that need to drop a model into a live scene.
 *
 * URL handling: `asset://models/...` → `/game-models/...` (Vite
 * proxy). Standard URLs pass through.
 *
 * Returns the cloned root scene with materials converted, ready
 * to add to a parent group. Caller owns disposal.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { texture, normalMap } from "three/tsl";

const loader = new GLTFLoader();

function resolveUrl(modelUrl: string): string {
  if (modelUrl.startsWith("asset://models/")) {
    return modelUrl.replace("asset://models/", "/game-models/");
  }
  if (modelUrl.startsWith("asset://")) {
    return modelUrl.replace("asset://", "/game-models/");
  }
  return modelUrl;
}

function toNodeMaterial(src: THREE.Material): THREE.Material {
  if (!(src instanceof THREE.MeshStandardMaterial)) return src;
  const dst = new MeshStandardNodeMaterial();
  dst.color.copy(src.color);
  dst.roughness = src.roughness;
  dst.metalness = src.metalness;
  dst.emissive.copy(src.emissive);
  dst.emissiveIntensity = src.emissiveIntensity;
  dst.side = src.side;
  dst.transparent = src.transparent;
  dst.opacity = src.opacity;
  dst.alphaTest = src.alphaTest;
  dst.depthWrite = src.depthWrite;
  if (src.map) {
    src.map.colorSpace = THREE.SRGBColorSpace;
    dst.colorNode = texture(src.map);
  }
  if (src.normalMap) dst.normalNode = normalMap(texture(src.normalMap));
  if (src.roughnessMap) dst.roughnessNode = texture(src.roughnessMap);
  if (src.metalnessMap) dst.metalnessNode = texture(src.metalnessMap);
  if (src.aoMap) dst.aoNode = texture(src.aoMap);
  if (src.emissiveMap) dst.emissiveNode = texture(src.emissiveMap);
  return dst;
}

/**
 * Load + convert. Caller is responsible for disposing geometries
 * and materials when removing the result from the scene.
 */
export async function loadModelForScene(
  modelUrl: string,
): Promise<THREE.Object3D> {
  const resolved = resolveUrl(modelUrl);
  const gltf = await loader.loadAsync(resolved);
  const root = gltf.scene;
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const raw = obj.material;
    if (Array.isArray(raw)) {
      obj.material = raw.map(toNodeMaterial);
    } else if (raw) {
      obj.material = toNodeMaterial(raw);
    }
  });
  return root;
}

/** Recursively dispose every geometry + material under an Object3D. */
export function disposeSubtree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry?.dispose();
    const m = obj.material;
    if (Array.isArray(m)) m.forEach((x) => x?.dispose?.());
    else m?.dispose?.();
  });
}
