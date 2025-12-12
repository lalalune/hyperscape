import { MutableRefObject } from "react";
import * as THREE from "three";

import { MeshFittingService } from "../../../../services/fitting/MeshFittingService";
import { ExtendedMesh } from "../../../../types";
import {
  disposeMesh,
  findMeshesByUserData,
  removeObjectsFromScene,
  containsRefs,
  resetMaterialToDefaults,
  updateSceneMatrices,
} from "../utils";

interface ResetHandlersProps {
  sceneRef: MutableRefObject<THREE.Scene | null>;
  avatarMeshRef: MutableRefObject<THREE.SkinnedMesh | null>;
  armorMeshRef: MutableRefObject<ExtendedMesh | null>;
  helmetMeshRef: MutableRefObject<ExtendedMesh | null>;
  originalArmorGeometryRef: MutableRefObject<THREE.BufferGeometry | null>;
  originalHelmetTransformRef: MutableRefObject<{
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
  } | null>;
  debugArrowGroupRef: MutableRefObject<THREE.Group | null>;
  hullMeshRef: MutableRefObject<THREE.Mesh | null>;
  fittingService: MutableRefObject<MeshFittingService>;

  setIsArmorFitted: (value: boolean) => void;
  setIsArmorBound: (value: boolean) => void;
  setIsHelmetFitted: (value: boolean) => void;
  setIsHelmetAttached: (value: boolean) => void;
  setBoundArmorMesh: (mesh: THREE.SkinnedMesh | null) => void;
  setSkinnedArmorMesh: (mesh: THREE.SkinnedMesh | null) => void;
  setError: (value: string) => void;
  resetProcessingStates: () => void;
  detachHelmetFromHead: () => void;

  viewMode?: "sphereCube" | "avatarArmor" | "helmetFitting";
}

export function useResetHandlers({
  sceneRef,
  avatarMeshRef,
  armorMeshRef,
  helmetMeshRef,
  originalArmorGeometryRef,
  originalHelmetTransformRef,
  debugArrowGroupRef,
  hullMeshRef,
  fittingService,
  setIsArmorFitted,
  setIsArmorBound,
  setIsHelmetFitted,
  setIsHelmetAttached,
  setBoundArmorMesh,
  setSkinnedArmorMesh,
  setError,
  resetProcessingStates,
  detachHelmetFromHead,
  viewMode = "avatarArmor",
}: ResetHandlersProps) {
  const resetMeshes = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    console.log("=== RESETTING MESH FITTING STATE ===");
    console.log("Reset logic version: MODULAR_RESET_COMPREHENSIVE");
    console.log("View mode:", viewMode);

    // Reset all fitting states
    resetProcessingStates();
    setError("");

    // Clear debug arrows first
    fittingService.current.clearDebugArrows();

    // Handle Basic Demo reset
    if (viewMode === "sphereCube") {
      resetBasicDemo(scene);
      return;
    }

    // Clean up scene objects based on view mode
    const refsToPreserve =
      viewMode === "helmetFitting"
        ? [helmetMeshRef.current, avatarMeshRef.current]
        : viewMode === "avatarArmor"
          ? [armorMeshRef.current, avatarMeshRef.current]
          : []; // sphereCube mode doesn't use these refs

    cleanupSceneObjects(scene, refsToPreserve);

    // Clear debug groups
    clearDebugGroups(scene, debugArrowGroupRef);

    // Create new fitting service instance
    fittingService.current = new MeshFittingService();
    if (debugArrowGroupRef.current) {
      fittingService.current.setDebugArrowGroup(debugArrowGroupRef.current);
    }

    // Remove debug objects by name
    removeDebugObjectsByName(scene);

    // Explicitly remove armor meshes if in helmet fitting mode
    if (viewMode === "helmetFitting") {
      const armorMeshes = findMeshesByUserData(
        scene,
        (userData) => userData?.isArmor === true,
      );
      removeObjectsFromScene(scene, armorMeshes);
    }

    // Explicitly remove helmet meshes if in armor fitting mode
    if (viewMode === "avatarArmor") {
      const helmetMeshes = findMeshesByUserData(
        scene,
        (userData) => userData?.isHelmet === true,
      );
      removeObjectsFromScene(scene, helmetMeshes);
    }

    // Reset armor mesh only if in avatar/armor mode
    if (viewMode === "avatarArmor" && armorMeshRef.current) {
      resetArmorMesh(
        armorMeshRef.current,
        scene,
        originalArmorGeometryRef,
        setIsArmorFitted,
        setIsArmorBound,
      );
    }

    // Reset helmet mesh only if in helmet fitting mode
    if (
      viewMode === "helmetFitting" &&
      helmetMeshRef.current &&
      originalHelmetTransformRef.current
    ) {
      resetHelmetMesh(
        helmetMeshRef.current,
        scene,
        originalHelmetTransformRef.current,
        detachHelmetFromHead,
        setIsHelmetAttached,
        setIsHelmetFitted,
      );
    }

    // Reset avatar materials
    if (avatarMeshRef.current) {
      resetAvatarMaterials(avatarMeshRef.current);
    }

    // Clear hull mesh
    if (hullMeshRef.current) {
      clearHullMesh(hullMeshRef);
    }

    // Clear bound armor references
    setBoundArmorMesh(null);
    setSkinnedArmorMesh(null);

    // Remove any bound/skinned armor meshes
    removeBoundArmorMeshes(scene);

    // Force scene update
    updateSceneMatrices(scene);

    console.log("=== RESET COMPLETE ===");
    logRemainingObjects(scene);
  };

  return {
    resetMeshes,
  };
}

