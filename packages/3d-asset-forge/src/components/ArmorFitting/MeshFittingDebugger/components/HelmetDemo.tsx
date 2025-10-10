import React, { useRef, useState, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF, Html, Text as DreiText } from '@react-three/drei'
import { HelmetDemoProps } from '../types'

export const HelmetDemo: React.FC<HelmetDemoProps> = ({ 
    onReady, 
    showWireframe, 
    avatarPath, 
    helmetPath, 
    currentAnimation, 
    isAnimationPlaying, 
    showHeadBounds, 
    headBoundsHelperRef 
}) => {
    const avatarRef = useRef<THREE.Group>(null)
    const helmetRef = useRef<THREE.Group>(null)
    const [isLoaded, setIsLoaded] = useState(false)

    const mixer = useRef<THREE.AnimationMixer>()
    const lastTime = useRef(0)
    const activeAction = useRef<THREE.AnimationAction | null>(null)
    const animationFrame = useRef<number>()

    // Check if paths are valid before attempting to load
    const hasValidPaths = avatarPath && helmetPath && avatarPath !== '' && helmetPath !== ''

    // Determine if we need a separate animation file
    const needsAnimationFile = currentAnimation !== 'tpose'

    // Construct animation file path based on the model if animation is needed
    const animationPath = useMemo(() => {
        if (needsAnimationFile && avatarPath) {
            const match = avatarPath.match(/gdd-assets\/([^\/]+)\//);
            if (match) {
                const characterName = match[1];
                const animFileName = currentAnimation === 'walking' ? 'anim_walk.glb' : 'anim_run.glb';
                return `./gdd-assets/${characterName}/${animFileName}`;
            }
        }

        return null
    }, [avatarPath, currentAnimation, needsAnimationFile])

    // Only load models if paths are valid
    const animationGltf = hasValidPaths && animationPath ? useGLTF(animationPath) : null
    const avatar = hasValidPaths ? useGLTF(avatarPath) : null
    const helmet = hasValidPaths ? useGLTF(helmetPath) : null

    // Return early if no valid paths
    if (!hasValidPaths) {
        return (
            <group>
                <Html center>
                    <div style={{
                        color: 'white',
                        background: 'rgba(0,0,0,0.8)',
                        padding: '20px 40px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '16px',
                        fontWeight: '500',
                        minWidth: '400px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
                    }}>
                        Please select both an avatar and helmet from the Asset Selection panel
                    </div>
                </Html>
            </group>
        )
    }

    // Clone the scenes - handle skeleton setup for avatar
    const avatarClone = useMemo(() => {
        if (!avatar) return null
        const clone = avatar.scene.clone()

        // Handle SkinnedMesh skeleton setup
        const skinnedMeshes: THREE.SkinnedMesh[] = []
        const bones: THREE.Bone[] = []

        clone.traverse((child) => {
            if (child instanceof THREE.Bone) {
                bones.push(child)
            } else if (child instanceof THREE.SkinnedMesh) {
                skinnedMeshes.push(child)
            }
        })

        // Clone materials and geometries, setup skeleton
        clone.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh) {
                // Clone material and geometry
                if (child.material) {
                    child.material = (child.material as THREE.Material).clone()
                }
                if (child.geometry) {
                    child.geometry = child.geometry.clone()
                }

                // Create new skeleton for the cloned mesh
                if (bones.length > 0) {
                    const newSkeleton = new THREE.Skeleton(bones)
                    child.bind(newSkeleton, child.bindMatrix)
                }
            } else if (child instanceof THREE.Mesh) {
                if (child.material) {
                    child.material = (child.material as THREE.Material).clone()
                }
                if (child.geometry) {
                    child.geometry = child.geometry.clone()
                }
            }
        })

        return clone
    }, [avatar, avatarPath])

    const helmetClone = useMemo(() => {
        if (!helmet) return null
        const clone = helmet.scene.clone()
        
        // Mark as helmet for easier cleanup
        clone.userData.isHelmet = true
        clone.name = 'HelmetClone'
        
        clone.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material = child.material.clone()
                child.userData.isHelmet = true
            }
        })
        return clone
    }, [helmet, helmetPath])

    // Reset when paths change
    useEffect(() => {
        setIsLoaded(false)
    }, [avatarPath, helmetPath])

    // Update wireframe mode without re-cloning
    useEffect(() => {
        if (avatarClone) {
            avatarClone.traverse((child) => {
                if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
                    if (child.material) {
                        (child.material as THREE.MeshStandardMaterial).wireframe = showWireframe
                    }
                }
            })
        }
        if (helmetClone) {
            helmetClone.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (child.material) {
                        (child.material as THREE.MeshStandardMaterial).wireframe = showWireframe
                    }
                }
            })
        }
    }, [showWireframe, avatarClone, helmetClone])

    // Find meshes and call onReady
    useEffect(() => {
        if (!avatarClone || !helmetClone) return

        let avatarMesh: THREE.SkinnedMesh | null = null
        let helmetMesh: THREE.Mesh | null = null

        avatarClone.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh && !avatarMesh) {
                avatarMesh = child
            }
        })

        helmetClone.traverse((child) => {
            if (child instanceof THREE.Mesh && !helmetMesh) {
                helmetMesh = child
            }
        })

        if (avatarMesh && helmetMesh) {
            console.log('HelmetDemo: Calling onReady with meshes', avatarMesh, helmetMesh)
            onReady(avatarMesh, helmetMesh)
            setIsLoaded(true)
        }
    }, [avatarClone, helmetClone, onReady])

    // Animation mixer ref
    const mixerRef = useRef<THREE.AnimationMixer | null>(null)

    // Handle animation playback
    useEffect(() => {
        if (!avatar || !avatarClone || !isLoaded) return

        // Find the avatar mesh
        let avatarMesh: THREE.SkinnedMesh | null = null
        avatarClone.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh && !avatarMesh) {
                avatarMesh = child
            }
        })

        if (!avatarMesh) return

        // Check for animations in both base model and animation file
        let animations = avatar.animations

        // If we're playing an animation and base model has no animations, check animation file
        if (isAnimationPlaying && currentAnimation !== 'tpose' && animations.length === 0 && animationGltf) {
            animations = animationGltf.animations
            console.log(`Using animations from ${currentAnimation} file:`, animations.length)
        } else {
            console.log(`Animations found in base model:`, animations.length)
        }

        if (!animations || animations.length === 0) {
            console.log('No animations found in either base model or animation file')
            return
        }

        // Create animation mixer if needed - always create new one for new model
        mixerRef.current = new THREE.AnimationMixer(avatarClone)
        const mixer = mixerRef.current

        // Handle animation state
        if (isAnimationPlaying && currentAnimation !== 'tpose') {
            // Find the specific animation by name
            let targetClip: THREE.AnimationClip | undefined

            // Try to find animation by name patterns - be more specific
            for (const clip of animations) {
                const clipName = clip.name.toLowerCase()
                console.log(`Available animation: "${clip.name}" (duration: ${clip.duration}s)`)

                // For walking, prefer "walk" but exclude "run"
                if (currentAnimation === 'walking') {
                    if ((clipName.includes('walk') || clipName.includes('walking')) &&
                        !clipName.includes('run') && !clipName.includes('running')) {
                        targetClip = clip
                        console.log(`Selected walking animation: "${clip.name}"`)
                        break
                    }
                }
                // For running, prefer "run" but exclude "walk"
                else if (currentAnimation === 'running') {
                    if ((clipName.includes('run') || clipName.includes('running')) &&
                        !clipName.includes('walk') && !clipName.includes('walking')) {
                        targetClip = clip
                        console.log(`Selected running animation: "${clip.name}"`)
                        break
                    }
                }
            }

            // If no specific animation found, try the first one
            if (!targetClip && animations.length > 0) {
                targetClip = animations[0]
                console.log('Using first available animation:', targetClip.name)
            }

            if (targetClip) {
                const action = mixer.clipAction(targetClip)
                action.reset()
                action.setLoop(THREE.LoopRepeat, Infinity)
                action.play()
                console.log('Playing animation:', targetClip.name)
            }
        } else {
            // Stop all animations
            mixer.stopAllAction()
        }

        // Cleanup
        return () => {
            if (mixer) {
                mixer.stopAllAction()
                mixerRef.current = null
            }
        }
    }, [avatar, avatarClone, isLoaded, isAnimationPlaying, currentAnimation, animationGltf])

    // Animation update loop  
    const frameCountRef = useRef(0)
    useFrame((state, delta) => {
        if (mixerRef.current && isAnimationPlaying && currentAnimation !== 'tpose') {
            mixerRef.current.update(delta)

            // Log every 60 frames to avoid spam
            frameCountRef.current++
            if (frameCountRef.current % 60 === 0) {
                console.log('Animation updating...', currentAnimation)
            }
        }
    })

    if (!avatarClone || !helmetClone) return null

    return (
        <group position={[0, 0, 0]}>
            {/* Label */}
            <DreiText
                position={[0, 4.5, 0]}
                fontSize={0.3}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
            >
                Helmet Fitting
            </DreiText>

            <group ref={avatarRef}>
                <primitive object={avatarClone} />
            </group>

            <group ref={helmetRef}>
                <primitive object={helmetClone} />
            </group>

            {/* Head Bounds Helper */}
            {showHeadBounds && headBoundsHelperRef.current && (
                <primitive object={headBoundsHelperRef.current} />
            )}
        </group>
    )
}