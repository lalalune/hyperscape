import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils, VRMHumanBoneName } from "@pixiv/three-vrm";
import { retargetAnimationToVRM } from "../utils/vrmAnimationRetarget";

interface AnimationState {
  waveAction: THREE.AnimationAction;
  idleAction: THREE.AnimationAction;
  isWaving: boolean;
  idleTimer: number;
}

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
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animStateRef = useRef<AnimationState | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const frameIdRef = useRef<number>(0);

  // Main Effect: Initialize Scene and Load VRM + Animations
  useEffect(() => {
    if (!containerRef.current) return;

    // --- Initialization ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      30,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      20.0,
    );
    camera.position.set(0, 1.4, 3.0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight,
    );
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Loaders
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

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

        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);

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
        // Calculate rootToHips from hips bone position
        let rootToHips = 1;
        const hipsNode = vrm.humanoid?.getRawBoneNode("hips");
        if (hipsNode) {
          const v = new THREE.Vector3();
          hipsNode.getWorldPosition(v);
          rootToHips = v.y;
        }

        const waveUrl =
          "http://localhost:8080/emotes/emote-waving-both-hands.glb";
        const idleUrl = "http://localhost:8080/emotes/emote-idle.glb";

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
        const waveClip = retargetAnimationToVRM(
          waveGltf,
          getBoneName,
          rootToHips,
        );
        const idleClip = retargetAnimationToVRM(
          idleGltf,
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

        // Initialize animation state
        animStateRef.current = {
          waveAction,
          idleAction,
          isWaving: true,
          idleTimer: 0,
        };

        // Start Sequence - wave first, then show the model
        waveAction.reset().play();

        // Now that animation is playing, show the model (no more T-pose)
        vrm.scene.visible = true;
        console.log("[CharacterPreview] Animations ready, model visible");

        mixer.addEventListener("finished", (e) => {
          const animState = animStateRef.current;
          if (!animState) return;
          
          if (e.action === animState.waveAction) {
            animState.waveAction.fadeOut(0.5);
            animState.idleAction.reset().fadeIn(0.5).play();
            animState.isWaving = false;
            animState.idleTimer = 0;
          }
        });

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
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();

      if (vrmRef.current) {
        vrmRef.current.update(delta);

        if (mixerRef.current) {
          mixerRef.current.update(delta);
          
          // Update idle timer for wave -> idle -> wave loop
          const animState = animStateRef.current;
          if (animState && !animState.isWaving) {
            animState.idleTimer += delta;
            if (animState.idleTimer >= 7) { // IDLE_DURATION
              animState.idleAction.fadeOut(0.5);
              animState.waveAction.reset().fadeIn(0.5).play();
              animState.isWaving = true;
              animState.idleTimer = 0;
            }
          }
        }

        // Manual skeleton update
        vrmRef.current.scene.traverse((obj: THREE.Object3D) => {
          if (obj instanceof THREE.SkinnedMesh) {
            obj.skeleton.bones.forEach((bone: THREE.Bone) =>
              bone.updateMatrixWorld(),
            );
            obj.skeleton.update();
          }
        });
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

    // Cleanup
    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frameIdRef.current);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
      }
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      animStateRef.current = null;
    };
  }, [vrmUrl]); // Re-run everything when vrmUrl changes

  return <div ref={containerRef} className={`w-full h-full ${className}`} />;
};
