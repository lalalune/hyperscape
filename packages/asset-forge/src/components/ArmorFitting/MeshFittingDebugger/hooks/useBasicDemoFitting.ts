import { MutableRefObject } from "react";
import * as THREE from "three";

import {
  MeshFittingService,
  MeshFittingParameters,
} from "../../../../services/fitting/MeshFittingService";

interface BasicDemoFittingProps {
  sceneRef: MutableRefObject<THREE.Scene | null>;
  fittingService: MutableRefObject<MeshFittingService>;

  setIsProcessing: (value: boolean) => void;

  isProcessing: boolean;
  fittingParameters: MeshFittingParameters;
}

export function useBasicDemoFitting({
  sceneRef,
  fittingService,
  setIsProcessing,
  isProcessing,
  fittingParameters,
}: BasicDemoFittingProps) {
  const performBasicDemoFitting = (
    direction: "cubeToSphere" | "sphereToCube",
  ) => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    scene.updateMatrixWorld(true);
    console.log("Updated scene matrix world before fitting");

    if (isProcessing) {
      console.warn("Already processing a fitting operation");
      return;
    }

    setIsProcessing(true);

    // Find source and target meshes based on direction
    let sourceMesh: THREE.Mesh | undefined;
    let targetMesh: THREE.Mesh | undefined;

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        if (direction === "cubeToSphere") {
          // For cube to sphere: source is cube, target is sphere
          if (
            obj.userData.isSource &&
            obj.geometry instanceof THREE.BoxGeometry
          ) {
            sourceMesh = obj;
          } else if (
            obj.userData.isTarget &&
            obj.geometry instanceof THREE.SphereGeometry
          ) {
            targetMesh = obj;
          }
        } else {
          // For sphere to cube: source is sphere, target is cube
          if (
            obj.userData.isSource &&
            obj.geometry instanceof THREE.SphereGeometry
          ) {
            sourceMesh = obj;
          } else if (
            obj.userData.isTarget &&
            obj.geometry instanceof THREE.BoxGeometry
          ) {
            targetMesh = obj;
          }
        }
      }
    });

    if (sourceMesh && targetMesh) {
      // Store parent to restore later
      const sourceParent = sourceMesh.parent;
      const targetParent = targetMesh.parent;

      // Get world positions before detaching
      const sourceWorldPos = new THREE.Vector3();
      const targetWorldPos = new THREE.Vector3();
      sourceMesh.getWorldPosition(sourceWorldPos);
      targetMesh.getWorldPosition(targetWorldPos);

      // Temporarily add meshes directly to scene for proper world transforms
      scene.add(sourceMesh);
      scene.add(targetMesh);

      // Apply world positions
      sourceMesh.position.copy(sourceWorldPos);
      targetMesh.position.copy(targetWorldPos);

      // Update matrices
      sourceMesh.updateMatrixWorld(true);
      targetMesh.updateMatrixWorld(true);

      console.log("Starting fitting:", direction);
      console.log("Source mesh position:", sourceMesh.position);
      console.log("Target mesh position:", targetMesh.position);

      // Log initial bounds
      const sourceBounds = new THREE.Box3().setFromObject(sourceMesh);
      const targetBounds = new THREE.Box3().setFromObject(targetMesh);
      console.log("Source bounds:", sourceBounds.min, sourceBounds.max);
      console.log("Target bounds:", targetBounds.min, targetBounds.max);

      // Automatically enable feature preservation for sphere-to-cube
      const fittingParams = { ...fittingParameters };
      if (direction === "sphereToCube") {
        fittingParams.preserveFeatures = true;
        fittingParams.useImprovedShrinkwrap = true;
        console.log(
          "Automatically enabling feature preservation and improved shrinkwrap for sphere-to-cube fitting",
        );
      }

      // Perform the fitting
      fittingService.current.fitMeshToTarget(
        sourceMesh,
        targetMesh,
        fittingParams,
      );

      // Restore original parents and local positions
      if (sourceParent && targetParent) {
        // Calculate local positions
        const sourceLocalPos = sourceParent.worldToLocal(
          sourceMesh.position.clone(),
        );
        const targetLocalPos = targetParent.worldToLocal(
          targetMesh.position.clone(),
        );

        sourceParent.add(sourceMesh);
        targetParent.add(targetMesh);

        sourceMesh.position.copy(sourceLocalPos);
        targetMesh.position.copy(targetLocalPos);
      }
    } else {
      console.error(
        "Could not find source or target mesh for direction:",
        direction,
      );
    }

    setTimeout(() => setIsProcessing(false), 100);
  };

  return {
    performBasicDemoFitting,
  };
}
