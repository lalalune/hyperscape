import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { retargetAnimationToVRM } from "../utils/vrmAnimationRetarget";

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
        scene.add(vrm.scene);
        console.log("[CharacterPreview] VRM loaded successfully");

        // --- Animation Setup ---
        // Calculate rootToHips
        let rootToHips = 1;
        const humanoid = vrm.humanoid;
        if (humanoid && (humanoid as any).normalizedRestPose?.hips) {
          rootToHips = (humanoid as any).normalizedRestPose.hips.position[1];
        } else {
          const hipsNode = humanoid?.getRawBoneNode("hips");
          if (hipsNode) {
            const v = new THREE.Vector3();
            hipsNode.getWorldPosition(v);
            rootToHips = v.y;
          }
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
            vrmBoneName as any,
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

        let isWaving = true;
        let idleTimer = 0;
        const IDLE_DURATION = 7;

        // Start Sequence
        waveAction.reset().play();

        mixer.addEventListener("finished", (e) => {
          if (e.action === waveAction) {
            waveAction.fadeOut(0.5);
            idleAction.reset().fadeIn(0.5).play();
            isWaving = false;
            idleTimer = 0;
          }
        });

        // Animation State
        (mixerRef.current as any).animState = {
          waveAction,
          idleAction,
          updateIdleTimer: (delta: number) => {
            if (!isWaving) {
              idleTimer += delta;
              if (idleTimer >= IDLE_DURATION) {
                idleAction.fadeOut(0.5);
                waveAction.reset().fadeIn(0.5).play();
                isWaving = true;
              }
            }
          },
        };
        console.log("[CharacterPreview] Animations started");
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
          const animState = (mixerRef.current as any).animState;
          if (animState?.updateIdleTimer) {
            animState.updateIdleTimer(delta);
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

    // Handle Resize
    const handleResize = () => {
      if (containerRef.current && cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect =
          containerRef.current.clientWidth / containerRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight,
        );
      }
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(frameIdRef.current);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
      }
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        // mixerRef.current.uncacheRoot(vrmRef.current.scene); // This might fail if vrmRef.current is already null
        mixerRef.current = null;
      }
    };
  }, [vrmUrl]); // Re-run everything when vrmUrl changes

  return <div ref={containerRef} className={`w-full h-full ${className}`} />;
};
