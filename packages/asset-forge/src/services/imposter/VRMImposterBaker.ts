/**
 * VRMImposterBaker - Client-side VRM model imposter baking
 *
 * Loads VRM models, poses them in idle animation, and bakes octahedral imposters
 * using the three-octahedral-impostor package.
 *
 * This runs in the browser (needs WebGL context) and communicates with the
 * Asset-Forge server to store the baked atlases.
 */

import {
  ImpostorBaker,
  OctahedronType,
  type CompatibleRenderer,
} from "@hyperforge/impostor";
import { VRMLoaderPlugin, VRM, VRMUtils } from "@pixiv/three-vrm";
import * as THREE from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";

import type {
  OctahedralImpostorBakeConfig,
  ImpostorMetadata,
  ImpostorBakeResult,
} from "../../types/LODBundle";

/**
 * Bake request for a single VRM model
 */
interface VRMBakeRequest {
  assetId: string;
  modelUrl: string;
  category: string;
  config: OctahedralImpostorBakeConfig;
  animationName?: string;
  animationFrame?: number;
}

/**
 * Result of a VRM imposter bake
 */
interface VRMBakeResult {
  success: boolean;
  assetId: string;
  atlasDataUrl?: string;
  metadata?: Partial<ImpostorMetadata>;
  error?: string;
  duration: number;
}

/**
 * Loaded VRM with its animations
 */
interface LoadedVRM {
  vrm: VRM;
  animations: THREE.AnimationClip[];
  gltf: GLTF;
}

/**
 * VRMImposterBaker - Handles client-side VRM loading and imposter baking
 */
export class VRMImposterBaker {
  private renderer: THREE.WebGLRenderer;
  private baker: ImpostorBaker;
  private gltfLoader: GLTFLoader;
  private loadingPromises: Map<string, Promise<LoadedVRM | null>> = new Map();

