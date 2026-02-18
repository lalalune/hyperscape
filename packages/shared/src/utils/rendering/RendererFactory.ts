/**
 * Renderer Factory
 *
 * Creates renderers for Hyperscape.
 *
 * Primary path is WebGPU. When WebGPU is unavailable (e.g. WKWebView in Tauri),
 * we fall back to WebGL so the client can still run instead of hard-failing.
 */

import * as THREE from "../../extras/three/three";
import { Logger } from "../Logger";

/**
 * Renderer backend types
 */
export type RendererBackend = "webgpu" | "webgl";

/**
 * Renderer type used across the app.
 *
 * NOTE: `THREE.WebGPURenderer` supports a WebGL fallback backend via `forceWebGL`.
 * This lets us run in environments like WKWebView (Tauri) where `navigator.gpu`
 * is not exposed, without switching to `THREE.WebGLRenderer` (which isn't part
 * of the three/webgpu bundle).
 */
export type WebGPURenderer = InstanceType<typeof THREE.WebGPURenderer>;
export type UniversalRenderer = WebGPURenderer;

export interface RendererOptions {
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: "high-performance" | "low-power" | "default";
  preserveDrawingBuffer?: boolean;
  canvas?: HTMLCanvasElement;
}

export interface RenderingCapabilities {
  supportsWebGPU: boolean;
  supportsWebGL: boolean;
  backend: RendererBackend;
}

/**
 * Check if WebGPU is available in the current browser
 */
