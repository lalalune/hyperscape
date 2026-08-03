/**
 * Distance-based entity fade using dithered dissolve shader.
 * Includes camera-to-player occlusion dissolve (classic fantasy MMORPG-style).
 *
 * ## WebGPU/WebGL Support
 * - WebGPU: Uses TSL (Three Shading Language) nodes for native WebGPU support
 * - WebGL: Falls back to onBeforeCompile GLSL injection
 * - VRM/incompatible: Falls back to opacity-based fade
 *
 * The TSL path is preferred for WebGPU as it provides better performance
 * and doesn't require shader recompilation.
 */

import THREE, {
  uniform,
  sub,
  add,
  mul,
  div,
  Fn,
  MeshStandardNodeMaterial,
  float,
  smoothstep,
  positionWorld,
  step,
  max,
  clamp,
  sqrt,
  length,
  mod,
  floor,
  abs,
  viewportCoordinate,
  dot,
} from "../../extras/three/three";
import { DISTANCE_CONSTANTS } from "../../constants/GameConstants";
import { GPU_VEG_CONFIG } from "../../systems/shared/world/GPUMaterials";

export interface DistanceFadeConfig {
  fadeStart: number;
  fadeEnd: number;
  fadeStartSq?: number;
  fadeEndSq?: number;
  /** Enable camera-to-player occlusion dissolve (default: true) */
  enableOcclusionDissolve?: boolean;
}

/** Pre-built configs for entity types */
export const ENTITY_FADE_CONFIGS = {
  MOB: {
    fadeStart: DISTANCE_CONSTANTS.RENDER.MOB_FADE_START,
    fadeEnd: DISTANCE_CONSTANTS.RENDER.MOB,
    fadeStartSq: DISTANCE_CONSTANTS.RENDER_SQ.MOB_FADE_START,
    fadeEndSq: DISTANCE_CONSTANTS.RENDER_SQ.MOB,
  },
  NPC: {
    fadeStart: DISTANCE_CONSTANTS.RENDER.NPC_FADE_START,
    fadeEnd: DISTANCE_CONSTANTS.RENDER.NPC,
    fadeStartSq: DISTANCE_CONSTANTS.RENDER_SQ.NPC_FADE_START,
    fadeEndSq: DISTANCE_CONSTANTS.RENDER_SQ.NPC,
  },
  PLAYER: {
    fadeStart: DISTANCE_CONSTANTS.RENDER.PLAYER_FADE_START,
    fadeEnd: DISTANCE_CONSTANTS.RENDER.PLAYER,
    fadeStartSq: DISTANCE_CONSTANTS.RENDER_SQ.PLAYER_FADE_START,
    fadeEndSq: DISTANCE_CONSTANTS.RENDER_SQ.PLAYER,
  },
} as const;

export const enum FadeState {
  VISIBLE = 0,
  FADING = 1,
  CULLED = 2,
}

// ============================================================================
// SHARED UNIFORMS MANAGER
// ============================================================================

/**
 * Shared uniform manager for camera and player positions.
 * Allows multiple materials to share the same position uniforms,
 * reducing per-frame update overhead from O(N materials) to O(1).
 */
class SharedDissolveUniforms {
  private static instance: SharedDissolveUniforms | null = null;

  // TSL uniforms (for WebGPU path)
  readonly cameraPosUniform = uniform(new THREE.Vector3(0, 0, 0));
  readonly playerPosUniform = uniform(new THREE.Vector3(0, 0, 0));

  // GLSL uniforms (for WebGL path)
  readonly cameraPosGLSL = { value: new THREE.Vector3(0, 0, 0) };
  readonly playerPosGLSL = { value: new THREE.Vector3(0, 0, 0) };

  // Tracking
  private registeredMaterials = new WeakSet<THREE.Material>();
  private lastCameraUpdate = { x: NaN, y: NaN, z: NaN };
  private lastPlayerUpdate = { x: NaN, y: NaN, z: NaN };

  private constructor() {}

  static getInstance(): SharedDissolveUniforms {
    if (!SharedDissolveUniforms.instance) {
      SharedDissolveUniforms.instance = new SharedDissolveUniforms();
    }
    return SharedDissolveUniforms.instance;
  }

