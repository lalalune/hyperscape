/**
 * Lazy Loading Utilities for ML Libraries
 *
 * These utilities enable dynamic imports of TensorFlow.js and MediaPipe,
 * significantly reducing initial bundle size by only loading them when needed.
 *
 * Bundle Impact:
 * - @tensorflow/tfjs-core: ~800KB
 * - @tensorflow/tfjs-backend-webgl: ~500KB
 * - @tensorflow-models/hand-pose-detection: ~300KB
 * - @mediapipe/hands: ~400KB
 *
 * Total savings: ~2MB when hand rigging is not used
 */

import type * as handPoseDetection from '@tensorflow-models/hand-pose-detection'

/**
 * Lazy load TensorFlow.js and setup WebGL backend
 */
export async function loadTensorFlow(): Promise<typeof import('@tensorflow/tfjs')> {
  // Import TensorFlow core
  const tf = await import('@tensorflow/tfjs')

  // Import and register WebGL backend
  await import('@tensorflow/tfjs-backend-webgl')

  // Set WebGL as the backend
  await tf.setBackend('webgl')

  return tf
}

/**
 * Lazy load MediaPipe Hands
 */
export async function loadMediaPipeHands(): Promise<typeof import('@mediapipe/hands')> {
  return await import('@mediapipe/hands')
}

/**
 * Lazy load Hand Pose Detection model
 */
export async function loadHandPoseDetection(): Promise<{
  handPoseDetection: typeof handPoseDetection
  tf: typeof import('@tensorflow/tfjs')
}> {
  const [handPoseDetectionModule, tf] = await Promise.all([
    import('@tensorflow-models/hand-pose-detection'),
    loadTensorFlow()
  ])

  return {
    handPoseDetection: handPoseDetectionModule,
    tf
  }
}

/**
 * Create a hand detector with lazy loading
 */
export async function createHandDetector(
  model: handPoseDetection.SupportedModels = 'MediaPipeHands' as unknown as handPoseDetection.SupportedModels,
  config?: handPoseDetection.MediaPipeHandsModelConfig
): Promise<handPoseDetection.HandDetector> {
  const { handPoseDetection } = await loadHandPoseDetection()

  // Ensure TensorFlow is ready
  await loadTensorFlow()

  // Create and return detector
  return await handPoseDetection.createDetector(model, config)
}

/**
 * Preload ML libraries during idle time
 * Call this to warm up the cache without blocking
 */
export async function preloadMLLibraries(): Promise<void> {
  // Use requestIdleCallback if available
  if ('requestIdleCallback' in window) {
    return new Promise((resolve) => {
      window.requestIdleCallback(async () => {
        await Promise.all([
          loadTensorFlow(),
          loadMediaPipeHands()
        ])
        resolve()
      })
    })
  } else {
    // Fallback to setTimeout
    return new Promise((resolve) => {
      setTimeout(async () => {
        await Promise.all([
          loadTensorFlow(),
          loadMediaPipeHands()
        ])
        resolve()
      }, 1000)
    })
  }
}

/**
 * Check if ML libraries are already loaded
 */
export function areMLLibrariesLoaded(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error - checking for global tf object
    typeof window.tf !== 'undefined'
  )
}
