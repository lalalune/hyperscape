import { MutableRefObject } from "react";
import * as THREE from "three";

import { MeshFittingService } from "../../../../services/fitting/MeshFittingService";
import { ExtendedMesh } from "../../../../types";
import { notify } from "../../../../utils/notify";
import {
  storeWorldTransform,
  applyWorldTransform,
  applyExtremeScaleMaterialFixes,
  findHeadBone as _findHeadBone,
  getSkeletonFromMesh,
  getBoneWorldPosition as _getBoneWorldPosition,
  disposeMesh as _disposeMesh,
} from "../utils";

interface HelmetFittingProps {
  sceneRef: MutableRefObject<THREE.Scene | null>;
  avatarMeshRef: MutableRefObject<THREE.SkinnedMesh | null>;
  helmetMeshRef: MutableRefObject<ExtendedMesh | null>;
  originalHelmetTransformRef: MutableRefObject<{
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
  } | null>;
  fittingService: MutableRefObject<MeshFittingService>;

  setIsProcessing: (value: boolean) => void;
  setIsHelmetFitted: (value: boolean) => void;
  setIsHelmetAttached: (value: boolean) => void;

  isProcessing: boolean;
  helmetFittingMethod: string;
  helmetSizeMultiplier: number;
  helmetFitTightness: number;
  helmetVerticalOffset: number;
  helmetForwardOffset: number;
  helmetRotation: { x: number; y: number; z: number };
}