  /**
   * Update shared camera position.
   * Only updates if position has changed to avoid unnecessary GPU uploads.
   */
  updateCamera(x: number, y: number, z: number): void {
    if (
      x === this.lastCameraUpdate.x &&
      y === this.lastCameraUpdate.y &&
      z === this.lastCameraUpdate.z
    ) {
      return;
    }

    // Update TSL uniform
    this.cameraPosUniform.value.set(x, y, z);

    // Update GLSL uniform
    this.cameraPosGLSL.value.set(x, y, z);

    this.lastCameraUpdate = { x, y, z };
  }

  /**
   * Update shared player position.
   * Only updates if position has changed to avoid unnecessary GPU uploads.
   */
  updatePlayer(x: number, y: number, z: number): void {
    if (
      x === this.lastPlayerUpdate.x &&
      y === this.lastPlayerUpdate.y &&
      z === this.lastPlayerUpdate.z
    ) {
      return;
    }

    // Update TSL uniform
    this.playerPosUniform.value.set(x, y, z);

    // Update GLSL uniform
    this.playerPosGLSL.value.set(x, y, z);

    this.lastPlayerUpdate = { x, y, z };
  }

  /**
   * Register a material as using shared uniforms.
   */
  registerMaterial(material: THREE.Material): void {
    this.registeredMaterials.add(material);
  }

  /**
   * Check if a material is registered for shared uniforms.
   */
  isMaterialRegistered(material: THREE.Material): boolean {
    return this.registeredMaterials.has(material);
  }
}

/**
 * Get the global shared dissolve uniforms instance.
 */
export function getSharedDissolveUniforms(): SharedDissolveUniforms {
  return SharedDissolveUniforms.getInstance();
}

/**
 * Update shared dissolve uniforms globally.
 * Call this once per frame from the main render loop.
 */
export function updateSharedDissolveUniforms(
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  playerX: number,
  playerY: number,
  playerZ: number,
): void {
  const shared = getSharedDissolveUniforms();
  shared.updateCamera(cameraX, cameraY, cameraZ);
  shared.updatePlayer(playerX, playerY, playerZ);
}

// ============================================================================
// TSL-BASED DISSOLVE (WebGPU Native)
// ============================================================================

/** TSL Dissolve uniforms structure */
export type TSLDissolveUniforms = {
  fadeAmount: { value: number };
  cameraPos: { value: THREE.Vector3 };
  playerPos: { value: THREE.Vector3 };
  occlusionEnabled: { value: number };
  useSharedUniforms?: boolean;
};

/**
 * Apply TSL-based dissolve to a MeshStandardNodeMaterial.
 * This is the preferred path for WebGPU as it uses native TSL nodes.
 *
 * @param material - The material to apply dissolve to
 * @param enableOcclusion - Enable camera-to-player occlusion dissolve
 * @param useSharedUniforms - Use shared global uniforms for camera/player positions
 *                            (recommended for many objects with same fade behavior)
 */