// Helper functions for reset operations

function resetBasicDemo(scene: THREE.Scene) {
  console.log("Resetting Basic Demo geometries");

  // Reset all source meshes (spheres/cubes)
  scene.traverse((obj) => {
    if (
      obj instanceof THREE.Mesh &&
      obj.userData.isSource &&
      !obj.userData.isArmor
    ) {
      const originalGeoRef = obj.userData.originalGeometry;

      if (originalGeoRef?.current) {
        console.log("Resetting geometry for source mesh");
        obj.geometry.dispose();
        obj.geometry = originalGeoRef.current.clone();
        obj.geometry.computeVertexNormals();
        obj.geometry.computeBoundingBox();
        obj.geometry.computeBoundingSphere();
      } else if (originalGeoRef instanceof THREE.BufferGeometry) {
        console.log("Resetting geometry using direct reference");
        obj.geometry.dispose();
        obj.geometry = originalGeoRef.clone();
        obj.geometry.computeVertexNormals();
        obj.geometry.computeBoundingBox();
        obj.geometry.computeBoundingSphere();
      } else {
        console.warn("Source mesh missing proper originalGeometry:", obj);
      }
    }
  });

  console.log("=== BASIC DEMO RESET COMPLETE ===");
}

function cleanupSceneObjects(
  scene: THREE.Scene,
  currentRefs: (THREE.Object3D | null)[],
) {
  const objectsToRemove: THREE.Object3D[] = [];

  scene.traverse((child) => {
    // Skip current refs
    if (currentRefs.includes(child)) return;

    // Skip if contains current refs
    if (containsRefs(child, currentRefs)) return;

    // Remove debug objects
    if (child.userData?.isDebug || child.name === "debugArrows") {
      objectsToRemove.push(child);
      return;
    }

    // Remove fitted objects
    if (child.userData?.hasBeenFitted) {
      objectsToRemove.push(child);
      return;
    }

    // Remove stale helmet/armor objects
    if (
      (child.userData?.isHelmet || child.userData?.isArmor) &&
      !currentRefs.includes(child)
    ) {
      objectsToRemove.push(child);
    }
  });

  removeObjectsFromScene(scene, objectsToRemove);
}