export async function isWebGPUAvailable(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;

  type GPUAdapterLike = object;
  type NavigatorGpuApi = {
    requestAdapter: () => Promise<GPUAdapterLike | null>;
  };
  type NavigatorWithGpu = typeof navigator & { gpu?: NavigatorGpuApi };

  // Access gpu property safely (not all WebViews expose it)
  const gpuApi = (navigator as NavigatorWithGpu).gpu;
  if (!gpuApi) return false;

  try {
    const adapter = await gpuApi.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Check if WebGL is available in the current browser.
 */
export function isWebGLAvailable(): boolean {
  if (typeof document === "undefined") return false;

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  return gl !== null;
}

/**
 * Detect rendering capabilities.
 *
 * Note: Some platforms (notably WKWebView) may have a newer Safari installed but still
 * not expose WebGPU to embedded WebViews. In those cases we fall back to WebGL.
 */
export async function detectRenderingCapabilities(): Promise<RenderingCapabilities> {
  const supportsWebGPU = await isWebGPUAvailable();
  if (supportsWebGPU) {
    return {
      supportsWebGPU: true,
      supportsWebGL: true,
      backend: "webgpu",
    };
  }

  const supportsWebGL = isWebGLAvailable();
  if (supportsWebGL) {
    return {
      supportsWebGPU: false,
      supportsWebGL: true,
      backend: "webgl",
    };
  }

  throw new Error(
    "Neither WebGPU nor WebGL is supported in this environment. " +
      "Please use a modern browser or a WebView with GPU acceleration enabled.",
  );
}

/**
 * Create a renderer (WebGPU preferred, WebGL fallback)
 */
export async function createRenderer(
  options: RendererOptions = {},
): Promise<UniversalRenderer> {
  const {
    antialias = true,
    alpha = false,
    powerPreference = "high-performance",
    canvas,
  } = options;

  // WebGPU powerPreference does not support "default" (WebGL does).
  const webgpuPowerPreference =
    powerPreference === "default" ? undefined : powerPreference;

  const create = async (forceWebGL: boolean): Promise<UniversalRenderer> => {
    const renderer = new THREE.WebGPURenderer({
      canvas,
      antialias,
      alpha,
      powerPreference: webgpuPowerPreference,
      forceWebGL,
    });
    await renderer.init();
    return renderer;
  };

  const supportsWebGPU = await isWebGPUAvailable();

  // Prefer real WebGPU when available.
  if (supportsWebGPU) {
    try {
      return await create(false);
    } catch {
      Logger.warn(
        "[RendererFactory] WebGPU init failed, falling back to WebGL",
      );
    }
  }

  // WebGPU unavailable → WebGL backend via WebGPURenderer.forceWebGL
  if (!isWebGLAvailable()) {
    throw new Error(
      "WebGPU is not supported in this browser or WebView, and WebGL is not available. " +
        "Please use a modern browser or enable GPU acceleration.",
    );
  }

  return await create(true);
}

/**
 * Check if the active backend is WebGPU (not the WebGL fallback backend).
 */
export function isWebGPURenderer(renderer: UniversalRenderer): boolean {
  return getRendererBackend(renderer) === "webgpu";
}

/**
 * Get renderer backend type
 */
export function getRendererBackend(
  renderer: UniversalRenderer,
): RendererBackend {
  type BackendWithFlag = { isWebGPUBackend?: true };
  const backend = renderer.backend as BackendWithFlag;
  return backend.isWebGPUBackend ? "webgpu" : "webgl";
}

/**
 * Configure renderer with common settings
 */
export function configureRenderer(
  renderer: UniversalRenderer,
  options: {
    clearColor?: number;
    clearAlpha?: number;
    pixelRatio?: number;
    width?: number;
    height?: number;
    toneMapping?: THREE.ToneMapping;
    toneMappingExposure?: number;
    outputColorSpace?: THREE.ColorSpace;
  },
): void {
  const {
    pixelRatio = 1,
    width,
    height,
    toneMapping = THREE.ACESFilmicToneMapping,
    toneMappingExposure = 1,
    outputColorSpace = THREE.SRGBColorSpace,
  } = options;

  // Pixel ratio
  renderer.setPixelRatio(pixelRatio);

  // Size
  if (width && height) {
    renderer.setSize(width, height);
  }

  // Tone mapping
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = toneMappingExposure;

  // Output color space
  renderer.outputColorSpace = outputColorSpace;
}

/**
 * Configure shadow maps
 */
export function configureShadowMaps(
  renderer: UniversalRenderer,
  options: {
    enabled?: boolean;
    type?: THREE.ShadowMapType;
  } = {},
): void {
  const { enabled = true, type = THREE.PCFSoftShadowMap } = options;

  renderer.shadowMap.enabled = enabled;
  renderer.shadowMap.type = type;
}

/**
 * Get max anisotropy
 */
export function getMaxAnisotropy(renderer: UniversalRenderer): number {
  type BackendWithMaxAnisotropy = { getMaxAnisotropy?: () => number };
  const backend = renderer.backend as BackendWithMaxAnisotropy;
  if (typeof backend.getMaxAnisotropy === "function") {
    return backend.getMaxAnisotropy();
  }
  return 16;
}

/**
 * Get WebGPU capabilities for logging and debugging
 */
export function getWebGPUCapabilities(renderer: UniversalRenderer): {
  backend: RendererBackend;
  features: string[];
} {
  type FeatureSetLike = { forEach: (cb: (feature: string) => void) => void };
  type BackendWithDeviceFeatures = {
    isWebGPUBackend?: true;
    device?: { features?: FeatureSetLike };
  };

  const backend = renderer.backend as BackendWithDeviceFeatures;
  const features: string[] = [];

  if (backend.isWebGPUBackend && backend.device?.features) {
    backend.device.features.forEach((feature: string) => {
      features.push(feature);
    });
  }

  return {
    backend: getRendererBackend(renderer),
    features,
  };
}

/**
 * Log WebGPU info for debugging
 */
export function logWebGPUInfo(renderer: UniversalRenderer): void {
  const caps = getWebGPUCapabilities(renderer);
  if (caps.backend !== "webgpu") return;

  Logger.info("[RendererFactory] WebGPU initialized", {
    features: caps.features.length,
  });
}

/**
 * Optimize materials for WebGPU rendering
 */
export function optimizeMaterialForWebGPU(material: THREE.Material): void {
  if (!material) return;

  type MaterialWithTextureProps = THREE.Material &
    Partial<
      Record<
        "map" | "normalMap" | "roughnessMap" | "metalnessMap" | "emissiveMap",
        THREE.Texture | undefined
      >
    >;

  // Enable anisotropic filtering on textures
  const textureProps: Array<keyof MaterialWithTextureProps> = [
    "map",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "emissiveMap",
  ];
  for (const prop of textureProps) {
    const tex = (material as MaterialWithTextureProps)[prop];
    if (tex instanceof THREE.Texture) {
      tex.anisotropy = 16;
    }
  }
}

/**
 * Create optimized instanced mesh
 */
export function createOptimizedInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = true;
  return mesh;
}

/**
 * Merge multiple meshes with the same material into a single mesh
 * Reduces draw calls for static geometry
 *
 * This implements geometry merging manually since BufferGeometryUtils
 * is not available in the three/webgpu namespace.
 *
 * @param meshes Array of meshes to merge (must share same material)
 * @returns Single merged mesh, or null if merging failed
 */
export function mergeStaticMeshes(meshes: THREE.Mesh[]): THREE.Mesh | null {
  if (meshes.length === 0) return null;
  if (meshes.length === 1) return meshes[0];

  // Collect all geometry data
  const allPositions: number[] = [];
  const allNormals: number[] = [];
  const allUvs: number[] = [];
  const allIndices: number[] = [];
  let indexOffset = 0;

  // Pre-allocate temporaries outside loop
  const tempVec = new THREE.Vector3();
  const tempNormal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();

  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    mesh.updateWorldMatrix(true, false);

    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const uvs = geometry.getAttribute("uv");
    const indices = geometry.getIndex();

    if (!positions) continue;

    // Get normal matrix for this mesh
    normalMatrix.getNormalMatrix(mesh.matrixWorld);

    for (let i = 0; i < positions.count; i++) {
      // Transform position
      tempVec.fromBufferAttribute(positions, i);
      tempVec.applyMatrix4(mesh.matrixWorld);
      allPositions.push(tempVec.x, tempVec.y, tempVec.z);

      // Transform normal
      if (normals) {
        tempNormal.fromBufferAttribute(normals, i);
        tempNormal.applyMatrix3(normalMatrix).normalize();
        allNormals.push(tempNormal.x, tempNormal.y, tempNormal.z);
      }

      // Copy UVs
      if (uvs) {
        allUvs.push(uvs.getX(i), uvs.getY(i));
      }
    }

    // Copy indices with offset
    if (indices) {
      for (let i = 0; i < indices.count; i++) {
        allIndices.push(indices.getX(i) + indexOffset);
      }
    } else {
      // Generate indices for non-indexed geometry
      for (let i = 0; i < positions.count; i++) {
        allIndices.push(i + indexOffset);
      }
    }

    indexOffset += positions.count;
  }

  // Create merged geometry
  const mergedGeometry = new THREE.BufferGeometry();
  mergedGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(allPositions, 3),
  );

  if (allNormals.length > 0) {
    mergedGeometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(allNormals, 3),
    );
  }

  if (allUvs.length > 0) {
    mergedGeometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(allUvs, 2),
    );
  }

  mergedGeometry.setIndex(allIndices);
  mergedGeometry.computeBoundingSphere();

  // Create the merged mesh using the first mesh's material
  const material = meshes[0].material;
  const mergedMesh = new THREE.Mesh(mergedGeometry, material);

  mergedMesh.frustumCulled = true;
  mergedMesh.receiveShadow = meshes[0].receiveShadow;
  mergedMesh.castShadow = meshes[0].castShadow;
  mergedMesh.name = "MergedStaticMesh";

  // Store original mesh data for interaction (click detection, etc.)
  mergedMesh.userData.mergedMeshes = meshes.map((m) => ({
    name: m.name,
    position: m.position.clone(),
    userData: { ...m.userData },
  }));

  return mergedMesh;
}

