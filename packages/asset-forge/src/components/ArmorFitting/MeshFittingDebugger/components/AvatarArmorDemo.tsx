import { useGLTF, Html, Text as DreiText } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import React, { useRef, useState, useEffect, useMemo } from 'react'
import {
  AnimationClip, AnimationMixer, Bone, Box3, Group, LoopRepeat, Material,
  Mesh, MeshStandardMaterial, Object3D, Skeleton, SkinnedMesh, Vector3
} from 'three'

import { AvatarArmorDemoProps } from '../types'
import { cloneGeometryForModification, cloneMaterialForModification } from '../../../../utils/three-geometry-sharing'

export const AvatarArmorDemo: React.FC<AvatarArmorDemoProps> = ({ 
    onReady, 
    showWireframe, 
    avatarPath, 
    armorPath, 
    currentAnimation, 
    isAnimationPlaying 
}) => {
    const avatarRef = useRef<Group>(null)
    const armorRef = useRef<Group>(null)
    const [isLoaded, setIsLoaded] = useState(false)

//     const _mixer = useRef<AnimationMixer>()
//     const _lastTime = useRef(0)
//     const _activeAction = useRef<AnimationAction | null>(null)
//     const _animationFrame = useRef<number>()

    // Check if paths are valid before attempting to load
    const hasValidPaths = avatarPath && armorPath && avatarPath !== '' && armorPath !== ''

    // Determine if we need a separate animation file
    const needsAnimationFile = currentAnimation !== 'tpose'

    // Construct animation file path based on the model if animation is needed
    const animationPath = useMemo(() => {
        if (needsAnimationFile && avatarPath) {
            const match = avatarPath.match(new RegExp('gdd-assets/([^/]+)/'));
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
    const armor = hasValidPaths ? useGLTF(armorPath) : null

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
                        Please select both an avatar and armor from the Asset Selection panel
                    </div>
                </Html>
            </group>
        )
    }

    // Log available animations on load
    useEffect(() => {
        if (avatar && avatar.animations.length > 0) {
            console.log('=== Available animations in base model ===')
            avatar.animations.forEach((clip: AnimationClip, index: number) => {
                console.log(`${index}: ${clip.name} (${clip.duration}s)`)
            })
        }
    }, [avatar])

    // Clone the scenes to ensure fresh instances every time
    const avatarClone = useMemo(() => {
        if (!avatar) return null
        const clone = avatar.scene.clone()

        // Handle SkinnedMesh skeleton setup
        const skinnedMeshes: SkinnedMesh[] = []
        const bones: Bone[] = []

        clone.traverse((child) => {
            if (child instanceof Bone) {
                bones.push(child)
            } else if (child instanceof SkinnedMesh) {
                skinnedMeshes.push(child)
            }
        })

        // Clone materials and geometries, setup skeleton
        clone.traverse((child) => {
            if (child instanceof SkinnedMesh) {
                // Clone material and geometry for fitting
                if (child.material) {
                    child.material = cloneMaterialForModification(child.material as Material, 'avatar armor demo fitting')
                }
                if (child.geometry) {
                    child.geometry = cloneGeometryForModification(child.geometry, 'avatar armor demo fitting')
                }

                // Create new skeleton for the cloned mesh
                if (bones.length > 0) {
                    const newSkeleton = new Skeleton(bones)
                    child.bind(newSkeleton, child.bindMatrix)
                }
            } else if (child instanceof Mesh) {
                if (child.material) {
                    child.material = cloneMaterialForModification(child.material as Material, 'avatar armor demo fitting')
                }
                if (child.geometry) {
                    child.geometry = cloneGeometryForModification(child.geometry, 'avatar armor demo fitting')
                }
            }
        })

        return clone
    }, [avatar]) // Re-clone when model changes

    const armorClone = useMemo(() => {
        if (!armor) return null
        const clone = armor.scene.clone()
        
        // Mark as armor for easier cleanup
        clone.userData.isArmor = true
        clone.name = 'ArmorClone'
        
        // Clone materials and geometries for fitting to ensure complete separation
        clone.traverse((child) => {
            if (child instanceof Mesh) {
                child.userData.isArmor = true
                if (child.material) {
                    child.material = cloneMaterialForModification(child.material as Material, 'armor clone')
                }
                if (child.geometry) {
                    child.geometry = cloneGeometryForModification(child.geometry, 'armor clone')
                }
            }
        })
        return clone
    }, [armor]) // Re-clone when model changes

    // Reset when paths change
    useEffect(() => {
        setIsLoaded(false)
    }, [avatarPath, armorPath])

    // Update wireframe mode without re-cloning
    useEffect(() => {
        if (armorClone) {
            armorClone.traverse((child) => {
                if (child instanceof Mesh) {
                    if (child.material) {
                        (child.material as MeshStandardMaterial).wireframe = showWireframe
                    }
                }
            })
        }
    }, [showWireframe, armorClone])

    useEffect(() => {
        if (avatarClone && armorClone && !isLoaded) {
            // Find the SkinnedMesh in the cloned avatar
            let avatarMesh: SkinnedMesh | null = null
            avatarClone.traverse((child: Object3D) => {
                if (child instanceof SkinnedMesh && !avatarMesh) {
                    avatarMesh = child
                    // Set avatar material to be semi-transparent
                    if (avatarMesh.material) {
                        const material = avatarMesh.material as MeshStandardMaterial
                        material.transparent = true
                        material.opacity = 0.7
                    }
                }
            })

            // Find the Mesh in the cloned armor
            let armorMesh: Mesh | null = null
            armorClone.traverse((child: Object3D) => {
                if (child instanceof Mesh && !armorMesh) {
                    armorMesh = child

                    // No need to clear userData - we have a fresh clone!
                    // No need to reset transforms - they're already at defaults!

                    // Set armor material to wireframe
                    if (armorMesh.material) {
                        const material = armorMesh.material as MeshStandardMaterial
                        material.color.set('#4472C4')
                        material.transparent = true
                        material.opacity = 0.8
                    }
                }
            })

            if (avatarMesh && armorMesh) {
                // TypeScript needs explicit reassignment for proper type narrowing
                const finalAvatarMesh = avatarMesh as SkinnedMesh
                const finalArmorMesh = armorMesh as Mesh

                console.log('AvatarArmorDemo: Setting up meshes')
                console.log('Avatar mesh found:', finalAvatarMesh)
                console.log('Armor mesh found:', finalArmorMesh)

                // Ensure avatar stands on the grid
                avatarClone.updateMatrixWorld(true)
                const initialAvatarBounds = new Box3().setFromObject(avatarClone)
                const avatarMinY = initialAvatarBounds.min.y

                if (avatarMinY !== 0) {
                    // Adjust position so avatar's feet are at Y=0
                    avatarClone.position.y = -avatarMinY
                    console.log(`Adjusted avatar Y position by ${-avatarMinY} to stand on grid`)
                }

                // Mark them
                finalAvatarMesh.userData.isAvatar = true
                finalArmorMesh.userData.isArmor = true
                finalArmorMesh.userData.isSource = true

                // Original geometry storage is now handled in handleModelsLoaded callback
                // finalArmorMesh.userData.originalGeometry = { current: finalArmorMesh.geometry.clone() }

                // Basic scale normalization - scale both to same size
                const avatarBounds = new Box3().setFromObject(finalAvatarMesh)
                const avatarHeight = avatarBounds.getSize(new Vector3()).y
                const scale = 2 / avatarHeight // Normalize avatar to ~2 units tall

                console.log('=== INITIAL MODEL SETUP ===')
                console.log('Avatar original height:', avatarHeight)
                console.log('Normalizing scale:', scale)

                avatarClone.scale.setScalar(scale)
                armorClone.scale.setScalar(scale) // Use same scale for armor

                // Update matrices after scaling
                avatarClone.updateMatrixWorld(true)
                armorClone.updateMatrixWorld(true)

                // Log final setup state
                const setupAvatarBounds = new Box3().setFromObject(avatarClone)
                const setupArmorBounds = new Box3().setFromObject(armorClone)
                console.log('Avatar setup bounds:', setupAvatarBounds.getSize(new Vector3()))
                console.log('Armor setup bounds:', setupArmorBounds.getSize(new Vector3()))
                console.log('========================')

                // Don't do complex scaling here - let the fitting function handle it
                // Just normalize both models to a reasonable size

                console.log('Applied scale:', scale)
                console.log('Avatar scene scale:', avatarClone.scale.x, avatarClone.scale.y, avatarClone.scale.z)
                console.log('Armor scene scale:', armorClone.scale.x, armorClone.scale.y, armorClone.scale.z)

                // Update world matrices
                avatarClone.updateMatrixWorld(true)
                armorClone.updateMatrixWorld(true)

                // Check world matrices
                console.log('Avatar world matrix:', avatarClone.matrixWorld.elements)
                console.log('Armor world matrix:', armorClone.matrixWorld.elements)

                // Verify final bounds
                const finalAvatarBounds = new Box3().setFromObject(finalAvatarMesh)
                const finalArmorBounds = new Box3().setFromObject(finalArmorMesh)
                console.log('Final avatar bounds:', finalAvatarBounds)
                console.log('Final armor bounds:', finalArmorBounds)

                setIsLoaded(true)
                onReady(finalAvatarMesh, finalArmorMesh)
            }
        }
    }, [avatarClone, armorClone, isLoaded, onReady, showWireframe, avatarPath, armorPath])

    // Update wireframe when prop changes
    useEffect(() => {
        if (armorClone) {
            armorClone.traverse((child: Object3D) => {
                if (child instanceof Mesh && child.userData.isArmor) {
                    const material = child.material as MeshStandardMaterial
                    if (material) {
                        material.wireframe = showWireframe
                    }
                }
            })
        }
    }, [showWireframe, armorClone])

    // Animation mixer ref
    const mixerRef = useRef<AnimationMixer | null>(null)

    // Handle animation playback
    useEffect(() => {
        if (!avatar || !avatarClone || !isLoaded) return

        // Find the avatar mesh
        let avatarMesh: SkinnedMesh | null = null
        avatarClone.traverse((child) => {
            if (child instanceof SkinnedMesh && !avatarMesh) {
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
        mixerRef.current = new AnimationMixer(avatarClone)
        const mixer = mixerRef.current

        // Handle animation state
        if (isAnimationPlaying && currentAnimation !== 'tpose') {
            // Find the specific animation by name
            let targetClip: AnimationClip | undefined

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
                action.setLoop(LoopRepeat, Infinity)
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
    useFrame((_state, delta) => {
        if (mixerRef.current && isAnimationPlaying && currentAnimation !== 'tpose') {
            mixerRef.current.update(delta)

            // Log every 60 frames to avoid spam
            frameCountRef.current++
            if (frameCountRef.current % 60 === 0) {
                console.log('Animation updating...', currentAnimation)
            }
        }
    })

    if (!avatarClone || !armorClone) return null

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
                Real Armor → Avatar
            </DreiText>

            <group ref={avatarRef}>
                <primitive object={avatarClone} />
            </group>

            <group ref={armorRef}>
                <primitive object={armorClone} />
            </group>
        </group>
    )
}