function clearDebugGroups(
  scene: THREE.Scene,
  debugArrowGroupRef: MutableRefObject<THREE.Group | null>,
) {
  const debugGroups = scene.children.filter(
    (child) =>
      child.name === "debugArrows" ||
      child.userData.isDebug ||
      child === debugArrowGroupRef.current,
  );

  debugGroups.forEach((group) => {
    scene.remove(group);
    disposeMesh(group);
  });

  // Clear debug arrow group children
  if (debugArrowGroupRef.current) {
    while (debugArrowGroupRef.current.children.length > 0) {
      const child = debugArrowGroupRef.current.children[0];
      debugArrowGroupRef.current.remove(child);
      disposeMesh(child);
    }
  }
}

function removeDebugObjectsByName(scene: THREE.Scene) {
  const debugObjectNames = [
    "TorsoDebugBox",
    "TorsoCenterSphere",
    "TorsoCenterPlane",
    "BodyHullMesh",
    "BoneMarkers",
    "TorsoTopPlane",
  ];

  debugObjectNames.forEach((name) => {
    const obj = scene.getObjectByName(name);
    if (obj) {
      if (obj.parent) obj.parent.remove(obj);
      scene.remove(obj);
      disposeMesh(obj);
    }
  });
}

function resetArmorMesh(
  armorMesh: THREE.Mesh,
  scene: THREE.Scene,
  originalArmorGeometryRef: MutableRefObject<THREE.BufferGeometry | null>,
  setIsArmorFitted: (value: boolean) => void,
  setIsArmorBound: (value: boolean) => void,
) {
  console.log("Resetting armor mesh");

  // Reset geometry if we have the original
  if (originalArmorGeometryRef.current && armorMesh.userData.hasBeenFitted) {
    console.log("Restoring original armor geometry");
    armorMesh.geometry.dispose();
    armorMesh.geometry = originalArmorGeometryRef.current.clone();
    armorMesh.geometry.computeVertexNormals();
    armorMesh.userData.hasBeenFitted = false;
  }

  // If armor was bound to skeleton, detach it
  if (armorMesh.parent && armorMesh.parent !== scene) {
    console.log("Detaching armor from parent:", armorMesh.parent.name);

    const worldTransform = {
      position: armorMesh.getWorldPosition(new THREE.Vector3()),
      quaternion: armorMesh.getWorldQuaternion(new THREE.Quaternion()),
      scale: armorMesh.getWorldScale(new THREE.Vector3()),
    };

    armorMesh.removeFromParent();
    scene.add(armorMesh);

    // Apply world transform temporarily
    armorMesh.position.copy(worldTransform.position);
    armorMesh.quaternion.copy(worldTransform.quaternion);
    armorMesh.scale.copy(worldTransform.scale);
  }

  // Reset transforms
  armorMesh.position.set(0, 0, 0);
  armorMesh.scale.set(1, 1, 1);
  armorMesh.rotation.set(0, 0, 0);

  // Reset material properties
  armorMesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      resetMaterialToDefaults(child);
    }
  });

  // Ensure armor is visible
  armorMesh.visible = true;
  armorMesh.updateMatrix();
  armorMesh.updateMatrixWorld(true);

  // Update states
  setIsArmorFitted(false);
  setIsArmorBound(false);
}

