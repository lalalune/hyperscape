/**
 * Post-Processing Factory
 * Creates post-processing pipelines for WebGL or WebGPU
 */

import THREE from "../../extras/three/three";
import type { UniversalRenderer } from "./RendererFactory";
import { isWebGLRenderer, isWebGPURenderer } from "./RendererFactory";

// WebGL post-processing (pmndrs/postprocessing) - imported at build time
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  SelectiveBloomEffect,
} from "postprocessing";

export type PostProcessingComposer = EffectComposer & {
  bloomPass?: EffectPass;
  bloom?: SelectiveBloomEffect;
};

export interface PostProcessingOptions {
  bloom?: {
    enabled: boolean;
    intensity?: number;
    threshold?: number;
    radius?: number;
  };
  multisampling?: number;
  frameBufferType?: THREE.TextureDataType;
}

/**
 * Create post-processing composer
 */
export async function createPostProcessing(
  renderer: UniversalRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: PostProcessingOptions = {},
): Promise<PostProcessingComposer | null> {
  if (isWebGLRenderer(renderer)) {
    return createWebGLPostProcessing(renderer, scene, camera, options);
  } else if (isWebGPURenderer(renderer)) {
    return createWebGPUPostProcessing(renderer, scene, camera, options);
  }

  return null;
}

/**
 * Create WebGL post-processing (pmndrs/postprocessing)
 */
async function createWebGLPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: PostProcessingOptions,
): Promise<PostProcessingComposer | null> {
  const {
    bloom = { enabled: true, intensity: 0.3, threshold: 1.0, radius: 0.5 },
    multisampling = 8,
    frameBufferType = THREE.HalfFloatType,
  } = options;

  const context = renderer.getContext() as WebGL2RenderingContext;
  const maxMultisampling = context.MAX_SAMPLES
    ? context.getParameter(context.MAX_SAMPLES)
    : 8;

  const composer = new EffectComposer(renderer, {
    frameBufferType,
    multisampling: Math.min(multisampling, maxMultisampling),
  }) as PostProcessingComposer;

  // Render pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Bloom effect
  if (bloom.enabled) {
    const bloomEffect = new SelectiveBloomEffect(scene, camera, {
      intensity: bloom.intensity ?? 0.3,
      luminanceThreshold: bloom.threshold ?? 1.0,
      luminanceSmoothing: 0.05,
      radius: bloom.radius ?? 0.5,
      mipmapBlur: true,
      levels: 4,
    });

    bloomEffect.inverted = false;
    bloomEffect.selection.layer = 14; // NO_BLOOM layer

    const bloomPass = new EffectPass(camera, bloomEffect);
    composer.addPass(bloomPass);
    // Store bloom pass reference for enabling/disabling
    composer.bloomPass = bloomPass;
    composer.bloom = bloomEffect;
  }

  return composer;
}

/**
 * Create WebGPU post-processing (three.js TSL-based)
 *
 * Note: WebGPU post-processing requires three.js r163+ with stable TSL.
 * Current version does not support TSL-based post-processing.
 * WebGPU users get direct rendering, which provides excellent performance.
 *
 * When upgrading to three.js r163+, see commented implementation below.
 */
async function createWebGPUPostProcessing(
  _renderer: UniversalRenderer,
  _scene: THREE.Scene,
  _camera: THREE.Camera,
  _options: PostProcessingOptions,
): Promise<PostProcessingComposer | null> {
  // WebGPU post-processing not available in current three.js version
  // Direct rendering is used instead - acceptable performance trade-off
  return null;
}

/* When three.js is updated to r163+, replace createWebGPUPostProcessing with this:

async function createWebGPUPostProcessing(
  renderer: UniversalRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: PostProcessingOptions
): Promise<PostProcessingComposer | null> {
  
  try {
    const { default: PostProcessing } = await import('three/addons/tsl/display/PostProcessing.js');
    const { pass } = await import('three/addons/tsl/display/PassNode.js');
    const { bloom } = await import('three/addons/tsl/display/BloomNode.js');
    const { ao } = await import('three/addons/tsl/display/AONode.js');
    
    const {
      bloom: bloomOptions = { enabled: true, intensity: 0.3, threshold: 1.0, radius: 0.5 }
    } = options;
    
    // Create post-processing instance
    const postProcessing = new PostProcessing(renderer);
    
    // Add basic scene pass
    const scenePass = pass(scene, camera);
    let outputNode = scenePass;
    
    // Add ambient occlusion if enabled
    if (bloomOptions.enabled) {
      const aoNode = ao(scenePass, camera);
      outputNode = aoNode;
    }
    
    // Add bloom if enabled
    if (bloomOptions.enabled) {
      const bloomNode = bloom(outputNode, bloomOptions.intensity ?? 0.3, bloomOptions.radius ?? 0.5, bloomOptions.threshold ?? 1.0);
      outputNode = bloomNode;
    }
    
    // Set output
    postProcessing.outputNode = outputNode;
    
    // Create composer-compatible wrapper
    const composer: PostProcessingComposer = {
      render: (deltaTime?: number) => {
        postProcessing.render();
      },
      setSize: (width: number, height: number) => {
        postProcessing.setSize(width, height);
      },
      dispose: () => {
        postProcessing.dispose?.();
      }
    };
    
    // Store internal references for bloom toggling
    (composer as any)._postProcessing = postProcessing;
    (composer as any)._bloomNode = bloomOptions.enabled ? outputNode : null;
    (composer as any)._scenePass = scenePass;
    (composer as any)._bloomEnabled = bloomOptions.enabled;
    
    return composer;
  } catch (error) {
    console.warn('[PostProcessingFactory] WebGPU post-processing not available:', error);
    return null;
  }
}
*/

/**
 * Enable/disable bloom effect
 */
export function setBloomEnabled(
  composer: PostProcessingComposer | null,
  enabled: boolean,
): void {
  if (!composer) return;

  // WebGL post-processing (pmndrs/postprocessing)
  if (composer.bloomPass) {
    composer.bloomPass.enabled = enabled;
    return;
  }
}

/**
 * Dispose post-processing composer
 */
export function disposePostProcessing(
  composer: PostProcessingComposer | null,
): void {
  if (!composer) return;

  if (composer.dispose) {
    composer.dispose();
  }

  // Dispose bloom effect if present
  composer.bloom?.dispose?.();
}
