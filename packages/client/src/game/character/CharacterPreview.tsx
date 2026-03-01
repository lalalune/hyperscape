import React, { useEffect, useRef } from "react";
import { THREE, createRenderer } from "@hyperscape/shared";
import type { WebGPURenderer } from "@hyperscape/shared";
import {
  GLTFLoader,
  type GLTFParser,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { retargetAnimationToVRM } from "../../utils/vrmAnimationRetarget";
import { CDN_URL } from "../../lib/api-config";
import { ThreeResourceManager } from "../../lib/ThreeResourceManager";

// Extended types for VRM and AnimationMixer
interface VRMHumanoidWithRestPose {
  normalizedRestPose?: {
    hips?: {
      position: [number, number, number];
    };
  };
  getRawBoneNode?: (name: string) => THREE.Object3D | null;
}

interface AnimationMixerWithState extends THREE.AnimationMixer {
  animState?: {
    waveAction: THREE.AnimationAction;
    idleAction: THREE.AnimationAction;
    updateIdleTimer: (delta: number) => void;
  };
}

type VRMHumanBoneName =
  | "hips"
  | "spine"
  | "chest"
  | "upperChest"
  | "neck"
  | "head"
  | "leftShoulder"
  | "leftUpperArm"
  | "leftLowerArm"
  | "leftHand"
  | "rightShoulder"
  | "rightUpperArm"
  | "rightLowerArm"
  | "rightHand"
  | "leftUpperLeg"
  | "leftLowerLeg"
  | "leftFoot"
  | "leftToes"
  | "rightUpperLeg"
  | "rightLowerLeg"
  | "rightFoot"
  | "rightToes";

interface CharacterPreviewProps {
  vrmUrl: string;
  className?: string;
}

export const CharacterPreview: React.FC<CharacterPreviewProps> = ({
  vrmUrl,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<WebGPURenderer | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const frameIdRef = useRef<number>(0);
  const rendererInitializedRef = useRef<boolean>(false);
  // Store lights in refs for proper disposal
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);

  // Main Effect: Initialize Scene and Load VRM + Animations
  useEffect(() => {
    if (!containerRef.current) return;

    // --- Initialization ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Lights - stored in refs for proper disposal
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);
    directionalLightRef.current = directionalLight;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      30,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      20.0,
    );
    camera.position.set(0, 1.4, 3.0);
    cameraRef.current = camera;

    // Create a canvas for the renderer
    const canvas = document.createElement("canvas");
    containerRef.current.appendChild(canvas);

    // Renderer - async WebGPU initialization
    createRenderer({ canvas, alpha: true, antialias: true })
      .then((renderer) => {
        if (!isMounted) {
          renderer.dispose();
          return;
        }
        renderer.setSize(
          containerRef.current!.clientWidth,
          containerRef.current!.clientHeight,
        );
        renderer.setPixelRatio(window.devicePixelRatio);
        rendererRef.current = renderer;
        rendererInitializedRef.current = true;
      })
      .catch((err) => {
        console.error("[CharacterPreview] Failed to create renderer:", err);
      });

    // Loaders
    const loader = new GLTFLoader();
    // Enable meshopt decoder for compressed GLB files (EXT_meshopt_compression)
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.register((parser: GLTFParser) => new VRMLoaderPlugin(parser));

    // --- Loading Logic ---
    let isMounted = true;

    const loadVRMAndAnimations = async () => {
      if (!vrmUrl) return;

      try {
        console.log("[CharacterPreview] Loading VRM:", vrmUrl);
        const gltf = await loader.loadAsync(vrmUrl);

        if (!isMounted) return;

        const vrm = gltf.userData.vrm as VRM;

        // Cleanup previous VRM
        if (vrmRef.current) {
          scene.remove(vrmRef.current.scene);
          VRMUtils.deepDispose(vrmRef.current.scene);
          // Also dispose of the previous mixer if it exists
          if (mixerRef.current) {
            mixerRef.current.stopAllAction();
            mixerRef.current.uncacheRoot(vrmRef.current.scene);
            mixerRef.current = null;
          }
        }

        // Type assertions needed due to three.js version mismatch between packages
        VRMUtils.removeUnnecessaryVertices(
          gltf.scene as unknown as THREE.Object3D,
        );
        VRMUtils.combineSkeletons(gltf.scene as unknown as THREE.Object3D);

        vrmRef.current = vrm;

        // Height Normalization
        const normBones = vrm.humanoid?.normalizedHumanBones;
        if (normBones?.head) {
          const headPos = new THREE.Vector3();
          normBones.head.node.getWorldPosition(headPos);
          const targetHeight = 1.6;
          const currentHeight = headPos.y;
          if (currentHeight > 0) {
            const scale = targetHeight / currentHeight;
            vrm.scene.scale.setScalar(scale);
          }
        }

        // Update humanoid once to set initial pose
        vrm.humanoid.update();

        // Hide model until animations are loaded to avoid T-pose flash
        vrm.scene.visible = false;
        scene.add(vrm.scene);
        console.log("[CharacterPreview] VRM loaded, waiting for animations...");

        // --- Animation Setup ---
        // Calculate rootToHips
        let rootToHips = 1;
        const humanoid = vrm.humanoid as VRMHumanoidWithRestPose;
        if (humanoid && humanoid.normalizedRestPose?.hips) {
          rootToHips = humanoid.normalizedRestPose.hips.position[1];
        } else {
          const hipsNode = humanoid?.getRawBoneNode?.("hips");
          if (hipsNode) {
            const v = new THREE.Vector3();
            hipsNode.getWorldPosition(v);
            rootToHips = v.y;
          }
        }

        const waveUrl = `${CDN_URL}/emotes/emote-waving-both-hands.glb`;
        const idleUrl = `${CDN_URL}/emotes/emote-idle.glb`;

        console.log("[CharacterPreview] Loading animations...");
        const [waveGltf, idleGltf] = await Promise.all([
          loader.loadAsync(waveUrl),
          loader.loadAsync(idleUrl),
        ]);

        if (!isMounted) return;

        if (!waveGltf.animations?.[0] || !idleGltf.animations?.[0]) {
          console.error("[CharacterPreview] Missing animations!");
          return;
        }

        // Retargeting
        const getBoneName = (vrmBoneName: string) => {
          const normalizedNode = vrm.humanoid.getNormalizedBoneNode(
            vrmBoneName as VRMHumanBoneName,
          );
          return normalizedNode?.name;
        };

        console.log("[CharacterPreview] Retargeting animations...");
        // Type assertions needed due to three.js version mismatch between packages
        const waveClip = retargetAnimationToVRM(
          waveGltf as unknown as {
            scene: THREE.Group;
            animations: THREE.AnimationClip[];
          },
          getBoneName,
          rootToHips,
        );
        const idleClip = retargetAnimationToVRM(
          idleGltf as unknown as {
            scene: THREE.Group;
            animations: THREE.AnimationClip[];
          },
          getBoneName,
          rootToHips,
        );

        if (!waveClip || !idleClip) {
          console.error("[CharacterPreview] Failed to retarget animations!");
          return;
        }

        // Mixer Setup
        const mixer = new THREE.AnimationMixer(vrm.scene);
        mixerRef.current = mixer;

        const waveAction = mixer.clipAction(waveClip);
        const idleAction = mixer.clipAction(idleClip);

        waveAction.setLoop(THREE.LoopOnce, 1);
        waveAction.clampWhenFinished = true;
        idleAction.setLoop(THREE.LoopRepeat, Infinity);

        let isWaving = true;
        let idleTimer = 0;
        const IDLE_DURATION = 7;

        // Start Sequence - wave first, then show the model
        waveAction.reset().play();

        // Now that animation is playing, show the model (no more T-pose)
        vrm.scene.visible = true;
        console.log("[CharacterPreview] Animations ready, model visible");

        mixer.addEventListener("finished", (e) => {
          if (e.action === waveAction) {
            waveAction.fadeOut(0.5);
            idleAction.reset().fadeIn(0.5).play();
            isWaving = false;
            idleTimer = 0;
          }
        });

        // Animation State - manages the wave -> idle -> wave loop
        (mixerRef.current as AnimationMixerWithState).animState = {
          waveAction,
          idleAction,
          updateIdleTimer: (delta: number) => {
            if (!isWaving) {
              idleTimer += delta;
              if (idleTimer >= IDLE_DURATION) {
                // Transition from idle back to wave
                idleAction.fadeOut(0.5);
                waveAction.reset().fadeIn(0.5).play();
                isWaving = true;
                idleTimer = 0; // Reset timer for next cycle
              }
            }
          },
        };
        console.log(
          "[CharacterPreview] Animation loop: wave -> idle (7s) -> wave",
        );
      } catch (error) {
        console.error(
          "[CharacterPreview] Error loading VRM/Animations:",
          error,
        );
      }
    };

    loadVRMAndAnimations();

    // --- Animation Loop ---
    // Pre-define skeleton update callback to avoid creating a new function every frame
    // This reduces GC pressure in the hot animation loop
    const updateSkeletonCallback = (obj: THREE.Object3D) => {
      if (obj instanceof THREE.SkinnedMesh) {
        const bones = obj.skeleton.bones;
        for (let i = 0; i < bones.length; i++) {
          bones[i].updateMatrixWorld();
        }
        obj.skeleton.update();
      }
    };

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();

      if (vrmRef.current) {
        vrmRef.current.update(delta);

        if (mixerRef.current) {
          mixerRef.current.update(delta);
          const animState = (mixerRef.current as AnimationMixerWithState)
            .animState;
          if (animState?.updateIdleTimer) {
            animState.updateIdleTimer(delta);
          }
        }

        // Manual skeleton update - using pre-defined callback to avoid GC
        vrmRef.current.scene.traverse(updateSkeletonCallback);
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Handle Resize - responds to both window resize AND container size changes
    const baseAspect = 16 / 9; // Reference aspect ratio
    const baseCameraZ = 3.0; // Base camera distance

    const handleResize = () => {
      if (containerRef.current && cameraRef.current && rendererRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        if (width > 0 && height > 0) {
          const aspect = width / height;
          cameraRef.current.aspect = aspect;

          // Adjust camera distance for narrower aspect ratios to keep character fully visible
          // When aspect ratio is narrower than base, move camera back proportionally
          if (aspect < baseAspect) {
            const zoomFactor = baseAspect / aspect;
            cameraRef.current.position.z =
              baseCameraZ * Math.min(zoomFactor, 1.5); // Cap at 1.5x distance
          } else {
            cameraRef.current.position.z = baseCameraZ;
          }

          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(width, height);
        }
      }
    };
    window.addEventListener("resize", handleResize);

    // Use ResizeObserver to detect container size changes (e.g., when layout shifts)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Cleanup - IMPORTANT: Order matters!
    // VRM must be disposed BEFORE renderer to avoid "usedTimes undefined" error.
    // The WebGPU renderer tracks materials internally, and disposing it first
    // leaves stale event listeners that fail when VRM materials are disposed.
    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      cancelAnimationFrame(frameIdRef.current);

      // 1. Stop animations first
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        if (vrmRef.current) {
          mixerRef.current.uncacheRoot(vrmRef.current.scene);
        }
        mixerRef.current = null;
      }

      // 2. Remove VRM from scene and dispose it BEFORE renderer
      if (vrmRef.current && sceneRef.current) {
        sceneRef.current.remove(vrmRef.current.scene);
        VRMUtils.deepDispose(vrmRef.current.scene);
        vrmRef.current = null;
      }

      // 3. Dispose lights using ThreeResourceManager
      if (directionalLightRef.current) {
        ThreeResourceManager.disposeObject(directionalLightRef.current, {
          removeFromParent: true,
        });
        directionalLightRef.current = null;
      }
      if (ambientLightRef.current) {
        ThreeResourceManager.disposeObject(ambientLightRef.current, {
          removeFromParent: true,
        });
        ambientLightRef.current = null;
      }

      // 4. Dispose renderer AFTER VRM and lights cleanup
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        ThreeResourceManager.disposeRenderer(rendererRef.current);
        rendererRef.current = null;
        rendererInitializedRef.current = false;
      }

      // 5. Dispose scene and clear reference
      if (sceneRef.current) {
        ThreeResourceManager.disposeScene(sceneRef.current);
        sceneRef.current = null;
      }

      // 6. Clear camera reference
      cameraRef.current = null;
    };
  }, [vrmUrl]); // Re-run everything when vrmUrl changes

  return <div ref={containerRef} className={`w-full h-full ${className}`} />;
};