function resetHelmetMesh(
  helmetMesh: ExtendedMesh,
  scene: THREE.Scene,
  originalHelmetTransform: {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
  },
  detachHelmetFromHead: () => void,
  setIsHelmetAttached: (value: boolean) => void,
  setIsHelmetFitted: (value: boolean) => void,
) {
  console.log("=== RESETTING HELMET ===");

  const isAttachedToBone =
    helmetMesh.parent && helmetMesh.parent instanceof THREE.Bone;
  const isAttachedSomewhere = helmetMesh.parent && helmetMesh.parent !== scene;

  if (isAttachedToBone || isAttachedSomewhere) {
    console.log("Helmet needs detachment!");

    if (isAttachedToBone) {
      console.log("Using detachHelmetFromHead to detach from bone...");
      detachHelmetFromHead();
    } else {
      console.log("Removing helmet from parent:", helmetMesh.parent?.name);
      helmetMesh.removeFromParent();
    }
  }

  // Place helmet back in original parent or scene
  const originalParent = helmetMesh.userData.originalParent;
  if (originalParent && originalParent.parent) {
    if (helmetMesh.parent !== originalParent) {
      console.log(
        "Adding helmet back to original parent:",
        originalParent.name,
      );
      originalParent.add(helmetMesh);
    }
  } else if (!helmetMesh.parent) {
    console.log("Adding helmet to scene (no original parent)");
    scene.add(helmetMesh);
  }

  // Reset to original transform
  console.log("Resetting helmet transform to:", originalHelmetTransform);
  helmetMesh.position.set(
    originalHelmetTransform.position.x,
    originalHelmetTransform.position.y,
    originalHelmetTransform.position.z,
  );
  helmetMesh.rotation.set(
    originalHelmetTransform.rotation.x,
    originalHelmetTransform.rotation.y,
    originalHelmetTransform.rotation.z,
  );
  helmetMesh.scale.set(
    originalHelmetTransform.scale.x,
    originalHelmetTransform.scale.y,
    originalHelmetTransform.scale.z,
  );

  // Clear quaternion and update matrices
  helmetMesh.quaternion.setFromEuler(helmetMesh.rotation);
  helmetMesh.updateMatrix();
  helmetMesh.matrixAutoUpdate = true;

  // Make visible and reset materials
  helmetMesh.visible = true;
  helmetMesh.traverse((child) => {
    child.visible = true;
    if (child instanceof THREE.Mesh) {
      resetMaterialToDefaults(child);
    }
  });

  // Clear fitted flags
  helmetMesh.userData.hasBeenFitted = false;
  helmetMesh.userData.isAttached = false;

  // Update states
  setIsHelmetAttached(false);
  setIsHelmetFitted(false);

  // Force updates
  helmetMesh.updateMatrixWorld(true);
  if (helmetMesh.parent) {
    helmetMesh.parent.updateMatrixWorld(true);
  }
  scene.updateMatrixWorld(true);

  // Verify position was reset
  const currentPos = helmetMesh.position.clone();
  const expectedPos = originalHelmetTransform.position;
  const positionDiff = currentPos.distanceTo(expectedPos);

  if (positionDiff > 0.001) {
    console.warn(
      "WARNING: Helmet position not properly reset! Difference:",
      positionDiff,
    );
    // Try direct assignment
    helmetMesh.position.x = originalHelmetTransform.position.x;
    helmetMesh.position.y = originalHelmetTransform.position.y;
    helmetMesh.position.z = originalHelmetTransform.position.z;
    helmetMesh.updateMatrix();
    helmetMesh.updateMatrixWorld(true);
  }

  console.log("=== HELMET RESET FINISHED ===");
}

function resetAvatarMaterials(avatarMesh: THREE.SkinnedMesh) {
  console.log("Resetting avatar mesh materials");
  avatarMesh.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
      resetMaterialToDefaults(child);
    }
  });
  avatarMesh.updateMatrixWorld(true);
}

function clearHullMesh(hullMeshRef: MutableRefObject<THREE.Mesh | null>) {
  if (hullMeshRef.current) {
    if (hullMeshRef.current.parent) {
      hullMeshRef.current.parent.remove(hullMeshRef.current);
    }
    disposeMesh(hullMeshRef.current);
    hullMeshRef.current = null;
  }
}

function removeBoundArmorMeshes(scene: THREE.Scene) {
  const boundArmorMeshes = findMeshesByUserData(
    scene,
    (userData) => userData?.isBoundArmor || userData?.isSkinnedArmor,
  );

  boundArmorMeshes.forEach((mesh) => {
    console.log("Removing bound/skinned armor mesh:", mesh.name || "unnamed");
    scene.remove(mesh);
    disposeMesh(mesh);
  });
}

function logRemainingObjects(scene: THREE.Scene) {
  console.log("Scene fully updated after reset");
  console.log("Remaining scene children:", scene.children.length);

  scene.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
      console.log("Remaining mesh:", child.name || "unnamed", child.type);
    }
  });
}