  constructor(canvas?: HTMLCanvasElement) {
    // Create offscreen renderer if no canvas provided
    const targetCanvas = canvas || document.createElement("canvas");
    targetCanvas.width = 2048;
    targetCanvas.height = 2048;

    this.renderer = new THREE.WebGLRenderer({
      canvas: targetCanvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(2048, 2048);
    this.renderer.setClearColor(0x000000, 0);

    // Initialize ImpostorBaker (cast needed for WebGLRenderer -> CompatibleRenderer compatibility)
    this.baker = new ImpostorBaker(
      this.renderer as unknown as CompatibleRenderer,
    );

    // Initialize GLTFLoader with VRM plugin
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.register((parser) => new VRMLoaderPlugin(parser));
  }

  /**
   * Load a VRM model from URL with its animations
   */
  async loadVRM(url: string): Promise<LoadedVRM | null> {
    // Check for in-progress load
    const existing = this.loadingPromises.get(url);
    if (existing) {
      return existing;
    }

    const loadPromise = this.loadVRMInternal(url);
    this.loadingPromises.set(url, loadPromise);

    const result = await loadPromise;
    this.loadingPromises.delete(url);
    return result;
  }

  private async loadVRMInternal(url: string): Promise<LoadedVRM | null> {
    return new Promise((resolve) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const vrm = gltf.userData.vrm as VRM | undefined;
          if (vrm) {
            // VRM model - optimize for rendering
            VRMUtils.removeUnnecessaryJoints(vrm.scene);
            vrm.scene.updateMatrixWorld(true);
            resolve({
              vrm,
              animations: gltf.animations || [],
              gltf,
            });
          } else if (gltf.scene) {
            // Regular GLB/GLTF model (not VRM) - create a VRM-like wrapper
            console.log(`[VRMImposterBaker] Loading as GLB (non-VRM): ${url}`);
            gltf.scene.updateMatrixWorld(true);

            // Create a minimal VRM-like object for compatibility
            // The actual VRM humanoid features won't work, but we can still bake imposters
            resolve({
              vrm: {
                scene: gltf.scene,
                humanoid: null,
                update: () => {},
              } as unknown as VRM,
              animations: gltf.animations || [],
              gltf,
            });
          } else {
            console.warn(`[VRMImposterBaker] No scene in model: ${url}`);
            resolve(null);
          }
        },
        undefined,
        (error) => {
          console.error(
            `[VRMImposterBaker] Failed to load model: ${url}`,
            error,
          );
          resolve(null);
        },
      );
    });
  }

  /**
   * Find an animation clip by name (case-insensitive, partial match)
   */
  private findAnimationClip(
    animations: THREE.AnimationClip[],
    targetName: string,
  ): THREE.AnimationClip | null {
    const lowerTarget = targetName.toLowerCase();

    // Try exact match first
    const exact = animations.find(
      (clip) => clip.name.toLowerCase() === lowerTarget,
    );
    if (exact) return exact;

    // Try partial match (e.g., "idle" matches "Idle_Standing")
    const partial = animations.find((clip) =>
      clip.name.toLowerCase().includes(lowerTarget),
    );
    if (partial) return partial;

    // Common animation name patterns
    const idlePatterns = ["idle", "stand", "wait", "rest", "breathing"];
    if (idlePatterns.includes(lowerTarget)) {
      for (const pattern of idlePatterns) {
        const found = animations.find((clip) =>
          clip.name.toLowerCase().includes(pattern),
        );
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Pose VRM model at specified animation frame
   * Uses actual animation clips if available, falls back to manual idle pose for VRM
   * GLB models will use animations if available, otherwise use bind pose
   */
  poseVRMAtFrame(
    loadedVRM: LoadedVRM,
    animationName: string = "idle",
    framePercent: number = 0.25,
  ): string {
    const { vrm, animations } = loadedVRM;
    const humanoid = vrm.humanoid;

    // Try to find and use actual animation
    const clip = this.findAnimationClip(animations, animationName);

    if (clip) {
      console.log(
        `[VRMImposterBaker] Using animation clip: ${clip.name} (duration: ${clip.duration}s)`,
      );

      // Create a mixer and action
      const mixer = new THREE.AnimationMixer(vrm.scene);
      const action = mixer.clipAction(clip);

      // Calculate the time position (framePercent of the animation)
      const time = clip.duration * framePercent;

      // Play and immediately advance to the target frame
      action.play();
      action.paused = true;
      action.time = time;

      // Update the mixer to apply the pose
      mixer.setTime(time);
      mixer.update(0);

      // Update VRM if it has the update method (real VRM only)
      if (humanoid && typeof vrm.update === "function") {
        vrm.update(0);
      }

      // Update world matrices
      vrm.scene.updateMatrixWorld(true);

      // Update all skinned mesh skeletons
      vrm.scene.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh) {
          child.skeleton.update();
        }
      });

      // Clean up mixer
      mixer.stopAllAction();

      return clip.name;
    }

    // No animation found - check if this is a VRM with humanoid
    if (humanoid) {
      console.log(
        `[VRMImposterBaker] No animation '${animationName}' found, using manual idle pose`,
      );

      // Reset to T-pose first
      humanoid.resetNormalizedPose();

      // Apply natural idle pose adjustments
      const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
      const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
      const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");
      const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");
      const head = humanoid.getNormalizedBoneNode("head");
      const spine = humanoid.getNormalizedBoneNode("spine");

      // Lower arms to sides (rotate Z axis) - more natural than T-pose
      if (leftUpperArm) {
        leftUpperArm.rotation.z = Math.PI * 0.45; // ~81 degrees down from T-pose
      }
      if (rightUpperArm) {
        rightUpperArm.rotation.z = -Math.PI * 0.45;
      }

      // Slight elbow bend (arms slightly forward)
      if (leftLowerArm) {
        leftLowerArm.rotation.y = Math.PI * 0.08;
        leftLowerArm.rotation.z = Math.PI * 0.05;
      }
      if (rightLowerArm) {
        rightLowerArm.rotation.y = -Math.PI * 0.08;
        rightLowerArm.rotation.z = -Math.PI * 0.05;
      }

      // Slight head tilt (looking slightly forward)
      if (head) {
        head.rotation.x = Math.PI * 0.02;
      }

      // Natural spine curve
      if (spine) {
        spine.rotation.x = -Math.PI * 0.01;
      }

      // Update world matrices
      vrm.scene.updateMatrixWorld(true);

      return "manual_idle";
    }

    // GLB model with no animations - use bind pose
    console.log(
      `[VRMImposterBaker] GLB model '${animationName}' with no animations, using bind pose`,
    );
    vrm.scene.updateMatrixWorld(true);

    return "bind_pose";
  }

  /**
   * Bake a VRM model into an octahedral imposter atlas
   */
  async bake(request: VRMBakeRequest): Promise<VRMBakeResult> {
    const startTime = Date.now();

    // Load VRM with animations
    const loadedVRM = await this.loadVRM(request.modelUrl);
    if (!loadedVRM) {
      return {
        success: false,
        assetId: request.assetId,
        error: `Failed to load VRM: ${request.modelUrl}`,
        duration: Date.now() - startTime,
      };
    }

    const { vrm, animations } = loadedVRM;

    console.log(
      `[VRMImposterBaker] Loaded ${request.assetId} with ${animations.length} animations: ${animations.map((a) => a.name).join(", ") || "none"}`,
    );

    // Pose at idle frame using actual animation if available
    const usedAnimationName = this.poseVRMAtFrame(
      loadedVRM,
      request.animationName || "idle",
      request.animationFrame || 0.25,
    );

    // Calculate bounding sphere AFTER posing (pose affects bounds)
    const boundingBox = new THREE.Box3().setFromObject(vrm.scene);
    const boundingSphere = new THREE.Sphere();
    boundingBox.getBoundingSphere(boundingSphere);

    console.log(
      `[VRMImposterBaker] Baking ${request.assetId} with pose '${usedAnimationName}', bounds radius: ${boundingSphere.radius.toFixed(2)}`,
    );

    // Bake imposter atlas - bake() is async and must be awaited
    const bakeResult = await this.baker.bake(vrm.scene, {
      atlasWidth: request.config.atlasWidth,
      atlasHeight: request.config.atlasHeight,
      gridSizeX: request.config.gridSizeX,
      gridSizeY: request.config.gridSizeY,
      octType:
        request.config.octType === "HEMI"
          ? OctahedronType.HEMI
          : OctahedronType.FULL,
      backgroundColor: request.config.backgroundColor,
      backgroundAlpha: request.config.backgroundAlpha,
    });

    // Export atlas as data URL
    const atlasDataUrl = this.baker.exportAtlasAsDataURL(bakeResult, "png");
    if (!atlasDataUrl) {
      return {
        success: false,
        assetId: request.assetId,
        error: "Failed to export atlas texture",
        duration: Date.now() - startTime,
      };
    }

    // Create metadata with actual animation name used
    const metadata: Partial<ImpostorMetadata> = {
      assetId: request.assetId,
      category: request.category,
      modelPath: request.modelUrl,
      gridSizeX: request.config.gridSizeX,
      gridSizeY: request.config.gridSizeY,
      octType: request.config.octType,
      atlasWidth: request.config.atlasWidth,
      atlasHeight: request.config.atlasHeight,
      boundingSphereRadius: boundingSphere.radius,
      boundingSphereCenterY: boundingSphere.center.y,
      animationFrame: request.animationFrame || 0.25,
      animationName: usedAnimationName, // Use actual animation name that was applied
      generatedAt: new Date().toISOString(),
      version: 1,
    };

    // Cleanup
    bakeResult.renderTarget.dispose();

    return {
      success: true,
      assetId: request.assetId,
      atlasDataUrl,
      metadata,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Bake and upload to server
   */
  async bakeAndUpload(
    request: VRMBakeRequest,
    apiBase: string,
  ): Promise<ImpostorBakeResult> {
    const bakeResult = await this.bake(request);

    if (!bakeResult.success || !bakeResult.atlasDataUrl) {
      return {
        assetId: request.assetId,
        success: false,
        error: bakeResult.error,
        duration: bakeResult.duration,
      };
    }

    // Extract base64 data from data URL
    const base64Data = bakeResult.atlasDataUrl.split(",")[1];

    // Upload atlas to server
    const uploadResponse = await fetch(`${apiBase}/api/lod/imposter/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: request.assetId,
        category: request.category,
        imageData: base64Data,
      }),
    });

    if (!uploadResponse.ok) {
      return {
        assetId: request.assetId,
        success: false,
        error: `Upload failed: ${uploadResponse.statusText}`,
        duration: bakeResult.duration,
      };
    }

    const uploadResult = await uploadResponse.json();

    // Create full metadata with atlas path
    const fullMetadata: ImpostorMetadata = {
      ...(bakeResult.metadata as ImpostorMetadata),
      atlasPath: uploadResult.path,
    };

    return {
      assetId: request.assetId,
      success: true,
      metadata: fullMetadata,
      atlasPath: uploadResult.path,
      duration: bakeResult.duration,
    };
  }

  /**
   * Process a batch of VRM models
   */
  async processBatch(
    requests: VRMBakeRequest[],
    apiBase: string,
    onProgress?: (completed: number, total: number, current: string) => void,
  ): Promise<ImpostorBakeResult[]> {
    const results: ImpostorBakeResult[] = [];
    const total = requests.length;

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      onProgress?.(i, total, request.assetId);

      const result = await this.bakeAndUpload(request, apiBase);
      results.push(result);
    }

    onProgress?.(total, total, "Complete");
    return results;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.baker.dispose();
    this.renderer.dispose();
    this.loadingPromises.clear();
  }
}

/**
 * Create a singleton baker instance for the Asset-Forge UI
 */
let singletonBaker: VRMImposterBaker | null = null;

export function getVRMImposterBaker(): VRMImposterBaker {
  if (!singletonBaker) {
    singletonBaker = new VRMImposterBaker();
  }
  return singletonBaker;
}

export function disposeVRMImposterBaker(): void {
  if (singletonBaker) {
    singletonBaker.dispose();
    singletonBaker = null;
  }
}
