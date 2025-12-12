import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useRef, useEffect } from "react";
import * as THREE from "three";

import { ExtendedMesh } from "../../../../types";
import { SceneProps } from "../types";

import { AvatarArmorDemo } from "./AvatarArmorDemo";
import { BasicDemo } from "./BasicDemo";
import { HelmetDemo } from "./HelmetDemo";

export function Scene({
  fittingService,
  showWireframe,
  viewMode,
  selectedAvatarPath,
  selectedArmorPath,
  selectedHelmetPath,
  avatarMeshRef,
  armorMeshRef,
  helmetMeshRef,
  originalArmorGeometryRef,
  originalHelmetTransformRef,
  debugArrowGroupRef,
  headBoundsHelperRef,
  currentAnimation,
  isAnimationPlaying,
  showHeadBounds,
  boundArmorMesh: _boundArmorMesh,
}: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Callback for when real models are loaded
  const handleModelsLoaded = (
    avatarMesh: THREE.SkinnedMesh,
    armorMesh: THREE.Mesh,
  ) => {
    console.log("=== MODELS LOADED CALLBACK ===");
    console.log("Avatar:", avatarMesh.name);
    console.log("Armor:", armorMesh.name);
    console.log(
      "Armor current geometry vertices:",
      armorMesh.geometry.attributes.position.count,
    );
    console.log("Armor userData before:", Object.keys(armorMesh.userData));

    avatarMeshRef.current = avatarMesh;
    armorMeshRef.current = armorMesh;

    // Store original armor geometry - make sure we're starting fresh
    if (armorMesh.geometry) {
      originalArmorGeometryRef.current = armorMesh.geometry.clone();
      // Don't set userData.originalGeometry here - it was already cleared
      console.log(
        "Stored original geometry with",
        originalArmorGeometryRef.current.attributes.position.count,
        "vertices",
      );
    }

    console.log("Armor userData after:", Object.keys(armorMesh.userData));
    console.log("========================");
  };

  // Callback for when helmet models are loaded
  const handleHelmetModelsLoaded = (
    avatarMesh: THREE.SkinnedMesh,
    helmetMesh: THREE.Mesh,
  ) => {
    console.log("=== HELMET MODELS LOADED ===");
    console.log("Avatar:", avatarMesh.name);
    console.log("Helmet:", helmetMesh.name);

    avatarMeshRef.current = avatarMesh;
    helmetMeshRef.current = helmetMesh;

    // Store original helmet transform
    if (helmetMesh) {
      // Store the very first transform we see (when helmet is fresh)
      if (
        !originalHelmetTransformRef.current ||
        !helmetMesh.userData.transformCaptured
      ) {
        originalHelmetTransformRef.current = {
          position: helmetMesh.position.clone(),
          rotation: helmetMesh.rotation.clone(),
          scale: helmetMesh.scale.clone(),
        };
        // Store the original parent for proper reset
        helmetMesh.userData.originalParent = helmetMesh.parent;
        helmetMesh.userData.transformCaptured = true;
        console.log(
          "Captured original helmet transform:",
          originalHelmetTransformRef.current,
        );
        console.log(
          "Original helmet parent:",
          helmetMesh.parent?.name || "scene",
        );
      }
    }

    // Create or update head bounds helper
    if (showHeadBounds && avatarMesh) {
      const headInfo = fittingService.current.detectHeadRegion(avatarMesh);
      // Remove old helper if it exists
      if (headBoundsHelperRef.current) {
        headBoundsHelperRef.current.parent?.remove(headBoundsHelperRef.current);
      }
      // Create new helper
      headBoundsHelperRef.current = new THREE.Box3Helper(
        headInfo.headBounds,
        0x00ff00,
      );
      groupRef.current?.add(headBoundsHelperRef.current);
      console.log("Created head bounds helper");
    } else if (!showHeadBounds && headBoundsHelperRef.current) {
      // Remove helper if showHeadBounds is false
      if (headBoundsHelperRef.current.parent) {
        headBoundsHelperRef.current.parent.remove(headBoundsHelperRef.current);
      }
      headBoundsHelperRef.current = null;
      console.log("Removed head bounds helper");
    }
  };

  // Handle showHeadBounds changes for helmet demo
  useEffect(() => {
    if (
      viewMode === "helmetFitting" &&
      helmetMeshRef.current &&
      avatarMeshRef.current
    ) {
      if (showHeadBounds) {
        const headInfo = fittingService.current.detectHeadRegion(
          avatarMeshRef.current,
        );
        // Remove old helper if it exists
        if (headBoundsHelperRef.current) {
          headBoundsHelperRef.current.parent?.remove(
            headBoundsHelperRef.current,
          );
        }
        // Create new helper
        headBoundsHelperRef.current = new THREE.Box3Helper(
          headInfo.headBounds,
          0x00ff00,
        );
        groupRef.current?.add(headBoundsHelperRef.current);
        console.log("Created head bounds helper from showHeadBounds effect");
      } else if (headBoundsHelperRef.current) {
        // Remove helper if showHeadBounds is false
        if (headBoundsHelperRef.current.parent) {
          headBoundsHelperRef.current.parent.remove(
            headBoundsHelperRef.current,
          );
        }
        headBoundsHelperRef.current = null;
        console.log("Removed head bounds helper from showHeadBounds effect");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHeadBounds, viewMode, fittingService]);

  // Set up debug arrow group
  useEffect(() => {
    if (debugArrowGroupRef.current) {
      fittingService.current.setDebugArrowGroup(debugArrowGroupRef.current);
    }
    const service = fittingService.current;
    return () => {
      service.clearDebugArrows();
    };
  }, [fittingService, debugArrowGroupRef]);

  // Update render helper if it exists
  useFrame(() => {
    // Update helmet render helper position if it exists
    const helmet = helmetMeshRef.current as ExtendedMesh | null;
    if (helmet?.updateHelper && helmet?.renderHelper) {
      helmet.updateHelper();
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <OrbitControls />

      <group ref={groupRef}>
        {viewMode === "sphereCube" ? (
          <BasicDemo showWireframe={showWireframe} />
        ) : viewMode === "avatarArmor" ? (
          /* Real Avatar Armor Demo */
          <AvatarArmorDemo
            key={`avatarArmor-${selectedAvatarPath}-${selectedArmorPath}`}
            onReady={handleModelsLoaded}
            showWireframe={showWireframe}
            avatarPath={selectedAvatarPath}
            armorPath={selectedArmorPath}
            currentAnimation={currentAnimation}
            isAnimationPlaying={isAnimationPlaying}
          />
        ) : (
          /* Helmet Fitting Demo */
          <HelmetDemo
            key={`helmetFitting-${selectedAvatarPath}-${selectedHelmetPath}`}
            onReady={handleHelmetModelsLoaded}
            showWireframe={showWireframe}
            avatarPath={selectedAvatarPath}
            helmetPath={selectedHelmetPath}
            currentAnimation={currentAnimation}
            isAnimationPlaying={isAnimationPlaying}
            showHeadBounds={showHeadBounds}
            headBoundsHelperRef={headBoundsHelperRef}
          />
        )}
      </group>

      {/* Debug Arrow Group */}
      <group ref={debugArrowGroupRef} />

      <gridHelper args={[10, 10]} />
    </>
  );
}