/**
 * Group meshes by material for efficient merging
 * Returns a map of material UUID to array of meshes using that material
 */
export function groupMeshesByMaterial(
  meshes: THREE.Mesh[],
): Map<string, THREE.Mesh[]> {
  const groups = new Map<string, THREE.Mesh[]>();

  for (const mesh of meshes) {
    const materialUuid = Array.isArray(mesh.material)
      ? mesh.material[0]?.uuid || "default"
      : mesh.material?.uuid || "default";

    if (!groups.has(materialUuid)) {
      groups.set(materialUuid, []);
    }
    groups.get(materialUuid)!.push(mesh);
  }

  return groups;
}

/**
 * Merge all static meshes in a scene/group by material
 * Replaces original meshes with merged versions
 *
 * @param parent The parent object containing meshes to merge
 * @param minMeshesToMerge Minimum meshes with same material before merging (default: 3)
 */
export function mergeStaticMeshesInGroup(
  parent: THREE.Object3D,
  minMeshesToMerge = 3,
): void {
  // Collect all meshes
  const meshes: THREE.Mesh[] = [];
  parent.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.userData.static !== false && // Skip if explicitly marked non-static
      !(child instanceof THREE.InstancedMesh) // Skip instanced meshes
    ) {
      meshes.push(child);
    }
  });

  // Group by material
  const groups = groupMeshesByMaterial(meshes);

  // Merge groups with enough meshes
  for (const [, groupMeshes] of groups) {
    if (groupMeshes.length >= minMeshesToMerge) {
      const mergedMesh = mergeStaticMeshes(groupMeshes);

      if (mergedMesh) {
        // Add merged mesh to parent
        parent.add(mergedMesh);

        // Remove original meshes
        for (const mesh of groupMeshes) {
          mesh.removeFromParent();
          mesh.geometry.dispose();
        }

        console.log(
          `[RendererFactory] Merged ${groupMeshes.length} meshes into 1`,
        );
      }
    }
  }
}