function applyDissolveTSL(
  material: THREE.MeshStandardNodeMaterial,
  enableOcclusion: boolean = true,
  useSharedUniforms: boolean = false,
): TSLDissolveUniforms | null {
  // Check if already patched
  const matWithUniforms = material as THREE.MeshStandardNodeMaterial & {
    _dissolveUniforms?: TSLDissolveUniforms;
  };
  if (matWithUniforms._dissolveUniforms) {
    return matWithUniforms._dissolveUniforms;
  }

  // Create uniforms - use shared or per-material
  const uFadeAmount = uniform(0.0);
  const shared = useSharedUniforms ? getSharedDissolveUniforms() : null;
  const uCameraPos = shared
    ? shared.cameraPosUniform
    : uniform(new THREE.Vector3(0, 0, 0));
  const uPlayerPos = shared
    ? shared.playerPosUniform
    : uniform(new THREE.Vector3(0, 0, 0));
  const uOcclusionEnabled = uniform(enableOcclusion ? 1.0 : 0.0);

  // Register material if using shared uniforms
  if (shared) {
    shared.registerMaterial(material);
  }

  // Pre-compute constants
  const nearCameraFadeStart = float(GPU_VEG_CONFIG.NEAR_CAMERA_FADE_START);
  const nearCameraFadeEnd = float(GPU_VEG_CONFIG.NEAR_CAMERA_FADE_END);
  const occlusionCameraRadius = float(GPU_VEG_CONFIG.OCCLUSION_CAMERA_RADIUS);
  const occlusionPlayerRadius = float(GPU_VEG_CONFIG.OCCLUSION_PLAYER_RADIUS);
  const occlusionDistanceScale = float(GPU_VEG_CONFIG.OCCLUSION_DISTANCE_SCALE);
  const occlusionNearMargin = float(GPU_VEG_CONFIG.OCCLUSION_NEAR_MARGIN);
  const occlusionFarMargin = float(GPU_VEG_CONFIG.OCCLUSION_FAR_MARGIN);
  const occlusionEdgeSharpness = float(GPU_VEG_CONFIG.OCCLUSION_EDGE_SHARPNESS);
  const occlusionStrength = float(GPU_VEG_CONFIG.OCCLUSION_STRENGTH);

  // Create alpha test node using TSL
  material.alphaTestNode = Fn(() => {
    const worldPos = positionWorld;

    // Near-camera dissolve (prevents hard clipping at near plane)
    const camToFrag = sub(worldPos, uCameraPos);
    const camDist = length(camToFrag);
    const nearCameraFade = sub(
      float(1.0),
      smoothstep(nearCameraFadeEnd, nearCameraFadeStart, camDist),
    );

    // Camera-to-player occlusion dissolve (classic fantasy MMORPG-style cone)
    const camToPlayer = sub(uPlayerPos, uCameraPos);
    const ctLengthSq = dot(camToPlayer, camToPlayer);
    const ctLength = sqrt(ctLengthSq);
    const ctDir = div(camToPlayer, max(ctLength, float(0.001)));

    const projDist = dot(camToFrag, ctDir);
    const inRangeNear = step(occlusionNearMargin, projDist);
    const inRangeFar = step(projDist, sub(ctLength, occlusionFarMargin));
    const inRange = mul(inRangeNear, inRangeFar);

    const projPoint = add(uCameraPos, mul(projDist, ctDir));
    const perpDist = length(sub(worldPos, projPoint));

    const t = clamp(
      div(projDist, max(ctLength, float(0.001))),
      float(0.0),
      float(1.0),
    );
    const coneRadius = add(
      add(
        occlusionCameraRadius,
        mul(t, sub(occlusionPlayerRadius, occlusionCameraRadius)),
      ),
      mul(ctLength, occlusionDistanceScale),
    );

    const edgeStart = mul(coneRadius, sub(float(1.0), occlusionEdgeSharpness));
    const occlusionFade = mul(
      mul(
        sub(float(1.0), smoothstep(edgeStart, coneRadius, perpDist)),
        occlusionStrength,
      ),
      mul(inRange, uOcclusionEnabled),
    );

    // Combine all fade sources (base fade from uniform + near camera + occlusion)
    const fadeWithNear = max(uFadeAmount, nearCameraFade);
    const fadeValue = max(fadeWithNear, occlusionFade);

    // Screen-space 4x4 Bayer dithering
    const fragCoord = viewportCoordinate;
    const ix = mod(floor(fragCoord.x), float(4.0));
    const iy = mod(floor(fragCoord.y), float(4.0));

    const bit0_x = mod(ix, float(2.0));
    const bit1_x = floor(mul(ix, float(0.5)));
    const bit0_y = mod(iy, float(2.0));
    const bit1_y = floor(mul(iy, float(0.5)));
    const xor0 = abs(sub(bit0_x, bit0_y));
    const xor1 = abs(sub(bit1_x, bit1_y));

    const bayerInt = add(
      add(mul(xor0, float(8.0)), mul(bit0_y, float(4.0))),
      add(mul(xor1, float(2.0)), bit1_y),
    );
    const ditherValue = mul(bayerInt, float(0.0625));

    // modern MMORPG-style threshold: discard when fade >= dither
    // Only apply dithering when fadeValue > 0, otherwise step(0,0)=1 causes holes
    const hasAnyFade = step(float(0.001), fadeValue);
    const ditherThreshold = mul(
      step(ditherValue, fadeValue),
      mul(hasAnyFade, float(2.0)),
    );

    return ditherThreshold;
  })();

  // Configure material for cutout rendering
  material.transparent = false;
  material.opacity = 1.0;
  material.alphaTest = 0.5;
  material.forceSinglePass = true;
  material.needsUpdate = true;

  // Store uniforms reference
  const uniforms: TSLDissolveUniforms = {
    fadeAmount: uFadeAmount,
    cameraPos: uCameraPos,
    playerPos: uPlayerPos,
    occlusionEnabled: uOcclusionEnabled,
    useSharedUniforms: useSharedUniforms,
  };
  matWithUniforms._dissolveUniforms = uniforms;

  return uniforms;
}

