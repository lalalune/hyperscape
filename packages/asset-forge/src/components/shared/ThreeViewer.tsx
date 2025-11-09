import {
  Grid3X3,
  Box,
  Info,
  RotateCw,
  Download,
  Keyboard,
  X,
  Hand,
} from "lucide-react";
import {
  useRef,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useState,
  useCallback,
  type Ref,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { getTierColor } from "../../constants/materials";
import { ENVIRONMENTS } from "../../constants/three";
import { ExtendedWindow } from "../../types";

import { CustomSkeletonHelper } from "./CustomSkeletonHelper";

interface ThreeViewerProps {
  modelUrl?: string;
  isWireframe?: boolean;
  showGroundPlane?: boolean;
  isLightBackground?: boolean;
  // Light/performance mode for lightweight viewers (e.g., asset tabs)
  lightMode?: boolean;
  onModelLoad?: (info: {
    vertices: number;
    faces: number;
    materials: number;
    fileSize?: number;
  }) => void;
  assetInfo?: {
    name?: string;
    type?: string;
    tier?: string;
    format?: string;
    requiresAnimationStrip?: boolean; // Added for animation stripping
    isAnimationFile?: boolean; // Indicates this is an animation GLB file
    characterHeight?: number; // Expected character height in meters
  };
  isAnimationPlayer?: boolean; // Hide certain UI elements when used in AnimationPlayer
}

export interface ThreeViewerRef {
  resetCamera: () => void;
  takeScreenshot: () => void;
  captureHandViews: () => Promise<{
    topView: HTMLCanvasElement;
    frontView: HTMLCanvasElement;
    handPositions: {
      left?: { screen: THREE.Vector2; world: THREE.Vector3 };
      right?: { screen: THREE.Vector2; world: THREE.Vector3 };
    };
  }>;
  loadAnimation: (
    url: string,
    name: string,
  ) => Promise<THREE.AnimationClip | null>;
  playAnimation: (name: string) => void;
  stopAnimation: () => void;
  pauseAnimation: () => void;
  resumeAnimation: () => void;
  setAnimationTimeScale: (scale: number) => void;
  playAnimationRetargeted: (nameOrClip: string | THREE.AnimationClip) => void;
  setTargetRigFromURL: (url: string) => Promise<void>;
  hasTargetRig: () => boolean;
  retargetSkeletonToRig: () => Promise<boolean>;
  loadSkeletonForEditing: () => Promise<boolean>; // NEW: mesh2motion workflow step 1
  applyRetargeting: () => Promise<boolean>; // NEW: mesh2motion workflow step 2
  updateSkeletonScale?: (scale: number) => void; // NEW: update skeleton scale in real-time
  setBoneMapOverrides?: (overrides: Record<string, string>) => void;
  alignToBindPose?: () => void;
  toggleSkeleton: () => void;
  logBoneStructure: () => {
    bones: { name: string; parent: string }[];
    meshes: string[];
  } | null;
  debugSceneContents: () => void;
  exportTPoseModel: () => void;
  refreshSkeleton: () => void;
  enableBoneEditing?: (enabled: boolean) => void;
  setBoneTransformMode?: (mode: "translate" | "rotate") => void;
  setBoneTransformSpace?: (space: "world" | "local") => void;
  setBoneMirrorEnabled?: (enabled: boolean) => void;
  debugGizmo?: () => void;
  getSourceSkeleton?: () => THREE.Skeleton | null;
  getTargetSkeleton?: () => THREE.Skeleton | null;
  getAvailableAnimations: () => THREE.AnimationClip[];
  retargetAnimationsToCharacter: (
    animationRigUrl: string,
    animationsUrl: string,
  ) => Promise<boolean>;
}

const ThreeViewer = forwardRef(
  (
    {
      modelUrl,
      isWireframe = false,
      showGroundPlane = false,
      isLightBackground = false,
      lightMode = false,
      onModelLoad,
      assetInfo,
      isAnimationPlayer = false,
    }: ThreeViewerProps,
    ref: Ref<ThreeViewerRef>,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const transformControlsRef = useRef<TransformControls | null>(null);
    const composerRef = useRef<EffectComposer | null>(null);
    const modelRef = useRef<THREE.Object3D | null>(null);
    const activeSkinnedMeshRef = useRef<THREE.SkinnedMesh | null>(null);
    const editingSkeletonRootRef = useRef<THREE.Object3D | null>(null);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const clockRef = useRef<THREE.Clock | null>(null);
    const frameIdRef = useRef<number | null>(null);
    const gridRef = useRef<THREE.GridHelper | null>(null);
    const skeletonHelperRef = useRef<
      THREE.SkeletonHelper | CustomSkeletonHelper | null
    >(null);
    const _boneEditHandleRef = useRef<THREE.Object3D | null>(null);
    const selectedBoneRef = useRef<THREE.Bone | null>(null);
    const boneHighlightSphereRef = useRef<THREE.Mesh | null>(null);
    const boneLabelsGroupRef = useRef<THREE.Group | null>(null);
    const _originalBindMatricesRef = useRef<
      Map<THREE.SkinnedMesh, THREE.Matrix4[]>
    >(new Map());
    // Removed: animatedModelsRef and animationTypesRef - no longer needed

    // Mesh2Motion workflow refs - for manual retargeting
    const unboundGeometryRef = useRef<THREE.BufferGeometry | null>(null); // Geometry before binding
    const unboundMaterialRef = useRef<THREE.Material | THREE.Material[] | null>(
      null,
    ); // Material to use
    const editableSkeletonRef = useRef<THREE.Skeleton | null>(null); // The skeleton being edited
    const previewMeshRef = useRef<THREE.Mesh | null>(null); // Preview mesh for skeleton editing
    const skeletonScaleMultiplierRef = useRef<number>(0.95); // User-adjustable skeleton scale (95% by default)

    const [loading, setLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [modelInfo, setModelInfo] = useState({
      vertices: 0,
      faces: 0,
      materials: 0,
      fileSize: 0,
    });
    const [showGrid, setShowGrid] = useState(false);
    const [showBounds, setShowBounds] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [autoRotate, setAutoRotate] = useState(false);
    const [currentEnvironment, setCurrentEnvironment] =
      useState<keyof typeof ENVIRONMENTS>("neutral");
    const [animations, setAnimations] = useState<THREE.AnimationClip[]>([]);
    const [_currentAnimation, setCurrentAnimation] = useState<number>(-1);
    const [isPlaying, setIsPlaying] = useState(true);
    const [showSkeleton, setShowSkeleton] = useState(false);
    const [hasRiggedModel, setHasRiggedModel] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const referenceScaleRef = useRef<{ height: number; scale: number } | null>(
      null,
    ); // Store reference scale
    const mountedRef = useRef(false); // Track if component is mounted
    const currentModelUrlRef = useRef<string | null>(null); // Track current model URL
    const [handBones, setHandBones] = useState<{
      leftPalm?: THREE.Bone;
      leftFingers?: THREE.Bone;
      rightPalm?: THREE.Bone;
      rightFingers?: THREE.Bone;
    }>({});
    const [handRotations, setHandRotations] = useState({
      leftPalm: 0,
      leftFingers: 0,
      rightPalm: 0,
      rightFingers: 0,
    });
    const prevHandRotationsRef = useRef(handRotations);
    const handControlsLoggedRef = useRef(false);
    const [showHandControls, setShowHandControls] = useState(false);
    const showHandControlsRef = useRef(showHandControls);
    const handBonesRef = useRef(handBones);
    const handRotationsRef = useRef(handRotations);
    const [rotationAxis, setRotationAxis] = useState<"x" | "y" | "z">("x");
    const rotationAxisRef = useRef(rotationAxis);
    const shouldReframeOnResizeRef = useRef(false);
    const targetRigMapRef = useRef<Map<string, string> | null>(null);
    const boneOverridesRef = useRef<Map<string, string> | null>(null);
    const targetSkeletonRef = useRef<THREE.Skeleton | null>(null);
    const sourceSkeletonRef = useRef<THREE.Skeleton | null>(null); // Original source mesh skeleton (for weight transfer)
    // Bone editing state
    const [_boneEditEnabled, setBoneEditEnabled] = useState(false);
    const boneEditEnabledRef = useRef(false); // Ref for closures
    const [_boneMirrorEnabledState, setBoneMirrorEnabledState] =
      useState(false);
    const boneMirrorEnabledRef = useRef(false); // Ref for closures
    const [boneTransformModeState, setBoneTransformModeState] = useState<
      "translate" | "rotate"
    >("translate");
    const boneTransformModeStateRef = useRef<"translate" | "rotate">(
      "translate",
    ); // Ref for closures
    const [boneTransformSpaceState, setBoneTransformSpaceState] = useState<
      "world" | "local"
    >("world");
    const [_selectedBoneName, setSelectedBoneName] = useState<string | null>(
      null,
    );

    const raycaster = useRef(new THREE.Raycaster());
    const pointer = useRef(new THREE.Vector2());
    const [_selectedBone, setSelectedBone] = useState<THREE.Bone | null>(null);
    const applyMirrorModeRef = useRef<
      ((bone: THREE.Bone, mode: "translate" | "rotate") => void) | null
    >(null);

    const computeDistanceToFit = (
      size: THREE.Vector3,
      camera: THREE.PerspectiveCamera,
    ) => {
      const aspect = camera.aspect || 1;
      const fov = camera.fov * (Math.PI / 180);
      const halfFov = fov / 2;
      const heightBased = size.y;
      const widthBased = size.x / aspect;
      const target = Math.max(heightBased, widthBased) * 1.2; // 20% margin
      return target / (2 * Math.tan(halfFov));
    };

    // Utilities: name normalization and clip remapping
    const normalizeBoneName = (name: string): string => {
      return name
        .replace(/^mixamorig[:_]?/i, "")
        .replace(/^armature[:_\-.]?/i, "")
        .replace(/^DEF[-_]?/i, "") // Strip DEF- prefix from Blender bones
        .replace(/[:.]/g, "")
        .replace(/[-_]/g, "") // Remove dashes and underscores for matching
        .replace(/\s+/g, "")
        .toLowerCase();
    };

    const buildTargetBoneMap = useCallback((): Map<string, string> => {
      const map = new Map<string, string>();
      if (!modelRef.current) return map;
      const unique = new Set<string>();
      modelRef.current.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          child.skeleton.bones.forEach((bone) => {
            const norm = normalizeBoneName(bone.name);
            if (!unique.has(norm)) {
              unique.add(norm);
              map.set(norm, bone.name);
            }
          });
        }
      });
      return map;
    }, []);

    const _remapClipToTarget = useCallback(
      (clip: THREE.AnimationClip): THREE.AnimationClip => {
        // CRITICAL: Always build bone map from the CURRENT retargeted model, not the target rig!
        // The target rig has Mixamo names, but we need to map TO the retargeted model's DEF- names
        const map = buildTargetBoneMap();

        console.log("[remapClipToTarget] Bone map size:", map.size);
        console.log(
          "[remapClipToTarget] Full bone map:",
          Object.fromEntries(map),
        );
        console.log(
          "[remapClipToTarget] Original clip tracks:",
          clip.tracks.length,
        );
        console.log(
          "[remapClipToTarget] First 10 track names:",
          clip.tracks.slice(0, 10).map((t) => t.name),
        );

        const remappedTracks: THREE.KeyframeTrack[] = clip.tracks.map(
          (track) => {
            const parts = track.name.split(".");
            const node = parts[0];
            const rest = parts.slice(1).join(".");
            const normalized = normalizeBoneName(node);
            const targetName = map.get(normalized) || node;
            const newName = `${targetName}.${rest}`;

            console.log(
              `[remapClipToTarget] Track: "${track.name}" -> node="${node}" -> normalized="${normalized}" -> targetName="${targetName}" -> newName="${newName}"`,
            );

            const Ctor = (track as any).constructor as new (
              name: string,
              times: ArrayLike<number>,
              values: ArrayLike<number>,
            ) => THREE.KeyframeTrack;
            const cloned = new Ctor(
              newName,
              (track.times as any).slice(),
              (track.values as any).slice(),
            );
            cloned.setInterpolation(track.getInterpolation());
            return cloned;
          },
        );
        return new THREE.AnimationClip(
          clip.name,
          clip.duration,
          remappedTracks,
        );
      },
      [buildTargetBoneMap],
    );

    const frameCameraToCurrentModel = useCallback(() => {
      const model = modelRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!model || !camera || !controls) return;
      const finalBox = new THREE.Box3().setFromObject(model);
      const finalCenter = finalBox.getCenter(new THREE.Vector3());
      const finalSize = finalBox.getSize(new THREE.Vector3());
      const distance = computeDistanceToFit(finalSize, camera);
      if (assetInfo?.isAnimationFile && assetInfo?.characterHeight) {
        camera.position.set(
          finalCenter.x + distance * 0.5,
          finalCenter.y + assetInfo.characterHeight * 0.3,
          finalCenter.z + distance * 0.5,
        );
      } else {
        camera.position.set(
          finalCenter.x + distance * 0.7,
          finalCenter.y + distance * 0.5,
          finalCenter.z + distance * 0.7,
        );
      }
      camera.lookAt(finalCenter);
      controls.target.copy(finalCenter);
      controls.update();
    }, [assetInfo]);

    // Helper functions

    const formatFileSize = (bytes?: number): string => {
      if (!bytes) return "N/A";
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    };

    // Export T-pose model function
    const exportTPoseModel = useCallback(() => {
      console.log("🎯 Exporting T-pose model...");

      // Check if we have a server-side asset with t-pose.glb file available
      // Only try to download from server if we have an asset ID (not a local file)
      if (assetInfo?.name && modelUrl && !modelUrl.startsWith("blob:")) {
        // Construct the URL to the t-pose.glb file
        // The URL should be something like /api/assets/{assetId}/t-pose.glb
        const tposeUrl = `/api/assets/${assetInfo.name}/t-pose.glb`;

        console.log(`Attempting to download t-pose.glb from: ${tposeUrl}`);

        // Create a link and trigger download
        const link = document.createElement("a");
        link.download = `${assetInfo.name}-tpose.glb`;
        link.href = tposeUrl;
        link.click();

        console.log("✅ T-pose file download initiated");
        return;
      }

      // Fallback to exporting from the current model (for local files or when no server file exists)
      if (!modelRef.current) {
        console.error("No model loaded to export");
        return;
      }

      console.log("Using fallback export method for local model...");

      // Create a new root group with proper name
      const exportRoot = new THREE.Group();
      exportRoot.name = assetInfo?.name || "Model";

      // CRITICAL FIX: Don't clone the model as it breaks skeleton bone references
      // Instead, temporarily add the original model to export root
      const modelToExport = modelRef.current;
      const originalParent = modelToExport.parent;
      const originalPosition = modelToExport.position.clone();
      const originalRotation = modelToExport.rotation.clone();
      const originalScale = modelToExport.scale.clone();

      // Temporarily modify for export
      modelToExport.name = modelToExport.name || "Root";
      modelToExport.position.set(0, 0, 0);
      modelToExport.rotation.set(0, 0, 0);

      // CRITICAL: Normalize scale to reasonable size
      // The model has been scaled up 100x during hand rigging and then by viewer scaling
      // We need to export at a reasonable scale (around 1-2 meters tall)
      const bbox = new THREE.Box3().setFromObject(modelToExport);
      const size = bbox.getSize(new THREE.Vector3());
      const height = size.y;

      // Target height of ~1.8 meters (typical human height)
      const targetHeight = 1.8;
      const scaleNormalization = targetHeight / height;

      console.log(
        `📏 Model height: ${height.toFixed(2)}m, normalizing to ${targetHeight}m (scale: ${scaleNormalization.toFixed(4)})`,
      );
      modelToExport.scale.set(
        scaleNormalization,
        scaleNormalization,
        scaleNormalization,
      );

      // Add to export root
      exportRoot.add(modelToExport);

      // CRITICAL: Remove problematic bones that cause Three.js Editor import errors
      console.log("🧹 Cleaning up problematic bones before export...");
      const problematicBoneNames = [
        "head_end",
        "headfront",
        "Head_end",
        "Head_End",
        "HeadEnd",
      ];
      const bonesToRemove: THREE.Bone[] = [];

      // Find all problematic bones
      exportRoot.traverse((node) => {
        if (
          node instanceof THREE.Bone &&
          problematicBoneNames.includes(node.name)
        ) {
          bonesToRemove.push(node);
        }
      });

      // Remove problematic bones from scene and skeletons
      if (bonesToRemove.length > 0) {
        console.log(
          `  Found ${bonesToRemove.length} problematic bones to remove:`,
        );

        // First, remove from all skeleton bone arrays
        exportRoot.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            const skeleton = child.skeleton;
            const bones = skeleton.bones;
            const inverses = skeleton.boneInverses;

            bonesToRemove.forEach((boneToRemove) => {
              const index = bones.indexOf(boneToRemove);
              if (index !== -1) {
                console.log(
                  `    Removing ${boneToRemove.name} from skeleton at index ${index}`,
                );

                // Update skin indices for this mesh
                if (child.geometry && child.geometry.attributes.skinIndex) {
                  const skinIndices = child.geometry.attributes.skinIndex;
                  const skinWeights = child.geometry.attributes.skinWeight;

                  for (let i = 0; i < skinIndices.count; i++) {
                    for (let j = 0; j < 4; j++) {
                      const idx = skinIndices.getComponent(i, j);
                      if (idx === index) {
                        // Zero out this influence
                        skinIndices.setComponent(i, j, 0);
                        skinWeights.setComponent(i, j, 0);
                      } else if (idx > index) {
                        // Shift down indices after the removed bone
                        skinIndices.setComponent(i, j, idx - 1);
                      }
                    }
                  }
                  skinIndices.needsUpdate = true;
                  skinWeights.needsUpdate = true;
                }

                // Remove from arrays
                bones.splice(index, 1);
                inverses.splice(index, 1);
              }
            });
          }
        });

        // Then remove from scene hierarchy
        bonesToRemove.forEach((bone) => {
          console.log(`    Removing ${bone.name} from scene`);

          // Re-parent children
          const children = [...bone.children];
          children.forEach((child) => {
            if (bone.parent) {
              bone.parent.add(child);
              child.applyMatrix4(bone.matrix);
            }
          });

          // Remove the bone
          if (bone.parent) {
            bone.parent.remove(bone);
          }
        });

        console.log("  ✅ Problematic bones removed");
      }

      // CRITICAL: Ensure clean node structure for Three.js Editor compatibility
      // Since we're not cloning, the skeleton should be intact
      console.log("🔧 Validating model structure...");

      // Just do a simple validation
      let totalBones = 0;
      let totalSkinnedMeshes = 0;
      exportRoot.traverse((child) => {
        if (child instanceof THREE.Bone) totalBones++;
        if (child instanceof THREE.SkinnedMesh) totalSkinnedMeshes++;
      });

      console.log(
        `  ✅ Export validation: ${totalBones} bones, ${totalSkinnedMeshes} skinned meshes`,
      );

      // Ensure all objects have names and proper setup
      let nodeIndex = 0;
      exportRoot.traverse((child) => {
        // Ensure every object has a name
        if (!child.name || child.name === "") {
          child.name = `${child.type}_${nodeIndex++}`;
        }

        // Ensure scale is normalized (PlayCanvas might have issues with non-1 scales)
        if (
          child.scale &&
          (child.scale.x !== 1 || child.scale.y !== 1 || child.scale.z !== 1)
        ) {
          console.log(
            `Normalizing scale for ${child.name}: ${child.scale.x}, ${child.scale.y}, ${child.scale.z} -> 1, 1, 1`,
          );
          // For meshes, we want to preserve the visual size but normalize the scale
          if (child instanceof THREE.Mesh && child.geometry) {
            // Apply scale to geometry
            child.geometry = child.geometry.clone();
            child.geometry.scale(child.scale.x, child.scale.y, child.scale.z);
          }
          // Reset scale to 1,1,1
          child.scale.set(1, 1, 1);
        }

        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          // Clone the skeleton to avoid modifying the original
          const clonedSkeleton = child.skeleton.clone();

          // Ensure all bones have names
          clonedSkeleton.bones.forEach((bone, index) => {
            if (!bone.name || bone.name === "") {
              bone.name = `Bone_${index}`;
            }
            // Also ensure bone's parent has a name if it exists
            if (bone.parent && (!bone.parent.name || bone.parent.name === "")) {
              bone.parent.name =
                bone.parent instanceof THREE.Bone
                  ? `Bone_parent_${index}`
                  : "Armature";
            }
          });

          child.bind(clonedSkeleton, child.bindMatrix);

          // Reset to bind pose (T-pose)
          child.skeleton.pose();
          child.updateMatrixWorld(true);
          console.log(`Reset ${child.name} to T-pose`);
        }

        // Ensure materials are properly set and have names
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          materials.forEach((mat, index) => {
            if (!mat.name || mat.name === "") {
              mat.name = `Material_${child.name}_${index}`;
            }
            mat.transparent = false;
            mat.opacity = 1.0;
            mat.depthWrite = true;
          });
        }
      });

      // Update the entire model hierarchy
      exportRoot.updateMatrixWorld(true);

      // Final validation - ensure ALL objects have names
      let unnamed = 0;
      exportRoot.traverse((obj) => {
        if (!obj.name || obj.name === "") {
          obj.name = `Unnamed_${obj.type}_${unnamed++}`;
          console.warn(
            `Found unnamed object of type ${obj.type}, assigned name: ${obj.name}`,
          );
        }
      });

      console.log(
        "Export validation complete. Root:",
        exportRoot.name,
        "Children:",
        exportRoot.children.length,
      );

      // ULTRA CRITICAL: Force update all world matrices before export
      exportRoot.updateMatrixWorld(true);

      // Count final nodes that will be exported
      let nodeCount = 0;
      const nodeMap = new Map<THREE.Object3D, number>();
      exportRoot.traverse((node) => {
        nodeMap.set(node, nodeCount++);
      });
      console.log(`📊 Final node count before export: ${nodeCount}`);

      // Log skeleton structure
      exportRoot.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          console.log(`📦 ${child.name} skeleton:`);
          console.log(`  - Bones: ${child.skeleton.bones.length}`);
          child.skeleton.bones.forEach((bone, idx) => {
            const nodeIdx = nodeMap.get(bone);
            console.log(`    ${idx}: ${bone.name} -> Node ${nodeIdx}`);
          });
        }
      });

      // Export the model
      const exporter = new GLTFExporter();
      const options = {
        binary: true, // Export as GLB
        animations: [], // No animations - just the rigged model
        includeCustomExtensions: false, // Don't include custom extensions that might cause issues
        trs: true, // Use TRS (translation, rotation, scale) instead of matrices for better compatibility
        forcePowerOfTwoTextures: false,
        maxTextureSize: 4096,
        embedImages: true, // Embed images in the GLB for better compatibility
        onlyVisible: true, // Only export visible objects
        forceIndices: true, // Force indices even for small geometry
        truncateDrawRange: false, // Export full geometry range
      };

      exporter.parse(
        exportRoot,
        (result) => {
          // Save the GLB file
          const blob = new Blob([result as ArrayBuffer], {
            type: "application/octet-stream",
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");

          // Generate filename based on asset info
          const timestamp = new Date().toISOString().split("T")[0];
          const assetName = assetInfo?.name || "model";
          link.download = `${assetName}-tpose-${timestamp}.glb`;

          link.href = url;
          link.click();
          URL.revokeObjectURL(url);

          console.log("✅ T-pose model exported successfully");

          // Restore model to original state
          if (originalParent) {
            originalParent.add(modelToExport);
          }
          modelToExport.position.copy(originalPosition);
          modelToExport.rotation.copy(originalRotation);
          modelToExport.scale.copy(originalScale);
        },
        (error) => {
          console.error("Export error:", error);

          // Restore model to original state even on error
          if (originalParent) {
            originalParent.add(modelToExport);
          }
          modelToExport.position.copy(originalPosition);
          modelToExport.rotation.copy(originalRotation);
          modelToExport.scale.copy(originalScale);
        },
        options,
      );
    }, [assetInfo, modelUrl]);

    // Expose methods for external control
    useImperativeHandle(
      ref,
      () => ({
        resetCamera: () => {
          if (modelRef.current && cameraRef.current && controlsRef.current) {
            // Calculate bounding box including model and skeleton if present
            const box = new THREE.Box3().setFromObject(modelRef.current);

            // If skeleton root is in scene, include it in bounding box calculation
            if (
              editingSkeletonRootRef.current &&
              editingSkeletonRootRef.current.parent
            ) {
              box.expandByObject(editingSkeletonRootRef.current);
              console.log("📷 Including skeleton in camera framing");
            }

            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            console.log("📷 Manual camera reset:");
            console.log(
              `   Model size: ${size.x.toFixed(2)}m x ${size.y.toFixed(2)}m x ${size.z.toFixed(2)}m`,
            );
            console.log(
              `   Model center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`,
            );

            // Calculate proper distance based on field of view and model size
            const fov = cameraRef.current.fov * (Math.PI / 180);
            const cameraAspect = cameraRef.current.aspect;

            let distance;
            if (size.y / size.x > cameraAspect) {
              // Height is limiting factor
              distance = (size.y * 1.5) / (2 * Math.tan(fov / 2));
            } else {
              // Width is limiting factor
              const hFov = 2 * Math.atan(Math.tan(fov / 2) * cameraAspect);
              distance = (size.x * 1.5) / (2 * Math.tan(hFov / 2));
            }

            // Special handling for character models and animation files
            if (
              (assetInfo?.isAnimationFile || size.y < 3) &&
              assetInfo?.characterHeight
            ) {
              // For character models with known height, use a specific distance
              distance = assetInfo.characterHeight * 2.5;

              // Position camera at a nice angle
              cameraRef.current.position.set(
                center.x + distance * 0.5,
                center.y + assetInfo.characterHeight * 0.3,
                center.z + distance * 0.5,
              );
            } else {
              // For other models, ensure minimum distance
              const maxDim = Math.max(size.x, size.y, size.z);
              const paddingMultiplier = maxDim < 2 ? 2.5 : 2.0;
              distance *= paddingMultiplier;
              const minDistance = maxDim < 3 ? 4 : 8;
              distance = Math.max(distance, minDistance);

              // Position camera at a nice angle
              cameraRef.current.position.set(
                center.x + distance * 0.7,
                center.y + distance * 0.5,
                center.z + distance * 0.7,
              );
            }

            cameraRef.current.lookAt(center);

            // Force update controls
            controlsRef.current.target.copy(center);
            controlsRef.current.update();

            console.log(
              `   New camera pos: (${cameraRef.current.position.x.toFixed(2)}, ${cameraRef.current.position.y.toFixed(2)}, ${cameraRef.current.position.z.toFixed(2)})`,
            );
            console.log(`   Camera distance: ${distance.toFixed(2)}m`);
          }
        },
        takeScreenshot: () => {
          if (
            rendererRef.current &&
            sceneRef.current &&
            cameraRef.current &&
            composerRef.current
          ) {
            // Render at higher resolution for screenshot
            const originalSize = new THREE.Vector2();
            rendererRef.current.getSize(originalSize);
            rendererRef.current.setSize(originalSize.x * 2, originalSize.y * 2);
            composerRef.current.setSize(originalSize.x * 2, originalSize.y * 2);

            composerRef.current.render();

            const canvas = rendererRef.current.domElement;
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.download = `model-screenshot-${Date.now()}.png`;
                  link.href = url;
                  link.click();
                  URL.revokeObjectURL(url);
                }

                // Restore original size
                rendererRef.current!.setSize(originalSize.x, originalSize.y);
                composerRef.current!.setSize(originalSize.x, originalSize.y);
              },
              "image/png",
              1.0,
            );
          }
        },
        captureHandViews: async () => {
          if (
            !rendererRef.current ||
            !sceneRef.current ||
            !cameraRef.current ||
            !modelRef.current
          ) {
            throw new Error("Viewer not initialized");
          }

          const renderer = rendererRef.current;
          const camera = cameraRef.current;
          const model = modelRef.current;
          const captures: Record<string, string> = {};

          // Find hand bones
          const handBones: {
            left?: { bone: THREE.Bone; position: THREE.Vector3 };
            right?: { bone: THREE.Bone; position: THREE.Vector3 };
          } = {};

          const handBoneNames = [
            "LeftHand",
            "RightHand",
            "leftHand",
            "rightHand",
            "Hand_L",
            "Hand_R",
            "mixamorig:LeftHand",
            "mixamorig:RightHand",
          ];

          model.traverse((child) => {
            if (child instanceof THREE.Bone) {
              if (handBoneNames.includes(child.name)) {
                const worldPos = new THREE.Vector3();
                child.getWorldPosition(worldPos);

                const isLeft = child.name.toLowerCase().includes("left");
                const side = isLeft ? "left" : "right";

                handBones[side] = {
                  bone: child,
                  position: worldPos,
                };
              }
            }
          });

          // Save current camera state
          const originalPosition = camera.position.clone();
          const originalTarget =
            controlsRef.current?.target.clone() || new THREE.Vector3();
          const originalFov =
            camera instanceof THREE.PerspectiveCamera ? camera.fov : 50;

          // Ensure proper lighting for capture
          const originalShadows = renderer.shadowMap.enabled;
          renderer.shadowMap.enabled = false;

          // Helper function to capture a specific hand region
          const captureHandRegion = (
            side: "left" | "right",
            handInfo: { bone: THREE.Bone; position: THREE.Vector3 },
          ) => {
            const canvas = document.createElement("canvas");
            const captureSize = 512; // Fixed size for hand captures
            canvas.width = captureSize;
            canvas.height = captureSize;

            // Create a temporary renderer for hand capture
            const tempRenderer = new THREE.WebGLRenderer({
              canvas,
              antialias: true,
              alpha: true,
            });
            tempRenderer.setSize(captureSize, captureSize);
            tempRenderer.setClearColor(0xffffff, 1);

            // Create temporary camera for close-up hand capture
            const tempCamera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);

            // Position camera to focus on the hand
            const handPos = handInfo.position.clone();
            const cameraDistance = 0.3; // Much closer to the hand

            // For top view of hand
            tempCamera.position.set(
              handPos.x,
              handPos.y + cameraDistance,
              handPos.z,
            );
            tempCamera.lookAt(handPos);
            tempCamera.up.set(0, 0, side === "left" ? 1 : -1); // Orient based on hand side

            // Render the scene
            if (sceneRef.current) {
              tempRenderer.render(sceneRef.current, tempCamera);
            }

            // Clean up temp renderer
            tempRenderer.dispose();

            return canvas;
          };

          // Capture individual hands if found
          const handCaptures: {
            leftHand?: HTMLCanvasElement;
            rightHand?: HTMLCanvasElement;
          } = {};

          if (handBones.left) {
            handCaptures.leftHand = captureHandRegion("left", handBones.left);
            captures.left_closeup = handCaptures.leftHand.toDataURL();
          }

          if (handBones.right) {
            handCaptures.rightHand = captureHandRegion(
              "right",
              handBones.right,
            );
            captures.right_closeup = handCaptures.rightHand.toDataURL();
          }

          // Also capture full body views for context
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          // Top view of full model
          camera.position.set(center.x, center.y + maxDim * 2, center.z);
          if (controlsRef.current) {
            controlsRef.current.target.copy(center);
            controlsRef.current.update();
          }
          camera.updateProjectionMatrix();

          renderer.render(sceneRef.current, camera);
          const topCanvas = document.createElement("canvas");
          topCanvas.width = 512;
          topCanvas.height = 512;
          const topCtx = topCanvas.getContext("2d")!;
          topCtx.drawImage(renderer.domElement, 0, 0, 512, 512);

          // Front view of full model
          camera.position.set(center.x, center.y, center.z + maxDim * 2);
          if (controlsRef.current) {
            controlsRef.current.target.copy(center);
            controlsRef.current.update();
          }
          camera.updateProjectionMatrix();

          renderer.render(sceneRef.current, camera);
          const frontCanvas = document.createElement("canvas");
          frontCanvas.width = 512;
          frontCanvas.height = 512;
          const frontCtx = frontCanvas.getContext("2d")!;
          frontCtx.drawImage(renderer.domElement, 0, 0, 512, 512);

          // Restore original camera state
          camera.position.copy(originalPosition);
          if (controlsRef.current) {
            controlsRef.current.target.copy(originalTarget);
            controlsRef.current.update();
          }
          if (camera instanceof THREE.PerspectiveCamera) {
            camera.fov = originalFov;
          }
          camera.updateProjectionMatrix();

          // Restore shadow settings
          renderer.shadowMap.enabled = originalShadows;

          return {
            topView: topCanvas,
            frontView: frontCanvas,
            handPositions: {
              left: handBones.left
                ? {
                    screen: new THREE.Vector2(256, 256),
                    world: handBones.left.position,
                  }
                : undefined,
              right: handBones.right
                ? {
                    screen: new THREE.Vector2(256, 256),
                    world: handBones.right.position,
                  }
                : undefined,
            },
            leftHandCloseup: handCaptures.leftHand,
            rightHandCloseup: handCaptures.rightHand,
            debugCaptures: captures,
          };
        },
        loadAnimation: async (url: string, name: string) => {
          if (!modelRef.current || !sceneRef.current)
            throw new Error("No model loaded");

          const loader = new GLTFLoader();
          try {
            const gltf = await loader.loadAsync(url);

            if (gltf.animations && gltf.animations.length > 0) {
              // Find the specific animation by name (for multi-animation GLB files)
              let animationClip = gltf.animations.find(
                (anim) => anim.name === name,
              );

              if (!animationClip) {
                console.warn(
                  `Animation "${name}" not found in file. Available animations:`,
                  gltf.animations.map((a) => a.name),
                );
                console.log(
                  `Using first animation instead: ${gltf.animations[0].name}`,
                );
                animationClip = gltf.animations[0];
              }

              console.log(
                `Loaded animation: ${animationClip.name} with ${animationClip.tracks.length} tracks`,
              );

              // Initialize mixer with the current model if not already done
              if (!mixerRef.current) {
                mixerRef.current = new THREE.AnimationMixer(modelRef.current);
              }

              // For character animations, we need to handle skeleton mapping
              // The animation file contains the same skeleton structure, so we can apply it directly
              try {
                // Add the animation clip to our collection
                setAnimations((prev) => {
                  const existing = prev.filter((anim) => anim.name !== name);
                  return [...existing, animationClip];
                });

                console.log(
                  `Successfully loaded animation: ${animationClip.name}`,
                );
                return animationClip;
              } catch (error) {
                console.error(`Failed to setup animation ${name}:`, error);
                throw error;
              }
            }
            return null;
          } catch (error) {
            console.error(`Failed to load animation from ${url}:`, error);
            throw error;
          }
        },
        playAnimation: (name: string) => {
          if (!mixerRef.current || !animations.length) {
            console.log(
              `Cannot play animation: mixer=${!!mixerRef.current}, animations=${animations.length}`,
            );
            return;
          }

          console.log(
            `Available animations: ${animations.map((a) => a.name).join(", ")}`,
          );
          const animation = animations.find((anim) => anim.name === name);
          if (!animation) {
            console.error(`Animation "${name}" not found`);
            console.error(
              `Available animations: ${animations.map((a) => a.name).join(", ")}`,
            );
            // If the requested animation is not found but we have animations, play the first one
            if (animations.length > 0) {
              console.log(
                `Playing first available animation instead: ${animations[0].name}`,
              );
              const firstAnimation = animations[0];
              mixerRef.current.stopAllAction();
              const action = mixerRef.current.clipAction(firstAnimation);
              action.reset();
              action.setLoop(THREE.LoopRepeat, Infinity);
              action.play();
              setCurrentAnimation(0);
              setIsPlaying(true);
              if (!clockRef.current) {
                clockRef.current = new THREE.Clock();
              }
            }
            return;
          }

          console.log(`Playing animation: ${name}`);
          console.log(`Current model visible: ${modelRef.current?.visible}`);
          console.log(
            `Model children count before play: ${modelRef.current?.children.length}`,
          );

          mixerRef.current.stopAllAction();
          const action = mixerRef.current.clipAction(animation);
          action.reset();
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
          setCurrentAnimation(animations.indexOf(animation));
          setIsPlaying(true);
          if (!clockRef.current) {
            clockRef.current = new THREE.Clock();
          }

          console.log(
            `Animation started. Model children count after play: ${modelRef.current?.children.length}`,
          );
        },
        playAnimationRetargeted: (nameOrClip: string | THREE.AnimationClip) => {
          if (!mixerRef.current || !modelRef.current) {
            console.error("Cannot play animation: no mixer or model");
            return;
          }

          // Get the clip - either passed directly or found by name
          let clip: THREE.AnimationClip | undefined;
          if (typeof nameOrClip === "string") {
            clip = animations.find((a) => a.name === nameOrClip);
            if (!clip) {
              console.error(
                `Animation "${nameOrClip}" not found in animations array`,
                animations.map((a) => a.name),
              );
              return;
            }
          } else {
            clip = nameOrClip;
          }

          console.log(
            `[playAnimationRetargeted] Playing animation: ${clip.name}`,
          );
          console.log(
            `[playAnimationRetargeted] Animation has ${clip.tracks.length} tracks`,
          );

          // Debug: Show what bones are available in the current model
          const availableBones: string[] = [];
          modelRef.current.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh && child.skeleton) {
              child.skeleton.bones.forEach((bone) =>
                availableBones.push(bone.name),
              );
            }
          });
          console.log(
            "[playAnimationRetargeted] Available bones in model (first 10):",
            availableBones.slice(0, 10),
          );
          console.log(
            "[playAnimationRetargeted] Animation track names (first 10):",
            clip.tracks.slice(0, 10).map((t) => t.name),
          );

          // CRITICAL: The animations from human-base-animations.glb already have DEF- bone names
          // that match the retargeted model, so we DON'T need to remap!
          // Just play the animation directly on the model.

          mixerRef.current.stopAllAction();
          const action = mixerRef.current.clipAction(clip);
          action.reset();
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
          setIsPlaying(true);
          if (!clockRef.current) clockRef.current = new THREE.Clock();

          console.log("[playAnimationRetargeted] Animation action started");
        },
        setTargetRigFromURL: async (url: string) => {
          console.log(`🎯 Loading target rig from: ${url}`);
          const loader = new GLTFLoader();
          const gltf = await loader.loadAsync(url);

          console.log(
            "Rig GLTF loaded, scene children:",
            gltf.scene.children.length,
          );
          gltf.scene.traverse((child) => {
            console.log(`  - ${child.type}: ${child.name}`);
          });

          // Extract skeleton from target rig
          const rigMap = new Map<string, string>();
          const unique = new Set<string>();
          let extractedSkeleton: THREE.Skeleton | null = null;

          // First try to find SkinnedMesh
          const skinnedMeshes: THREE.SkinnedMesh[] = [];
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh) {
              skinnedMeshes.push(child);
              console.log(
                `Found SkinnedMesh: ${child.name}, bones: ${child.skeleton.bones.length}`,
              );
            }
          });

          if (skinnedMeshes.length > 0) {
            const mesh = skinnedMeshes[0];
            extractedSkeleton = mesh.skeleton.clone();

            mesh.skeleton.bones.forEach((bone) => {
              const norm = normalizeBoneName(bone.name);
              if (!unique.has(norm)) {
                unique.add(norm);
                rigMap.set(norm, bone.name);
              }
            });
          } else {
            // Fallback: try to build skeleton from bone hierarchy directly
            console.log("No SkinnedMesh found, looking for bones...");
            const bones: THREE.Bone[] = [];
            gltf.scene.traverse((child) => {
              if (child instanceof THREE.Bone) {
                bones.push(child);
                console.log(`  Found bone: ${child.name}`);
              }
            });

            if (bones.length > 0) {
              extractedSkeleton = new THREE.Skeleton(bones);
              bones.forEach((bone) => {
                const norm = normalizeBoneName(bone.name);
                if (!unique.has(norm)) {
                  unique.add(norm);
                  rigMap.set(norm, bone.name);
                }
              });
            }
          }

          targetRigMapRef.current = rigMap;
          targetSkeletonRef.current = extractedSkeleton;
          console.log(
            `✅ Target rig loaded. Mapped ${rigMap.size} bones, skeleton: ${extractedSkeleton ? "YES" : "NO"}`,
          );
          if (extractedSkeleton) {
            console.log(
              `   Skeleton has ${extractedSkeleton.bones.length} bones`,
            );
          }
        },
        hasTargetRig: () =>
          !!targetRigMapRef.current && targetRigMapRef.current.size > 0,
        retargetSkeletonToRig: async () => {
          if (
            !modelRef.current ||
            !sceneRef.current ||
            !targetSkeletonRef.current
          ) {
            console.warn(
              "Missing model, scene, or target skeleton for retargeting",
            );
            return false;
          }

          const { SkeletonRetargeter } = await import(
            "../../services/retargeting/SkeletonRetargeter"
          );

          // Find all skinned meshes in current model
          const sourceMeshes = SkeletonRetargeter.extractSkinnedMeshes(
            modelRef.current,
          );
          if (sourceMeshes.length === 0) {
            console.warn("No skinned meshes found in model to retarget");
            return false;
          }

          console.log(
            `🔄 Starting skeleton retargeting for ${sourceMeshes.length} meshes`,
          );
          console.log("=== DEBUG: Source Model State ===");
          console.log("Model scale:", modelRef.current.scale.toArray());
          console.log("Model position:", modelRef.current.position.toArray());
          const modelBBox = new THREE.Box3().setFromObject(modelRef.current);
          console.log(
            "Model world bounds:",
            modelBBox.min.toArray(),
            "to",
            modelBBox.max.toArray(),
          );
          console.log(
            "Model world size:",
            modelBBox.getSize(new THREE.Vector3()).toArray(),
          );

          sourceMeshes.forEach((mesh, i) => {
            console.log(`Source mesh ${i}: "${mesh.name}"`);
            console.log(
              "  World scale:",
              new THREE.Vector3()
                .setFromMatrixScale(mesh.matrixWorld)
                .toArray(),
            );
            console.log("  Local scale:", mesh.scale.toArray());
            console.log("  Skeleton bones:", mesh.skeleton.bones.length);
            const meshBBox = new THREE.Box3().setFromObject(mesh);
            console.log(
              "  Mesh world size:",
              meshBBox.getSize(new THREE.Vector3()).toArray(),
            );
          });

          console.log("=== DEBUG: Target Skeleton State ===");
          console.log(
            "Target skeleton bones:",
            targetSkeletonRef.current.bones.length,
          );
          const targetRoot = targetSkeletonRef.current.bones[0];
          console.log("Root bone scale:", targetRoot.scale.toArray());
          console.log("Root bone position:", targetRoot.position.toArray());
          targetRoot.updateMatrixWorld(true);
          const targetBBox = new THREE.Box3();
          targetSkeletonRef.current.bones.forEach((bone) => {
            const pos = new THREE.Vector3();
            bone.getWorldPosition(pos);
            targetBBox.expandByPoint(pos);
          });
          console.log(
            "Target skeleton world bounds:",
            targetBBox.min.toArray(),
            "to",
            targetBBox.max.toArray(),
          );
          console.log(
            "Target skeleton world size:",
            targetBBox.getSize(new THREE.Vector3()).toArray(),
          );

          // Store original model
          const originalModel = modelRef.current;
          const originalParent = originalModel.parent;

          // Retarget the first skinned mesh (most models have only one)
          const sourceMesh = sourceMeshes[0];
          const retargetedMesh = await SkeletonRetargeter.retargetMesh(
            sourceMesh,
            targetSkeletonRef.current,
            "distance-targeting", // Use smart solver with parent-aware and boundary smoothing
          );

          // CRITICAL: Copy the source mesh's LOCAL transform (not world)
          // The skeleton is already positioned correctly in local space
          // We only need position/rotation, NOT scale (skeleton has its own internal scale)
          retargetedMesh.position.copy(sourceMesh.position);
          retargetedMesh.rotation.copy(sourceMesh.rotation);
          retargetedMesh.scale.set(1, 1, 1); // Always 1,1,1 - skeleton bones handle scale internally
          retargetedMesh.updateMatrix();
          retargetedMesh.updateMatrixWorld(true);

          console.log("Retargeted mesh transform:", {
            position: retargetedMesh.position.toArray(),
            rotation: retargetedMesh.rotation.toArray(),
            scale: retargetedMesh.scale.toArray(),
          });

          // Replace model in scene
          if (originalParent) {
            originalParent.remove(originalModel);
            originalParent.add(retargetedMesh);
          } else if (sceneRef.current) {
            sceneRef.current.remove(originalModel);
            sceneRef.current.add(retargetedMesh);
          }

          // Update modelRef to point to retargeted mesh
          modelRef.current = retargetedMesh;
          // Track active skinned mesh for editing
          activeSkinnedMeshRef.current = retargetedMesh;

          // Recreate mixer for retargeted mesh
          if (mixerRef.current) {
            mixerRef.current.stopAllAction();
          }
          mixerRef.current = new THREE.AnimationMixer(retargetedMesh);

          // Clean up previous overlay skeleton and helper
          if (skeletonHelperRef.current && sceneRef.current) {
            sceneRef.current.remove(skeletonHelperRef.current);
            if (skeletonHelperRef.current instanceof CustomSkeletonHelper) {
              skeletonHelperRef.current.dispose();
            }
            skeletonHelperRef.current = null;
          }

          // Remove previous editable skeleton from scene
          if (editingSkeletonRootRef.current && sceneRef.current) {
            sceneRef.current.remove(editingSkeletonRootRef.current);
            editingSkeletonRootRef.current = null;
          }

          // CRITICAL: Create a SEPARATE skeleton for editing (not bound to mesh)
          // This prevents mesh deformation while allowing bone repositioning
          const bones: THREE.Bone[] = [];
          retargetedMesh.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Bone) {
              bones.push(child);
            }
          });

          const rootBone = bones.length > 0 ? bones[0] : null;

          if (rootBone) {
            // Clone the entire bone hierarchy for editing (deep clone)
            const editableSkeleton = rootBone.clone(true) as THREE.Bone;
            editableSkeleton.name = "EditableSkeleton";

            // Position the editable skeleton to match the actual skeleton's world position
            rootBone.updateMatrixWorld(true);
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();
            rootBone.matrixWorld.decompose(worldPos, worldQuat, worldScale);

            editableSkeleton.position.copy(worldPos);
            editableSkeleton.quaternion.copy(worldQuat);
            editableSkeleton.scale.copy(worldScale);
            editableSkeleton.updateMatrix();

            // Add to scene (NOT as child of mesh)
            sceneRef.current.add(editableSkeleton);
            editingSkeletonRootRef.current = editableSkeleton;
            editableSkeleton.updateMatrixWorld(true);

            console.log(`✅ Created editable skeleton (overlay):`);
            console.log("   Position:", worldPos.toArray());
            console.log("   Quaternion:", worldQuat.toArray());
            console.log("   Scale:", worldScale.toArray());
            console.log("   Bone count:", editableSkeleton.children.length);
            console.log(
              "   In scene:",
              sceneRef.current.children.includes(editableSkeleton),
            );

            // Create CustomSkeletonHelper for the EDITABLE skeleton
            const helper = new CustomSkeletonHelper(editableSkeleton, {
              linewidth: 4,
              color: 0x00ff00,
              jointColor: 0xffffff,
            });
            helper.visible = true;
            helper.setJointsVisible(true);
            sceneRef.current.add(helper);
            skeletonHelperRef.current = helper;
            setShowSkeleton(true);
            console.log(
              `Created CustomSkeletonHelper with ${helper.bones.length} bones (separate editable skeleton)`,
            );
          } else {
            console.warn("No root bone found for skeleton helper");
          }

          // Make mesh semi-transparent to see skeleton better
          if (retargetedMesh.material) {
            if (Array.isArray(retargetedMesh.material)) {
              retargetedMesh.material.forEach((mat) => {
                mat.transparent = true;
                mat.opacity = 0.3;
                mat.depthWrite = false;
              });
            } else {
              retargetedMesh.material.transparent = true;
              retargetedMesh.material.opacity = 0.3;
              retargetedMesh.material.depthWrite = false;
            }
          }

          // TransformControls helper is already in scene from init - no need to re-add

          console.log(
            "✅ Skeleton retargeting complete - skeleton helper created",
          );
          return true;
        },
        loadSkeletonForEditing: async () => {
          if (
            !modelRef.current ||
            !sceneRef.current ||
            !targetSkeletonRef.current
          ) {
            console.warn("Missing model or target skeleton for editing");
            return false;
          }

          console.log(
            "🎯 Loading skeleton for manual adjustment (mesh2motion workflow)",
          );

          const { SkeletonRetargeter } = await import(
            "../../services/retargeting/SkeletonRetargeter"
          );

          // Extract the source mesh geometry (we'll bind it AFTER editing bones)
          const sourceMeshes = SkeletonRetargeter.extractSkinnedMeshes(
            modelRef.current,
          );

          if (sourceMeshes.length === 0) {
            console.warn("No skinned meshes found");
            return false;
          }

          const sourceMesh = sourceMeshes[0];

          // CRITICAL: Store the original source skeleton for weight transfer
          // This skeleton has the ORIGINAL weights from Meshy that we want to preserve!
          if (sourceMesh.skeleton) {
            sourceSkeletonRef.current = sourceMesh.skeleton.clone();
            console.log(
              "✅ Stored source skeleton:",
              sourceMesh.skeleton.bones.length,
              "bones",
            );
            console.log(
              "   Sample bone names:",
              sourceMesh.skeleton.bones.slice(0, 5).map((b) => b.name),
            );
          } else {
            console.warn("⚠️ Source mesh has no skeleton!");
          }

          // CRITICAL: Follow mesh2motion-app approach
          // For SkinnedMesh, extract geometry and material directly WITHOUT world transform
          // Keep geometry in its BIND POSE (as it was defined relative to the original skeleton)
          unboundGeometryRef.current = sourceMesh.geometry.clone();
          unboundMaterialRef.current = Array.isArray(sourceMesh.material)
            ? sourceMesh.material.map((m) => m.clone())
            : sourceMesh.material.clone();

          console.log("Stored geometry for later binding (in bind pose):", {
            vertices: unboundGeometryRef.current.attributes.position.count,
            hasUV: !!unboundGeometryRef.current.attributes.uv,
            hasSkinWeights: !!unboundGeometryRef.current.attributes.skinWeight,
            hasSkinIndices: !!unboundGeometryRef.current.attributes.skinIndex,
          });

          // CRITICAL: Create preview mesh - following Option A approach
          // Geometry and skeleton must be at SAME scale during weight calculation AND binding
          const previewMesh = new THREE.Mesh(
            unboundGeometryRef.current.clone(),
            unboundMaterialRef.current,
          );
          previewMesh.name = "PreviewMesh";

          // Calculate scale factor based on bind pose size
          previewMesh.position.set(0, 0, 0);
          previewMesh.rotation.set(0, 0, 0);
          previewMesh.scale.set(1, 1, 1); // Start at bind pose to measure

          const previewBBox = new THREE.Box3().setFromObject(previewMesh);
          const previewSize = previewBBox.getSize(new THREE.Vector3());
          const targetSize = 5.0; // Target max dimension (same as model loading)
          const baseScaleFactor =
            targetSize / Math.max(previewSize.x, previewSize.y, previewSize.z);

          // Apply user's skeleton scale multiplier (e.g., 0.95 = 95%)
          const meshScaleFactor =
            baseScaleFactor * skeletonScaleMultiplierRef.current;

          // CRITICAL: Apply scale to preview mesh FIRST
          previewMesh.scale.set(
            meshScaleFactor,
            meshScaleFactor,
            meshScaleFactor,
          );

          // Store preview mesh for later updates
          previewMeshRef.current = previewMesh;

          // Hide the original skinned model (it will be replaced after retargeting)
          if (modelRef.current) {
            modelRef.current.visible = false;
          }

          sceneRef.current.add(previewMesh);

          // Verify final mesh size
          const finalMeshBBox = new THREE.Box3().setFromObject(previewMesh);
          const finalMeshSize = finalMeshBBox.getSize(new THREE.Vector3());

          console.log("📐 Preview mesh scaled:");
          console.log("  Bind pose size:", previewSize.toArray());
          console.log("  Base scale factor:", baseScaleFactor);
          console.log(
            "  User scale multiplier:",
            skeletonScaleMultiplierRef.current,
          );
          console.log("  Final mesh scale:", meshScaleFactor);
          console.log("  Final mesh size:", finalMeshSize.toArray());

          // Clone the TARGET skeleton for editing (this will become the retargeted skeleton)
          const clonedSkeleton = targetSkeletonRef.current.clone();
          const rootBone = clonedSkeleton.bones[0];

          // Reset root bone to origin
          rootBone.position.set(0, 0, 0);
          rootBone.rotation.set(0, 0, 0);
          rootBone.scale.set(1, 1, 1);
          rootBone.updateMatrixWorld(true);

          // Apply T-pose to skeleton
          await SkeletonRetargeter.applyTPoseToSkeleton(clonedSkeleton);

          // Apply Z-up to Y-up conversion
          rootBone.rotation.x = -Math.PI / 2;
          rootBone.updateMatrixWorld(true);

          // Calculate skeleton's natural size at scale 1.0
          clonedSkeleton.bones.forEach((bone) => bone.updateMatrixWorld(true));
          const naturalSkelBBox = new THREE.Box3();
          clonedSkeleton.bones.forEach((bone) => {
            const pos = new THREE.Vector3();
            bone.getWorldPosition(pos);
            naturalSkelBBox.expandByPoint(pos);
          });
          const naturalSkelSize = naturalSkelBBox.getSize(new THREE.Vector3());

          // CRITICAL: Scale skeleton to fit WITHIN preview mesh bounds
          // Calculate how much to scale skeleton to match mesh size (but not exceed it)
          const skeletonScaleX = finalMeshSize.x / naturalSkelSize.x;
          const skeletonScaleY = finalMeshSize.y / naturalSkelSize.y;
          const skeletonScaleZ = finalMeshSize.z / naturalSkelSize.z;

          // Use the MINIMUM scale to ensure skeleton fits within mesh bounds
          const skeletonScaleFactor = Math.min(
            skeletonScaleX,
            skeletonScaleY,
            skeletonScaleZ,
          );

          console.log(`🎯 Calculating skeleton scale to fit within mesh:`);
          console.log(
            `  Natural skeleton size: (${naturalSkelSize.x.toFixed(2)}, ${naturalSkelSize.y.toFixed(2)}, ${naturalSkelSize.z.toFixed(2)})`,
          );
          console.log(
            `  Target mesh size: (${finalMeshSize.x.toFixed(2)}, ${finalMeshSize.y.toFixed(2)}, ${finalMeshSize.z.toFixed(2)})`,
          );
          console.log(
            `  Scale ratios: X=${skeletonScaleX.toFixed(3)}, Y=${skeletonScaleY.toFixed(3)}, Z=${skeletonScaleZ.toFixed(3)}`,
          );
          console.log(
            `  Using minimum scale: ${skeletonScaleFactor.toFixed(3)}`,
          );

          // Apply the calculated scale to skeleton
          rootBone.scale.set(
            skeletonScaleFactor,
            skeletonScaleFactor,
            skeletonScaleFactor,
          );
          rootBone.updateMatrixWorld(true);

          // Get skeleton bounds AFTER scaling to position it correctly
          clonedSkeleton.bones.forEach((bone) => bone.updateMatrixWorld(true));

          const scaledSkelBBox = new THREE.Box3();
          clonedSkeleton.bones.forEach((bone) => {
            const pos = new THREE.Vector3();
            bone.getWorldPosition(pos);
            scaledSkelBBox.expandByPoint(pos);
          });
          const scaledSkelCenter = scaledSkelBBox.getCenter(
            new THREE.Vector3(),
          );
          const scaledSkelSize = scaledSkelBBox.getSize(new THREE.Vector3());

          // Position skeleton to align with preview mesh center
          const meshWorldBBox = new THREE.Box3().setFromObject(previewMesh);
          const meshWorldCenter = meshWorldBBox.getCenter(new THREE.Vector3());

          const offset = meshWorldCenter.clone().sub(scaledSkelCenter);
          rootBone.position.add(offset);
          rootBone.updateMatrixWorld(true);

          console.log(`✅ Skeleton scaled and positioned:`);
          console.log(
            `  Scale: ${skeletonScaleFactor.toFixed(3)} (fits within mesh bounds)`,
          );
          console.log(
            `  Position: (${rootBone.position.x.toFixed(2)}, ${rootBone.position.y.toFixed(2)}, ${rootBone.position.z.toFixed(2)})`,
          );
          console.log(
            `  Final skeleton size: (${scaledSkelSize.x.toFixed(2)}, ${scaledSkelSize.y.toFixed(2)}, ${scaledSkelSize.z.toFixed(2)})`,
          );
          console.log(
            `  Final mesh size: (${finalMeshSize.x.toFixed(2)}, ${finalMeshSize.y.toFixed(2)}, ${finalMeshSize.z.toFixed(2)})`,
          );

          // Store reference to editable skeleton
          editableSkeletonRef.current = clonedSkeleton;

          // Create skeleton helper to visualize
          if (skeletonHelperRef.current && sceneRef.current) {
            sceneRef.current.remove(skeletonHelperRef.current);
            if (skeletonHelperRef.current instanceof CustomSkeletonHelper) {
              skeletonHelperRef.current.dispose();
            }
          }

          const helper = new CustomSkeletonHelper(rootBone, {
            linewidth: 4,
            color: 0x00ff00,
            jointColor: 0xffffff,
          });
          helper.visible = true;
          helper.setJointsVisible(true);
          sceneRef.current.add(helper);
          skeletonHelperRef.current = helper;

          // Add root bone to scene so it's visible
          sceneRef.current.add(rootBone);
          editingSkeletonRootRef.current = rootBone;

          // Ensure the original model is visible
          if (modelRef.current) {
            modelRef.current.visible = true;
            console.log("Model visibility:", modelRef.current.visible);
            console.log("Model position:", modelRef.current.position.toArray());
          }

          // Log final positions for debugging
          const finalSkelBBox = new THREE.Box3();
          clonedSkeleton.bones.forEach((bone) => {
            const pos = new THREE.Vector3();
            bone.getWorldPosition(pos);
            finalSkelBBox.expandByPoint(pos);
          });
          const finalSkelCenter = finalSkelBBox.getCenter(new THREE.Vector3());
          const finalSkelSize = finalSkelBBox.getSize(new THREE.Vector3());

          console.log("Final skeleton center:", finalSkelCenter.toArray());
          console.log("Final skeleton size:", finalSkelSize.toArray());
          console.log(
            "Mesh scale:",
            meshScaleFactor.toFixed(3),
            "| Skeleton scale:",
            skeletonScaleFactor.toFixed(3),
          );

          console.log(
            "✅ Skeleton loaded for editing. User can now adjust bone positions.",
          );
          console.log(
            "   Model and skeleton should now be aligned and both visible.",
          );

          return true;
        },
        applyRetargeting: async () => {
          if (
            !editableSkeletonRef.current ||
            !unboundGeometryRef.current ||
            !unboundMaterialRef.current ||
            !sceneRef.current
          ) {
            console.error(
              "Missing skeleton, geometry, or material for retargeting",
            );
            return false;
          }

          console.log(
            "🔄 Applying retargeting with WEIGHT TRANSFER (production technique)...",
          );

          // CRITICAL: Get the preview mesh to extract its scale
          const previewMeshForWeights = sceneRef.current.getObjectByName(
            "PreviewMesh",
          ) as THREE.Mesh;
          if (!previewMeshForWeights) {
            console.error("Preview mesh not found!");
            return false;
          }

          const previewScale = previewMeshForWeights.scale.x; // Uniform scale
          console.log("📐 Preview mesh scale for geometry:", previewScale);

          // CRITICAL: Create scaled geometry (same as preview mesh)
          // This geometry will receive the TRANSFERRED weights (not recalculated!)
          const scaledGeometry = unboundGeometryRef.current.clone();
          const scaleMatrix = new THREE.Matrix4();
          scaleMatrix.makeScale(previewScale, previewScale, previewScale);
          scaledGeometry.applyMatrix4(scaleMatrix);

          console.log(
            "📊 Transferring weights from source skeleton to target skeleton...",
          );
          console.log(
            "  Source skeleton:",
            sourceSkeletonRef.current?.bones.length,
            "bones",
          );
          console.log(
            "  Target skeleton:",
            editableSkeletonRef.current.bones.length,
            "bones",
          );

          // PRODUCTION TECHNIQUE: Transfer weights instead of recalculating!
          // This preserves the original Meshy weights - just remaps bone indices
          let skinIndices: number[];
          let skinWeights: number[];

          if (sourceSkeletonRef.current) {
            // Try weight transfer first (preserves professional Meshy weights)
            const { WeightTransferSolver } = await import(
              "../../services/retargeting/WeightTransferSolver"
            );
            const transferSolver = new WeightTransferSolver(
              unboundGeometryRef.current, // Use UNSCALED geometry (has original weights)
              sourceSkeletonRef.current,
              editableSkeletonRef.current,
            );

            // Check if bone mapping is good enough
            if (transferSolver.isMappingQualityGood()) {
              console.log(
                "✅ Bone mapping quality is good - using weight transfer",
              );
              const transferred = transferSolver.transferWeights();
              skinIndices = transferred.skinIndices;
              skinWeights = transferred.skinWeights;
            } else {
              // Fallback to distance-based calculation
              console.warn(
                "⚠️  Bone mapping quality poor - falling back to distance calculation",
              );
              const { SkeletonRetargeter } = await import(
                "../../services/retargeting/SkeletonRetargeter"
              );
              const solver = SkeletonRetargeter.createSolver(
                "distance-targeting",
                scaledGeometry, // Use scaled geometry to match skeleton scale
                editableSkeletonRef.current.bones,
              );
              const result = solver.calculateWeights();
              skinIndices = result.skinIndices;
              skinWeights = result.skinWeights;
            }
          } else {
            // No source skeleton - must calculate from scratch
            console.warn(
              "⚠️  No source skeleton - calculating weights from scratch",
            );
            const { SkeletonRetargeter } = await import(
              "../../services/retargeting/SkeletonRetargeter"
            );
            const solver = SkeletonRetargeter.createSolver(
              "distance-targeting",
              scaledGeometry,
              editableSkeletonRef.current.bones,
            );
            const result = solver.calculateWeights();
            skinIndices = result.skinIndices;
            skinWeights = result.skinWeights;
          }

          console.log("Weight processing complete:", {
            totalVertices: scaledGeometry.attributes.position.count,
            weightsGenerated: skinWeights.length / 4,
          });

          // Apply skin attributes to the SCALED geometry
          scaledGeometry.setAttribute(
            "skinIndex",
            new THREE.Uint16BufferAttribute(skinIndices, 4),
          );
          scaledGeometry.setAttribute(
            "skinWeight",
            new THREE.Float32BufferAttribute(skinWeights, 4),
          );

          // CRITICAL: Following mesh2motion-app Option A approach
          // Geometry and skeleton BOTH at scaled size (matching weight calculation)
          // Scale applied via geometry matrix (baked) and skeleton transform (not baked)
          const rootBone = editableSkeletonRef.current.bones[0];

          console.log("📐 Option A: Geometry and skeleton at matching scales");
          console.log(
            "  Geometry: Scaled by",
            previewScale,
            "(baked into vertices)",
          );
          console.log(
            "  Skeleton scale (kept as transform):",
            rootBone.scale.toArray(),
          );

          // Create the final skinned mesh using the SCALED geometry
          // CRITICAL: Use the same geometry we calculated weights with!
          const retargetedMesh = new THREE.SkinnedMesh(
            scaledGeometry,
            unboundMaterialRef.current,
          );
          retargetedMesh.name = "RetargetedMesh";
          retargetedMesh.castShadow = true;
          retargetedMesh.receiveShadow = true;

          console.log(
            "Pre-binding transforms (Option A - scale kept as transform):",
          );
          console.log("  Root bone position:", rootBone.position.toArray());
          console.log("  Root bone rotation:", rootBone.rotation.toArray());
          console.log("  Root bone scale:", rootBone.scale.toArray());

          // CRITICAL: Option A approach - DO NOT bake scale!
          // Keep scale as transform property during binding
          // This matches mesh2motion-app's approach where scale is only baked for export

          // Remove rootBone from scene before adding to mesh
          if (rootBone.parent) {
            rootBone.parent.remove(rootBone);
          }

          // Store the scale factor for potential animation keyframe scaling
          const skeletonScaleFactor = rootBone.scale.x;
          (retargetedMesh as any).__skeletonScaleFactor = skeletonScaleFactor;

          console.log(
            "✓ Keeping skeleton scale as transform property:",
            skeletonScaleFactor,
          );
          console.log("  Root bone scale will be preserved during binding");

          rootBone.updateMatrixWorld(true);

          // BINDING SEQUENCE (Option A):
          // 1. Add root bone to skinned mesh as child
          retargetedMesh.add(rootBone);

          // 2. Keep retargetedMesh at ORIGIN with identity transforms
          // Geometry is already scaled (baked into vertices)
          // Skeleton scale is preserved as transform property
          retargetedMesh.position.set(0, 0, 0);
          retargetedMesh.scale.set(1, 1, 1); // Identity because geometry is pre-scaled
          retargetedMesh.rotation.set(0, 0, 0);

          // 3. Bind the mesh to the skeleton
          // This creates bind matrices based on current bone transforms
          retargetedMesh.bind(editableSkeletonRef.current);

          console.log("✅ Mesh bound to skeleton:");
          console.log("  - Mesh position:", retargetedMesh.position.toArray());
          console.log("  - Mesh scale:", retargetedMesh.scale.toArray());
          console.log("  - Mesh rotation:", retargetedMesh.rotation.toArray());
          console.log(
            "  - Skeleton bones:",
            editableSkeletonRef.current.bones.length,
          );

          // Remove the preview mesh from the scene
          const previewMesh = sceneRef.current.getObjectByName("PreviewMesh");
          if (previewMesh) {
            sceneRef.current.remove(previewMesh);
            console.log("Removed preview mesh");
          }

          // Replace old model in scene
          if (modelRef.current) {
            sceneRef.current.remove(modelRef.current);
          }
          sceneRef.current.add(retargetedMesh);
          modelRef.current = retargetedMesh;
          activeSkinnedMeshRef.current = retargetedMesh;

          // Remove the standalone root bone (it's now part of the mesh)
          if (
            editingSkeletonRootRef.current &&
            sceneRef.current.children.includes(editingSkeletonRootRef.current)
          ) {
            sceneRef.current.remove(editingSkeletonRootRef.current);
          }

          // Recreate mixer for animations
          if (mixerRef.current) {
            mixerRef.current.stopAllAction();
          }
          mixerRef.current = new THREE.AnimationMixer(retargetedMesh);

          // Auto-load animations from human-base-animations.glb
          try {
            console.log(
              "📦 Loading animations from human-base-animations.glb...",
            );
            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync(
              "/rigs/animations/human-base-animations.glb",
            );

            if (gltf.animations && gltf.animations.length > 0) {
              console.log(
                `✅ Loaded ${gltf.animations.length} animations from base animations file`,
              );

              // CRITICAL: DO NOT scale animation keyframes!
              // The skeleton has scale as a TRANSFORM PROPERTY (not baked)
              // Three.js will automatically apply the skeleton's scale transform during animation
              // Scaling keyframes would cause DOUBLE-SCALING
              console.log(
                `🎬 Using animations as-is (skeleton scale: ${skeletonScaleFactor})`,
              );
              console.log(
                `   Skeleton scale transform will be applied automatically by Three.js`,
              );

              setAnimations(gltf.animations);

              // Log all animation names
              console.log(
                "Available animations:",
                gltf.animations.map((a) => a.name).join(", "),
              );
            } else {
              console.warn("No animations found in base animations file");
            }
          } catch (error) {
            console.error("Failed to load animations:", error);
          }

          console.log("✅ Retargeting applied! Mesh bound to edited skeleton.");

          return true;
        },
        retargetAnimationsToCharacter: async (
          animationRigUrl: string,
          animationsUrl: string,
        ) => {
          /**
           * NEW WORKFLOW: Animation Retargeting (Industry Standard)
           *
           * Instead of rebinding mesh to new skeleton:
           * 1. Keep character bound to its original skeleton
           * 2. Load animation rig (Mixamo) and animations
           * 3. Retarget animation bone transforms from Mixamo → Character
           * 4. Play retargeted animations on character
           *
           * This is what Hyperfy, Unreal, and production tools do.
           */

          if (!modelRef.current || !sceneRef.current) {
            console.error("No character loaded!");
            return false;
          }

          console.log("🎬 Starting Animation Retargeting workflow...");
          console.log("  Character stays bound to original skeleton");
          console.log("  Retargeting animations only (not mesh)");

          // Get character's skeleton
          let characterSkeleton: THREE.Skeleton | null = null;
          modelRef.current.traverse((child) => {
            if (
              child instanceof THREE.SkinnedMesh &&
              child.skeleton &&
              !characterSkeleton
            ) {
              characterSkeleton = child.skeleton;
            }
          });

          if (!characterSkeleton) {
            console.error("❌ Character has no skeleton!");
            return false;
          }

          // TypeScript type narrowing - characterSkeleton is now THREE.Skeleton (not null)
          const charSkeleton: THREE.Skeleton = characterSkeleton;
          console.log(
            "✅ Character skeleton:",
            charSkeleton.bones.length,
            "bones",
          );
          console.log("🔍 ALL CHARACTER BONE NAMES:");
          charSkeleton.bones.forEach((bone: THREE.Bone, i: number) => {
            console.log(`  [${i}] ${bone.name}`);
          });

          // Load animation rig (Mixamo)
          console.log("📦 Loading animation rig from:", animationRigUrl);
          const loader = new GLTFLoader();
          const rigGltf = await loader.loadAsync(animationRigUrl);

          const { extractSkeletonFromGLTF } = await import(
            "../../services/retargeting/AnimationRetargeter"
          );
          const animationSkeleton: THREE.Skeleton | null =
            extractSkeletonFromGLTF(rigGltf);

          if (!animationSkeleton) {
            console.error("❌ Animation rig has no skeleton!");
            return false;
          }

          // TypeScript now knows animationSkeleton is THREE.Skeleton (not null)
          console.log(
            "✅ Animation skeleton:",
            animationSkeleton.bones.length,
            "bones",
          );
          console.log("🔍 ALL ANIMATION BONE NAMES:");
          animationSkeleton.bones.forEach((bone: THREE.Bone, i: number) => {
            console.log(`  [${i}] ${bone.name}`);
          });

          // Load animations
          console.log("📦 Loading animations from:", animationsUrl);
          const animGltf = await loader.loadAsync(animationsUrl);

          if (!animGltf.animations || animGltf.animations.length === 0) {
            console.error("❌ No animations found!");
            return false;
          }

          console.log("✅ Loaded", animGltf.animations.length, "animations");

          // Retarget animations
          const { AnimationRetargeter } = await import(
            "../../services/retargeting/AnimationRetargeter"
          );
          const retargeter = new AnimationRetargeter(
            animGltf.animations,
            animationSkeleton, // Source: Mixamo (67 bones)
            charSkeleton, // Target: Character (24 bones)
          );

          const retargetedAnimations = retargeter.retargetAll();

          if (retargetedAnimations.length === 0) {
            console.error("❌ Failed to retarget any animations!");
            return false;
          }

          console.log(
            "✅ Successfully retargeted",
            retargetedAnimations.length,
            "animations",
          );

          // Debug: Show retargeted track names for first animation
          if (retargetedAnimations.length > 0) {
            const firstClip = retargetedAnimations[0].clip;
            console.log("🔍 First retargeted clip track names:");
            firstClip.tracks
              .slice(0, 10)
              .forEach((track: THREE.KeyframeTrack) => {
                console.log(`  ${track.name}`);
              });
          }

          // Set up animation mixer on the ORIGINAL character (not a rebounded mesh)
          if (mixerRef.current) {
            mixerRef.current.stopAllAction();
          }
          mixerRef.current = new THREE.AnimationMixer(modelRef.current);

          // Store retargeted clips
          const clips = retargetedAnimations.map((r) => r.clip);
          setAnimations(clips);

          // Show skeleton by default after retargeting
          if (charSkeleton && sceneRef.current) {
            // Create or update skeleton helper
            if (skeletonHelperRef.current) {
              sceneRef.current.remove(skeletonHelperRef.current);
            }

            const helper = new THREE.SkeletonHelper(modelRef.current!);
            helper.visible = true;

            // Make skeleton lines visible
            const material = helper.material as THREE.LineBasicMaterial;
            material.color = new THREE.Color(0x00ff00); // Bright green
            material.linewidth = 3;
            material.depthTest = true;
            material.transparent = true;
            material.opacity = 1.0;

            sceneRef.current.add(helper);
            skeletonHelperRef.current = helper;
            setShowSkeleton(true);
            setHasRiggedModel(true);

            console.log("✅ Skeleton helper shown by default");
          }

          console.log("✅ Animation retargeting complete!");
          console.log("   Character mesh: Unchanged (original skeleton)");
          console.log("   Animations: Retargeted to character skeleton");
          console.log(
            "   Available animations:",
            clips.map((c) => c.name).join(", "),
          );

          return true;
        },
        stopAnimation: () => {
          if (mixerRef.current) {
            mixerRef.current.stopAllAction();
          }

          // Reset model to bind pose (T-pose)
          if (modelRef.current) {
            // Store the current model scale and any Armature scales before resetting
            const modelScale = modelRef.current.scale.clone();
            const armatureScales = new Map<THREE.Object3D, THREE.Vector3>();

            // Preserve scales for all objects, especially Armatures
            modelRef.current.traverse((child) => {
              if (child.name === "Armature" || child.type === "Object3D") {
                armatureScales.set(child, child.scale.clone());
              }
            });

            // Reset skeletons to bind pose
            modelRef.current.traverse((child) => {
              if (child instanceof THREE.SkinnedMesh && child.skeleton) {
                child.skeleton.pose();
                child.skeleton.calculateInverses();
                child.skeleton.computeBoneTexture();
                child.updateMatrixWorld(true);
              }
            });

            // Restore all preserved scales
            modelRef.current.scale.copy(modelScale);
            armatureScales.forEach((scale, obj) => {
              obj.scale.copy(scale);
            });

            // Force update the entire scene hierarchy
            modelRef.current.updateMatrixWorld(true);

            // Force update the renderer to show the changes
            if (
              rendererRef.current &&
              sceneRef.current &&
              cameraRef.current &&
              composerRef.current
            ) {
              composerRef.current.render();
            }
          }

          setCurrentAnimation(-1);
          setIsPlaying(false);
        },
        pauseAnimation: () => {
          if (mixerRef.current) {
            mixerRef.current.timeScale = 0;
            setIsPlaying(false);
          }
        },
        resumeAnimation: () => {
          if (mixerRef.current) {
            mixerRef.current.timeScale = 1;
            setIsPlaying(true);
          }
        },
        setAnimationTimeScale: (scale: number) => {
          if (mixerRef.current) {
            mixerRef.current.timeScale = scale;
          }
        },
        toggleSkeleton: () => {
          if (!sceneRef.current || !modelRef.current) return;

          if (skeletonHelperRef.current) {
            // Remove skeleton helper
            sceneRef.current.remove(skeletonHelperRef.current);
            skeletonHelperRef.current = null;
            setShowSkeleton(false);

            // Restore model opacity
            modelRef.current.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat) => {
                    mat.transparent = false;
                    mat.opacity = 1.0;
                    mat.depthWrite = true;
                  });
                } else {
                  child.material.transparent = false;
                  child.material.opacity = 1.0;
                  child.material.depthWrite = true;
                }
              }
            });
          } else {
            // Find all SkinnedMesh objects in the model
            const skinnedMeshes: THREE.SkinnedMesh[] = [];
            modelRef.current.traverse((child) => {
              if (child instanceof THREE.SkinnedMesh) {
                skinnedMeshes.push(child);
              }
            });

            // Also check for animated models if we're in animation mode
            const animatedModel =
              sceneRef.current.getObjectByName("animatedModel");
            if (animatedModel && skinnedMeshes.length === 0) {
              animatedModel.traverse((child: THREE.Object3D) => {
                if (child instanceof THREE.SkinnedMesh && child.skeleton) {
                  skinnedMeshes.push(child);
                }
              });
            }

            if (skinnedMeshes.length > 0) {
              // Create skeleton helper for the first skinned mesh with bones
              const meshWithBones = skinnedMeshes.find(
                (mesh) => mesh.skeleton.bones.length > 0,
              );
              if (meshWithBones) {
                const helper = new THREE.SkeletonHelper(modelRef.current);
                helper.visible = true;

                // Make skeleton lines thicker and brighter for better visibility
                const material = helper.material as THREE.LineBasicMaterial;
                material.color = new THREE.Color(0x00ff00); // Bright green
                material.linewidth = 3;
                material.depthTest = true;
                material.depthWrite = true;
                material.transparent = true;
                material.opacity = 1.0;

                sceneRef.current!.add(helper);
                skeletonHelperRef.current = helper;
                setShowSkeleton(true);
                // If we can show a skeleton, it's definitely a rigged model
                setHasRiggedModel(true);

                // Make model semi-transparent with proper depth handling
                modelRef.current.traverse((child) => {
                  if (child instanceof THREE.Mesh && child.material) {
                    if (Array.isArray(child.material)) {
                      child.material.forEach((mat) => {
                        mat.transparent = true;
                        mat.opacity = 0.3; // More transparent to see bones better
                        mat.depthWrite = false; // Don't write to depth buffer when transparent
                      });
                    } else {
                      child.material.transparent = true;
                      child.material.opacity = 0.3;
                      child.material.depthWrite = false;
                    }
                  }
                });
                console.log(
                  `Skeleton helper created for mesh with ${meshWithBones.skeleton.bones.length} bones`,
                );
              }
            } else {
              console.log("No skinned meshes found in the model");
            }
          }
        },
        logBoneStructure: () => {
          if (!modelRef.current) {
            console.log("No model loaded");
            return null;
          }

          const result: {
            bones: { name: string; parent: string }[];
            meshes: string[];
          } = {
            bones: [],
            meshes: [],
          };

          // Find all SkinnedMesh objects and their bones
          let foundBones = false;
          modelRef.current.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh && child.skeleton) {
              foundBones = true;
              result.meshes.push(child.name || "unnamed");

              child.skeleton.bones.forEach(
                (bone: THREE.Bone, index: number) => {
                  const parentName =
                    bone.parent && bone.parent.name ? bone.parent.name : "root";
                  result.bones.push({
                    name: bone.name || `Bone ${index}`,
                    parent: parentName,
                  });
                },
              );
            }
          });

          if (!foundBones) {
            console.log("No bones/skeleton found in the model");
            return null;
          }

          return result;
        },
        debugSceneContents: () => {
          if (!sceneRef.current) {
            console.log("No scene available");
            return;
          }

          console.log("=== Scene Contents Debug ===");
          const meshes: THREE.Mesh[] = [];
          const skinnedMeshes: THREE.SkinnedMesh[] = [];

          sceneRef.current.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh) {
              skinnedMeshes.push(child);
            } else if (child instanceof THREE.Mesh) {
              meshes.push(child);
            }
          });

          console.log(`Total Meshes: ${meshes.length}`);
          console.log(`Total SkinnedMeshes: ${skinnedMeshes.length}`);

          console.log("\nDetailed breakdown:");
          skinnedMeshes.forEach((mesh, i) => {
            const material = mesh.material;
            const opacity = Array.isArray(material)
              ? material[0]?.opacity
              : material?.opacity;
            console.log(
              `SkinnedMesh ${i}: ${mesh.name || "unnamed"}, visible: ${mesh.visible}, opacity: ${opacity}`,
            );
          });
          meshes.forEach((mesh, i) => {
            if (mesh.name !== "groundPlane") {
              console.log(
                `Mesh ${i}: ${mesh.name || "unnamed"}, visible: ${mesh.visible}`,
              );
            }
          });
        },
        exportTPoseModel: exportTPoseModel,
        refreshSkeleton: () => {
          if (!sceneRef.current || !modelRef.current) return;

          // Remove existing skeleton helper
          if (skeletonHelperRef.current) {
            sceneRef.current.remove(skeletonHelperRef.current);
            skeletonHelperRef.current = null;
          }

          // If skeleton was showing, recreate it
          if (showSkeleton) {
            // Find all SkinnedMesh objects in the model
            const skinnedMeshes: THREE.SkinnedMesh[] = [];
            modelRef.current.traverse((child) => {
              if (child instanceof THREE.SkinnedMesh) {
                skinnedMeshes.push(child);
              }
            });

            if (skinnedMeshes.length > 0) {
              // Create skeleton helper for the entire model
              const meshWithBones = skinnedMeshes.find(
                (mesh) => mesh.skeleton.bones.length > 0,
              );
              if (meshWithBones) {
                // Pass the model root to show all bones
                const helper = new THREE.SkeletonHelper(modelRef.current);
                helper.visible = true;

                // Make skeleton lines thicker and brighter for better visibility
                const material = helper.material as THREE.LineBasicMaterial;
                material.color = new THREE.Color(0x00ff00); // Bright green
                material.linewidth = 3;
                material.depthTest = true;
                material.depthWrite = true;
                material.transparent = true;
                material.opacity = 1.0;

                sceneRef.current.add(helper);
                skeletonHelperRef.current = helper;

                console.log(
                  `✅ Skeleton helper refreshed with ${meshWithBones.skeleton.bones.length} bones`,
                );
              }
            }
          }
        },
        // Bone editing controls - ONLY works when explicitly enabled
        enableBoneEditing: (enabled: boolean) => {
          console.log(`[bone-edit] Enable bone editing: ${enabled}`);
          setBoneEditEnabled(enabled);
          boneEditEnabledRef.current = enabled; // Update ref for closures

          if (!transformControlsRef.current || !rendererRef.current) {
            console.warn("[bone-edit] TransformControls or renderer not ready");
            return;
          }

          // CRITICAL: Ensure skeleton is visible when enabling bone editing
          if (enabled && skeletonHelperRef.current) {
            skeletonHelperRef.current.visible = true;
            setShowSkeleton(true);
            console.log("[bone-edit] ✅ Skeleton helper made visible");
          }

          // Ensure we have bones to edit
          if (enabled) {
            const editRoot = editingSkeletonRootRef.current ?? modelRef.current;
            if (!editRoot) {
              console.error(
                "[bone-edit] ❌ No editable skeleton or model found!",
              );
              return;
            }

            const bones: THREE.Bone[] = [];
            editRoot.traverse((child) => {
              if (child instanceof THREE.Bone) bones.push(child);
            });

            console.log(`[bone-edit] Found ${bones.length} bones to edit`);
            if (bones.length === 0) {
              console.error("[bone-edit] ❌ No bones found in skeleton!");
              alert(
                "No skeleton bones found. Please load a model with a skeleton first.",
              );
              return;
            }
          }

          transformControlsRef.current.enabled = enabled;
          (transformControlsRef.current as unknown as THREE.Object3D).visible =
            enabled;

          // Hide/show bone highlight sphere
          if (boneHighlightSphereRef.current) {
            if (!enabled) {
              boneHighlightSphereRef.current.visible = false;
            }
          }

          const tcObj = transformControlsRef.current as any as THREE.Object3D;
          console.log("[bone-edit] TransformControls state:");
          console.log("  - enabled:", transformControlsRef.current.enabled);
          console.log("  - visible:", tcObj.visible);
          console.log(
            "  - in scene:",
            sceneRef.current?.children.includes(tcObj),
          );
          console.log("  - parent:", tcObj.parent?.type);

          // Detach from any object when disabling
          if (!enabled && transformControlsRef.current.object) {
            transformControlsRef.current.detach();
            console.log("  - Detached from object");
          }

          // CRITICAL: Stop all animations when editing bones to prevent mesh deformation
          if (enabled) {
            console.log(
              "[bone-edit] Stopping animations to prevent mesh deformation",
            );
            if (mixerRef.current) {
              mixerRef.current.stopAllAction();
              mixerRef.current.timeScale = 0;
            }
            // Set skeleton to bind pose to ensure mesh stays static
            if (modelRef.current) {
              modelRef.current.traverse((child) => {
                if (child instanceof THREE.SkinnedMesh && child.skeleton) {
                  child.skeleton.pose(); // Reset to bind pose
                  // DON'T call skeleton.update() here - it would deform the mesh
                }
              });
            }
          } else if (!enabled && mixerRef.current) {
            // Re-enable animation when done editing
            mixerRef.current.timeScale = 1;
          }

          // Scale gizmo based on model size so it's always visible
          if (enabled && modelRef.current) {
            try {
              const box = new THREE.Box3().setFromObject(modelRef.current);
              const size = box.getSize(new THREE.Vector3());
              const radius = Math.max(size.x, size.y, size.z);
              // Scale to 12% of model size for good visibility
              transformControlsRef.current.size = Math.max(radius * 0.12, 0.3);
              console.log(
                "[bone-edit] Initial gizmo size:",
                transformControlsRef.current.size,
                "for model radius:",
                radius,
              );
            } catch {
              transformControlsRef.current.size = 0.5;
            }
          }
          console.log("[bone-edit] TransformControls enabled set to:", enabled);

          // Only set up click listener once
          const canvas = rendererRef.current.domElement;
          if (!canvas.dataset.boneClickListenerAdded) {
            canvas.dataset.boneClickListenerAdded = "true";

            // Use pointerdown in bubble phase to avoid interfering with TransformControls
            canvas.addEventListener(
              "pointerdown",
              (event: PointerEvent) => {
                console.log(
                  "[bone-edit] 🖱️ Canvas clicked! Bone editing enabled:",
                  boneEditEnabledRef.current,
                );

                // ONLY respond to clicks when bone editing is enabled (use ref to avoid closure stale value)
                if (!boneEditEnabledRef.current) {
                  console.log(
                    "[bone-edit] Click ignored - bone editing not enabled",
                  );
                  return;
                }

                console.log("[bone-edit] Processing bone selection click...");

                if (
                  !modelRef.current ||
                  !cameraRef.current ||
                  !transformControlsRef.current
                )
                  return;

                // Calculate pointer position relative to canvas
                const rect = canvas.getBoundingClientRect();
                const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                pointer.current.set(x, y);

                console.log(
                  `[selection] Mouse down at NDC: (${x.toFixed(3)}, ${y.toFixed(3)})`,
                );

                const bones: THREE.Bone[] = [];
                const selectionRoot = (editingSkeletonRootRef.current ??
                  modelRef.current)!;
                // Ensure world matrices are current before selection
                selectionRoot.updateMatrixWorld(true);
                selectionRoot.traverse((child) => {
                  if (child instanceof THREE.Bone) bones.push(child);
                });

                console.log(`[selection] Found ${bones.length} bones`);

                if (bones.length === 0) {
                  console.warn("[selection] No bones found!");
                  return;
                }

                // Update matrices then raycast to bones
                raycaster.current.setFromCamera(
                  pointer.current,
                  cameraRef.current,
                );

                // Find closest bone (scale-aware)
                let closestBone: THREE.Bone | null = null;
                let closestDistance = 0.3;
                // Scale selection radius by model size for robustness
                if (modelRef.current) {
                  const box = new THREE.Box3().setFromObject(modelRef.current);
                  const size = box.getSize(new THREE.Vector3());
                  const radius = Math.max(size.x, size.y, size.z);
                  if (isFinite(radius) && radius > 0) {
                    closestDistance = Math.max(closestDistance, radius * 0.02);
                  }
                }

                for (const bone of bones) {
                  const pos = new THREE.Vector3();
                  bone.getWorldPosition(pos);
                  const distance = raycaster.current.ray.distanceToPoint(pos);
                  if (distance < closestDistance) {
                    closestDistance = distance;
                    closestBone = bone;
                  }
                }

                if (closestBone) {
                  console.log(
                    `[selection] ✅ Selected "${closestBone.name}" (dist: ${closestDistance.toFixed(3)})`,
                  );
                  setSelectedBone(closestBone);
                  setSelectedBoneName(closestBone.name);
                  selectedBoneRef.current = closestBone;

                  // Update bone world matrix first
                  closestBone.updateMatrixWorld(true);

                  // Show highlight sphere at bone position
                  if (boneHighlightSphereRef.current) {
                    const worldPos = new THREE.Vector3();
                    closestBone.getWorldPosition(worldPos);
                    boneHighlightSphereRef.current.position.copy(worldPos);
                    boneHighlightSphereRef.current.visible = true;
                    console.log(
                      `[selection] 🔵 Highlight sphere positioned at bone location`,
                    );
                  }

                  // Attach TransformControls to the bone
                  transformControlsRef.current.attach(closestBone);

                  // CRITICAL: Ensure the helper is in the scene after attaching
                  // TransformControls creates helper lazily on first attach
                  const helper = transformControlsRef.current.getHelper();
                  if (
                    helper &&
                    sceneRef.current &&
                    !sceneRef.current.children.includes(helper)
                  ) {
                    console.log(
                      "[selection] 🔧 Manually adding helper to scene",
                    );
                    sceneRef.current.add(helper);
                  }

                  // Configure gizmo with 3-axis arrows (X=Red, Y=Green, Z=Blue)
                  transformControlsRef.current.showX = true;
                  transformControlsRef.current.showY = true;
                  transformControlsRef.current.showZ = true;
                  transformControlsRef.current.setMode(boneTransformModeState); // 'translate' or 'rotate'
                  transformControlsRef.current.setSpace(
                    boneTransformSpaceState,
                  ); // 'local' or 'world'

                  // Scale gizmo appropriately based on model size
                  if (modelRef.current) {
                    const box = new THREE.Box3().setFromObject(
                      modelRef.current,
                    );
                    const size = box.getSize(new THREE.Vector3());
                    const radius = Math.max(size.x, size.y, size.z);
                    // Scale gizmo to 10-15% of model size for visibility without overwhelming
                    transformControlsRef.current.size = Math.max(
                      radius * 0.12,
                      0.3,
                    );
                    console.log(
                      `[selection] 📏 Gizmo size set to ${transformControlsRef.current.size.toFixed(2)} (model size: ${radius.toFixed(2)})`,
                    );
                  } else {
                    // Fallback to reasonable size if no model
                    transformControlsRef.current.size = 0.5;
                  }

                  // Gizmo should now be visible - TransformControls handles its own rendering
                  console.log(
                    "[selection] ✅ Gizmo attached and should be visible",
                  );

                  const tcObj =
                    transformControlsRef.current as any as THREE.Object3D;
                  console.log(
                    `[selection] 🎯 3-Axis Gizmo attached to bone "${closestBone.name}"`,
                  );
                  console.log(
                    "  - Mode:",
                    transformControlsRef.current.mode,
                    "(drag arrows to move)",
                  );
                  console.log("  - Space:", transformControlsRef.current.space);
                  console.log("  - Size:", transformControlsRef.current.size);
                  console.log(
                    "  - Attached object position:",
                    closestBone.position.toArray(),
                  );
                  console.log(
                    "  - TransformControls in scene:",
                    sceneRef.current?.children.includes(tcObj),
                  );
                  console.log(
                    "  - TransformControls parent:",
                    tcObj.parent?.type,
                  );
                } else {
                  console.log(
                    `[selection] ❌ No bone within ${closestDistance}m`,
                  );
                }
              },
              { capture: false },
            ); // Use bubble phase

            // Hover-attacher: keep controls attached to the nearest bone under the pointer so axis picking works
            // No hover attach — user must click a joint to attach
          }
        },
        setBoneTransformMode: (mode: "translate" | "rotate") => {
          setBoneTransformModeState(mode);
          boneTransformModeStateRef.current = mode; // Update ref for closures
          if (transformControlsRef.current)
            transformControlsRef.current.setMode(mode);
          console.log("[bone-edit] Transform mode set to:", mode);
        },
        setBoneTransformSpace: (space: "world" | "local") => {
          setBoneTransformSpaceState(space);
          if (transformControlsRef.current)
            transformControlsRef.current.setSpace(space);
          console.log("[bone-edit] Transform space set to:", space);
        },
        setBoneMirrorEnabled: (enabled: boolean) => {
          setBoneMirrorEnabledState(enabled);
          boneMirrorEnabledRef.current = enabled; // Update ref for closures
          console.log("[bone-edit] Mirror mode set to:", enabled);
          console.log(
            "[bone-edit] Mirror ref updated to:",
            boneMirrorEnabledRef.current,
          );

          // IMMEDIATE UX: Apply mirror to currently selected bone when enabled
          if (
            enabled &&
            selectedBoneRef.current &&
            applyMirrorModeRef.current
          ) {
            console.log(
              "[mirror] 🎯 Mirror enabled - applying immediately to current selection",
            );
            applyMirrorModeRef.current(
              selectedBoneRef.current,
              boneTransformModeStateRef.current,
            );

            // Update skeleton helper to show the change
            if (skeletonHelperRef.current) {
              skeletonHelperRef.current.updateMatrixWorld(true);
            }
          }
        },
        setBoneMapOverrides: (overrides: Record<string, string>) => {
          const m = new Map<string, string>();
          Object.entries(overrides).forEach(([k, v]) =>
            m.set(normalizeBoneName(k), v),
          );
          boneOverridesRef.current = m;
        },
        alignToBindPose: () => {
          if (!modelRef.current) return;
          modelRef.current.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh && child.skeleton) {
              child.skeleton.pose();
              child.updateMatrixWorld(true);
            }
          });
        },
        debugGizmo: () => {
          console.log("=== GIZMO DEBUG ===");
          console.log("TransformControls ref:", !!transformControlsRef.current);
          if (transformControlsRef.current) {
            const tc = transformControlsRef.current;
            const tcObj = tc as any as THREE.Object3D;
            console.log("  enabled:", tc.enabled);
            console.log("  visible:", tcObj.visible);
            console.log("  mode:", tc.mode);
            console.log("  space:", tc.space);
            console.log("  size:", tc.size);
            console.log("  object attached:", tc.object?.name);
            console.log(
              "  in scene:",
              sceneRef.current?.children.includes(tcObj),
            );
            console.log("  parent:", tcObj.parent?.type);

            const helper = tc.getHelper();
            console.log("  helper:", !!helper);
            if (helper) {
              console.log("    helper visible:", helper.visible);
              console.log(
                "    helper in scene:",
                sceneRef.current?.children.includes(helper),
              );
              console.log("    helper children:", helper.children.length);
              console.log("    helper position:", helper.position.toArray());
            }
          }

          console.log("\n=== SCENE OBJECTS ===");
          if (sceneRef.current) {
            console.log(
              "Total scene children:",
              sceneRef.current.children.length,
            );
            sceneRef.current.children.forEach((child, i) => {
              console.log(
                `  ${i}: ${child.type} "${child.name}" visible:${child.visible}`,
              );
            });

            const testCube = sceneRef.current.getObjectByName("TestCube");
            console.log("\nTest cube:", !!testCube);
            if (testCube) {
              console.log("  position:", testCube.position.toArray());
              console.log("  visible:", testCube.visible);
            }
          }
          console.log("=== END DEBUG ===");
        },
        getSourceSkeleton: () => {
          // Get skeleton from the currently loaded model
          if (!modelRef.current) return null;

          let skeleton: THREE.Skeleton | null = null;
          modelRef.current.traverse((child) => {
            if (
              child instanceof THREE.SkinnedMesh &&
              child.skeleton &&
              !skeleton
            ) {
              skeleton = child.skeleton;
            }
          });
          return skeleton;
        },
        getTargetSkeleton: () => {
          // Return the target rig skeleton if loaded
          return targetSkeletonRef.current;
        },
        getAvailableAnimations: () => {
          // Return the current list of loaded animations
          return animations;
        },
        updateSkeletonScale: (scale: number) => {
          // Update the skeleton scale multiplier
          skeletonScaleMultiplierRef.current = scale;

          // Update preview mesh and skeleton if they exist
          if (
            previewMeshRef.current &&
            editableSkeletonRef.current &&
            targetSkeletonRef.current
          ) {
            const previewMesh = previewMeshRef.current;
            const rootBone = editableSkeletonRef.current.bones[0];

            // Recalculate scale based on bind pose
            const previewBBox = new THREE.Box3();
            previewMesh.scale.set(1, 1, 1); // Reset to bind pose temporarily
            previewBBox.setFromObject(previewMesh);
            const previewSize = previewBBox.getSize(new THREE.Vector3());

            const targetSize = 5.0;
            const baseScaleFactor =
              targetSize /
              Math.max(previewSize.x, previewSize.y, previewSize.z);
            const meshScaleFactor = baseScaleFactor * scale;

            // Apply new scale to preview mesh
            previewMesh.scale.set(
              meshScaleFactor,
              meshScaleFactor,
              meshScaleFactor,
            );

            // Get final mesh size
            const finalMeshBBox = new THREE.Box3().setFromObject(previewMesh);
            const finalMeshSize = finalMeshBBox.getSize(new THREE.Vector3());

            // Calculate skeleton's natural size (need to temporarily reset to get natural size)
            const _currentScale = rootBone.scale.clone();
            const _currentPos = rootBone.position.clone();

            rootBone.scale.set(1, 1, 1);
            rootBone.position.set(0, 0, 0);
            rootBone.updateMatrixWorld(true);

            editableSkeletonRef.current.bones.forEach((bone) =>
              bone.updateMatrixWorld(true),
            );
            const naturalSkelBBox = new THREE.Box3();
            editableSkeletonRef.current.bones.forEach((bone) => {
              const pos = new THREE.Vector3();
              bone.getWorldPosition(pos);
              naturalSkelBBox.expandByPoint(pos);
            });
            const naturalSkelSize = naturalSkelBBox.getSize(
              new THREE.Vector3(),
            );

            // Calculate skeleton scale to fit WITHIN mesh bounds
            const skeletonScaleX = finalMeshSize.x / naturalSkelSize.x;
            const skeletonScaleY = finalMeshSize.y / naturalSkelSize.y;
            const skeletonScaleZ = finalMeshSize.z / naturalSkelSize.z;
            const skeletonScaleFactor = Math.min(
              skeletonScaleX,
              skeletonScaleY,
              skeletonScaleZ,
            );

            // Apply the calculated scale
            rootBone.scale.set(
              skeletonScaleFactor,
              skeletonScaleFactor,
              skeletonScaleFactor,
            );
            rootBone.updateMatrixWorld(true);

            // Reposition skeleton to match preview mesh center
            editableSkeletonRef.current.bones.forEach((bone) =>
              bone.updateMatrixWorld(true),
            );
            const newSkelBBox = new THREE.Box3();
            editableSkeletonRef.current.bones.forEach((bone) => {
              const pos = new THREE.Vector3();
              bone.getWorldPosition(pos);
              newSkelBBox.expandByPoint(pos);
            });
            const newCenter = newSkelBBox.getCenter(new THREE.Vector3());
            const meshCenter = new THREE.Box3()
              .setFromObject(previewMesh)
              .getCenter(new THREE.Vector3());
            const offset = meshCenter.clone().sub(newCenter);
            rootBone.position.add(offset);
            rootBone.updateMatrixWorld(true);

            console.log("📐 Skeleton scale updated:", scale);
            console.log("  Mesh scale factor:", meshScaleFactor);
            console.log(
              "  Skeleton scale factor:",
              skeletonScaleFactor,
              "(fits within mesh bounds)",
            );
          }
        },
      }),
      [
        animations,
        assetInfo,
        exportTPoseModel,
        showSkeleton,
        boneTransformModeState,
        boneTransformSpaceState,
      ],
    );

    // Initialize Three.js scene with professional setup

    useEffect(() => {
      console.log("🎬 ThreeViewer mounting...");
      mountedRef.current = true;

      if (!containerRef.current) return;

      const containerEl = containerRef.current;
      // Guard against zero-sized container (e.g., when hidden)
      const initialWidth = Math.max(1, containerRef.current.clientWidth || 0);
      const initialHeight = Math.max(1, containerRef.current.clientHeight || 0);
      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(
        isLightBackground ? "#e8e8e8" : "#0a0a0a",
      );
      scene.fog = new THREE.Fog(scene.background, 50, 100);
      sceneRef.current = scene;

      // Camera setup
      const camera = new THREE.PerspectiveCamera(
        45,
        initialWidth / initialHeight,
        0.01,
        1e6,
      );
      camera.position.set(10, 10, 10);
      cameraRef.current = camera;

      // Renderer setup with high quality settings
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      // Cap pixel ratio in light mode for perf
      const maxPixelRatio = lightMode ? 1 : 2;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
      renderer.setSize(initialWidth, initialHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Post-processing setup (always create composer as in the working version)
      const composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const ssaoPass = new SSAOPass(scene, camera, initialWidth, initialHeight);
      // Balanced defaults
      ssaoPass.kernelRadius = 12;
      ssaoPass.minDistance = 0.001;
      ssaoPass.maxDistance = 0.08;
      composer.addPass(ssaoPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(initialWidth, initialHeight),
        0.4,
        0.35,
        0.85,
      );
      composer.addPass(bloomPass);

      composerRef.current = composer;

      // Controls setup with damping
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controls.minDistance = 0.1;
      controls.maxDistance = 100;
      controls.maxPolarAngle = Math.PI * 0.95;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 2;
      controlsRef.current = controls;

      // Transform controls for bone editing - create fresh each time
      const tControls = new TransformControls(camera, renderer.domElement);
      tControls.enabled = false; // Start disabled, enable only when user clicks "Enable Bone Editing"
      tControls.size = 1.0; // Will be scaled based on model size when bone is selected
      (tControls as unknown as THREE.Object3D).frustumCulled = false;
      tControls.setMode("translate"); // 3-axis gizmo with directional arrows
      tControls.setSpace("local"); // Use local space for bone editing
      // Ensure all 3 axes (X/Y/Z arrows) are enabled
      tControls.showX = true;
      tControls.showY = true;
      tControls.showZ = true;

      tControls.addEventListener("dragging-changed", (event: any) => {
        const isDragging = event.value;
        controls.enabled = !isDragging;

        console.log(
          `[drag] ${isDragging ? "🎯 Started" : "✅ Stopped"} dragging bone`,
        );
        console.log("  - OrbitControls enabled:", controls.enabled);
        console.log("  - TransformControls enabled:", tControls.enabled);

        if (!isDragging) {
          // Update skeleton helper after drag completes
          if (skeletonHelperRef.current) {
            skeletonHelperRef.current.updateMatrixWorld(true);
          }
        }
      });

      // Helper: Apply mirror mode (from Mesh2Motion)
      const applyMirrorMode = (
        selectedBone: THREE.Bone,
        transformMode: "translate" | "rotate",
      ) => {
        if (!editingSkeletonRootRef.current) return;

        // Calculate base bone name (strip L/R suffixes and prefixes)
        // Handle patterns: boneName.L, boneName.R, boneNameL, boneNameR, L_boneName, R_boneName, etc.
        const baseName = selectedBone.name
          .replace(/[_\-.]?(l|r|left|right)$/i, "") // Remove suffix
          .replace(/^(l|r|left|right)[_\-.]?/i, "") // Remove prefix
          .toLowerCase();

        // Determine if this is a left or right bone
        const isLeft = /[_\-.]?(l|left)[_\-.]?/i.test(selectedBone.name);
        const isRight = /[_\-.]?(r|right)[_\-.]?/i.test(selectedBone.name);

        if (!isLeft && !isRight) {
          console.log(
            `[mirror] ${selectedBone.name} is not a left/right bone (center bone), skipping`,
          );
          return; // Center bone, no mirror
        }

        // Find mirror bone
        let mirrorBone: THREE.Bone | undefined;
        const allBones: THREE.Bone[] = [];
        editingSkeletonRootRef.current.traverse((child) => {
          if (child instanceof THREE.Bone) allBones.push(child);
        });

        for (const bone of allBones) {
          if (bone === selectedBone) continue;

          const boneBaseName = bone.name
            .replace(/[_\-.]?(l|r|left|right)$/i, "")
            .replace(/^(l|r|left|right)[_\-.]?/i, "")
            .toLowerCase();

          // Must have same base name but opposite side
          const boneIsLeft = /[_\-.]?(l|left)[_\-.]?/i.test(bone.name);
          const boneIsRight = /[_\-.]?(r|right)[_\-.]?/i.test(bone.name);

          if (
            boneBaseName === baseName &&
            ((isLeft && boneIsRight) || (isRight && boneIsLeft))
          ) {
            mirrorBone = bone;
            break;
          }
        }

        if (!mirrorBone) {
          console.log(`[mirror] No mirror bone found for ${selectedBone.name}`);
          return;
        }

        if (transformMode === "translate") {
          mirrorBone.position.set(
            -selectedBone.position.x,
            selectedBone.position.y,
            selectedBone.position.z,
          );
        } else if (transformMode === "rotate") {
          const euler = new THREE.Euler(
            selectedBone.rotation.x,
            -selectedBone.rotation.y,
            -selectedBone.rotation.z,
          );
          mirrorBone.quaternion.setFromEuler(euler);
        }

        mirrorBone.updateMatrix();
        mirrorBone.updateMatrixWorld(true);

        console.log(
          `[mirror] ✅ Mirrored ${selectedBone.name} → ${mirrorBone.name}`,
        );
        console.log(`[mirror]   Transform: ${transformMode}`);
        if (transformMode === "translate") {
          console.log(
            `[mirror]   Position: (${mirrorBone.position.x.toFixed(3)}, ${mirrorBone.position.y.toFixed(3)}, ${mirrorBone.position.z.toFixed(3)})`,
          );
        } else {
          console.log(
            `[mirror]   Rotation: (${mirrorBone.rotation.x.toFixed(3)}, ${mirrorBone.rotation.y.toFixed(3)}, ${mirrorBone.rotation.z.toFixed(3)})`,
          );
        }
        // Note: We're editing overlay skeleton, so mesh won't deform
      };

      // Store function in ref so it can be called from imperative handle
      applyMirrorModeRef.current = applyMirrorMode;

      // When bone is dragged, sync the actual rig bones (Mesh2Motion pattern)
      tControls.addEventListener("change", () => {
        console.log("[bone-edit] Change event fired");
        console.log(
          "[bone-edit] Reading ref directly inside listener:",
          boneMirrorEnabledRef,
        );
        console.log(
          "[bone-edit] Reading ref.current:",
          boneMirrorEnabledRef.current,
        );

        if (!selectedBoneRef.current) {
          console.log("[bone-edit] No selected bone");
          return;
        }

        const draggedBone = selectedBoneRef.current;
        console.log(
          `[bone-edit] Editing overlay bone: ${draggedBone.name}, position:`,
          draggedBone.position.toArray(),
        );

        // We're editing the OVERLAY skeleton (not bound to mesh)
        // So the mesh won't deform - perfect!
        // The TransformControls already updated the bone's local transform

        // Update skeleton helper visualization to show new bone positions
        if (skeletonHelperRef.current) {
          skeletonHelperRef.current.updateMatrixWorld(true);
        }

        // Apply mirror mode if enabled (use refs to avoid stale closure values)
        console.log(
          `[bone-edit] Mirror check - enabled: ${boneMirrorEnabledRef.current}, bone: ${selectedBoneRef.current?.name}`,
        );
        if (boneMirrorEnabledRef.current && selectedBoneRef.current) {
          console.log(
            `[mirror] Attempting to mirror ${selectedBoneRef.current.name}...`,
          );
          applyMirrorMode(
            selectedBoneRef.current,
            boneTransformModeStateRef.current,
          );
        } else {
          if (!boneMirrorEnabledRef.current) {
            console.log(`[mirror] Skipped - mirror mode disabled`);
          }
          if (!selectedBoneRef.current) {
            console.log(`[mirror] Skipped - no bone selected`);
          }
        }
      });

      // Add TransformControls to scene
      // CRITICAL: Cast to any first, then to Object3D to satisfy TypeScript
      // TransformControls extends Object3D but TypeScript doesn't know that
      const tControlsObj = tControls as any as THREE.Object3D;
      scene.add(tControlsObj);
      transformControlsRef.current = tControls;

      console.log("✅ TransformControls initialized and added to scene");
      console.log("   TransformControls type:", tControls.constructor.name);
      console.log(
        "   TransformControls in scene:",
        scene.children.includes(tControlsObj),
      );
      console.log("   TransformControls enabled:", tControls.enabled);
      console.log("   TransformControls size:", tControls.size);
      console.log("   Scene children count:", scene.children.length);

      // Create bone highlight sphere (will be positioned on selected bone)
      const highlightSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          transparent: true,
          opacity: 0.6,
          depthTest: false,
          depthWrite: false,
        }),
      );
      highlightSphere.visible = false;
      highlightSphere.renderOrder = 998; // Render before gizmo
      scene.add(highlightSphere);
      boneHighlightSphereRef.current = highlightSphere;
      console.log("✅ Bone highlight sphere created");

      // Create labels group for bone names (will be populated when bones are visible)
      const labelsGroup = new THREE.Group();
      labelsGroup.name = "BoneLabels";
      scene.add(labelsGroup);
      boneLabelsGroupRef.current = labelsGroup;
      console.log("✅ Bone labels group created");

      // Professional lighting setup
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      ambientLight.name = "ambientLight";
      scene.add(ambientLight);

      // Key light
      const keyLight = new THREE.DirectionalLight(0xffffff, 1);
      keyLight.name = "keyLight";
      keyLight.position.set(5, 10, 5);
      keyLight.castShadow = true;
      keyLight.shadow.camera.near = 0.1;
      keyLight.shadow.camera.far = 50;
      keyLight.shadow.camera.left = -15;
      keyLight.shadow.camera.right = 15;
      keyLight.shadow.camera.top = 15;
      keyLight.shadow.camera.bottom = -15;
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.bias = -0.0005;
      scene.add(keyLight);

      // Fill light
      const fillLight = new THREE.DirectionalLight(0x4080ff, 0.5);
      fillLight.name = "fillLight";
      fillLight.position.set(-5, 5, -5);
      scene.add(fillLight);

      // Rim light
      const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
      rimLight.name = "rimLight";
      rimLight.position.set(0, 10, -10);
      scene.add(rimLight);

      // Animation loop
      const animate = () => {
        frameIdRef.current = requestAnimationFrame(animate);

        // Update animation mixer
        if (mixerRef.current && isPlaying) {
          mixerRef.current.update(clockRef.current?.getDelta() || 0);
        }

        // Update hand bone rotations for testing
        if (showHandControlsRef.current) {
          // Debug if we're even entering this block (use ref to avoid spam)
          if (!handControlsLoggedRef.current) {
            console.log("🚀 Hand controls ARE enabled in animation loop");
            console.log("  handBones:", handBonesRef.current);
            console.log("  handRotations:", handRotationsRef.current);
            handControlsLoggedRef.current = true;
          }

          // Debug rotation values every frame for now
          const currentRotation = handRotationsRef.current.leftPalm;
          if (
            currentRotation !== 0 &&
            !(window as ExtendedWindow)._rotationLogged
          ) {
            console.log(`🎯 Non-zero rotation detected!`);
            console.log(`  Bone exists: ${!!handBonesRef.current.leftPalm}`);
            console.log(`  Rotation value: ${currentRotation}°`);
            console.log(`  Axis: ${rotationAxisRef.current}`);
            (window as ExtendedWindow)._rotationLogged = true;
          }

          // Only log when rotation changes
          if (
            handRotationsRef.current.leftPalm !==
            prevHandRotationsRef.current.leftPalm
          ) {
            console.log(`🎯 Rotation CHANGED for leftPalm bone`);
            console.log(`  Old: ${prevHandRotationsRef.current.leftPalm}°`);
            console.log(`  New: ${handRotationsRef.current.leftPalm}°`);
            console.log(`  Axis: ${rotationAxisRef.current}`);

            // Check if the bone is in any skeleton
            if (handBonesRef.current.leftPalm && modelRef.current) {
              let foundInSkeleton = false;
              modelRef.current.traverse((child) => {
                if (child instanceof THREE.SkinnedMesh && child.skeleton) {
                  const boneIndex = child.skeleton.bones.indexOf(
                    handBonesRef.current.leftPalm!,
                  );
                  if (boneIndex !== -1) {
                    foundInSkeleton = true;
                    console.log(
                      `  ✓ Bone found in skeleton at index: ${boneIndex}`,
                    );
                    console.log(
                      `  Skeleton has ${child.skeleton.bones.length} bones total`,
                    );
                  }
                }
              });
              if (!foundInSkeleton) {
                console.log(`  ❌ Bone NOT found in any skeleton!`);
              }
            }

            prevHandRotationsRef.current = { ...handRotationsRef.current };
          }

          let needsSkeletonUpdate = false;

          if (handBonesRef.current.leftPalm) {
            // Clear previous rotations
            handBonesRef.current.leftPalm.rotation.set(0, 0, 0);
            // Apply rotation on selected axis
            const radians = (handRotationsRef.current.leftPalm * Math.PI) / 180;

            // Test with a more dramatic rotation
            if (rotationAxisRef.current === "x") {
              handBonesRef.current.leftPalm.rotation.x = radians;
            } else if (rotationAxisRef.current === "y") {
              handBonesRef.current.leftPalm.rotation.y = radians;
            } else if (rotationAxisRef.current === "z") {
              handBonesRef.current.leftPalm.rotation.z = radians;
            }

            // Force matrix update
            handBonesRef.current.leftPalm.updateMatrix();
            handBonesRef.current.leftPalm.updateMatrixWorld(true);

            // Debug current rotation (only once)
            const currentRot = handBonesRef.current.leftPalm.rotation;
            if (
              !(window as ExtendedWindow)._lastLoggedRotation ||
              (window as ExtendedWindow)._lastLoggedRotation !== radians
            ) {
              if (radians !== 0) {
                console.log(`  💫 Rotation applied to leftPalm!`);
                console.log(
                  `    Slider value: ${handRotationsRef.current.leftPalm}°`,
                );
                console.log(`    Radians: ${radians.toFixed(3)}`);
                console.log(`    Axis: ${rotationAxisRef.current}`);
                console.log(
                  `    Bone rotation: x=${currentRot.x.toFixed(3)}, y=${currentRot.y.toFixed(3)}, z=${currentRot.z.toFixed(3)}`,
                );
                (window as ExtendedWindow)._lastLoggedRotation = radians;
              } else {
                // Reset when at 0
                (window as ExtendedWindow)._lastLoggedRotation = 0;
              }
            }

            needsSkeletonUpdate = true;
          }
          if (handBonesRef.current.leftFingers) {
            // Clear previous rotations
            handBonesRef.current.leftFingers.rotation.set(0, 0, 0);
            // Apply rotation on selected axis
            handBonesRef.current.leftFingers.rotation[rotationAxisRef.current] =
              (handRotationsRef.current.leftFingers * Math.PI) / 180;
            handBonesRef.current.leftFingers.updateMatrixWorld(true);
            needsSkeletonUpdate = true;
          }
          if (handBonesRef.current.rightPalm) {
            // Clear previous rotations
            handBonesRef.current.rightPalm.rotation.set(0, 0, 0);
            // Apply rotation on selected axis (mirrored for right hand on Z)
            const multiplier = rotationAxisRef.current === "z" ? -1 : 1;
            handBonesRef.current.rightPalm.rotation[rotationAxisRef.current] =
              ((handRotationsRef.current.rightPalm * Math.PI) / 180) *
              multiplier;
            handBonesRef.current.rightPalm.updateMatrixWorld(true);
            needsSkeletonUpdate = true;
          }
          if (handBonesRef.current.rightFingers) {
            // Clear previous rotations
            handBonesRef.current.rightFingers.rotation.set(0, 0, 0);
            // Apply rotation on selected axis (mirrored for right hand on Z)
            const multiplier = rotationAxisRef.current === "z" ? -1 : 1;
            handBonesRef.current.rightFingers.rotation[
              rotationAxisRef.current
            ] =
              ((handRotationsRef.current.rightFingers * Math.PI) / 180) *
              multiplier;
            handBonesRef.current.rightFingers.updateMatrixWorld(true);
            needsSkeletonUpdate = true;
          }

          // Force update all skeletons if any bones were rotated
          if (needsSkeletonUpdate && modelRef.current) {
            // Only log once per rotation change
            const currentRotationSum =
              handRotationsRef.current.leftPalm +
              handRotationsRef.current.leftFingers +
              handRotationsRef.current.rightPalm +
              handRotationsRef.current.rightFingers;
            if (
              !(window as ExtendedWindow)._skeletonUpdateLogged ||
              (window as ExtendedWindow)._lastSkeletonRotation !==
                currentRotationSum
            ) {
              console.log("📐 Updating skeleton after rotation");
              (window as ExtendedWindow)._skeletonUpdateLogged = true;
              (window as ExtendedWindow)._lastSkeletonRotation =
                currentRotationSum;
            }

            modelRef.current.traverse((child) => {
              if (child instanceof THREE.SkinnedMesh && child.skeleton) {
                // Update all bone matrices
                child.skeleton.bones.forEach((bone) => {
                  bone.updateMatrixWorld(true);
                });
                // Update the skeleton
                child.skeleton.update();

                // Skeleton bind mode and bone count are correct

                // Force the skinned mesh to update
                child.updateMatrix();
                child.updateMatrixWorld(true);

                // Force geometry update
                child.geometry.computeBoundingSphere();
                child.geometry.computeBoundingBox();
              }
            });

            // Update skeleton helper (CustomSkeletonHelper updates automatically via updateMatrixWorld)
            if (skeletonHelperRef.current) {
              skeletonHelperRef.current.updateMatrixWorld(true);
            }
          }
        }

        // Update bone highlight sphere to follow selected bone
        if (
          boneHighlightSphereRef.current &&
          boneHighlightSphereRef.current.visible &&
          selectedBoneRef.current
        ) {
          const worldPos = new THREE.Vector3();
          selectedBoneRef.current.getWorldPosition(worldPos);
          boneHighlightSphereRef.current.position.copy(worldPos);
        }

        controls.update();

        // Render with composer if available, otherwise use raw renderer
        if (composerRef.current) {
          composerRef.current.render();
        } else {
          renderer.render(scene, camera);
        }
      };
      animate();

      // Handle resize
      const handleResize = () => {
        if (!containerRef.current) return;
        // Avoid zero-size which breaks WebGL framebuffers
        const width = Math.max(1, containerRef.current.clientWidth || 0);
        const height = Math.max(1, containerRef.current.clientHeight || 0);

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
        if (composerRef.current) {
          composerRef.current.setSize(width, height);
        }

        // SSAO pass will automatically resize with composer
        if (shouldReframeOnResizeRef.current) {
          // Reframe once after first non-zero resize
          shouldReframeOnResizeRef.current = false;
          requestAnimationFrame(() => frameCameraToCurrentModel());
        }
      };

      // Debounced resize to avoid rapid target reallocations
      let resizeTimeout: number | null = null;
      const debouncedResize = () => {
        if (resizeTimeout) cancelAnimationFrame(resizeTimeout);
        resizeTimeout = requestAnimationFrame(handleResize);
      };
      window.addEventListener("resize", debouncedResize);
      // Also observe element size changes (e.g., when toggling hidden/visible)
      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(containerEl);
      }

      // If we mounted with a tiny/hidden container, schedule a one-shot reframe
      if (initialWidth <= 1 || initialHeight <= 1) {
        shouldReframeOnResizeRef.current = true;
      }

      // Keyboard shortcuts
      const handleKeydown = (e: KeyboardEvent) => {
        switch (e.key.toLowerCase()) {
          case "f":
            if (modelRef.current && cameraRef.current && controlsRef.current) {
              // Focus on model with proper framing
              const box = new THREE.Box3().setFromObject(modelRef.current);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());

              // Calculate distance based on FOV and model size
              const fov = cameraRef.current.fov * (Math.PI / 180);
              const cameraAspect = cameraRef.current.aspect;

              let distance;
              if (size.y / size.x > cameraAspect) {
                distance = (size.y * 1.5) / (2 * Math.tan(fov / 2));
              } else {
                const hFov = 2 * Math.atan(Math.tan(fov / 2) * cameraAspect);
                distance = (size.x * 1.5) / (2 * Math.tan(hFov / 2));
              }

              // Use more padding for smaller objects
              const maxDim = Math.max(size.x, size.y, size.z);
              const paddingMultiplier = maxDim < 2 ? 2.5 : 2.0;
              distance *= paddingMultiplier;

              // Ensure minimum distance
              const minDistance = 8;
              distance = Math.max(distance, minDistance);

              controlsRef.current.target.copy(center);
              cameraRef.current.position.set(
                center.x + distance * 0.7,
                center.y + distance * 0.5,
                center.z + distance * 0.7,
              );
              controlsRef.current.update();
            }
            break;
          case "r":
            if (controlsRef.current && modelRef.current && cameraRef.current) {
              // Reset with proper framing
              const box = new THREE.Box3().setFromObject(modelRef.current);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());

              const fov = cameraRef.current.fov * (Math.PI / 180);
              const cameraAspect = cameraRef.current.aspect;

              let distance;
              if (size.y / size.x > cameraAspect) {
                distance = (size.y * 1.2) / (2 * Math.tan(fov / 2));
              } else {
                const hFov = 2 * Math.atan(Math.tan(fov / 2) * cameraAspect);
                distance = (size.x * 1.2) / (2 * Math.tan(hFov / 2));
              }

              distance *= 1.5;

              controlsRef.current.target.copy(center);
              cameraRef.current.position.set(
                center.x + distance * 0.7,
                center.y + distance * 0.5,
                center.z + distance * 0.7,
              );
              controlsRef.current.update();
            }
            break;
          case "g":
            setShowGrid((prev) => !prev);
            break;
          case "b":
            setShowBounds((prev) => !prev);
            break;
          case "s":
            setShowStats((prev) => !prev);
            break;
          case "a":
            setAutoRotate((prev) => !prev);
            break;
          case "h":
            if (Object.keys(handBones).length > 0) {
              setShowHandControls((prev) => !prev);
            }
            break;
          case "1":
            // Front view
            if (cameraRef.current && controlsRef.current && modelRef.current) {
              const box = new THREE.Box3().setFromObject(modelRef.current);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());

              const fov = cameraRef.current.fov * (Math.PI / 180);
              const cameraAspect = cameraRef.current.aspect;

              let distance;
              if (size.y / size.x > cameraAspect) {
                distance = (size.y * 1.5) / (2 * Math.tan(fov / 2));
              } else {
                const hFov = 2 * Math.atan(Math.tan(fov / 2) * cameraAspect);
                distance = (size.x * 1.5) / (2 * Math.tan(hFov / 2));
              }

              // Use more padding for smaller objects
              const maxDim = Math.max(size.x, size.y, size.z);
              const paddingMultiplier = maxDim < 2 ? 2.5 : 2.0;
              distance *= paddingMultiplier;

              // Ensure minimum distance
              const minDistance = 8;
              distance = Math.max(distance, minDistance);

              cameraRef.current.position.set(
                center.x,
                center.y,
                center.z + distance,
              );
              controlsRef.current.target.copy(center);
              controlsRef.current.update();
            }
            break;
          case "2":
            // Side view
            if (cameraRef.current && controlsRef.current && modelRef.current) {
              const box = new THREE.Box3().setFromObject(modelRef.current);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());

              const fov = cameraRef.current.fov * (Math.PI / 180);
              const cameraAspect = cameraRef.current.aspect;

              let distance;
              if (size.y / size.z > cameraAspect) {
                distance = (size.y * 1.5) / (2 * Math.tan(fov / 2));
              } else {
                const hFov = 2 * Math.atan(Math.tan(fov / 2) * cameraAspect);
                distance = (size.z * 1.5) / (2 * Math.tan(hFov / 2));
              }

              // Use more padding for smaller objects
              const maxDim = Math.max(size.x, size.y, size.z);
              const paddingMultiplier = maxDim < 2 ? 2.5 : 2.0;
              distance *= paddingMultiplier;

              // Ensure minimum distance
              const minDistance = 8;
              distance = Math.max(distance, minDistance);

              cameraRef.current.position.set(
                center.x + distance,
                center.y,
                center.z,
              );
              controlsRef.current.target.copy(center);
              controlsRef.current.update();
            }
            break;
          case "3":
          case "t":
            // Top view
            if (cameraRef.current && controlsRef.current && modelRef.current) {
              const box = new THREE.Box3().setFromObject(modelRef.current);
              const center = box.getCenter(new THREE.Vector3());
              const size = box.getSize(new THREE.Vector3());
              const maxDim = Math.max(size.x, size.y, size.z);

              cameraRef.current.position.set(
                center.x,
                center.y + maxDim * 2,
                center.z,
              );
              controlsRef.current.target.copy(center);
              controlsRef.current.update();
            }
            break;
          case "?":
          case "/":
            if (!isAnimationPlayer) {
              setShowShortcuts((prev) => !prev);
            }
            break;
          case "Escape":
            if (showShortcuts) {
              setShowShortcuts(false);
            }
            break;
        }
      };
      window.addEventListener("keydown", handleKeydown);

      return () => {
        console.log("🧹 ThreeViewer unmounting...");
        if (resizeTimeout) cancelAnimationFrame(resizeTimeout);
        window.removeEventListener("resize", debouncedResize);
        window.removeEventListener("keydown", handleKeydown);
        if (resizeObserver) resizeObserver.disconnect();
        if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
        renderer.dispose();
        if (composerRef.current) composerRef.current.dispose();
        controls.dispose();
        if (containerEl && renderer.domElement) {
          containerEl.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update refs when state changes
    useEffect(() => {
      showHandControlsRef.current = showHandControls;
      // Reset the logged flag when hand controls are re-enabled
      if (showHandControls) {
        handControlsLoggedRef.current = false;
        (window as ExtendedWindow)._rotationLogged = false;
      }
    }, [showHandControls]);

    useEffect(() => {
      handBonesRef.current = handBones;
    }, [handBones]);

    useEffect(() => {
      handRotationsRef.current = handRotations;
    }, [handRotations]);

    useEffect(() => {
      rotationAxisRef.current = rotationAxis;
    }, [rotationAxis]);

    // Update background and environment lighting
    useEffect(() => {
      if (!sceneRef.current) return;

      const env = ENVIRONMENTS[currentEnvironment];
      const color = new THREE.Color(
        isLightBackground ? "#e8e8e8" : env.bgColor,
      );
      sceneRef.current.background = color;
      sceneRef.current.fog = new THREE.Fog(color, 50, 100);

      // Adjust renderer exposure for light mode
      if (rendererRef.current) {
        rendererRef.current.toneMappingExposure = isLightBackground ? 0.7 : 1;
      }
    }, [isLightBackground, currentEnvironment]);

    // Apply environment lighting
    useEffect(() => {
      if (!sceneRef.current) return;

      const env = ENVIRONMENTS[currentEnvironment];

      // Reduce intensity in light mode
      const lightModeFactor = isLightBackground ? 0.6 : 1;

      // Update ambient light
      const ambientLight = sceneRef.current.getObjectByName(
        "ambientLight",
      ) as THREE.AmbientLight;
      if (ambientLight) {
        ambientLight.color = new THREE.Color(env.ambientColor);
        ambientLight.intensity = env.ambientIntensity * lightModeFactor;
      }

      // Update key light
      const keyLight = sceneRef.current.getObjectByName(
        "keyLight",
      ) as THREE.DirectionalLight;
      if (keyLight) {
        keyLight.color = new THREE.Color(env.keyLightColor);
        keyLight.intensity = env.keyLightIntensity * lightModeFactor * 0.8;
      }

      // Update fill light
      const fillLight = sceneRef.current.getObjectByName(
        "fillLight",
      ) as THREE.DirectionalLight;
      if (fillLight) {
        fillLight.color = new THREE.Color(env.fillLightColor);
        fillLight.intensity = env.fillLightIntensity * lightModeFactor * 0.7;
      }

      // Update rim light
      const rimLight = sceneRef.current.getObjectByName(
        "rimLight",
      ) as THREE.DirectionalLight;
      if (rimLight) {
        rimLight.color = new THREE.Color(env.rimLightColor);
        rimLight.intensity = env.rimLightIntensity * lightModeFactor * 0.6;
      }

      // Update SSAO intensity for light mode
      if (composerRef.current) {
        const ssaoPass = composerRef.current.passes.find(
          (pass) => pass instanceof SSAOPass,
        ) as SSAOPass;
        if (ssaoPass) {
          ssaoPass.minDistance = isLightBackground ? 0.002 : 0.001;
          ssaoPass.maxDistance = isLightBackground ? 0.05 : 0.1;
        }
      }
    }, [currentEnvironment, isLightBackground]);

    // Update auto-rotate
    useEffect(() => {
      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotate;
      }
    }, [autoRotate]);

    // Load model
    useEffect(() => {
      if (!modelUrl || !sceneRef.current) return;

      // Prevent loading the same model twice
      if (currentModelUrlRef.current === modelUrl) {
        console.log(`🚫 Model already loaded/loading: ${modelUrl}`);
        return;
      }

      // Reset reference scale when loading a new model (different character)
      if (!assetInfo?.isAnimationFile) {
        referenceScaleRef.current = null;
        console.log("🔄 Reset reference scale for new asset");
      }

      currentModelUrlRef.current = modelUrl;
      setLoading(true);
      setLoadingProgress(0);

      console.log(`🎬 Starting model load: ${modelUrl}`);

      const loader = new GLTFLoader();

      // Function to load the model
      const loadModel = (fileSize?: number) => {
        // Store skeleton state before cleanup
        const wasShowingSkeleton = showSkeleton;

        // Clean up ALL previous models more thoroughly
        if (sceneRef.current) {
          console.log("=== Model Cleanup Starting ===");

          // First, let's see what's actually in the scene
          const allMeshes: string[] = [];
          sceneRef.current.traverse((child) => {
            if (
              child instanceof THREE.Mesh ||
              child instanceof THREE.SkinnedMesh ||
              child instanceof THREE.Group
            ) {
              allMeshes.push(`${child.type}: ${child.name || "unnamed"}`);
            }
          });
          console.log(
            `Scene contents before cleanup: ${allMeshes.length} objects`,
          );
          allMeshes.forEach((m) => console.log(`  - ${m}`));

          // Remove all objects that aren't lights, helpers, or the ground plane
          const objectsToRemove: THREE.Object3D[] = [];
          sceneRef.current.traverse((child) => {
            if (
              child.type === "Mesh" ||
              child.type === "Group" ||
              child.type === "SkinnedMesh"
            ) {
              // Don't remove ground plane, grid, or debug objects
              if (
                child.name !== "groundPlane" &&
                child.name !== "TestCube" &&
                child !== gridRef.current
              ) {
                objectsToRemove.push(child);
              }
            }
          });

          console.log(`Removing ${objectsToRemove.length} objects from scene`);
          objectsToRemove.forEach((obj, i) => {
            console.log(
              `  Removing ${i}: ${obj.type} "${obj.name || "unnamed"}"`,
            );
            // Remove from parent instead of scene to handle nested objects
            if (obj.parent) {
              obj.parent.remove(obj);
            }
            // Dispose of geometries and materials
            if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
              obj.geometry?.dispose();
              if (Array.isArray(obj.material)) {
                obj.material.forEach((mat) => mat.dispose());
              } else {
                obj.material?.dispose();
              }
            }
          });

          console.log("=== Model Cleanup Complete ===");

          // Clear refs
          modelRef.current = null;

          // Clear animations when switching models
          setAnimations([]);
          setCurrentAnimation(-1);
          setIsPlaying(false);

          // Reset rigged model state
          setHasRiggedModel(false);

          // Reset hand bone states
          setHandBones({});
          setHandRotations({
            leftPalm: 0,
            leftFingers: 0,
            rightPalm: 0,
            rightFingers: 0,
          });
          setShowHandControls(false);
          setRotationAxis("x");

          // Remove skeleton helper if present
          if (skeletonHelperRef.current && sceneRef.current) {
            sceneRef.current.remove(skeletonHelperRef.current);
            skeletonHelperRef.current = null;
            // Don't reset showSkeleton here - we'll restore it after loading
          }

          // Stop and clear animations completely
          if (mixerRef.current) {
            mixerRef.current.stopAllAction();
            mixerRef.current.uncacheRoot(mixerRef.current.getRoot());
            mixerRef.current = null;
          }
          if (clockRef.current) {
            clockRef.current = null;
          }

          // Remove bounding box
          const existingBox = sceneRef.current.getObjectByName("boundingBox");
          if (existingBox) {
            sceneRef.current.remove(existingBox);
          }
        }

        loader.load(
          modelUrl,
          (gltf) => {
            const model = gltf.scene;

            // GLTF scenes sometimes have weird nested scales - let's normalize them
            console.log("🎯 GLTF scene loaded, checking for scale issues...");

            // IMPORTANT: DON'T reset the scene scale!
            // The scale is intentional and affects the retargeting workflow
            // If we reset it, the preview mesh will be too small
            console.log(
              `  Scene scale: (${model.scale.x}, ${model.scale.y}, ${model.scale.z})`,
            );
            // DON'T DO THIS: model.scale.set(1, 1, 1)

            // Update matrices before we start
            model.updateMatrixWorld(true);

            console.log(`Loading model from: ${modelUrl}`);
            console.log(`Model children count: ${model.children.length}`);
            console.log(
              `Model initial scale: x=${model.scale.x}, y=${model.scale.y}, z=${model.scale.z}`,
            );
            console.log(
              `Model initial position: x=${model.position.x}, y=${model.position.y}, z=${model.position.z}`,
            );
            console.log(
              `Model initial rotation: x=${model.rotation.x}, y=${model.rotation.y}, z=${model.rotation.z}`,
            );

            // Debug: Traverse entire hierarchy to find scale issues (disabled for performance)
            const debugScaleIssues = false; // Set to true to enable verbose scale logging
            if (debugScaleIssues) {
              console.log("🔍 Full hierarchy inspection:");
              const inspectHierarchy = (
                obj: THREE.Object3D,
                depth: number = 0,
              ) => {
                const indent = "  ".repeat(depth);
                const worldScale = new THREE.Vector3();
                obj.getWorldScale(worldScale);
                console.log(
                  `${indent}${obj.type} "${obj.name}": localScale=(${obj.scale.x.toFixed(3)}, ${obj.scale.y.toFixed(3)}, ${obj.scale.z.toFixed(3)}), worldScale=(${worldScale.x.toFixed(3)}, ${worldScale.y.toFixed(3)}, ${worldScale.z.toFixed(3)})`,
                );

                // Check for any scale in the matrix
                if (obj.matrix) {
                  const matrixScale = new THREE.Vector3();
                  const pos = new THREE.Vector3();
                  const quat = new THREE.Quaternion();
                  obj.matrix.decompose(pos, quat, matrixScale);
                  if (
                    Math.abs(matrixScale.x - 1) > 0.001 ||
                    Math.abs(matrixScale.y - 1) > 0.001 ||
                    Math.abs(matrixScale.z - 1) > 0.001
                  ) {
                    console.log(
                      `${indent}  ⚠️ Matrix has scale: (${matrixScale.x.toFixed(3)}, ${matrixScale.y.toFixed(3)}, ${matrixScale.z.toFixed(3)})`,
                    );
                  }
                }

                obj.children.forEach((child) =>
                  inspectHierarchy(child, depth + 1),
                );
              };
              inspectHierarchy(model);
            }

            // Fix any embedded scales in the model
            if (debugScaleIssues) {
              console.log("🔧 Checking for embedded scales to fix...");
            }

            // For animation files with tiny armature scales, we need visual compensation
            if (assetInfo?.isAnimationFile) {
              let visualCompensation = 1;
              model.traverse((child) => {
                if (child.name === "Armature" && child.scale.x < 0.02) {
                  console.log(
                    `⚠️ Found Armature with tiny scale: ${child.scale.x}`,
                  );
                  // Calculate how much we need to scale up visually
                  visualCompensation = 1 / child.scale.x;
                  console.log(
                    `📏 Visual compensation needed: ${visualCompensation}x`,
                  );
                }
              });

              // Store the compensation factor for later use
              if (visualCompensation > 1) {
                model.userData.visualCompensation = visualCompensation;
                console.log(
                  `💾 Stored visual compensation factor: ${visualCompensation}`,
                );
              }
            } else {
              // For non-animation models, fix any weird scales
              if (debugScaleIssues) {
                console.log("  Checking for other scales to fix");
              }
              model.traverse((child) => {
                if (
                  child.scale.x !== 1 ||
                  child.scale.y !== 1 ||
                  child.scale.z !== 1
                ) {
                  if (debugScaleIssues) {
                    console.log(
                      `  Found scale on ${child.type} "${child.name}": (${child.scale.x}, ${child.scale.y}, ${child.scale.z})`,
                    );
                  }
                  // Only reset scales on non-animated models
                  if (
                    !(child instanceof THREE.Bone) &&
                    child.name !== "Armature"
                  ) {
                    if (debugScaleIssues) {
                      console.log(`  Resetting to (1, 1, 1)`);
                    }
                    child.scale.set(1, 1, 1);
                  }
                }
              });
            }

            // Force update after any changes
            model.updateMatrixWorld(true);

            // List mesh info
            if (debugScaleIssues) {
              model.traverse((child) => {
                if (
                  child instanceof THREE.Mesh ||
                  child instanceof THREE.SkinnedMesh
                ) {
                  console.log(
                    `  - ${child.type}: ${child.name || "unnamed"} (scale: ${child.scale.x}, ${child.scale.y}, ${child.scale.z})`,
                  );
                }
              });
            }

            // Ensure all matrices are initialized before calculating bounding box
            model.traverse((child) => {
              if (child.matrixWorld) {
                child.updateMatrixWorld(true);
              }
            });

            // Get initial bounding box for scaling calculations
            let box: THREE.Box3;
            let size: THREE.Vector3;

            try {
              box = new THREE.Box3().setFromObject(model);
              size = box.getSize(new THREE.Vector3());
            } catch (error) {
              console.warn(
                "Error calculating bounding box, using fallback:",
                error,
              );
              // Fallback: manually calculate from mesh vertices
              box = new THREE.Box3();
              model.traverse((child) => {
                if (
                  child instanceof THREE.Mesh ||
                  child instanceof THREE.SkinnedMesh
                ) {
                  if (child.geometry && child.geometry.attributes.position) {
                    const geometry = child.geometry;
                    geometry.computeBoundingBox();
                    if (geometry.boundingBox) {
                      box.union(geometry.boundingBox);
                    }
                  }
                }
              });
              size = box.getSize(new THREE.Vector3());
            }

            // Debug: Show raw bounding box BEFORE any transformations
            console.log(`📦 Raw bounding box (before scaling):`);
            console.log(
              `   Size: width=${size.x.toFixed(3)}, height=${size.y.toFixed(3)}, depth=${size.z.toFixed(3)}`,
            );

            const maxDim = Math.max(size.x, size.y, size.z);
            let scale = 5 / maxDim; // Default scaling

            // Special handling for animation files with character height
            if (assetInfo?.isAnimationFile && assetInfo?.characterHeight) {
              // Just scale to match target height - same as walking/running animations
              const currentHeight = size.y;
              const targetHeight = assetInfo.characterHeight;
              scale = targetHeight / currentHeight;

              console.log(`🎯 Animation file scaling:`);
              console.log(`   Current height: ${currentHeight.toFixed(3)}m`);
              console.log(`   Target height: ${targetHeight}m`);
              console.log(`   Scale factor: ${scale.toFixed(3)}`);
            } else if (!assetInfo?.isAnimationFile) {
              // For non-animation files, use the standard scaling
              scale = 5 / maxDim;
              console.log(
                `📐 Standard scaling: ${scale.toFixed(3)} (maxDim: ${maxDim.toFixed(3)})`,
              );
            }

            console.log(
              `🔢 About to apply scale: ${scale} to model with current scale (${model.scale.x}, ${model.scale.y}, ${model.scale.z})`,
            );

            // Store reference scale for animation files
            if (assetInfo?.isAnimationFile && !referenceScaleRef.current) {
              referenceScaleRef.current = {
                height: size.y * scale,
                scale: scale,
              };
              console.log(
                `💾 Stored reference scale: height=${(size.y * scale).toFixed(3)}m, scale=${scale.toFixed(3)}`,
              );
            }

            // Apply scale to model
            model.scale.multiplyScalar(scale);

            // Debug: Verify scale was applied
            console.log(
              `📏 Model scale after applying: x=${model.scale.x.toFixed(3)}, y=${model.scale.y.toFixed(3)}, z=${model.scale.z.toFixed(3)}`,
            );

            // Verify final size if animation file
            if (assetInfo?.isAnimationFile && assetInfo?.characterHeight) {
              model.updateMatrixWorld(true);
              try {
                const verifyBox = new THREE.Box3().setFromObject(model);
                const verifySize = verifyBox.getSize(new THREE.Vector3());
                console.log(
                  `✅ Final model height after scaling: ${verifySize.y.toFixed(3)}m (target: ${assetInfo.characterHeight}m)`,
                );
              } catch (error) {
                console.warn("Error verifying final model size:", error);
              }
            }

            // Force update of world matrix to ensure scale is applied
            model.updateMatrixWorld(true);

            // Now center the model AFTER scaling
            const scaledBox = new THREE.Box3().setFromObject(model);
            const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
            model.position.sub(scaledCenter);

            // Update world matrix again after repositioning
            model.updateMatrixWorld(true);

            // Debug: Check if children also got the scale
            if (debugScaleIssues) {
              console.log(`🔍 Checking scale propagation:`);
              model.traverse((child) => {
                if (
                  child instanceof THREE.Mesh ||
                  child instanceof THREE.SkinnedMesh
                ) {
                  const worldScale = new THREE.Vector3();
                  child.getWorldScale(worldScale);
                  console.log(
                    `   ${child.type} "${child.name}": worldScale=(${worldScale.x.toFixed(3)}, ${worldScale.y.toFixed(3)}, ${worldScale.z.toFixed(3)})`,
                  );
                }
              });
            }

            // Position model so it sits on the ground (y=0)
            box.setFromObject(model); // Recalculate after scaling
            const newCenter = box.getCenter(new THREE.Vector3());
            const minY = box.min.y;

            // Verify the scale was applied correctly
            const scaledSize = box.getSize(new THREE.Vector3());
            console.log(
              `📊 After scale applied - new size: ${scaledSize.x.toFixed(3)} x ${scaledSize.y.toFixed(3)} x ${scaledSize.z.toFixed(3)}`,
            );
            if (
              assetInfo?.isAnimationFile &&
              Math.abs(scaledSize.y - 1.7) > 0.1
            ) {
              console.warn(
                `⚠️ Scale application issue - expected ~1.7m height, got ${scaledSize.y.toFixed(3)}m`,
              );
            }

            // Recalculate final dimensions
            model.position.x = -newCenter.x;
            model.position.z = -newCenter.z;
            model.position.y = -minY; // This places the bottom of the model at y=0

            // Log final dimensions after all transformations
            const finalBox = new THREE.Box3().setFromObject(model);
            const finalSize = finalBox.getSize(new THREE.Vector3());
            console.log(
              `📐 Final model dimensions: ${finalSize.x.toFixed(3)} x ${finalSize.y.toFixed(3)} x ${finalSize.z.toFixed(3)}`,
            );

            // Count vertices, faces, and materials
            let vertices = 0;
            let faces = 0;
            const materials = new Set<THREE.Material>();
            let hasSkinnedMesh = false;
            const handBonesFound: typeof handBones = {};

            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                const geo = child.geometry;
                vertices += geo.attributes.position?.count || 0;
                if (geo.index) {
                  faces += geo.index.count / 3;
                } else {
                  faces += (geo.attributes.position?.count || 0) / 3;
                }

                if (child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach((mat) => materials.add(mat));
                  } else {
                    materials.add(child.material);
                  }
                }
              }

              // Check if we have a skinned mesh (rigged model)
              if (child instanceof THREE.SkinnedMesh) {
                hasSkinnedMesh = true;
                console.log(
                  `Found SkinnedMesh: ${child.name || "unnamed"}, bones: ${child.skeleton?.bones.length || 0}`,
                );

                // Look for hand bones we added
                if (child.skeleton) {
                  console.log("🔍 Searching for hand bones in skeleton...");
                  child.skeleton.bones.forEach((bone, index) => {
                    const boneName = bone.name;
                    const lowerName = boneName.toLowerCase();

                    // Debug log bones that might be hand bones
                    if (
                      boneName.includes("Hand") ||
                      boneName.includes("Palm") ||
                      boneName.includes("Finger")
                    ) {
                      console.log(`  Bone ${index}: ${boneName}`);
                    }

                    if (boneName.includes("_Palm")) {
                      console.log(`  ✓ Found palm bone: ${boneName}`);
                      if (lowerName.includes("left")) {
                        handBonesFound.leftPalm = bone;
                        console.log("    -> Assigned to leftPalm");
                      } else if (lowerName.includes("right")) {
                        handBonesFound.rightPalm = bone;
                        console.log("    -> Assigned to rightPalm");
                      }
                    } else if (boneName.includes("_Fingers")) {
                      console.log(`  ✓ Found fingers bone: ${boneName}`);
                      if (lowerName.includes("left")) {
                        handBonesFound.leftFingers = bone;
                        console.log("    -> Assigned to leftFingers");
                      } else if (lowerName.includes("right")) {
                        handBonesFound.rightFingers = bone;
                        console.log("    -> Assigned to rightFingers");
                      }
                    }
                  });
                }
              }
            });

            // Update hand bones state
            if (Object.keys(handBonesFound).length > 0) {
              console.log("Found hand bones:", Object.keys(handBonesFound));
              setHandBones(handBonesFound);
              // Don't automatically show hand controls - let user toggle it
              // setShowHandControls(true)
              // Enable skeleton view to see the bones
              setShowSkeleton(true);
            } else {
              setHandBones({});
              setShowHandControls(false);
            }

            // Update rigged model state
            setHasRiggedModel(hasSkinnedMesh);

            setModelInfo({
              vertices: Math.round(vertices),
              faces: Math.round(faces),
              materials: materials.size,
              fileSize: fileSize || 0,
            });

            // Pass model info to parent with file size
            if (onModelLoad) {
              onModelLoad({
                vertices: Math.round(vertices),
                faces: Math.round(faces),
                materials: materials.size,
                fileSize: fileSize,
              });
            }

            // Setup animations
            if (gltf.animations.length > 0) {
              // Check if we need to strip animations (for rigged models from Meshy)
              const shouldStripAnimations =
                assetInfo?.requiresAnimationStrip || false;
              const isAnimationFile = assetInfo?.isAnimationFile || false;

              if (shouldStripAnimations || isAnimationFile) {
                console.log(
                  "Animation file detected - setting up for T-pose display",
                );

                // Create mixer but don't play anything
                const mixer = new THREE.AnimationMixer(model);
                mixerRef.current = mixer;

                // Also ensure rigged model is detected for animation files
                setHasRiggedModel(true);

                if (isAnimationFile) {
                  // For animation files, store the embedded animation with a proper name
                  if (gltf.animations.length > 0) {
                    const animationClip = gltf.animations[0];

                    // Name the animation based on the file name
                    if (modelUrl.includes("walking.glb")) {
                      animationClip.name = "walking";
                    } else if (modelUrl.includes("running.glb")) {
                      animationClip.name = "running";
                    } else {
                      animationClip.name = "animation";
                    }

                    setAnimations([animationClip]);

                    // Important: Reset the model to bind pose (T-pose)
                    // Some GLTF files might have the model in an animated pose by default
                    model.traverse((child) => {
                      if (
                        child instanceof THREE.SkinnedMesh &&
                        child.skeleton
                      ) {
                        console.log(
                          `🦴 Resetting skeleton to bind pose for: ${child.name}`,
                        );

                        // Reset to bind pose
                        child.skeleton.pose();

                        // Force update the skeleton
                        child.skeleton.calculateInverses();
                        child.skeleton.computeBoneTexture();

                        // Update matrices
                        child.updateMatrix();
                        child.updateMatrixWorld(true);

                        console.log(
                          `   Bones: ${child.skeleton.bones.length}, Root: ${child.skeleton.bones[0]?.name || "unnamed"}`,
                        );

                        // Debug: Check T-pose bounding box
                        const tposeBox = new THREE.Box3().setFromObject(child);
                        const tposeSize = tposeBox.getSize(new THREE.Vector3());
                        console.log(
                          `   T-pose bounds: ${tposeSize.x.toFixed(3)} x ${tposeSize.y.toFixed(3)} x ${tposeSize.z.toFixed(3)}`,
                        );
                      }
                    });

                    // Force update the entire model after T-pose reset
                    model.updateMatrixWorld(true);

                    // Auto-play animations for animation files
                    if (!clockRef.current) {
                      clockRef.current = new THREE.Clock();
                    }

                    // For walking/running GLBs, auto-play their embedded animation
                    if (
                      modelUrl.includes("walking.glb") ||
                      modelUrl.includes("running.glb")
                    ) {
                      console.log(`Auto-playing animation for ${modelUrl}`);
                      const action = mixer.clipAction(animationClip);
                      action.reset();
                      action.setLoop(THREE.LoopRepeat, Infinity);
                      action.play();
                      setCurrentAnimation(0);
                      setIsPlaying(true);
                    }
                  } else {
                    setAnimations([]);
                  }
                } else {
                  // For regular rigged models, clear animations
                  setAnimations([]);
                  setCurrentAnimation(-1); // No animation playing by default
                }

                // Clear the animations from the GLTF to prevent any auto-play
                gltf.animations = [];
              } else {
                // Normal animation setup for non-rigged models
                const mixer = new THREE.AnimationMixer(model);
                mixerRef.current = mixer;
                setAnimations(gltf.animations);

                // Only auto-play if not being controlled by AnimationPlayer
                if (!assetInfo?.isAnimationFile) {
                  // Play first animation by default
                  const action = mixer.clipAction(gltf.animations[0]);
                  action.play();
                  setCurrentAnimation(0);
                }
              }
            } else {
              setAnimations([]);
              setCurrentAnimation(-1);
            }

            // Final safety check: Remove ANY existing models before adding the new one
            const existingModels: THREE.Object3D[] = [];
            sceneRef.current!.traverse((child) => {
              if (
                (child instanceof THREE.Group ||
                  child instanceof THREE.Mesh ||
                  child instanceof THREE.SkinnedMesh) &&
                child.name !== "groundPlane" &&
                child.parent === sceneRef.current
              ) {
                existingModels.push(child);
              }
            });

            if (existingModels.length > 0) {
              console.log(
                `⚠️ Found ${existingModels.length} existing models before adding new one! Removing them...`,
              );
              existingModels.forEach((obj) => {
                sceneRef.current!.remove(obj);
                // Also dispose of the object
                if (
                  obj instanceof THREE.Mesh ||
                  obj instanceof THREE.SkinnedMesh
                ) {
                  obj.geometry?.dispose();
                  if (Array.isArray(obj.material)) {
                    obj.material.forEach((mat) => mat.dispose());
                  } else {
                    obj.material?.dispose();
                  }
                }
              });
            }

            // Nuclear option: If we're loading an animation file, clear EVERYTHING except lights
            if (assetInfo?.isAnimationFile) {
              console.log("🔥 Nuclear cleanup for animation file...");
              const toRemove: THREE.Object3D[] = [];
              sceneRef.current!.children.forEach((child) => {
                if (
                  child.type !== "DirectionalLight" &&
                  child.type !== "AmbientLight" &&
                  child.type !== "HemisphereLight" &&
                  child.name !== "groundPlane"
                ) {
                  toRemove.push(child);
                }
              });
              toRemove.forEach((obj) => {
                sceneRef.current!.remove(obj);
                console.log(
                  `   Removed: ${obj.type} "${obj.name || "unnamed"}"`,
                );
              });
            }

            modelRef.current = model;
            sceneRef.current!.add(model);
            setLoading(false);

            // Force another matrix update after adding to scene
            model.updateMatrixWorld(true);

            // Debug: Check what's in the scene after adding the model
            console.log("=== After adding model to scene ===");
            const finalMeshes: string[] = [];
            sceneRef.current!.traverse((child) => {
              if (
                child instanceof THREE.Mesh ||
                child instanceof THREE.SkinnedMesh ||
                child instanceof THREE.Group
              ) {
                if (child.name !== "groundPlane") {
                  // Get world scale to see actual scale including parent transforms
                  const worldScale = new THREE.Vector3();
                  child.getWorldScale(worldScale);
                  finalMeshes.push(
                    `${child.type}: ${child.name || "unnamed"} (visible: ${child.visible}, worldScale: ${worldScale.x.toFixed(3)}, ${worldScale.y.toFixed(3)}, ${worldScale.z.toFixed(3)})`,
                  );
                }
              }
            });
            console.log(`Scene now contains ${finalMeshes.length} models:`);
            finalMeshes.forEach((m) => console.log(`  - ${m}`));

            // Debug: Check actual visible size
            if (modelRef.current) {
              const worldBox = new THREE.Box3().setFromObject(modelRef.current);
              const worldSize = worldBox.getSize(new THREE.Vector3());
              console.log(
                `🌍 World bounding box size: width=${worldSize.x.toFixed(3)}m, height=${worldSize.y.toFixed(3)}m, depth=${worldSize.z.toFixed(3)}m`,
              );

              // For animation files, also check the SkinnedMesh directly
              if (assetInfo?.isAnimationFile) {
                let skinnedMesh: THREE.SkinnedMesh | null = null;
                modelRef.current.traverse((child) => {
                  if (child instanceof THREE.SkinnedMesh && !skinnedMesh) {
                    skinnedMesh = child;
                  }
                });

                if (skinnedMesh) {
                  const meshBox = new THREE.Box3().setFromObject(skinnedMesh);
                  const meshSize = meshBox.getSize(new THREE.Vector3());
                  console.log(
                    `🦴 SkinnedMesh-only bounding box: width=${meshSize.x.toFixed(3)}m, height=${meshSize.y.toFixed(3)}m, depth=${meshSize.z.toFixed(3)}m`,
                  );

                  // Check if there's a mismatch
                  if (Math.abs(worldSize.y - meshSize.y) > 0.1) {
                    console.warn(
                      `⚠️ Size mismatch! Model reports ${worldSize.y.toFixed(3)}m but SkinnedMesh is ${meshSize.y.toFixed(3)}m`,
                    );
                  }
                }
              }
            }

            // Reapply viewer settings to new model
            // This ensures all viewer settings persist when switching assets:
            // - Wireframe mode
            // - Bounding box
            // - Grid (handled by separate effect)
            // - Stats display (handled by state)
            // - Auto-rotate (handled by controls)
            // - Environment lighting (handled by state)

            // Apply wireframe if enabled
            if (isWireframe) {
              model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach((mat) => {
                      mat.wireframe = true;
                    });
                  } else {
                    child.material.wireframe = true;
                  }
                }
              });
            }

            // Apply bounding box if enabled
            if (showBounds) {
              const box = new THREE.Box3().setFromObject(model);
              const helper = new THREE.Box3Helper(box, 0x00ff00);
              helper.name = "boundingBox";
              sceneRef.current!.add(helper);
            }

            // Restore skeleton helper if it was enabled
            if (wasShowingSkeleton) {
              console.log("🦴 Restoring skeleton helper...");

              // Find all SkinnedMesh objects in the model
              const skinnedMeshes: THREE.SkinnedMesh[] = [];
              model.traverse((child) => {
                if (child instanceof THREE.SkinnedMesh) {
                  skinnedMeshes.push(child);
                }
              });

              if (skinnedMeshes.length > 0) {
                // Create skeleton helper for the first skinned mesh with bones
                const meshWithBones = skinnedMeshes.find(
                  (mesh) => mesh.skeleton.bones.length > 0,
                );
                if (meshWithBones) {
                  const helper = new THREE.SkeletonHelper(model);
                  helper.visible = true;

                  // Make skeleton lines thicker and brighter for better visibility
                  const material = helper.material as THREE.LineBasicMaterial;
                  material.color = new THREE.Color(0x00ff00); // Bright green
                  material.linewidth = 3;
                  material.depthTest = true;
                  material.depthWrite = true;
                  material.transparent = true;
                  material.opacity = 1.0;

                  sceneRef.current!.add(helper);
                  skeletonHelperRef.current = helper;
                  setShowSkeleton(true);
                  // Ensure rigged model state is set
                  setHasRiggedModel(true);

                  // Make model semi-transparent with proper depth handling
                  model.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                      if (Array.isArray(child.material)) {
                        child.material.forEach((mat) => {
                          mat.transparent = true;
                          mat.opacity = 0.3; // More transparent to see bones better
                          mat.depthWrite = false; // Don't write to depth buffer when transparent
                        });
                      } else {
                        child.material.transparent = true;
                        child.material.opacity = 0.3;
                        child.material.depthWrite = false;
                      }
                    }
                  });
                  console.log(
                    `✅ Skeleton helper restored with ${meshWithBones.skeleton.bones.length} bones`,
                  );
                }
              }
            }

            // Auto-fit camera to model with better framing
            if (cameraRef.current && controlsRef.current) {
              // IMPORTANT: Recalculate bounding box AFTER all scaling and positioning
              const finalBox = new THREE.Box3().setFromObject(model);
              const finalCenter = finalBox.getCenter(new THREE.Vector3());
              const finalSize = finalBox.getSize(new THREE.Vector3());

              console.log(
                `📷 Camera framing: center=(${finalCenter.x.toFixed(2)}, ${finalCenter.y.toFixed(2)}, ${finalCenter.z.toFixed(2)}), size=(${finalSize.x.toFixed(2)}, ${finalSize.y.toFixed(2)}, ${finalSize.z.toFixed(2)})`,
              );

              // Compute camera distance to fit model regardless of aspect
              let distance = computeDistanceToFit(finalSize, cameraRef.current);

              // For smaller models (like characters), reduce minimum distance
              const maxDim = Math.max(finalSize.x, finalSize.y, finalSize.z);
              if (assetInfo?.isAnimationFile && maxDim < 3) {
                const characterMinDistance = 4;
                distance = Math.max(distance, characterMinDistance);
                console.log(
                  `📷 Using character minimum distance: ${characterMinDistance}m`,
                );
              }

              // Special handling for character models
              if (assetInfo?.isAnimationFile && assetInfo?.characterHeight) {
                // For a 1.7m character, we want the camera about 3-4m away
                const characterDistance = assetInfo.characterHeight * 2.5;
                distance = characterDistance;
                console.log(
                  `🎭 Character-specific camera distance: ${distance.toFixed(2)}m for ${assetInfo.characterHeight}m tall character`,
                );

                // Also adjust the camera height to frame the character better
                cameraRef.current.position.set(
                  finalCenter.x + distance * 0.5,
                  finalCenter.y + assetInfo.characterHeight * 0.3, // Look slightly above center
                  finalCenter.z + distance * 0.5,
                );
                cameraRef.current.lookAt(finalCenter);
                controlsRef.current.target.copy(finalCenter);
                controlsRef.current.update();
              } else {
                // Normal camera positioning
                console.log(
                  `📷 Camera distance: ${distance.toFixed(2)}m (maxDim: ${maxDim.toFixed(2)})`,
                );

                // Position camera at a nice angle
                cameraRef.current.position.set(
                  finalCenter.x + distance * 0.7,
                  finalCenter.y + distance * 0.5,
                  finalCenter.z + distance * 0.7,
                );
                cameraRef.current.lookAt(finalCenter);
                controlsRef.current.target.copy(finalCenter);
                controlsRef.current.update();
              }
            }

            // Final verification of model size
            setTimeout(() => {
              if (modelRef.current && sceneRef.current) {
                const finalWorldBox = new THREE.Box3().setFromObject(
                  modelRef.current,
                );
                const finalWorldSize = finalWorldBox.getSize(
                  new THREE.Vector3(),
                );
                const finalWorldCenter = finalWorldBox.getCenter(
                  new THREE.Vector3(),
                );

                console.log(`✅ FINAL VERIFICATION (after 100ms):`);
                console.log(
                  `   World size: ${finalWorldSize.x.toFixed(3)}m x ${finalWorldSize.y.toFixed(3)}m x ${finalWorldSize.z.toFixed(3)}m`,
                );
                console.log(
                  `   World center: (${finalWorldCenter.x.toFixed(3)}, ${finalWorldCenter.y.toFixed(3)}, ${finalWorldCenter.z.toFixed(3)})`,
                );
                console.log(
                  `   Camera position: (${cameraRef.current?.position.x.toFixed(2)}, ${cameraRef.current?.position.y.toFixed(2)}, ${cameraRef.current?.position.z.toFixed(2)})`,
                );
                console.log(
                  `   Controls target: (${controlsRef.current?.target.x.toFixed(2)}, ${controlsRef.current?.target.y.toFixed(2)}, ${controlsRef.current?.target.z.toFixed(2)})`,
                );

                // If target drifted to origin (or far from model center), recenter the view
                if (controlsRef.current && cameraRef.current) {
                  const target = controlsRef.current.target.clone();
                  const distanceFromCenter = target
                    .sub(finalWorldCenter)
                    .length();
                  if (distanceFromCenter > 0.5) {
                    console.warn(
                      "⚠️ Controls target off-center after load. Recentering on model.",
                    );
                    controlsRef.current.target.copy(finalWorldCenter);
                    cameraRef.current.lookAt(finalWorldCenter);
                    controlsRef.current.update();
                  }
                }

                // If the model is still tiny, try to fix it
                if (
                  assetInfo?.isAnimationFile &&
                  assetInfo?.characterHeight &&
                  finalWorldSize.y < assetInfo.characterHeight * 0.9
                ) {
                  console.error(
                    `❌ Model is still too small! Expected ${assetInfo.characterHeight}m, got ${finalWorldSize.y.toFixed(3)}m`,
                  );

                  // Force camera to look at the model properly
                  if (cameraRef.current && controlsRef.current) {
                    const distance = 5;
                    cameraRef.current.position.set(
                      finalWorldCenter.x + distance,
                      finalWorldCenter.y + 1,
                      finalWorldCenter.z + distance,
                    );
                    cameraRef.current.lookAt(finalWorldCenter);
                    controlsRef.current.target.copy(finalWorldCenter);
                    controlsRef.current.update();
                    console.log(
                      `🔧 Forced camera reposition to distance ${distance}m`,
                    );
                  }
                }

                // If the model appears too small or off-frame (common after hidden mount), reframe once
                const maxDim = Math.max(
                  finalWorldSize.x,
                  finalWorldSize.y,
                  finalWorldSize.z,
                );
                if (maxDim > 0) {
                  requestAnimationFrame(() => frameCameraToCurrentModel());
                }
              }
            }, 100);
          },
          (progress) => {
            if (progress && progress.total && progress.total > 0) {
              setLoadingProgress((progress.loaded / progress.total) * 100);
            }
          },
          (error) => {
            console.error("Error loading model:", error);
            setLoading(false);
            // Clear the current model URL on error to allow retry
            currentModelUrlRef.current = null;
          },
        );
      };

      // Try to fetch file size first (skip for blob URLs as they don't support HEAD)
      if (modelUrl.startsWith("blob:")) {
        // Blob URLs don't support HEAD requests, load directly
        loadModel();
      } else {
        fetch(modelUrl, { method: "HEAD" })
          .then((response) => {
            const contentLength = response.headers.get("content-length");
            const fileSize = contentLength
              ? parseInt(contentLength, 10)
              : undefined;
            loadModel(fileSize);
          })
          .catch((error) => {
            console.error("Error fetching file size:", error);
            // Continue loading even if we can't get file size
            loadModel();
          });
      }

      // Cleanup function
      return () => {
        console.log(`🧹 Cleaning up model load for: ${modelUrl}`);
        // Reset the URL ref so next load works
        if (currentModelUrlRef.current === modelUrl) {
          currentModelUrlRef.current = null;
        }
      };
      // Intentionally keep dependencies minimal to avoid reloading during internal state updates
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      modelUrl,
      onModelLoad,
      assetInfo?.isAnimationFile,
      assetInfo?.requiresAnimationStrip,
      assetInfo?.characterHeight,
    ]);

    // Apply wireframe mode
    useEffect(() => {
      if (!modelRef.current) return;

      modelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              mat.wireframe = isWireframe;
            });
          } else {
            child.material.wireframe = isWireframe;
          }
        }
      });
    }, [
      isWireframe,
      modelUrl,
      assetInfo?.requiresAnimationStrip,
      assetInfo?.characterHeight,
      showSkeleton,
    ]);

    // Grid helper
    useEffect(() => {
      if (!sceneRef.current) return;

      if (gridRef.current) {
        sceneRef.current.remove(gridRef.current);
        gridRef.current = null;
      }

      if (showGrid) {
        const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        grid.position.y = 0; // Grid at ground level
        sceneRef.current.add(grid);
        gridRef.current = grid;
      }
    }, [showGrid]);

    // Bounding box
    useEffect(() => {
      if (!modelRef.current || !sceneRef.current) return;

      const existingBox = sceneRef.current.getObjectByName("boundingBox");
      if (existingBox) {
        sceneRef.current.remove(existingBox);
      }

      if (showBounds) {
        const box = new THREE.Box3().setFromObject(modelRef.current);
        const helper = new THREE.Box3Helper(box, 0x00ff00);
        helper.name = "boundingBox";
        sceneRef.current.add(helper);
      }
    }, [
      showBounds,
      modelUrl,
      assetInfo?.requiresAnimationStrip,
      assetInfo?.characterHeight,
      showSkeleton,
    ]);

    // Ground plane
    useEffect(() => {
      if (!sceneRef.current) return;

      const existingGround = sceneRef.current.getObjectByName("groundPlane");
      if (existingGround) {
        sceneRef.current.remove(existingGround);
      }

      if (showGroundPlane) {
        const groundGeometry = new THREE.PlaneGeometry(40, 40);
        const groundMaterial = new THREE.ShadowMaterial({
          opacity: 0.3,
          color: 0x000000,
          transparent: true,
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.name = "groundPlane";
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01; // Just slightly below ground to avoid z-fighting
        ground.receiveShadow = true;
        sceneRef.current.add(ground);
      }
    }, [showGroundPlane]);

    // Play animation
    const _playAnimation = useCallback(
      (index: number) => {
        if (!mixerRef.current || !animations[index]) return;

        mixerRef.current.stopAllAction();
        const action = mixerRef.current.clipAction(animations[index]);
        action.play();
        setCurrentAnimation(index);
        setIsPlaying(true);
      },
      [animations],
    );

    const _togglePlayPause = useCallback(() => {
      if (!mixerRef.current) return;

      if (isPlaying) {
        mixerRef.current.timeScale = 0;
      } else {
        mixerRef.current.timeScale = 1;
      }
      setIsPlaying(!isPlaying);
    }, [isPlaying]);

    return (
      <div className="relative w-full h-full bg-bg-secondary rounded-lg overflow-hidden">
        <div ref={containerRef} className="w-full h-full" />

        {/* Loading overlay with smooth transition */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm transition-opacity duration-300">
            <div className="bg-bg-secondary p-8 rounded-lg shadow-xl">
              <div className="text-text-primary mb-4 text-center">
                Loading 3D Model...
              </div>
              <div className="w-64 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary-light transition-all duration-500 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <div className="text-xs text-text-tertiary mt-2 text-center">
                {Math.round(loadingProgress)}%
              </div>
            </div>
          </div>
        )}

        {/* Status indicators - moved to top center */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2">
          {/* Wireframe indicator */}
          {isWireframe && (
            <div className="px-3 py-1.5 bg-primary bg-opacity-20 text-primary rounded-md text-xs font-medium backdrop-blur-sm flex items-center gap-2 animate-fade-in">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              Wireframe Mode
            </div>
          )}

          {/* Ground plane indicator */}
          {showGroundPlane && (
            <div className="px-3 py-1.5 bg-green-600 bg-opacity-20 text-green-400 rounded-md text-xs font-medium backdrop-blur-sm animate-fade-in">
              Shadows Enabled
            </div>
          )}
        </div>

        {/* Debug info for rigged model - positioned below top-right buttons */}
        {hasRiggedModel && !isAnimationPlayer && (
          <div className="absolute top-20 right-4 px-3 py-1.5 bg-green-600 bg-opacity-20 text-green-400 rounded-md text-xs font-medium backdrop-blur-sm animate-fade-in">
            Rigged Model Detected
          </div>
        )}

        {/* Stats display - moved below buttons */}
        <div className="absolute top-20 left-4">
          {showStats && modelInfo.vertices > 0 && (
            <div className="card p-3 bg-bg-secondary bg-opacity-90 backdrop-blur-sm text-xs space-y-2 animate-scale-in shadow-lg min-w-[180px]">
              {/* Asset Info */}
              {assetInfo?.name && (
                <div className="pb-2 border-b border-border-primary">
                  <div className="font-semibold text-text-primary">
                    {assetInfo.name}
                  </div>
                  <div className="flex gap-2 text-[0.625rem] text-text-tertiary mt-0.5">
                    {assetInfo.type && (
                      <span className="capitalize">{assetInfo.type}</span>
                    )}
                    {assetInfo.tier && (
                      <>
                        <span>•</span>
                        <span
                          className="capitalize"
                          style={{ color: getTierColor(assetInfo.tier) }}
                        >
                          {assetInfo.tier}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Model Stats */}
              <div className="space-y-1">
                <div className="flex justify-between gap-4">
                  <span className="text-text-tertiary">Vertices:</span>
                  <span className="text-text-primary font-mono">
                    {modelInfo.vertices.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-text-tertiary">Polygons:</span>
                  <span className="text-text-primary font-mono">
                    {modelInfo.faces.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-text-tertiary">Materials:</span>
                  <span className="text-text-primary font-mono">
                    {modelInfo.materials}
                  </span>
                </div>
                {modelInfo.fileSize > 0 && (
                  <div className="flex justify-between gap-4">
                    <span className="text-text-tertiary">Size:</span>
                    <span className="text-text-primary font-mono">
                      {formatFileSize(modelInfo.fileSize)}
                    </span>
                  </div>
                )}
                {assetInfo?.format && (
                  <div className="flex justify-between gap-4">
                    <span className="text-text-tertiary">Format:</span>
                    <span className="text-text-primary font-mono uppercase">
                      {assetInfo.format}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Advanced controls - only show in asset browser */}
        {!isAnimationPlayer && (
          <div className="absolute bottom-4 left-32 flex gap-2">
            {/* Environment selector with better UX */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary">Environment:</span>
              <select
                value={currentEnvironment}
                onChange={(e) =>
                  setCurrentEnvironment(
                    e.target.value as keyof typeof ENVIRONMENTS,
                  )
                }
                className="px-3 py-1.5 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-md text-xs border border-border-primary text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
              >
                {Object.entries(ENVIRONMENTS).map(([key, env]) => (
                  <option key={key} value={key}>
                    {env.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Animation controls removed - animations should only be played through the animation player view */}
          </div>
        )}

        {/* Utility controls - only show in asset browser */}
        {!isAnimationPlayer && (
          <div className="absolute bottom-4 right-4 flex gap-2">
            {/* Export T-pose button - only show for rigged models */}
            {hasRiggedModel && (
              <button
                onClick={exportTPoseModel}
                className="p-2 rounded-md bg-bg-secondary bg-opacity-90 text-text-secondary hover:text-text-primary border border-transparent backdrop-blur-sm hover:scale-105 active:scale-95 transition-all duration-200"
                title="Export T-pose Model"
              >
                <Download size={16} />
              </button>
            )}

            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`p-2 rounded-md transition-all duration-200 ${
                autoRotate
                  ? "bg-primary bg-opacity-20 text-primary border border-primary border-opacity-50"
                  : "bg-bg-secondary bg-opacity-90 text-text-secondary hover:text-text-primary border border-transparent"
              } backdrop-blur-sm hover:scale-105 active:scale-95`}
              title="Auto Rotate (A)"
            >
              <RotateCw
                size={16}
                className={`transition-transform duration-500 ${autoRotate ? "animate-[spin_3s_linear_infinite]" : ""}`}
              />
            </button>

            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded-md transition-all duration-200 ${
                showGrid
                  ? "bg-primary bg-opacity-20 text-primary border border-primary border-opacity-50"
                  : "bg-bg-secondary bg-opacity-90 text-text-secondary hover:text-text-primary border border-transparent"
              } backdrop-blur-sm hover:scale-105 active:scale-95`}
              title="Toggle Grid (G)"
            >
              <Grid3X3 size={16} />
            </button>

            <button
              onClick={() => setShowBounds(!showBounds)}
              className={`p-2 rounded-md transition-all duration-200 ${
                showBounds
                  ? "bg-primary bg-opacity-20 text-primary border border-primary border-opacity-50"
                  : "bg-bg-secondary bg-opacity-90 text-text-secondary hover:text-text-primary border border-transparent"
              } backdrop-blur-sm hover:scale-105 active:scale-95`}
              title="Toggle Bounds (B)"
            >
              <Box size={16} />
            </button>

            <button
              onClick={() => setShowStats(!showStats)}
              className={`p-2 rounded-md transition-all duration-200 ${
                showStats
                  ? "bg-primary bg-opacity-20 text-primary border border-primary border-opacity-50"
                  : "bg-bg-secondary bg-opacity-90 text-text-secondary hover:text-text-primary border border-transparent"
              } backdrop-blur-sm hover:scale-105 active:scale-95`}
              title="Toggle Stats (S)"
            >
              <Info size={16} />
            </button>

            {/* Hand Controls Toggle - Only show if hand bones are detected */}
            {Object.keys(handBones).length > 0 && (
              <button
                onClick={() => setShowHandControls(!showHandControls)}
                className={`p-2 rounded-md transition-all duration-200 ${
                  showHandControls
                    ? "bg-primary bg-opacity-20 text-primary border border-primary border-opacity-50"
                    : "bg-bg-secondary bg-opacity-90 text-text-secondary hover:text-text-primary border border-transparent"
                } backdrop-blur-sm hover:scale-105 active:scale-95`}
                title="Toggle Hand Controls (H)"
              >
                <Hand size={16} />
              </button>
            )}
          </div>
        )}

        {/* Hand Bone Test Controls */}
        {showHandControls && !isAnimationPlayer && (
          <div className="absolute top-20 left-4 bg-bg-secondary bg-opacity-95 backdrop-blur-md rounded-lg border border-border-primary p-4 z-20 min-w-[280px] animate-scale-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-text-primary text-sm font-semibold">
                Hand Bone Testing
              </h3>
              <button
                onClick={() => setShowHandControls(false)}
                className="p-1 hover:bg-bg-tertiary rounded transition-colors"
                title="Close panel"
              >
                <X
                  size={14}
                  className="text-text-secondary hover:text-text-primary"
                />
              </button>
            </div>

            {/* Rotation Axis Selector */}
            <div className="mb-4 p-2 bg-bg-tertiary rounded">
              <label className="text-text-secondary text-xs font-medium block mb-2">
                Rotation Axis
              </label>
              <div className="flex gap-2">
                {(["x", "y", "z"] as const).map((axis) => (
                  <button
                    key={axis}
                    onClick={() => setRotationAxis(axis)}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      rotationAxis === axis
                        ? "bg-primary text-white"
                        : "bg-bg-secondary text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {axis.toUpperCase()}-Axis
                  </button>
                ))}
              </div>
              <p className="text-text-muted text-xs mt-2">
                Try different axes if rotation doesn't work
              </p>
            </div>

            {/* Left Hand Controls */}
            <div className="mb-4">
              <h4 className="text-text-secondary text-xs font-medium mb-2">
                Left Hand
              </h4>
              <div className="space-y-2">
                <div>
                  <label className="text-text-tertiary text-xs">
                    Palm Rotation
                  </label>
                  <input
                    type="range"
                    min="-90"
                    max="90"
                    value={handRotations.leftPalm}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      console.log(
                        `🎚️ Left palm rotation changed to: ${value}°`,
                      );
                      console.log(`  Hand bones state:`, handBones);
                      setHandRotations((prev) => ({
                        ...prev,
                        leftPalm: value,
                      }));
                    }}
                    className="w-full h-1 bg-bg-tertiary rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-text-muted text-xs">
                    {handRotations.leftPalm}°
                  </span>
                </div>
                <div>
                  <label className="text-text-tertiary text-xs">
                    Finger Curl
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    value={handRotations.leftFingers}
                    onChange={(e) =>
                      setHandRotations((prev) => ({
                        ...prev,
                        leftFingers: Number(e.target.value),
                      }))
                    }
                    className="w-full h-1 bg-bg-tertiary rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-text-muted text-xs">
                    {handRotations.leftFingers}°
                  </span>
                </div>
              </div>
            </div>

            {/* Right Hand Controls */}
            <div className="mb-4">
              <h4 className="text-text-secondary text-xs font-medium mb-2">
                Right Hand
              </h4>
              <div className="space-y-2">
                <div>
                  <label className="text-text-tertiary text-xs">
                    Palm Rotation
                  </label>
                  <input
                    type="range"
                    min="-90"
                    max="90"
                    value={handRotations.rightPalm}
                    onChange={(e) =>
                      setHandRotations((prev) => ({
                        ...prev,
                        rightPalm: Number(e.target.value),
                      }))
                    }
                    className="w-full h-1 bg-bg-tertiary rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-text-muted text-xs">
                    {handRotations.rightPalm}°
                  </span>
                </div>
                <div>
                  <label className="text-text-tertiary text-xs">
                    Finger Curl
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    value={handRotations.rightFingers}
                    onChange={(e) =>
                      setHandRotations((prev) => ({
                        ...prev,
                        rightFingers: Number(e.target.value),
                      }))
                    }
                    className="w-full h-1 bg-bg-tertiary rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-text-muted text-xs">
                    {handRotations.rightFingers}°
                  </span>
                </div>
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={() =>
                setHandRotations({
                  leftPalm: 0,
                  leftFingers: 0,
                  rightPalm: 0,
                  rightFingers: 0,
                })
              }
              className="w-full px-3 py-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary text-xs rounded transition-colors mb-2"
            >
              Reset All
            </button>

            {/* Test Animation Button */}
            <button
              onClick={() => {
                // Animate a simple grab motion
                let progress = 0;
                const animate = () => {
                  progress += 0.02;
                  if (progress > 1) progress = 0;

                  const grabAmount = Math.sin(progress * Math.PI) * 60;
                  setHandRotations({
                    leftPalm: grabAmount * 0.5,
                    leftFingers: grabAmount,
                    rightPalm: grabAmount * 0.5,
                    rightFingers: grabAmount,
                  });

                  if (progress < 1) {
                    requestAnimationFrame(animate);
                  }
                };
                animate();
              }}
              className="w-full px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs rounded transition-colors mb-2"
            >
              Test Grab Animation
            </button>

            {/* Diagnostic Button */}
            <button
              onClick={() => {
                if (!modelRef.current) return;

                console.log("=== Hand Bone Diagnostics ===");

                modelRef.current.traverse((child) => {
                  if (child instanceof THREE.SkinnedMesh) {
                    console.log(`\nSkinnedMesh: ${child.name}`);
                    console.log(
                      `  Total bones: ${child.skeleton.bones.length}`,
                    );

                    // Check our hand bones
                    const checkBone = (
                      bone: THREE.Bone | undefined,
                      name: string,
                    ) => {
                      if (!bone) return;

                      const boneIndex = child.skeleton.bones.indexOf(bone);
                      console.log(`  ${name}:`);
                      console.log(`    - Index in skeleton: ${boneIndex}`);
                      console.log(
                        `    - Parent: ${bone.parent?.name || "none"}`,
                      );
                      console.log(`    - Position: ${bone.position.toArray()}`);
                      console.log(
                        `    - World Position: ${(() => {
                          const wp = new THREE.Vector3();
                          bone.getWorldPosition(wp);
                          return wp.toArray();
                        })()}`,
                      );
                      console.log(
                        `    - Has updates: ${bone.matrixWorldNeedsUpdate}`,
                      );
                    };

                    checkBone(handBones.leftPalm, "Left Palm");
                    checkBone(handBones.leftFingers, "Left Fingers");
                    checkBone(handBones.rightPalm, "Right Palm");
                    checkBone(handBones.rightFingers, "Right Fingers");

                    // Check if skeleton is bound properly
                    console.log(
                      `  Skeleton bound: ${child.skeleton === child.skeleton}`,
                    );
                    console.log(`  Bind matrix: ${child.bindMatrix.elements}`);
                    console.log(`  Bind mode: ${child.bindMode}`);
                  }
                });

                console.log("=== End Diagnostics ===");
              }}
              className="w-full px-3 py-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary text-xs rounded transition-colors"
            >
              Run Diagnostics
            </button>

            {/* Debug Info */}
            <div className="mt-3 pt-3 border-t border-border-primary">
              <p className="text-text-muted text-xs">Debug Info:</p>
              <p className="text-text-muted text-xs">
                Left Palm: {handBones.leftPalm ? "✓" : "✗"}
              </p>
              <p className="text-text-muted text-xs">
                Left Fingers: {handBones.leftFingers ? "✓" : "✗"}
              </p>
              <p className="text-text-muted text-xs">
                Right Palm: {handBones.rightPalm ? "✓" : "✗"}
              </p>
              <p className="text-text-muted text-xs">
                Right Fingers: {handBones.rightFingers ? "✓" : "✗"}
              </p>
            </div>
          </div>
        )}

        {/* Camera presets - only show in asset browser */}
        {!isAnimationPlayer && (
          <div className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col gap-2">
            <button
              onClick={() => {
                if (
                  cameraRef.current &&
                  controlsRef.current &&
                  modelRef.current
                ) {
                  const box = new THREE.Box3().setFromObject(modelRef.current);
                  const center = box.getCenter(new THREE.Vector3());
                  const size = box.getSize(new THREE.Vector3());

                  // Calculate proper distance for front view
                  const fov = cameraRef.current.fov * (Math.PI / 180);
                  const cameraAspect = cameraRef.current.aspect;

                  let distance;
                  if (size.y / size.x > cameraAspect) {
                    distance = (size.y * 1.5) / (2 * Math.tan(fov / 2));
                  } else {
                    const hFov =
                      2 * Math.atan(Math.tan(fov / 2) * cameraAspect);
                    distance = (size.x * 1.5) / (2 * Math.tan(hFov / 2));
                  }

                  // Use more padding for smaller objects
                  const maxDim = Math.max(size.x, size.y, size.z);
                  const paddingMultiplier = maxDim < 2 ? 2.5 : 2.0;
                  distance *= paddingMultiplier;

                  // Ensure minimum distance
                  const minDistance = 8;
                  distance = Math.max(distance, minDistance);

                  // Position camera in front
                  cameraRef.current.position.set(
                    center.x,
                    center.y,
                    center.z + distance,
                  );
                  controlsRef.current.target.copy(center);
                  controlsRef.current.update();
                }
              }}
              className="p-1.5 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-md text-text-tertiary hover:text-text-primary text-xs"
              title="Front View (1)"
            >
              F
            </button>
            <button
              onClick={() => {
                if (
                  cameraRef.current &&
                  controlsRef.current &&
                  modelRef.current
                ) {
                  const box = new THREE.Box3().setFromObject(modelRef.current);
                  const center = box.getCenter(new THREE.Vector3());
                  const size = box.getSize(new THREE.Vector3());

                  // Calculate proper distance for side view
                  const fov = cameraRef.current.fov * (Math.PI / 180);
                  const cameraAspect = cameraRef.current.aspect;

                  let distance;
                  if (size.y / size.z > cameraAspect) {
                    distance = (size.y * 1.5) / (2 * Math.tan(fov / 2));
                  } else {
                    const hFov =
                      2 * Math.atan(Math.tan(fov / 2) * cameraAspect);
                    distance = (size.z * 1.5) / (2 * Math.tan(hFov / 2));
                  }

                  // Use more padding for smaller objects
                  const maxDim = Math.max(size.x, size.y, size.z);
                  const paddingMultiplier = maxDim < 2 ? 2.5 : 2.0;
                  distance *= paddingMultiplier;

                  // Ensure minimum distance
                  const minDistance = 8;
                  distance = Math.max(distance, minDistance);

                  // Position camera to the side
                  cameraRef.current.position.set(
                    center.x + distance,
                    center.y,
                    center.z,
                  );
                  controlsRef.current.target.copy(center);
                  controlsRef.current.update();
                }
              }}
              className="p-1.5 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-md text-text-tertiary hover:text-text-primary text-xs"
              title="Side View (2)"
            >
              S
            </button>
            <button
              onClick={() => {
                if (
                  cameraRef.current &&
                  controlsRef.current &&
                  modelRef.current
                ) {
                  const box = new THREE.Box3().setFromObject(modelRef.current);
                  const center = box.getCenter(new THREE.Vector3());
                  const size = box.getSize(new THREE.Vector3());
                  const maxDim = Math.max(size.x, size.y, size.z);

                  cameraRef.current.position.set(
                    center.x,
                    center.y + maxDim * 2,
                    center.z,
                  );
                  controlsRef.current.target.copy(center);
                  controlsRef.current.update();
                }
              }}
              className="p-1.5 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-md text-text-tertiary hover:text-text-primary text-xs"
              title="Top View (3)"
            >
              T
            </button>
          </div>
        )}

        {/* Shortcuts button - only in asset browser */}
        {!isAnimationPlayer && (
          <>
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className={`absolute bottom-4 left-4 px-3 py-1.5 backdrop-blur-sm rounded-md text-xs transition-all duration-200 flex items-center gap-1.5 z-20 ${
                showShortcuts
                  ? "bg-primary bg-opacity-20 text-primary border border-primary border-opacity-50"
                  : "bg-bg-secondary bg-opacity-90 text-text-secondary hover:text-text-primary border border-transparent hover:border-border-primary"
              }`}
            >
              <Keyboard size={14} />
              Shortcuts
            </button>

            {/* Shortcuts display */}
            {showShortcuts && (
              <div className="absolute bottom-16 left-4 bg-bg-secondary bg-opacity-95 backdrop-blur-md rounded-lg border border-border-primary p-4 z-20 min-w-[240px] animate-scale-in">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <kbd className="px-2 py-1 bg-bg-primary rounded border border-border-primary text-text-secondary font-mono text-[11px]">
                      F
                    </kbd>
                    <span className="text-text-muted ml-3">Focus on model</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <kbd className="px-2 py-1 bg-bg-primary rounded border border-border-primary text-text-secondary font-mono text-[11px]">
                      R
                    </kbd>
                    <span className="text-text-muted ml-3">Reset camera</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <kbd className="px-2 py-1 bg-bg-primary rounded border border-border-primary text-text-secondary font-mono text-[11px]">
                      1/2/3
                    </kbd>
                    <span className="text-text-muted ml-3">Camera views</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <kbd className="px-2 py-1 bg-bg-primary rounded border border-border-primary text-text-secondary font-mono text-[11px]">
                      G
                    </kbd>
                    <span className="text-text-muted ml-3">Toggle grid</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <kbd className="px-2 py-1 bg-bg-primary rounded border border-border-primary text-text-secondary font-mono text-[11px]">
                      B
                    </kbd>
                    <span className="text-text-muted ml-3">Toggle bounds</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <kbd className="px-2 py-1 bg-bg-primary rounded border border-border-primary text-text-secondary font-mono text-[11px]">
                      S
                    </kbd>
                    <span className="text-text-muted ml-3">Toggle stats</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <kbd className="px-2 py-1 bg-bg-primary rounded border border-border-primary text-text-secondary font-mono text-[11px]">
                      A
                    </kbd>
                    <span className="text-text-muted ml-3">Auto rotate</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <kbd className="px-2 py-1 bg-bg-primary rounded border border-border-primary text-text-secondary font-mono text-[11px]">
                      H
                    </kbd>
                    <span className="text-text-muted ml-3">Hand controls</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 bg-bg-primary rounded border border-border-primary text-text-secondary font-mono text-[11px]">
                        ?
                      </kbd>
                      <kbd className="px-2 py-1 bg-bg-primary rounded border border-border-primary text-text-secondary font-mono text-[11px]">
                        /
                      </kbd>
                    </div>
                    <span className="text-text-muted ml-3">Toggle help</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!modelUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto text-text-muted mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <p className="text-text-tertiary">Select an asset to view</p>
            </div>
          </div>
        )}
      </div>
    );
  },
);

ThreeViewer.displayName = "ThreeViewer";

export default ThreeViewer;
