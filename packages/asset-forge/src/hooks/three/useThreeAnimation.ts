/**
 * useThreeAnimation Hook
 * Manages animation loading, playback, and control
 */

import { useRef, useState, useCallback } from 'react'
import { AnimationClip, AnimationMixer, Clock, LoopRepeat, Object3D, SkinnedMesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface AnimationState {
  animations: AnimationClip[]
  currentAnimation: number
  isPlaying: boolean
  timeScale: number
}

export const useThreeAnimation = (model: Object3D | null) => {
  const mixerRef = useRef<AnimationMixer | null>(null)
  const clockRef = useRef<Clock | null>(null)

  const [animations, setAnimations] = useState<AnimationClip[]>([])
  const [currentAnimation, setCurrentAnimation] = useState<number>(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [timeScale, setTimeScale] = useState(1.0)

  /**
   * Initialize animation mixer
   */
  const initializeMixer = useCallback(() => {
    if (!model || mixerRef.current) return

    const mixer = new AnimationMixer(model)
    mixerRef.current = mixer
    clockRef.current = new Clock()

    return mixer
  }, [model])

  /**
   * Load animation from URL
   */
  const loadAnimation = useCallback(
    async (url: string, name: string) => {
      if (!model) throw new Error('No model loaded')

      const loader = new GLTFLoader()

      try {
        const gltf = await loader.loadAsync(url)

        if (gltf.animations && gltf.animations.length > 0) {
          const animationClip = gltf.animations[0]
          animationClip.name = name

          // Initialize mixer if not already done
          if (!mixerRef.current) {
            initializeMixer()
          }

          // Add animation to collection
          setAnimations((prev) => {
            const existing = prev.filter((anim) => anim.name !== name)
            return [...existing, animationClip]
          })

          console.log(`Successfully loaded animation: ${name}`)
        }
      } catch (error) {
        console.error(`Failed to load animation from ${url}:`, error)
        throw error
      }
    },
    [model, initializeMixer]
  )

  /**
   * Play animation by name
   */
  const playAnimation = useCallback(
    (name: string) => {
      if (!mixerRef.current || !animations.length) {
        console.log(`Cannot play animation: mixer=${!!mixerRef.current}, animations=${animations.length}`)
        return
      }

      const animation = animations.find((anim) => anim.name === name)

      if (!animation) {
        console.error(`Animation "${name}" not found`)

        // Play first available animation as fallback
        if (animations.length > 0) {
          console.log(`Playing first available animation: ${animations[0].name}`)
          const firstAnimation = animations[0]
          mixerRef.current.stopAllAction()
          const action = mixerRef.current.clipAction(firstAnimation)
          action.reset()
          action.setLoop(LoopRepeat, Infinity)
          action.timeScale = timeScale
          action.play()
          setCurrentAnimation(0)
          setIsPlaying(true)

          if (!clockRef.current) {
            clockRef.current = new Clock()
          }
        }
        return
      }

      console.log(`Playing animation: ${name}`)
      mixerRef.current.stopAllAction()
      const action = mixerRef.current.clipAction(animation)
      action.reset()
      action.setLoop(LoopRepeat, Infinity)
      action.timeScale = timeScale
      action.play()
      setCurrentAnimation(animations.indexOf(animation))
      setIsPlaying(true)

      if (!clockRef.current) {
        clockRef.current = new Clock()
      }
    },
    [animations, timeScale]
  )

  /**
   * Stop animation and reset to T-pose
   */
  const stopAnimation = useCallback(() => {
    if (mixerRef.current) {
      mixerRef.current.stopAllAction()
    }

    // Reset model to bind pose
    if (model) {
      model.traverse((child) => {
        if (child instanceof SkinnedMesh && child.skeleton) {
          child.skeleton.pose()
          child.updateMatrixWorld(true)
        }
      })
    }

    setIsPlaying(false)
    setCurrentAnimation(-1)
  }, [model])

  /**
   * Pause animation
   */
  const pauseAnimation = useCallback(() => {
    if (mixerRef.current) {
      mixerRef.current.timeScale = 0
      setIsPlaying(false)
    }
  }, [])

  /**
   * Resume animation
   */
  const resumeAnimation = useCallback(() => {
    if (mixerRef.current) {
      mixerRef.current.timeScale = timeScale
      setIsPlaying(true)

      if (!clockRef.current) {
        clockRef.current = new Clock()
      }
    }
  }, [timeScale])

  /**
   * Set animation time scale (speed)
   */
  const setAnimationTimeScale = useCallback((scale: number) => {
    setTimeScale(scale)

    if (mixerRef.current && isPlaying) {
      mixerRef.current.timeScale = scale
    }
  }, [isPlaying])

  /**
   * Update mixer in animation loop
   */
  const updateMixer = useCallback(() => {
    if (mixerRef.current && clockRef.current && isPlaying) {
      const delta = clockRef.current.getDelta()
      mixerRef.current.update(delta)
    }
  }, [isPlaying])

  /**
   * Cleanup
   */
  const cleanup = useCallback(() => {
    if (mixerRef.current) {
      mixerRef.current.stopAllAction()
      mixerRef.current = null
    }

    clockRef.current = null
    setAnimations([])
    setCurrentAnimation(-1)
    setIsPlaying(false)
  }, [])

  return {
    state: {
      animations,
      currentAnimation,
      isPlaying,
      timeScale
    },
    actions: {
      loadAnimation,
      playAnimation,
      stopAnimation,
      pauseAnimation,
      resumeAnimation,
      setAnimationTimeScale,
      updateMixer,
      cleanup
    }
  }
}