/** GLSL Dissolve uniforms structure with occlusion support (WebGL fallback) */
export type DissolveUniforms = {
  fadeAmount: { value: number };
  cameraPos: { value: THREE.Vector3 };
  playerPos: { value: THREE.Vector3 };
  occlusionEnabled: { value: number };
};

// ============================================================================
// UNIFIED DISSOLVE UNIFORMS TYPE
// ============================================================================

/** Combined dissolve uniforms type (works for both TSL and GLSL paths) */
export type UnifiedDissolveUniforms = DissolveUniforms | TSLDissolveUniforms;

export interface FadeUpdateResult {
  state: FadeState;
  fadeAmount: number;
  distanceSq: number;
  visible: boolean;
}

// Reusable result to avoid allocations
const _fadeResult: FadeUpdateResult = {
  state: FadeState.VISIBLE,
  fadeAmount: 0,
  distanceSq: 0,
  visible: true,
};

/**
 * Check if a material is a node material (TSL-compatible).
 */
function isNodeMaterial(
  material: THREE.Material,
): material is THREE.MeshStandardNodeMaterial {
  return (
    material != null &&
    (material as THREE.Material & { isNodeMaterial?: boolean })
      .isNodeMaterial === true
  );
}

/** Manages distance-based fade for an entity (shader dissolve or opacity fallback) */
export class DistanceFadeController {
  private config: Required<DistanceFadeConfig> & {
    enableOcclusionDissolve: boolean;
  };
  private rootObject: THREE.Object3D;
  private materialUniforms: UnifiedDissolveUniforms[] = [];
  private useShaderFade: boolean = false;
  private useTSL: boolean = false;
  private useSharedUniforms: boolean = false;
  private lastState: FadeState = FadeState.VISIBLE;
  private lastFadeAmount: number = 0;

  /**
   * Create a new DistanceFadeController
   *
   * @param rootObject - The root Object3D of the entity (typically entity.node or entity.mesh)
   * @param config - Fade configuration (fadeStart, fadeEnd distances, occlusion settings)
   * @param enableShaderFade - Whether to attempt shader-based dissolve (default: true)
   * @param useSharedUniforms - Use shared global uniforms for camera/player positions.
   *                            When true, you must call updateSharedDissolveUniforms() once per frame
   *                            instead of passing positions to each controller's update().
   */
  constructor(
    rootObject: THREE.Object3D,
    config: DistanceFadeConfig,
    enableShaderFade: boolean = true,
    useSharedUniforms: boolean = false,
  ) {
    this.rootObject = rootObject;
    this.useSharedUniforms = useSharedUniforms;
    this.config = {
      fadeStart: config.fadeStart,
      fadeEnd: config.fadeEnd,
      fadeStartSq: config.fadeStartSq ?? config.fadeStart * config.fadeStart,
      fadeEndSq: config.fadeEndSq ?? config.fadeEnd * config.fadeEnd,
      enableOcclusionDissolve: config.enableOcclusionDissolve !== false, // Default: enabled
    };

    if (enableShaderFade) {
      this.initializeShaderFade();
    }
  }

