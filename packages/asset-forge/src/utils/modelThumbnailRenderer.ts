/**
 * Model Thumbnail Renderer — singleton WebGPU pipeline that
 * renders a static thumbnail of any GLB and caches the resulting
 * data URL so cards across the asset-pack surfaces can show
 * actual model previews instead of generic icons.
 *
 * Why a singleton:
 *   - WebGPU contexts are expensive and browsers cap them low
 *     (Chrome ~16). One per card would crash a multi-row grid.
 *   - GLB loads + render passes are serial here — the queue keeps
 *     us from triggering N concurrent renders that would all
 *     contend on the same GPU work.
 *
 * URL handling:
 *   - `asset://models/...` → `/game-models/...` (Vite proxy)
 *   - `asset://...` → `/game-models/...`
 *   - any other URL is passed through (HTTP, /api/assets/.../model)
 *
 * Cache:
 *   - In-memory Map keyed by the resolved fetch URL.
 *   - LRU bounded — once we exceed `MAX_CACHE` entries, the
 *     oldest is evicted. 256×256 PNG at ~50KB × 200 ≈ 10MB max.
 *   - Cache is module-level so it persists across page nav within
 *     a session.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { WebGPURenderer, MeshStandardNodeMaterial } from "three/webgpu";
import { texture, normalMap } from "three/tsl";

const SIZE = 256;
const MAX_CACHE = 200;

/**
 * Resolve `asset://...` to the studio's proxy path so GLTFLoader
 * can fetch it. Mirrors `resolveAssetUrl` in GameWorldAssets.ts —
 * kept duplicated here so this module has no cross-package import
 * weight (it's loaded into many cards).
 */
function resolveModelUrl(modelUrl: string): string {
  if (modelUrl.startsWith("asset://models/")) {
    return modelUrl.replace("asset://models/", "/game-models/");
  }
  if (modelUrl.startsWith("asset://")) {
    return modelUrl.replace("asset://", "/game-models/");
  }
  return modelUrl;
}

/**
 * Convert a glTF MeshStandardMaterial to MeshStandardNodeMaterial
 * for WebGPU. Same shape as the GameWorldAssets helper — copying
 * PBR scalars and assigning textures via TSL nodes.
 */
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
 * Frame the model in the camera's view. Centers the model at
 * origin, then positions the camera diagonally above-and-in-front
 * at a distance derived from the model's bounding sphere so it
 * fills ~70% of the frame.
 */
function frameModel(
  model: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
): void {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  // Translate the model so its center sits at the origin.
  model.position.sub(center);

  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  // After the centering above, the sphere center is offset; the
  // radius is correct.
  const radius = sphere.radius || Math.max(size.x, size.y, size.z) * 0.5;
  // Distance for the model to fit in vertical FOV with margin.
  const fov = (camera.fov * Math.PI) / 180;
  const dist = (radius / Math.sin(fov / 2)) * 1.15;

  // Diagonal three-quarter view — flatters most assets.
  camera.position.set(dist * 0.85, dist * 0.55, dist * 0.85);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

class ModelThumbnailService {
  private renderer: WebGPURenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private loader = new GLTFLoader();

  private cache = new Map<string, string>();
  private inflight = new Map<string, Promise<string>>();
  /** Serial queue — every render request awaits the previous one. */
  private queue: Promise<unknown> = Promise.resolve();

  private async ensureInit(): Promise<void> {
    if (this.renderer) return;

    // Detached canvas — never inserted into the DOM. WebGPURenderer
    // adopts it internally.
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;

    const renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    await renderer.init();

    const scene = new THREE.Scene();
    // Soft fill + key light. Background stays transparent.
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(2, 3.5, 2);
    const rim = new THREE.DirectionalLight(0xa0c4ff, 0.4);
    rim.position.set(-2, 1.5, -2);
    scene.add(ambient, key, rim);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
  }

  /**
   * Get (or render + cache) the thumbnail for the given model url.
   * Concurrent calls for the same url share the same in-flight
   * promise. Different urls serialize through the queue.
   */
  async get(modelUrl: string): Promise<string> {
    const resolved = resolveModelUrl(modelUrl);
    const cached = this.cache.get(resolved);
    if (cached) return cached;
    const inflight = this.inflight.get(resolved);
    if (inflight) return inflight;

    const work = this.queue
      .catch(() => undefined)
      .then(() => this.renderOne(resolved));
    this.queue = work.catch(() => undefined);
    this.inflight.set(resolved, work);

    try {
      const result = await work;
      this.setCache(resolved, result);
      return result;
    } finally {
      this.inflight.delete(resolved);
    }
  }

  private setCache(key: string, value: string): void {
    this.cache.set(key, value);
    // Evict oldest if we exceed the bound.
    if (this.cache.size > MAX_CACHE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
  }

  private async renderOne(resolvedUrl: string): Promise<string> {
    await this.ensureInit();
    const renderer = this.renderer;
    const scene = this.scene;
    const camera = this.camera;
    if (!renderer || !scene || !camera) {
      throw new Error("Thumbnail renderer not initialized");
    }

    const gltf = await this.loader.loadAsync(resolvedUrl);
    const model = gltf.scene;

    // Convert all materials to WebGPU-compatible node materials.
    model.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const raw = obj.material;
      if (Array.isArray(raw)) {
        obj.material = raw.map(toNodeMaterial);
      } else if (raw) {
        obj.material = toNodeMaterial(raw);
      }
    });

    frameModel(model, camera);
    scene.add(model);

    try {
      await renderer.renderAsync(scene, camera);
      const canvas = renderer.domElement as HTMLCanvasElement;
      const dataUrl = canvas.toDataURL("image/png");
      return dataUrl;
    } finally {
      scene.remove(model);
      // Dispose geometries + materials to free GPU memory.
      model.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.geometry?.dispose();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((x) => x?.dispose?.());
        else m?.dispose?.();
      });
    }
  }
}

export const modelThumbnailRenderer = new ModelThumbnailService();