export function useHelmetFitting({
  sceneRef,
  avatarMeshRef,
  helmetMeshRef,
  originalHelmetTransformRef: _originalHelmetTransformRef,
  fittingService,
  setIsProcessing,
  setIsHelmetFitted,
  setIsHelmetAttached,
  isProcessing: _isProcessing,
  helmetFittingMethod,
  helmetSizeMultiplier,
  helmetFitTightness,
  helmetVerticalOffset,
  helmetForwardOffset,
  helmetRotation,
}: HelmetFittingProps) {
  const performHelmetFitting = async () => {
    console.log("performHelmetFitting called");
    console.log("avatarMeshRef.current:", avatarMeshRef.current);
    console.log("helmetMeshRef.current:", helmetMeshRef.current);

    if (!avatarMeshRef.current || !helmetMeshRef.current) {
      console.error("Avatar or helmet mesh not loaded");
      return;
    }

    console.log("=== STARTING HELMET FITTING ===");
    logBoneHierarchy(avatarMeshRef.current);

    setIsProcessing(true);

    try {
      const result = await fittingService.current.fitHelmetToHead(
        helmetMeshRef.current,
        avatarMeshRef.current,
        {
          method: helmetFittingMethod as "auto" | "manual",
          sizeMultiplier: helmetSizeMultiplier,
          fitTightness: helmetFitTightness,
          verticalOffset: helmetVerticalOffset,
          forwardOffset: helmetForwardOffset,
          rotation: new THREE.Euler(
            (helmetRotation.x * Math.PI) / 180,
            (helmetRotation.y * Math.PI) / 180,
            (helmetRotation.z * Math.PI) / 180,
          ),
          attachToHead: false,
          showHeadBounds: false,
          showCollisionDebug: false,
        },
      );

      console.log("Helmet fitting complete:", result);

      // Mark helmet as fitted
      if (helmetMeshRef.current) {
        helmetMeshRef.current.userData.hasBeenFitted = true;
        setIsHelmetFitted(true);
      }
    } catch (error) {
      console.error("Helmet fitting failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const attachHelmetToHead = () => {
    if (!avatarMeshRef.current || !helmetMeshRef.current) {
      console.error("Avatar or helmet mesh not loaded");
      notify.error("Please load both avatar and helmet first");
      return;
    }

    const scene = sceneRef.current;
    if (!scene) return;

    // Find head bone
    const headInfo = fittingService.current.detectHeadRegion(
      avatarMeshRef.current,
    );

    if (!headInfo.headBone) {
      console.error("No head bone found - attaching to avatar root instead");

      const message =
        `No head bone found in the model. The system looked for common head bone names but couldn't find any.\n\n` +
        `You can either:\n` +
        `1. Attach the helmet to the avatar root (it won't follow head animations)\n` +
        `2. Cancel and manually parent the helmet in your 3D software\n\n` +
        `Would you like to attach to the avatar root?`;

      if (confirm(message)) {
        const avatarRoot =
          avatarMeshRef.current.parent || avatarMeshRef.current;
        avatarRoot.attach(helmetMeshRef.current);
        setIsHelmetAttached(true);
        console.log("Helmet attached to avatar root");
        notify.info(
          "Helmet attached to avatar root. Note: It will follow body movement but not specific head animations.",
        );
      }
      return;
    }

    // Debug: Log transforms before attachment
    console.log("=== BEFORE ATTACHMENT ===");
    const originalTransform = storeWorldTransform(helmetMeshRef.current);
    console.log("Helmet world position:", originalTransform.position);
    console.log("Helmet world scale:", originalTransform.scale);
    console.log(
      "Head bone world scale:",
      headInfo.headBone.getWorldScale(new THREE.Vector3()),
    );

    // Check bone scale
    const boneScale = headInfo.headBone.getWorldScale(new THREE.Vector3());

    if (boneScale.x < 0.1) {
      console.log("Bone has extreme scale - applying visibility workaround");

      // Attach with workarounds
      headInfo.headBone.attach(helmetMeshRef.current);

      // Ensure world transform is preserved
      const newTransform = storeWorldTransform(helmetMeshRef.current);
      if (
        newTransform.position.distanceTo(originalTransform.position) > 0.001
      ) {
        console.log("Correcting transform drift for extreme scale case...");
        applyWorldTransform(
          helmetMeshRef.current,
          originalTransform,
          headInfo.headBone,
        );
      }

      // Apply material fixes for extreme scales
      applyExtremeScaleMaterialFixes(helmetMeshRef.current);

      // Force matrix updates
      helmetMeshRef.current.updateMatrix();
      helmetMeshRef.current.updateMatrixWorld(true);

      console.log("Applied extreme scale workarounds");
    } else {
      // Normal attachment process
      console.log("Attaching helmet to head bone...");
      headInfo.headBone.attach(helmetMeshRef.current);
      console.log("Helmet attached to head bone");
    }

    // Debug: Log transforms after attachment
    console.log("=== AFTER ATTACHMENT ===");
    console.log(
      "Helmet world position:",
      helmetMeshRef.current.getWorldPosition(new THREE.Vector3()),
    );
    console.log(
      "Helmet world scale:",
      helmetMeshRef.current.getWorldScale(new THREE.Vector3()),
    );
    console.log("Helmet parent:", helmetMeshRef.current.parent?.name || "none");

    // Update flags
    setIsHelmetAttached(true);
    helmetMeshRef.current.userData.isAttached = true;

    console.log(
      "✅ Helmet successfully attached to head bone:",
      headInfo.headBone.name,
    );
  };

  const detachHelmetFromHead = () => {
    if (!helmetMeshRef.current) {
      console.error("No helmet to detach");
      return;
    }

    const scene = sceneRef.current;
    if (!scene) return;

    // Clean up render helper if it exists
    cleanupRenderHelper(helmetMeshRef.current);

    // Make original helmet visible again
    helmetMeshRef.current.visible = true;
    helmetMeshRef.current.traverse((child: THREE.Object3D) => {
      child.visible = true;
    });

    // Remove from parent and add back to scene
    if (helmetMeshRef.current.parent) {
      // Use attach() which preserves world transform
      scene.attach(helmetMeshRef.current);

      setIsHelmetAttached(false);
      helmetMeshRef.current.userData.isAttached = false;
      console.log("Helmet detached from head");
    }
  };

  return {
    performHelmetFitting,
    attachHelmetToHead,
    detachHelmetFromHead,
  };
}

// Helper functions specific to helmet fitting

function logBoneHierarchy(avatarMesh: THREE.SkinnedMesh) {
  const bones: Array<{ name: string; depth: number; path: string }> = [];

  const getBonePath = (bone: THREE.Object3D): string => {
    const path: string[] = [];
    let current: THREE.Object3D | null = bone;
    while (current) {
      path.unshift(current.name || "unnamed");
      current = current.parent;
    }
    return path.join(" > ");
  };

  const collectBones = (obj: THREE.Object3D, depth: number = 0) => {
    if (obj instanceof THREE.Bone) {
      bones.push({
        name: obj.name,
        depth,
        path: getBonePath(obj),
      });
    }
    obj.children.forEach((child) => collectBones(child, depth + 1));
  };

  // Check skeleton
  const skeleton = getSkeletonFromMesh(avatarMesh);
  if (skeleton) {
    console.log(
      "Found SkinnedMesh with skeleton containing",
      skeleton.bones.length,
      "bones",
    );
    skeleton.bones.forEach((bone, index) => {
      bones.push({
        name: bone.name || `bone_${index}`,
        depth: 0,
        path: `skeleton.bones[${index}]`,
      });
    });
  } else {
    // Fallback to traversal
    collectBones(avatarMesh);
  }

  console.log(`\n=== BONE HIERARCHY (${bones.length} bones) ===`);
  if (bones.length === 0) {
    console.log("No bones found! Checking avatar structure...");
    console.log("Avatar type:", avatarMesh.type);
  } else {
    bones.forEach(({ name, depth, path }) => {
      const indent = "  ".repeat(depth);
      console.log(`${indent}${name || "unnamed"} (path: ${path})`);
    });
  }
  console.log("================================\n");
}

function cleanupRenderHelper(helmetMesh: ExtendedMesh) {
  const renderHelper = helmetMesh.renderHelper;
  if (renderHelper && renderHelper.parent) {
    // Remove helper from scene
    renderHelper.parent.remove(renderHelper);
    if ("geometry" in renderHelper && renderHelper.geometry) {
      (renderHelper.geometry as THREE.BufferGeometry).dispose();
    }
    if ("material" in renderHelper && renderHelper.material) {
      const materials = Array.isArray(renderHelper.material)
        ? (renderHelper.material as THREE.Material[])
        : [renderHelper.material as THREE.Material];
      materials.forEach((mat) => mat.dispose());
    }

    // Clean up references
    delete helmetMesh.renderHelper;
    delete helmetMesh.updateHelper;
  }
}