  /**
   * Initialize shader-based fade for all meshes in the hierarchy.
   * Requires MeshStandardNodeMaterial for WebGPU-native TSL dissolve.
   *
   * NOTE: Materials should be created as MeshStandardNodeMaterial at the source.
   * If you see warnings about non-node materials, convert them at creation time.
   */
  private initializeShaderFade(): void {
    this.rootObject.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        for (const material of materials) {
          // Skip VRM materials and other special materials
          if (this.isMaterialIncompatible(material)) {
            continue;
          }

          // Apply TSL dissolve to node materials
          if (isNodeMaterial(material)) {
            const uniforms = applyDissolveTSL(
              material as THREE.MeshStandardNodeMaterial,
              this.config.enableOcclusionDissolve,
              this.useSharedUniforms,
            );
            if (uniforms) {
              this.materialUniforms.push(uniforms);
              this.useShaderFade = true;
              this.useTSL = true;
            }
          }
          // Skip non-node materials - they should be converted at the source
        }
      }
    });
  }

  private isMaterialIncompatible(material: THREE.Material): boolean {
    if (material.name?.includes("VRM") || material.name?.includes("MToon"))
      return true;
    if (
      material instanceof THREE.ShaderMaterial ||
      material instanceof THREE.RawShaderMaterial
    )
      return true;
    // Note: We now handle node materials with TSL, so don't skip them
    return false;
  }

  /**
   * Update fade based on XZ distance from camera.
   * Also updates camera/player positions for occlusion dissolve.
   *
   * @param cameraX - Camera X position
   * @param cameraZ - Camera Z position (for distance calculation)
   * @param entityX - Entity X position
   * @param entityZ - Entity Z position
   * @param cameraY - Camera Y position (for occlusion, optional)
   * @param playerX - Player X position (for occlusion target, optional)
   * @param playerY - Player Y position (for occlusion target, optional)
   * @param playerZ - Player Z position (for occlusion target, optional)
   */
  update(
    cameraX: number,
    cameraZ: number,
    entityX: number,
    entityZ: number,
    cameraY?: number,
    playerX?: number,
    playerY?: number,
    playerZ?: number,
  ): FadeUpdateResult {
    const dx = entityX - cameraX;
    const dz = entityZ - cameraZ;
    const distanceSq = dx * dx + dz * dz;

    let state: FadeState;
    let fadeAmount: number;

    if (distanceSq <= this.config.fadeStartSq) {
      state = FadeState.VISIBLE;
      fadeAmount = 0;
    } else if (distanceSq >= this.config.fadeEndSq) {
      state = FadeState.CULLED;
      fadeAmount = 1;
    } else {
      state = FadeState.FADING;
      fadeAmount =
        (distanceSq - this.config.fadeStartSq) /
        (this.config.fadeEndSq - this.config.fadeStartSq);
    }

    if (
      state !== this.lastState ||
      Math.abs(fadeAmount - this.lastFadeAmount) > 0.01
    ) {
      this.applyFade(state, fadeAmount);
      this.lastState = state;
      this.lastFadeAmount = fadeAmount;
    }

    // Update occlusion uniforms if shader fade is active
    // Skip if using shared uniforms (positions are updated globally once per frame)
    if (
      this.useShaderFade &&
      this.materialUniforms.length > 0 &&
      !this.useSharedUniforms
    ) {
      const camY = cameraY ?? 0;
      const plrX = playerX ?? cameraX;
      const plrY = playerY ?? camY;
      const plrZ = playerZ ?? cameraZ;

      for (const uniforms of this.materialUniforms) {
        uniforms.cameraPos.value.set(cameraX, camY, cameraZ);
        uniforms.playerPos.value.set(plrX, plrY, plrZ);
      }
    }

    _fadeResult.state = state;
    _fadeResult.fadeAmount = fadeAmount;
    _fadeResult.distanceSq = distanceSq;
    _fadeResult.visible = state !== FadeState.CULLED;
    return _fadeResult;
  }

  /**
   * Update only the camera and player positions for occlusion dissolve.
   * Call this when positions change but you don't need full distance-based update.
   *
   * Note: If using shared uniforms, this method is a no-op. Instead, call
   * updateSharedDissolveUniforms() once per frame from the main render loop.
   */
  updateOcclusionPositions(
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    playerX: number,
    playerY: number,
    playerZ: number,
  ): void {
    if (!this.useShaderFade || this.useSharedUniforms) return;

    for (const uniforms of this.materialUniforms) {
      uniforms.cameraPos.value.set(cameraX, cameraY, cameraZ);
      uniforms.playerPos.value.set(playerX, playerY, playerZ);
    }
  }

  /**
   * Check if this controller is using shared uniforms.
   */
  isUsingSharedUniforms(): boolean {
    return this.useSharedUniforms;
  }

  private applyFade(state: FadeState, fadeAmount: number): void {
    if (state === FadeState.CULLED) {
      this.rootObject.visible = false;
      return;
    }
    this.rootObject.visible = true;

    if (this.useShaderFade && this.materialUniforms.length > 0) {
      for (const uniforms of this.materialUniforms) {
        uniforms.fadeAmount.value = fadeAmount;
      }
    } else {
      this.applyOpacityFade(fadeAmount);
    }
  }

  private applyOpacityFade(fadeAmount: number): void {
    this.rootObject.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.material) return;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const mat of materials) {
        if ("opacity" in mat) {
          (mat as THREE.MeshStandardMaterial).opacity = 1 - fadeAmount;
          (mat as THREE.MeshStandardMaterial).transparent = fadeAmount > 0;
        }
      }
    });
  }

  setCulled(): void {
    this.applyFade(FadeState.CULLED, 1);
    this.lastState = FadeState.CULLED;
    this.lastFadeAmount = 1;
  }

  setVisible(): void {
    this.applyFade(FadeState.VISIBLE, 0);
    this.lastState = FadeState.VISIBLE;
    this.lastFadeAmount = 0;
  }

  setConfig(config: Partial<DistanceFadeConfig>): void {
    if (config.fadeStart !== undefined) {
      this.config.fadeStart = config.fadeStart;
      this.config.fadeStartSq = config.fadeStart * config.fadeStart;
    }
    if (config.fadeEnd !== undefined) {
      this.config.fadeEnd = config.fadeEnd;
      this.config.fadeEndSq = config.fadeEnd * config.fadeEnd;
    }
    if (config.enableOcclusionDissolve !== undefined) {
      this.config.enableOcclusionDissolve = config.enableOcclusionDissolve;
      // Update shader uniforms
      for (const uniforms of this.materialUniforms) {
        uniforms.occlusionEnabled.value = config.enableOcclusionDissolve
          ? 1.0
          : 0.0;
      }
    }
  }

  getState(): FadeState {
    return this.lastState;
  }
  getFadeAmount(): number {
    return this.lastFadeAmount;
  }
  isVisible(): boolean {
    return this.lastState !== FadeState.CULLED;
  }
  hasShaderFade(): boolean {
    return this.useShaderFade;
  }
  hasOcclusionDissolve(): boolean {
    return this.config.enableOcclusionDissolve && this.useShaderFade;
  }
  /** Returns true if using TSL-based dissolve (WebGPU native) */
  hasTSLDissolve(): boolean {
    return this.useTSL;
  }

  dispose(): void {
    this.materialUniforms.length = 0;
    this.useShaderFade = false;
    this.useTSL = false;
  }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Creates a TSL-based dissolve material from an existing MeshStandardMaterial.
 * This is the recommended approach for WebGPU as it uses native TSL nodes.
 *
 * @param source - Source material to clone properties from
 * @param options - Dissolve configuration options
 * @returns Material with TSL dissolve shader attached
 */
