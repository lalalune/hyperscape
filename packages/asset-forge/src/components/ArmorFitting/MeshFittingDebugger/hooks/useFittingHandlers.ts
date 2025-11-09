import { MutableRefObject } from "react";
import * as THREE from "three";

import { ArmorFittingService } from "../../../../services/fitting/ArmorFittingService";
import {
  MeshFittingService,
  MeshFittingParameters,
} from "../../../../services/fitting/MeshFittingService";
import { ExtendedMesh } from "../../../../types";

// Import modular hooks
import { useArmorFitting } from "./useArmorFitting";
import { useBasicDemoFitting } from "./useBasicDemoFitting";
import { useHelmetFitting } from "./useHelmetFitting";
import { useResetHandlers } from "./useResetHandlers";

interface FittingHandlersProps {
  // Refs
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
  headBoundsHelperRef: MutableRefObject<THREE.Box3Helper | null>;
  hullMeshRef: MutableRefObject<THREE.Mesh | null>;
  fittingService: MutableRefObject<MeshFittingService>;
  armorFittingService: MutableRefObject<ArmorFittingService>;

  // State setters
  setIsProcessing: (value: boolean) => void;
  setIsArmorFitted: (value: boolean) => void;
  setIsArmorBound: (value: boolean) => void;
  setIsHelmetFitted: (value: boolean) => void;
  setIsHelmetAttached: (value: boolean) => void;
  setBoundArmorMesh: (mesh: THREE.SkinnedMesh | null) => void;
  setSkinnedArmorMesh: (mesh: THREE.SkinnedMesh | null) => void;
  setError: (value: string) => void;
  resetProcessingStates: () => void;

  // State values
  isProcessing: boolean;
  showHull: boolean;
  fittingParameters: MeshFittingParameters;
  selectedAvatar: { name: string } | null;
  showDebugArrows: boolean;
  helmetFittingMethod: string;
  helmetSizeMultiplier: number;
  helmetFitTightness: number;
  helmetVerticalOffset: number;
  helmetForwardOffset: number;
  helmetRotation: { x: number; y: number; z: number };
  viewMode?: "sphereCube" | "avatarArmor" | "helmetFitting";
}

export function useFittingHandlers(props: FittingHandlersProps) {
  // Use armor fitting hook
  const { performArmorFitting, bindArmorToSkeleton } = useArmorFitting({
    sceneRef: props.sceneRef,
    avatarMeshRef: props.avatarMeshRef,
    armorMeshRef: props.armorMeshRef,
    originalArmorGeometryRef: props.originalArmorGeometryRef,
    debugArrowGroupRef: props.debugArrowGroupRef,
    hullMeshRef: props.hullMeshRef,
    fittingService: props.fittingService,
    armorFittingService: props.armorFittingService,
    setIsProcessing: props.setIsProcessing,
    setIsArmorFitted: props.setIsArmorFitted,
    setIsArmorBound: props.setIsArmorBound,
    setBoundArmorMesh: props.setBoundArmorMesh,
    setSkinnedArmorMesh: props.setSkinnedArmorMesh,
    setError: props.setError,
    isProcessing: props.isProcessing,
    showHull: props.showHull,
    fittingParameters: props.fittingParameters,
    selectedAvatar: props.selectedAvatar,
  });

  // Use helmet fitting hook
  const { performHelmetFitting, attachHelmetToHead, detachHelmetFromHead } =
    useHelmetFitting({
      sceneRef: props.sceneRef,
      avatarMeshRef: props.avatarMeshRef,
      helmetMeshRef: props.helmetMeshRef,
      originalHelmetTransformRef: props.originalHelmetTransformRef,
      fittingService: props.fittingService,
      setIsProcessing: props.setIsProcessing,
      setIsHelmetFitted: props.setIsHelmetFitted,
      setIsHelmetAttached: props.setIsHelmetAttached,
      isProcessing: props.isProcessing,
      helmetFittingMethod: props.helmetFittingMethod,
      helmetSizeMultiplier: props.helmetSizeMultiplier,
      helmetFitTightness: props.helmetFitTightness,
      helmetVerticalOffset: props.helmetVerticalOffset,
      helmetForwardOffset: props.helmetForwardOffset,
      helmetRotation: props.helmetRotation,
    });

  // Use basic demo fitting hook
  const { performBasicDemoFitting } = useBasicDemoFitting({
    sceneRef: props.sceneRef,
    fittingService: props.fittingService,
    setIsProcessing: props.setIsProcessing,
    isProcessing: props.isProcessing,
    fittingParameters: props.fittingParameters,
  });

  // Use reset handlers hook
  const { resetMeshes } = useResetHandlers({
    sceneRef: props.sceneRef,
    avatarMeshRef: props.avatarMeshRef,
    armorMeshRef: props.armorMeshRef,
    helmetMeshRef: props.helmetMeshRef,
    originalArmorGeometryRef: props.originalArmorGeometryRef,
    originalHelmetTransformRef: props.originalHelmetTransformRef,
    debugArrowGroupRef: props.debugArrowGroupRef,
    hullMeshRef: props.hullMeshRef,
    fittingService: props.fittingService,
    setIsArmorFitted: props.setIsArmorFitted,
    setIsArmorBound: props.setIsArmorBound,
    setIsHelmetFitted: props.setIsHelmetFitted,
    setIsHelmetAttached: props.setIsHelmetAttached,
    setBoundArmorMesh: props.setBoundArmorMesh,
    setSkinnedArmorMesh: props.setSkinnedArmorMesh,
    setError: props.setError,
    resetProcessingStates: props.resetProcessingStates,
    detachHelmetFromHead,
    viewMode: props.viewMode,
  });

  // Combined performFitting function that delegates based on direction
  const performFitting = (
    direction: "cubeToSphere" | "sphereToCube" | "avatarToArmor",
  ) => {
    if (direction === "avatarToArmor") {
      performArmorFitting();
    } else {
      performBasicDemoFitting(direction);
    }
  };

  // Return all handlers
  return {
    performFitting,
    bindArmorToSkeleton,
    performHelmetFitting,
    attachHelmetToHead,
    detachHelmetFromHead,
    resetMeshes,
  };
}
