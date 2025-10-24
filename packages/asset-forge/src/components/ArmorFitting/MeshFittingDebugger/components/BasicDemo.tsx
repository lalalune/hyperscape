import { Text as DreiText } from '@react-three/drei'
import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { BufferGeometry, Mesh, MeshStandardMaterial } from 'three'

import { cloneGeometryForModification } from '../../../../utils/three-geometry-sharing'

interface BasicDemoProps {
    showWireframe: boolean
}

export interface BasicDemoRef {
    sourceCubeRef: React.RefObject<Mesh | null>
    sourceSphereRef: React.RefObject<Mesh | null>
    targetCubeRef: React.RefObject<Mesh | null>
    targetSphereRef: React.RefObject<Mesh | null>
}

export const BasicDemo = forwardRef<BasicDemoRef, BasicDemoProps>(({ showWireframe }, ref) => {
    // Source meshes (the ones being deformed)
    const sourceCubeRef = useRef<Mesh | null>(null)
    const sourceSphereRef = useRef<Mesh | null>(null)

    // Target meshes (the ones being fitted to)
    const targetSphereRef = useRef<Mesh | null>(null)
    const targetCubeRef = useRef<Mesh | null>(null)

    // Store original geometries
    const originalSourceCubeGeometry = useRef<BufferGeometry | null>(null)
    const originalSourceSphereGeometry = useRef<BufferGeometry | null>(null)

    // Expose refs to parent
    useImperativeHandle(ref, () => ({
        sourceCubeRef,
        sourceSphereRef,
        targetCubeRef,
        targetSphereRef
    }))

    // Store original geometries on mount (for reset functionality)
    useEffect(() => {
        if (sourceCubeRef.current && !originalSourceCubeGeometry.current) {
            originalSourceCubeGeometry.current = cloneGeometryForModification(
                sourceCubeRef.current.geometry,
                'backup original cube'
            )
            console.log('Stored original cube geometry')
        }
        if (sourceSphereRef.current && !originalSourceSphereGeometry.current) {
            originalSourceSphereGeometry.current = cloneGeometryForModification(
                sourceSphereRef.current.geometry,
                'backup original sphere'
            )
            console.log('Stored original sphere geometry')
        }
    }, [])

    // Update wireframe
    useEffect(() => {
        const updateMeshWireframe = (mesh: Mesh | null) => {
            if (mesh && mesh.material) {
                (mesh.material as MeshStandardMaterial).wireframe = showWireframe
            }
        }

        updateMeshWireframe(sourceCubeRef.current)
        updateMeshWireframe(sourceSphereRef.current)
        updateMeshWireframe(targetCubeRef.current)
        updateMeshWireframe(targetSphereRef.current)
    }, [showWireframe])

    return (
        <>
            {/* Cube to Sphere Demo (left side) */}
            <group position={[-2.5, 0, 0]}>
                {/* Label */}
                <DreiText
                    position={[0, 2, 0]}
                    fontSize={0.3}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                >
                    Cube → Sphere
                </DreiText>

                {/* Source Cube (larger, to wrap onto sphere) */}
                <mesh
                    ref={sourceCubeRef}
                    userData={{ originalGeometry: originalSourceCubeGeometry, isSource: true }}
                >
                    <boxGeometry args={[2.5, 2.5, 2.5, 10, 10, 10]} />
                    <meshStandardMaterial color="#4472C4" transparent opacity={0.8} />
                </mesh>

                {/* Target Sphere (smaller, inside the cube) */}
                <mesh
                    ref={targetSphereRef}
                    userData={{ isTarget: true }}
                >
                    <sphereGeometry args={[1, 32, 32]} />
                    <meshStandardMaterial color="#ED7D31" transparent opacity={0.6} />
                </mesh>
            </group>

            {/* Sphere to Cube Demo (right side) */}
            <group position={[2.5, 0, 0]}>
                {/* Label */}
                <DreiText
                    position={[0, 2, 0]}
                    fontSize={0.3}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                >
                    Sphere → Cube
                </DreiText>

                {/* Source Sphere (larger, to wrap onto cube) */}
                <mesh
                    ref={sourceSphereRef}
                    userData={{ originalGeometry: originalSourceSphereGeometry, isSource: true }}
                >
                    <sphereGeometry args={[1.8, 32, 32]} />
                    <meshStandardMaterial color="#A5A5A5" transparent opacity={0.8} />
                </mesh>

                {/* Target Cube (smaller, inside the sphere) */}
                <mesh
                    ref={targetCubeRef}
                    userData={{ isTarget: true }}
                >
                    <boxGeometry args={[1.5, 1.5, 1.5]} />
                    <meshStandardMaterial color="#ED7D31" transparent opacity={0.6} />
                </mesh>
            </group>
        </>
    )
})

BasicDemo.displayName = 'BasicDemo'