export function createTSLDissolveMaterial(
  source: THREE.MeshStandardMaterial,
  options: {
    fadeStart?: number;
    fadeEnd?: number;
    enableOcclusion?: boolean;
  } = {},
): THREE.MeshStandardNodeMaterial & { dissolveUniforms: TSLDissolveUniforms } {
  // Create node material with same properties as source
  const material = new MeshStandardNodeMaterial();

  // Copy properties from source
  material.color.copy(source.color);
  material.roughness = source.roughness;
  material.metalness = source.metalness;
  material.map = source.map;
  material.normalMap = source.normalMap;
  material.roughnessMap = source.roughnessMap;
  material.metalnessMap = source.metalnessMap;
  material.aoMap = source.aoMap;
  material.emissiveMap = source.emissiveMap;
  material.emissive.copy(source.emissive);
  material.emissiveIntensity = source.emissiveIntensity;
  material.side = source.side;
  material.shadowSide = source.shadowSide;

  // Apply dissolve
  const uniforms = applyDissolveTSL(
    material,
    options.enableOcclusion !== false,
  );

  if (!uniforms) {
    throw new Error("Failed to apply TSL dissolve to material");
  }

  // Return with attached uniforms
  const result = material as THREE.MeshStandardNodeMaterial & {
    dissolveUniforms: TSLDissolveUniforms;
  };
  result.dissolveUniforms = uniforms;

  return result;
}
