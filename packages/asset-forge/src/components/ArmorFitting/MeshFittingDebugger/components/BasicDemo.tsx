import { Text as DreiText } from "@react-three/drei";
import React, {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import * as THREE from "three";

interface BasicDemoProps {
  showWireframe: boolean;
}

export interface BasicDemoRef {
  sourceCubeRef: React.RefObject<THREE.Mesh | null>;
  sourceSphereRef: React.RefObject<THREE.Mesh | null>;
  targetCubeRef: React.RefObject<THREE.Mesh | null>;
  targetSphereRef: React.RefObject<THREE.Mesh | null>;
}

export const BasicDemo = forwardRef<BasicDemoRef, BasicDemoProps>(
  ({ showWireframe }, ref) => {
    // Source meshes (the ones being deformed)
    const sourceCubeRef = useRef<THREE.Mesh>(null);
    const sourceSphereRef = useRef<THREE.Mesh>(null);

    // Target meshes (the ones being fitted to)
    const targetSphereRef = useRef<THREE.Mesh>(null);
    const targetCubeRef = useRef<THREE.Mesh>(null);

    // Store original geometries
    const originalSourceCubeGeometry = useRef<THREE.BufferGeometry | null>(
      null,
    );
    const originalSourceSphereGeometry = useRef<THREE.BufferGeometry | null>(
      null,
    );

    // Expose refs to parent
    useImperativeHandle(ref, () => ({
      sourceCubeRef,
      sourceSphereRef,
      targetCubeRef,
      targetSphereRef,
    }));

    // Store original geometries on mount
    useEffect(() => {
      if (sourceCubeRef.current && !originalSourceCubeGeometry.current) {
        originalSourceCubeGeometry.current =
          sourceCubeRef.current.geometry.clone();
        console.log("Stored original cube geometry");
      }
      if (sourceSphereRef.current && !originalSourceSphereGeometry.current) {
        originalSourceSphereGeometry.current =
          sourceSphereRef.current.geometry.clone();
        console.log("Stored original sphere geometry");
      }
    }, []);

    // Update wireframe
    useEffect(() => {
      const updateMeshWireframe = (mesh: THREE.Mesh | null) => {
        if (mesh && mesh.material) {
          (mesh.material as THREE.MeshStandardMaterial).wireframe =
            showWireframe;
        }
      };

      updateMeshWireframe(sourceCubeRef.current);
      updateMeshWireframe(sourceSphereRef.current);
      updateMeshWireframe(targetCubeRef.current);
      updateMeshWireframe(targetSphereRef.current);
    }, [showWireframe]);

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
            userData={{
              originalGeometry: originalSourceCubeGeometry,
              isSource: true,
            }}
          >
            <boxGeometry args={[2.5, 2.5, 2.5, 10, 10, 10]} />
            <meshStandardMaterial color="#4472C4" transparent opacity={0.8} />
          </mesh>

          {/* Target Sphere (smaller, inside the cube) */}
          <mesh ref={targetSphereRef} userData={{ isTarget: true }}>
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
            userData={{
              originalGeometry: originalSourceSphereGeometry,
              isSource: true,
            }}
          >
            <sphereGeometry args={[1.8, 32, 32]} />
            <meshStandardMaterial color="#A5A5A5" transparent opacity={0.8} />
          </mesh>

          {/* Target Cube (smaller, inside the sphere) */}
          <mesh ref={targetCubeRef} userData={{ isTarget: true }}>
            <boxGeometry args={[1.5, 1.5, 1.5]} />
            <meshStandardMaterial color="#ED7D31" transparent opacity={0.6} />
          </mesh>
        </group>
      </>
    );
  },
);

BasicDemo.displayName = "BasicDemo";
